import { WorkspaceUserRole } from "@prisma/client";
import {
  BadGatewayException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { PrismaService } from "../common/prisma/prisma.service";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "./messages.service";
import { SlaService } from "./sla.service";
import { EmailService } from "../email/email.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { WhatsAppRateLimiter } from "../whatsapp/whatsapp-rate-limiter";
import { TelegramService } from "../telegram/telegram.service";
import { MessageTemplatesService } from "../message-templates/message-templates.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";
import { FilterConversationsDto } from "./dto/filter-conversations.dto";
import { SendMessageDto } from "./dto/send-message.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly service: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly slaService: SlaService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly whatsAppRateLimiter: WhatsAppRateLimiter,
    private readonly telegramService: TelegramService,
    private readonly templatesService: MessageTemplatesService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Conversations ──────────────────────────────────────────────────────────

  @Get("sla/stats")
  @Roles(WorkspaceUserRole.AGENT)
  getSlaStats(@CurrentUser("workspace_id") workspaceId: string) {
    return this.slaService.getSlaStats(workspaceId);
  }

  @Post("sla/check")
  @Roles(WorkspaceUserRole.ADMIN)
  async checkSla(@CurrentUser("workspace_id") workspaceId: string) {
    await this.slaService.checkSlaBreaches(workspaceId);
    return { ok: true };
  }

  @Get()
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  findAll(@CurrentUser() user: AuthUser, @Query() filters: FilterConversationsDto) {
    return this.service.findAll(user.workspace_id, filters, { id: user.id, role: user.role });
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  create(@CurrentUser("workspace_id") workspaceId: string, @Body() dto: CreateConversationDto) {
    return this.service.create(workspaceId, dto);
  }

  @Get(":id")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  findOne(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(":id")
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Post(":id/assign")
  @Roles(WorkspaceUserRole.AGENT)
  assign(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body("user_id") userId: string,
  ) {
    return this.service.assign(workspaceId, id, userId);
  }

  @Post(":id/resolve")
  @Roles(WorkspaceUserRole.AGENT)
  resolve(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.service.resolve(workspaceId, id);
  }

  @Delete(":id")
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Get(":id/messages")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  getMessages(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) conversationId: string,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
  ) {
    return this.messagesService.findAll(workspaceId, conversationId, +page, +limit);
  }

  @Post(":id/messages")
  @Roles(WorkspaceUserRole.AGENT)
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    let bodyText = dto.body_text ?? "";
    let bodyHtml = dto.body_html ?? "";
    let template: Record<string, any> | null = null;

    if (dto.template_id) {
      template = await this.templatesService.getById(user.workspace_id, dto.template_id);
      if (template) {
        bodyText = this.resolveTemplate(template.body, dto.template_variables ?? {});
        bodyHtml = bodyText.replace(/\n/g, "<br>");
      }
    }

    const sendDto = { ...dto, body_text: bodyText, body_html: bodyHtml };
    const message = await this.messagesService.send(
      user.workspace_id,
      conversationId,
      user,
      sendDto,
    );

    // 2. Despachar al canal externo
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: user.workspace_id },
      include: { contact: true, channel: true },
    });

    // Guard: channel and contact must exist
    if (!conv?.channel || !conv?.contact) {
      return message;
    }

    // ── Email dispatch ──
    if (conv.channel.type === "EMAIL" && (conv.contact as any)?.email) {
      try {
        await this.emailService.sendOutbound(
          conv.channel,
          (conv.contact as any).email,
          (conv as any).subject ?? "Nuevo mensaje",
          bodyHtml || bodyText,
          bodyText,
        );
      } catch (err) {
        this.logger.error(`Email dispatch failed: ${err?.message}`);
        throw new BadGatewayException(err?.message ?? "No se pudo enviar el email.");
      }
    }

    // ── WhatsApp dispatch ──
    if (conv.channel.type === "WHATSAPP" && (conv.contact as any)?.phone) {
      try {
        const phoneStr = (conv.contact as any).phone as string;
        const to = phoneStr ? phoneStr.replace(/\D/g, "") : "";
        if (!to) return message;

        // Rate limit check
        const cfg = conv.channel.config_json as any;
        const phoneNumberId = cfg?.phone_number_id;
        if (phoneNumberId && !this.whatsAppRateLimiter.canSend(phoneNumberId)) {
          this.logger.warn(`WhatsApp rate limit reached for ${phoneNumberId}`);
          await this.whatsAppRateLimiter.waitForSlot(phoneNumberId);
        }

        let externalId: string | null = null;

        // Check message content type and dispatch accordingly
        const interactive = dto.interactive as Record<string, any> | undefined;
        const iType = interactive?.type as string | undefined;

        if (template?.external_template_id) {
          externalId = (
            await this.whatsAppService.sendTemplateMessage(
              conv.channel,
              to,
              template.external_template_id,
              template.language ?? "es",
              dto.template_variables ?? {},
            )
          ).message_id;
        } else if (iType === "button" && Array.isArray(interactive?.buttons)) {
          externalId = (await this.whatsAppService.sendReplyButtons(
            conv.channel, to,
            interactive.body ?? dto.body_text ?? "",
            interactive.buttons,
            interactive.footer,
          )).message_id;
        } else if (iType === "list" && Array.isArray(interactive?.sections)) {
          externalId = (await this.whatsAppService.sendListMessage(
            conv.channel, to,
            interactive.body ?? dto.body_text ?? "",
            interactive.buttonText ?? "Ver opciones",
            interactive.sections,
            interactive.footer,
          )).message_id;
        } else if (iType === "location_request") {
          externalId = (await this.whatsAppService.sendLocationRequest(
            conv.channel, to,
            interactive.body ?? dto.body_text ?? "Comparte tu ubicación",
          )).message_id;
        } else if (dto.media_url && dto.media_type) {
          // Dispatch media message
          const validMediaTypes = ["image", "video", "audio", "document", "sticker"];
          if (validMediaTypes.includes(dto.media_type.toLowerCase())) {
            externalId = (await this.whatsAppService.sendMedia(
              conv.channel,
              to,
              dto.media_url,
              dto.media_type.toLowerCase() as "image" | "video" | "audio" | "document" | "sticker",
              dto.media_caption ?? dto.body_text ?? undefined,
            )).message_id;
          } else {
            externalId = (await this.whatsAppService.sendMessage(
              conv.channel, to,
              dto.body_text || dto.media_caption || "Archivo adjunto",
            )).message_id;
          }
        } else if (dto.body_text) {
          // Dispatch text message (with optional reply context)
          const hasReply = !!dto.reply_to_message_id;
          externalId = hasReply
            ? (await this.whatsAppService.sendReply(
                conv.channel, to,
                dto.body_text,
                dto.reply_to_message_id!,
              )).message_id
            : (await this.whatsAppService.sendMessage(
                conv.channel, to,
                dto.body_text,
              )).message_id;
        }

        // Update with external message ID for status tracking
        if (externalId) {
          await this.prisma.message.update({
            where: { id: message.id },
            data: {
              external_message_id: externalId,
              delivery_status: "SENT",
            },
          });
        }
      } catch (err: any) {
        this.logger.error(`WhatsApp dispatch failed: ${err?.message}`);
        // Update message delivery status to failed
        await this.prisma.message.update({
          where: { id: message.id },
          data: {
            delivery_status: "DISPATCH_FAILED",
            delivery_error: err?.message?.slice(0, 500) ?? "Unknown dispatch error",
          },
        });
      }
    }

    if (conv?.channel?.type === "TELEGRAM" && (conv.contact as any)?.telegram_chat_id) {
      try {
        const chatId = (conv.contact as any).telegram_chat_id;
        this.logger.log(
          `[DIAG] Telegram dispatch: conv=${conversationId}, channel=${conv.channel.id}, hasMedia=${!!dto.media_url}, mediaType=${dto.media_type ?? "none"}`,
        );
        if (dto.media_url && dto.media_type) {
          await this.telegramService.sendMedia(
            conv.channel.id,
            chatId,
            dto.media_url,
            dto.media_type,
            bodyText || undefined,
          );
        } else {
          await this.telegramService.sendMessage(conv.channel.id, chatId, bodyText);
        }
      } catch (err) {
        this.logger.error(`Telegram dispatch failed: ${err?.message}`);
        throw new BadGatewayException(err?.message ?? "No se pudo enviar el mensaje por Telegram.");
      }
    }

    return message;
  }

  private resolveTemplate(body: string, vars: Record<string, string>): string {
    let resolved = body;
    for (const [key, value] of Object.entries(vars)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return resolved;
  }

  @Get("messages/:messageId/media")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  async getMessageMedia(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("messageId", ValidateUUIDPipe) messageId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    // NOTE: Uses passthrough:false (manual response mode) because this endpoint
    // serves raw binary media (buffers) — NestJS cannot auto-serialize Buffer.
    try {
      // 1) Proxy from MinIO storage (HTTPS — no redirect, avoids mixed-content)
      const media = await this.messagesService.getMediaContent(messageId, workspaceId);
      if (media) {
        res.setHeader("Content-Type", media.contentType);
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
        return res.send(media.buffer);
      }

      // 2) Fallback: buffer proxy (Meta API — no storage yet)
      const { buffer, contentType } = await this.whatsAppService.downloadMedia(
        messageId,
        workspaceId,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.send(buffer);
    } catch (err) {
      res.setHeader("Cache-Control", "public, max-age=5");
      res.status(404).json({ statusCode: 404, message: err.message || "Media no disponible" });
    }
  }

  // ── WhatsApp-specific actions ─────────────────────────────────────────────

  /**
   * POST /conversations/:id/read-receipt
   * Mark last inbound WhatsApp message as read on Meta
   */
  @Post(':id/read-receipt')
  @Roles('AGENT' as any)
  async markAsRead(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') conversationId: string,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      include: { channel: true },
    });

    if (conv?.channel?.type !== 'WHATSAPP') {
      return { ok: false, reason: 'not_whatsapp_channel' };
    }

    // Find last inbound message with external_message_id
    const lastInbound = await this.prisma.message.findFirst({
      where: {
        conversation_id: conversationId,
        direction: 'INBOUND',
        external_message_id: { not: null },
      },
      orderBy: { sent_at: 'desc' },
      select: { external_message_id: true },
    });

    if (lastInbound?.external_message_id && conv.channel) {
      await this.whatsAppService.markAsRead(
        conv.channel,
        lastInbound.external_message_id,
      );
    }

    return { ok: true };
  }

  /**
   * POST /conversations/:id/typing
   * Send typing indicator to WhatsApp user
   */
  @Post(':id/typing')
  @Roles('AGENT' as any)
  async typingIndicator(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') conversationId: string,
    @Body('action') action: 'typing_on' | 'typing_off',
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      include: { contact: true, channel: true },
    });

    if (conv?.channel?.type !== 'WHATSAPP') {
      return { ok: false, reason: 'not_whatsapp_channel' };
    }

    const to = (conv.contact as any)?.phone?.replace(/\D/g, '');
    if (to && conv.channel) {
      await this.whatsAppService.sendTypingIndicator(
        conv.channel,
        to,
        action ?? 'typing_on',
      );
    }

    return { ok: true };
  }
}
