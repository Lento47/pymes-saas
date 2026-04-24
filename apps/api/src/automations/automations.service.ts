import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TriggerType } from '../common/types/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { FilterAutomationsDto } from './dto/filter-automations.dto';
import { QueueService } from '../workers/queue.service';
import { PlanLimitsService } from '../billing/plan-limits.service';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async findAll(workspaceId: string, filters: FilterAutomationsDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId };

    if (filters.enabled !== undefined) {
      where.enabled = filters.enabled === 'true';
    }

    if (filters.trigger_type) {
      where.trigger_type = filters.trigger_type;
    }

    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { executions: true },
          },
        },
      }),
      this.prisma.automationRule.count({ where }),
    ]);

    return {
      data: data.map((rule) => ({
        ...rule,
        execution_count: rule._count.executions,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateAutomationDto,
  ) {
    await this.planLimits.checkAutomationLimit(workspaceId);

    return this.prisma.automationRule.create({
      data: {
        workspace_id: workspaceId,
        created_by_user_id: userId,
        name: dto.name,
        description: dto.description,
        trigger_type: dto.trigger_type,
        trigger_config_json: dto.trigger_config_json as any,
        condition_config_json: dto.condition_config_json as any,
        action_config_json: dto.action_config_json as any,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        executions: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
      },
    });

    if (!rule) {
      throw new NotFoundException(`Automation rule ${id} not found`);
    }

    return rule;
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateAutomationDto,
  ) {
    await this.findOne(workspaceId, id);

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.trigger_type !== undefined && { trigger_type: dto.trigger_type }),
        ...(dto.trigger_config_json !== undefined && {
          trigger_config_json: dto.trigger_config_json as any,
        }),
        ...(dto.condition_config_json !== undefined && {
          condition_config_json: dto.condition_config_json as any,
        }),
        ...(dto.action_config_json !== undefined && {
          action_config_json: dto.action_config_json as any,
        }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
  }

  async toggle(workspaceId: string, id: string) {
    const rule = await this.findOne(workspaceId, id);

    return this.prisma.automationRule.update({
      where: { id },
      data: { enabled: !rule.enabled },
    });
  }

  async getExecutions(
    workspaceId: string,
    ruleId: string,
    page: number,
    limit: number,
  ) {
    await this.findOne(workspaceId, ruleId);

    const _page = Number(page) || 1;
    const _limit = Number(limit) || 20;
    const skip = (_page - 1) * _limit;

    const [data, total] = await Promise.all([
      this.prisma.automationExecution.findMany({
        where: { rule_id: ruleId },
        skip,
        take: _limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.automationExecution.count({
        where: { rule_id: ruleId },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page: _page,
        limit: _limit,
        totalPages: Math.ceil(total / _limit),
      },
    };
  }

  async triggerRules(
    workspaceId: string,
    triggerType: TriggerType,
    triggerEntityType: string,
    triggerEntityId: string,
  ) {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        workspace_id: workspaceId,
        trigger_type: triggerType,
        enabled: true,
      },
      select: { id: true },
    });

    await Promise.all(
      rules.map((rule) =>
        this.queueService.enqueueAutomation(
          rule.id,
          workspaceId,
          triggerEntityType,
          triggerEntityId,
        ),
      ),
    );

    return { queued: rules.length };
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.automationRule.delete({ where: { id } });
  }
}
