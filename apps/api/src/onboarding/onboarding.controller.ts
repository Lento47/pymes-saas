import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { WorkspaceUserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('status')
  async getStatus(@CurrentUser('workspace_id') workspaceId: string) {
    return this.onboarding.getStatus(workspaceId);
  }

  @Get()
  @Roles(WorkspaceUserRole.OWNER, WorkspaceUserRole.ADMIN)
  async getProject(@CurrentUser('workspace_id') workspaceId: string) {
    return this.onboarding.getProject(workspaceId);
  }

  @Post()
  @Roles(WorkspaceUserRole.OWNER, WorkspaceUserRole.ADMIN)
  async saveProject(@CurrentUser('workspace_id') workspaceId: string, @Body() data: Record<string, any>) {
    return this.onboarding.saveProject(workspaceId, data);
  }

  @Put()
  @Roles(WorkspaceUserRole.OWNER, WorkspaceUserRole.ADMIN)
  async updateProject(@CurrentUser('workspace_id') workspaceId: string, @Body() data: Record<string, any>) {
    return this.onboarding.updateProject(workspaceId, data);
  }

  @Put('checklist')
  @Roles(WorkspaceUserRole.OWNER, WorkspaceUserRole.ADMIN)
  async updateChecklistItem(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() data: { categoryIndex: number; itemIndex: number; completed: boolean; notes?: string },
  ) {
    return this.onboarding.updateChecklistItem(workspaceId, data.categoryIndex, data.itemIndex, data.completed, data.notes);
  }
}
