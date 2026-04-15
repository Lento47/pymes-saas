import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ConversationsService } from './conversations.service';
import { EventsGateway } from '../gateways/events.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly events: EventsGateway,
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
      data,
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
    const channel = await this.prisma.channel.findFirst({
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

    const message = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        direction: 'INBOUND',
        sender_name: senderName,
        sender_ref: senderRef,
        body_text: bodyText,
        raw_payload_json: payload,
        sent_at: new Date(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { last_message_at: new Date(), updated_at: new Date() },
    });

    // Emitir en tiempo real
    this.events.emitNewMessage(conversation.id, workspaceId, message);

    return { ok: true, message_id: message.id, conversation_id: conversation.id };
  }
}
