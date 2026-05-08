import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { MessagesService } from '../conversations/messages.service';

const META_API_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly messages: MessagesService,
  ) {}

  // ── Enviar mensaje outbound ────────────────────────────────────────────────

  async sendMessage(
    channel: any,
    to: string,
    bodyText: string,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: any = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    this.logger.log(`[DIAG] sendMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(',')}`);
    if (!cfg?.access_token_encrypted) {
      this.logger.error(`WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`);
      throw new BadGatewayException('WhatsApp access token no configurado. Verificá la configuración del canal.');
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: bodyText },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando mensaje por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  async sendMedia(
    channel: any,
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'document',
    caption?: string,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: any = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    if (!cfg?.access_token_encrypted) {
      throw new BadGatewayException('WhatsApp access token no configurado.');
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    // Step 1: Download file from our storage
    const base = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${base}${mediaUrl}`;
    const fileRes = await fetch(fullUrl);
    if (!fileRes.ok) throw new BadGatewayException('No se pudo descargar el archivo.');
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

    // Step 2: Upload to Meta Media API using multipart/form-data
    const boundary = `----WhatsApp${Date.now()}${Math.random().toString(36).slice(2)}`;
    const CRLF = '\r\n';
    let body = '';
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="messaging_product"${CRLF}${CRLF}whatsapp${CRLF}`;
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="type"${CRLF}${CRLF}${contentType}${CRLF}`;
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="file"; filename="${mediaType === 'image' ? 'image' : 'document'}"${CRLF}`;
    body += `Content-Type: ${contentType}${CRLF}${CRLF}`;
    const bodyEnd = `${CRLF}--${boundary}--${CRLF}`;
    const bodyBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      fileBuffer,
      Buffer.from(bodyEnd, 'utf-8'),
    ]);

    const uploadRes = await fetch(`${META_API_BASE}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
      signal: AbortSignal.timeout(30_000),
    });
    const uploadData: any = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.id) {
      this.logger.error('Meta media upload failed:', JSON.stringify(uploadData));
      throw new BadGatewayException(uploadData?.error?.message ?? 'Error subiendo archivo a WhatsApp.');
    }
    const mediaId = uploadData.id;

    // Step 3: Send message with media_id
    const msgPayload: any = {
      messaging_product: 'whatsapp',
      to,
      type: mediaType,
      [mediaType]: { id: mediaId },
    };
    if (caption) msgPayload[mediaType].caption = caption;

    const sendRes = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(msgPayload),
      signal: AbortSignal.timeout(10_000),
    });
    const sendData: any = await sendRes.json();
    if (!sendRes.ok) {
      this.logger.error('Meta media send failed:', JSON.stringify(sendData));
      throw new BadGatewayException(sendData?.error?.message ?? 'Error enviando archivo por WhatsApp.');
    }
    return { message_id: sendData.messages?.[0]?.id ?? 'unknown' };
  }

  async sendTemplateMessage(
    channel: any,
    to: string,
    templateName: string,
    language: string,
    variables: Record<string, string>,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: any = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    this.logger.log(`[DIAG] sendTemplateMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(',')}`);
    if (!cfg?.access_token_encrypted) {
      this.logger.error(`WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`);
      throw new BadGatewayException('WhatsApp access token no configurado. Verificá la configuración del canal.');
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const components: any[] = [];
    if (Object.keys(variables).length > 0) {
      components.push({
        type: 'body',
        parameters: Object.values(variables).map((v) => ({
          type: 'text',
          text: v,
        })),
      });
    }

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language || 'es' },
          ...(components.length > 0 ? { components } : {}),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta template API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando plantilla por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Procesar webhook entrante ──────────────────────────────────────────────

  /**
   * Resolve workspace from WhatsApp phone_number_id instead of trusting client headers
   */
  private async resolveWorkspaceFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
      // Query channels table to find workspace with this phone_number_id
      const channel = await this.prisma.channel.findFirst({
        where: {
          type: 'WHATSAPP',
          config_json: {
            path: ['phone_number_id'],
            equals: phoneNumberId,
          },
        },
        select: { workspace_id: true },
      });

      return channel?.workspace_id ?? null;
    } catch (err) {
      this.logger.error(`Error resolving workspace from phone_number_id: ${err}`);
      return null;
    }
  }

  async processInbound(payload: any): Promise<void> {
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!phoneNumberId) {
        this.logger.warn('Missing phone_number_id in WhatsApp webhook');
        return;
      }

      // SECURITY: Resolve workspace from phone_number_id, not from client header
      const workspaceId = await this.resolveWorkspaceFromPhoneNumberId(phoneNumberId);
      if (!workspaceId) {
        this.logger.warn(`No workspace found for phone_number_id: ${phoneNumberId}`);
        return;
      }

      if (!value?.messages?.length) {
        // Status update o delivery receipt — ignorar silenciosamente
        return;
      }

      const msg = value.messages[0];
      const from = msg.from; // número con código de país, sin +
      const bodyText = msg.text?.body ?? '';
      const senderName = value.contacts?.[0]?.profile?.name ?? from;

      const normalizedPayload = {
        from,
        name: senderName,
        text: bodyText,
        raw: payload,
      };

      await this.messages.receiveInbound('whatsapp', workspaceId, normalizedPayload);
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp inbound: ${err?.message}`);
    }
  }

  // ── Verificar webhook de Meta ──────────────────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      return challenge;
    }
    this.logger.warn(`Webhook verification failed — token mismatch`);
    return null;
  }
}
