import { Injectable, Inject, Logger, NotFoundException, forwardRef } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { ConversationsService } from "./conversations.service";
import { EventsGateway } from "../gateways/events.gateway";
import { AiService } from "../ai/ai.service";
import { EmrendeAiService } from "../ai/emprende-ai.service";
import { TasksService } from "../tasks/tasks.service";
import { NotificationsService } from "../notifications/notifications.service";
import { Contact, Priority } from "@prisma/client";
import { AutomationsService } from "../automations/automations.service";
import { RoutingService } from "../routing/routing.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { StorageService } from "../common/storage/storage.service";
import { parseJsonValue } from "../common/prisma/json";

/** Shape of a single attachment entry stored in Message.attachments_json */
interface AttachmentEntry {
  storageKey?: string;
  type?: string;
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly events: EventsGateway,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => EmrendeAiService))
    private readonly emprendeAiService: EmrendeAiService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
    private readonly automationsService: AutomationsService,
    private readonly routingService: RoutingService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
    private readonly storage: StorageService,
  ) {}

  async findAll(workspaceId: string, conversationId: string, page = 1, limit = 100) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException("Conversación no encontrada.");

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversation_id: conversationId, workspace_id: workspaceId },
        skip,
        take: limit,
        orderBy: { sent_at: "asc" },
        include: {
          sender_user: { select: { id: true, name: true, avatar_url: true } },
        },
      }),
      this.prisma.message.count({
        where: { conversation_id: conversationId, workspace_id: workspaceId },
      }),
    ]);

    const enriched = data.map((msg) => this.serializeMessageForClient(msg));

    this.logger.log(
      `findAll messages: conv=${conversationId}, count=${total}, returned=${enriched.length}`,
    );

    return {
      data: enriched,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async send(workspaceId: string, conversationId: string, user: AuthUser, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException("Conversación no encontrada.");

    // Resolve message_type from media_type or default to TEXT
    const messageType = dto.media_type
      ? (dto.media_type.toUpperCase() as any)
      : 'TEXT';
    const hasMedia = !!dto.media_url || !!dto.media_type;

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: dto.direction ?? "OUTBOUND",
        sender_user_id: user.id,
        sender_name: user.name,
        sender_ref: user.email,
        body_text: dto.body_text,
        body_html: dto.body_html,
        sent_at: new Date(),
        // ── Media fields ──
        provider: dto.provider ?? null,
        message_type: messageType,
        has_media: hasMedia,
        media_url: dto.media_url ?? null,
        media_mime_type: dto.media_mime_type ?? null,
        media_filename: dto.media_filename ?? null,
        media_caption: dto.media_caption ?? null,
        media_status: hasMedia ? 'AVAILABLE' : 'NONE',
        attachments_json: dto.attachments?.length
          ? dto.attachments
          : dto.media_url
            ? [
                {
                  storageKey: dto.media_url.includes("/api/storage/file/")
                    ? dto.media_url.split("/api/storage/file/").pop()!
                    : dto.media_url,
                  type: dto.media_type ?? "document",
                  mimeType: (() => {
                    const ext = dto.media_url?.split(".").pop()?.toLowerCase() ?? "";
                    const MIME: Record<string, string> = {
                      png: "image/png",
                      jpg: "image/jpeg",
                      jpeg: "image/jpeg",
                      gif: "image/gif",
                      webp: "image/webp",
                      svg: "image/svg+xml",
                      mp4: "video/mp4",
                      mp3: "audio/mpeg",
                      ogg: "audio/ogg",
                      wav: "audio/wav",
                      pdf: "application/pdf",
                      doc: "application/msword",
                      docx:
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    };
                    return MIME[ext] ?? null;
                  })(),
                  filename: dto.media_filename ?? dto.media_url.split("/").pop() ?? null,
                  caption: dto.media_caption ?? dto.body_text ?? null,
                },
              ]
            : undefined,

        // ── Reply context ──
        reply_to_message_id: dto.reply_to_message_id ?? null,

        // ── Interactive ──
        button_payload_json: dto.interactive
          ? dto.interactive
          : undefined,

        // ── Delivery ──
        delivery_status: 'PENDING',
      },
      include: {
        sender_user: { select: { id: true, name: true, avatar_url: true } },
      },
    });

    await this.conversationsService.touchLastMessage(workspaceId, conversationId);

    // Human handover: if AI was active and a human agent just wrote, transfer control to human
    this.handoverToHuman(workspaceId, conversationId).catch(() => {});

    const serialized = this.serializeMessageForClient(message);
    this.events.emitNewMessage(conversationId, workspaceId, serialized);

    return serialized;
  }

  private async handoverToHuman(workspaceId: string, conversationId: string): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata_json: true },
    });
    if (!conv) return;
    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    if (meta.ai_state !== "AI_ACTIVE") return;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata_json: { ...meta, ai_state: "HUMAN_ACTIVE" },
        updated_at: new Date(),
      },
      select: { id: true },
    });
  }

  async receiveInbound(provider: string, workspaceId: string, payload: Record<string, any>) {
    const explicitChannelId =
      typeof payload.channel_id === "string" ? payload.channel_id : undefined;
    const channel = explicitChannelId
      ? await this.prisma.channel.findFirst({
          where: { id: explicitChannelId, workspace_id: workspaceId, status: "ACTIVE" },
        })
      : await this.prisma.channel.findFirst({
          where: { workspace_id: workspaceId, provider, status: "ACTIVE" },
        });
    if (!channel) {
      return { ok: false, reason: "No active channel for provider" };
    }

    const senderRef = payload.sender_ref ?? payload.from ?? payload.sender ?? "unknown";
    const senderName = payload.sender_name ?? payload.name ?? senderRef;
    const bodyText = payload.body_text ?? payload.text ?? payload.body ?? payload.content ?? "";
    const subject = payload.subject ?? null;
    const isEmail = senderRef.includes("@");
    const normalizedPhone = !isEmail ? senderRef.replace(/\D/g, "") : null;

    // ── Find or create contact (normalize phone to prevent duplicates) ─────────
    let contact = null;
    if (isEmail) {
      contact = await this.prisma.contact.findFirst({
        where: { workspace_id: workspaceId, email: senderRef },
      });
    } else if (normalizedPhone) {
      const contactRows = await this.prisma.rawQuery<Contact[]>(
        `SELECT * FROM "contacts"
         WHERE workspace_id = $1
           AND (phone = $2 OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $3)
         LIMIT 1`,
        workspaceId,
        senderRef,
        normalizedPhone,
      );
      if (contactRows.length > 0) contact = contactRows[0];
    }

    if (contact) {
      // Auto-update name for LEAD contacts created from incoming messages
      const contactUpdates: Record<string, any> = {};
      if (contact.type === "LEAD" && contact.full_name !== senderName) {
        contactUpdates.full_name = senderName;
      }
      // Store Telegram chat_id if not already set
      const tgChatId = payload.telegram_chat_id as string | undefined;
      if (tgChatId && !contact.telegram_chat_id) {
        contactUpdates.telegram_chat_id = tgChatId;
      }
      if (Object.keys(contactUpdates).length > 0) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { ...contactUpdates, updated_at: new Date() },
        });
        contact = { ...contact, ...contactUpdates };
      }
    }

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          workspace_id: workspaceId,
          type: "LEAD",
          full_name: senderName,
          email: isEmail ? senderRef : undefined,
          phone: !isEmail ? senderRef : undefined,
          telegram_chat_id: (payload.telegram_chat_id as string | undefined) || undefined,
        },
      });
    }

    // ── Find or reuse conversation for this contact+channel ────────────────────
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        workspace_id: workspaceId,
        contact_id: contact.id,
        channel_id: channel.id,
      },
      orderBy: { last_message_at: "desc" },
      select: {
        id: true,
        assigned_user_id: true,
        subject: true,
        contact_id: true,
        first_response_at: true,
        status: true,
        workspace_id: true,
        channel_id: true,
      },
    });

    if (conversation) {
      // If the conversation was previously resolved, reopen it
      if (!["NEW", "OPEN", "PENDING"].includes(conversation.status)) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: "NEW", updated_at: new Date() },
        });
        conversation.status = "NEW";
      }
    } else {
      conversation = await this.prisma.conversation.create({
        data: {
          workspace_id: workspaceId,
          channel_id: channel.id,
          contact_id: contact.id,
          subject: subject ?? `Mensaje de ${senderName}`,
          status: "NEW",
          priority: "MEDIUM",
        },
        select: {
          id: true,
          assigned_user_id: true,
          subject: true,
          contact_id: true,
          first_response_at: true,
          workspace_id: true,
          channel_id: true,
          status: true,
        },
      });
    }

    // Auto-route new conversation to department based on routing rules
    const route = await this.routingService.resolveQueue(workspaceId, channel.id, bodyText);
    if (route) {
      const member = await this.prisma.departmentMember.findFirst({
        where: { department_id: route.department_id, workspace_id: workspaceId },
        orderBy: { is_lead: "desc" },
        select: { user_id: true },
      });
      const updateData: Record<string, any> = {
        department_id: route.department_id,
        ...(member ? { assigned_user_id: member.user_id } : {}),
      };
      if (route.set_priority) updateData.priority = route.set_priority;
      const updated = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: updateData,
        select: {
          id: true,
          assigned_user_id: true,
          subject: true,
          contact_id: true,
          first_response_at: true,
          workspace_id: true,
          channel_id: true,
          status: true,
          priority: true,
        },
      });
      conversation = updated;
    }
    // Extract rich fields from payload (set by WhatsAppService.processIncomingMessage)
    const messageType = (payload.message_type ?? 'TEXT').toUpperCase();
    const hasMedia = payload.has_media === true || payload.media_url != null;

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        direction: "INBOUND",
        sender_name: senderName,
        sender_ref: senderRef,
        body_text: bodyText,
        body_html: payload.body_html ?? payload.html ?? null,
        raw_payload_json: payload.raw ?? payload,

        // ── Media fields ──
        provider: provider,
        message_type: messageType as any,
        has_media: hasMedia,
        media_url: payload.media_url ?? null,
        media_mime_type: payload.media_mime_type ?? null,
        media_filename: payload.media_filename ?? null,
        media_caption: payload.media_caption ?? null,
        media_status: hasMedia ? 'AVAILABLE' : 'NONE',

        // ── Delivery ──
        delivery_status: 'SENT',
        external_message_id: payload.external_id ?? null,

        // ── Reply / Interactive ──
        reply_to_message_id: payload.reply_to_message_id ?? null,
        interactive_type: payload.interactive_type ?? null,
        button_payload_json: payload.button_payload
          ? payload.button_payload
          : undefined,

        sent_at: new Date(),
      },
    });

    await this.prisma.conversation
      .update({
        where: { id: conversation.id },
        data: {
          last_message_at: new Date(),
          updated_at: new Date(),
          // WhatsApp 24h service window tracking (safe if columns exist, skipped otherwise)
          ...(channel.type === "WHATSAPP"
            ? {
                last_customer_message_at: new Date(),
                service_window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                is_service_window_open: true,
                requires_template_for_outbound: false,
              }
            : {}),
          // Set first_response_at on first agent outbound reply
          ...(message.direction === "OUTBOUND" && !conversation.first_response_at
            ? { first_response_at: new Date() }
            : {}),
        },
        select: { id: true },
      })
      .catch((err) => {
        // Silently skip if columns don't exist yet (migration pending)
        if (err?.code === "P2025" || err?.message?.includes("column")) {
          // Fallback: update only existing columns
          return this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { last_message_at: new Date(), updated_at: new Date() },
            select: { id: true },
          });
        }
        throw err;
      });

    // Emitir en tiempo real (serializado para que el frontend tenga has_media, media_type, etc.)
    this.events.emitNewMessage(
      conversation.id,
      workspaceId,
      this.serializeMessageForClient(message),
    );

    // Notificar a miembros del workspace sobre nuevo mensaje entrante
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspace_id: workspaceId,
        role: { in: ["OWNER", "ADMIN", "AGENT"] },
        user: { is_active: true },
      },
      select: { user_id: true },
    });
    for (const member of members) {
      this.notificationsService
        .create(workspaceId, {
          user_id: member.user_id,
          type: "new_message",
          title: "📩 Nuevo mensaje recibido",
          body: `Nuevo mensaje de ${senderName}${conversation.subject ? ' en "' + conversation.subject + '"' : ""}: "${bodyText.slice(0, 100)}${bodyText.length > 100 ? "..." : ""}"`,
          related_entity_type: "conversation",
          related_entity_id: conversation.id,
        })
        .catch((err) => this.logger.error("Error al crear notificación", err));
    }

    await this.automationsService.triggerRules(
      workspaceId,
      "MESSAGE_RECEIVED",
      "message",
      message.id,
    );

    // ── AI analysis (fire-and-forget — no bloquea la respuesta al webhook) ──
    const conversationId = conversation.id;
    const contactId = conversation.contact_id;

    this.triggerAiAnalysis(workspaceId, conversationId, contactId).catch((err) =>
      this.logger.error("Error en análisis de IA", err?.stack ?? err),
    );

    this.triggerEmrendeAutoReply(workspaceId, conversationId, bodyText).catch((err) =>
      this.logger.error("Error en auto-reply IA Emprende", err?.stack ?? err),
    );

    return { ok: true, message_id: message.id, conversation_id: conversation.id };
  }

  // ── Durable provider-backed inbound reception ──────────────────────────

  async receiveProviderInbound(params: {
    provider: string;
    workspaceId: string;
    channelPhoneNumberId: string;
    from: string;
    senderName: string;
    bodyText: string;
    providerMessageId: string;
    timestamp?: string;
    rawPayload?: Record<string, any>;
    whatsappMedia?: Record<string, any> | null;
  }): Promise<{
    status: "created" | "duplicate";
    messageId?: string;
    conversationId?: string;
    contactId?: string | null;
  }> {
    const { provider, workspaceId, from, senderName, bodyText, providerMessageId } = params;

    const existingMessage = await this.prisma.message.findFirst({
      where: {
        workspace_id: workspaceId,
        provider,
        provider_message_id: providerMessageId,
      },
      select: { id: true, conversation_id: true },
    });

    if (existingMessage) {
      if (params.whatsappMedia?.id) {
        const existing = await this.prisma.message.findFirst({
          where: { id: existingMessage.id },
          select: { raw_payload_json: true },
        });
        const existingPayload =
          (existing?.raw_payload_json as Record<string, unknown> | null) ?? {};
        const existingWm = existingPayload.whatsapp_media as { id?: string } | undefined;
        if (!existingWm?.id || existingWm.id !== params.whatsappMedia.id) {
          await this.prisma.message.update({
            where: { id: existingMessage.id },
            data: {
              raw_payload_json: {
                ...existingPayload,
                whatsapp_media: params.whatsappMedia,
              },
            },
          });
        }
      }
      return {
        status: "duplicate",
        messageId: existingMessage.id,
        conversationId: existingMessage.conversation_id,
      };
    }

    const channel = await this.whatsappService.findActiveWhatsappChannelByPhoneNumberId(
      params.channelPhoneNumberId,
      workspaceId,
    );

    if (!channel) {
      throw new Error(
        `No active WhatsApp channel for phone_number_id: ${params.channelPhoneNumberId}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let contact = await tx.contact.findFirst({
        where: {
          workspace_id: workspaceId,
          OR: [{ phone: from }, { email: from }],
        },
      });

      if (!contact) {
        contact = await tx.contact.create({
          data: {
            workspace_id: workspaceId,
            type: "LEAD",
            full_name: senderName,
            phone: from,
          },
        });
      }

      let conversation = await tx.conversation.findFirst({
        where: {
          workspace_id: workspaceId,
          channel_id: channel.id,
          contact_id: contact.id,
          status: { in: ["NEW", "OPEN", "PENDING"] },
        },
        orderBy: { last_message_at: "desc" },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            workspace_id: workspaceId,
            channel_id: channel.id,
            contact_id: contact.id,
            subject: `Mensaje de ${senderName}`,
            status: "NEW",
            priority: "MEDIUM",
          },
        });
      }

      const message = await tx.message.create({
        data: {
          workspace_id: workspaceId,
          conversation_id: conversation.id,
          direction: "INBOUND",
          sender_name: senderName,
          sender_ref: from,
          body_text: bodyText,
          raw_payload_json: {
            ...(typeof params.rawPayload === "object" ? params.rawPayload : {}),
            ...(params.whatsappMedia ? { whatsapp_media: params.whatsappMedia } : {}),
          },
          sent_at: params.timestamp ? new Date(Number(params.timestamp) * 1000) : new Date(),
          provider,
          provider_message_id: providerMessageId,
        },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { last_message_at: new Date(), updated_at: new Date() },
      });

      return { messageId: message.id, conversationId: conversation.id, contactId: contact.id };
    });

    return { status: "created", ...result };
  }

  async emitAndNotify(params: {
    workspaceId: string;
    conversationId: string;
    contactId: string | null;
    messageId: string;
    senderName: string;
    bodyText: string;
  }): Promise<void> {
    const { workspaceId, conversationId, contactId, messageId, senderName, bodyText } = params;

    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId, workspace_id: workspaceId },
        include: {
          sender_user: { select: { id: true, name: true, avatar_url: true } },
        },
      });
      if (message) {
        this.events.emitNewMessage(
          conversationId,
          workspaceId,
          this.serializeMessageForClient(message),
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `Realtime emit failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let conversation: { subject: string | null; assigned_user_id: string | null } | null = null;
    try {
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { subject: true, assigned_user_id: true },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to fetch conversation for notification: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (conversation?.assigned_user_id) {
      this.notificationsService
        .create(workspaceId, {
          user_id: conversation.assigned_user_id,
          type: "new_message",
          title: "Nuevo mensaje recibido",
          body: `Nuevo mensaje de ${senderName} en "${conversation.subject || "Sin asunto"}": "${bodyText.slice(0, 100)}${bodyText.length > 100 ? "..." : ""}"`,
          related_entity_type: "conversation",
          related_entity_id: conversationId,
        })
        .catch((err) => this.logger.error("Error al crear notificación de nuevo mensaje", err));
    }

    this.automationsService
      .triggerRules(workspaceId, "MESSAGE_RECEIVED", "message", messageId)
      .catch((err) => this.logger.error("Error triggering automation rules", err));

    this.triggerAiAnalysis(workspaceId, conversationId, contactId).catch((err) =>
      this.logger.error("Error en análisis de IA", err?.stack ?? err),
    );

    this.triggerEmrendeAutoReply(workspaceId, conversationId, bodyText).catch((err) =>
      this.logger.error("Error en auto-reply IA Emprende", err?.stack ?? err),
    );
  }

  // ── Serializer único para clientes ────────────────────────────────────────

  /**
   * Serialize a raw Prisma message into the client-facing DTO.
   *
   * Used by:
   * - GET /conversations/:id/messages (findAll)
   * - Socket message:new (via emitAndNotify / send)
   * - Socket message:media-ready
   *
   * Enriches raw payload with:
   * - has_media / media_type / media_status / media_download_url
   * - media_mime_type / media_filename / media_caption
   */
  serializeMessageForClient(msg: Record<string, any>): Record<string, any> {
    const rawPayload = msg.raw_payload_json;
    // Handle both object and string payloads (legacy stringifyJson bug)
    const payload = parseJsonValue<Record<string, any>>(rawPayload, {});

    // 1) Check whatsapp_media stored during inbound processing
    let wm = payload?.whatsapp_media;

    // 2) Legacy fallback: search in raw webhook payload
    if (!wm && payload) {
      const rawPayloadBody = payload?.raw_payload ?? payload;
      const innerMsg =
        rawPayloadBody?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ??
        (Array.isArray(rawPayloadBody?.messages) ? rawPayloadBody.messages[0] : null);
      if (innerMsg) {
        const mediaObj =
          innerMsg?.image ??
          innerMsg?.document ??
          innerMsg?.audio ??
          innerMsg?.video ??
          innerMsg?.sticker;
        if (mediaObj?.id) {
          wm = {
            whatsappMediaId: mediaObj.id,
            mediaType: innerMsg.type,
            mimeType: mediaObj.mime_type ?? null,
            filename: mediaObj.filename ?? null,
            caption: mediaObj.caption ?? null,
          };
        }
      }
    }

    // 3) Check attachments_json (MinIO-stored media from downloadInboundMediaToStorage)
    const attachments = msg.attachments_json as AttachmentEntry[] | null | undefined;
    const attachmentEntry = attachments?.[0] ?? null;

    // 4) Telegram pending: raw payload contains attachments[] but MinIO download not done yet
    const tgAtts =
      !attachmentEntry && !wm
        ? (payload?.attachments as Array<{ type: string; file_id: string }> | undefined)
        : undefined;
    const tgPending = tgAtts?.[0] ?? null;

    const mediaType =
      wm?.mediaType ?? wm?.kind ?? attachmentEntry?.type ?? msg.message_type ?? null;
    const mediaId = wm?.whatsappMediaId ?? wm?.id ?? attachmentEntry?.mediaId ?? null;
    const hasMedia = !!mediaId || !!tgPending;

    // Only return a URL when storage is ready or WhatsApp media ID is available.
    // Telegram pending has no proxiable URL until MinIO download completes.
    const downloadUrl = attachmentEntry?.storageKey
      ? `/api/conversations/messages/${msg.id}/media`
      : wm?.whatsappMediaId
        ? `/api/conversations/messages/${msg.id}/media`
        : null;

    // Build normalized attachments array
    const attachmentsList: Array<Record<string, any>> = [];

    // 1) attachments_json entries
    if (attachments) {
      for (const entry of attachments) {
        attachmentsList.push({
          id: msg.id,
          type: entry.type ?? "document",
          mimeType: entry.mimeType ?? null,
          fileName: entry.filename ?? null,
          sizeBytes: null,
          url: entry.storageKey ? `/api/conversations/messages/${msg.id}/media` : null,
          thumbnailUrl: null,
          durationMs: null,
          width: null,
          height: null,
          latitude: null,
          longitude: null,
          displayName: null,
          status: entry.storageKey ? "available" : "processing",
        });
      }
    }

    // 2) WhatsApp media — skip if attachments_json already has a storage-backed entry
    const hasStorageBacked = attachmentsList.some((a) => a.status === "available");
    if (wm && !hasStorageBacked) {
      attachmentsList.push({
        id: msg.id,
        type: wm.mediaType ?? "document",
        mimeType: wm.mimeType ?? null,
        fileName: wm.filename ?? null,
        sizeBytes: null,
        url: wm.whatsappMediaId ? `/api/conversations/messages/${msg.id}/media` : null,
        thumbnailUrl: null,
        durationMs: null,
        width: null,
        height: null,
        latitude: null,
        longitude: null,
        displayName: null,
        status: "available",
      });
    }

    // 3) Telegram pending
    if (tgPending) {
      attachmentsList.push({
        id: msg.id,
        type: tgPending.type ?? "document",
        mimeType: null,
        fileName: null,
        sizeBytes: null,
        url: null,
        thumbnailUrl: null,
        durationMs: null,
        width: null,
        height: null,
        latitude: null,
        longitude: null,
        displayName: null,
        status: "processing",
      });
    }

    return {
      id: msg.id,
      workspace_id: msg.workspace_id,
      conversation_id: msg.conversation_id,
      direction: msg.direction,
      sender_name: msg.sender_name,
      sender_ref: msg.sender_ref,
      sender_user_id: msg.sender_user_id,
      sender_user: msg.sender_user,
      body_text: msg.body_text,
      body_html: msg.body_html,
      sent_at: msg.sent_at,
      created_at: msg.created_at,
      message_type: msg.message_type,
      cost_category: msg.cost_category,
      provider: msg.provider,
      provider_message_id: msg.provider_message_id,
      delivery_status: msg.delivery_status,
      delivery_error: msg.delivery_error,
      has_media: hasMedia || !!attachmentEntry,
      media_type: mediaType,
      media_mime_type: wm?.mimeType ?? wm?.mime_type ?? attachmentEntry?.mimeType ?? null,
      media_filename: wm?.filename ?? attachmentEntry?.filename ?? null,
      media_caption: wm?.caption ?? attachmentEntry?.caption ?? null,
      media_download_url: downloadUrl,
      media_status:
        attachmentsList.length > 0
          ? attachmentsList.some((a) => a.status === "available")
            ? "available"
            : "processing"
          : hasMedia
            ? "processing"
            : "none",
      attachments: attachmentsList,
    };
  }

  // ── Proxy de media (HTTPS) ───────────────────────────────────────────────

  /**
   * Find an active conversation by contact phone number.
   * Used for typing indicator lookups from WhatsApp webhooks.
   */
  async findConversationByPhone(
    workspaceId: string,
    phone: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.conversation.findFirst({
      where: {
        workspace_id: workspaceId,
        status: { in: ['NEW', 'OPEN', 'PENDING'] },
        contact: { phone },
      },
      select: { id: true },
    });
  }

  /**
   * Download a message's stored media from MinIO/S3 and return it as a buffer
   * with content type. Used by the controller to proxy through HTTPS instead of
   * redirecting to an HTTP presigned URL (mixed-content fix).
   *
   * Returns null if the message has no storage-backed attachments (fallback to
   * Meta proxy in the controller).
   *
   * Security: validates workspace ownership before downloading.
   */
  async getMediaContent(
    messageId: string,
    workspaceId: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, workspace_id: workspaceId },
      select: { attachments_json: true },
    });
    if (!msg) return null;

    const attachments = msg.attachments_json as AttachmentEntry[] | null | undefined;
    const entry = attachments?.[0] ?? null;
    if (!entry?.storageKey) return null;

    try {
      const buffer = await this.storage.download(entry.storageKey);
      let contentType = entry.mimeType ?? null;
      if (!contentType) {
        const ext = `.${entry.storageKey.split(".").pop()?.toLowerCase() ?? ""}`;
        const MIME_MAP: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".pdf": "application/pdf",
          ".mp4": "video/mp4",
          ".mp3": "audio/mpeg",
          ".ogg": "audio/ogg",
          ".wav": "audio/wav",
          ".doc": "application/msword",
          ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".xls": "application/vnd.ms-excel",
          ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ".ppt": "application/vnd.ms-powerpoint",
          ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ".csv": "text/csv",
          ".txt": "text/plain",
          ".zip": "application/zip",
        };
        contentType = MIME_MAP[ext] ?? "application/octet-stream";
      }

      return { buffer, contentType };
    } catch (err) {
      this.logger.warn(
        `Storage download failed for key=${entry.storageKey}, falling through to WhatsApp fallback: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async triggerAiAnalysis(
    workspaceId: string,
    conversationId: string,
    contactId: string | null,
  ): Promise<void> {
    // Fetch last 10 messages of the conversation
    const recentMessages = await this.prisma.message.findMany({
      where: { conversation_id: conversationId, workspace_id: workspaceId },
      orderBy: { sent_at: "desc" },
      take: 10,
      select: {
        direction: true,
        sender_name: true,
        body_text: true,
        sent_at: true,
      },
    });

    // Reverse so messages are in chronological order for the AI prompt
    const messagesChronological = recentMessages.reverse();

    const result = await this.aiService.analyzeConversation(
      workspaceId,
      conversationId,
      messagesChronological,
    );

    if (!result) return;

    // Fetch conversation for notification context
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { subject: true, assigned_user_id: true },
    });

    // Persist only fields that exist on the current Conversation schema.
    // The AI payload can still drive follow-up task creation below.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        category: result.category,
      },
      select: { id: true },
    });

    // Create task for HIGH or CRITICAL urgency if task_title is provided
    if ((result.urgency === "HIGH" || result.urgency === "CRITICAL") && result.task_title) {
      // Map urgency to Priority enum:
      // HIGH -> MEDIUM, CRITICAL -> HIGH
      const priority: Priority = result.urgency === "CRITICAL" ? Priority.HIGH : Priority.MEDIUM;

      // Resolve workspace owner to use as the system user for task creation
      const ownerWorkspaceUser = await this.prisma.workspaceUser.findFirst({
        where: { workspace_id: workspaceId, is_owner: true },
        include: { user: true },
      });

      const systemUser: AuthUser = ownerWorkspaceUser
        ? {
            id: ownerWorkspaceUser.user.id,
            email: ownerWorkspaceUser.user.email,
            name: ownerWorkspaceUser.user.name,
            workspace_id: workspaceId,
            role: ownerWorkspaceUser.role,
            is_owner: ownerWorkspaceUser.is_owner,
            is_platform_admin: false,
          }
        : {
            id: "system",
            email: "system@PymesHub.ai",
            name: "Sistema IA",
            workspace_id: workspaceId,
            role: "OWNER",
            is_owner: true,
            is_platform_admin: false,
          };

      await this.tasksService.create(workspaceId, systemUser, {
        title: result.task_title,
        description: result.task_description ?? undefined,
        priority,
        source: "AUTOMATION",
        conversation_id: conversationId,
        contact_id: contactId ?? undefined,
      });

      this.logger.log(
        `Tarea AI creada para conversación ${conversationId} [urgencia: ${result.urgency}]`,
      );

      // Notify the assigned agent or all workspace agents
      const targetUserId = conv?.assigned_user_id;
      if (targetUserId) {
        await this.notificationsService.create(workspaceId, {
          user_id: targetUserId,
          type: "AI_TASK_CREATED",
          title: `Tarea creada por IA: ${result.task_title}`,
          body: `Urgencia ${result.urgency} detectada en conversación "${conv.subject || "Sin asunto"}". Se creó la tarea automáticamente.`,
          related_entity_type: "CONVERSATION",
          related_entity_id: conversationId,
        });
      } else {
        // No assigned agent — notify workspace owner
        if (ownerWorkspaceUser) {
          await this.notificationsService.create(workspaceId, {
            user_id: ownerWorkspaceUser.user.id,
            type: "AI_TASK_CREATED",
            title: `Tarea creada por IA: ${result.task_title}`,
            body: `Urgencia ${result.urgency} detectada en conversación "${conv?.subject || "Sin asunto"}". Se creó la tarea automáticamente.`,
            related_entity_type: "CONVERSATION",
            related_entity_id: conversationId,
          });
        }
      }
    }
  }

  private async triggerEmrendeAutoReply(
    workspaceId: string,
    conversationId: string,
    inboundText: string,
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true, settings_json: true },
    });
    if (!workspace) return;

    const settings = (workspace.settings_json as Record<string, unknown>) ?? {};
    if (!settings.ai_auto_reply_enabled) return;

    // Only EMPRENDE+ plans
    const EMPRENDE_PLUS = ["EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
    if (!EMPRENDE_PLUS.includes(workspace.plan)) return;

    // Check conversation ai_state — skip if human has taken over
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata_json: true, channel_id: true },
    });
    if (!conv) return;

    const meta = (conv.metadata_json as Record<string, unknown>) ?? {};
    if (meta.ai_state === "HUMAN_ACTIVE") return;

    // Throttle: don't reply again within 30 seconds
    const lastAiReply = meta.last_ai_reply_at as string | undefined;
    if (lastAiReply && Date.now() - new Date(lastAiReply).getTime() < 30_000) return;

    const replyText = await this.emprendeAiService.generateReply(
      workspaceId,
      conversationId,
      inboundText,
    );
    if (!replyText) return;

    // Store AI reply as outbound message
    const aiMessage = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_name: "Asistente IA",
        sender_ref: "ai@emprende",
        body_text: replyText,
        sent_at: new Date(),
        delivery_status: "SENT",
        message_type: "TEXT",
        has_media: false,
        media_status: "NONE",
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        last_message_at: new Date(),
        updated_at: new Date(),
        metadata_json: {
          ...meta,
          ai_state: "AI_ACTIVE",
          last_ai_reply_at: new Date().toISOString(),
        },
      },
      select: { id: true },
    });

    this.events.emitNewMessage(conversationId, workspaceId, this.serializeMessageForClient(aiMessage));

    this.logger.log(`EmrendeAI auto-reply sent to conversation ${conversationId}`);
  }
}
