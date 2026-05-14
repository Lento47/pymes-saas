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
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagesService } from './messages.service';
import { parseJsonValue } from '../common/prisma/json';

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Webhook público — sin JWT, accesible por proveedores externos.
 *
 * WhatsApp (Meta Cloud API):
 *   GET  /inbound/whatsapp/webhook  → verificación del webhook
 *   POST /inbound/whatsapp/webhook  → mensajes / estados entrantes
 *
 * Genérico (otros proveedores):
 *   POST /inbound/webhooks/:provider  → requiere header X-Workspace-Id
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
   *
   * Payload de ejemplo (mensaje de texto):
   * {
   *   "object": "whatsapp_business_account",
   *   "entry": [{
   *     "id": "<WABA_ID>",
   *     "changes": [{
   *       "value": {
   *         "messaging_product": "whatsapp",
   *         "metadata": { "phone_number_id": "..." },
   *         "messages": [{ "from": "...", "text": { "body": "..." }, ... }],
   *         "contacts": [{ "profile": { "name": "..." }, "wa_id": "..." }]
   *       }
   *     }]
   *   }]
   * }
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
          const from: string = msg.from ?? '';

          let bodyText = '';
          if (msg.type === 'text') {
            bodyText = msg.text?.body ?? '';
          } else if (msg.type === 'location') {
            const loc = msg.location ?? {};
            bodyText = [
              loc.name ? `📍 ${loc.name}` : '📍 Ubicación compartida',
              loc.address,
              `${loc.latitude}, ${loc.longitude}`,
            ].filter(Boolean).join('\n');
          } else if (msg.type === 'image') {
            bodyText = msg.image?.caption ? `🖼️ ${msg.image.caption}` : '🖼️ Imagen';
          } else if (msg.type === 'document') {
            const fn = msg.document?.filename ? ` (${msg.document.filename})` : '';
            bodyText = msg.document?.caption ? `📄 ${msg.document.caption}` : `📄 Documento${fn}`;
          } else if (msg.type === 'audio') {
            bodyText = '🎵 Mensaje de audio';
          } else if (msg.type === 'video') {
            bodyText = msg.video?.caption ? `🎬 ${msg.video.caption}` : '🎬 Video';
          } else if (msg.type === 'sticker') {
            bodyText = '🏷️ Sticker';
          } else if (msg.type === 'contacts') {
            const contactNames = (msg.contacts || [])
              .map((c: any) => c.name?.formatted_name ?? 'Contacto')
              .join(', ');
            bodyText = `👤 Contacto compartido: ${contactNames}`;
          } else {
            bodyText = `📩 Mensaje de tipo ${msg.type}`;
          }
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
                raw_payload: body,
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
  // GENÉRICO (email inbound, forms, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  receiveWebhook(
    @Param('provider') provider: string,
    @Headers('x-workspace-id') workspaceId: string,
    @Headers('x-PymesHub-webhook-token') token: string | undefined,
    @Body() payload: Record<string, any>,
  ) {
    // Generic inbound endpoint — caller must present a shared secret. The
    // X-Workspace-Id header is otherwise client-controlled and would let
    // any HTTP caller inject messages into any workspace. For per-provider
    // signed webhooks (WhatsApp, Telegram, Paddle, Resend, Hacienda) use
    // the dedicated endpoints which verify provider HMAC signatures.
    const expected = process.env.INBOUND_WEBHOOK_SECRET;
    if (!expected) {
      throw new UnauthorizedException('Generic inbound webhook is disabled (INBOUND_WEBHOOK_SECRET not configured)');
    }
    if (!safeEqual(token || '', expected)) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    if (!workspaceId) {
      return { ok: false, reason: 'Missing X-Workspace-Id header' };
    }
    return this.messagesService.receiveInbound(provider, workspaceId, payload);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

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
