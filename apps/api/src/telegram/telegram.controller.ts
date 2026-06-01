import {
  Controller,
  Post,
  Param,
  Body,
  Get,
  Headers,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  Logger,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { TelegramService } from "./telegram.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { WorkspaceUserRole } from "@prisma/client";

@Controller("inbound/telegram")
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Health check for webhook verification — Telegram calls GET before activating webhook
   */
  @Get("webhook/:channelId")
  webhookHealthCheck(@Param("channelId") channelId: string) {
    return { status: "ok", channelId };
  }

  /**
   * Webhook endpoint for Telegram updates
   * This is called by Telegram servers when messages arrive
   * Should return 200 OK immediately to avoid timeouts
   */
  @Post("webhook/:channelId")
  @HttpCode(200)
  @Throttle({ webhook: { limit: 30, ttl: 60_000 } })
  async webhook(
    @Param("channelId") channelId: string,
    @Headers("x-telegram-bot-api-secret-token") secretHeader: string | undefined,
    @Body() update: Record<string, any>,
  ) {
    // Verify Telegram-supplied secret token before accepting the update.
    const ok = await this.telegramService.verifyWebhookSecret(channelId, secretHeader);
    if (!ok) {
      throw new UnauthorizedException("Invalid Telegram webhook signature");
    }

    // Process update — fire-and-forget with explicit error handling.
    // Using Promise instead of setImmediate to avoid silent message loss.
    this.telegramService.processUpdate(channelId, update).catch((err) => {
      this.logger.error(`Telegram processUpdate error: ${err.message}`);
    });
    return { ok: true };
  }

  /**
   * Register/update webhook for a Telegram channel
   * Called when user configures the bot token
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(WorkspaceUserRole.ADMIN)
  @Post(":channelId/register-webhook")
  async registerWebhook(@CurrentUser() user: AuthUser, @Param("channelId") channelId: string) {
    await this.telegramService.registerWebhook(user.workspace_id, channelId);
    return {
      ok: true,
      message: "✓ Webhook de Telegram registrado exitosamente",
      channelId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get webhook status and info
   * Useful for debugging webhook issues
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(":channelId/webhook-status")
  async getWebhookStatus(@CurrentUser() user: AuthUser, @Param("channelId") channelId: string) {
    const status = await this.telegramService.getWebhookStatus(channelId);
    if (!status) {
      return {
        ok: false,
        error: "No se pudo obtener el estado del webhook",
        possible_causes: [
          "Token inválido o expirado",
          "Canal no configurado",
          "Webhook no registrado aún",
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
  @Get(":channelId/bot-info")
  async getBotInfo(@CurrentUser() user: AuthUser, @Param("channelId") channelId: string) {
    const info = await this.telegramService.getBotInfo(channelId);
    if (!info) {
      return {
        ok: false,
        error: "No se pudo obtener la información del bot",
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
  @Post(":channelId/send-test-message")
  async sendTestMessage(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
    @Body() body: { chatId: string; message?: string },
  ) {
    const message = body.message || "✓ Webhook de Telegram funciona correctamente";
    await this.telegramService.sendMessage(channelId, body.chatId, message);
    return {
      ok: true,
      message: "Mensaje de prueba enviado",
      channelId,
      chatId: body.chatId,
    };
  }
}
