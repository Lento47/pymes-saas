import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('inbound/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  /** GET /inbound/whatsapp/webhook — verificación de Meta */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: any,
  ) {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (result === null) {
      return res.status(403).send('Forbidden');
    }
    return res.status(200).send(result);
  }

  /** POST /inbound/whatsapp/webhook — mensajes entrantes */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-workspace-id') workspaceId: string,
    @Body() payload: any,
  ) {
    if (!workspaceId) {
      this.logger.warn('Missing X-Workspace-Id header — ignoring webhook');
      return { ok: true };
    }

    try {
      await this.whatsappService.processInbound(workspaceId, payload);
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook: ${err?.message}`);
    }

    // Siempre retornar 200 a Meta
    return { ok: true };
  }
}
