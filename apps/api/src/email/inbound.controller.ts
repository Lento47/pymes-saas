import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { EmailService } from './email.service';

@Controller('inbound/email')
export class InboundController {
  private readonly logger = new Logger(InboundController.name);

  constructor(private readonly emailService: EmailService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-workspace-id') workspaceId: string,
    @Headers('svix-signature') svixSignature: string | undefined,
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTimestamp: string | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('Missing required header: X-Workspace-Id');
    }

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!svixSignature || !svixId || !svixTimestamp) {
        throw new UnauthorizedException('Missing Svix webhook signature headers.');
      }
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
      const isValid = this.verifySvixSignature(webhookSecret, svixId, svixTimestamp, rawBody, svixSignature);
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature.');
      }
    } else {
      this.logger.warn('RESEND_WEBHOOK_SECRET not set — skipping signature validation (dev mode).');
    }

    await this.emailService.processInbound(workspaceId, body);
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
      return sigs.some(sig =>
        crypto.timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(expected, 'base64')),
      );
    } catch {
      return false;
    }
  }
}
