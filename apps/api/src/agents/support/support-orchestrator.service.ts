/**
 * SupportOrchestratorService
 *
 * Drives the multi-agent support pipeline:
 *   triage → (route) → diagnostic → fix-proposal → security → pr-review
 * with a human-handoff terminal for sensitive cases.
 *
 * The orchestrator only SEQUENCES agents and records an audit trail. It never
 * performs a privileged action itself — PR creation happens inside an agent's
 * Flowise flow via the create_github_pr tool, which is independently gated by
 * PrCreationPolicyService. Stages the tier may not use are skipped.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FlowiseClient } from "../flowise/flowise.client";
import { FlowiseSetupService, PLAN_TO_TIER } from "../flowise-setup.service";
import { AgentGuardrailsService } from "../runtime/agent-guardrails.service";
import { getSupportAgent } from "./support-agents.catalog";
import { buildPipeline } from "./support-pipeline";
import type {
  DiagnosticOutput,
  SupportAgentSlug,
  SupportCaseType,
  SupportSeverity,
  SupportTier,
} from "./support-agent.types";

export interface OrchestrateInput {
  workspace_id: string;
  message: string;
  diagnostic_case_id?: string;
  /** Tier 3 opt-in for the fix→PR branch. */
  allow_pr_creation?: boolean;
}

interface StageRecord {
  agent_slug: SupportAgentSlug;
  allowed: boolean;
  skipped_reason?: string;
  output_preview?: string;
  structured?: unknown;
  duration_ms?: number;
  error?: string;
}

export interface OrchestrateResult {
  run_id: string;
  tier: SupportTier;
  case_type?: SupportCaseType;
  severity?: SupportSeverity;
  status: "COMPLETED" | "NEEDS_HUMAN" | "FAILED";
  needs_human_review: boolean;
  stages: StageRecord[];
  summary: string;
}

const MAX_PREVIEW = 2000;

@Injectable()
export class SupportOrchestratorService {
  private readonly logger = new Logger(SupportOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
    private readonly flowiseSetup: FlowiseSetupService,
    private readonly guardrails: AgentGuardrailsService,
  ) {}

  async orchestrate(input: OrchestrateInput): Promise<OrchestrateResult> {
    const tier = await this.resolveTier(input.workspace_id);
    const sessionId = randomUUID();
    const stages: StageRecord[] = [];

    // Persist a RUNNING row up front so partial runs are still auditable.
    const run = await this.prisma.supportOrchestrationRun.create({
      data: {
        workspace_id: input.workspace_id,
        diagnostic_case_id: input.diagnostic_case_id ?? null,
        tier,
        status: "RUNNING",
        stages_json: [],
      },
      select: { id: true },
    });

    let caseType: SupportCaseType | undefined;
    let severity: SupportSeverity | undefined;
    let needsHuman = false;

    try {
      // ── Stage 0: triage (all tiers) ──
      const triageCtx = `Mensaje del usuario:\n${input.message}`;
      const triage = await this.runStage("intake-triage", tier, triageCtx, sessionId, stages);
      const triageOut = this.parseDiagnostic(triage?.structured);
      caseType = triageOut?.case_type ?? "unknown";
      severity = triageOut?.severity ?? "medium";
      if (triageOut?.needs_human_review) needsHuman = true;

      // ── Routed pipeline ──
      const pipeline = buildPipeline({
        tier,
        caseType,
        severity,
        allowPrOverride: input.allow_pr_creation,
      });

      let carriedContext = `${triageCtx}\n\nClasificación triage: ${JSON.stringify(triageOut ?? {})}`;
      let securityPassed = false;

      for (const slug of pipeline) {
        // Hard gate: never run the PR-review stage unless a prior security
        // stage explicitly passed.
        if (slug === "pr-review" && !securityPassed) {
          stages.push({
            agent_slug: slug,
            allowed: false,
            skipped_reason: "security-compliance no aprobó; PR no se revisa",
          });
          needsHuman = true;
          continue;
        }

        const stage = await this.runStage(slug, tier, carriedContext, sessionId, stages);
        if (!stage) continue;

        // Track security signoff for downstream gating.
        if (slug === "security-compliance") {
          securityPassed = this.securityApproved(stage.output_preview ?? "");
          if (!securityPassed) needsHuman = true;
        }

        const diag = this.parseDiagnostic(stage.structured);
        if (diag?.needs_human_review) needsHuman = true;

        // Carry a compact summary of this stage into the next one.
        carriedContext += `\n\n[${slug}] ${stage.output_preview ?? ""}`.slice(0, 8000);
      }

      const status = needsHuman ? "NEEDS_HUMAN" : "COMPLETED";
      const summary = this.buildSummary(tier, caseType, severity, stages, needsHuman);

      await this.prisma.supportOrchestrationRun.update({
        where: { id: run.id },
        data: {
          status,
          case_type: caseType,
          severity,
          needs_human_review: needsHuman,
          stages_json: stages as unknown as Prisma.InputJsonValue,
          summary,
        },
      });

      return {
        run_id: run.id,
        tier,
        case_type: caseType,
        severity,
        status,
        needs_human_review: needsHuman,
        stages,
        summary,
      };
    } catch (err: any) {
      this.logger.error(`[orchestrator] run ${run.id} failed: ${err?.message}`);
      await this.prisma.supportOrchestrationRun
        .update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            case_type: caseType,
            severity,
            needs_human_review: true,
            stages_json: stages as unknown as Prisma.InputJsonValue,
            summary: `Fallo de orquestación: ${err?.message ?? "desconocido"}`,
          },
        })
        .catch(() => undefined);
      return {
        run_id: run.id,
        tier,
        case_type: caseType,
        severity,
        status: "FAILED",
        needs_human_review: true,
        stages,
        summary: `La orquestación falló: ${err?.message ?? "error desconocido"}. Escalado a revisión humana.`,
      };
    }
  }

  /** List recent orchestration runs for a workspace (audit view). */
  listRuns(workspaceId: string, limit = 20) {
    return this.prisma.supportOrchestrationRun.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
      take: Math.min(limit, 100),
      select: {
        id: true,
        tier: true,
        status: true,
        case_type: true,
        severity: true,
        needs_human_review: true,
        summary: true,
        created_at: true,
      },
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async resolveTier(workspaceId: string): Promise<SupportTier> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    return (PLAN_TO_TIER[ws?.plan ?? "FREE"] ?? "TIER_1") as SupportTier;
  }

  /**
   * Run a single agent stage: resolve its Flowise flow, predict, sanitize and
   * record. Non-fatal — a failed stage is recorded and the pipeline continues.
   */
  private async runStage(
    slug: SupportAgentSlug,
    tier: SupportTier,
    context: string,
    sessionId: string,
    stages: StageRecord[],
  ): Promise<StageRecord | null> {
    const def = getSupportAgent(slug);
    if (!def || !def.tierAccess.includes(tier)) {
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: false,
        skipped_reason: `Tier ${tier} no puede usar ${slug}`,
      };
      stages.push(rec);
      return null;
    }

    const chatflowId = await this.flowiseSetup.getChatflowIdForAgent(slug);
    if (!chatflowId || !this.flowise.isEnabled) {
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: true,
        skipped_reason: chatflowId ? "Flowise deshabilitado" : "Flow no provisionado",
      };
      stages.push(rec);
      return null;
    }

    const started = Date.now();
    try {
      const safeContext = this.guardrails.sanitizeInputBeforeModel(context, 12000);
      const res = await this.flowise.predict(chatflowId, {
        question: safeContext,
        sessionId: `${sessionId}:${slug}`,
      });
      const safeText = this.guardrails.sanitizeOutputAfterModel(res.text ?? "", MAX_PREVIEW);
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: true,
        output_preview: safeText,
        structured: this.tryParseJson(res.text ?? ""),
        duration_ms: Date.now() - started,
      };
      stages.push(rec);
      return rec;
    } catch (err: any) {
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: true,
        error: err?.message ?? "error",
        duration_ms: Date.now() - started,
      };
      stages.push(rec);
      this.logger.warn(`[orchestrator] stage ${slug} error: ${err?.message}`);
      return rec;
    }
  }

  private tryParseJson(text: string): unknown {
    // Agents are asked to return JSON; tolerate fenced code blocks / prose.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]);
    } catch {
      return undefined;
    }
  }

  private parseDiagnostic(structured: unknown): DiagnosticOutput | undefined {
    if (!structured || typeof structured !== "object") return undefined;
    const o = structured as Record<string, unknown>;
    if (!("case_type" in o) && !("severity" in o)) return undefined;
    return o as unknown as DiagnosticOutput;
  }

  private securityApproved(text: string): boolean {
    // Conservative: only treat as approved on an explicit positive signal,
    // and never if a block/critical signal is present.
    const t = text.toLowerCase();
    if (/(bloque|block|riesgo cr[ií]tico|critical risk|denegad|denied)/.test(t)) return false;
    return /(aprobad|approved|sin riesgos|no risks|ok para|safe to proceed)/.test(t);
  }

  private buildSummary(
    tier: SupportTier,
    caseType: SupportCaseType | undefined,
    severity: SupportSeverity | undefined,
    stages: StageRecord[],
    needsHuman: boolean,
  ): string {
    const ran = stages.filter((s) => s.allowed && !s.skipped_reason && !s.error).map((s) => s.agent_slug);
    const skipped = stages.filter((s) => s.skipped_reason).map((s) => s.agent_slug);
    const parts = [
      `Tier ${tier} · caso ${caseType ?? "?"} · severidad ${severity ?? "?"}.`,
      ran.length ? `Agentes ejecutados: ${ran.join(" → ")}.` : "No se ejecutó ningún agente.",
    ];
    if (skipped.length) parts.push(`Omitidos: ${skipped.join(", ")}.`);
    parts.push(
      needsHuman
        ? "Requiere revisión humana antes de cualquier acción."
        : "Pipeline completado sin acciones sensibles pendientes.",
    );
    return parts.join(" ");
  }
}
