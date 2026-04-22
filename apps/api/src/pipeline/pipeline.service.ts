import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HaciendaStatus, InvoiceDocumentType, InvoiceIssuanceMode, InvoiceStatus } from '../../src/common/types/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';

const DEAL_INCLUDE = {
  contact: { select: { id: true, full_name: true, company_name: true } },
  assigned_user: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, color: true } },
} as const;

const DEFAULT_STAGES = [
  { name: 'Prospecto',    color: '#6366f1', order: 0 },
  { name: 'Contactado',   color: '#3b82f6', order: 1 },
  { name: 'Propuesta',    color: '#f59e0b', order: 2 },
  { name: 'Negociación',  color: '#f97316', order: 3 },
  { name: 'Ganado',       color: '#22c55e', order: 4 },
  { name: 'Perdido',      color: '#ef4444', order: 5 },
];

@Injectable()
export class PipelineService {
  constructor(private prisma: PrismaService) {}

  async getStages(workspaceId: string) {
    const count = await this.prisma.dealStage.count({ where: { workspace_id: workspaceId } });
    if (count === 0) {
      await this.prisma.dealStage.createMany({
        data: DEFAULT_STAGES.map(s => ({ ...s, workspace_id: workspaceId })),
      });
    }
    return this.prisma.dealStage.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { order: 'asc' },
      include: {
        deals: {
          where: { status: 'OPEN' },
          orderBy: { created_at: 'desc' },
          include: {
            contact: { select: { id: true, full_name: true, company_name: true } },
            assigned_user: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async createStage(workspaceId: string, dto: CreateStageDto) {
    const agg = await this.prisma.dealStage.aggregate({
      where: { workspace_id: workspaceId },
      _max: { order: true },
    });
    return this.prisma.dealStage.create({
      data: {
        workspace_id: workspaceId,
        name: dto.name,
        color: dto.color ?? '#6366f1',
        order: (agg._max.order ?? -1) + 1,
      },
    });
  }

  async updateStage(workspaceId: string, id: string, dto: UpdateStageDto) {
    await this.ensureStage(workspaceId, id);
    return this.prisma.dealStage.update({ where: { id }, data: dto });
  }

  async deleteStage(workspaceId: string, id: string) {
    await this.ensureStage(workspaceId, id);
    await this.prisma.dealStage.delete({ where: { id } });
    return { success: true };
  }

  async createDeal(workspaceId: string, dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        workspace_id: workspaceId,
        stage_id: dto.stage_id,
        contact_id: dto.contact_id ?? null,
        assigned_user_id: dto.assigned_user_id ?? null,
        title: dto.title,
        value: dto.value ?? null,
        currency: dto.currency ?? 'CRC',
        priority: dto.priority ?? 'MEDIUM',
        closing_date: dto.closing_date ? new Date(dto.closing_date) : null,
        notes: dto.notes ?? null,
      },
      include: DEAL_INCLUDE,
    });
  }

  async updateDeal(workspaceId: string, id: string, dto: UpdateDealDto) {
    await this.ensureDeal(workspaceId, id);
    const { closing_date, ...rest } = dto;
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...rest,
        ...(closing_date !== undefined
          ? { closing_date: closing_date ? new Date(closing_date) : null }
          : {}),
      },
      include: DEAL_INCLUDE,
    });
  }

  async moveDeal(workspaceId: string, id: string, dto: MoveDealDto) {
    await this.ensureDeal(workspaceId, id);
    return this.prisma.deal.update({
      where: { id },
      data: { stage_id: dto.stage_id },
    });
  }

  async deleteDeal(workspaceId: string, id: string) {
    await this.ensureDeal(workspaceId, id);
    await this.prisma.deal.delete({ where: { id } });
    return { success: true };
  }

  async winDeal(workspaceId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, workspace_id: workspaceId },
      include: { contact: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.status === 'WON') throw new BadRequestException('Deal already won');
    if (!deal.contact_id) throw new BadRequestException('Deal needs a contact to generate invoice');

    const invoiceCount = await this.prisma.invoice.count({ where: { workspace_id: workspaceId } });
    const invoiceNumber = `DEAL-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

    const amount = deal.value ? Number(deal.value) : 0;
    const dueDate = deal.closing_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [updatedDeal, invoice] = await this.prisma.$transaction([
      this.prisma.deal.update({
        where: { id },
        data: { status: 'WON' },
      }),
      this.prisma.invoice.create({
        data: {
          workspace_id: workspaceId,
          contact_id: deal.contact_id,
          number: invoiceNumber,
          amount,
          currency: deal.currency,
          due_date: dueDate,
          description: deal.notes ?? deal.title,
          status: InvoiceStatus.DRAFT,
          document_type: InvoiceDocumentType.FACTURA_ELECTRONICA,
          issuance_mode: InvoiceIssuanceMode.MANUAL_ONLY,
          hacienda_status: HaciendaStatus.DRAFT,
          issue_date: new Date(),
        },
      }),
    ]);

    return { deal: updatedDeal, invoice_id: invoice.id, invoice_number: invoiceNumber };
  }

  private async ensureStage(workspaceId: string, id: string) {
    const stage = await this.prisma.dealStage.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!stage) throw new NotFoundException('Stage not found');
    return stage;
  }

  private async ensureDeal(workspaceId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }
}
