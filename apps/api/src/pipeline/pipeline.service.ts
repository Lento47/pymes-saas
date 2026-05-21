import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HaciendaStatus, InvoiceDocumentType, InvoiceIssuanceMode, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  private readonly logger = new Logger(PipelineService.name);
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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

  async getDeals(workspaceId: string) {
    return this.prisma.deal.findMany({
      where: { stage: { workspace_id: workspaceId } },
      orderBy: { created_at: 'desc' },
      include: DEAL_INCLUDE,
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
    const deal = await this.prisma.deal.create({
      data: {
        workspace_id: workspaceId,
        stage_id: dto.stage_id,
        contact_id: dto.contact_id || null,
        assigned_user_id: dto.assigned_user_id || null,
        title: dto.title,
        value: dto.value ?? null,
        currency: dto.currency ?? 'CRC',
        priority: dto.priority ?? 'MEDIUM',
        closing_date: dto.closing_date ? new Date(dto.closing_date) : null,
        notes: dto.notes ?? null,
      },
      include: DEAL_INCLUDE,
    });

    if (deal.assigned_user_id) {
      this.notificationsService.create(workspaceId, {
        user_id: deal.assigned_user_id,
        type: 'deal_created',
        title: 'Nuevo negocio creado',
        body: `Se te asignó el negocio "${deal.title}" en el pipeline.`,
        related_entity_type: 'deal',
        related_entity_id: deal.id,
      }).catch((err) =>
        this.logger.warn(`Pipeline notification failed for workspace ${workspaceId}`, err),
      );
    }

    this.trackQuickStart(workspaceId, 'pipeline_created');
    return deal;
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
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { stage_id: dto.stage_id },
      include: { assigned_user: { select: { id: true } }, stage: { select: { name: true } } },
    });
    if (deal.assigned_user_id) {
      this.notificationsService.create(workspaceId, {
        user_id: deal.assigned_user_id,
        type: 'deal_stage_changed',
        title: 'Negocio movido de etapa',
        body: `El negocio "${deal.title}" pasó a la etapa "${deal.stage?.name || 'nueva'}".`,
        related_entity_type: 'deal',
        related_entity_id: deal.id,
      }).catch((err) =>
        this.logger.warn(`Pipeline notification failed for workspace ${workspaceId}`, err),
      );
    }
    return deal;
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

    const amount = deal.value ? Number(deal.value) : 0;
    const dueDate = deal.closing_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Interactive transaction: count + insert atomically to prevent duplicate invoice numbers
    const [updatedDeal, invoice] = await this.prisma.$transaction(async (tx) => {
      const invoiceCount = await tx.invoice.count({ where: { workspace_id: workspaceId } });
      const invoiceNumber = `DEAL-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

      return Promise.all([
        tx.deal.update({
          where: { id },
          data: { status: 'WON' },
          include: { assigned_user: { select: { id: true } } },
        }),
        tx.invoice.create({
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
    });

    if (deal.assigned_user_id) {
      this.notificationsService.create(workspaceId, {
        user_id: deal.assigned_user_id,
        type: 'deal_won',
        title: '¡Negocio ganado!',
        body: `El negocio "${deal.title}" fue marcado como ganado. Se generó la factura ${invoice.number}.`,
        related_entity_type: 'deal',
        related_entity_id: deal.id,
      }).catch((err) =>
        this.logger.warn(`Pipeline notification failed for workspace ${workspaceId}`, err),
      );
    }

    return { deal: updatedDeal, invoice_id: invoice.id, invoice_number: invoice.number };
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

  private async trackQuickStart(workspaceId: string, step: string) {
    try {
      const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings_json: true } });
      const s: Record<string, any> = (ws?.settings_json && typeof ws.settings_json === 'object') ? ws.settings_json : {};
      const progress = s.quick_start_progress || {};
      if (progress[step]) return;
      s.quick_start_progress = { ...progress, [step]: true };
      await this.prisma.workspace.update({ where: { id: workspaceId }, data: { settings_json: s } });
    } catch { /* fire-and-forget */ }
  }
}
