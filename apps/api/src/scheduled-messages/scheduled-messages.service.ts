import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EventsGateway } from "../gateways/events.gateway";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { TelegramOutboundService } from "../telegram/telegram-outbound.service";
export type ScheduledMessageStatus = "PENDING" | "SENT" | "FAILED" | "CANCELLED";
export type ScheduledMessageSource = "customer_request" | "agent_followup" | "operator";

export interface CreateScheduledMessageDto {
  workspaceId: string;
  conversationId: string;
  bodyText: string;
  scheduledAt: Date;
  source?: ScheduledMessageSource;
  contextNote?: string;
}

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly whatsapp: WhatsAppService,
    private readonly telegram: TelegramOutboundService,
  ) {}

  /**
   * Schedule a message for future delivery.
   * Pulls channel/contact info from the conversation record.
   */
  async schedule(dto: CreateScheduledMessageDto): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, workspace_id: dto.workspaceId },
      select: {
        channel_id: true,
        contact: { select: { phone: true, telegram_chat_id: true } },
      },
    });
    if (!conv) {
      this.logger.warn(`schedule(): conversation ${dto.conversationId} not found`);
      return;
    }

    await this.prisma.scheduledMessage.create({
      data: {
        workspace_id:        dto.workspaceId,
        conversation_id:     dto.conversationId,
        channel_id:          conv.channel_id ?? null,
        contact_phone:       conv.contact?.phone ?? null,
        contact_telegram_id: conv.contact?.telegram_chat_id ?? null,
        body_text:           dto.bodyText,
        scheduled_at:        dto.scheduledAt,
        status:              "PENDING",
        source:              dto.source ?? "customer_request",
        context_note:        dto.contextNote ?? null,
      },
    });

    this.logger.log(
      `Scheduled message for conv=${dto.conversationId} at ${dto.scheduledAt.toISOString()} (source=${dto.source ?? "customer_request"})`,
    );
  }

  /**
   * Cancel a pending scheduled message.
   * Scoped by workspace for tenant isolation.
   */
  async cancel(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.prisma.scheduledMessage.updateMany({
      where: { id, workspace_id: workspaceId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    return result.count > 0;
  }

  /** List all scheduled messages for a conversation, ordered by scheduled_at asc. */
  async listByConversation(workspaceId: string, conversationId: string) {
    return this.prisma.scheduledMessage.findMany({
      where: { workspace_id: workspaceId, conversation_id: conversationId },
      orderBy: { scheduled_at: "asc" },
      select: {
        id: true,
        body_text: true,
        scheduled_at: true,
        status: true,
        source: true,
        context_note: true,
        sent_at: true,
        created_at: true,
      },
    });
  }

  /** Count pending scheduled messages for a conversation. */
  async countPendingForConversation(workspaceId: string, conversationId: string): Promise<number> {
    return this.prisma.scheduledMessage.count({
      where: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        status: "PENDING",
        scheduled_at: { gt: new Date() },
      },
    });
  }

  /**
   * Called by the cron job: find all due PENDING messages and send them.
   * Processes up to 100 per run with basic retry tracking.
   */
  async processDue(): Promise<void> {
    const due = await this.prisma.scheduledMessage.findMany({
      where: {
        status: "PENDING",
        scheduled_at: { lte: new Date() },
        retry_count: { lt: 3 },
      },
      take: 100,
      orderBy: { scheduled_at: "asc" },
    });

    if (due.length === 0) return;
    this.logger.log(`processDue: sending ${due.length} scheduled message(s)`);

    await Promise.allSettled(due.map((msg) => this.sendScheduled(msg)));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async sendScheduled(msg: {
    id: string;
    workspace_id: string;
    conversation_id: string;
    channel_id: string | null;
    contact_phone: string | null;
    contact_telegram_id: string | null;
    body_text: string;
    retry_count: number;
  }): Promise<void> {
    try {
      const outbound = await this.prisma.message.create({
        data: {
          workspace_id:    msg.workspace_id,
          conversation_id: msg.conversation_id,
          direction:       "OUTBOUND",
          sender_name:     "Agente IA",
          sender_ref:      "ai-agent@emprende",
          body_text:       msg.body_text,
          sent_at:         new Date(),
          delivery_status: "SENT",
          message_type:    "TEXT",
          has_media:       false,
          media_status:    "NONE",
        },
      });

      await this.prisma.conversation.update({
        where: { id: msg.conversation_id },
        data: { last_message_at: new Date(), updated_at: new Date() },
        select: { id: true },
      });

      this.events.emitNewMessage(msg.conversation_id, msg.workspace_id, {
        id:              outbound.id,
        conversation_id: msg.conversation_id,
        workspace_id:    msg.workspace_id,
        direction:       "OUTBOUND",
        sender_name:     "Agente IA",
        sender_ref:      "ai-agent@emprende",
        body_text:       msg.body_text,
        sent_at:         outbound.sent_at?.toISOString(),
        created_at:      outbound.created_at.toISOString(),
        message_type:    "TEXT",
        delivery_status: "SENT",
        has_media:       false,
        media_status:    "none",
      });

      await this.dispatchToChannel(msg);

      await this.prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: "SENT", sent_at: new Date() },
      });

      this.logger.log(`Sent scheduled message ${msg.id} to conv=${msg.conversation_id}`);
    } catch (err: any) {
      const nextRetry = msg.retry_count + 1;
      const failed = nextRetry >= 3;
      await this.prisma.scheduledMessage
        .update({
          where: { id: msg.id },
          data: {
            status:      failed ? "FAILED" : "PENDING",
            retry_count: nextRetry,
            error:       err.message?.slice(0, 500),
          },
        })
        .catch(() => {});
      this.logger.error(`Scheduled message ${msg.id} failed (attempt ${nextRetry}): ${err.message}`);
    }
  }

  private async dispatchToChannel(msg: {
    workspace_id: string;
    channel_id: string | null;
    contact_phone: string | null;
    contact_telegram_id: string | null;
    body_text: string;
  }): Promise<void> {
    if (!msg.channel_id) return;

    const channel = await this.prisma.channel.findUnique({
      where: { id: msg.channel_id },
      select: { id: true, type: true, config_json: true },
    });
    if (!channel) return;

    if (channel.type === "WHATSAPP" && msg.contact_phone) {
      const to = msg.contact_phone.replace(/\D/g, "");
      if (to) {
        await this.whatsapp
          .sendMessage(channel as Record<string, any>, to, msg.body_text)
          .catch((err) => {
            this.logger.warn(`WA dispatch for scheduled msg channel=${msg.channel_id}: ${err.message}`);
            throw err;
          });
      }
    } else if (channel.type === "TELEGRAM" && msg.contact_telegram_id) {
      await this.telegram
        .sendMessage(channel.id, msg.contact_telegram_id, msg.body_text)
        .catch((err) => {
          this.logger.warn(`TG dispatch for scheduled msg channel=${msg.channel_id}: ${err.message}`);
          throw err;
        });
    }
  }

}
