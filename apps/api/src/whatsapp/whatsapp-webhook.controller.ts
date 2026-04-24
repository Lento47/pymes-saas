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
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
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
  @Throttle({ webhook: { limit: 10, ttl: 60_000 } }) // SECURITY: Strict rate limit for webhooks
  async receiveWebhook(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: any,
    @Req() req: any,
  ) {
    // SECURITY: Verify webhook signature from Meta
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret && signature) {
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
      if (!this.verifyWebhookSignature(appSecret, signature, rawBody)) {
        this.logger.warn('Invalid WhatsApp webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    try {
      // SECURITY: Workspace is resolved from WhatsApp phone_number_id, not from client headers
      await this.whatsappService.processInbound(payload);
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook: ${err?.message}`);
    }

    // Siempre retornar 200 a Meta
    return { ok: true };
  }

  /**
   * Verify WhatsApp webhook signature using HMAC-SHA256
   * Meta sends: X-Hub-Signature-256: sha256=<signature>
   */
  private verifyWebhookSignature(appSecret: string, signature: string, body: Buffer): boolean {
    try {
      const hash = crypto
        .createHmac('sha256', appSecret)
        .update(body.toString('utf8'))
        .digest('hex');
      const expectedSignature = `sha256=${hash}`;
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }
}
