import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { EmailService } from './email.service';

/**
 * InboundController
 *
 * Receives inbound email webhooks from Resend.
 * Endpoint is PUBLIC (no JWT guard) — validation is done via
 * Svix webhook signature (X-Resend-Signature / svix-signature headers)
 * when RESEND_WEBHOOK_SECRET is set in .env.
 *
 * Register in Resend dashboard:
 *   Webhook URL: https://<your-domain>/inbound/email/webhook
 *   Events:      email.delivered, email.bounced, inbound.email, etc.
 *
 * The workspace is identified by the X-Workspace-Id header that you add
 * as a custom header in the Resend webhook configuration.
 */
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
    @Req() req: RawBodyRequest<Request>,
  ) {
    // ── 1. Validate workspace header ────────────────────────────────────────
    if (!workspaceId) {
      throw new BadRequestException(
        'Missing required header: X-Workspace-Id',
      );
    }

    // ── 2. Validate Svix / Resend signature (skip in dev if secret not set) ─
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!svixSignature || !svixId || !svixTimestamp) {
        throw new UnauthorizedException(
          'Missing Svix webhook signature headers.',
        );
      }

      const isValid = this.verifySvixSignature(
        webhookSecret,
        svixId,
        svixTimestamp,
        req.rawBody ?? Buffer.from(JSON.stringify(body)),
        svixSignature,
      );

      if (!isValid) {
        this.logger.warn(`Invalid Svix signature for workspace ${workspaceId}`);
        throw new UnauthorizedException('Invalid webhook signature.');
      }
    } else {
      this.logger.warn(
        'RESEND_WEBHOOK_SECRET is not set — skipping signature validation (dev mode).',
      );
    }

    // ── 3. Delegate to EmailService ─────────────────────────────────────────
    this.logger.log(
      `Inbound webhook received for workspace ${workspaceId} — type: ${body?.type ?? 'unknown'}`,
    );

    await this.emailService.processInbound(workspaceId, body);

    return { received: true };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Verify a Svix webhook signature.
   * Spec: https://docs.svix.com/receiving/verifying-payloads/how
   *
   * signed_content = "{msg_id}.{timestamp}.{body}"
   * expected_sig   = HMAC-SHA256(base64_decode(secret_without_prefix), signed_content)
   * Compare with each v1,<base64_sig> in the svix-signature header.
   */
  private verifySvixSignature(
    secret: string,
    msgId: string,
    timestamp: string,
    rawBody: Buffer,
    signatureHeader: string,
  ): boolean {
    try {
      // Svix secrets are prefixed with "whsec_"
      const secretBytes = Buffer.from(
        secret.replace(/^whsec_/, ''),
        'base64',
      );

      const toSign = `${msgId}.${timestamp}.${rawBody.toString('utf8')}`;

      const expectedHmac = crypto
        .createHmac('sha256', secretBytes)
        .update(toSign)
        .digest('base64');

      // The header may contain multiple space-separated signatures (v1,<sig>)
      const signatures = signatureHeader
        .split(' ')
        .map((s) => s.replace(/^v\d+,/, ''));

      return signatures.some(
        (sig) =>
          crypto.timingSafeEqual(
            Buffer.from(sig, 'base64'),
            Buffer.from(expectedHmac, 'base64'),
          ),
      );
    } catch (err) {
      this.logger.error('Signature verification error', err);
      return false;
    }
  }
}
