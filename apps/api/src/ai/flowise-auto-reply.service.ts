import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EventsGateway } from "../gateways/events.gateway";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
import { FlowiseClient } from "../agents/flowise/flowise.client";
import { FlowiseSetupService } from "../agents/flowise-setup.service";

@Injectable()
export class FlowiseAutoReplyService {
  private readonly logger = new Logger(FlowiseAutoReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
    private readonly flowiseSetup: FlowiseSetupService,
    private readonly events: EventsGateway,
    private readonly whatsapp: WhatsAppService,
    private readonly telegram: TelegramOutboundService,
  ) {}

  /**
   * Resolve the workspace's Flowise support tier, call predict, then store and
   * dispatch the reply via the conversation's channel.
   *
   * Returns true if a reply was sent; false if Flowise is disabled, no chatflow
   * was found, the conversation's ai_state is HUMAN_ACTIVE, or any error occurs.
   * Never throws — all errors are caught and logged.
   */
  async dispatch(
    workspaceId: string,
    conversationId: string,
    inboundText: string,
  ): Promise<boolean> {
    if (!this.flowise.isEnabled) return false;

    try {
      const [workspace, conv] = await Promise.all([
        this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { plan: true, settings_json: true },
        }),
        this.prisma.conversation.findFirst({
          where: { id: conversationId, workspace_id: workspaceId },
          select: {
            id: true,
            metadata_json: true,
            channel: { select: { id: true, type: true, config_json: true } },
            contact: { select: { phone: true, telegram_chat_id: true } },
          },
        }),
      ]);

      if (!workspace || !conv) return false;

      // Respect human takeover
      const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
      if (meta.ai_state === "HUMAN_ACTIVE") return false;

      // Respect workspace AI auto-reply toggle (same guard as Emprende AI)
      const wsSettings = (workspace.settings_json as Record<string, unknown>) ?? {};
      const wsAutoActive = wsSettings.ai_agent_auto_active === true;
      if (!wsAutoActive && meta.ai_state !== "AI_ACTIVE") return false;

      const chatflowId = await this.flowiseSetup.getChatflowIdForPlan(workspace.plan);
      if (!chatflowId) {
        this.logger.debug(`[flowise-auto-reply] no chatflow for plan=${workspace.plan} workspace=${workspaceId}`);
        return false;
      }

      const res = await this.flowise.predict(chatflowId, {
        question: inboundText,
        sessionId: conversationId,
      });

      const replyText = res.text?.trim();
      if (!replyText) return false;

      // Persist outbound message
      const message = await this.prisma.message.create({
        data: {
          workspace_id: workspaceId,
          conversation_id: conversationId,
          direction: "OUTBOUND",
          sender_name: "Agente IA",
          sender_ref: "ai-agent@flowise",
          body_text: replyText,
          sent_at: new Date(),
          delivery_status: "PENDING",
          message_type: "TEXT",
          has_media: false,
          media_status: "NONE",
          raw_payload_json: { source: "flowise-auto-reply" } as any,
        },
      });

      // Dispatch via channel
      let sent = false;
      let providerMsgId: string | null = null;

      if (conv.channel?.type === "WHATSAPP" && conv.contact?.phone) {
        const to = conv.contact.phone.replace(/\D/g, "");
        if (to) {
          const result = await this.whatsapp.sendMessage(conv.channel, to, replyText);
          providerMsgId = result.message_id ?? null;
          sent = true;
        }
      } else if (conv.channel?.type === "TELEGRAM" && conv.contact?.telegram_chat_id) {
        await this.telegram.sendMessage(conv.channel.id, conv.contact.telegram_chat_id, replyText);
        sent = true;
      }

      // Update delivery status
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          delivery_status: sent ? "SENT" : "DISPATCH_FAILED",
          ...(providerMsgId ? { provider_message_id: providerMsgId } : {}),
        },
      });

      // Real-time push
      this.events.emitNewMessage(conversationId, workspaceId, {
        id: message.id,
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_name: "Agente IA",
        body_text: replyText,
        sent_at: message.sent_at.toISOString(),
        delivery_status: sent ? "SENT" : "DISPATCH_FAILED",
        message_type: "TEXT",
        has_media: false,
      });

      this.logger.log(
        `[flowise-auto-reply] sent conv=${conversationId} chatflow=${chatflowId} plan=${workspace.plan}`
      );
      return true;
    } catch (err: unknown) {
      this.logger.error(
        `[flowise-auto-reply] workspace=${workspaceId} conv=${conversationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
