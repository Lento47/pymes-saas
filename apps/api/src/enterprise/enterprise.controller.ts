import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { EnterpriseService } from "./enterprise.service";

@Controller("enterprise")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  // ─── Workspace enterprise config ─────────────────────────────────────

  @Get("config")
  @Roles("OWNER", "ADMIN")
  async getConfig(@CurrentUser("workspace_id") workspaceId: string) {
    return this.enterprise.getConfig(workspaceId);
  }

  @Put("config")
  @Roles("OWNER", "ADMIN")
  async upsertConfig(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() data: Record<string, any>,
  ) {
    return this.enterprise.upsertConfig(workspaceId, data);
  }

  @Delete("config")
  @Roles("OWNER")
  async deleteConfig(@CurrentUser("workspace_id") workspaceId: string) {
    await this.enterprise.deleteConfig(workspaceId);
    return { deleted: true };
  }

  // ─── Capabilities admin ──────────────────────────────────────────────

  @Get("capabilities")
  @Roles("OWNER", "ADMIN")
  async getCapabilities() {
    return this.enterprise.getCapabilities();
  }

  @Post("capabilities")
  @Roles("OWNER", "ADMIN")
  async createCapability(@Body() data: Record<string, any>) {
    return this.enterprise.upsertCapability(undefined, data);
  }

  @Put("capabilities/:id")
  @Roles("OWNER", "ADMIN")
  async updateCapability(@Param("id") id: string, @Body() data: Record<string, any>) {
    return this.enterprise.upsertCapability(id, data);
  }
}
