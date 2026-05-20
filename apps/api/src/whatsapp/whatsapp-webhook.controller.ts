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
  RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
    @Res() res: Response,
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
    @Body() payload: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // SECURITY: Webhook signature verification from Meta is MANDATORY.
    // If WHATSAPP_APP_SECRET is not configured, reject ALL webhooks.
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      this.logger.error('WHATSAPP_APP_SECRET not configured — rejecting all WhatsApp webhooks');
      throw new UnauthorizedException('WhatsApp webhook secret not configured');
    }
    if (!signature) {
      this.logger.warn('WhatsApp webhook missing X-Hub-Signature-256 header');
      throw new UnauthorizedException('Missing webhook signature');
    }
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    if (!this.verifyWebhookSignature(appSecret, signature, rawBody)) {
      this.logger.warn('Invalid WhatsApp webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // SECURITY: Workspace is resolved from WhatsApp phone_number_id, not from client headers
    const result = await this.whatsappService.ingestWebhook(payload);

    if (!result.persisted) {
      // Database unavailable — tell Meta to retry
      this.logger.error('Failed to persist webhook event — returning error to Meta');
      throw new Error('Service unavailable');
    }

    if (result.duplicate) {
      this.logger.log('Duplicate webhook acknowledged — returning 200 to Meta');
    }

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
