import { WorkspaceUserRole } from '@prisma/client';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { FilterAutomationsDto } from './dto/filter-automations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FeatureFlagGuard, RequireFeature } from '../feature-flags/feature-flags.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { FeaturesService } from '../features/features.service';

@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@Controller('automations')
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly planLimits: PlanLimitsService,
    private readonly features: FeaturesService,
  ) {}

  @Get()
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findAll(
    @CurrentUser('workspace_id') workspaceId: string,
    @Query() filters: FilterAutomationsDto,
  ) {
    return this.automationsService.findAll(workspaceId, filters);
  }

  @Post()
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  async create(
    @CurrentUser('workspace_id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    await this.features.assertEnabled(workspaceId, 'automations');
    await this.planLimits.enforceAutomations(workspaceId);
    // Advanced condition builder requires GROWTH+
    if (dto.condition_config_json && Object.keys(dto.condition_config_json).length > 0) {
      await this.planLimits.enforcePlanTier(workspaceId, 'GROWTH', 'Constructor avanzado de condiciones');
    }
    return this.automationsService.create(workspaceId, userId, dto);
  }

  @Get(':id')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findOne(
    @CurrentUser() user: Record<string, any>,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.automationsService.findOne(user.workspace_id, id);
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  update(
    @CurrentUser() user: Record<string, any>,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationsService.update(user.workspace_id, id, dto);
  }

  @Post(':id/toggle')
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  toggle(
    @CurrentUser() user: Record<string, any>,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.automationsService.toggle(user.workspace_id, id);
  }

  @Get(':id/executions')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  getExecutions(
    @CurrentUser() user: Record<string, any>,
    @Param('id', ValidateUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.automationsService.getExecutions(
      user.workspace_id,
      id,
      pagination.page,
      pagination.limit,
    );
  }
  @Delete(':id')
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  remove(
    @CurrentUser() user: Record<string, any>,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.automationsService.remove(user.workspace_id, id);
  }
}


