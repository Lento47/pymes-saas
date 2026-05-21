import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PipelineService } from './pipeline.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';

@Controller('pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('stages')
  getStages(@CurrentUser('workspace_id') workspaceId: string) {
    return this.pipelineService.getStages(workspaceId);
  }

  @Post('stages')
  @Roles('ADMIN' as any)
  createStage(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.pipelineService.createStage(workspaceId, dto);
  }

  @Patch('stages/:id')
  @Roles('ADMIN' as any)
  updateStage(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.pipelineService.updateStage(workspaceId, id, dto);
  }

  @Delete('stages/:id')
  @Roles('ADMIN' as any)
  deleteStage(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.pipelineService.deleteStage(workspaceId, id);
  }

  @Get('deals')
  getDeals(@CurrentUser('workspace_id') workspaceId: string) {
    return this.pipelineService.getStages(workspaceId);
  }

  @Post('deals')
  @Roles('AGENT' as any)
  createDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateDealDto,
  ) {
    return this.pipelineService.createDeal(workspaceId, dto);
  }

  @Patch('deals/:id')
  @Roles('AGENT' as any)
  updateDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.pipelineService.updateDeal(workspaceId, id, dto);
  }

  @Patch('deals/:id/move')
  @Roles('AGENT' as any)
  moveDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: MoveDealDto,
  ) {
    return this.pipelineService.moveDeal(workspaceId, id, dto);
  }

  @Post('deals/:id/win')
  @Roles('AGENT' as any)
  winDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.pipelineService.winDeal(workspaceId, id);
  }

  @Delete('deals/:id')
  @Roles('AGENT' as any)
  deleteDeal(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.pipelineService.deleteDeal(workspaceId, id);
  }
}
