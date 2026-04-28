import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaddleService } from './paddle.service';

@Controller('paddle/webhook')
export class PaddleWebhookController {
  private readonly logger = new Logger(PaddleWebhookController.name);

  constructor(private readonly paddle: PaddleService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request,
    @Headers('paddle-signature') signature: string | undefined,
  ) {
    const rawBody = (req as any).rawBody?.toString('utf8') ?? JSON.stringify(req.body);

    this.verifySignature(rawBody, signature);

    const body = req.body;
    const eventType: string | undefined = body?.event_type;
    const data = body?.data;

    if (!eventType || !data) {
      throw new BadRequestException('Missing event_type or data.');
    }

    // Idempotency: skip if we've already processed this notification
    const notificationId: string | undefined = body?.notification_id;
    if (notificationId) {
      const existing = await this.paddle.findProcessedEvent(notificationId);
      if (existing) {
        this.logger.debug(`Skipping duplicate notification ${notificationId}`);
        return { received: true };
      }
    }

    await this.paddle.handleEvent(eventType, data, notificationId);
    return { received: true };
  }

  private verifySignature(rawBody: string, header: string | undefined): void {
    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('PADDLE_WEBHOOK_SECRET not set — skipping signature check');
      return;
    }
    if (!header) throw new UnauthorizedException('Missing Paddle-Signature header.');

    // Header format: "ts=1234567890;h1=abc123..."
    const parts: Record<string, string> = Object.fromEntries(
      header.split(';').map((p) => p.split('=')),
    );
    const ts = parts['ts'];
    const h1 = parts['h1'];
    if (!ts || !h1) throw new UnauthorizedException('Malformed Paddle-Signature header.');

    const message = `${ts}:${rawBody}`;
    const expected = createHmac('sha256', secret).update(message).digest('hex');

    try {
      const h1Buf = Buffer.from(h1, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (h1Buf.length !== expBuf.length || !timingSafeEqual(h1Buf, expBuf)) {
        throw new UnauthorizedException('Invalid Paddle webhook signature.');
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid Paddle webhook signature.');
    }
  }
}
