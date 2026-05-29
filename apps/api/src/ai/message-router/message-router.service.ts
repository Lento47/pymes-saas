import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { PolicyEngineService } from "./policy-engine.service";
import { SmartSendService } from "./smart-send.service";
import { AiDecisionAuditService } from "./ai-decision-audit.service";
import {
  ChannelType,
  ConversationContext,
  IncomingMessageEvent,
  RouterDecision,
} from "./types";

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly policyEngine: PolicyEngineService,
    private readonly smartSend: SmartSendService,
    private readonly audit: AiDecisionAuditService,
  ) {}

  /**
   * Evaluates incoming message and returns a routing decision.
   *
   * Order: load context → classify intent (rules, no LLM) → evaluate policy
   * → plan send channel/mode → log audit.
   *
   * The caller uses `shouldCallAi` and `sendPlan.requiresApproval` to decide
   * whether to invoke the AI chain.  Never throws.
   */
  async evaluate(event: IncomingMessageEvent): Promise<RouterDecision> {
    try {
      const context = await this.loadContext(event);
      const { intent, confidence } = this.intentClassifier.classify(event.text);
      const policy = this.policyEngine.evaluate(context, intent);

      const sendPlan = policy.allowed
        ? this.smartSend.plan(context, intent)
        : null;

      const shouldCallAi =
        policy.allowed &&
        sendPlan !== null &&
        !sendPlan.requiresApproval;

      const decision: RouterDecision = {
        intent,
        intentConfidence: confidence,
        policy,
        sendPlan,
        shouldCallAi,
      };

      // Audit is fire-and-forget — must not block
      this.audit
        .record({
          workspaceId: event.workspaceId,
          conversationId: event.conversationId,
          messageId: event.messageId,
          intent,
          agentUsed: shouldCallAi ? "pending" : "none",
          llmUsed: false,
          toolsUsed: [],
          policyDecision: policy.reason,
          sendMode: sendPlan?.mode ?? "none",
          humanApprovalRequired: sendPlan?.requiresApproval ?? false,
        })
        .catch(() => undefined);

      if (!policy.allowed) {
        this.logger.debug(
          `[router] blocked conv=${event.conversationId} reason=${policy.reason} intent=${intent}`,
        );
      } else if (sendPlan?.requiresApproval) {
        this.logger.log(
          `[router] approval required conv=${event.conversationId} mode=${sendPlan.mode} intent=${intent}`,
        );
      }

      return decision;
    } catch (err: unknown) {
      // Never let the router crash message processing
      this.logger.error(
        `[router] evaluate failed conv=${event.conversationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        intent: "unknown",
        intentConfidence: "low",
        policy: { allowed: true, requiresHumanApproval: false, reason: "router_error_fallback", riskLevel: "low" },
        sendPlan: null,
        shouldCallAi: true,
      };
    }
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
