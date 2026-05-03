import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HaciendaStatus,
  InvoiceDocumentType,
  InvoiceIssuanceMode,
  InvoiceStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parseJsonValue } from '../common/prisma/json';
import { StorageService } from '../common/storage/storage.service';
import { HaciendaRecepcionService } from '../hacienda/hacienda-recepcion.service';
import { HaciendaSigningService } from '../hacienda/hacienda-signing.service';
import { HaciendaXmlBuilderService } from '../hacienda/hacienda-xml-builder.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { CreateInvoicePaymentDto } from './dto/create-invoice-payment.dto';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { INVOICE_TEMPLATES, getTemplatesByIndustry, type InvoiceTemplate } from './invoice-templates.data';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly haciendaRecepcion: HaciendaRecepcionService,
    private readonly haciendaSigning: HaciendaSigningService,
    private readonly haciendaXmlBuilder: HaciendaXmlBuilderService,
    private readonly planLimits: PlanLimitsService,
    private readonly notificationsService: NotificationsService,
    private readonly ai: AiService,
  ) {}

  async findAll(workspaceId: string, filters: FilterInvoicesDto) {
    const {
      status,
      hacienda_status,
      document_type,
      issuance_mode,
      contact_id,
      conversation_id,
      overdue_only,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = { workspace_id: workspaceId };

    if (status) where.status = status;
    if (hacienda_status) where.hacienda_status = hacienda_status;
    if (document_type) where.document_type = document_type;
    if (issuance_mode) where.issuance_mode = issuance_mode;
    if (contact_id) where.contact_id = contact_id;
    if (conversation_id) where.conversation_id = conversation_id;

    if (overdue_only) {
      where.due_date = { lt: new Date() };
      where.status = { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] };
    }

    const [rows, total, aggregate] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
        include: this.invoiceInclude(),
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const data = rows.map((invoice) => this.serializeInvoice(invoice));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary: {
        total_amount: aggregate._sum.amount ?? 0,
        outstanding_amount: data.reduce((sum, invoice) => sum + invoice.balance_due, 0),
        amount_paid: data.reduce((sum, invoice) => sum + invoice.amount_paid, 0),
      },
    };
  }

  async findOne(workspaceId: string, id: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, id);
    return this.serializeInvoice(invoice);
  }

  async create(workspaceId: string, dto: CreateInvoiceDto) {
    // Check invoice limit for workspace plan
    await this.planLimits.checkInvoiceLimit(workspaceId);

    await this.assertContact(workspaceId, dto.contact_id);
    await this.ensureUniqueNumber(workspaceId, dto.number);

    if (dto.conversation_id) {
      await this.assertConversation(workspaceId, dto.conversation_id, dto.contact_id);
    }

    if (dto.reference_invoice_id) {
      await this.assertInvoiceReference(workspaceId, dto.reference_invoice_id);
    }

    const preparedLines = this.prepareLines(dto.lines, dto.amount);
    const computedAmount = preparedLines.totalAmount;

    if (computedAmount <= 0 && preparedLines.lines.length === 0) {
      throw new BadRequestException('La factura debe tener al menos una línea de detalle o un monto mayor a cero.');
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        workspace_id: workspaceId,
        contact_id: dto.contact_id,
        conversation_id: dto.conversation_id,
        reference_invoice_id: dto.reference_invoice_id,
        number: dto.number,
        amount: computedAmount,
        currency: dto.currency ?? 'USD',
        due_date: new Date(dto.due_date),
        description: dto.description,
        notes_json: (dto.notes as any) ?? undefined,
        status: dto.issuance_mode === InvoiceIssuanceMode.HACIENDA ? InvoiceStatus.DRAFT : InvoiceStatus.SENT,
        document_type: dto.document_type ?? InvoiceDocumentType.FACTURA_ELECTRONICA,
        issuance_mode: dto.issuance_mode ?? InvoiceIssuanceMode.MANUAL_ONLY,
        hacienda_status: dto.hacienda_status ?? HaciendaStatus.DRAFT,
        sale_condition: dto.sale_condition,
        payment_method: dto.payment_method,
        activity_code: dto.activity_code,
        issue_date: dto.issue_date ? new Date(dto.issue_date) : new Date(),
        exchange_rate: dto.exchange_rate,
        lines: preparedLines.lines.length
          ? {
              create: preparedLines.lines.map((line) => ({
                ...line,
                workspace_id: workspaceId,
              })),
            }
          : undefined,
      },
      include: this.invoiceInclude(),
    });

    if (dto.conversation_id) {
      await this.prisma.conversation.update({
        where: { id: dto.conversation_id },
        data: {
          ...(invoice.contact_id ? { contact_id: invoice.contact_id } : {}),
          updated_at: new Date(),
        },
      });
    }

    return this.serializeInvoice(invoice);
  }

  async update(workspaceId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.getInvoiceOrThrow(workspaceId, id);
    this.ensureMutableInvoice(existing);

    if (dto.contact_id) {
      await this.assertContact(workspaceId, dto.contact_id);
    }

    if (dto.number) {
      await this.ensureUniqueNumber(workspaceId, dto.number, id);
    }

    if (dto.conversation_id) {
      await this.assertConversation(workspaceId, dto.conversation_id, dto.contact_id ?? existing.contact_id);
    }

    if (dto.reference_invoice_id) {
      await this.assertInvoiceReference(workspaceId, dto.reference_invoice_id, id);
    }

    const preparedLines = dto.lines
      ? this.prepareLines(dto.lines, dto.amount ?? Number(existing.amount))
      : null;

    const invoice = await this.prisma.$transaction(async (tx) => {
      if (preparedLines) {
        await tx.invoiceLine.deleteMany({ where: { invoice_id: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.contact_id !== undefined && {
            contact: { connect: { id: dto.contact_id } },
          }),
          ...(dto.conversation_id !== undefined && {
            conversation:
              dto.conversation_id === null
                ? { disconnect: true }
                : { connect: { id: dto.conversation_id } },
          }),
          ...(dto.reference_invoice_id !== undefined && {
            reference_invoice:
              dto.reference_invoice_id === null
                ? { disconnect: true }
                : { connect: { id: dto.reference_invoice_id } },
          }),
          ...(dto.number !== undefined && { number: dto.number }),
          ...(dto.document_type !== undefined && { document_type: dto.document_type }),
          ...(dto.issuance_mode !== undefined && { issuance_mode: dto.issuance_mode }),
          ...(dto.hacienda_status !== undefined && { hacienda_status: dto.hacienda_status }),
          ...(dto.amount !== undefined && { amount: preparedLines?.totalAmount ?? dto.amount }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.due_date !== undefined && { due_date: new Date(dto.due_date) }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.notes !== undefined && { notes_json: dto.notes as any }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.issue_date !== undefined && { issue_date: new Date(dto.issue_date) }),
          ...(dto.sale_condition !== undefined && { sale_condition: dto.sale_condition }),
          ...(dto.payment_method !== undefined && { payment_method: dto.payment_method }),
          ...(dto.activity_code !== undefined && { activity_code: dto.activity_code }),
          ...(dto.exchange_rate !== undefined && { exchange_rate: dto.exchange_rate }),
          ...(preparedLines?.lines.length
            ? {
                lines: {
                  create: preparedLines.lines.map((line) => ({
                    ...line,
                    workspace_id: workspaceId,
                  })),
                },
              }
            : preparedLines
              ? { lines: { create: [] } }
              : {}),
          updated_at: new Date(),
        },
        include: this.invoiceInclude(),
      });
    });

    if (dto.status !== undefined) {
      this.validateStateTransition(existing.status as InvoiceStatus, dto.status as InvoiceStatus);
    }

    const finalStatus =
      dto.status !== undefined
        ? dto.status
        : this.computeInvoiceStatus(invoice.status as InvoiceStatus, this.getAmountPaid(invoice), Number(invoice.amount), invoice.due_date);

    const normalized =
      finalStatus !== invoice.status
        ? await this.prisma.invoice.update({
            where: { id },
            data: {
              status: finalStatus,
              paid_at: finalStatus === InvoiceStatus.PAID ? invoice.paid_at ?? new Date() : null,
              updated_at: new Date(),
            },
            include: this.invoiceInclude(),
          })
        : invoice;

    const prevStatus = existing.status as string;
    const nextStatus = finalStatus as string;

    if (prevStatus === 'DRAFT' && nextStatus === 'SENT') {
      await this.deductStock(workspaceId, id).catch((err) =>
        this.logger.error(`Stock deduction on update failed: ${err?.message}`),
      );
    } else if (nextStatus === 'CANCELLED' && prevStatus !== 'DRAFT') {
      await this.reverseStock(workspaceId, id).catch((err) =>
        this.logger.error(`Stock reversal on cancel failed: ${err?.message}`),
      );
    }

    return this.serializeInvoice(normalized);
  }

  async remove(workspaceId: string, id: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, id);
    this.ensureMutableInvoice(invoice);
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Factura eliminada.' };
  }

  async registerPayment(
    workspaceId: string,
    userId: string | null,
    invoiceId: string,
    dto: CreateInvoicePaymentDto,
  ) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, invoiceId);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se pueden registrar pagos para una factura cancelada.');
    }

    const balanceDue = this.getBalanceDue(invoice);
    const amount = Number(dto.amount ?? 0);

    this.logger.error(`[DIAG] registerPayment: invoice.amount=${JSON.stringify(invoice.amount)}, parsed=${this.parseAmount(invoice.amount)}, payments=${JSON.stringify(invoice.payments?.length)}, amountPaid=${this.getAmountPaid(invoice)}, balance=${balanceDue}`);

    if (amount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero.');
    }

    if (balanceDue <= 0) {
      throw new BadRequestException('La factura no tiene saldo pendiente.');
    }

    if (amount > balanceDue) {
      throw new BadRequestException(`El pago excede el saldo pendiente de ${balanceDue.toFixed(2)}.`);
    }

    const paidAt = dto.paid_at ? new Date(dto.paid_at) : new Date();
    const paymentCurrency = dto.currency ?? invoice.currency;

    // Reject payments with mismatched currency to prevent silent exchange rate issues
    if (dto.currency && dto.currency !== invoice.currency) {
      throw new BadRequestException(
        `La moneda del pago (${dto.currency}) no coincide con la moneda de la factura (${invoice.currency}).`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          workspace_id: workspaceId,
          invoice_id: invoiceId,
          recorded_by_user_id: userId ?? undefined,
          amount,
          currency: paymentCurrency,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          paid_at: paidAt,
        },
      });

      const refreshed = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: this.invoiceInclude(),
      });

      const amountPaid = this.getAmountPaid(refreshed);
      const nextStatus = this.computeInvoiceStatus(
        refreshed.status as InvoiceStatus,
        amountPaid,
        Number(refreshed.amount),
        refreshed.due_date,
      );

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: nextStatus,
          paid_at: nextStatus === InvoiceStatus.PAID ? paidAt : null,
          updated_at: new Date(),
        },
        include: this.invoiceInclude(),
      });

      return { payment, invoice: updated, newStatus: nextStatus };
    });

    // Notificar pago recibido
    const isPaid = result.newStatus === InvoiceStatus.PAID;
    const admins = await this.prisma.workspaceMembership.findMany({
      where: { workspace_id: workspaceId, role: { in: ['OWNER'] as any } },
      select: { user_id: true },
      take: 3,
    });
    const notified = new Set<string>();
    for (const admin of admins) {
      if (notified.has(admin.user_id)) continue;
      notified.add(admin.user_id);
      this.notificationsService.create(workspaceId, {
        user_id: admin.user_id,
        type: isPaid ? 'invoice_paid' : 'payment_received',
        title: isPaid ? 'Factura pagada' : 'Pago recibido',
        body: isPaid
          ? `La factura ${invoice.number} fue pagada por completo (₡${amount.toFixed(2)}).`
          : `Se recibió un pago de ₡${amount.toFixed(2)} para la factura ${invoice.number}.`,
        related_entity_type: 'invoice',
        related_entity_id: invoiceId,
      }).catch(() => {});
    }

    return {
      payment: result.payment,
      invoice: this.serializeInvoice(result.invoice),
    };
  }

  async markPaid(workspaceId: string, userId: string | null, id: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, id);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se puede marcar como pagada una factura cancelada.');
    }

    if (this.getBalanceDue(invoice) <= 0) {
      throw new BadRequestException('La factura ya está marcada como pagada.');
    }

    return this.registerPayment(workspaceId, userId, id, {
      amount: this.getBalanceDue(invoice),
      currency: invoice.currency,
      method: 'MANUAL_FULL',
      notes: 'Pago registrado desde acción rápida de marcar pagada.',
      paid_at: new Date().toISOString(),
    });
  }

  async submitToHacienda(workspaceId: string, id: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, id);
    if (invoice.issuance_mode !== InvoiceIssuanceMode.HACIENDA) {
      throw new BadRequestException('La factura no está configurada para emisión Hacienda.');
    }
    if (invoice.hacienda_status === HaciendaStatus.ACEPTADO) {
      throw new BadRequestException('La factura ya fue aceptada por Hacienda.');
    }

    const settings = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        settings_json: true,
        workspace_tax_profile: true,
      },
    });
    const workspaceTaxProfile = settings?.workspace_tax_profile ?? null;
    const missingWorkspaceTaxProfileFields = this.getMissingWorkspaceTaxProfileFields(workspaceTaxProfile);
    if (missingWorkspaceTaxProfileFields.length) {
      throw new BadRequestException(
        `Configuración de Hacienda incompleta en el workspace. Faltan: ${missingWorkspaceTaxProfileFields.join(', ')}. Ve a Configuración > Facturación electrónica CR y guarda el perfil tributario.`,
      );
    }

    const workspaceSettings =
      parseJsonValue<Record<string, any>>(settings?.settings_json, {});
    const missingWorkspaceSettings = this.getMissingWorkspaceHaciendaSettings(workspaceSettings);
    if (missingWorkspaceSettings.length) {
      throw new BadRequestException(
        `Configuración operativa de Hacienda incompleta. Faltan: ${missingWorkspaceSettings.join(', ')}. Revísalo en Configuración > Facturación electrónica CR.`,
      );
    }

    const preparedClave =
      invoice.clave ??
      this.buildClave(workspaceTaxProfile.identification_number, invoice.document_type as InvoiceDocumentType);
    const preparedConsecutivo =
      invoice.consecutivo ?? this.buildConsecutivo(invoice.document_type as InvoiceDocumentType);
    const issueDate = invoice.issue_date ?? new Date();

    const xml = this.haciendaXmlBuilder.buildInvoiceXml({
      invoice: {
        ...invoice,
        clave: preparedClave,
        consecutivo: preparedConsecutivo,
        issue_date: issueDate,
      },
      workspaceTaxProfile,
      contact: invoice.contact,
      lines: invoice.lines.length ? invoice.lines : this.buildFallbackLines(invoice),
    });
    const signed = await this.haciendaSigning.signXml(workspaceId, xml);
    const signedXmlKey = `hacienda/${workspaceId}/invoices/${invoice.id}/signed.xml`;
    await this.storage.upload(signedXmlKey, Buffer.from(signed.signedXml, 'utf8'), 'application/xml');

    const recepcionResponse = await this.haciendaRecepcion.submitComprobante(workspaceId, {
      clave: preparedClave,
      fecha: this.formatRecepcionDate(issueDate),
      emisor: {
        tipoIdentificacion: workspaceTaxProfile.identification_type,
        numeroIdentificacion: workspaceTaxProfile.identification_number,
      },
      receptor: invoice.contact.identification_type && invoice.contact.identification_number
        ? {
            tipoIdentificacion: invoice.contact.identification_type,
            numeroIdentificacion: invoice.contact.identification_number,
          }
        : undefined,
      callbackUrl: workspaceSettings.hacienda_callback_url,
      consecutivoReceptor:
        invoice.document_type === InvoiceDocumentType.MENSAJE_RECEPTOR ? preparedConsecutivo : undefined,
      comprobanteXml: Buffer.from(signed.signedXml, 'utf8').toString('base64'),
    });

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        clave: preparedClave,
        consecutivo: preparedConsecutivo,
        issue_date: issueDate,
        signed_xml_storage_key: signedXmlKey,
        hacienda_location_url: recepcionResponse.location,
        hacienda_submitted_at: new Date(),
        hacienda_last_checked_at: new Date(),
        hacienda_last_error: null,
        hacienda_status: HaciendaStatus.SUBMITTED,
        status: InvoiceStatus.SENT,
        updated_at: new Date(),
      },
      include: this.invoiceInclude(),
    });

    await this.deductStock(workspaceId, id).catch((err) =>
      this.logger.error(`Stock deduction failed for invoice ${id}: ${err?.message}`),
    );

    return this.serializeInvoice(updated);
  }

  async syncHaciendaStatus(workspaceId: string, id: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, id);
    if (!invoice.clave) {
      throw new BadRequestException('La factura aún no tiene clave para consultar en Hacienda.');
    }

    const response = await this.haciendaRecepcion.getRecepcionStatus(workspaceId, invoice.clave);
    const responseXmlBase64 = response?.['respuesta-xml'];
    let responseKey = invoice.response_xml_storage_key;

    if (responseXmlBase64) {
      responseKey = `hacienda/${workspaceId}/invoices/${invoice.id}/response.xml`;
      await this.storage.upload(
        responseKey,
        Buffer.from(responseXmlBase64, 'base64'),
        'application/xml',
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        hacienda_status: this.mapHaciendaStatus(response?.['ind-estado']),
        response_xml_storage_key: responseKey,
        hacienda_last_checked_at: new Date(),
        hacienda_last_error: this.mapHaciendaStatus(response?.['ind-estado']) === HaciendaStatus.RECHAZADO
          ? 'Hacienda rechazó el comprobante.'
          : null,
        updated_at: new Date(),
      },
      include: this.invoiceInclude(),
    });

    return {
      invoice: this.serializeInvoice(updated),
      hacienda_response: response,
    };
  }

  async createCreditNote(workspaceId: string, sourceInvoiceId: string, dto: CreateInvoiceDto) {
    const source = await this.getInvoiceOrThrow(workspaceId, sourceInvoiceId);
    if (source.hacienda_status !== HaciendaStatus.ACEPTADO) {
      throw new BadRequestException('La nota de crédito debe referenciar una factura aceptada por Hacienda.');
    }

    return this.create(workspaceId, {
      ...dto,
      contact_id: dto.contact_id ?? source.contact_id,
      currency: dto.currency ?? source.currency,
      due_date: dto.due_date ?? source.due_date.toISOString(),
      document_type: InvoiceDocumentType.NOTA_CREDITO,
      issuance_mode: InvoiceIssuanceMode.HACIENDA,
      reference_invoice_id: sourceInvoiceId,
      lines: dto.lines ?? source.lines.map((line: any) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        discount_amount: Number(line.discount_amount),
        cabys_code: line.cabys_code ?? undefined,
        unit_of_measure: line.unit_of_measure ?? undefined,
        tax_code: line.tax_code ?? undefined,
        tax_rate: line.tax_rate ? Number(line.tax_rate) : undefined,
      })),
      amount: dto.amount ?? Number(source.amount),
    });
  }

  async createDebitNote(workspaceId: string, sourceInvoiceId: string, dto: CreateInvoiceDto) {
    const source = await this.getInvoiceOrThrow(workspaceId, sourceInvoiceId);
    if (source.hacienda_status !== HaciendaStatus.ACEPTADO) {
      throw new BadRequestException('La nota de débito debe referenciar una factura aceptada por Hacienda.');
    }

    return this.create(workspaceId, {
      ...dto,
      contact_id: dto.contact_id ?? source.contact_id,
      currency: dto.currency ?? source.currency,
      due_date: dto.due_date ?? source.due_date.toISOString(),
      document_type: InvoiceDocumentType.NOTA_DEBITO,
      issuance_mode: InvoiceIssuanceMode.HACIENDA,
      reference_invoice_id: sourceInvoiceId,
      amount: dto.amount ?? Number(source.amount),
      lines: dto.lines ?? source.lines.map((line: any) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        discount_amount: Number(line.discount_amount),
        cabys_code: line.cabys_code ?? undefined,
        unit_of_measure: line.unit_of_measure ?? undefined,
        tax_code: line.tax_code ?? undefined,
        tax_rate: line.tax_rate ? Number(line.tax_rate) : undefined,
      })),
    });
  }

  async createReceiverMessage(workspaceId: string, sourceInvoiceId: string, dto: { number?: string; description?: string; notes?: unknown[] }) {
    const source = await this.getInvoiceOrThrow(workspaceId, sourceInvoiceId);
    if (source.hacienda_status !== HaciendaStatus.ACEPTADO) {
      throw new BadRequestException('El mensaje del receptor debe referenciar un comprobante aceptado.');
    }

    const number = dto.number ?? `MR-${Date.now()}`;
    await this.ensureUniqueNumber(workspaceId, number);

    const created = await this.prisma.invoice.create({
      data: {
        workspace_id: workspaceId,
        contact_id: source.contact_id,
        conversation_id: source.conversation_id,
        reference_invoice_id: sourceInvoiceId,
        number,
        amount: 0,
        currency: source.currency,
        due_date: new Date(),
        status: InvoiceStatus.SENT,
        document_type: InvoiceDocumentType.MENSAJE_RECEPTOR,
        issuance_mode: InvoiceIssuanceMode.HACIENDA,
        hacienda_status: HaciendaStatus.DRAFT,
        description: dto.description ?? `Mensaje del receptor para ${source.number}`,
        notes_json: dto.notes as any,
        issue_date: new Date(),
      },
      include: this.invoiceInclude(),
    });

    return this.serializeInvoice(created);
  }

  private invoiceInclude() {
    return {
      contact: {
        select: {
          id: true,
          full_name: true,
          company_name: true,
          email: true,
          phone: true,
          identification_type: true,
          identification_number: true,
          tax_email: true,
        },
      },
      conversation: {
        select: {
          id: true,
          subject: true,
        },
      },
      reference_invoice: {
        select: {
          id: true,
          number: true,
          clave: true,
          hacienda_status: true,
          document_type: true,
        },
      },
      reminders: {
        orderBy: { created_at: 'desc' as const },
        take: 1,
      },
      payments: {
        orderBy: { paid_at: 'desc' as const },
        include: {
          recorded_by_user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      lines: {
        orderBy: { line_number: 'asc' as const },
      },
    };
  }

  private serializeInvoice(invoice: any) {
    const amountPaid = this.getAmountPaid(invoice);
    const totalAmount = this.parseAmount(invoice.amount);
    const balanceDue = Math.max(0, totalAmount - amountPaid);

    return {
      ...invoice,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      payment_count: invoice.payments?.length ?? 0,
      last_payment_at: invoice.payments?.[0]?.paid_at ?? null,
      fiscal_state: invoice.hacienda_status,
      collection_state: invoice.status,
    };
  }

  private parseAmount(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
      const n = value.toNumber();
      return isNaN(n) ? 0 : n;
    }
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  }

  private getAmountPaid(invoice: any) {
    return (invoice.payments ?? []).reduce(
      (sum: number, payment: any) => sum + this.parseAmount(payment.amount),
      0,
    );
  }

  private getBalanceDue(invoice: any) {
    return Math.max(0, this.parseAmount(invoice.amount) - this.getAmountPaid(invoice));
  }

  private validateStateTransition(current: InvoiceStatus, next: InvoiceStatus): void {
    const ALLOWED_TRANSITIONS: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
      [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
      [InvoiceStatus.SENT]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
      [InvoiceStatus.OVERDUE]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PAID]: [],
      [InvoiceStatus.CANCELLED]: [],
    };

    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (current !== next && !allowed.includes(next)) {
      throw new BadRequestException(
        `Transición de estado inválida: ${current} → ${next}.`,
      );
    }
  }

  private computeInvoiceStatus(
    currentStatus: InvoiceStatus,
    amountPaid: number,
    totalAmount: number,
    dueDate: Date,
  ) {
    if (currentStatus === InvoiceStatus.CANCELLED) {
      return InvoiceStatus.CANCELLED;
    }

    if (amountPaid >= totalAmount) {
      return InvoiceStatus.PAID;
    }

    if (amountPaid > 0) {
      return dueDate.getTime() < Date.now() ? InvoiceStatus.OVERDUE : InvoiceStatus.PARTIALLY_PAID;
    }

    if (dueDate.getTime() < Date.now()) {
      return InvoiceStatus.OVERDUE;
    }

    return currentStatus;
  }

  private async getInvoiceOrThrow(workspaceId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, workspace_id: workspaceId },
      include: this.invoiceInclude(),
    });

    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return invoice;
  }

  private async assertContact(workspaceId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspace_id: workspaceId },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado.');
  }

  private async assertConversation(workspaceId: string, conversationId: string, contactId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspace_id: workspaceId },
      select: { id: true, contact_id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (conversation.contact_id && conversation.contact_id !== contactId) {
      throw new BadRequestException('La conversación está vinculada a otro contacto.');
    }
  }

  private async assertInvoiceReference(workspaceId: string, invoiceId: string, ignoreId?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        workspace_id: workspaceId,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (!invoice) {
      throw new NotFoundException('La factura de referencia no existe en este workspace.');
    }
  }

  private async ensureUniqueNumber(workspaceId: string, number: string, ignoreId?: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: {
        workspace_id: workspaceId,
        number,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Ya existe una factura con el número ${number}.`);
    }
  }

  private ensureMutableInvoice(invoice: any) {
    if (
      invoice.issuance_mode === InvoiceIssuanceMode.HACIENDA &&
      [HaciendaStatus.SUBMITTED, HaciendaStatus.RECIBIDO, HaciendaStatus.PROCESANDO, HaciendaStatus.ACEPTADO].includes(invoice.hacienda_status)
    ) {
      throw new BadRequestException(
        'El comprobante ya fue enviado a Hacienda. Use nota de crédito/débito para corregirlo.',
      );
    }
  }

  private prepareLines(lines: any[] | undefined, fallbackAmount: number) {
    if (!lines?.length) {
      // Allow empty lines only for manual invoices where amount is directly set
      // Amount is always from fallbackAmount when no lines provided
      return {
        totalAmount: Number(fallbackAmount ?? 0),
        lines: [],
      };
    }

    const prepared = lines.map((line, index) => {
      const quantity = Number(line.quantity ?? 0);
      const unitPrice = Number(line.unit_price ?? 0);
      const discountAmount = Number(line.discount_amount ?? 0);
      const taxRate = Number(line.tax_rate ?? 0);
      const subtotal = quantity * unitPrice - discountAmount;
      const taxAmount = subtotal * (taxRate / 100);
      const totalLineAmount = subtotal + taxAmount;

      return {
        line_number: line.line_number ?? index + 1,
        description: line.description,
        quantity,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        subtotal,
        tax_amount: taxAmount,
        total_line_amount: totalLineAmount,
        cabys_code: line.cabys_code,
        unit_of_measure: line.unit_of_measure,
        tax_code: line.tax_code,
        tax_rate: taxRate || null,
        exoneration_json: line.exoneration ?? undefined,
        metadata_json: Array.isArray(line.metadata) ? line.metadata : undefined,
        product_id: line.product_id ?? null,
      };
    });

    return {
      totalAmount: prepared.reduce((sum, line) => sum + Number(line.total_line_amount), 0),
      lines: prepared,
    };
  }

  private async deductStock(workspaceId: string, invoiceId: string) {
    const lines = await (this.prisma as any).invoiceLine.findMany({
      where: { invoice_id: invoiceId, workspace_id: workspaceId, product_id: { not: null } },
      include: { product: { select: { id: true, track_inventory: true, type: true, current_stock: true } } },
    });

    for (const line of lines) {
      if (!line.product || !line.product.track_inventory || line.product.type === 'SERVICE') continue;

      const existingMovement = await (this.prisma as any).stockMovement.findFirst({
        where: { product_id: line.product_id, reference_type: 'invoice', reference_id: invoiceId, type: 'OUT' },
      });
      if (existingMovement) continue;

      const qty = Math.round(Number(line.quantity));
      if (qty <= 0) continue;

      const previousStock = line.product.current_stock;
      const newStock = Math.max(0, previousStock - qty);

      await (this.prisma as any).product.update({
        where: { id: line.product_id },
        data: { current_stock: newStock },
      });

      await (this.prisma as any).stockMovement.create({
        data: {
          workspace_id: workspaceId,
          product_id: line.product_id,
          type: 'OUT',
          quantity: qty,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: `Factura #${line.invoice_id?.slice(0, 8)}`,
          reference_type: 'invoice',
          reference_id: invoiceId,
        },
      });
    }
  }

  private async reverseStock(workspaceId: string, invoiceId: string) {
    const movements = await (this.prisma as any).stockMovement.findMany({
      where: { reference_type: 'invoice', reference_id: invoiceId, type: 'OUT' },
    });

    for (const mov of movements) {
      const alreadyReversed = await (this.prisma as any).stockMovement.findFirst({
        where: { product_id: mov.product_id, reference_type: 'invoice', reference_id: invoiceId, type: 'REVERSAL', quantity: mov.quantity },
      });
      if (alreadyReversed) continue;

      const product = await (this.prisma as any).product.findUnique({
        where: { id: mov.product_id },
        select: { current_stock: true },
      });
      if (!product) continue;

      const newStock = product.current_stock + mov.quantity;

      await (this.prisma as any).product.update({
        where: { id: mov.product_id },
        data: { current_stock: newStock },
      });

      await (this.prisma as any).stockMovement.create({
        data: {
          workspace_id: workspaceId,
          product_id: mov.product_id,
          type: 'REVERSAL',
          quantity: mov.quantity,
          previous_stock: product.current_stock,
          new_stock: newStock,
          reason: `Reversión factura #${invoiceId?.slice(0, 8)}`,
          reference_type: 'invoice',
          reference_id: invoiceId,
        },
      });
    }
  }

  private mapHaciendaStatus(value?: string): HaciendaStatus {
    switch ((value ?? '').toLowerCase()) {
      case 'recibido':
        return HaciendaStatus.RECIBIDO;
      case 'procesando':
        return HaciendaStatus.PROCESANDO;
      case 'aceptado':
        return HaciendaStatus.ACEPTADO;
      case 'rechazado':
        return HaciendaStatus.RECHAZADO;
      case 'error':
        return HaciendaStatus.ERROR;
      default:
        return HaciendaStatus.SUBMITTED;
    }
  }

  private buildConsecutivo(documentType: InvoiceDocumentType) {
    const suffix = {
      [InvoiceDocumentType.FACTURA_ELECTRONICA]: '00100001010000000001',
      [InvoiceDocumentType.TIQUETE_ELECTRONICO]: '00200001010000000001',
      [InvoiceDocumentType.NOTA_CREDITO]: '00300001010000000001',
      [InvoiceDocumentType.NOTA_DEBITO]: '00400001010000000001',
      [InvoiceDocumentType.MENSAJE_RECEPTOR]: '00500001010000000001',
    }[documentType];
    return `${suffix}${Date.now().toString().slice(-8)}`.slice(0, 20);
  }

  private buildClave(identificationNumber: string, documentType: InvoiceDocumentType) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const tipo = {
      [InvoiceDocumentType.FACTURA_ELECTRONICA]: '01',
      [InvoiceDocumentType.TIQUETE_ELECTRONICO]: '04',
      [InvoiceDocumentType.NOTA_CREDITO]: '03',
      [InvoiceDocumentType.NOTA_DEBITO]: '02',
      [InvoiceDocumentType.MENSAJE_RECEPTOR]: '05',
    }[documentType];
    const cedula = identificationNumber.padStart(12, '0').slice(-12);
    const random = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-20);
    return `506${dd}${mm}${yy}${cedula}${tipo}${random}`.slice(0, 50);
  }

  private formatRecepcionDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-0600`;
  }

  private buildFallbackLines(invoice: any) {
    return [
      {
        line_number: 1,
        description: invoice.description || `Factura ${invoice.number}`,
        quantity: 1,
        unit_price: Number(invoice.amount),
        discount_amount: 0,
        subtotal: Number(invoice.amount),
        tax_amount: 0,
        total_line_amount: Number(invoice.amount),
        cabys_code: null,
        unit_of_measure: 'Unid',
        tax_code: '01',
        tax_rate: 0,
      },
    ];
  }

  private getMissingWorkspaceTaxProfileFields(workspaceTaxProfile: any | null) {
    if (!workspaceTaxProfile) {
      return [
        'razón social',
        'tipo de identificación',
        'identificación',
        'actividad económica',
        'correo tributario',
      ];
    }

    const missing: string[] = [];
    if (!workspaceTaxProfile.legal_name?.trim()) missing.push('razón social');
    if (!workspaceTaxProfile.identification_type?.trim()) missing.push('tipo de identificación');
    if (!workspaceTaxProfile.identification_number?.trim()) missing.push('identificación');
    if (!workspaceTaxProfile.activity_code?.trim()) missing.push('actividad económica');
    if (!workspaceTaxProfile.tax_email?.trim()) missing.push('correo tributario');
    return missing;
  }

  private getMissingWorkspaceHaciendaSettings(settings: Record<string, any>) {
    const missing: string[] = [];
    if (!settings.hacienda_environment) missing.push('ambiente');
    if (!settings.hacienda_callback_url) missing.push('callback URL');
    if (!settings.hacienda_client_id) missing.push('client ID');
    if (!settings.hacienda_token_url) missing.push('token URL');
    if (!settings.hacienda_username) missing.push('usuario Hacienda');
    if (!settings.hacienda_password) missing.push('contraseña Hacienda');
    return missing;
  }

  async getInvoiceTemplates(workspaceId: string, industry?: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!ws) throw new NotFoundException('Workspace no encontrado.');

    return getTemplatesByIndustry(industry);
  }

  async validateForHacienda(workspaceId: string, invoiceId: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, invoiceId);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        settings_json: true,
        workspace_tax_profile: true,
      },
    });

    const issues: Array<{ field: string; severity: 'error' | 'warning'; message: string }> = [];
    let valid = true;

    const taxProfile = workspace?.workspace_tax_profile;
    const settings = parseJsonValue<Record<string, any>>(workspace?.settings_json ?? null, {});

    const missingProfile = this.getMissingWorkspaceTaxProfileFields(taxProfile);
    if (missingProfile.length > 0) {
      valid = false;
      missingProfile.forEach(f => issues.push({
        field: 'perfil_fiscal',
        severity: 'error',
        message: `Falta completar en Ajustes → Facturación CR: ${f}`,
      }));
    }

    const missingSettings = this.getMissingWorkspaceHaciendaSettings(settings);
    if (missingSettings.length > 0) {
      valid = false;
      missingSettings.forEach(f => issues.push({
        field: 'config_hacienda',
        severity: 'error',
        message: `Falta configurar en Ajustes → Facturación CR: ${f}`,
      }));
    }

    if (!invoice.activity_code) {
      valid = false;
      issues.push({ field: 'activity_code', severity: 'error', message: 'El código de actividad económica es obligatorio.' });
    }
    if (!invoice.sale_condition) {
      issues.push({ field: 'sale_condition', severity: 'warning', message: 'Condición de venta no definida (01=contado, 02=crédito).' });
    }
    if (!invoice.payment_method) {
      issues.push({ field: 'payment_method', severity: 'warning', message: 'Medio de pago no definido.' });
    }

    if (invoice.lines && invoice.lines.length > 0) {
      for (let i = 0; i < invoice.lines.length; i++) {
        const line = invoice.lines[i];
        if (!line.cabys_code) {
          valid = false;
          issues.push({ field: `linea_${i + 1}_cabys`, severity: 'error', message: `Línea ${i + 1}: falta código CABYS.` });
        }
        if (!line.tax_code) {
          issues.push({ field: `linea_${i + 1}_tax`, severity: 'warning', message: `Línea ${i + 1}: código de impuesto no definido.` });
        }
      }
    } else {
      valid = false;
      issues.push({ field: 'lineas', severity: 'error', message: 'La factura debe tener al menos una línea de detalle.' });
    }

    let ai_review: string | null = null;
    try {
      const firstLine = invoice.lines?.[0];
      const result = await this.ai.reviewInvoiceForHacienda(workspaceId, {
        document_type: invoice.document_type,
        activity_code: invoice.activity_code ?? undefined,
        sale_condition: invoice.sale_condition ?? undefined,
        payment_method: invoice.payment_method ?? undefined,
        cabys_code: firstLine?.cabys_code ?? undefined,
        tax_rate: firstLine?.tax_rate != null ? String(firstLine.tax_rate) : undefined,
        line_description: firstLine?.description ?? undefined,
        currency: invoice.currency,
        amount: invoice.amount != null ? String(invoice.amount) : undefined,
        contact_name: invoice.contact?.full_name ?? undefined,
      });
      if (result) {
        if (result.issues?.length) {
          valid = false;
          result.issues.forEach((issue: { field: string; severity: 'error' | 'warning'; message: string }) => issues.push(issue));
        }
        ai_review = result.ai_review || null;
      }
    } catch (err) {
      this.logger.warn(`AI review failed for invoice ${invoiceId}: ${(err as Error).message}`);
    }

    return { valid, issues, ai_review };
  }

  async explainHaciendaError(workspaceId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, workspace_id: workspaceId },
      select: { hacienda_last_error: true, hacienda_status: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    if (!invoice.hacienda_last_error) throw new BadRequestException('Esta factura no tiene errores de Hacienda registrados.');

    const aiResult = await this.ai.explainHaciendaError(workspaceId, invoice.hacienda_last_error);

    return {
      error_code: 'HACIENDA_RECHAZO',
      technical_message: invoice.hacienda_last_error,
      plain_explanation: aiResult?.explanation ?? 'No se pudo generar una explicación automática. Contactá soporte para más detalles.',
      suggested_fix: aiResult?.suggested_fix ?? null,
    };
  }

  async getXmlPreview(workspaceId: string, invoiceId: string) {
    const invoice = await this.getInvoiceOrThrow(workspaceId, invoiceId);
    if (invoice.issuance_mode !== InvoiceIssuanceMode.HACIENDA) {
      throw new BadRequestException('La factura no está configurada para emisión Hacienda.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { workspace_tax_profile: true },
    });

    const referenceInvoice = invoice.reference_invoice_id
      ? await this.prisma.invoice.findFirst({
          where: { id: invoice.reference_invoice_id, workspace_id: workspaceId },
          select: { clave: true, number: true, issue_date: true },
        })
      : null;

    const lines = invoice.lines?.length ? invoice.lines : this.buildFallbackLines(invoice);
    const xml = this.haciendaXmlBuilder.buildInvoiceXml({
      invoice,
      workspaceTaxProfile: workspace?.workspace_tax_profile ?? {},
      contact: invoice.contact ?? {},
      lines,
      referenceInvoice,
    });

    return { xml };
  }
}
