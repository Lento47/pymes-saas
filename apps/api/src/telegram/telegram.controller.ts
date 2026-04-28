import { Controller, Post, Param, Body, Get, UseGuards, HttpCode, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { WorkspaceUserRole } from '@prisma/client';

@Controller('inbound/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Webhook endpoint for Telegram updates
   * This is called by Telegram servers when messages arrive
   * Should return 200 OK immediately to avoid timeouts
   */
  @Post('webhook/:channelId')
  @HttpCode(200)
  async webhook(
    @Param('channelId', ValidateUUIDPipe) channelId: string,
    @Body() update: any,
  ) {
    // Process update asynchronously to respond quickly
    setImmediate(() => {
      this.telegramService.processUpdate(channelId, update).catch((err) => {
        this.logger.error(`Async error processing update: ${err.message}`);
      });
    });
    return { ok: true };
  }

  /**
   * Register/update webhook for a Telegram channel
   * Called when user configures the bot token
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(WorkspaceUserRole.ADMIN)
  @Post(':channelId/register-webhook')
  async registerWebhook(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ValidateUUIDPipe) channelId: string,
  ) {
    await this.telegramService.registerWebhook(user.workspace_id, channelId);
    return {
      ok: true,
      message: '✓ Webhook de Telegram registrado exitosamente',
      channelId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get webhook status and info
   * Useful for debugging webhook issues
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':channelId/webhook-status')
  async getWebhookStatus(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ValidateUUIDPipe) channelId: string,
  ) {
    const status = await this.telegramService.getWebhookStatus(channelId);
    if (!status) {
      return {
        ok: false,
        error: 'No se pudo obtener el estado del webhook',
        possible_causes: [
          'Token inválido o expirado',
          'Canal no configurado',
          'Webhook no registrado aún',
        ],
      };
    }
    return { ok: true, data: status };
  }

  /**
   * Get bot information
   * Shows bot name, username, and capabilities
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':channelId/bot-info')
  async getBotInfo(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ValidateUUIDPipe) channelId: string,
  ) {
    const info = await this.telegramService.getBotInfo(channelId);
    if (!info) {
      return {
        ok: false,
        error: 'No se pudo obtener la información del bot',
      };
    }
    return { ok: true, data: info };
  }

  /**
   * Send test message to a chat
   * For testing webhook configuration
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(WorkspaceUserRole.ADMIN)
  @Post(':channelId/send-test-message')
  async sendTestMessage(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ValidateUUIDPipe) channelId: string,
    @Body() body: { chatId: string; message?: string },
  ) {
    const message = body.message || '✓ Webhook de Telegram funciona correctamente';
    await this.telegramService.sendMessage(channelId, body.chatId, message);
    return {
      ok: true,
      message: 'Mensaje de prueba enviado',
      channelId,
      chatId: body.chatId,
    };
  }
}
