/**
 * SupportOrchestratorService
 *
 * Drives the multi-agent support pipeline:
 *   triage → feature router → agent council → consensus → communication
 * with a human-handoff terminal for sensitive cases.
 *
 * The orchestrator only SEQUENCES agents and records an audit trail. It never
 * performs a privileged action itself — PR creation happens inside an agent's
 * Flowise flow via the create_github_pr tool, which is independently gated by
 * PrCreationPolicyService. Agents the profile may not use are skipped.
 */
import { Injectable, Logger, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FlowiseClient } from "../flowise/flowise.client";
import { FlowiseSetupService } from "../flowise-setup.service";
import { AgentGuardrailsService } from "../runtime/agent-guardrails.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { CreditsService } from "../../memory/credits.service";
import {
  getSupportAgent,
  planToProfile,
  profileCanUseAgent,
  getProfilePolicy,
  caseTypeToFeature,
} from "./support-agents.catalog";
import { buildPipelineByFeature } from "./support-pipeline";
import type {
  DiagnosticOutput,
  SupportAgentSlug,
  SupportCaseType,
  SupportFeature,
  SupportProfile,
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
  tier: string; // SupportProfile name (stored in legacy tier column)
  case_type?: SupportCaseType;
  severity?: SupportSeverity;
  status: "COMPLETED" | "NEEDS_HUMAN" | "FAILED" | "NEEDS_CLARIFICATION";
  needs_human_review: boolean;
  stages: StageRecord[];
  summary: string;
  /** Set when status === 'NEEDS_CLARIFICATION' */
  questions?: string[];
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
    const profile = await this.resolveProfile(input.workspace_id);
    const policy = getProfilePolicy(profile);
    const sessionId = randomUUID();
    const stages: StageRecord[] = [];

    // Persist a RUNNING row up front so partial runs are still auditable.
    const run = await this.prisma.supportOrchestrationRun.create({
      data: {
        workspace_id: input.workspace_id,
        diagnostic_case_id: input.diagnostic_case_id ?? null,
        tier: profile, // store profile in tier column (backward compat)
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
      tier: profile,
    });

    try {
      // Pre-fetch workspace and diagnostic case context so stage flows don't
      // depend on Flowise Tool nodes to understand what case is being analyzed.
      const [wsCtx, caseCtx] = await Promise.all([
        this.fetchWorkspaceContext(input.workspace_id, profile),
        this.fetchDiagnosticCaseContext(input.workspace_id, input.diagnostic_case_id),
      ]);

      // Build Flowise $vars for tool execution (API keys, workspace slug)
      const ws = await this.prisma.workspace.findUnique({ where: { id: input.workspace_id }, select: { slug: true } });
      const flowVars = this.flowiseSetup.getPredictionVars(ws?.slug);

      // ── Pre-flight: ensure Flowise tools + agentflows exist ──────────────
      const existingTools = await this.flowise.listTools().catch(() => []);
      if (existingTools.length === 0) {
        this.logger.warn("[orchestrator] Flowise tools missing — running full setup before pipeline");
        await this.flowiseSetup.reprovisionAllFlows();
      }

      // ── Stage 0: triage (all profiles) ──
      const triageCtx = [wsCtx, caseCtx, `Mensaje del usuario:\n${input.message}`]
        .filter(Boolean)
        .join("\n\n");
      const triage = await this.runStage("intake-triage", profile, triageCtx, sessionId, stages, input.workspace_id, run.id, flowVars);
      const triageOut = this.parseDiagnostic(triage?.structured);
      caseType = triageOut?.case_type ?? "unknown";
      severity = triageOut?.severity ?? "medium";
      if (triageOut?.needs_human_review) needsHuman = true;

      // If triage needs clarification from the user, stop here and return questions
      if (triageOut?.clarification_needed && triageOut?.questions?.length) {
        const summary = triageOut.summary || "Se necesita más información para diagnosticar el problema.";
        const clarificationResult: OrchestrateResult = {
          run_id: run.id,
          tier: profile,
          case_type: caseType,
          severity,
          status: "NEEDS_CLARIFICATION",
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
        clarificationResult.questions = triageOut.questions;

        this.events?.emitOrchestrationProgress(input.workspace_id, {
          event: "orchestration:done",
          run_id: run.id,
          diagnostic_case_id: input.diagnostic_case_id,
          tier: profile,
          result: clarificationResult,
        });

        return clarificationResult;
      }

      // ── Routed pipeline (feature-based, council phases) ──
      const feature = caseTypeToFeature(caseType);
      const pipeline = buildPipelineByFeature({
        profile,
        feature,
        needsHuman,
      });

      // Phase separation: council agents run around domain specialists
      const PRE_SPECIALISTS = new Set<SupportAgentSlug>(["evidence-collector", "support-supervisor"]);
      const POST_SPECIALISTS = new Set<SupportAgentSlug>([
        "consensus-arbiter", "user-communication", "human-handoff",
      ]);
      const SECURITY_FIX = new Set<SupportAgentSlug>([
        "code-fix-proposal", "security-compliance", "pr-review",
      ]);

      const preStages = pipeline.filter((s) => PRE_SPECIALISTS.has(s));
      const specialistStages = pipeline.filter(
        (s) => !PRE_SPECIALISTS.has(s) && !POST_SPECIALISTS.has(s) && !SECURITY_FIX.has(s),
      );
      const postStages = pipeline.filter((s) => POST_SPECIALISTS.has(s));
      const secFixStages = pipeline.filter((s) => SECURITY_FIX.has(s));

      let carriedContext = `${triageCtx}\n\nClasificación triage: ${JSON.stringify(triageOut ?? {})}\nFeature: ${feature}`;
      let securityPassed = false;

      // ── Phase 1: Evidence Collection ──
      for (const slug of preStages) {
        const stage = await this.runStage(slug, profile, carriedContext, sessionId, stages, input.workspace_id, run.id, flowVars);
        if (stage?.output_preview) {
          carriedContext += `\n\n[${slug}] ${stage.output_preview}`.slice(0, 8000);
        }
      }

      // ── Phase 2: Domain Specialists (parallel council) ──
      const allFindings: string[] = [];
      if (specialistStages.length > 0) {
        const parallelResults = await this.runParallelStages(
          specialistStages, profile, carriedContext, sessionId,
          stages, input.workspace_id, run.id, flowVars,
        );
        for (const rec of parallelResults) {
          if (rec.output_preview) {
            allFindings.push(`[${rec.agent_slug}]: ${rec.output_preview}`);
          }
          const diag = this.parseDiagnostic(rec.structured);
          if (diag?.needs_human_review) needsHuman = true;
        }
      }

      // ── Phase 3: Consensus / Arbiter ──
      if (postStages.includes("consensus-arbiter") && allFindings.length > 0) {
        const findingsCtx = [carriedContext, `\n[FINDINGS DE LOS AGENTES]`, ...allFindings].join("\n");
        const arbiter = await this.runStage(
          "consensus-arbiter", profile, findingsCtx,
          `${sessionId}:council`, stages, input.workspace_id, run.id, flowVars,
        );
        if (arbiter?.output_preview) {
          carriedContext += `\n\n[consensus-arbiter] ${arbiter.output_preview}`.slice(0, 8000);
        }
        const aDiag = this.parseDiagnostic(arbiter?.structured);
        if (aDiag?.needs_human_review) needsHuman = true;
      } else if (allFindings.length > 0) {
        carriedContext += `\n\n[Specialist Findings]\n${allFindings.join("\n")}`;
      }

      // ── Phase 4: Security + Fix stages (sequential) ──
      for (const slug of secFixStages) {
        if (slug === "pr-review" && !securityPassed) {
          stages.push({ agent_slug: slug, allowed: false, skipped_reason: "security-compliance no aprobó; PR no se revisa" });
          needsHuman = true;
          continue;
        }
        const stage = await this.runStage(slug, profile, carriedContext, sessionId, stages, input.workspace_id, run.id, flowVars);
        if (!stage) continue;
        if (slug === "security-compliance") {
          securityPassed = this.securityApproved(stage.output_preview ?? "");
          if (!securityPassed) needsHuman = true;
        }
        if (stage.output_preview) {
          carriedContext += `\n\n[${slug}] ${stage.output_preview}`.slice(0, 8000);
        }
        const diag = this.parseDiagnostic(stage.structured);
        if (diag?.needs_human_review) needsHuman = true;
      }

      // ── Phase 5: User Communication ──
      if (postStages.includes("user-communication")) {
        const comm = await this.runStage(
          "user-communication", profile, carriedContext,
          `${sessionId}:comm`, stages, input.workspace_id, run.id, flowVars,
        );
        if (comm?.output_preview) {
          carriedContext += `\n\n[user-communication] ${comm.output_preview}`.slice(0, 8000);
        }
      }

      // ── Phase 6: Human Handoff (if needed) ──
      if (needsHuman && postStages.includes("human-handoff")) {
        await this.runStage(
          "human-handoff", profile,
          `${carriedContext}\n\n⚠️ Requiere revisión humana. Prepará resumen ejecutivo.`,
          `${sessionId}:handoff`, stages, input.workspace_id, run.id, flowVars,
        );
      }

      const status = needsHuman ? "NEEDS_HUMAN" : "COMPLETED";
      const summary = this.buildSummary(profile, caseType, severity, stages, needsHuman);

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
        tier: profile,
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
        tier: profile,
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
        tier: profile,
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
        tier: profile,
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

    const profile = (run.tier as SupportProfile) ?? "FREE_GUIDED";
    const sessionId = randomUUID();
    const stages: StageRecord[] = (run.stages_json as unknown as StageRecord[]) ?? [];
    const caseType = (run.case_type as SupportCaseType) ?? "unknown";
    const severity = (run.severity as SupportSeverity) ?? "medium";

    let needsHuman = false;
    let securityPassed = false;

    try {
      const [wsCtx, caseCtx] = await Promise.all([
        this.fetchWorkspaceContext(workspaceId, profile),
        this.fetchDiagnosticCaseContext(workspaceId, run.diagnostic_case_id ?? undefined),
      ]);

      // Build Flowise $vars for tool execution
      const ws2 = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } });
      const flowVars2 = this.flowiseSetup.getPredictionVars(ws2?.slug);

      // Build context with the original triage + user's answer + case context
      const clarificationCtx = [
        wsCtx,
        caseCtx,
        `[RESPUESTA DEL USUARIO A LAS PREGUNTAS DE CLARIFICACIÓN]\n${userAnswer}`,
        `[Clasificación previa: ${caseType}, severidad: ${severity}]`,
      ]
        .filter(Boolean)
        .join("\n\n");

      // ── Routed pipeline (feature-based, skip triage, council phases) ──
      const feature = caseTypeToFeature(caseType);
      const pipeline = buildPipelineByFeature({
        profile,
        feature,
        needsHuman,
      });

      // Skip triage since it already ran
      const filteredPipeline = pipeline.filter(s => s !== "intake-triage");

      // Phase separation (same as main orchestrator)
      const PRE_SPECIALISTS2 = new Set<SupportAgentSlug>(["evidence-collector", "support-supervisor"]);
      const POST_SPECIALISTS2 = new Set<SupportAgentSlug>([
        "consensus-arbiter", "user-communication", "human-handoff",
      ]);
      const SECURITY_FIX2 = new Set<SupportAgentSlug>([
        "code-fix-proposal", "security-compliance", "pr-review",
      ]);

      const preStages2 = filteredPipeline.filter((s) => PRE_SPECIALISTS2.has(s));
      const specialistStages2 = filteredPipeline.filter(
        (s) => !PRE_SPECIALISTS2.has(s) && !POST_SPECIALISTS2.has(s) && !SECURITY_FIX2.has(s),
      );
      const postStages2 = filteredPipeline.filter((s) => POST_SPECIALISTS2.has(s));
      const secFixStages2 = filteredPipeline.filter((s) => SECURITY_FIX2.has(s));

      let carriedContext = clarificationCtx;

      // Phase 1: Evidence + Supervisor
      for (const slug of preStages2) {
        const stage = await this.runStage(slug, profile, carriedContext, sessionId, stages, workspaceId, runId, flowVars2);
        if (stage?.output_preview) {
          carriedContext += `\n\n[${slug}] ${stage.output_preview}`.slice(0, 8000);
        }
      }

      // Phase 2: Domain Specialists (parallel)
      const allFindings2: string[] = [];
      if (specialistStages2.length > 0) {
        const parallelResults = await this.runParallelStages(
          specialistStages2, profile, carriedContext, sessionId,
          stages, workspaceId, runId, flowVars2,
        );
        for (const rec of parallelResults) {
          if (rec.output_preview) {
            allFindings2.push(`[${rec.agent_slug}]: ${rec.output_preview}`);
          }
          const diag = this.parseDiagnostic(rec.structured);
          if (diag?.needs_human_review) needsHuman = true;
        }
      }

      // Phase 3: Consensus / Arbiter
      if (postStages2.includes("consensus-arbiter") && allFindings2.length > 0) {
        const findingsCtx = [carriedContext, `\n[FINDINGS DE LOS AGENTES]`, ...allFindings2].join("\n");
        const arbiter = await this.runStage(
          "consensus-arbiter", profile, findingsCtx,
          `${sessionId}:council`, stages, workspaceId, runId, flowVars2,
        );
        if (arbiter?.output_preview) {
          carriedContext += `\n\n[consensus-arbiter] ${arbiter.output_preview}`.slice(0, 8000);
        }
        const aDiag = this.parseDiagnostic(arbiter?.structured);
        if (aDiag?.needs_human_review) needsHuman = true;
      }

      // Phase 4: Security + Fix
      for (const slug of secFixStages2) {
        if (slug === "pr-review" && !securityPassed) {
          stages.push({ agent_slug: slug, allowed: false, skipped_reason: "security-compliance no aprobó; PR no se revisa" });
          needsHuman = true;
          continue;
        }
        const stage = await this.runStage(slug, profile, carriedContext, sessionId, stages, workspaceId, runId, flowVars2);
        if (!stage) continue;
        if (slug === "security-compliance") {
          securityPassed = this.securityApproved(stage.output_preview ?? "");
          if (!securityPassed) needsHuman = true;
        }
        if (stage.output_preview) {
          carriedContext += `\n\n[${slug}] ${stage.output_preview}`.slice(0, 8000);
        }
        const diag = this.parseDiagnostic(stage.structured);
        if (diag?.needs_human_review) needsHuman = true;
      }

      // Phase 5: User Communication
      if (postStages2.includes("user-communication")) {
        const comm = await this.runStage(
          "user-communication", profile, carriedContext,
          `${sessionId}:comm`, stages, workspaceId, runId, flowVars2,
        );
        if (comm?.output_preview) {
          carriedContext += `\n\n[user-communication] ${comm.output_preview}`.slice(0, 8000);
        }
      }

      // Phase 6: Human Handoff
      if (needsHuman && postStages2.includes("human-handoff")) {
        await this.runStage(
          "human-handoff", profile,
          `${carriedContext}\n\n⚠️ Requiere revisión humana. Prepará resumen ejecutivo.`,
          `${sessionId}:handoff`, stages, workspaceId, runId, flowVars2,
        );
      }

      const status = needsHuman ? "NEEDS_HUMAN" : "COMPLETED";
      const summary = this.buildSummary(profile, caseType, severity, stages, needsHuman);

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
        tier: profile,
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
        tier: profile,
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
        tier: profile,
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

  /** Auto-close runs that are > 3 days stale with no follow-up. */
  async autoCloseStaleRuns(workspaceId: string): Promise<number> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.supportOrchestrationRun.updateMany({
      where: {
        workspace_id: workspaceId,
        status: { in: ["RUNNING", "NEEDS_HUMAN"] },
        updated_at: { lt: threeDaysAgo },
      },
      data: {
        status: "CLOSED",
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `Auto-closed ${result.count} stale support run(s) for workspace ${workspaceId} (no follow-up in 3d)`,
      );
    }
    return result.count;
  }

  private sumStagesCost(stagesJson: unknown): number {
    if (!Array.isArray(stagesJson)) return 0;
    return stagesJson.reduce((sum, s) => sum + (s?.cost_credits ?? 0), 0);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async fetchWorkspaceContext(workspaceId: string, profile: string): Promise<string> {
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
        `Plan: ${ws?.plan ?? "FREE"} | Perfil: ${profile}`,
        `Estado: ${ws?.status ?? "—"}`,
        `Zona horaria: ${ws?.timezone ?? "UTC"} | Locale: ${ws?.locale ?? "es"}`,
        `Estadísticas: ${contacts} contactos, ${conversations} conversaciones, ${tasks} tareas`,
      ].join("\n");
    } catch {
      return `[Contexto del Workspace]\nID: ${workspaceId} | Perfil: ${profile}`;
    }
  }

  /**
   * Load the diagnostic case context so agents understand what they're analyzing.
   * When no case_id is provided (standalone messages), returns empty string.
   */
  private async fetchDiagnosticCaseContext(
    workspaceId: string,
    diagnosticCaseId?: string,
  ): Promise<string> {
    if (!diagnosticCaseId) return "";

    try {
      const dCase = await this.prisma.supportDiagnosticCase.findFirst({
        where: {
          id: diagnosticCaseId,
          workspace_id: workspaceId,
        },
        select: {
          id: true,
          module: true,
          error_code: true,
          trace_id: true,
          category: true,
          risk_level: true,
          status: true,
          title: true,
          user_description: true,
          safe_summary: true,
          evidence_json: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!dCase) {
        return [
          `[Caso de diagnóstico]`,
          `ID: ${diagnosticCaseId}`,
          `Estado: no encontrado o no pertenece al workspace actual`,
        ].join("\n");
      }

      const evidencePreview = dCase.evidence_json
        ? JSON.stringify(dCase.evidence_json).slice(0, 4000)
        : "";

      return [
        `[Caso de diagnóstico]`,
        `ID: ${dCase.id}`,
        `Estado: ${dCase.status}`,
        `Módulo: ${dCase.module ?? "unknown"}`,
        `Categoría: ${dCase.category}`,
        `Riesgo: ${dCase.risk_level}`,
        dCase.error_code ? `Código de error: ${dCase.error_code}` : "",
        dCase.trace_id ? `Trace ID: ${dCase.trace_id}` : "",
        `Título: ${dCase.title}`,
        dCase.user_description
          ? `Descripción del usuario:\n${dCase.user_description}`
          : "",
        dCase.safe_summary ? `Resumen seguro:\n${dCase.safe_summary}` : "",
        evidencePreview ? `Evidencia registrada:\n${evidencePreview}` : "",
        `Creado: ${dCase.created_at.toISOString()}`,
        `Actualizado: ${dCase.updated_at.toISOString()}`,
      ]
        .filter(Boolean)
        .join("\n");
    } catch (err: any) {
      this.logger.warn(
        `[orchestrator] failed to fetch diagnostic case ${diagnosticCaseId}: ${err?.message}`,
      );
      return [
        `[Caso de diagnóstico]`,
        `ID: ${diagnosticCaseId}`,
        `(no se pudo cargar — ${err?.message ?? "error"})`,
      ].join("\n");
    }
  }

  private async resolveProfile(workspaceId: string): Promise<SupportProfile> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    return planToProfile(ws?.plan ?? "FREE");
  }

  /**
   * Run a single agent stage: resolve its Flowise flow, predict, sanitize and
   * record. Non-fatal — a failed stage is recorded and the pipeline continues.
   */
  private async runStage(
    slug: SupportAgentSlug,
    profile: SupportProfile,
    context: string,
    sessionId: string,
    stages: StageRecord[],
    workspaceId?: string,
    runId?: string,
    vars?: Record<string, string>,
  ): Promise<StageRecord | null> {
    const def = getSupportAgent(slug);
    if (!def || !profileCanUseAgent(profile, slug)) {
      const rec: StageRecord = {
        agent_slug: slug,
        allowed: false,
        skipped_reason: `Perfil ${profile} no puede usar ${slug}`,
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
          overrideConfig: vars ? { vars } : undefined,
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
            overrideConfig: vars ? { vars } : undefined,
          });
        } else if ((predictErr?.message as string | undefined)?.includes("Tool not selected")) {
          this.logger.warn(`[orchestrator] missing tools detected — running full Flowise setup`);
          await this.flowiseSetup.reprovisionAllFlows();
          // After reprovisioning, agentflows may have new IDs — refresh before retrying
          const reProvisionedId = await this.flowiseSetup.getChatflowIdForAgent(slug);
          if (reProvisionedId) activeId = reProvisionedId;
          res = await this.flowise.predict(activeId, {
            question: safeContext,
            sessionId: `${sessionId}:${slug}`,
            overrideConfig: vars ? { vars } : undefined,
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

  /**
   * Run multiple specialist agents in parallel.
   * Each gets the same context and session prefix. Non-fatal per-agent —
   * individual failures are recorded and the others continue.
   */
  private async runParallelStages(
    slugs: SupportAgentSlug[],
    profile: SupportProfile,
    context: string,
    sessionId: string,
    stages: StageRecord[],
    workspaceId?: string,
    runId?: string,
    vars?: Record<string, string>,
  ): Promise<StageRecord[]> {
    const results = await Promise.all(
      slugs.map((slug) =>
        this.runStage(slug, profile, context, `${sessionId}:${slug}`, stages, workspaceId, runId, vars)
          .then((rec) => rec ?? {
            agent_slug: slug,
            allowed: true,
            error: "stage returned null",
          } as StageRecord)
          .catch((err) => ({
            agent_slug: slug,
            allowed: true,
            error: err?.message ?? "parallel execution failed",
          } as StageRecord)),
      ),
    );
    return results;
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
    const t = text.toLowerCase();
    // Only block on explicit denial or critical risk
    if (/(bloque|block|riesgo cr[ií]tico|critical risk|denegad|denied|no aprobado)/.test(t)) return false;
    // Accept explicit approval OR no issues found
    return /(aprobad|approved|sin riesgos|no risks|ok|safe|sin problemas|no issues|correcto)/.test(t);
  }

  private buildSummary(
    profile: string,
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
    parts.push(`**Severidad:** ${severity ?? "—"} · **Perfil:** ${profile}`);

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
