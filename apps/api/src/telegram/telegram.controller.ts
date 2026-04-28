import { Controller, Post, Param, Body, Get, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('inbound/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook/:channelId')
  async webhook(
    @Param('channelId') channelId: string,
    @Body() update: any,
  ) {
    await this.telegramService.processUpdate(channelId, update);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':channelId/register-webhook')
  async registerWebhook(
    @CurrentUser() user: AuthUser,
    @Param('channelId') channelId: string,
  ) {
    await this.telegramService.registerWebhook(user.workspace_id, channelId);
    return { ok: true, message: 'Webhook registrado exitosamente' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':channelId/webhook-status')
  async getWebhookStatus(
    @CurrentUser() user: AuthUser,
    @Param('channelId') channelId: string,
  ) {
    const status = await this.telegramService.getWebhookStatus(channelId);
    return status || { error: 'No se pudo obtener el estado del webhook' };
  }
}
