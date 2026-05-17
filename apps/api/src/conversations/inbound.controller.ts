import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagesService } from './messages.service';
import { parseJsonValue } from '../common/prisma/json';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Webhook público — sin JWT, accesible por proveedores externos.
 *
 * WhatsApp (Meta Cloud API):
 *   GET  /inbound/whatsapp/webhook  → verificación del webhook
 *   POST /inbound/whatsapp/webhook  → mensajes / estados entrantes
 *
 * Genérico (otros proveedores):
 *   POST /inbound/webhooks/:provider  → requiere header X-Workspace-Id + X-Webhook-Secret
 */
@Controller('inbound')
export class InboundController {
  private readonly logger = new Logger(InboundController.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // WHATSAPP — Meta Cloud API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /inbound/whatsapp/webhook
   * Meta llama este endpoint para verificar que el webhook es tuyo.
   * Parámetros: hub.mode, hub.verify_token, hub.challenge
   */
  @Get('whatsapp/webhook')
  verifyWhatsApp(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: any,
  ) {
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '';

    if (mode === 'subscribe' && token === expected) {
      this.logger.log('WhatsApp webhook verified OK');
      res.status(200).send(challenge);
    } else {
      this.logger.warn(`WhatsApp webhook verification failed — token mismatch`);
      res.status(403).json({ ok: false, reason: 'Forbidden' });
    }
  }

  /**
   * POST /inbound/whatsapp/webhook
   * Meta envía aquí los mensajes, estados de entrega y demás eventos.
   */
  @Post('whatsapp/webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWhatsApp(@Body() body: Record<string, any>) {
    // Siempre responder 200 inmediatamente a Meta (requisito de la API)
    if (body?.object !== 'whatsapp_business_account') {
      return { ok: false, reason: 'Not a WhatsApp event' };
    }

    const entries: any[] = body?.entry ?? [];

    for (const entry of entries) {
      const wabaId = entry?.id as string;
      const changes: any[] = entry?.changes ?? [];

      for (const change of changes) {
        if (change?.field !== 'messages') continue;
        const value = change?.value ?? {};

        const phoneNumberId: string = value?.metadata?.phone_number_id ?? '';
        const messages: any[] = value?.messages ?? [];
        const contacts: any[] = value?.contacts ?? [];

        for (const msg of messages) {
          // Solo procesar mensajes de texto por ahora
          if (msg.type !== 'text') {
            this.logger.log(`Skipping WhatsApp message type: ${msg.type}`);
            continue;
          }

          const from: string = msg.from ?? '';
          const bodyText: string = msg.text?.body ?? '';
          const senderName =
            contacts.find((c: any) => c.wa_id === from)?.profile?.name ?? from;

          // Encontrar el workspace que tiene este phone_number_id configurado
          const workspaceId = await this.resolveWorkspaceByPhoneNumberId(phoneNumberId, wabaId);
          if (!workspaceId) {
            this.logger.warn(
              `No workspace found for phone_number_id=${phoneNumberId} waba_id=${wabaId}`,
            );
            continue;
          }

          try {
            const result = await this.messagesService.receiveInbound(
              'whatsapp',
              workspaceId,
              {
                from,
                name: senderName,
                text: bodyText,
                phone_number_id: phoneNumberId,
                waba_id: wabaId,
                meta_message_id: msg.id,
              },
            );
            this.logger.log(
              `WhatsApp inbound processed: conv=${result.conversation_id} msg=${result.message_id}`,
            );
          } catch (err: any) {
            this.logger.error(`Error processing WhatsApp message: ${err?.message}`);
          }
        }
      }
    }

    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TELEGRAM — Telegram Bot API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /inbound/telegram/:channelId
   * Telegram sends updates to this endpoint when a webhook is configured.
   */
  @Post('telegram/:channelId')
  @HttpCode(HttpStatus.OK)
  async receiveTelegram(
    @Param('channelId') channelId: string,
    @Body() body: Record<string, any>,
  ) {
    const message = body?.message ?? body?.edited_message;
    if (!message) return { ok: true };

    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM', status: 'ACTIVE' },
      select: { workspace_id: true },
    });

    if (!channel) {
      this.logger.warn(`Telegram update for unknown/inactive channelId=${channelId}`);
      return { ok: false };
    }

    const from = String(message?.from?.id ?? '');
    const senderName = [message?.from?.first_name, message?.from?.last_name].filter(Boolean).join(' ') || from;
    const text: string = message?.text ?? '';

    if (!text) return { ok: true };

    try {
      const result = await this.messagesService.receiveInbound('telegram', channel.workspace_id, {
        from,
        name: senderName,
        text,
        channel_id: channelId,
        telegram_chat_id: message?.chat?.id,
        telegram_message_id: message?.message_id,
      });
      this.logger.log(`Telegram inbound processed: conv=${result.conversation_id} msg=${result.message_id}`);
    } catch (err: any) {
      this.logger.error(`Error processing Telegram message: ${err?.message}`);
    }

    return { ok: true };
  }

  /**
   * GET /inbound/telegram/:channelId/webhook-status
   * Returns whether this channel has a Telegram webhook configured (JWT protected).
   */
  @Get('telegram/:channelId/webhook-status')
  @UseGuards(JwtAuthGuard)
  async getTelegramWebhookStatus(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: workspaceId, type: 'TELEGRAM' },
      select: { status: true, config_json: true },
    });

    if (!channel) return { configured: false, webhook_url: null };

    const config = parseJsonValue<Record<string, any>>(channel.config_json, {});
    const appUrl = process.env.API_URL ?? process.env.APP_URL ?? '';
    const webhookUrl = appUrl ? `${appUrl}/inbound/telegram/${channelId}` : null;

    return {
      configured: channel.status === 'ACTIVE' && !!config.bot_token_encrypted,
      webhook_url: webhookUrl,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENÉRICO (email inbound, forms, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('provider') provider: string,
    @Headers('x-workspace-id') workspaceId: string,
    @Headers('x-webhook-secret') webhookSecret: string,
    @Body() payload: Record<string, any>,
  ) {
    if (!workspaceId) {
      return { ok: false, reason: 'Missing X-Workspace-Id header' };
    }

    await this.validateWebhookSecret(workspaceId, provider, webhookSecret, payload);

    return this.messagesService.receiveInbound(provider, workspaceId, payload);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates the webhook secret for a given workspace and provider.
   * Looks up the channel config for a HMAC secret or plain token.
   */
  private async validateWebhookSecret(
    workspaceId: string,
    provider: string,
    providedSecret: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { workspace_id: workspaceId, type: provider.toUpperCase() as any, status: 'ACTIVE' },
      select: { config_json: true },
    });

    if (!channel) {
      throw new UnauthorizedException('Workspace or provider not found.');
    }

    const config = parseJsonValue<Record<string, any>>(channel.config_json, {});
    const storedSecret = config.webhook_secret as string | undefined;

    if (!storedSecret) {
      this.logger.warn(`No webhook_secret configured for workspace ${workspaceId} provider ${provider}`);
      return;
    }

    if (!providedSecret) {
      throw new UnauthorizedException('Missing X-Webhook-Secret header.');
    }

    const rawBody = JSON.stringify(payload);
    const expected = createHmac('sha256', storedSecret).update(rawBody).digest('hex');

    try {
      const sigBuf = Buffer.from(providedSecret, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new UnauthorizedException('Invalid webhook secret.');
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid webhook secret.');
    }
  }

  /**
   * Busca el workspace_id que tiene un canal WHATSAPP activo con el
   * phone_number_id (o waba_id) configurado.
   */
  private async resolveWorkspaceByPhoneNumberId(
    phoneNumberId: string,
    wabaId: string,
  ): Promise<string | null> {
    const channels = await this.prisma.channel.findMany({
      where: {
        type: 'WHATSAPP',
        status: 'ACTIVE',
      },
      select: { workspace_id: true, config_json: true },
    });

    const matched = channels.find((channel) => {
      const config = parseJsonValue<Record<string, any>>(channel.config_json, {});
      return config.phone_number_id === phoneNumberId || config.waba_id === wabaId;
    });

    return matched?.workspace_id ?? null;
  }
}
