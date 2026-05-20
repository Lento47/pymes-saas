import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('email')
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(private readonly emailService: EmailService) {}

  @Post('test-smtp')
  @UseGuards(JwtAuthGuard)
  async testSmtp(@Body() body: Record<string, any>) {
    if (!body.host || !body.user || !body.password) {
      throw new BadRequestException('Faltan datos: host, user y password son requeridos.');
    }
    const result = await this.emailService.testSmtpConnection({
      host: body.host,
      port: Number(body.port) || 587,
      user: body.user,
      password: body.password,
      tls: body.tls !== false,
      from_email: body.from_email || body.user,
      from_name: body.from_name || 'PymesHub',
    });
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    return result;
  }
}

@Controller('inbound/email')
export class InboundController {
  private readonly logger = new Logger(InboundController.name);

  constructor(private readonly emailService: EmailService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ webhook: { limit: 10, ttl: 60_000 } }) // SECURITY: Strict rate limit for webhooks
  async handleWebhook(
    @Headers('svix-signature') svixSignature: string | undefined,
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTimestamp: string | undefined,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new UnauthorizedException('RESEND_WEBHOOK_SECRET environment variable is required');
    }

    if (!svixSignature || !svixId || !svixTimestamp) {
      throw new UnauthorizedException('Missing Svix webhook signature headers.');
    }
    const rawBody = (req as any).rawBody ?? Buffer.from(JSON.stringify(body));
    const isValid = this.verifySvixSignature(webhookSecret, svixId, svixTimestamp, rawBody, svixSignature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    // SECURITY: Workspace is resolved from email address in the payload, not from client headers
    await this.emailService.processInbound(body);
    return { received: true };
  }

  private verifySvixSignature(
    secret: string,
    msgId: string,
    timestamp: string,
    rawBody: Buffer,
    signatureHeader: string,
  ): boolean {
    try {
      const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
      const toSign = `${msgId}.${timestamp}.${rawBody.toString('utf8')}`;
      const expected = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');
      const sigs = signatureHeader.split(' ').map(s => s.replace(/^v\d+,/, ''));
      const expectedBuf = Buffer.from(expected, 'base64');
      return sigs.some(sig => {
        const sigBuf = Buffer.from(sig, 'base64');
        // timingSafeEqual throws if buffers differ in length — guard against it
        if (sigBuf.length !== expectedBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expectedBuf);
      });
    } catch {
      return false;
    }
  }
}
