import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FeatureFlagGuard, RequireFeature } from "../feature-flags/feature-flags.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { MessageTemplatesService } from "./message-templates.service";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";

@Controller("message-templates")
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
export class MessageTemplatesController {
  constructor(private readonly templates: MessageTemplatesService) {}

  @Get()
  async list(@CurrentUser("workspace_id") workspaceId: string, @Query("channel") channel?: string) {
    return this.templates.list(workspaceId, channel);
  }

  @Get("approved")
  // NOTE: NestJS resolves static routes ('approved') before parameterized ones
  // (':id'), so this does NOT conflict with getById below. Keep this route
  // before :id in file order as a defensive practice.
  async getApproved(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("channel") channel?: string,
  ) {
    return this.templates.getApprovedForChannel(workspaceId, channel ?? "WHATSAPP");
  }

  @Get(":id")
  async getById(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.templates.getById(workspaceId, id);
  }

  @Post()
  @RequireFeature("message_templates")
  async create(@CurrentUser() user: AuthUser, @Body() data: Record<string, any>) {
    return this.templates.create(user.workspace_id, user.id, data);
  }

  @Put(":id")
  @RequireFeature("message_templates")
  async update(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() data: Record<string, any>,
  ) {
    return this.templates.update(workspaceId, id, data);
  }

  @Delete(":id")
  @RequireFeature("message_templates")
  async delete(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.templates.delete(workspaceId, id);
  }
}
