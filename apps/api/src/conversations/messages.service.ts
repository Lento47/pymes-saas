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
import { RoutingService } from '../routing/routing.service';

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
    private readonly routingService: RoutingService,
  ) { }

  async findAll(workspaceId: string, conversationId: string, page = 1, limit = 100) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { id: true },
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
        where: { conversation_id: conversationId, workspace_id: workspaceId },
      }),
    ]);

    const enriched = data.map((msg) => {
      const rawPayload = (msg as any).raw_payload_json;
      // Handle both object and string payloads (legacy stringifyJson bug)
      const payload = typeof rawPayload === 'string' ? (() => { try { return JSON.parse(rawPayload); } catch { return {}; } })() : (rawPayload || {});

      // 1) Check whatsapp_media stored during inbound processing
      let wm = payload?.whatsapp_media;

      // 2) Legacy fallback: search in raw webhook payload
      if (!wm && payload) {
        const rawPayloadBody = payload?.raw_payload ?? payload;
        const innerMsg = rawPayloadBody?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
          ?? (Array.isArray(rawPayloadBody?.messages) ? rawPayloadBody.messages[0] : null);
        if (innerMsg) {
          const mediaObj = innerMsg?.image ?? innerMsg?.document ?? innerMsg?.audio ?? innerMsg?.video ?? innerMsg?.sticker;
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
      const attachments = (msg as any).attachments_json as any[] | null | undefined;
      const attachmentEntry = attachments?.[0] ?? null;

      const mediaType = wm?.mediaType ?? wm?.kind ?? attachmentEntry?.type ?? null;
      const mediaId = wm?.whatsappMediaId ?? wm?.id ?? attachmentEntry?.mediaId ?? null;
      const hasMedia = !!mediaId;

      // Prefer MinIO storage URL over Meta proxy
      const storageUrl = attachmentEntry?.storageKey
        ? `/api/conversations/messages/${msg.id}/media`
        : null;
      const downloadUrl = hasMedia ? `/api/conversations/messages/${msg.id}/media` : null;

      return {
        ...msg,
        has_media: hasMedia || !!attachmentEntry,
        media_type: mediaType,
        media_mime_type: wm?.mimeType ?? wm?.mime_type ?? attachmentEntry?.mimeType ?? null,
        media_filename: wm?.filename ?? attachmentEntry?.filename ?? null,
        media_caption: wm?.caption ?? attachmentEntry?.caption ?? null,
        media_download_url: downloadUrl,
        media_status: hasMedia || !!attachmentEntry ? 'available' : 'missing',
      };
    });

    this.logger.log(`findAll messages: conv=${conversationId}, count=${total}, returned=${enriched.length}`);

    return {
      data: enriched,
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
      select: { id: true },
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
        message_type: (dto as any).media_type || undefined,
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
    const isEmail = senderRef.includes('@');
    const normalizedPhone = !isEmail ? senderRef.replace(/\D/g, '') : null;

    // ── Find or create contact (normalize phone to prevent duplicates) ─────────
    let contact = null;
    if (isEmail) {
      contact = await this.prisma.contact.findFirst({
        where: { workspace_id: workspaceId, email: senderRef },
      });
    } else if (normalizedPhone) {
      const contactRows = await (this.prisma as any).$queryRawUnsafe(
        `SELECT * FROM "contacts"
         WHERE workspace_id = $1
           AND (phone = $2 OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $3)
         LIMIT 1`,
        workspaceId, senderRef, normalizedPhone,
      );
      if (contactRows.length > 0) contact = contactRows[0];
    }

    if (contact) {
      // Auto-update name for LEAD contacts created from incoming messages
      const contactUpdates: any = {};
      if (contact.type === 'LEAD' && contact.full_name !== senderName) {
        contactUpdates.full_name = senderName;
      }
      // Store Telegram chat_id if not already set
      const tgChatId = (payload as any).telegram_chat_id;
      if (tgChatId && !(contact as any).telegram_chat_id) {
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
          type: 'LEAD',
          full_name: senderName,
          email: isEmail ? senderRef : undefined,
          phone: !isEmail ? senderRef : undefined,
          telegram_chat_id: (payload as any).telegram_chat_id || undefined,
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
      orderBy: { last_message_at: 'desc' },
      select: {
        id: true, assigned_user_id: true, subject: true,
        contact_id: true, first_response_at: true, status: true,
        workspace_id: true, channel_id: true,
      },
    });

    if (conversation) {
      // If the conversation was previously resolved, reopen it
      if (!['NEW', 'OPEN', 'PENDING'].includes(conversation.status)) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'NEW', updated_at: new Date() },
        });
        conversation.status = 'NEW';
      }
    } else {
      conversation = await this.prisma.conversation.create({
        data: {
          workspace_id: workspaceId,
          channel_id: channel.id,
          contact_id: contact.id,
          subject: subject ?? `Mensaje de ${senderName}`,
          status: 'NEW',
          priority: 'MEDIUM',
        },
        select: {
          id: true, assigned_user_id: true, subject: true,
          contact_id: true, first_response_at: true,
          workspace_id: true, channel_id: true, status: true,
        },
      });
    }

    // Auto-route new conversation to department based on routing rules
    const route = await this.routingService.resolveQueue(workspaceId, channel.id, bodyText);
    if (route) {
      const member = await this.prisma.departmentMember.findFirst({
        where: { department_id: route.department_id, workspace_id: workspaceId },
        orderBy: { is_lead: 'desc' },
        select: { user_id: true },
      });
      const updateData: any = {
        department_id: route.department_id,
        ...(member ? { assigned_user_id: member.user_id } : {}),
      };
      if (route.set_priority) updateData.priority = route.set_priority;
      const updated = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: updateData,
        select: {
          id: true, assigned_user_id: true, subject: true,
          contact_id: true, first_response_at: true,
          workspace_id: true, channel_id: true, status: true,
          priority: true,
        },
      });
      conversation = updated;
    }

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        direction: 'INBOUND',
        sender_name: senderName,
        sender_ref: senderRef,
        body_text: bodyText,
        body_html: payload.body_html ?? payload.html ?? null,
        raw_payload_json: payload as any,
        sent_at: new Date(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        last_message_at: new Date(),
        updated_at: new Date(),
        // WhatsApp 24h service window tracking (safe if columns exist, skipped otherwise)
        ...(channel.type === 'WHATSAPP'
          ? {
              last_customer_message_at: new Date(),
              service_window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
              is_service_window_open: true,
              requires_template_for_outbound: false,
            }
          : {}),
        // Set first_response_at on first agent outbound reply
        ...(message.direction === 'OUTBOUND' && !conversation.first_response_at
          ? { first_response_at: new Date() }
          : {}),
      },
      select: { id: true },
    }).catch((err: any) => {
      // Silently skip if columns don't exist yet (migration pending)
      if (err?.code === 'P2025' || err?.message?.includes('column')) {
        // Fallback: update only existing columns
        return this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { last_message_at: new Date(), updated_at: new Date() },
          select: { id: true },
        });
      }
      throw err;
    });

    // Emitir en tiempo real
    this.events.emitNewMessage(conversation.id, workspaceId, message);

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
    whatsappMedia?: any | null;
  }): Promise<{
    status: 'created' | 'duplicate';
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
        const existingPayload = (existing?.raw_payload_json as any) ?? {};
        if (!existingPayload.whatsapp_media?.id || existingPayload.whatsapp_media.id !== params.whatsappMedia.id) {
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
        status: 'duplicate',
        messageId: existingMessage.id,
        conversationId: existingMessage.conversation_id,
      };
    }

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
            type: 'LEAD',
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

      const message = await tx.message.create({
        data: {
          workspace_id: workspaceId,
          conversation_id: conversation.id,
          direction: 'INBOUND',
          sender_name: senderName,
          sender_ref: from,
          body_text: bodyText,
          raw_payload_json: {
            ...(typeof params.rawPayload === 'object' ? params.rawPayload : {}),
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

    return { status: 'created', ...result };
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

    let conversation: any = null;
    try {
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { subject: true, assigned_user_id: true },
      });
    } catch (err) {
      this.logger.error(`Failed to fetch conversation for notification: ${err?.message}`);
    }

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

    this.automationsService
      .triggerRules(workspaceId, 'MESSAGE_RECEIVED', 'message', messageId)
      .catch((err) => this.logger.error('Error triggering automation rules', err));

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
      select: { id: true },
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
            email: 'system@PymesHub.ai',
            name: 'Sistema IA',
            workspace_id: workspaceId,
            role: 'OWNER',
            is_owner: true,
            is_platform_admin: false,
          };

      await this.tasksService.create(workspaceId, systemUser, {
        title: result.task_title,
        description: result.task_description ?? undefined,
        priority,
        source: 'AUTOMATION',
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
}
