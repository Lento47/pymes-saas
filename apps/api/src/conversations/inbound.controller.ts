import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { MessagesService } from './messages.service';

// Simple UUID v4 regex for header validation
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * WHATSAPP: los webhooks de WhatsApp se manejan exclusivamente en
 *           WhatsAppWebhookController (src/whatsapp/whatsapp-webhook.controller.ts)
 *           bajo /inbound/whatsapp/webhook con verificación HMAC, cola durable y MinIO.
 *
 *           Este controller NO define rutas para /inbound/whatsapp/webhook para evitar
 *           conflictos. Solo maneja webhooks genéricos (email, forms, etc.).
 *
 * Genérico:
 *   POST /inbound/webhooks/:provider  → requiere X-Workspace-Id + X-PymesHub-webhook-token
 */
@Controller('inbound')
export class InboundController {
  private readonly logger = new Logger(InboundController.name);

  constructor(
    private readonly messagesService: MessagesService,
  ) {}

  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  receiveWebhook(
    @Param('provider') provider: string,
    @Headers('x-workspace-id') workspaceId: string,
    @Headers('x-PymesHub-webhook-token') token: string | undefined,
    @Body() payload: Record<string, any>,
  ) {
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
    // Validate workspaceId is a UUID to prevent injection and DB lookup anomalies
    if (!UUID_V4_RE.test(workspaceId)) {
      return { ok: false, reason: 'Invalid X-Workspace-Id header (expected UUID v4)' };
    }
    return this.messagesService.receiveInbound(provider, workspaceId, payload);
  }
}
