import { Controller, Get, UseGuards } from "@nestjs/common";
import { WorkspaceUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { AiTokenMeteringService } from "./ai-token-metering.service";
import { RequirePermission, Permission } from "../common/permissions";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("ai-tokens")
@RequirePermission(Permission.AI_USE)
export class AiTokensController {
  constructor(private readonly aiTokens: AiTokenMeteringService) {}

  @Get()
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  async getTokens(@CurrentUser() user: AuthUser) {
    const [balance, history] = await Promise.all([
      this.aiTokens.getBalance(user.workspace_id),
      this.aiTokens.getTransactionHistory(user.workspace_id),
    ]);
    return { ...balance, history, packs: this.aiTokens.getTokenPacks() };
  }
}
