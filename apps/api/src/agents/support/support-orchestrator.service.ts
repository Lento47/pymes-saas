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
import { Injectable, Logger, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FlowiseClient } from "../flowise/flowise.client";
import { FlowiseSetupService, PLAN_TO_TIER } from "../flowise-setup.service";
import { AgentGuardrailsService } from "../runtime/agent-guardrails.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { CreditsService } from "../../memory/credits.service";
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
  /** User who triggered the run — receives escalation notification. */
  triggered_by_user_id?: string;
}

export interface StageRecord {
  agent_slug: SupportAgentSlug;
  allowed: boolean;
  skipped_reason?: string;
  output_preview?: string;
  structured?: unknown;
  duration_ms?: number;
  error?: string;
  /** Estimated credit cost for this stage, based on input/output size. */
  cost_credits?: number;
  /** Characters of input context sent to the stage. */
  input_chars?: number;
  /** Characters of output received from the stage. */
  output_chars?: number;
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
  /** Total estimated credit cost for this case. */
  total_cost_credits?: number;
}

const MAX_PREVIEW = 8000;

@Injectable()
export class SupportOrchestratorService {
  private readonly logger = new Logger(SupportOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
    private readonly flowiseSetup: FlowiseSetupService,
    private readonly guardrails: AgentGuardrailsService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly events?: EventsGateway,
    @Optional() private readonly credits?: CreditsService,
  ) {}

  /** Cost model: estimate credits from LLM usage per stage. */
  private estimateStageCredits(inputChars: number, outputChars: number): number {
    // Approximation: 3 chars ≈ 1 token for Spanish mixed with code/JSON
    const inputTokens = Math.ceil(inputChars / 3);
    const outputTokens = Math.ceil(outputChars / 3);
    // DeepSeek pricing: ~$0.14/1M input, ~$0.28/1M output
    const costUSD = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;
    // 1 credit ≈ $0.001
    return Math.round(costUSD * 1000 * 100) / 100;
  }

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

    // Notify connected clients that a pipeline started.
    this.events?.emitOrchestrationProgress(input.workspace_id, {
      event: "orchestration:started",
      run_id: run.id,
      diagnostic_case_id: input.diagnostic_case_id,
      tier,
    });

    try {
      // Pre-fetch workspace context so stage flows don't need Flowise Tool nodes.
      const wsCtx = await this.fetchWorkspaceContext(input.workspace_id, tier);

      // ── Stage 0: triage (all tiers) ──
      const triageCtx = `${wsCtx}\n\nMensaje del usuario:\n${input.message}`;
      const triage = await this.runStage("intake-triage", tier, triageCtx, sessionId, stages, input.workspace_id, run.id);
      const triageOut = this.parseDiagnostic(triage?.structured);
      caseType = triageOut?.case_type ?? "unknown";
      severity = triageOut?.severity ?? "medium";
      if (triageOut?.needs_human_review) needsHuman = true;

      // If triage needs clarification from the user, stop here and return questions
      if (triageOut?.clarification_needed && triageOut?.questions?.length) {
        const summary = triageOut.summary || "Se necesita más información para diagnosticar el problema.";
        const clarificationResult: OrchestrateResult = {
          run_id: run.id,
          tier,
          case_type: caseType,
          severity,
          status: "NEEDS_CLARIFICATION" as any,
          needs_human_review: false,
          stages,
          summary,
          total_cost_credits: stages.reduce((sum, s) => sum + (s.cost_credits ?? 0), 0),
        };

        await this.prisma.supportOrchestrationRun.update({
          where: { id: run.id },
          data: {
            status: "NEEDS_CLARIFICATION",
            case_type: caseType,
            severity,
            stages_json: stages as unknown as Prisma.InputJsonValue,
            summary,
            clarification_questions: triageOut.questions as unknown as Prisma.InputJsonValue,
          },
        });

        // Store the questions in the run for the follow-up to use
        (clarificationResult as any).questions = triageOut.questions;

        this.events?.emitOrchestrationProgress(input.workspace_id, {
          event: "orchestration:done",
          run_id: run.id,
          diagnostic_case_id: input.diagnostic_case_id,
          tier,
          result: clarificationResult,
        });

        return clarificationResult;
      }

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

        const stage = await this.runStage(slug, tier, carriedContext, sessionId, stages, input.workspace_id, run.id);
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

      if (needsHuman) {
        this.notifyHumanEscalation(
          input.workspace_id,
          run.id,
          summary,
          input.triggered_by_user_id,
        ).catch((err) =>
          this.logger.error(`[orchestrator] escalation notification failed: ${err?.message}`)
        );
      }

      const totalCost = stages.reduce((sum, s) => sum + (s.cost_credits ?? 0), 0);

      const result: OrchestrateResult = {
        run_id: run.id,
        tier,
        case_type: caseType,
        severity,
        status,
        needs_human_review: needsHuman,
        stages,
        summary,
        total_cost_credits: totalCost,
      };

      this.events?.emitOrchestrationProgress(input.workspace_id, {
        event: "orchestration:done",
        run_id: run.id,
        diagnostic_case_id: input.diagnostic_case_id,
        tier,
        result,
      });

      // Deduct credits for the support case (non-fatal)
      this.deductCreditsForCase(input.workspace_id, run.id, caseType ?? "unknown", totalCost).catch((err) =>
        this.logger.error(`[orchestrator] credit deduction failed: ${err?.message}`)
      );

      return result;
    } catch (err: any) {
      this.logger.error(`[orchestrator] run ${run.id} failed: ${err?.message}`);
      const failedResult: OrchestrateResult = {
        run_id: run.id,
        tier,
        case_type: caseType,
        severity,
        status: "FAILED",
        needs_human_review: true,
        stages,
        summary: `La orquestación falló: ${err?.message ?? "error desconocido"}. Escalado a revisión humana.`,
      };
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

      this.events?.emitOrchestrationProgress(input.workspace_id, {
        event: "orchestration:done",
        run_id: run.id,
        diagnostic_case_id: input.diagnostic_case_id,
        tier,
        result: failedResult,
      });

      return failedResult;
    }
  }

  /** Continue a run that was paused waiting for user clarification. */
  async continueWithClarification(
    workspaceId: string,
    runId: string,
    userAnswer: string,
  ): Promise<OrchestrateResult> {
    const run = await this.prisma.supportOrchestrationRun.findFirst({
      where: { id: runId, workspace_id: workspaceId, status: "NEEDS_CLARIFICATION" },
    });
    if (!run) throw new Error("No se encontró un caso pendiente de clarificación con ese ID.");

    const tier = (run.tier as SupportTier) ?? "TIER_1";
    const sessionId = randomUUID();
    const stages: StageRecord[] = (run.stages_json as StageRecord[]) ?? [];
    const caseType = (run.case_type as SupportCaseType) ?? "unknown";
    const severity = (run.severity as SupportSeverity) ?? "medium";

    let needsHuman = false;
    let securityPassed = false;

    try {
      const wsCtx = await this.fetchWorkspaceContext(workspaceId, tier);

      // Build context with the original triage + user's answer
      const clarificationCtx = `${wsCtx}\n\n[RESPUESTA DEL USUARIO A LAS PREGUNTAS DE CLARIFICACIÓN]\n${userAnswer}\n\n[Clasificación previa: ${caseType}, severidad: ${severity}]`;

      // ── Routed pipeline (skip triage, start from diagnostic) ──
      const pipeline = buildPipeline({
        tier,
        caseType,
        severity,
        allowPrOverride: false,
      });

      // Skip triage since it already ran
      const filteredPipeline = pipeline.filter(s => s !== "intake-triage");

      let carriedContext = clarificationCtx;

      for (const slug of filteredPipeline) {
        if (slug === "pr-review" && !securityPassed) {
          stages.push({
            agent_slug: slug,
            allowed: false,
            skipped_reason: "security-compliance no aprobó; PR no se revisa",
          });
          needsHuman = true;
          continue;
        }

        const stage = await this.runStage(slug, tier, carriedContext, sessionId, stages, workspaceId, runId);
        if (!stage) continue;

        if (slug === "security-compliance") {
          securityPassed = this.securityApproved(stage.output_preview ?? "");
          if (!securityPassed) needsHuman = true;
        }

        const diag = this.parseDiagnostic(stage.structured);
        if (diag?.needs_human_review) needsHuman = true;

        carriedContext += `\n\n[${slug}] ${stage.output_preview ?? ""}`.slice(0, 8000);
      }

      const status = needsHuman ? "NEEDS_HUMAN" : "COMPLETED";
      const summary = this.buildSummary(tier, caseType, severity, stages, needsHuman);

      await this.prisma.supportOrchestrationRun.update({
        where: { id: runId },
        data: {
          status,
          needs_human_review: needsHuman,
          stages_json: stages as unknown as Prisma.InputJsonValue,
          summary,
        },
      });

      if (needsHuman) {
        this.notifyHumanEscalation(workspaceId, runId, summary).catch((err) =>
          this.logger.error(`[orchestrator] escalation notification failed: ${err?.message}`)
        );
      }

      const totalCost = stages.reduce((sum, s) => sum + (s.cost_credits ?? 0), 0);

      const result: OrchestrateResult = {
        run_id: runId,
        tier,
        case_type: caseType,
        severity,
        status,
        needs_human_review: needsHuman,
        stages,
        summary,
        total_cost_credits: totalCost,
      };

      this.events?.emitOrchestrationProgress(workspaceId, {
        event: "orchestration:done",
        run_id: runId,
        tier,
        result,
      });

      this.deductCreditsForCase(workspaceId, runId, caseType, totalCost).catch((err) =>
        this.logger.error(`[orchestrator] credit deduction failed: ${err?.message}`)
      );

      return result;
    } catch (err: any) {
      this.logger.error(`[orchestrator] continue run ${runId} failed: ${err?.message}`);
      const failedResult: OrchestrateResult = {
        run_id: runId,
        tier,
        case_type: caseType,
        severity,
        status: "FAILED",
        needs_human_review: true,
        stages,
        summary: `La orquestación falló al continuar: ${err?.message ?? "error desconocido"}.`,
      };
      await this.prisma.supportOrchestrationRun.update({
        where: { id: runId },
        data: { status: "FAILED", summary: failedResult.summary },
      }).catch(() => undefined);
      return failedResult;
    }
  }

  /** List recent orchestration runs for a workspace (user-facing history). */
  async listRuns(workspaceId: string, limit = 20) {
    // Auto-close stale cases before returning the list
    await this.autoCloseStaleRuns(workspaceId);

    const runs = await this.prisma.supportOrchestrationRun.findMany({
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
        stages_json: true,
        created_at: true,
        updated_at: true,
      },
    });

    return runs.map((r) => ({
      ...r,
      total_cost_credits: this.sumStagesCost(r.stages_json),
    }));
  }

  /** Get a single run detail with full stage data. */
  async getRun(workspaceId: string, runId: string) {
    const run = await this.prisma.supportOrchestrationRun.findFirst({
      where: { id: runId, workspace_id: workspaceId },
    });
    if (!run) return null;

    const stages = run.stages_json as unknown as StageRecord[];
    const totalCost = stages.reduce((sum, s) => sum + (s.cost_credits ?? 0), 0);

    return {
      run_id: run.id,
      tier: run.tier,
      case_type: run.case_type ?? undefined,
      severity: run.severity ?? undefined,
      status: run.status,
      needs_human_review: run.needs_human_review,
      stages,
      summary: run.summary ?? "",
      total_cost_credits: totalCost,
      created_at: run.created_at,
      updated_at: run.updated_at,
    };
  }

  /** Auto-close runs that are > 1 hour stale with no follow-up. */
  async autoCloseStaleRuns(workspaceId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await this.prisma.supportOrchestrationRun.updateMany({
      where: {
        workspace_id: workspaceId,
        status: { in: ["RUNNING", "NEEDS_HUMAN"] },
        updated_at: { lt: oneHourAgo },
      },
      data: {
        status: "CLOSED",
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `Auto-closed ${result.count} stale support run(s) for workspace ${workspaceId} (no follow-up in 1h)`,
      );
    }
    return result.count;
  }

  private sumStagesCost(stagesJson: unknown): number {
    if (!Array.isArray(stagesJson)) return 0;
    return stagesJson.reduce((sum, s) => sum + (s?.cost_credits ?? 0), 0);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async fetchWorkspaceContext(workspaceId: string, tier: SupportTier): Promise<string> {
    try {
      const [ws, counts] = await Promise.all([
        this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, name: true, slug: true, plan: true, status: true, locale: true, timezone: true },
        }),
        Promise.all([
          this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
          this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
          this.prisma.task.count({ where: { workspace_id: workspaceId } }),
        ]),
      ]);
      const [contacts, conversations, tasks] = counts;
      return [
        `[Contexto del Workspace]`,
        `ID: ${ws?.id ?? workspaceId}`,
        `Nombre: ${ws?.name ?? "—"}`,
        `Plan: ${ws?.plan ?? "FREE"} | Tier: ${tier}`,
        `Estado: ${ws?.status ?? "—"}`,
        `Zona horaria: ${ws?.timezone ?? "UTC"} | Locale: ${ws?.locale ?? "es"}`,
        `Estadísticas: ${contacts} contactos, ${conversations} conversaciones, ${tasks} tareas`,
      ].join("\n");
    } catch {
      return `[Contexto del Workspace]\nID: ${workspaceId} | Tier: ${tier}`;
    }
  }

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
    workspaceId?: string,
    runId?: string,
  ): Promise<StageRecord | null> {
    const def = getSupportAgent(slug);
    if (!def || !def.tierAccess.includes(tier)) {
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: false,
        skipped_reason: `Tier ${tier} no puede usar ${slug}`,
      };
      stages.push(rec);
      if (workspaceId && runId) {
        this.events?.emitOrchestrationProgress(workspaceId, { event: "orchestration:stage-complete", run_id: runId, stage: rec });
      }
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
      if (workspaceId && runId) {
        this.events?.emitOrchestrationProgress(workspaceId, { event: "orchestration:stage-complete", run_id: runId, stage: rec });
      }
      return null;
    }

    const started = Date.now();
    try {
      const safeContext = this.guardrails.sanitizeInputBeforeModel(context, 12000);
      let activeId = chatflowId;
      let res;
      try {
        res = await this.flowise.predict(activeId, {
          question: safeContext,
          sessionId: `${sessionId}:${slug}`,
        });
      } catch (predictErr: any) {
        if ((predictErr?.message as string | undefined)?.includes("returned 404")) {
          this.logger.warn(`[orchestrator] stale chatflow for ${slug} — reprovisioning`);
          const newId = await this.flowiseSetup.reprovisionSupportAgent(slug);
          if (!newId) throw predictErr;
          activeId = newId;
          res = await this.flowise.predict(activeId, {
            question: safeContext,
            sessionId: `${sessionId}:${slug}`,
          });
        } else {
          throw predictErr;
        }
      }
      const safeText = this.guardrails.sanitizeOutputAfterModel(res.text ?? "", MAX_PREVIEW);
      const inputChars = safeContext.length;
      const outputChars = (res.text ?? "").length;
      const costCredits = this.estimateStageCredits(inputChars, outputChars);
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: true,
        output_preview: safeText,
        structured: this.tryParseJson(res.text ?? ""),
        duration_ms: Date.now() - started,
        input_chars: inputChars,
        output_chars: outputChars,
        cost_credits: costCredits,
      };
      stages.push(rec);
      if (workspaceId && runId) {
        this.events?.emitOrchestrationProgress(workspaceId, { event: "orchestration:stage-complete", run_id: runId, stage: rec });
      }
      return rec;
    } catch (err: any) {
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: true,
        error: err?.message ?? "error",
        duration_ms: Date.now() - started,
      };
      stages.push(rec);
      if (workspaceId && runId) {
        this.events?.emitOrchestrationProgress(workspaceId, { event: "orchestration:stage-complete", run_id: runId, stage: rec });
      }
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
    const ran = stages.filter((s) => s.allowed && !s.skipped_reason && !s.error);
    const errored = stages.filter((s) => s.error);
    const skipped = stages.filter((s) => s.skipped_reason);

    // Extract diagnostic content from stage outputs
    const triageStage = ran.find((s) => s.agent_slug === "intake-triage");
    const diagnosticStage = ran.find((s) => s.agent_slug === "technical-diagnostic");
    const fixStage = ran.find((s) => s.agent_slug === "code-fix-proposal");

    const triageDiag = triageStage?.output_preview
      ? (() => { try { const m = triageStage.output_preview!.match(/\{[^}]*"root_cause"[^}]*\}|\{[^}]*"likely_root_cause"[^}]*\}/); return m ? m[0] : null; } catch { return null; }})()
      : null;

    const rootCauseText = fixStage?.output_preview
      ? (() => { try { const m = fixStage.output_preview!.match(/"root_cause"\s*:\s*"([^"]+)"/); return m?.[1]; } catch { return null; }})()
      : null;

    const parts: string[] = [];

    // Header
    parts.push(`### ${caseType ? (caseType.charAt(0).toUpperCase() + caseType.slice(1)).replace(/_/g, ' ') : 'Soporte'}`);
    parts.push(`**Severidad:** ${severity ?? "—"} · **Tier:** ${tier}`);

    // Diagnosis
    if (triageStage?.output_preview) {
      const preview = triageStage.output_preview.slice(0, 500).trim();
      if (preview && !preview.startsWith("{")) {
        parts.push(`\n**Diagnóstico:** ${preview}`);
      }
    }

    // Root cause
    if (rootCauseText) {
      parts.push(`\n**Causa raíz:** ${rootCauseText}`);
    } else if (diagnosticStage?.output_preview) {
      const diagPreview = diagnosticStage.output_preview.slice(0, 400).trim();
      if (diagPreview && !diagPreview.startsWith("{")) {
        parts.push(`\n**Análisis técnico:** ${diagPreview}`);
      }
    }

    // Pipeline info
    if (ran.length > 0) {
      parts.push(`\n**Agentes:** ${ran.map((s) => s.agent_slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())).join(" → ")}`);
    }
    if (skipped.length > 0) {
      parts.push(`*Omitidos: ${skipped.map((s) => s.agent_slug).join(", ")}*`);
    }
    if (errored.length > 0) {
      parts.push(`*Errores: ${errored.map((s) => `${s.agent_slug}: ${s.error}`).join("; ")}*`);
    }

    // Status
    if (needsHuman) {
      parts.push(`\n⚠️ **Requiere revisión humana** antes de continuar.`);
    }

    return parts.join("\n");
  }

  private async notifyHumanEscalation(
    workspaceId: string,
    runId: string,
    summary: string,
    triggeredByUserId?: string,
  ): Promise<void> {
    const owners = await this.prisma.workspaceUser.findMany({
      where: { workspace_id: workspaceId, role: { in: ["OWNER", "ADMIN"] } },
      select: { user_id: true },
    });

    for (const { user_id } of owners) {
      await this.notifications.create(workspaceId, {
        user_id,
        type: "support_escalation",
        title: "Caso de soporte requiere revisión",
        body: summary.slice(0, 200),
        related_entity_type: "support_run",
        related_entity_id: runId,
      });
    }

    // Also notify the user who triggered the run if they're not already an owner/admin
    if (triggeredByUserId && !owners.some((o) => o.user_id === triggeredByUserId)) {
      await this.notifications.create(workspaceId, {
        user_id: triggeredByUserId,
        type: "support_escalation",
        title: "Caso de soporte requiere revisión",
        body: summary.slice(0, 200),
        related_entity_type: "support_run",
        related_entity_id: runId,
      });
    }
  }

  private async deductCreditsForCase(
    workspaceId: string,
    runId: string,
    caseType: string,
    totalCost: number,
  ): Promise<void> {
    if (!this.credits || totalCost <= 0) return;
    const result = await this.credits.deductCredits(
      workspaceId,
      Math.ceil(totalCost),
      `Soporte ${caseType} — caso #${runId.slice(0, 8)}`,
    );
    if (result.success) {
      this.logger.log(
        `Workspace ${workspaceId}: deducted ${Math.ceil(totalCost)} credits for support case ${runId.slice(0, 8)}. Balance: ${result.newBalance}`,
      );
    } else {
      this.logger.warn(
        `Workspace ${workspaceId}: insufficient credits for support case ${runId.slice(0, 8)} (balance: ${result.newBalance}, needed: ${Math.ceil(totalCost)})`,
      );
    }
  }
}
