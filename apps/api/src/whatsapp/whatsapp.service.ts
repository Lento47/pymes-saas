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
import { extractWhatsAppMediaFromMessage } from '../common/whatsapp-media.helper';
import { parseJsonValue } from '../common/prisma/json';
import { MessagesService } from '../conversations/messages.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import { EventsGateway } from '../gateways/events.gateway';
import * as path from 'path';

const META_API_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messages: MessagesService,
    @Inject(forwardRef(() => WebhookEventsService))
    private readonly webhookEvents: WebhookEventsService,
    private readonly events: EventsGateway,
  ) {}

  // ── Enviar mensaje outbound ────────────────────────────────────────────────

  async sendMessage(
    channel: Record<string, any>,
    to: string,
    bodyText: string,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: Record<string, any> = parseJsonValue<Record<string, any>>(raw, {});
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

    const data: Record<string, any> = await res.json();

    if (!res.ok) {
      this.logger.error('Meta API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando mensaje por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  async sendMedia(
    channel: Record<string, any>,
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    caption?: string,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: Record<string, any> = parseJsonValue<Record<string, any>>(raw, {});
    if (!cfg?.access_token_encrypted) {
      throw new BadGatewayException('WhatsApp access token no configurado.');
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    // Step 1: Download file from storage or URL.
    // Check for internal storage path BEFORE checking http/https — when PUBLIC_URL is set,
    // attachment URLs are absolute (https://api.host/api/storage/file/...) but require JWT
    // auth and must be fetched via storage.download() instead of an unauthenticated HTTP call.
    const trimmedUrl = mediaUrl.trim();
    const STORAGE_PATH = '/api/storage/file/';
    let fileBuffer: Buffer;
    if (trimmedUrl.includes(STORAGE_PATH)) {
      const key = trimmedUrl.split(STORAGE_PATH).pop()!;
      this.logger.log(`[DIAG] sendMedia: storage.download key prefix=${key.slice(0, 40)}`);
      fileBuffer = await this.storage.download(key);
    } else if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      const res = await fetch(trimmedUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new BadGatewayException(`Failed to fetch media: ${res.status}`);
      fileBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      fileBuffer = await this.storage.download(trimmedUrl);
    }

    // Determine MIME type from mediaType and file extension
    const ext = this.guessExtensionFromUrl(mediaUrl);
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
      mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
      pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
    };
    const contentType = mimeMap[ext] ?? 'application/octet-stream';
    const fileName = mediaUrl.split('/').pop() || `${mediaType}.${ext}`;

    // Step 2: Upload to Meta Media API using multipart/form-data
    const boundary = `----HermesWhatsApp${Date.now()}${Math.random().toString(36).slice(2)}`;
    const CRLF = '\r\n';

    const headerParts: string[] = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="messaging_product"`,
      '',
      'whatsapp',
      `--${boundary}`,
      `Content-Disposition: form-data; name="type"`,
      '',
      contentType,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      `Content-Type: ${contentType}`,
      '',
    ];
    const headerStr = headerParts.join(CRLF) + CRLF;
    const footerStr = CRLF + `--${boundary}--` + CRLF;
    const bodyBuffer = Buffer.concat([
      Buffer.from(headerStr, 'utf-8'),
      fileBuffer,
      Buffer.from(footerStr, 'utf-8'),
    ]);

    const uploadRes = await fetch(`${META_API_BASE}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
      signal: AbortSignal.timeout(60_000),
    });
    const uploadData: Record<string, any> = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.id) {
      this.logger.error('Meta media upload failed:', JSON.stringify(uploadData));
      throw new BadGatewayException(uploadData?.error?.message ?? 'Error subiendo archivo a WhatsApp.');
    }
    const mediaId = uploadData.id;

    // Step 3: Send message with media_id
    const msgPayload: Record<string, any> = {
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
    const sendData: Record<string, any> = await sendRes.json();
    if (!sendRes.ok) {
      this.logger.error('Meta media send failed:', JSON.stringify(sendData));
      throw new BadGatewayException(sendData?.error?.message ?? 'Error enviando archivo por WhatsApp.');
    }
    return { message_id: sendData.messages?.[0]?.id ?? 'unknown' };
  }

  private guessExtensionFromUrl(url: string): string {
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';
  }

  async sendTemplateMessage(
    channel: Record<string, any>,
    to: string,
    templateName: string,
    language: string,
    variables: Record<string, string>,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: Record<string, any> = parseJsonValue<Record<string, any>>(raw, {});
    this.logger.log(`[DIAG] sendTemplateMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(',')}`);
    if (!cfg?.access_token_encrypted) {
      this.logger.error(`WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`);
      throw new BadGatewayException('WhatsApp access token no configurado. Verificá la configuración del canal.');
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const components: Record<string, any>[] = [];
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

    const data: Record<string, any> = await res.json();

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
  async ingestWebhook(payload: Record<string, any>): Promise<{ persisted: boolean; duplicate: boolean }> {
    const result = await this.webhookEvents.ingest('whatsapp', payload);
    return { persisted: true, duplicate: result.duplicate };
  }

  // ── Procesamiento asíncrono desde webhook_events ───────────────────────────

  /**
   * Resolve workspace from WhatsApp phone_number_id instead of trusting client headers
   */
  private async resolveWorkspaceFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
      // Fetch all active WhatsApp channels and filter in-memory
      // to handle both object and string config_json values
      const channels = await this.prisma.channel.findMany({
        where: { type: 'WHATSAPP', status: 'ACTIVE' },
        select: { workspace_id: true, config_json: true },
      });

      const matched = channels.find((ch) => {
        const cfg = parseJsonValue<Record<string, any>>(ch.config_json, {});
        return cfg.phone_number_id === phoneNumberId || cfg.waba_id === phoneNumberId;
      });

      return matched?.workspace_id ?? null;
    } catch (err) {
      this.logger.error(`Error resolving workspace from phone_number_id: ${err}`);
      return null;
    }
  }

  /**
   * Find an active WhatsApp channel by phone_number_id with legacy config_json support.
   *
   * This helper handles two cases:
   * 1. Fast path: config_json stored as JSONB object (query via Prisma JSON path).
   * 2. Fallback path: config_json stored as string (legacy stringifyJson bug).
   *
   * When workspaceId is provided, it scopes the search. Both paths are tried.
   */
  async findActiveWhatsappChannelByPhoneNumberId(
    phoneNumberId: string,
    workspaceId?: string,
  ): Promise<{ id: string; workspace_id: string; config_json: Record<string, any> } | null> {
    // Fast path: works when config_json is real JSONB object
    const fastWhere: Record<string, any> = {
      type: 'WHATSAPP',
      status: 'ACTIVE',
      config_json: { path: ['phone_number_id'], equals: phoneNumberId },
    };
    if (workspaceId) fastWhere.workspace_id = workspaceId;

    const direct = await this.prisma.channel.findFirst({
      where: fastWhere,
      select: { id: true, workspace_id: true, config_json: true },
    });

    if (direct) return direct as any;

    // Legacy fallback: handles config_json stored as string JSON
    const fallbackWhere: Record<string, any> = { type: 'WHATSAPP', status: 'ACTIVE' };
    if (workspaceId) fallbackWhere.workspace_id = workspaceId;

    const channels = await this.prisma.channel.findMany({
      where: fallbackWhere,
      select: { id: true, workspace_id: true, config_json: true },
    });

    const matched = channels.find((ch) => {
      const cfg = parseJsonValue<Record<string, any>>(ch.config_json, {});
      return cfg.phone_number_id === phoneNumberId;
    });

    return (matched ?? null) as any;
  }

  /**
   * Process a stored WhatsApp webhook event asynchronously.
   * Called by WebhookEventsProcessor after claiming the event.
   */
  async processInboundFromEvent(event: Record<string, any>): Promise<void> {
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

    for (const msg of value.messages) {
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
        bodyText = msg.audio?.caption ? `🎧 ${msg.audio.caption}` : '🎧 Audio';
      } else if (msg.type === 'video') {
        bodyText = msg.video?.caption ? `🎬 ${msg.video.caption}` : '🎬 Video';
      } else if (msg.type === 'sticker') {
        bodyText = '💬 Sticker';
      } else if (msg.type === 'contacts') {
        const contactNames = (msg.contacts || [])
          .map((c: Record<string, any>) => c.name?.formatted_name ?? 'Contacto')
          .join(', ');
        bodyText = `👤 Contacto compartido: ${contactNames}`;
      } else {
        bodyText = `📩 Mensaje de tipo ${msg.type}`;
      }
      const senderName = value.contacts?.[0]?.profile?.name ?? from;
      const providerMessageId = msg.id;
      const whatsappMedia = extractWhatsAppMediaFromMessage(msg);

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
        whatsappMedia,
      });

      if (result.status === 'duplicate') {
        this.logger.log(
          `Duplicate message skipped — event=${eventId} provider_message_id=${providerMessageId}`,
        );
        continue;
      }

      const { messageId, conversationId, contactId } = result;

      this.logger.log(
        `Message created — workspace=${workspaceId} conversation=${conversationId} message=${messageId} provider_message_id=${providerMessageId} from=${from} type=${msg.type}`,
      );

      // ── Download incoming media to MinIO ──
      if (whatsappMedia?.whatsappMediaId && messageId) {
        this.downloadInboundMediaToStorage(
          phoneNumberId,
          workspaceId,
          conversationId,
          messageId,
          whatsappMedia,
        ).catch((err) =>
          this.logger.error(
            `Failed to download inbound media — msg=${messageId}: ${err.message}`,
          ),
        );
      }

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
  }

  // ── Descargar media entrante a MinIO ────────────────────────────────────────

  /**
   * Download incoming WhatsApp media from Meta's API and save to MinIO.
   * Fire-and-forget — errors are logged but never thrown.
   */
  private async downloadInboundMediaToStorage(
    phoneNumberId: string,
    workspaceId: string,
    conversationId: string,
    messageId: string,
    media: { whatsappMediaId: string; mediaType: string; mimeType: string | null; caption: string | null; filename: string | null },
  ): Promise<void> {
    const channel = await this.findActiveWhatsappChannelByPhoneNumberId(
      phoneNumberId,
      workspaceId,
    );
    if (!channel) {
      this.logger.warn(`downloadInboundMediaToStorage: no channel for phoneNumberId=${phoneNumberId}`);
      return;
    }

    const cfg = parseJsonValue<Record<string, any>>(channel.config_json, {});
    if (!cfg?.access_token_encrypted) {
      this.logger.warn(`downloadInboundMediaToStorage: no access_token for channel ${channel.id}`);
      return;
    }

    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const mediaId = media.whatsappMediaId;

    // Get media metadata (URL + mime type)
    const metaRes = await fetch(`${META_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!metaRes.ok) {
      this.logger.warn(`downloadInboundMediaToStorage: Meta metadata fetch failed — id=${mediaId} status=${metaRes.status}`);
      return;
    }
    const metaData: Record<string, any> = await metaRes.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || media.mimeType || 'application/octet-stream';

    // Download file
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!fileRes.ok) {
      this.logger.warn(`downloadInboundMediaToStorage: file download failed — id=${mediaId} status=${fileRes.status}`);
      return;
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    // Generate storage key
    const ext = this.guessExtension(mimeType, media.mediaType);
    const storageKey = `whatsapp-media/${workspaceId}/${messageId}${ext}`;

    // Upload to MinIO
    await this.storage.upload(storageKey, buffer, mimeType);

    // Store attachment info in the message
    const attachmentEntry = {
      provider: 'whatsapp',
      mediaId: mediaId,
      storageKey,
      mimeType,
      size: buffer.length,
      type: media.mediaType,
      caption: media.caption ?? null,
      filename: media.filename ?? null,
    };

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        attachments_json: [attachmentEntry],
      },
    });

    this.logger.log(
      `Inbound media saved to MinIO — msg=${messageId} key=${storageKey} type=${media.mediaType} size=${buffer.length}`,
    );

    // Emit media-ready so frontend can update this message without full refetch
    this.events.emitMediaReady({
      message_id: messageId,
      conversation_id: conversationId,
      media_type: media.mediaType,
      media_status: 'available',
      media_download_url: `/api/conversations/messages/${messageId}/media`,
      media_mime_type: mimeType,
      media_filename: media.filename ?? null,
      media_caption: media.caption ?? null,
    });

    this.logger.log(
      `Media-ready emitted — msg=${messageId} conv=${conversationId} type=${media.mediaType}`,
    );
  }

  private guessExtension(mimeType: string, mediaType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/3gp': '.3gp',
      'audio/ogg': '.ogg',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/amr': '.amr',
      'application/pdf': '.pdf',
    };
    if (map[mimeType]) return map[mimeType];
    if (mediaType === 'image') return '.jpg';
    if (mediaType === 'video') return '.mp4';
    if (mediaType === 'audio') return '.ogg';
    if (mediaType === 'document') return '.bin';
    if (mediaType === 'sticker') return '.webp';
    return '.bin';
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
      select: {
        raw_payload_json: true,
        attachments_json: true,
        conversation: { select: { channel_id: true } },
      },
    });
    if (!msg) throw new BadGatewayException('Mensaje no encontrado');

    // ── Prioritize MinIO storage ──────────────────────────────────────────
    const attachments = msg.attachments_json as any[] | null | undefined;
    const attachmentEntry = attachments?.[0] ?? null;
    if (attachmentEntry?.storageKey) {
      try {
        const presignedUrl = await this.storage.getPresignedUrl(attachmentEntry.storageKey, 3600);
        const fileRes = await fetch(presignedUrl, { signal: AbortSignal.timeout(30_000) });
        if (fileRes.ok) {
          const buffer = Buffer.from(await fileRes.arrayBuffer());
          const contentType = attachmentEntry.mimeType || fileRes.headers.get('content-type') || 'application/octet-stream';
          this.logger.log(`downloadMedia: served from MinIO — msg=${messageId} key=${attachmentEntry.storageKey}`);
          return { buffer, contentType };
        }
        this.logger.warn(`downloadMedia: MinIO fetch failed — msg=${messageId} status=${fileRes.status}, falling back to Meta`);
      } catch (err) {
        this.logger.warn(`downloadMedia: MinIO error — msg=${messageId}: ${err.message}, falling back to Meta`);
      }
    }

    // ── Fallback: fetch from Meta API ─────────────────────────────────────
    const payload = msg.raw_payload_json as any;
    if (!payload) {
      this.logger.warn(`downloadMedia: raw_payload_json is null for message ${messageId}`);
      throw new BadGatewayException('Media no disponible');
    }

    // Handle string payloads (legacy stringifyJson)
    const parsed = parseJsonValue<Record<string, any>>(payload, {});

    let mediaId: string | null = null;

    // Canonical: whatsapp_media field stored during inbound processing
    const wm = parsed.whatsapp_media;
    if (wm) {
      if (wm.whatsappMediaId) {
        mediaId = wm.whatsappMediaId;
        this.logger.log(`downloadMedia: found media via whatsapp_media.whatsappMediaId — id=${mediaId}`);
      } else if (wm.id) {
        mediaId = wm.id;
        this.logger.log(`downloadMedia: found media via whatsapp_media.id (legacy) — id=${mediaId}`);
      }
    }

    // Fallback: navigate full webhook payload structure
    if (!mediaId) {
      const wrappedBody = parsed?.raw_payload ?? parsed;
      const inner = wrappedBody?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const msgPayload = parsed?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ?? inner ?? parsed;
      const mediaObj = msgPayload?.image ?? msgPayload?.document ?? msgPayload?.audio ?? msgPayload?.video;
      if (mediaObj?.id) {
        mediaId = mediaObj.id;
        this.logger.log(`downloadMedia: found media via webhook fallback — id=${mediaId}`);
      }
    }

    if (!mediaId) {
      this.logger.warn(
        `downloadMedia: no media found — hasWhatsappMedia=${!!parsed?.whatsapp_media}, ` +
        `hasRawPayload=${!!parsed?.raw_payload}`,
      );
      throw new BadGatewayException('No se encontró media en el mensaje');
    }

    const channel = await this.prisma.channel.findFirst({
      where: { id: msg.conversation.channel_id, workspace_id: workspaceId },
      select: { config_json: true },
    });
    if (!channel) throw new BadGatewayException('Canal no encontrado');

    const raw = channel.config_json as any;
    const cfg = parseJsonValue<Record<string, any>>(raw, {});
    if (!cfg?.access_token_encrypted) throw new BadGatewayException('WhatsApp access token no configurado');

    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);

    const mediaRes = await fetch(`${META_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!mediaRes.ok) throw new BadGatewayException('Error al obtener metadata del media');

    const mediaData: Record<string, any> = await mediaRes.json();
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
