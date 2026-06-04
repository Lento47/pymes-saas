import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from "@nestjs/common";
import { ChannelType, ConversationStatus, InvoiceStatus, WorkspaceUserRole } from "@prisma/client";
import { AiService } from "../ai/ai.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { ConversationsService } from "../conversations/conversations.service";
import { MessagesService } from "../conversations/messages.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { SendReminderDto } from "./dto/send-reminder.dto";

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly notificationsService: NotificationsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async detectOverdue(workspaceId: string) {
    const now = new Date();

    const updated = await this.prisma.invoice.updateMany({
      where: {
        workspace_id: workspaceId,
        status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        due_date: { lt: now },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    if (updated.count > 0) {
      const admins = await this.prisma.workspaceUser.findMany({
        where: { workspace_id: workspaceId, role: { in: [WorkspaceUserRole.OWNER] } },
        select: { user_id: true },
        take: 3,
      });
      const notified = new Set<string>();
      for (const admin of admins) {
        if (notified.has(admin.user_id)) continue;
        notified.add(admin.user_id);
        this.notificationsService
          .create(workspaceId, {
            user_id: admin.user_id,
            type: "invoice_overdue",
            title: "Facturas vencidas detectadas",
            body: `${updated.count} factura(s) fueron marcadas como vencidas. Revisa el módulo de facturación.`,
            related_entity_type: "invoice",
            related_entity_id: undefined,
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to notify admin about overdue invoices in workspace ${workspaceId}`,
              err,
            ),
          );
      }
    }

    return this.prisma.invoice.findMany({
      where: {
        workspace_id: workspaceId,
        status: InvoiceStatus.OVERDUE,
      },
      take: 100,
      include: {
        contact: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        payments: {
          take: 10,
        },
        reminders: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
      orderBy: { due_date: "asc" },
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
        lines: {
          include: { product: { select: { name: true } } },
        },
      },
    });

    if (!invoice) throw new NotFoundException("Factura no encontrada.");
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("Solo se puede enviar una factura que tenga saldo pendiente.");
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
      orderBy: { created_at: "desc" },
    });

    if (existing) return existing;

    const amountPaid = (invoice.payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const balanceDue = Math.max(0, Number(invoice.amount) - amountPaid);
    if (balanceDue <= 0) {
      throw new BadRequestException("La factura no tiene saldo pendiente para enviar.");
    }

    const daysOverdue = invoice.due_date
      ? Math.max(0, Math.floor((Date.now() - invoice.due_date.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const aiResult = await this.aiService.generatePaymentReminderDraft({
      workspaceId,
      customerName: invoice.contact.full_name,
      currency: invoice.currency,
      amount: balanceDue.toFixed(2),
      invoiceNumber: invoice.number,
      daysOverdue,
    });

    let draftText = aiResult.draft_text;
    if (invoice.lines?.length > 0) {
      const items = invoice.lines
        .map(
          (l) =>
            `- ${l.quantity}x ${(l as { product?: { name?: string } }).product?.name || l.description} — ${new Intl.NumberFormat("es-CR", { style: "currency", currency: invoice.currency }).format(Number(l.total_line_amount))}`,
        )
        .join("\n");
      draftText += `\n\n📦 Productos:\n${items}`;
    }

    return this.prisma.paymentReminder.create({
      data: {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        draft_text: draftText,
        tokens_used: aiResult.tokens_used,
      },
    });
  }

  async sendReminder(workspaceId: string, invoiceId: string, dto: SendReminderDto, user: AuthUser) {
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

    if (!invoice) throw new NotFoundException("Factura no encontrada.");

    const reminder = await this.prisma.paymentReminder.findFirst({
      where: {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        sent_at: null,
      },
      orderBy: { created_at: "desc" },
    });

    if (!reminder) {
      throw new BadRequestException("No existe un borrador pendiente para esta factura.");
    }

    const channel = await this.prisma.channel.findFirst({
      where: {
        id: dto.channel_id,
        workspace_id: workspaceId,
        status: "ACTIVE",
      },
    });

    if (!channel) throw new NotFoundException("Canal no encontrado o inactivo.");

    if (channel.type === ChannelType.EMAIL && !invoice.contact.email) {
      throw new BadRequestException("El contacto no tiene email para enviar el recordatorio.");
    }

    if (channel.type === ChannelType.WHATSAPP && !invoice.contact.phone) {
      throw new BadRequestException("El contacto no tiene teléfono para enviar el recordatorio.");
    }

    const conversation = await this.findOrCreateConversation(
      workspaceId,
      invoice.contact.id,
      channel.id,
      invoice.number,
    );

    const finalDraft = dto.draft_text?.trim() || reminder.draft_text;

    // Create the message record in DB
    const message = await this.messagesService.send(workspaceId, conversation.id, user, {
      direction: "OUTBOUND",
      body_text: finalDraft,
    });

    // ── Dispatch to external channel ──────────────────────────────────────
    if (channel.type === ChannelType.WHATSAPP && invoice.contact.phone) {
      try {
        const to = invoice.contact.phone.replace(/\D/g, "");

        // Resolve workspace name for {{6}}
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });

        // Format amount: "₡45,000.00"
        const amountFormatted = new Intl.NumberFormat("es-CR", {
          style: "currency",
          currency: invoice.currency,
        }).format(Number(invoice.amount));

        // Format due date: "15 de junio, 2026"
        const dueDateFormatted = invoice.due_date
          ? new Intl.DateTimeFormat("es-CR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(invoice.due_date))
          : "—";

        // Extract products summary from the draft text if present
        const draftLines = finalDraft.split("\n");
        const productsIdx = draftLines.findIndex((l: string) => l.includes("📦"));
        const productsSummary =
          productsIdx >= 0
            ? draftLines
                .slice(productsIdx + 1)
                .filter((l: string) => l.trim().startsWith("-"))
                .join("\n")
                .substring(0, 400)
            : "Ver detalle en el enlace";

        const waResult = await this.whatsAppService.sendInvoiceTemplate(
          channel,
          to,
          {
            customerName: invoice.contact.full_name,
            invoiceNumber: invoice.number,
            amountFormatted,
            dueDateFormatted,
            productsSummary,
            companyName: workspace?.name ?? "PymesHub",
          },
        );

        // Link the external message ID for delivery status tracking
        await this.prisma.message.update({
          where: { id: message.id },
          data: { external_message_id: waResult.message_id },
        });
      } catch (err: any) {
        this.logger.error(
          `WhatsApp invoice template dispatch failed for invoice ${invoice.number}: ${err?.message}`,
        );
      }
    }

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
        status: {
          in: [ConversationStatus.NEW, ConversationStatus.OPEN, ConversationStatus.PENDING],
        },
      },
      orderBy: { last_message_at: "desc" },
    });

    if (existing) return existing;

    return this.conversationsService.create(workspaceId, {
      channel_id: channelId,
      contact_id: contactId,
      subject: `Recordatorio de pago ${invoiceNumber}`,
    });
  }
}
