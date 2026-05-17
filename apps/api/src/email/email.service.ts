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
import { SmtpService } from './smtp.service';

/**
 * Shape of config_json stored in the EMAIL channel.
 * api_key is stored encrypted as api_key_encrypted.
 * SMTP credentials stored encrypted as smtp_pass_encrypted.
 */
interface EmailChannelConfig {
  api_key_encrypted?: string;
  from_email: string;
  inbound_email?: string;
  from_name: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass_encrypted?: string;
  smtp_tls?: boolean;
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
    private readonly smtp: SmtpService,
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
    channel: Record<string, any>,
    to: string,
    subject: string,
    bodyHtml: string,
    bodyText?: string,
  ): Promise<{ id: string }> {
    const config = parseJsonValue<EmailChannelConfig>(channel.config_json, {} as EmailChannelConfig);

    if (!config?.from_email) {
      throw new BadGatewayException('Email channel is not configured — from_email is missing.');
    }

    const from = `${config.from_name} <${config.from_email}>`;

    // Try SMTP first
    if (config.smtp_host && config.smtp_user && config.smtp_pass_encrypted) {
      let pass: string;
      try {
        pass = this.crypto.decrypt(config.smtp_pass_encrypted);
      } catch {
        throw new BadGatewayException('Failed to decrypt SMTP password. Check ENCRYPTION_KEY in .env.');
      }

      return this.smtp.send(
        {
          host: config.smtp_host,
          port: config.smtp_port ?? 587,
          user: config.smtp_user,
          password: pass,
          tls: config.smtp_tls ?? true,
        },
        { from, to, subject, html: bodyHtml, text: bodyText },
      );
    }

    // Fallback to Resend
    if (!config?.api_key_encrypted) {
      throw new BadGatewayException(
        'Email channel is not configured — neither SMTP nor Resend API key found.',
      );
    }

    let apiKey: string;
    try {
      apiKey = this.crypto.decrypt(config.api_key_encrypted);
    } catch {
      throw new BadGatewayException(
        'Failed to decrypt the Resend API key. Check ENCRYPTION_KEY in .env.',
      );
    }

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
    } catch (err) {
      this.logger.error('Resend SDK error', err?.message ?? err);
      throw new BadGatewayException(
        `Resend failed to send email: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INBOUND (webhook)
  // ─────────────────────────────────────────────────────────────────────────────

  async testSmtpConnection(smtpConfig: { host: string; port: number; user: string; password: string; tls: boolean; from_email: string; from_name: string }): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.smtp.send(
        {
          host: smtpConfig.host,
          port: smtpConfig.port,
          user: smtpConfig.user,
          password: smtpConfig.password,
          tls: smtpConfig.tls,
        },
        {
          from: `${smtpConfig.from_name} <${smtpConfig.from_email}>`,
          to: smtpConfig.from_email,
          subject: 'PymesHub — Prueba de conexión SMTP',
          html: '<p>Si recibiste este correo, tu configuración SMTP funciona correctamente.</p>',
        },
      );
      return { success: true, message: `Conexión exitosa — Message ID: ${result.id}` };
    } catch (err) {
      this.logger.warn(`SMTP test failed: ${err?.message ?? err}`);
      return { success: false, message: err?.message ?? 'Error de conexión SMTP' };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INBOUND (webhook)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process an inbound email webhook from Resend.
   * SECURITY: Resolves workspace from email address in the payload, not from client headers.
   * Finds the active EMAIL channel for the workspace, normalises the payload,
   * and delegates to MessagesService.receiveInbound.
   *
   * NOTE: MessagesService is injected dynamically to avoid circular dependencies.
   * It must expose: receiveInbound(provider: string, workspaceId: string, payload: NormalisedInbound)
   *
   * @param payload      Raw Resend webhook body (contains 'to' email address).
   */
  async processInbound(payload: Record<string, any>): Promise<void> {
    // SECURITY: Resolve workspace from the email address in the payload, not from client headers
    const { workspaceId, channel } = await this.resolveWorkspaceAndChannel(payload);

    if (!workspaceId || !channel) {
      this.logger.warn(
        `Could not resolve workspace from email payload (to: ${this.extractPrimaryRecipient(payload.to)})`,
      );
      return; // Silently ignore if we can't match the email to a workspace
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

  /**
   * SECURITY: Resolve workspace and channel from email address in payload,
   * not from client-provided headers.
   */
  private async resolveWorkspaceAndChannel(payload: Record<string, any>): Promise<{
    workspaceId: string | null;
    channel: Record<string, any> | null;
  }> {
    const toAddress = this.extractPrimaryRecipient(payload.to);

    if (!toAddress) {
      return { workspaceId: null, channel: null };
    }

    // Match by inbound_email or from_email via JSON path query — lets DB do the filtering
    // Fallback to fetch-all+loop if JSON path isn't supported
    let channel = await this.prisma.channel.findFirst({
      where: {
        type: 'EMAIL',
        status: 'ACTIVE',
        OR: [
          { config_json: { path: ['inbound_email'], equals: toAddress } },
          { config_json: { path: ['from_email'], equals: toAddress } },
        ],
      },
    });
    if (channel) return { workspaceId: channel.workspace_id, channel };

    // Fallback: scan all email channels (legacy, for unmigrated config_json)
    const allChannels = await this.prisma.channel.findMany({
      where: { type: 'EMAIL', status: 'ACTIVE' },
    });
    for (const ch of allChannels) {
      const config = parseJsonValue<EmailChannelConfig>(ch.config_json, {} as EmailChannelConfig);
      if (config.inbound_email === toAddress || config.from_email === toAddress) {
        return { workspaceId: ch.workspace_id, channel: ch };
      }
    }

    return { workspaceId: null, channel: null };
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
