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
import { ChannelsService } from "./channels.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { ConfigureEmailDto } from "./dto/configure-email.dto";
import { ConfigureWhatsAppDto } from "./dto/configure-whatsapp.dto";
import { ConfigureTelegramDto } from "./dto/configure-telegram.dto";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("channels")
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  @Post()
  @Roles(WorkspaceUserRole.ADMIN)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { type: string; name: string; provider?: string },
  ) {
    return this.channelsService.create(user.workspace_id, body, user.id);
  }

  @Get()
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  findAll(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("include_inactive") includeInactive?: string,
  ) {
    return this.channelsService.findAll(workspaceId, includeInactive === "true");
  }

  @Get("whatsapp-config")
  getWhatsAppConfig() {
    return {
      webhookUrl: "https://pymeshub.lat/api/inbound/whatsapp/webhook",
      verifyTokenConfigured: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    };
  }

  @Get(":id")
  @Roles(
    WorkspaceUserRole.VIEWER,
    WorkspaceUserRole.AGENT,
    WorkspaceUserRole.ADMIN,
    WorkspaceUserRole.OWNER,
  )
  findOne(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.findOne(workspaceId, id);
  }

  @Patch(":id")
  @Roles(WorkspaceUserRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() body: { name?: string; status?: string },
  ) {
    return this.channelsService.update(user.workspace_id, id, body, user.id);
  }

  @Delete(":id")
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.remove(user.workspace_id, id, user.id);
  }

  @Post(":id/connect")
  @Roles(WorkspaceUserRole.ADMIN)
  connect(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.connect(user.workspace_id, id, user.id);
  }

  @Post(":id/disconnect")
  @Roles(WorkspaceUserRole.ADMIN)
  disconnect(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.disconnect(user.workspace_id, id, user.id);
  }

  @Post(":id/configure-email")
  @Roles(WorkspaceUserRole.ADMIN)
  configureEmail(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: ConfigureEmailDto,
  ) {
    return this.channelsService.configureEmail(user.workspace_id, id, dto, user.id);
  }

  @Post(":id/configure-whatsapp")
  @Roles(WorkspaceUserRole.ADMIN)
  async configureWhatsApp(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: ConfigureWhatsAppDto,
  ) {
    await this.planLimits.enforcePlanTier(user.workspace_id, "EMPRENDE", "WhatsApp");
    return this.channelsService.configureWhatsApp(user.workspace_id, id, dto, user.id);
  }

  @Post(":id/configure-telegram")
  @Roles(WorkspaceUserRole.ADMIN)
  async configureTelegram(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: ConfigureTelegramDto,
  ) {
    return this.channelsService.configureTelegram(user.workspace_id, id, dto, user.id);
  }
}
