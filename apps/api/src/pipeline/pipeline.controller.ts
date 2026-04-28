import { WorkspaceUserRole } from '@prisma/client';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PipelineService } from './pipeline.service';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';

@Controller('pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PipelineController {
  constructor(
    private readonly pipelineService: PipelineService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  @Get('stages')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  getStages(@CurrentUser('workspace_id') workspaceId: string) {
    return this.pipelineService.getStages(workspaceId);
  }

  @Post('stages')
  @Roles(WorkspaceUserRole.ADMIN)
  async createStage(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateStageDto,
  ) {
    await this.planLimits.enforcePlanTier(workspaceId, 'STARTER', 'Pipeline');
    return this.pipelineService.createStage(workspaceId, dto);
  }

  @Patch('stages/:id')
  @Roles(WorkspaceUserRole.ADMIN)
  updateStage(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.pipelineService.updateStage(workspaceId, id, dto);
  }

  @Delete('stages/:id')
  @Roles(WorkspaceUserRole.ADMIN)
  deleteStage(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.pipelineService.deleteStage(workspaceId, id);
  }

  @Get('deals')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  getDeals(@CurrentUser('workspace_id') workspaceId: string) {
    return this.pipelineService.getStages(workspaceId);
  }

  @Post('deals')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  async createDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateDealDto,
  ) {
    await this.planLimits.enforcePlanTier(workspaceId, 'STARTER', 'Pipeline');
    return this.pipelineService.createDeal(workspaceId, dto);
  }

  @Patch('deals/:id')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  updateDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.pipelineService.updateDeal(workspaceId, id, dto);
  }

  @Patch('deals/:id/move')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  moveDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: MoveDealDto,
  ) {
    return this.pipelineService.moveDeal(workspaceId, id, dto);
  }

  @Post('deals/:id/win')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  winDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.pipelineService.winDeal(workspaceId, id);
  }

  @Delete('deals/:id')
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  deleteDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.pipelineService.deleteDeal(workspaceId, id);
  }
}
