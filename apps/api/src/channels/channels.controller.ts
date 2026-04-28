import { WorkspaceUserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ConfigureEmailDto } from './dto/configure-email.dto';
import { ConfigureWhatsAppDto } from './dto/configure-whatsapp.dto';
import { ConfigureTelegramDto } from './dto/configure-telegram.dto';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('channels')
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
    return this.channelsService.create(user.workspace_id, body);
  }

  @Get()
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findAll(@CurrentUser('workspace_id') workspaceId: string) {
    return this.channelsService.findAll(workspaceId);
  }

  @Get(':id')
  @Roles(WorkspaceUserRole.VIEWER, WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.findOne(workspaceId, id);
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() body: { name?: string; status?: string },
  ) {
    return this.channelsService.update(workspaceId, id, body);
  }

  @Delete(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.remove(workspaceId, id);
  }

  @Post(':id/connect')
  @Roles(WorkspaceUserRole.ADMIN)
  connect(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.connect(workspaceId, id);
  }

  @Post(':id/disconnect')
  @Roles(WorkspaceUserRole.ADMIN)
  disconnect(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.channelsService.disconnect(workspaceId, id);
  }

  @Post(':id/configure-email')
  @Roles(WorkspaceUserRole.ADMIN)
  configureEmail(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: ConfigureEmailDto,
  ) {
    return this.channelsService.configureEmail(workspaceId, id, dto);
  }

  @Post(':id/configure-whatsapp')
  @Roles(WorkspaceUserRole.ADMIN)
  async configureWhatsApp(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: ConfigureWhatsAppDto,
  ) {
    await this.planLimits.enforcePlanTier(workspaceId, 'GROWTH', 'WhatsApp');
    return this.channelsService.configureWhatsApp(workspaceId, id, dto);
  }

  @Post(':id/configure-telegram')
  @Roles(WorkspaceUserRole.ADMIN)
  async configureTelegram(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: ConfigureTelegramDto,
  ) {
    return this.channelsService.configureTelegram(workspaceId, id, dto);
  }
}
