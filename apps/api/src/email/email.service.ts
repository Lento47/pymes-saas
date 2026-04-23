import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Resend } from 'resend';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagesService } from '../conversations/messages.service';
import { parseJsonValue } from '../common/prisma/json';

/**
 * Shape of config_json stored in the EMAIL channel.
 * api_key is stored encrypted as api_key_encrypted.
 */
interface EmailChannelConfig {
  api_key_encrypted: string;
  from_email: string;
  inbound_email?: string;
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
  sender_name: string;
  channel_id: string;
  raw: unknown;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
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
    const config = parseJsonValue<EmailChannelConfig>(channel.config_json, {} as EmailChannelConfig);

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
    const channel = await this.resolveInboundChannel(workspaceId, payload);

    if (!channel) {
      throw new NotFoundException(
        `No active EMAIL channel found for workspace ${workspaceId}.`,
      );
    }

    // Normalise the Resend inbound event payload
    const normalised: NormalisedInbound = {
      from: this.extractEmailAddress(payload.from ?? ''),
      to: this.extractPrimaryRecipient(payload.to),
      subject: payload.subject ?? '(no subject)',
      body_html: payload.html ?? null,
      body_text: payload.text ?? null,
      sender_name: this.extractSenderName(payload.from ?? ''),
      channel_id: channel.id,
      raw: payload,
    };

    this.logger.log(
      `Inbound email from ${normalised.from} to ${normalised.to} — workspace ${workspaceId}`,
    );
    await this.messagesService.receiveInbound(channel.provider ?? 'email', workspaceId, normalised);
  }

  private async resolveInboundChannel(workspaceId: string, payload: any) {
    const explicitChannelId =
      payload.channel_id ??
      payload.channelId ??
      payload?.headers?.['x-channel-id'];

    if (explicitChannelId && typeof explicitChannelId === 'string') {
      const explicit = await this.prisma.channel.findFirst({
        where: {
          id: explicitChannelId,
          workspace_id: workspaceId,
          type: 'EMAIL',
          status: 'ACTIVE',
        },
      });
      if (explicit) return explicit;
    }

    const toAddress = this.extractPrimaryRecipient(payload.to);
    if (toAddress) {
      const activeChannels = await this.prisma.channel.findMany({
        where: {
          workspace_id: workspaceId,
          type: 'EMAIL',
          status: 'ACTIVE',
        },
      });

      const matchedInbound = activeChannels.find((channel) => {
        const config = parseJsonValue<EmailChannelConfig>(channel.config_json, {} as EmailChannelConfig);
        return config.inbound_email === toAddress;
      });
      if (matchedInbound) return matchedInbound;

      const matched = activeChannels.find((channel) => {
        const config = parseJsonValue<EmailChannelConfig>(channel.config_json, {} as EmailChannelConfig);
        return config.from_email === toAddress;
      });
      if (matched) return matched;
    }

    return this.prisma.channel.findFirst({
      where: {
        workspace_id: workspaceId,
        type: 'EMAIL',
        status: 'ACTIVE',
      },
      orderBy: { created_at: 'asc' },
    });
  }

  private extractPrimaryRecipient(value: unknown): string {
    if (Array.isArray(value)) {
      return this.extractEmailAddress(value[0] ?? '');
    }
    return this.extractEmailAddress(value ?? '');
  }

  private extractEmailAddress(value: unknown): string {
    const raw = String(value ?? '').trim();
    const match = raw.match(/<([^>]+)>/);
    return (match?.[1] ?? raw).trim().toLowerCase();
  }

  private extractSenderName(value: unknown): string {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(.+?)\s*<[^>]+>$/);
    return (match?.[1] ?? this.extractEmailAddress(raw) ?? raw).replace(/^"|"$/g, '').trim();
  }
}
