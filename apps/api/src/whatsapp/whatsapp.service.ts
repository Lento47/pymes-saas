import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { StorageService } from '../common/storage/storage.service';
import { MessagesService } from '../conversations/messages.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';

const META_API_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly messages: MessagesService,
    @Inject(forwardRef(() => WebhookEventsService))
    private readonly webhookEvents: WebhookEventsService,
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
    const trimmedUrl = mediaUrl.trim();
    const key = trimmedUrl.includes('/api/storage/file/')
      ? trimmedUrl.split('/api/storage/file/').pop()!
      : trimmedUrl.replace(/^https?:\/\/[^/]+\/?/, '');
    const fileBuffer = await this.storage.download(key);
    const contentType = key.endsWith('.png') ? 'image/png'
      : key.endsWith('.jpg') || key.endsWith('.jpeg') ? 'image/jpeg'
      : key.endsWith('.pdf') ? 'application/pdf'
      : 'application/octet-stream';

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

  // ── Ingestión durable del webhook ──────────────────────────────────────────

  /**
   * Write webhook payload to webhook_events and return 200 to Meta quickly.
   * Processing happens asynchronously via WebhookEventsProcessor.
   */
  async ingestWebhook(payload: any): Promise<{ persisted: boolean; duplicate: boolean }> {
    const result = await this.webhookEvents.ingest('whatsapp', payload);
    return { persisted: true, duplicate: result.duplicate };
  }

  // ── Procesamiento asíncrono desde webhook_events ───────────────────────────

  /**
   * Resolve workspace from WhatsApp phone_number_id instead of trusting client headers
   */
  private async resolveWorkspaceFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
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

  /**
   * Process a stored WhatsApp webhook event asynchronously.
   * Called by WebhookEventsProcessor after claiming the event.
   */
  async processInboundFromEvent(event: any): Promise<void> {
    const payload = event.payload_json as any;
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    const eventId = event.id;

    if (!phoneNumberId) {
      this.logger.warn(`Missing phone_number_id — event=${eventId}`);
      throw new Error('Missing phone_number_id in webhook payload');
    }

    const workspaceId = await this.resolveWorkspaceFromPhoneNumberId(phoneNumberId);
    if (!workspaceId) {
      this.logger.error(
        `No workspace found for phone_number_id=${phoneNumberId} — event=${eventId}`,
      );
      throw new Error(`No workspace configured for phone_number_id: ${phoneNumberId}`);
    }

    if (!value?.messages?.length) {
      // Status update or delivery receipt — nothing to persist as message
      return;
    }

    const msg = value.messages[0];
    const from = msg.from;

    let bodyText = '';
    if (msg.type === 'text') {
      bodyText = msg.text?.body ?? '';
    } else if (msg.type === 'location') {
      const loc = msg.location ?? {};
      bodyText = [
        loc.name ? `📍 ${loc.name}` : '📍 Ubicación compartida',
        loc.address,
        `${loc.latitude}, ${loc.longitude}`,
      ].filter(Boolean).join('\n');
    } else if (msg.type === 'image') {
      bodyText = msg.image?.caption ? `🖼️ ${msg.image.caption}` : '🖼️ Imagen';
    } else if (msg.type === 'document') {
      const fn = msg.document?.filename ? ` (${msg.document.filename})` : '';
      bodyText = msg.document?.caption ? `📄 ${msg.document.caption}` : `📄 Documento${fn}`;
    } else if (msg.type === 'audio') {
      bodyText = '🎵 Mensaje de audio';
    } else if (msg.type === 'video') {
      bodyText = msg.video?.caption ? `🎬 ${msg.video.caption}` : '🎬 Video';
    } else if (msg.type === 'sticker') {
      bodyText = '🏷️ Sticker';
    } else if (msg.type === 'contacts') {
      const contactNames = (msg.contacts || [])
        .map((c: any) => c.name?.formatted_name ?? 'Contacto')
        .join(', ');
      bodyText = `👤 Contacto compartido: ${contactNames}`;
    } else {
      bodyText = `📩 Mensaje de tipo ${msg.type}`;
    }
    const senderName = value.contacts?.[0]?.profile?.name ?? from;
    const providerMessageId = msg.id;

    const result = await this.messages.receiveProviderInbound({
      provider: 'whatsapp',
      workspaceId,
      channelPhoneNumberId: phoneNumberId,
      from,
      senderName,
      bodyText,
      providerMessageId,
      timestamp: msg.timestamp,
      rawPayload: payload,
    });

    if (result.status === 'duplicate') {
      this.logger.log(
        `Duplicate message skipped — event=${eventId} provider_message_id=${providerMessageId}`,
      );
      return;
    }

    const { messageId, conversationId, contactId } = result;

    // ── Secondary tasks (fire-and-forget — must not block) ──

    if (conversationId && messageId) {
      this.messages
        .emitAndNotify({
          workspaceId,
          conversationId,
          contactId,
          messageId,
          senderName,
          bodyText,
        })
        .catch((err) =>
          this.logger.error(
            `Error in emit/notify — event=${eventId} conversation_id=${conversationId}: ${err?.message}`,
          ),
        );
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

  async downloadMedia(messageId: string, workspaceId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, workspace_id: workspaceId },
      select: { raw_payload_json: true, conversation: { select: { channel_id: true } } },
    });
    if (!msg) throw new BadGatewayException('Mensaje no encontrado');

    const payload = msg.raw_payload_json as any;
    if (!payload) {
      this.logger.warn(`downloadMedia: raw_payload_json is null for message ${messageId}`);
      throw new BadGatewayException('Media no disponible');
    }

    this.logger.log(`downloadMedia: payload has keys: ${Object.keys(payload).join(', ')}`);
    const wrappedBody = payload?.raw_payload ?? payload;
    const inner = wrappedBody?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const msgPayload = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ?? inner ?? payload;
    const mediaObj = msgPayload?.image ?? msgPayload?.document ?? msgPayload?.audio ?? msgPayload?.video;
    if (!mediaObj?.id) {
      this.logger.warn(
        `downloadMedia: no media found — hasRawPayload=${!!payload?.raw_payload}, ` +
        `msgType=${msgPayload?.type ?? 'N/A'}, ` +
        `keys=${Object.keys(msgPayload ?? {}).join(',')}`,
      );
      throw new BadGatewayException('No se encontró media en el mensaje');
    }

    const channel = await this.prisma.channel.findFirst({
      where: { id: msg.conversation.channel_id, workspace_id: workspaceId },
      select: { config_json: true },
    });
    if (!channel) throw new BadGatewayException('Canal no encontrado');

    const raw = channel.config_json as any;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    if (!cfg?.access_token_encrypted) throw new BadGatewayException('WhatsApp access token no configurado');

    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);

    const mediaRes = await fetch(`${META_API_BASE}/${mediaObj.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!mediaRes.ok) throw new BadGatewayException('Error al obtener metadata del media');

    const mediaData: any = await mediaRes.json();
    const downloadUrl = mediaData.url;

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!fileRes.ok) throw new BadGatewayException('Error al descargar media');

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const contentType = mediaData.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  }
}
