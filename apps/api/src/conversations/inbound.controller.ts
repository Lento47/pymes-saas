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
 * WHATSAPP: los webhooks de WhatsApp se manejan en WhatsAppWebhookController
 *           (POST /inbound/whatsapp/webhook) con verificación de firma HMAC.
 *           Este controller solo maneja webhooks genéricos (email, forms, etc.).
 *
 * Genérico (otros proveedores):
 *   POST /inbound/webhooks/:provider  → requiere header X-Workspace-Id + X-PymesHub-webhook-token
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
  //
  // NOTA: Los webhooks de WhatsApp se manejan en WhatsAppWebhookController
  //       (src/whatsapp/whatsapp-webhook.controller.ts) bajo /inbound/whatsapp/webhook
  //       con:
  //         - Verificación de firma X-Hub-Signature-256
  //         - Ingesta durable en webhook_events (tabla + worker)
  //         - Procesamiento asíncrono con receiveProviderInbound + descarga a MinIO
  //         - Rate limiting (10 req/min)
  //
  //       Este controller NO procesa webhooks de WhatsApp para evitar
  //       conflictos de ruta y mantener toda la lógica WhatsApp en un solo lugar.
  //
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /inbound/whatsapp/webhook
   * Redirigido a WhatsAppWebhookController.verifyWebhook()
   */
  @Get('whatsapp/webhook')
  whatsAppVerifyRedirect() {
    // Este endpoint es manejado por WhatsAppWebhookController
    return { ok: false, reason: 'Usar WhatsAppWebhookController' };
  }

  /**
   * POST /inbound/whatsapp/webhook
   * Redirigido a WhatsAppWebhookController.receiveWebhook()
   */
  @Post('whatsapp/webhook')
  @HttpCode(HttpStatus.OK)
  whatsAppReceiveRedirect() {
    // Este endpoint es manejado por WhatsAppWebhookController
    return { ok: false, reason: 'Usar WhatsAppWebhookController' };
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
}
