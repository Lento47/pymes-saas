import { WorkspaceUserRole } from "@prisma/client";
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
} from "@nestjs/common";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { WorkspacesService } from "./workspaces.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { ChangeMemberRoleDto } from "./dto/change-member-role.dto";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { FeaturesService } from "../features/features.service";
import { TestAiConnectionDto } from "./dto/test-ai-connection.dto";
import { BusinessProfileDto } from "./dto/business-profile.dto";

@Controller("workspaces")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspacesController {
  constructor(
    private readonly service: WorkspacesService,
    private readonly planLimits: PlanLimitsService,
    private readonly features: FeaturesService,
  ) {}

  // ── Workspace ──────────────────────────────────────────────────────────────

  @Get("current")
  getCurrent(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getCurrent(workspaceId);
  }

  @Get("current/dashboard")
  getDashboard(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getDashboard(workspaceId);
  }

  @Get("current/subscription")
  getSubscription(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getSubscription(workspaceId);
  }

  @Get("current/features")
  getFeatures(@CurrentUser("workspace_id") workspaceId: string) {
    return this.features.getEffectiveFeatures(workspaceId);
  }

  @Get("current/setup")
  getSetupChecklist(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getSetupChecklist(workspaceId);
  }

  @Post("current/setup/dismiss")
  dismissSetupChecklist(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.dismissSetupChecklist(workspaceId);
  }

  @Get("current/automation-recipes")
  getAutomationRecipes(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getAutomationRecipes(workspaceId);
  }

  @Patch("current/automation-recipes/:slug")
  @Roles(WorkspaceUserRole.ADMIN)
  toggleAutomationRecipe(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("slug") slug: string,
    @Body() dto: { config?: Record<string, string> },
  ) {
    return this.service.toggleAutomationRecipe(workspaceId, slug, dto.config);
  }

  @Get("current/stats")
  getStats(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getStats(workspaceId);
  }

  @Get("current/stats/today")
  getTodayStats(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getTodayStats(workspaceId);
  }

  @Get("current/api-keys")
  @Roles(WorkspaceUserRole.ADMIN)
  getApiKeys(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getApiKeys(workspaceId);
  }

  @Get("current/export")
  @Roles(WorkspaceUserRole.ADMIN)
  exportData(@CurrentUser("workspace_id") workspaceId: string, @Query("type") type: string) {
    return this.service.exportData(workspaceId, type);
  }

  @Post("current/data-export")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  requestDataExport(@CurrentUser() user: AuthUser) {
    return this.service.requestDataExport(user.workspace_id, user);
  }

  @Get("current/landing-config")
  @Roles(WorkspaceUserRole.ADMIN)
  async getLandingConfig(@CurrentUser("workspace_id") workspaceId: string) {
    const workspace = await this.service.getCurrent(workspaceId);
    const settings =
      workspace.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return settings.landing_config ?? {};
  }

  @Patch("current/landing-config")
  @Roles(WorkspaceUserRole.ADMIN)
  async updateLandingConfig(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() dto: Record<string, any>,
  ) {
    const workspace = await this.service.getCurrent(workspaceId);
    const settings =
      workspace.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};
    const current =
      settings.landing_config && typeof settings.landing_config === "object"
        ? (settings.landing_config as Record<string, any>)
        : {};
    const landing_config = {
      ...current,
      ...dto,
      updated_at: new Date().toISOString(),
    };

    await this.service.updateCurrent(workspaceId, {
      settings_json: { landing_config },
    } as UpdateWorkspaceDto);

    return landing_config;
  }

  @Get("current/ai-settings")
  async getAiSettings(@CurrentUser("workspace_id") workspaceId: string) {
    const workspace = await this.service.getCurrent(workspaceId);
    const settings =
      workspace.settings_json && typeof workspace.settings_json === "object"
        ? (workspace.settings_json as Record<string, any>)
        : {};

    return {
      ai_delegated_by_default: settings.ai_delegated_by_default !== false,
      ai_always_respond: settings.ai_always_respond === true,
      human_handover_timeout_ms: settings.human_handover_timeout_ms ?? 180000,
    };
  }

  @Patch("current")
  @Roles(WorkspaceUserRole.ADMIN)
  updateCurrent(@CurrentUser("workspace_id") workspaceId: string, @Body() dto: UpdateWorkspaceDto) {
    return this.service.updateCurrent(workspaceId, dto);
  }

  @Post("current/ai/test")
  @Roles(WorkspaceUserRole.ADMIN)
  async testAiConnection(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() dto: TestAiConnectionDto,
  ) {
    await this.planLimits.enforcePlanTier(workspaceId, "ENTERPRISE", "Inteligencia Artificial");
    return this.service.testAiConnection(workspaceId, dto);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get("current/members")
  getMembers(@CurrentUser("workspace_id") workspaceId: string) {
    return this.service.getMembers(workspaceId);
  }

  @Post("current/members/invite")
  @Roles(WorkspaceUserRole.ADMIN)
  async inviteUser(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    await this.planLimits.enforceMembers(user.workspace_id);
    return this.service.inviteUser(user.workspace_id, user, dto);
  }

  @Patch("current/members/:userId/role")
  @Roles(WorkspaceUserRole.ADMIN)
  changeMemberRole(
    @CurrentUser() user: AuthUser,
    @Param("userId") targetUserId: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.service.changeMemberRole(user.workspace_id, user, targetUserId, dto);
  }

  @Delete("current/members/:userId")
  @Roles(WorkspaceUserRole.ADMIN)
  removeMember(@CurrentUser() user: AuthUser, @Param("userId") targetUserId: string) {
    return this.service.removeMember(user.workspace_id, user, targetUserId);
  }

  @Get("business-profile")
  getBusinessProfile(@CurrentUser() user: AuthUser) {
    return this.service.getBusinessProfile(user.workspace_id);
  }

  @Post("business-profile")
  saveBusinessProfile(@CurrentUser() user: AuthUser, @Body() dto: BusinessProfileDto) {
    return this.service.saveBusinessProfile(user.workspace_id, dto);
  }
}
