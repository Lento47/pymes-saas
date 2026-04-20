import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, filters: FilterInvoicesDto) {
    const {
      status,
      contact_id,
      overdue_only,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = { workspace_id: workspaceId };

    if (status) where.status = status;
    if (contact_id) where.contact_id = contact_id;

    if (overdue_only) {
      where.due_date = { lt: new Date() };
      where.status = { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] };
    }

    const [data, total, aggregate] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
        include: {
          contact: {
            select: {
              id: true,
              full_name: true,
              company_name: true,
              email: true,
              phone: true,
            },
          },
          reminders: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

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
      },
    };
  }

  async findOne(workspaceId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        contact: {
          select: {
            id: true,
            full_name: true,
            company_name: true,
            email: true,
            phone: true,
          },
        },
        reminders: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return invoice;
  }

  async create(workspaceId: string, dto: CreateInvoiceDto) {
    await this.assertContact(workspaceId, dto.contact_id);
    await this.ensureUniqueNumber(workspaceId, dto.number);

    return this.prisma.invoice.create({
      data: {
        workspace_id: workspaceId,
        contact_id: dto.contact_id,
        number: dto.number,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        due_date: new Date(dto.due_date),
        description: dto.description,
        notes_json: (dto.notes as any) ?? undefined,
      },
      include: {
        contact: {
          select: { id: true, full_name: true, email: true, phone: true },
        },
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateInvoiceDto) {
    await this.findOne(workspaceId, id);

    if (dto.contact_id) {
      await this.assertContact(workspaceId, dto.contact_id);
    }

    if (dto.number) {
      await this.ensureUniqueNumber(workspaceId, dto.number, id);
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.contact_id !== undefined && {
          contact: { connect: { id: dto.contact_id } },
        }),
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.due_date !== undefined && { due_date: new Date(dto.due_date) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.notes !== undefined && { notes_json: dto.notes as any }),
        updated_at: new Date(),
      },
      include: {
        contact: {
          select: { id: true, full_name: true, email: true, phone: true },
        },
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Factura eliminada.' };
  }

  async markPaid(workspaceId: string, id: string) {
    const invoice = await this.findOne(workspaceId, id);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se puede marcar como pagada una factura cancelada.');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('La factura ya está marcada como pagada.');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paid_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  private async assertContact(workspaceId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspace_id: workspaceId },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado.');
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
}
