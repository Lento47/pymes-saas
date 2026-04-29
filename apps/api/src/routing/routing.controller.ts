import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceUserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';

const INCLUDE = {
  department: { select: { id: true, name: true, color: true } },
  channel: { select: { id: true, name: true, type: true } },
} as const;

@Controller('routing/rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@CurrentUser('workspace_id') workspaceId: string) {
    return this.prisma.routingRule.findMany({
      where: { workspace_id: workspaceId },
      orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
      include: INCLUDE,
    });
  }

  @Post()
  @Roles(WorkspaceUserRole.ADMIN)
  create(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateRoutingRuleDto,
  ) {
    return this.prisma.routingRule.create({
      data: {
        workspace_id: workspaceId,
        channel_id: dto.channel_id ?? null,
        name: dto.name,
        match_type: dto.match_type ?? 'KEYWORD',
        pattern: dto.pattern.trim().toLowerCase(),
        department_id: dto.department_id,
        priority: dto.priority ?? 0,
        is_active: dto.is_active ?? true,
      },
      include: INCLUDE,
    });
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  async update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoutingRuleDto,
  ) {
    const rule = await this.prisma.routingRule.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!rule) throw new NotFoundException('Routing rule not found.');

    return this.prisma.routingRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.match_type !== undefined && { match_type: dto.match_type }),
        ...(dto.pattern !== undefined && {
          pattern: dto.pattern.trim().toLowerCase(),
        }),
        ...(dto.department_id !== undefined && {
          department_id: dto.department_id,
        }),
        ...(dto.channel_id !== undefined && { channel_id: dto.channel_id }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
      include: INCLUDE,
    });
  }

  @Delete(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  async remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    const rule = await this.prisma.routingRule.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!rule) throw new NotFoundException('Routing rule not found.');

    await this.prisma.routingRule.delete({ where: { id } });
    return { deleted: true };
  }
}
