import { WorkspaceUserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { WorkspacesService } from './workspaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { TestAiConnectionDto } from './dto/test-ai-connection.dto';

@Controller('workspaces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspacesController {
  constructor(
    private readonly service: WorkspacesService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  // ── Workspace ──────────────────────────────────────────────────────────────

  @Get('current')
  getCurrent(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getCurrent(workspaceId);
  }

  @Get('current/subscription')
  getSubscription(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getSubscription(workspaceId);
  }

  @Get('current/stats')
  getStats(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getStats(workspaceId);
  }

  @Get('current/stats/today')
  getTodayStats(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getTodayStats(workspaceId);
  }

  @Get('current/api-keys')
  @Roles(WorkspaceUserRole.ADMIN)
  getApiKeys(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getApiKeys(workspaceId);
  }

  @Get('current/export')
  @Roles(WorkspaceUserRole.ADMIN)
  exportData(@CurrentUser('workspace_id') workspaceId: string, @Query('type') type: string) {
    return this.service.exportData(workspaceId, type);
  }

  @Patch('current')
  @Roles(WorkspaceUserRole.ADMIN)
  updateCurrent(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.service.updateCurrent(workspaceId, dto);
  }

  @Post('current/ai/test')
  @Roles(WorkspaceUserRole.ADMIN)
  testAiConnection(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: TestAiConnectionDto,
  ) {
    return this.service.testAiConnection(workspaceId, dto);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get('current/members')
  getMembers(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getMembers(workspaceId);
  }

  @Post('current/members/invite')
  @Roles(WorkspaceUserRole.ADMIN)
  async inviteUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteUserDto,
  ) {
    await this.planLimits.enforceMembers(user.workspace_id);
    return this.service.inviteUser(user.workspace_id, user, dto);
  }

  @Patch('current/members/:userId/role')
  @Roles(WorkspaceUserRole.ADMIN)
  changeMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.service.changeMemberRole(user.workspace_id, user, targetUserId, dto);
  }

  @Delete('current/members/:userId')
  @Roles(WorkspaceUserRole.ADMIN)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
  ) {
    return this.service.removeMember(user.workspace_id, user, targetUserId);
  }
}
