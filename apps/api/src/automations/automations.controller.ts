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
    @CurrentUser() user: any,
    @Query() filters: FilterAutomationsDto,
  ) {
    return this.automationsService.findAll(user.workspace_id, filters);
  }

  @Post()
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateAutomationDto,
  ) {
    await this.features.assertEnabled(user.workspace_id, 'automations');
    await this.planLimits.enforceAutomations(user.workspace_id);
    // Advanced condition builder requires GROWTH+
    if (dto.condition_config_json && Object.keys(dto.condition_config_json).length > 0) {
      await this.planLimits.enforcePlanTier(user.workspace_id, 'GROWTH', 'Constructor avanzado de condiciones');
    }
    return this.automationsService.create(user.workspace_id, user.id, dto);
  }

  @Get(':id')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findOne(
    @CurrentUser() user: any,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.automationsService.findOne(user.workspace_id, id);
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  update(
    @CurrentUser() user: any,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationsService.update(user.workspace_id, id, dto);
  }

  @Post(':id/toggle')
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  @RequireFeature('automations')
  toggle(
    @CurrentUser() user: any,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.automationsService.toggle(user.workspace_id, id);
  }

  @Get(':id/executions')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  getExecutions(
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.automationsService.remove(user.workspace_id, id);
  }
}


