import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UsageMeteringService } from "./usage-metering.service";

@Controller("usage")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsageMeteringController {
  constructor(private readonly usageMetering: UsageMeteringService) {}

  @Get()
  @Roles("OWNER", "ADMIN")
  async getCurrentUsage(@CurrentUser("workspace_id") workspaceId: string) {
    return this.usageMetering.getCurrentUsage(workspaceId);
  }

  @Post("snapshot")
  @Roles("OWNER", "ADMIN")
  async createSnapshot(@CurrentUser("workspace_id") workspaceId: string) {
    return this.usageMetering.createSnapshot(workspaceId);
  }

  @Get("history")
  @Roles("OWNER", "ADMIN")
  async getHistory(@CurrentUser("workspace_id") workspaceId: string) {
    return this.usageMetering.getUsageHistory(workspaceId);
  }
}
