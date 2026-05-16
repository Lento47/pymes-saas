import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CloudflareAiService } from './cloudflare-ai.service';
import { NotificationsService } from '../notifications/notifications.service';

export type TriageVerdict = 'USER_ERROR' | 'MISCONFIGURATION' | 'BUG' | 'PLATFORM_INCIDENT' | 'UNKNOWN';

export interface TriageResult {
  verdict: TriageVerdict;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  guidance_for_user?: string;
  should_escalate: boolean;
  similar_cases_count: number;
}

/**
 * AI Triage Service — cuando un caso de diagnóstico se abre, este servicio
 * usa Cloudflare AI para analizar el error y determinar:
 * - USER_ERROR: el usuario hizo algo mal → auto-responder con guía
 * - MISCONFIGURATION: la configuración del workspace está mal → guía específica
 * - BUG: error real del producto → escalar a plataforma
 * - PLATFORM_INCIDENT: error crítico → escalar urgente
 *
 * Previene falsos positivos deduplicando y requiriendo múltiples ocurrencias
 * antes de escalar bugs no críticos.
 */
@Injectable()
export class AiTriageService {
  private readonly logger = new Logger(AiTriageService.name);

  // Counter for similar errors across workspaces — if 3+ workspaces hit
  // the same error_code within 24h, it's likely a bug, not user error.
  private readonly dedupWindowMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflareAi?: CloudflareAiService,
    private readonly notifications?: NotificationsService,
  ) {}

  /**
   * Run AI triage on a diagnostic case. Called after creation.
   * This is non-blocking — never throw, log and swallow errors.
   */
  async triage(diagnosticCaseId: string): Promise<void> {
    try {
      const dCase = await (this.prisma as any).supportDiagnosticCase.findUnique({
        where: { id: diagnosticCaseId },
        select: {
          id: true,
          workspace_id: true,
          user_id: true,
          error_code: true,
          category: true,
          risk_level: true,
          title: true,
          user_description: true,
          evidence_json: true,
          created_at: true,
        },
      });
      if (!dCase) return;

      // 1. Deduplication: count similar cases across all workspaces (last 24h)
      const similarCount = await this.countSimilar(dCase.error_code, dCase.created_at);

      // 2. Run AI classification if Cloudflare AI is configured
      if (this.cloudflareAi?.isConfigured) {
        const verdict = await this.classifyWithAI(dCase, similarCount);
        await this.applyVerdict(dCase, verdict);
      } else {
        // Fallback: heuristic-based triage
        const verdict = this.heuristicTriage(dCase, similarCount);
        await this.applyVerdict(dCase, verdict);
      }
    } catch (err: any) {
      this.logger.error(`AI triage failed for case ${diagnosticCaseId}: ${err.message}`);
    }
  }

  private async countSimilar(errorCode: string, createdAt: Date): Promise<number> {
    const windowStart = new Date(createdAt.getTime() - this.dedupWindowMs);
    try {
      const count = await (this.prisma as any).supportDiagnosticCase.count({
        where: {
          error_code: errorCode,
          created_at: { gte: windowStart, lt: createdAt },
        },
      });
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Use Cloudflare AI to classify the error. The RAG search gives us
   * context from the PymesHub knowledge base to determine if this
   * is a known user mistake or a real product bug.
   */
  private async classifyWithAI(
    dCase: any,
    similarCount: number,
  ): Promise<TriageResult> {
    const evidence = typeof dCase.evidence_json === 'object'
      ? dCase.evidence_json
      : {};

    const prompt = `Eres un agente de soporte técnico de PymesHub. Analizá este caso de error y determiná si es:

1) USER_ERROR — el usuario hizo algo mal (ej: mandó datos inválidos, usó mal la API)
2) MISCONFIGURATION — el workspace está mal configurado (ej: token inválido, webhook mal puesto)
3) BUG — un error real del producto que hay que corregir
4) PLATFORM_INCIDENT — error crítico de infraestructura (500s, caídas)

Caso:
- Título: ${dCase.title || ''}
- Descripción: ${dCase.user_description || ''}
- Código de error: ${dCase.error_code || ''}
- Categoría actual: ${dCase.category || ''}
- Riesgo: ${dCase.risk_level || ''}
- Evidencia: ${JSON.stringify(evidence).slice(0, 300)}
- Workspaces con el mismo error (24h): ${similarCount}

Respondé SOLO con un JSON así, sin explicaciones extra:
{"verdict":"USER_ERROR|MISCONFIGURATION|BUG|PLATFORM_INCIDENT","confidence":"HIGH|MEDIUM|LOW","explanation":"...","guidance_for_user":"...","should_escalate":true|false}`;

    try {
      const result = await this.cloudflareAi!.ask(prompt, [], 'Eres el agente de triage de PymesHub. Respondé solo con JSON válido.');
      const parsed = JSON.parse(result.answer);
      return {
        verdict: parsed.verdict || 'UNKNOWN',
        confidence: parsed.confidence || 'LOW',
        explanation: parsed.explanation || 'Análisis no disponible',
        guidance_for_user: parsed.guidance_for_user || '',
        should_escalate: parsed.should_escalate ?? (dCase.category === 'PLATFORM_INCIDENT'),
        similar_cases_count: similarCount,
      };
    } catch {
      return this.heuristicTriage(dCase, similarCount);
    }
  }

  /**
   * Fallback heuristics when Cloudflare AI is unavailable.
   */
  private heuristicTriage(dCase: any, similarCount: number): TriageResult {
    const is5xx = dCase.risk_level === 'high' || dCase.category === 'PLATFORM_INCIDENT';
    const isConfig = dCase.category === 'WORKSPACE_CONFIGURATION';
    const isAuth = dCase.error_code?.includes('AUTH') || dCase.error_code === 'MISSING_CONFIG';
    const isConnectivity = dCase.error_code === 'CONNECTIVITY_ISSUE' || dCase.error_code === 'SOCKET_ERROR';

    // High confidence conditions
    if (is5xx && similarCount >= 3) {
      return { verdict: 'PLATFORM_INCIDENT', confidence: 'HIGH', explanation: `${similarCount} workspaces afectados en 24hs con error 500`, guidance_for_user: 'Estamos revisando este incidente.', should_escalate: true, similar_cases_count: similarCount };
    }
    if (isAuth) {
      return { verdict: 'USER_ERROR', confidence: 'HIGH', explanation: 'Error de autenticación — credenciales inválidas', guidance_for_user: 'Revisá tus credenciales en Configuración → Canales. Si el problema persiste, contactanos.', should_escalate: false, similar_cases_count: similarCount };
    }
    if (isConfig) {
      return { verdict: 'MISCONFIGURATION', confidence: 'MEDIUM', explanation: 'Error de configuración del workspace', guidance_for_user: 'Revisá la configuración del módulo afectado en Configuración. Si necesitás ayuda, consultá la documentación.', should_escalate: false, similar_cases_count: similarCount };
    }
    if (isConnectivity) {
      return { verdict: 'PLATFORM_INCIDENT', confidence: 'LOW', explanation: 'Posible problema de conectividad', guidance_for_user: 'Parece un problema temporal de conexión. Intentá de nuevo en unos minutos.', should_escalate: similarCount >= 2, similar_cases_count: similarCount };
    }
    if (is5xx) {
      return { verdict: 'BUG', confidence: 'MEDIUM', explanation: 'Error interno del servidor', guidance_for_user: 'Ocurrió un error inesperado. Nuestro equipo lo está revisando.', should_escalate: true, similar_cases_count: similarCount };
    }

    return {
      verdict: 'UNKNOWN',
      confidence: 'LOW',
      explanation: 'No se pudo clasificar automáticamente. Se requiere revisión manual.',
      guidance_for_user: 'Si el problema persiste, contactá a soporte.',
      should_escalate: similarCount >= 5,
      similar_cases_count: similarCount,
    };
  }

  /**
   * Apply the triage verdict to the diagnostic case:
   * - Update category, risk level, add triage notes
   * - If user error + confident → auto-close with guidance
   * - If bug → escalate (change status, notify platform admin)
   */
  private async applyVerdict(dCase: any, verdict: TriageResult): Promise<void> {
    const triageJson = {
      triage: {
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        explanation: verdict.explanation,
        guidance_for_user: verdict.guidance_for_user,
        should_escalate: verdict.should_escalate,
        similar_cases_count: verdict.similar_cases_count,
        triaged_at: new Date().toISOString(),
      },
    };

    // Merge triage info into existing evidence
    const existingEvidence = typeof dCase.evidence_json === 'object' ? dCase.evidence_json : {};
    const mergedEvidence = { ...existingEvidence, ...triageJson };

    const update: any = {
      evidence_json: mergedEvidence,
    };

    // Update category based on verdict
    if (verdict.verdict === 'USER_ERROR') {
      update.category = 'USER_GUIDANCE';
      update.risk_level = 'low';
      update.resolution_json = { summary: verdict.guidance_for_user, resolution: 'Auto-resuelto — error de usuario' };
      // Auto-close user errors with guidance
      if (verdict.confidence === 'HIGH' || verdict.confidence === 'MEDIUM') {
        update.status = 'RESOLVED';
        update.safe_summary = verdict.guidance_for_user;
      }
    } else if (verdict.verdict === 'MISCONFIGURATION') {
      update.category = 'WORKSPACE_CONFIGURATION';
      update.risk_level = 'low';
      if (verdict.confidence === 'HIGH') {
        update.status = 'RESOLVED';
        update.safe_summary = verdict.guidance_for_user;
        update.resolution_json = { summary: verdict.guidance_for_user, resolution: 'Auto-resuelto — guía de configuración' };
      }
    } else if (verdict.verdict === 'BUG' || verdict.verdict === 'PLATFORM_INCIDENT') {
      update.category = verdict.verdict === 'PLATFORM_INCIDENT' ? 'PLATFORM_INCIDENT' : 'PRODUCT_BUG';
      update.risk_level = verdict.verdict === 'PLATFORM_INCIDENT' ? 'critical' : 'high';
      if (verdict.should_escalate) {
        update.status = 'ESCALATED';
        update.safe_summary = `Bug confirmado: ${verdict.explanation}. Similar en ${verdict.similar_cases_count} workspace(s).`;
      }
    } else {
      update.risk_level = 'medium';
    }

    try {
      await (this.prisma as any).supportDiagnosticCase.update({
        where: { id: dCase.id },
        data: update,
      });

      // Send notification if escalated
      if (update.status === 'ESCALATED' || update.category === 'PLATFORM_INCIDENT' || update.category === 'PRODUCT_BUG') {
        await this.notifyBugEscalation(dCase, verdict);
      }
    } catch (err: any) {
      this.logger.error(`Failed to apply triage verdict for case ${dCase.id}: ${err.message}`);
    }
  }

  /**
   * Notify platform admins when a real bug is found.
   * Creates notification and optionally triggers external webhook.
   */
  private async notifyBugEscalation(dCase: any, verdict: TriageResult): Promise<void> {
    try {
      // Find platform admins
      const admins = await (this.prisma as any).user.findMany({
        where: { is_platform_admin: true },
        select: { id: true },
      });

      // Create notification for each platform admin
      for (const admin of admins) {
        await this.notifications!.create('PLATFORM', {
          user_id: admin.id,
          type: 'bug_escalated',
          title: `🐛 Bug detectado: ${verdict.verdict === 'PLATFORM_INCIDENT' ? '🔥 Incidente' : '🐞 Bug'} en ${dCase.error_code || 'desconocido'}`,
          body: `${verdict.explanation}\n\nWorkspace: ${dCase.workspace_id}\nSimilar en ${verdict.similar_cases_count} workspace(s)\n\nVeredicto: ${verdict.verdict} (confianza: ${verdict.confidence})`,
          related_entity_type: 'support_diagnostic_case',
          related_entity_id: dCase.id,
        }).catch(() => {});
      }
    } catch (err: any) {
      this.logger.warn(`Escalation notification failed: ${err.message}`);
    }
  }
}
