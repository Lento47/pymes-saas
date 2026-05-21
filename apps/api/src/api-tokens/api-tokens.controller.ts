import { Controller, Get, Post, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { ApiTokensService } from "./api-tokens.service";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";

@Controller("workspaces/current/api-tokens")
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private readonly service: ApiTokensService) {}

  @Get()
  async listTokens(@CurrentUser() user: AuthUser) {
    return this.service.getTokens(user.workspace_id);
  }

  @Post()
  async createToken(@CurrentUser() user: AuthUser, @Body() body: { name: string }) {
    return this.service.createToken(user.workspace_id, body.name);
  }

  @Delete(":id")
  async revokeToken(@CurrentUser() user: AuthUser, @Param("id", ValidateUUIDPipe) id: string) {
    await this.service.revokeToken(user.workspace_id, id);
    return { ok: true };
  }
}
