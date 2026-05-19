import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiTriageService } from './ai-triage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EngineeringFixService } from './engineering-fix.service';
import { SupportNotificationService } from './support-notification.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { Prisma } from '@prisma/client';

export interface DiagnosticInput {
  workspaceId: string;
  userId?: string;
  module?: string;
  error_code?: string;
  trace_id?: string;
  user_description?: string;
  error_report_id?: string;
}

export interface DiagnosticResult {
  case_id: string;
  category: string;
  risk_level: string;
  title: string;
  recommendation: string;
  matched_known_issue?: {
    error_code: string;
    title: string;
    workaround: string;
    fix_status: string;
  };
}

export const MODULE_MAP: Record<string, string> = {
  '/api/invoices': 'invoices',
  '/api/hacienda': 'hacienda',
  '/api/billing': 'billing',
  '/api/pipeline': 'pipeline',
  '/api/contacts': 'contacts',
  '/api/tasks': 'tasks',
  '/api/conversations': 'conversations',
  '/api/automations': 'automations',
  '/api/documents': 'documents',
  '/api/auth': 'auth',
  '/api/workspaces': 'workspaces',
  '/api/channels': 'channels',
  '/api/notifications': 'notifications',
  '/api/agent': 'agent',
  '/api/settings': 'settings',
};

@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly fixService: EngineeringFixService,
    private readonly supportNotifications: SupportNotificationService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly triage: AiTriageService,
  ) {}

  // ADMIN/platform-admin: full workspace view. Otherwise scope to caller's
  // own cases so VIEWER/AGENT users see "Mis tickets" without leaking
  // unrelated incidents from other teammates.
  async listCases(workspaceId: string, opts?: { userId?: string }) {
    const where: { workspace_id: string; user_id?: string } = { workspace_id: workspaceId };
    if (opts?.userId) where.user_id = opts.userId;
    const cases = await this.prisma.supportDiagnosticCase.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // Mask internal error details from non-admin users
    if (opts?.userId) {
      return cases.map((c) => ({
        ...c,
        title: 'Error procesando tu solicitud',
        user_description: 'Nuestro equipo está revisando este incidente.',
      }));
    }
    return cases;
  }

  async getCase(id: string, opts: { workspaceId: string; userId?: string }) {
    const where: { id: string; workspace_id: string; user_id?: string } = { id, workspace_id: opts.workspaceId };
    if (opts.userId) where.user_id = opts.userId;
    const case_ = await this.prisma.supportDiagnosticCase.findFirst({ where });
    if (!case_) return null;
    // Mask internal error details for non-admin users
    if (opts.userId) {
      case_.title = 'Error procesando tu solicitud';
      case_.user_description = 'Nuestro equipo está revisando este incidente.';
    }
    return case_;
  }

  async updateCaseStatus(
    id: string,
    status: string,
    actor: { workspaceId: string; isPlatformAdmin: boolean },
  ) {
    // RBAC: a workspace-scoped admin can only update cases that belong
    // to their own workspace. Platform admins can act cross-workspace.
    const existing = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id },
      select: { id: true, workspace_id: true },
    });
    if (!existing) throw new NotFoundException('Diagnostic case not found');
    if (!actor.isPlatformAdmin && existing.workspace_id !== actor.workspaceId) {
      throw new ForbiddenException('Diagnostic case belongs to another workspace');
    }

    const updated = await this.prisma.supportDiagnosticCase.update({
      where: { id },
      data: { status },
    });

    // Phase 2: when a case flips to RESOLVED, fire-and-forget the
    // user notification (in-app + email when channel exists).
    // Errors inside notifyResolution are caught internally so they
    // never roll back the status update.
    if (status === 'RESOLVED') {
      this.supportNotifications.notifyResolution(id).catch((err: unknown) => {
        this.logger.warn(
          `notifyResolution failed for diagnostic case ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

      // Phase 4: feed the knowledge-base. The service decides
      // whether the case is worth promoting (needs error_code +
      // resolution body ≥ 50 chars) and whether to refresh an
      // existing entry vs create a new auto-learned one.
      this.knowledgeBase.learnFromCase(id).catch((err: unknown) => {
        this.logger.warn(
          `learnFromCase failed for diagnostic case ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return updated;
  }

  async diagnose(input: DiagnosticInput): Promise<DiagnosticResult> {
    let evidence: Record<string, unknown> = {};

    // If an error_report_id was provided, fetch the actual error report for context
    if (input.error_report_id) {
      const errorReport = await this.prisma.errorReport.findUnique({
        where: { id: input.error_report_id },
        select: { message: true, route: true, status_code: true, source: true, category: true, stack: true },
      });
      if (errorReport) {
        evidence.error_report = errorReport;
        input.module = input.module || MODULE_MAP[errorReport.route] || 'unknown';
        input.error_code = input.error_code || `${errorReport.source}_${errorReport.status_code}`;
        input.user_description = input.user_description || errorReport.message?.slice(0, 200);
      }
    }

    // Classify the issue
    const classification = this.classify(input, evidence);

    // Look up known issues by error_code
    let matchedIssue: import('@prisma/client').SupportKnownIssue | null = null;
    if (input.error_code) {
      matchedIssue = await this.prisma.supportKnownIssue.findUnique({
        where: { error_code: input.error_code },
      });
    }

    // Fallback: search by module + severity if no exact match.
    // IMPORTANT: ONLY use this for real diagnostic cases (not USER_GUIDANCE).
    // A module-based fallback known issue without a matching error_code
    // is MISLEADING — it shows the user a "known problem" that may have
    // nothing to do with their actual situation (e.g. showing WhatsApp
    // webhook issue when they clicked "Diagnosticar" on Inbox).
    let moduleFallbackIssue: import('@prisma/client').SupportKnownIssue | null = null;
    if (!matchedIssue && input.module && classification.category !== 'USER_GUIDANCE') {
      const candidates = await this.prisma.supportKnownIssue.findMany({
        where: { module: input.module, is_active: true },
        orderBy: { severity: 'asc' },
        take: 3,
      });
      if (candidates.length > 0) {
        moduleFallbackIssue = candidates[0];
      }
    }
    // Only show matched known issue when it's an exact error_code match,
    // OR when it's a real case (not USER_GUIDANCE) with a module match.
    const effectiveMatchedIssue = matchedIssue || moduleFallbackIssue;

    // Don't persist USER_GUIDANCE cases — they're just noise, not real issues.
    // EXCEPT billing: always create a case for billing events (mission critical).
    if (classification.category === 'USER_GUIDANCE' && input.module !== 'billing') {
      this.logger.log(`Skipping USER_GUIDANCE case for ${input.module}: ${classification.title}`);

      // Try AI-powered contextual analysis for the module
      let aiAnalysis: { explanation: string; guidance: string } | null = null;
      if (input.workspaceId && input.module) {
        try {
          const healthData = await this.collectModuleHealthData(input.workspaceId, input.module);
          const aiResult = await this.triage.analyzeModuleHealth(
            input.workspaceId,
            input.module,
            healthData,
          );
          if (aiResult && aiResult.confidence !== 'LOW') {
            aiAnalysis = {
              explanation: aiResult.explanation,
              guidance: aiResult.guidance,
            };
          }
        } catch {
          // AI analysis failed — fall through to default USER_GUIDANCE
        }
      }

      const recommendation = aiAnalysis?.guidance
        ? `${classification.recommendation}\n\n${aiAnalysis.guidance}`
        : classification.recommendation;

      return {
        case_id: aiAnalysis ? 'ai_analyzed' : 'skipped',
        category: classification.category,
        risk_level: classification.risk_level,
        title: aiAnalysis?.explanation || classification.title,
        recommendation,
        matched_known_issue: undefined,
      };
    }

    // Create the diagnostic case for real issues
    const caseRecord = await this.prisma.supportDiagnosticCase.create({
      data: {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        module: input.module,
        error_code: input.error_code,
        trace_id: input.trace_id,
        category: classification.category,
        risk_level: classification.risk_level,
        status: effectiveMatchedIssue ? 'INVESTIGATING' : 'OPEN',
        title: classification.title,
        user_description: input.user_description,
        safe_summary: classification.recommendation,
        evidence_json: evidence as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Diagnostic case created: ${caseRecord.id} (${classification.category} / ${classification.risk_level})`);

    this.notifyAdmins(input.workspaceId, caseRecord.id, classification).catch((err: unknown) =>
      this.logger.error(`Failed to notify admins of diagnostic case: ${err instanceof Error ? err.message : String(err)}`),
    );

    // Proactive resolution: if a known issue matched, auto-create a fix case.
    // Internal/system-triggered call: actor is the case's own workspace
    // (the diagnostic case lives there), and we mark isPlatformAdmin=true
    // so the assert passes regardless — this isn't user-initiated.
    if (effectiveMatchedIssue) {
      this.fixService
        .createFixCase(caseRecord.id, {
          workspaceId: input.workspaceId,
          isPlatformAdmin: true,
        })
        .catch((err: unknown) =>
          this.logger.error(`Failed to auto-create fix case for ${caseRecord.id}: ${err instanceof Error ? err.message : String(err)}`),
        );
    }

    return {
      case_id: caseRecord.id,
      category: classification.category,
      risk_level: classification.risk_level,
      title: classification.title,
      recommendation: classification.recommendation,
      matched_known_issue: effectiveMatchedIssue ? {
        error_code: effectiveMatchedIssue.error_code,
        title: effectiveMatchedIssue.title,
        workaround: effectiveMatchedIssue.workaround,
        fix_status: effectiveMatchedIssue.fix_status,
      } : undefined,
    };
  }

  private classify(input: DiagnosticInput, evidence: Record<string, unknown>): { category: string; risk_level: string; title: string; recommendation: string } {
    const msg = (input.user_description || '').toLowerCase() + ' ' + JSON.stringify(evidence).toLowerCase();

    if (msg.includes('circular') || msg.includes('undefined import') || msg.includes('cannot create')) {
      return this.result('PRODUCT_BUG', 'critical', 'Circular dependency detected', 'Add forwardRef() to the module at the reported index. Check deployment logs.');
    }
    if (msg.includes('paddle') || msg.includes('webhook') || msg.includes('subscription') || msg.includes('billing') || msg.includes('plan chang')) {
      return this.result('BILLING_OR_PLAN', 'high', 'Billing or subscription issue', 'Check PADDLE_WEBHOOK_SECRET, PADDLE_API_KEY, and env vars on Railway. Verify webhook URL in Paddle dashboard.');
    }
    if (msg.includes('whatsapp') || msg.includes('meta api') || msg.includes('access_token') || msg.includes('business account')) {
      return this.result('WORKSPACE_CONFIGURATION', 'high', 'WhatsApp channel configuration issue', 'Verify access token, phone number ID, and WABA ID in channel settings. Check Meta Developer dashboard.');
    }
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('plan limit') || msg.includes('quota')) {
      return this.result('PERMISSION_ISSUE', 'medium', 'Access denied or plan limit reached', 'Check workspace plan (Ajustes → Facturación). Upgrade if limits are exceeded.');
    }
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('token expired')) {
      return this.result('PERMISSION_ISSUE', 'medium', 'Authentication issue', 'Re-login. If persistent, check JWT_SECRET on Railway.');
    }
    if (msg.includes('hacienda') || msg.includes('cabys') || msg.includes('firma digital')) {
      return this.result('PRODUCT_BUG', 'high', 'Hacienda integration issue', 'Check Hacienda configuration and signing certificate.');
    }
    if (msg.includes('resend') || msg.includes('smtp') || msg.includes('email') && msg.includes('fail')) {
      return this.result('WORKSPACE_CONFIGURATION', 'high', 'Email delivery issue', 'Verify RESEND_API_KEY, SMTP settings in channel configuration.');
    }
    if (msg.includes('500') || msg.includes('internal server error') || msg.includes('typeerror') || msg.includes('cannot read propert')) {
      return this.result('PLATFORM_INCIDENT', 'high', 'Server error or crash detected', 'Check Railway logs for full stack trace. This needs investigation.');
    }
    if (msg.includes('foreign key') || msg.includes('constraint') || msg.includes('p2022') || msg.includes('p2003') || msg.includes('productid') || msg.includes('column') && msg.includes('does not exist')) {
      return this.result('PRODUCT_BUG', 'high', 'Database schema mismatch', 'A Prisma schema or migration issue. Check latest migrations on Railway.');
    }
    if (msg.includes('balance') || msg.includes('saldo') || msg.includes('payment') && msg.includes('fail')) {
      return this.result('BILLING_OR_PLAN', 'medium', 'Payment or balance issue', 'Check invoice and payment records. Verify payment gateway configuration.');
    }
    if (msg.includes('stock') || msg.includes('inventar') || (msg.includes('product') && msg.includes('not found'))) {
      return this.result('WORKSPACE_CONFIGURATION', 'medium', 'Inventory or product issue', 'Check product catalog and inventory settings.');
    }
    if (msg.includes('cannot read') || msg.includes('undefined') || msg.includes('null')) {
      return this.result('PRODUCT_BUG', 'medium', 'Runtime error — undefined value', 'A null/undefined value caused a crash. Check Railway logs for the exact line.');
    }

    return this.result('USER_GUIDANCE', 'low', 'User guidance needed', 'This may be a configuration or usage question. Check the documentation or contact support@pymeshub.lat.');
  }

  private result(category: string, risk_level: string, title: string, recommendation: string) {
    return { category, risk_level, title, recommendation };
  }

  /**
   * Collect real workspace data for a module to give AI contextual analysis.
   */
  private async collectModuleHealthData(workspaceId: string, module: string): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = { module, timestamp: new Date().toISOString() };

    try {
      if (module === 'inbox' || module === 'conversations') {
        // Active channels
        const channels = await this.prisma.channel.findMany({
          where: { workspace_id: workspaceId },
          select: { type: true, status: true },
        });
        data.active_channels = channels.filter((c) => c.status === 'ACTIVE').length;
        data.total_channels = channels.length;
        data.channel_types = [...new Set(channels.map((c) => c.type))];

        // Recent conversations (last 24h)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentConvs = await this.prisma.conversation.count({
          where: { workspace_id: workspaceId, created_at: { gte: dayAgo } },
        });
        data.conversations_24h = recentConvs;

        // Unassigned conversations
        const unassigned = await this.prisma.conversation.count({
          where: { workspace_id: workspaceId, assigned_user_id: null, status: { not: 'RESOLVED' } },
        });
        data.unassigned_conversations = unassigned;

        // Recent errors
        const recentErrors = await this.prisma.errorReport.count({
          where: { workspace_id: workspaceId, created_at: { gte: dayAgo } },
        });
        data.recent_errors_24h = recentErrors;

        // Messages (last hour)
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentMessages = await this.prisma.message.count({
          where: { conversation: { workspace_id: workspaceId }, created_at: { gte: hourAgo } },
        });
        data.messages_last_hour = recentMessages;
      } else if (module === 'channels') {
        const channels = await this.prisma.channel.findMany({
          where: { workspace_id: workspaceId },
          select: { type: true, status: true, created_at: true },
        });
        data.total = channels.length;
        data.active = channels.filter((c) => c.status === 'ACTIVE').length;
        data.pending_setup = channels.filter((c) => c.status === 'PENDING_SETUP').length;
        data.error = channels.filter((c) => c.status === 'ERROR').length;
        data.types = [...new Set(channels.map((c) => c.type))];
      } else if (module === 'dashboard') {
        const convCount = await this.prisma.conversation.count({
          where: { workspace_id: workspaceId },
        });
        const contactCount = await this.prisma.contact.count({
          where: { workspace_id: workspaceId },
        });
        const taskCount = await this.prisma.task.count({
          where: { workspace_id: workspaceId, status: { not: 'DONE' } },
        });
        data.conversations = convCount;
        data.contacts = contactCount;
        data.open_tasks = taskCount;
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to collect health data for ${module}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return data;
  }

  private async notifyAdmins(workspaceId: string, caseId: string, classification: { category: string; risk_level: string; title: string }) {
    const admins = await this.prisma.workspaceUser.findMany({
      where: { workspace_id: workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { user_id: true },
    });

    for (const admin of admins) {
      try {
        await this.notifications.create(workspaceId, {
          user_id: admin.user_id,
          type: 'diagnostic_case',
          title: `Nuevo caso: ${classification.title}`,
          body: `Categoría: ${classification.category} | Riesgo: ${classification.risk_level}`,
          related_entity_type: 'support_diagnostic_case',
          related_entity_id: caseId,
        });
      } catch (err: unknown) {
        this.logger.error(`Notification to ${admin.user_id} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
