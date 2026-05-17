import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateBillingInvoicePdf, type BillingInvoicePdfData } from './billing-invoice-pdf.service';

@Injectable()
export class BillingInvoiceService {
  private readonly logger = new Logger(BillingInvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateForSubscription(
    workspaceId: string,
    subscriptionId: string,
    params: {
      clientName: string;
      clientEmail: string;
      planName: string;
      planInterval: string;
      seats: number;
      amount: number;
      // OPCIONAL — SI EL CALLER YA TIENE EL DESGLOSE DE PADDLE, PASAR
      // subtotal+taxAmount EVITA RECALCULAR Y CONTAR IVA DOS VECES.
      subtotal?: number;
      taxAmount?: number;
      taxRate?: number;
      currency?: string;
      notes?: string;
      status?: string;
    },
  ) {
    const currency = params.currency || 'USD';
    const subtotal = params.subtotal ?? params.amount;
    const taxRate = params.taxRate ?? (currency === 'CRC' ? 13 : 0);
    const taxAmount = params.taxAmount ?? Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const lineItems = [{
      description: `Plan ${params.planName} — ${params.planInterval === 'MONTHLY' ? 'Mensual' : 'Anual'}`,
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
    }];

    // ATOMIC: number generation + insert in one serializable transaction to
    // prevent duplicate invoice numbers across replicas.
    const invoice = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const prefix = `PH-${year}-`;
      const last = await tx.billingInvoice.findFirst({
        where: { number: { startsWith: prefix } },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const seq = last ? (parseInt(last.number.slice(prefix.length), 10) + 1) : 1;
      const number = `${prefix}${String(seq).padStart(4, '0')}`;

      return tx.billingInvoice.create({
        data: {
          number,
          workspace_id: workspaceId,
          subscription_id: subscriptionId,
          status: (params.status as any) || 'PAID',
          client_name: params.clientName,
          client_email: params.clientEmail,
          plan_name: params.planName,
          plan_interval: params.planInterval,
          seats: params.seats,
          line_items: lineItems as any,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          currency,
          notes: params.notes,
          issued_at: new Date(),
        },
      });
    }, { isolationLevel: 'Serializable' });

    this.logger.log(`Generated billing invoice ${invoice.number} for workspace ${workspaceId}`);
    return invoice;
  }

  async getPdfBuffer(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const inv = await this.prisma.billingInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const lineItems = (inv.line_items as any[]) || [];
    const buffer = await generateBillingInvoicePdf({
      id: inv.id,
      number: inv.number,
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      clientCompany: inv.client_company ?? undefined,
      clientAddress: inv.client_address ?? undefined,
      clientTaxId: inv.client_tax_id ?? undefined,
      planName: inv.plan_name,
      planInterval: inv.plan_interval,
      seats: inv.seats,
      lineItems: lineItems.map((li: Record<string, any>) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        total: li.total,
      })),
      subtotal: inv.subtotal,
      taxRate: inv.tax_rate,
      taxAmount: inv.tax_amount,
      total: inv.total,
      currency: inv.currency,
      status: inv.status,
      notes: inv.notes ?? undefined,
      issuedAt: inv.issued_at,
      dueDate: inv.due_date ?? undefined,
    } as BillingInvoicePdfData);

    return { buffer, filename: `invoice-${inv.number}.pdf` };
  }

  async findByWorkspace(workspaceId: string, filters?: { page?: number; limit?: number; search?: string }) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { workspace_id: workspaceId };

    if (filters?.search) {
      const s = filters.search;
      where.OR = [
        { number: { contains: s, mode: 'insensitive' } },
        { client_name: { contains: s, mode: 'insensitive' } },
        { plan_name: { contains: s, mode: 'insensitive' } },
        { status: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.billingInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issued_at: 'desc' },
      }),
      this.prisma.billingInvoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}
