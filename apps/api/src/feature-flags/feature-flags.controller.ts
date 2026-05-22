import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { FeatureFlagsService } from "./feature-flags.service";

@Controller("feature-flags")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get("check")
  async getAll(@CurrentUser("workspace_id") workspaceId: string) {
    const dbFlags = await this.featureFlags.getAll(workspaceId);
    const profileFlags = await this.featureFlags.getProfileFlags(workspaceId);
    // Profile flags take precedence over DB plan-based flags
    return { ...dbFlags, ...profileFlags };
  }

  @Get("profile")
  async getProfile(@CurrentUser("workspace_id") workspaceId: string) {
    const profile = await this.featureFlags.getProfile(workspaceId);
    const flags = await this.featureFlags.getProfileFlags(workspaceId);
    const sidebarItems = this.featureFlags.getSidebarItems(profile);
    return { profile, flags, sidebarItems };
  }

  @Get("public")
  async getPublic() {
    return this.featureFlags.getPublicFlags();
  }

  @Post()
  @Roles("OWNER", "ADMIN")
  async createFlag(@Body() data: Record<string, any>) {
    return this.featureFlags.upsertFlag(undefined, data);
  }

  @Put(":id")
  @Roles("OWNER", "ADMIN")
  async updateFlag(@Param("id") id: string, @Body() data: Record<string, any>) {
    return this.featureFlags.upsertFlag(id, data);
  }

  @Delete(":id")
  @Roles("OWNER")
  async deleteFlag(@Param("id") id: string) {
    return this.featureFlags.deleteFlag(id);
  }
}
