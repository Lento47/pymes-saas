import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateBillingInvoicePdf, type BillingInvoicePdfData } from './billing-invoice-pdf.service';

@Injectable()
export class BillingInvoiceService {
  private readonly logger = new Logger(BillingInvoiceService.name);
  private counter = 0;

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
      currency?: string;
      notes?: string;
    },
  ) {
    const currency = params.currency || 'USD';
    const taxRate = currency === 'CRC' ? 13 : 0;
    const taxAmount = Math.round(params.amount * (taxRate / 100) * 100) / 100;
    const total = Math.round((params.amount + taxAmount) * 100) / 100;

    const lineItems = [{
      description: `Plan ${params.planName} — ${params.planInterval === 'MONTHLY' ? 'Mensual' : 'Anual'}`,
      quantity: 1,
      unitPrice: params.amount,
      total: params.amount,
    }];

    const number = await this.nextNumber();

    const invoice = await this.prisma.billingInvoice.create({
      data: {
        number,
        workspace_id: workspaceId,
        subscription_id: subscriptionId,
        status: 'DRAFT',
        client_name: params.clientName,
        client_email: params.clientEmail,
        plan_name: params.planName,
        plan_interval: params.planInterval,
        seats: params.seats,
        line_items: lineItems as any,
        subtotal: params.amount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency,
        notes: params.notes,
        issued_at: new Date(),
      },
    });

    this.logger.log(`Generated billing invoice ${number} for workspace ${workspaceId}`);
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
      lineItems: lineItems.map((li: any) => ({
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

  async findByWorkspace(workspaceId: string) {
    return this.prisma.billingInvoice.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { issued_at: 'desc' },
    });
  }

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    if (this.counter === 0) {
      const last = await this.prisma.billingInvoice.findFirst({
        where: { number: { startsWith: `PH-${year}` } },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      if (last) {
        const seq = parseInt(last.number.split('-')[2] || '0', 10);
        this.counter = seq + 1;
      } else {
        this.counter = 1;
      }
    }
    return `PH-${year}-${String(this.counter++).padStart(4, '0')}`;
  }
}
