import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChannelType, ConversationStatus, InvoiceStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../conversations/messages.service';
import { SendReminderDto } from './dto/send-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  async detectOverdue(workspaceId: string) {
    const now = new Date();

    await this.prisma.invoice.updateMany({
      where: {
        workspace_id: workspaceId,
        status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        due_date: { lt: now },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    return this.prisma.invoice.findMany({
      where: {
        workspace_id: workspaceId,
        status: InvoiceStatus.OVERDUE,
      },
      include: {
        contact: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        payments: true,
        reminders: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { due_date: 'asc' },
    });
  }

  async generateReminder(workspaceId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspace_id: workspaceId },
      include: {
        contact: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        payments: true,
      },
    });

    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    if (invoice.status !== InvoiceStatus.OVERDUE) {
      throw new BadRequestException('Solo se generan recordatorios para facturas vencidas.');
    }

    const existing = await this.prisma.paymentReminder.findFirst({
      where: {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        sent_at: null,
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (existing) return existing;

    const daysOverdue = Math.max(
      1,
      Math.floor((Date.now() - invoice.due_date.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const amountPaid = (invoice.payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const balanceDue = Math.max(0, Number(invoice.amount) - amountPaid);

    const aiResult = await this.aiService.generatePaymentReminderDraft({
      workspaceId,
      customerName: invoice.contact.full_name,
      currency: invoice.currency,
      amount: balanceDue.toFixed(2),
      invoiceNumber: invoice.number,
      daysOverdue,
    });

    return this.prisma.paymentReminder.create({
      data: {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        draft_text: aiResult.draft_text,
        tokens_used: aiResult.tokens_used,
      },
    });
  }

  async sendReminder(
    workspaceId: string,
    invoiceId: string,
    dto: SendReminderDto,
    user: AuthUser,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspace_id: workspaceId },
      include: {
        contact: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Factura no encontrada.');

    const reminder = await this.prisma.paymentReminder.findFirst({
      where: {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        sent_at: null,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!reminder) {
      throw new BadRequestException('No existe un borrador pendiente para esta factura.');
    }

    const channel = await this.prisma.channel.findFirst({
      where: {
        id: dto.channel_id,
        workspace_id: workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!channel) throw new NotFoundException('Canal no encontrado o inactivo.');

    if (channel.type === ChannelType.EMAIL && !invoice.contact.email) {
      throw new BadRequestException('El contacto no tiene email para enviar el recordatorio.');
    }

    if (channel.type === ChannelType.WHATSAPP && !invoice.contact.phone) {
      throw new BadRequestException('El contacto no tiene teléfono para enviar el recordatorio.');
    }

    const conversation = await this.findOrCreateConversation(
      workspaceId,
      invoice.contact.id,
      channel.id,
      invoice.number,
    );

    const finalDraft = dto.draft_text?.trim() || reminder.draft_text;

    const message = await this.messagesService.send(
      workspaceId,
      conversation.id,
      user,
      {
        direction: 'OUTBOUND',
        body_text: finalDraft,
      },
    );

    const updatedReminder = await this.prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: {
        draft_text: finalDraft,
        sent_at: new Date(),
        sent_via: channel.id,
        approved_by: user.id,
      },
    });

    return {
      reminder: updatedReminder,
      conversation_id: conversation.id,
      message_id: message.id,
    };
  }

  private async findOrCreateConversation(
    workspaceId: string,
    contactId: string,
    channelId: string,
    invoiceNumber: string,
  ) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        workspace_id: workspaceId,
        contact_id: contactId,
        channel_id: channelId,
        status: { in: [ConversationStatus.NEW, ConversationStatus.OPEN, ConversationStatus.PENDING] },
      },
      orderBy: { last_message_at: 'desc' },
    });

    if (existing) return existing;

    return this.conversationsService.create(workspaceId, {
      channel_id: channelId,
      contact_id: contactId,
      subject: `Recordatorio de pago ${invoiceNumber}`,
    });
  }
}
