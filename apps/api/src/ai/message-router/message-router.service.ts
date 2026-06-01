import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { LlmIntentClassifierService } from "./llm-intent-classifier.service";
import { PolicyEngineService } from "./policy-engine.service";
import { SmartSendService } from "./smart-send.service";
import { QuickReplyService } from "./quick-reply.service";
import { AgentDispatcherService } from "./agent-dispatcher.service";
import { HumanHandoffService } from "./human-handoff.service";
import { ContextEnricherService } from "./context-enricher.service";
import { ModelSelectorService } from "./model-selector.service";
import { RouterMetricsService } from "./router-metrics.service";
import { AiDecisionAuditService } from "./ai-decision-audit.service";
import {
  AgentType,
  ChannelType,
  ContextEnrichment,
  ConversationContext,
  IncomingMessageEvent,
  Intent,
  RouterDecision,
} from "./types";

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly llmClassifier: LlmIntentClassifierService,
    private readonly policyEngine: PolicyEngineService,
    private readonly smartSend: SmartSendService,
    private readonly quickReply: QuickReplyService,
    private readonly agentDispatcher: AgentDispatcherService,
    private readonly humanHandoff: HumanHandoffService,
    private readonly contextEnricher: ContextEnricherService,
    private readonly modelSelector: ModelSelectorService,
    private readonly routerMetrics: RouterMetricsService,
    private readonly audit: AiDecisionAuditService,
  ) {}

  /**
   * Full routing evaluation pipeline:
   *   load context → classify (rules + LLM fallback) → policy → send plan
   *   → quick reply fast-path → agent dispatch → human handoff → context
   *   enrichment → model selection → audit log
   *
   * Returns RouterDecision. Never throws.
   */
  async evaluate(event: IncomingMessageEvent): Promise<RouterDecision> {
    try {
      const context = await this.loadContext(event);

      // ── Phase 2: Intent classification ──────────────────────────────────
      let { intent, confidence } = this.intentClassifier.classify(event.text);
      let classifyTokensConsumed = 0;

      // LLM fallback only when rules are uncertain
      if (confidence === "low") {
        const llmResult = await this.llmClassifier.classify(event.text, context, {
          conversationId: event.conversationId,
          messageId: event.messageId,
        });
        if (llmResult.confidence !== "low") {
          intent = llmResult.intent;
          confidence = llmResult.confidence;
        }
        classifyTokensConsumed = llmResult.tokensConsumed;
      }

      // Estimate tokens a full AI chain call would consume (for savings calculation)
      const estimatedFullCallTokens = this.estimateFullCallTokens(event.text);

      // ── Policy evaluation ─────────────────────────────────────────────
      const policy = this.policyEngine.evaluate(context, intent);

      if (!policy.allowed) {
        this.logAudit(event, intent, policy.reason, "none", "none", false, false);
        this.recordMetrics(event.workspaceId, intent, "fast", "none", false, true, classifyTokensConsumed, estimatedFullCallTokens).catch(() => undefined);
        return {
          intent,
          intentConfidence: confidence,
          policy,
          sendPlan: null,
          shouldCallAi: false,
        };
      }

      // ── Smart send plan ────────────────────────────────────────────────
      const sendPlan = this.smartSend.plan(context, intent);

      // ── Phase 2: Quick reply fast-path ─────────────────────────────────
      const quickReplyText = this.quickReply.getQuickReply(intent, context.channel) ?? undefined;

      // ── Phase 3: Agent dispatch + human handoff ────────────────────────
      const dispatch = this.agentDispatcher.dispatch(intent);

      if (dispatch.agentType === "human") {
        await this.humanHandoff.triggerHandoff(
          event.workspaceId,
          event.conversationId,
          event.text,
        );
        this.logAudit(event, intent, policy.reason, "human", sendPlan.mode, false, false);
        // Human handoff: quick reply sent but full LLM avoided
        this.recordMetrics(event.workspaceId, intent, "fast", "human", !!quickReplyText, false, classifyTokensConsumed, estimatedFullCallTokens).catch(() => undefined);
        return {
          intent,
          intentConfidence: confidence,
          policy,
          sendPlan,
          shouldCallAi: false,
          quickReplyText,
          agentType: "human",
          modelTier: "fast",
        };
      }

      // Quick reply: no LLM needed — saves the full AI chain cost
      if (quickReplyText) {
        this.logAudit(event, intent, policy.reason, "quick_reply", sendPlan.mode, false, false);
        this.recordMetrics(event.workspaceId, intent, "fast", dispatch.agentType, true, false, classifyTokensConsumed, estimatedFullCallTokens).catch(() => undefined);
        return {
          intent,
          intentConfidence: confidence,
          policy,
          sendPlan,
          shouldCallAi: false,
          quickReplyText,
          agentType: dispatch.agentType,
          modelTier: "fast",
        };
      }

      // Outside WhatsApp window — approval needed, AI blocked
      if (sendPlan.requiresApproval) {
        this.logAudit(event, intent, policy.reason, dispatch.agentType, sendPlan.mode, false, true);
        this.recordMetrics(event.workspaceId, intent, "fast", dispatch.agentType, false, false, classifyTokensConsumed, estimatedFullCallTokens).catch(() => undefined);
        return {
          intent,
          intentConfidence: confidence,
          policy,
          sendPlan,
          shouldCallAi: false,
          agentType: dispatch.agentType,
          modelTier: "fast",
        };
      }

      // ── Phase 3: Context enrichment (non-blocking, best-effort) ─────────
      let contextEnrichment: ContextEnrichment | undefined;
      contextEnrichment = await this.contextEnricher.enrich(
        event.workspaceId,
        event.contactId,
        dispatch.agentType,
      );
      if (!contextEnrichment.summary) contextEnrichment = undefined;

      // ── Phase 4: Model selection ──────────────────────────────────────
      const { modelTier } = this.modelSelector.selectModel(intent, context.workspacePlan);

      this.logAudit(event, intent, policy.reason, dispatch.agentType, sendPlan.mode, true, false);
      // Token savings = 0 here because the AI chain WILL run — tracked via recordOutcome()
      this.recordMetrics(event.workspaceId, intent, modelTier, dispatch.agentType, false, false, classifyTokensConsumed, 0).catch(() => undefined);

      return {
        intent,
        intentConfidence: confidence,
        policy,
        sendPlan,
        shouldCallAi: true,
        agentType: dispatch.agentType,
        modelTier,
        systemPromptAddendum: dispatch.systemPromptAddendum || undefined,
        contextEnrichment,
      };
    } catch (err: unknown) {
      this.logger.error(
        `[router] evaluate failed conv=${event.conversationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // On error: allow AI chain to proceed (fail-safe, not fail-secure)
      return {
        intent: "unknown",
        intentConfidence: "low",
        policy: { allowed: true, requiresHumanApproval: false, reason: "router_error_fallback", riskLevel: "low" },
        sendPlan: null,
        shouldCallAi: true,
      };
    }
  }

  /** Record final reply outcome (call after AI chain resolves). */
  async recordOutcome(
    workspaceId: string,
    decision: RouterDecision,
    replied: boolean,
  ): Promise<void> {
    return this.routerMetrics.recordCall(
      workspaceId,
      decision.intent,
      decision.modelTier ?? "fast",
      (decision.agentType ?? "none") as AgentType | "none",
      replied,
      !decision.policy.allowed,
      0, // tokens consumed by AI chain are tracked by AiConversationControl / Flowise directly
      0,
    );
  }

  /**
   * Estimates the tokens that would have been consumed by a full AI chain call.
   * Used to compute savings when the router short-circuits with a quick reply or block.
   * Overhead: ~700 tokens for system prompt + conversation history + avg completion.
   */
  private estimateFullCallTokens(text: string): number {
    const OVERHEAD = 700; // avg system prompt + history + completion
    return OVERHEAD + Math.ceil(text.length / 3);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private logAudit(
    event: IncomingMessageEvent,
    intent: Intent,
    policyDecision: string,
    agentUsed: string,
    sendMode: string,
    llmUsed: boolean,
    humanApprovalRequired: boolean,
  ): void {
    this.audit
      .record({
        workspaceId: event.workspaceId,
        conversationId: event.conversationId,
        messageId: event.messageId,
        intent,
        agentUsed,
        llmUsed,
        toolsUsed: [],
        policyDecision,
        sendMode,
        humanApprovalRequired,
      })
      .catch(() => undefined);
  }

  private recordMetrics(
    workspaceId: string,
    intent: Intent,
    modelTier: string,
    agentType: string,
    replied: boolean,
    blocked: boolean,
    tokensConsumed = 0,
    tokensSaved = 0,
  ): Promise<void> {
    return this.routerMetrics
      .recordCall(
        workspaceId,
        intent,
        modelTier as "fast" | "balanced" | "powerful",
        agentType as AgentType | "none",
        replied,
        blocked,
        tokensConsumed,
        tokensSaved,
      )
      .catch(() => undefined);
  }

  private async loadContext(event: IncomingMessageEvent): Promise<ConversationContext> {
    const [workspace, conv] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: event.workspaceId },
        select: { plan: true, settings_json: true },
      }),
      this.prisma.conversation.findFirst({
        where: { id: event.conversationId, workspace_id: event.workspaceId },
        select: {
          status: true,
          metadata_json: true,
          last_customer_message_at: true,
          is_service_window_open: true,
          channel: { select: { type: true } },
          contact: { select: { full_name: true, email: true, phone: true } },
        },
      }),
    ]);

    const wsSettings = (workspace?.settings_json as Record<string, unknown>) ?? {};
    const meta = (conv?.metadata_json as Record<string, unknown>) ?? {};
    const rawAiState = meta.ai_state as string | undefined;

    return {
      workspaceId: event.workspaceId,
      contactId: event.contactId,
      channel: (conv?.channel?.type ?? "WEBCHAT") as ChannelType,
      lastCustomerMessageAt: conv?.last_customer_message_at ?? null,
      isServiceWindowOpen: conv?.is_service_window_open ?? false,
      conversationStatus: conv?.status ?? "NEW",
      aiState:
        rawAiState === "HUMAN_ACTIVE"
          ? "HUMAN_ACTIVE"
          : rawAiState === "AI_ACTIVE"
          ? "AI_ACTIVE"
          : "IDLE",
      human_handover_at: meta.human_handover_at as string | undefined,
      workspacePlan: workspace?.plan ?? "FREE",
      aiAgentAutoActive: wsSettings.ai_agent_auto_active === true,
      contact: conv?.contact
        ? {
            name: conv.contact.full_name ?? undefined,
            email: conv.contact.email ?? undefined,
            phone: conv.contact.phone ?? undefined,
          }
        : undefined,
    };
  }
}
