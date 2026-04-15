import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';

/**
 * Webhook público — sin JWT, accesible por proveedores externos.
 * Cada proveedor debe validar su firma antes de procesar.
 *
 * Endpoints:
 *   POST /inbound/webhooks/email
 *   POST /inbound/webhooks/whatsapp
 *   POST /inbound/webhooks/form
 *
 * Header requerido: X-Workspace-Id (el workspace destino)
 *
 * En producción: agregar guard de firma por proveedor
 * (X-Twilio-Signature, X-Hub-Signature-256, etc.)
 */
@Controller('inbound')
export class InboundController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  receiveWebhook(
    @Param('provider') provider: string,
    @Headers('x-workspace-id') workspaceId: string,
    @Body() payload: Record<string, any>,
  ) {
    if (!workspaceId) {
      return { ok: false, reason: 'Missing X-Workspace-Id header' };
    }

    return this.messagesService.receiveInbound(provider, workspaceId, payload);
  }
}
