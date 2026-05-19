import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ConversationsService } from './conversations.service';
import { EventsGateway } from '../gateways/events.gateway';
import { AiService } from '../ai/ai.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Priority } from '@prisma/client';
import { AutomationsService } from '../automations/automations.service';
import { stringifyJson } from '../common/prisma/json';
import { StorageService } from '../common/storage/storage.service';

interface AttachmentEntry {
  provider: string;
  mediaId: string;
  storageKey: string;
  mimeType: string;
  size: number;
  type: string;
  filename: string | null;
  caption: string | null;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly events: EventsGateway,
    private readonly aiService: AiService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
    private readonly automationsService: AutomationsService,
    private readonly storage: StorageService,
  ) { }

  async findAll(workspaceId: string, conversationId: string, page = 1, limit = 50) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada.');

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversation_id: conversationId, workspace_id: workspaceId },
        skip,
        take: limit,
        orderBy: { sent_at: 'asc' },
        include: {
          sender_user: { select: { id: true, name: true, avatar_url: true } },
        },
      }),
      this.prisma.message.count({
        where: { conversation_id: conversationId },
      }),
    ]);

    return {
      data: data.map((m) => this.serializeMessageForClient(m)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async send(
    workspaceId: string,
    conversationId: string,
    user: AuthUser,
    dto: SendMessageDto,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada.');

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: dto.direction ?? 'OUTBOUND',
        sender_user_id: user.id,
        sender_name: user.name,
        sender_ref: user.email,
        body_text: dto.body_text,
        body_html: dto.body_html,
        sent_at: new Date(),
      },
      include: {
        sender_user: { select: { id: true, name: true, avatar_url: true } },
      },
    });

    await this.conversationsService.touchLastMessage(conversationId);

    // Emitir en tiempo real
    this.events.emitNewMessage(conversationId, workspaceId, message);

    return message;
  }

  async receiveInbound(
    provider: string,
    workspaceId: string,
    payload: Record<string, any>,
  ) {
    const explicitChannelId = typeof payload.channel_id === 'string' ? payload.channel_id : undefined;
    const channel = explicitChannelId
      ? await this.prisma.channel.findFirst({
          where: { id: explicitChannelId, workspace_id: workspaceId, status: 'ACTIVE' },
        })
      : await this.prisma.channel.findFirst({
          where: { workspace_id: workspaceId, provider, status: 'ACTIVE' },
        });
    if (!channel) {
      return { ok: false, reason: 'No active channel for provider' };
    }

    const senderRef = payload.from ?? payload.sender ?? 'unknown';
    const senderName = payload.name ?? payload.sender_name ?? senderRef;
    const bodyText = payload.text ?? payload.body ?? payload.content ?? '';
    const subject = payload.subject ?? null;

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        workspace_id: workspaceId,
        channel_id: channel.id,
        status: { in: ['NEW', 'OPEN', 'PENDING'] },
        contact: {
          OR: [
            { email: senderRef },
            { phone: senderRef },
          ],
        },
      },
      orderBy: { last_message_at: 'desc' },
    });

    if (!conversation) {
      let contact = await this.prisma.contact.findFirst({
        where: {
          workspace_id: workspaceId,
          OR: [{ email: senderRef }, { phone: senderRef }],
        },
      });

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            workspace_id: workspaceId,
            type: 'LEAD',
            full_name: senderName,
            email: senderRef.includes('@') ? senderRef : undefined,
            phone: !senderRef.includes('@') ? senderRef : undefined,
          },
        });
      }

      conversation = await this.prisma.conversation.create({
        data: {
          workspace_id: workspaceId,
          channel_id: channel.id,
          contact_id: contact.id,
          subject: subject ?? `Mensaje de ${senderName}`,
          status: 'NEW',
          priority: 'MEDIUM',
        },
      });
    }

    const messageType = typeof payload.message_type === 'string' ? payload.message_type : null;
    const telegramMessageId = typeof payload.telegram_message_id === 'string' ? payload.telegram_message_id : null;
    const telegramChatId = typeof payload.telegram_chat_id === 'string' ? payload.telegram_chat_id : null;
    const telegramUserId = typeof payload.telegram_user_id === 'string' ? payload.telegram_user_id : null;

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        direction: 'INBOUND',
        sender_name: senderName,
        sender_ref: senderRef,
        body_text: bodyText,
        body_html: payload.body_html ?? payload.html ?? null,
        raw_payload_json: stringifyJson(payload),
        message_type: messageType,
        telegram_message_id: telegramMessageId,
        telegram_chat_id: telegramChatId,
        telegram_user_id: telegramUserId,
        sent_at: new Date(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { last_message_at: new Date(), updated_at: new Date() },
    });

    // Emitir en tiempo real (con campos de media enriquecidos)
    this.events.emitNewMessage(conversation.id, workspaceId, this.serializeMessageForClient(message));

    // Notificar al agente asignado sobre nuevo mensaje
    if (conversation.assigned_user_id) {
      this.notificationsService.create(workspaceId, {
        user_id: conversation.assigned_user_id,
        type: 'new_message',
        title: 'Nuevo mensaje recibido',
        body: `Nuevo mensaje de ${senderName} en "${conversation.subject || 'Sin asunto'}": "${bodyText.slice(0, 100)}${bodyText.length > 100 ? '...' : ''}"`,
        related_entity_type: 'conversation',
        related_entity_id: conversation.id,
      }).catch((err) => this.logger.error('Error al crear notificación de nuevo mensaje', err));
    }

    await this.automationsService.triggerRules(
      workspaceId,
      'MESSAGE_RECEIVED',
      'message',
      message.id,
    );

    // ── AI analysis (fire-and-forget — no bloquea la respuesta al webhook) ──
    const conversationId = conversation.id;
    const contactId = conversation.contact_id;

    this.triggerAiAnalysis(workspaceId, conversationId, contactId).catch(
      (err) => this.logger.error('Error en análisis de IA', err?.stack ?? err),
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
    rawPayload?: any;
  }): Promise<{
    status: 'created' | 'duplicate';
    messageId?: string;
    conversationId?: string;
    contactId?: string | null;
  }> {
    const { provider, workspaceId, from, senderName, bodyText, providerMessageId } = params;

    // Idempotency check: if this exact provider message already exists, skip
    const existingMessage = await this.prisma.message.findFirst({
      where: {
        workspace_id: workspaceId,
        provider,
        provider_message_id: providerMessageId,
      },
      select: { id: true, conversation_id: true },
    });

    if (existingMessage) {
      return {
        status: 'duplicate',
        messageId: existingMessage.id,
        conversationId: existingMessage.conversation_id,
      };
    }

    // Resolve channel from phone_number_id
    const channel = await this.prisma.channel.findFirst({
      where: {
        type: 'WHATSAPP',
        config_json: { path: ['phone_number_id'], equals: params.channelPhoneNumberId },
        workspace_id: workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!channel) {
      throw new Error(`No active WhatsApp channel for phone_number_id: ${params.channelPhoneNumberId}`);
    }

    // ── Transactional persistence: contact, conversation, message ──
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert contact
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
            type: 'LEAD',
            full_name: senderName,
            phone: from,
          },
        });
      }

      // Find existing open conversation for this contact + channel
      let conversation = await tx.conversation.findFirst({
        where: {
          workspace_id: workspaceId,
          channel_id: channel.id,
          contact_id: contact.id,
          status: { in: ['NEW', 'OPEN', 'PENDING'] },
        },
        orderBy: { last_message_at: 'desc' },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            workspace_id: workspaceId,
            channel_id: channel.id,
            contact_id: contact.id,
            subject: `Mensaje de ${senderName}`,
            status: 'NEW',
            priority: 'MEDIUM',
          },
        });
      }

      // Insert message with provider idempotency key
      const message = await tx.message.create({
        data: {
          workspace_id: workspaceId,
          conversation_id: conversation.id,
          direction: 'INBOUND',
          sender_name: senderName,
          sender_ref: from,
          body_text: bodyText,
          raw_payload_json: params.rawPayload ?? undefined,
          sent_at: params.timestamp ? new Date(Number(params.timestamp) * 1000) : new Date(),
          provider,
          provider_message_id: providerMessageId,
        },
      });

      // Bump conversation last_message_at
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { last_message_at: new Date(), updated_at: new Date() },
      });

      return { messageId: message.id, conversationId: conversation.id, contactId: contact.id };
    });

    return { status: 'created', ...result };
  }

  // ── Secondary tasks (fire-and-forget, must not block message persistence) ──

  async emitAndNotify(params: {
    workspaceId: string;
    conversationId: string;
    contactId: string | null;
    messageId: string;
    senderName: string;
    bodyText: string;
  }): Promise<void> {
    const { workspaceId, conversationId, contactId, messageId, senderName, bodyText } = params;

    // Emit realtime
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          sender_user: { select: { id: true, name: true, avatar_url: true } },
        },
      });
      if (message) {
        this.events.emitNewMessage(conversationId, workspaceId, message);
      }
    } catch (err) {
      this.logger.error(`Realtime emit failed: ${err?.message}`);
    }

    // Fetch conversation for notification context
    let conversation: any = null;
    try {
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { subject: true, assigned_user_id: true },
      });
    } catch (err) {
      this.logger.error(`Failed to fetch conversation for notification: ${err?.message}`);
    }

    // Notify assigned agent
    if (conversation?.assigned_user_id) {
      this.notificationsService
        .create(workspaceId, {
          user_id: conversation.assigned_user_id,
          type: 'new_message',
          title: 'Nuevo mensaje recibido',
          body: `Nuevo mensaje de ${senderName} en "${conversation.subject || 'Sin asunto'}": "${bodyText.slice(0, 100)}${bodyText.length > 100 ? '...' : ''}"`,
          related_entity_type: 'conversation',
          related_entity_id: conversationId,
        })
        .catch((err) =>
          this.logger.error('Error al crear notificación de nuevo mensaje', err),
        );
    }

    // Trigger automation rules
    this.automationsService
      .triggerRules(workspaceId, 'MESSAGE_RECEIVED', 'message', messageId)
      .catch((err) => this.logger.error('Error triggering automation rules', err));

    // AI analysis (fire-and-forget)
    this.triggerAiAnalysis(workspaceId, conversationId, contactId).catch(
      (err) => this.logger.error('Error en análisis de IA', err?.stack ?? err),
    );
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
      orderBy: { sent_at: 'desc' },
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
    });

    // Create task for HIGH or CRITICAL urgency if task_title is provided
    if (
      (result.urgency === 'HIGH' || result.urgency === 'CRITICAL') &&
      result.task_title
    ) {
      // Map urgency to Priority enum:
      // HIGH -> MEDIUM, CRITICAL -> HIGH
      const priority: Priority =
        result.urgency === 'CRITICAL' ? Priority.HIGH : Priority.MEDIUM;

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
            id: 'system',
            email: 'system@pymeshub.ai',
            name: 'Sistema IA',
            workspace_id: workspaceId,
            role: 'OWNER',
            is_owner: true,
            is_platform_admin: false,
          };

      await this.tasksService.create(workspaceId, systemUser, {
        title: result.task_title,
        description: result.task_description ?? undefined,
        priority: priority as any,
        source: 'AUTOMATION' as any,
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
          type: 'AI_TASK_CREATED',
          title: `Tarea creada por IA: ${result.task_title}`,
          body: `Urgencia ${result.urgency} detectada en conversación "${conv.subject || 'Sin asunto'}". Se creó la tarea automáticamente.`,
          related_entity_type: 'CONVERSATION',
          related_entity_id: conversationId,
        });
      } else {
        // No assigned agent — notify workspace owner
        if (ownerWorkspaceUser) {
          await this.notificationsService.create(workspaceId, {
            user_id: ownerWorkspaceUser.user.id,
            type: 'AI_TASK_CREATED',
            title: `Tarea creada por IA: ${result.task_title}`,
            body: `Urgencia ${result.urgency} detectada en conversación "${conv?.subject || 'Sin asunto'}". Se creó la tarea automáticamente.`,
            related_entity_type: 'CONVERSATION',
            related_entity_id: conversationId,
          });
        }
      }
    }
  }

  // ── Serializer para el cliente ─────────────────────────────────────────────

  /**
   * Enriquece un mensaje Prisma con campos de media derivados de raw_payload_json
   * y attachments_json (MinIO). Único punto de serialización para socket y REST.
   */
  serializeMessageForClient(msg: Record<string, unknown>): Record<string, unknown> {
    const payload = msg.raw_payload_json as Record<string, unknown> | null | undefined;

    // 1) WhatsApp media — stored as whatsapp_media in raw_payload_json
    const wm = payload?.whatsapp_media as Record<string, unknown> | undefined;

    // 2) Telegram attachments — stored as attachments array in raw_payload_json
    const tgAttachments = payload?.attachments as Array<{ type: string; file_id: string; file_name?: string }> | undefined;
    const tgMedia = !wm ? tgAttachments?.[0] : undefined;

    // 3) MinIO-stored attachment (already downloaded)
    const storedAttachments = msg.attachments_json as unknown as AttachmentEntry[] | null | undefined;
    const attachmentEntry = storedAttachments?.[0] ?? null;

    const mediaId = (wm?.whatsappMediaId ?? wm?.id ?? attachmentEntry?.mediaId ?? tgMedia?.file_id) as string | undefined;
    const hasMedia = !!mediaId;

    const mediaType = (wm?.mediaType ?? wm?.kind ?? attachmentEntry?.type ?? tgMedia?.type ?? null) as string | null;
    const mimeType = (wm?.mimeType ?? wm?.mime_type ?? attachmentEntry?.mimeType ?? null) as string | null;
    const filename = (wm?.filename ?? attachmentEntry?.filename ?? tgMedia?.file_name ?? null) as string | null;
    const caption = (wm?.caption ?? attachmentEntry?.caption ?? null) as string | null;

    // Only provide download URL when:
    // - Media is in MinIO (storageKey exists), OR
    // - WhatsApp media ID is available (can proxy from Meta API)
    // Telegram media has no external fallback — URL only available after download to MinIO
    const downloadUrl = attachmentEntry?.storageKey
      ? `/api/conversations/messages/${msg.id as string}/media`
      : wm?.whatsappMediaId
        ? `/api/conversations/messages/${msg.id as string}/media`
        : null;

    const mediaStatus = attachmentEntry?.storageKey
      ? 'available'
      : hasMedia
        ? 'processing'
        : 'none';

    return {
      ...msg,
      has_media: hasMedia || !!attachmentEntry,
      media_type: mediaType,
      media_mime_type: mimeType,
      media_filename: filename,
      media_caption: caption,
      media_download_url: downloadUrl,
      media_status: mediaStatus,
    };
  }

  // ── Proxy de media almacenada ──────────────────────────────────────────────

  /**
   * Descarga un archivo almacenado en MinIO/local para un mensaje.
   * Retorna null si el mensaje no tiene media almacenada todavía.
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

    const attachments = msg.attachments_json as unknown as AttachmentEntry[] | null | undefined;
    const entry = attachments?.[0] ?? null;
    if (!entry?.storageKey) return null;

    const result = await this.storage.read(entry.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as string));
    }
    const buffer = Buffer.concat(chunks);

    const MIME: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.oga': 'audio/ogg',
      '.m4a': 'audio/mp4', '.amr': 'audio/amr',
    };
    const ext = '.' + (entry.storageKey.split('.').pop()?.toLowerCase() ?? '');
    const contentType = entry.mimeType || MIME[ext] || 'application/octet-stream';

    return { buffer, contentType };
  }
}
