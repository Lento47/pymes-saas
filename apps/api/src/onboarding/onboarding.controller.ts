import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get(':workspaceId')
  @Roles('OWNER', 'ADMIN')
  async getProject(@Param('workspaceId') workspaceId: string) {
    return this.onboarding.getProject(workspaceId);
  }

  @Post(':workspaceId')
  @Roles('OWNER', 'ADMIN')
  async createProject(@Param('workspaceId') workspaceId: string, @Body() data: any) {
    return this.onboarding.createProject(workspaceId, data);
  }

  @Put(':workspaceId')
  @Roles('OWNER', 'ADMIN')
  async updateProject(@Param('workspaceId') workspaceId: string, @Body() data: any) {
    return this.onboarding.updateProject(workspaceId, data);
  }

  @Put(':workspaceId/checklist')
  @Roles('OWNER', 'ADMIN')
  async updateChecklistItem(
    @Param('workspaceId') workspaceId: string,
    @Body() data: { categoryIndex: number; itemIndex: number; completed: boolean; notes?: string },
  ) {
    return this.onboarding.updateChecklistItem(workspaceId, data.categoryIndex, data.itemIndex, data.completed, data.notes);
  }
}
