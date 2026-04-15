import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Resend } from 'resend';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Shape of config_json stored in the EMAIL channel.
 * api_key is stored encrypted as api_key_encrypted.
 */
interface EmailChannelConfig {
  api_key_encrypted: string;
  from_email: string;
  from_name: string;
}

/**
 * Normalised inbound payload passed to MessagesService.receiveInbound.
 */
interface NormalisedInbound {
  from: string;
  to: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  raw: unknown;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTBOUND
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send an outbound email using the Resend SDK.
   *
   * @param channel   Full Channel record (with config_json populated).
   * @param to        Recipient email address.
   * @param subject   Email subject line.
   * @param bodyHtml  HTML body (required).
   * @param bodyText  Plain-text fallback (optional).
   * @returns         Object with Resend message id.
   */
  async sendOutbound(
    channel: any,
    to: string,
    subject: string,
    bodyHtml: string,
    bodyText?: string,
  ): Promise<{ id: string }> {
    const config = channel.config_json as EmailChannelConfig;

    if (!config?.api_key_encrypted) {
      throw new BadGatewayException(
        'Email channel is not configured — api_key_encrypted is missing.',
      );
    }

    // Decrypt the stored API key
    let apiKey: string;
    try {
      apiKey = this.crypto.decrypt(config.api_key_encrypted);
    } catch {
      throw new BadGatewayException(
        'Failed to decrypt the Resend API key. Check ENCRYPTION_KEY in .env.',
      );
    }

    const from = `${config.from_name} <${config.from_email}>`;

    const resend = new Resend(apiKey);

    try {
      const response = await resend.emails.send({
        from,
        to: [to],
        subject,
        html: bodyHtml,
        ...(bodyText ? { text: bodyText } : {}),
      });

      if (response.error) {
        throw new Error(response.error.message ?? JSON.stringify(response.error));
      }

      this.logger.log(`Email sent via Resend — id: ${response.data?.id}`);
      return { id: response.data?.id ?? '' };
    } catch (err: any) {
      this.logger.error('Resend SDK error', err?.message ?? err);
      throw new BadGatewayException(
        `Resend failed to send email: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INBOUND (webhook)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process an inbound email webhook from Resend.
   * Finds the active EMAIL channel for the workspace, normalises the payload,
   * and delegates to MessagesService.receiveInbound.
   *
   * NOTE: MessagesService is injected dynamically to avoid circular dependencies.
   * It must expose: receiveInbound(provider: string, workspaceId: string, payload: NormalisedInbound)
   *
   * @param workspaceId  Taken from the X-Workspace-Id header.
   * @param payload      Raw Resend webhook body.
   */
  async processInbound(workspaceId: string, payload: any): Promise<void> {
    // Locate the active EMAIL channel for this workspace
    const channel = await this.prisma.channel.findFirst({
      where: {
        workspace_id: workspaceId,
        type: 'EMAIL',
        status: 'ACTIVE',
      },
    });

    if (!channel) {
      throw new NotFoundException(
        `No active EMAIL channel found for workspace ${workspaceId}.`,
      );
    }

    // Normalise the Resend inbound event payload
    const normalised: NormalisedInbound = {
      from: payload.from ?? '',
      to: Array.isArray(payload.to) ? payload.to[0] : (payload.to ?? ''),
      subject: payload.subject ?? '(no subject)',
      body_html: payload.html ?? null,
      body_text: payload.text ?? null,
      raw: payload,
    };

    this.logger.log(
      `Inbound email from ${normalised.from} to ${normalised.to} — workspace ${workspaceId}`,
    );

    // Delegate to MessagesService (imported lazily to avoid circular deps)
    // In your real app, inject MessagesService directly in the constructor if
    // there are no circular dependency issues, or use forwardRef().
    const { MessagesService } = await import(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      '../messages/messages.service' as string
    ).catch(() => ({
      MessagesService: null,
    }));

    if (MessagesService) {
      // Resolve from the NestJS container — use ModuleRef for a cleaner approach.
      // This stub shows the integration point; wire it up via constructor injection
      // in production code.
      this.logger.warn(
        'MessagesService dynamic import is a stub. ' +
          'Inject MessagesService via constructor using forwardRef() in production.',
      );
    }

    // ── Production pattern (use this instead of the dynamic import above) ────
    // await this.messagesService.receiveInbound('resend', workspaceId, normalised);
    // ─────────────────────────────────────────────────────────────────────────
  }
}
