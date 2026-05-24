import { BadGatewayException, Inject, Injectable, Logger, NotFoundException, forwardRef } from "@nestjs/common";
import * as crypto from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { StorageService } from "../common/storage/storage.service";
import { extractWhatsAppMediaFromMessage } from "../common/whatsapp-media.helper";
import { parseJsonValue } from "../common/prisma/json";
import { MessagesService } from "../conversations/messages.service";
import { WebhookEventsService } from "../webhooks/webhook-events.service";
import { EventsGateway } from "../gateways/events.gateway";
import * as path from "path";
import { MessageDeliveryStatus } from "@prisma/client";

const META_API_BASE = "https://graph.facebook.com/v19.0";

interface SendMediaParams {
  channel: any;
  to: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mediaUrl: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
}

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

  // ── Enviar mensaje text outbound ───────────────────────────────────────────

  async sendMessage(
    channel: Record<string, any>,
    to: string,
    bodyText: string,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: Record<string, any> = parseJsonValue<Record<string, any>>(raw, {});
    this.logger.log(
      `[DIAG] sendMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(",")}`,
    );
    if (!cfg?.access_token_encrypted) {
      this.logger.error(
        `WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`,
      );
      throw new BadGatewayException(
        "WhatsApp access token no configurado. Verificá la configuración del canal.",
      );
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: bodyText },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: Record<string, any> = await res.json();

    if (!res.ok) {
      this.logger.error("Meta API error:", JSON.stringify(data));
      throw new BadGatewayException(data?.error?.message ?? "Error enviando mensaje por WhatsApp");
    }

    return { message_id: data.messages?.[0]?.id ?? "unknown" };
  }

  // TODO(refactor): sendMedia is ~110 lines long and mixes file download logic,
  // MIME resolution, multipart form-data construction, and Meta API calls. Consider
  // extracting into: (1) resolveMediaSource(), (2) buildMultipartBody(), (3) uploadToMeta().
  async sendMedia(
    channel: Record<string, any>,
    to: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document" | "sticker",
    caption?: string,
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: Record<string, any> = parseJsonValue<Record<string, any>>(raw, {});
    if (!cfg?.access_token_encrypted) {
      throw new BadGatewayException("WhatsApp access token no configurado.");
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    // Step 1: Download file from storage or URL
    const trimmedUrl = mediaUrl.trim();
    let fileBuffer: Buffer;
    let resolvedFileName: string;
    const storageProxyMarker = "/api/storage/file/";
    const storageProxyIndex = trimmedUrl.indexOf(storageProxyMarker);

    if (storageProxyIndex >= 0) {
      const key = decodeURIComponent(
        trimmedUrl.slice(storageProxyIndex + storageProxyMarker.length),
      );
      fileBuffer = await this.storage.download(key);
      resolvedFileName = key.split("/").pop() || "file";
    } else if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      const res = await fetch(trimmedUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new BadGatewayException(`Failed to fetch media: ${res.status}`);
      fileBuffer = Buffer.from(await res.arrayBuffer());
      resolvedFileName = new URL(trimmedUrl).pathname.split("/").pop() || "file";
    } else {
      fileBuffer = await this.storage.download(trimmedUrl);
      resolvedFileName = trimmedUrl.split("/").pop() || "file";
    }

    // Determine MIME type from mediaType and file extension
    const ext = this.guessExtensionFromUrl(resolvedFileName);
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      opus: "audio/ogg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
      rar: "application/vnd.rar",
      "7z": "application/x-7z-compressed",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";
    const fileName = resolvedFileName || `${mediaType}.${ext}`;

    // Step 2: Upload to Meta Media API using multipart/form-data
    const boundary = `----HermesWhatsApp${Date.now()}${Math.random().toString(36).slice(2)}`;
    const CRLF = "\r\n";

    const headerParts: string[] = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="messaging_product"`,
      "",
      "whatsapp",
      `--${boundary}`,
      `Content-Disposition: form-data; name="type"`,
      "",
      contentType,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      `Content-Type: ${contentType}`,
      "",
    ];
    const headerStr = headerParts.join(CRLF) + CRLF;
    const footerStr = CRLF + `--${boundary}--` + CRLF;
    const bodyBuffer = Buffer.concat([
      Buffer.from(headerStr, "utf-8"),
      fileBuffer,
      Buffer.from(footerStr, "utf-8"),
    ]);

    const uploadRes = await fetch(`${META_API_BASE}/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
      signal: AbortSignal.timeout(60_000),
    });
    const uploadData: Record<string, any> = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.id) {
      this.logger.error("Meta media upload failed:", JSON.stringify(uploadData));
      throw new BadGatewayException(
        uploadData?.error?.message ?? "Error subiendo archivo a WhatsApp.",
      );
    }
    const mediaId = uploadData.id;

    // Step 3: Send message with media_id
    const msgPayload: Record<string, any> = {
      messaging_product: "whatsapp",
      to,
      type: mediaType,
      [mediaType]: { id: mediaId },
    };
    if (caption) msgPayload[mediaType].caption = caption;

    const sendRes = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(msgPayload),
      signal: AbortSignal.timeout(10_000),
    });
    const sendData: Record<string, any> = await sendRes.json();
    if (!sendRes.ok) {
      this.logger.error("Meta media send failed:", JSON.stringify(sendData));
      throw new BadGatewayException(
        sendData?.error?.message ?? "Error enviando archivo por WhatsApp.",
      );
    }
    return { message_id: sendData.messages?.[0]?.id ?? "unknown" };
  }

  private guessExtensionFromUrl(url: string): string {
    const clean = url.split("?")[0].split("#")[0];
    const parts = clean.split(".");
    return parts.length > 1 ? parts.pop()!.toLowerCase() : "bin";
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
    this.logger.log(
      `[DIAG] sendTemplateMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(",")}`,
    );
    if (!cfg?.access_token_encrypted) {
      this.logger.error(
        `WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`,
      );
      throw new BadGatewayException(
        "WhatsApp access token no configurado. Verificá la configuración del canal.",
      );
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const components: Record<string, any>[] = [];
    if (Object.keys(variables).length > 0) {
      components.push({
        type: "body",
        parameters: Object.values(variables).map((v) => ({
          type: "text",
          text: v,
        })),
      });
    }

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: language || "es" },
          ...(components.length > 0 ? { components } : {}),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: Record<string, any> = await res.json();

    if (!res.ok) {
      this.logger.error("Meta template API error:", JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? "Error enviando plantilla por WhatsApp",
      );
    }

    return { message_id: data.messages?.[0]?.id ?? "unknown" };
  }

  // ── Enviar template de factura electrónica ──────────────────────────────────

  /**
   * Envía la factura usando el template WhatsApp "factura_electronica" (UTILITY).
   * 6 variables de body + 2 botones URL opcionales (pago y PDF Hacienda).
   */
  async sendInvoiceTemplate(
    channel: Record<string, any>,
    to: string,
    params: {
      customerName: string;    // {{1}} — nombre del cliente
      invoiceNumber: string;   // {{2}} — número de factura
      amountFormatted: string; // {{3}} — monto con moneda
      dueDateFormatted: string;// {{4}} — fecha de vencimiento
      productsSummary: string; // {{5}} — resumen de productos
      companyName: string;     // {{6}} — nombre de la pyme
      paymentUrl?: string;     // button[0] — URL de pago
      pdfUrl?: string;         // button[1] — PDF Hacienda
    },
  ): Promise<{ message_id: string }> {
    const raw = channel.config_json;
    const cfg: Record<string, any> = parseJsonValue<Record<string, any>>(raw, {});
    if (!cfg?.access_token_encrypted) {
      throw new BadGatewayException(
        "WhatsApp access token no configurado. Verificá la configuración del canal.",
      );
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const components: Record<string, any>[] = [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.customerName },
          { type: "text", text: params.invoiceNumber },
          { type: "text", text: params.amountFormatted },
          { type: "text", text: params.dueDateFormatted },
          { type: "text", text: params.productsSummary },
          { type: "text", text: params.companyName },
        ],
      },
    ];

    // URL buttons — index cambia según cuáles estén presentes
    if (params.paymentUrl) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: params.paymentUrl }],
      });
    }
    if (params.pdfUrl) {
      components.push({
        type: "button",
        sub_type: "url",
        index: params.paymentUrl ? "1" : "0",
        parameters: [{ type: "text", text: params.pdfUrl }],
      });
    }

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "factura_electronica",
          language: { code: "es" },
          components,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: Record<string, any> = await res.json();

    if (!res.ok) {
      this.logger.error("Meta invoice template error:", JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? "Error enviando factura por WhatsApp",
      );
    }

    return { message_id: data.messages?.[0]?.id ?? "unknown" };
  }

  // ── Ingestión durable del webhook ──────────────────────────────────────────

  /**
   * Write webhook payload to webhook_events and return 200 to Meta quickly.
   * Processing happens asynchronously via WebhookEventsProcessor.
   */
  async ingestWebhook(
    payload: Record<string, any>,
  ): Promise<{ persisted: boolean; duplicate: boolean }> {
    const result = await this.webhookEvents.ingest("whatsapp", payload);
    return { persisted: true, duplicate: result.duplicate };
  }

  // ── Send reaction ──────────────────────────────────────────────────────────

  async sendReaction(
    channel: any,
    to: string,
    targetMessageId: string,
    emoji: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'reaction',
        reaction: {
          message_id: targetMessageId,
          emoji,
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta reaction API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando reacción por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Send contextual reply ──────────────────────────────────────────────────

  async sendReply(
    channel: any,
    to: string,
    bodyText: string,
    replyToMessageId: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        context: { message_id: replyToMessageId },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta reply API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando respuesta contextual por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Mark message as read ───────────────────────────────────────────────────

  async markAsRead(
    channel: any,
    messageId: string,
  ): Promise<void> {
    const cfg = channel.config_json as any;
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
        status: 'read',
        message_id: messageId,
      }),
    });

    if (!res.ok) {
      const data: any = await res.json().catch(() => null);
      this.logger.warn(`Mark as read failed for ${messageId}:`, data?.error?.message);
      // Don't throw — read receipts are best-effort
    }
  }

  // ── Typing indicator ───────────────────────────────────────────────────────

  async sendTypingIndicator(
    channel: any,
    to: string,
    action: 'typing_on' | 'typing_off',
  ): Promise<void> {
    const cfg = channel.config_json as any;
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
        type: action,
      }),
    });

    if (!res.ok) {
      // Typing indicators are best-effort — don't throw
      this.logger.debug(`Typing indicator ${action} failed silently`);
    }
  }

  // ── Interactive: Reply buttons ─────────────────────────────────────────────

  async sendReplyButtons(
    channel: any,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    footer?: string,
  ): Promise<{ message_id: string }> {
    if (buttons.length < 1 || buttons.length > 3) {
      throw new BadGatewayException('Reply buttons: 1–3 buttons required');
    }

    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta interactive buttons error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando botones por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Interactive: List message ──────────────────────────────────────────────

  async sendListMessage(
    channel: any,
    to: string,
    body: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    footer?: string,
  ): Promise<{ message_id: string }> {
    const rowCount = sections.reduce((c, s) => c + s.rows.length, 0);
    if (sections.length > 10 || rowCount > 10) {
      throw new BadGatewayException('List message: max 10 sections, max 10 rows total');
    }

    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            button: buttonText,
            sections,
          },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta list message error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando lista por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Interactive: Location request ──────────────────────────────────────────

  async sendLocationRequest(
    channel: any,
    to: string,
    body: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'location_request_message',
          body: { text: body },
          action: { name: 'send_location' },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta location request error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando solicitud de ubicación',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Send template message ──────────────────────────────────────────────────

  async sendTemplate(
    channel: any,
    to: string,
    templateName: string,
    languageCode: string,
    components?: Array<Record<string, any>>,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components?.length ? { components } : {}),
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta template error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando template por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Commerce: Catalog message ──────────────────────────────────────────────

  async sendCatalogMessage(
    channel: any,
    to: string,
    body: string,
    footer?: string,
    catalogId?: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'catalog_message',
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            name: 'catalog_message',
            ...(catalogId ? { parameters: { catalog_id: catalogId } } : {}),
          },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta catalog message error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando mensaje de catálogo',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Commerce: Single product message ───────────────────────────────────────

  async sendProductMessage(
    channel: any,
    to: string,
    body: string,
    catalogId: string,
    productRetailerId: string,
    footer?: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'product',
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            catalog_id: catalogId,
            product_retailer_id: productRetailerId,
          },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta product message error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando producto',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Commerce: Multi-product message ────────────────────────────────────────

  async sendProductListMessage(
    channel: any,
    to: string,
    header: string,
    body: string,
    catalogId: string,
    sections: Array<{
      title?: string;
      productRetailerIds: string[];
    }>,
    footer?: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'product_list',
          header: { type: 'text', text: header },
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            catalog_id: catalogId,
            sections: sections.map(s => ({
              title: s.title,
              product_items: s.productRetailerIds.map(id => ({
                product_retailer_id: id,
              })),
            })),
          },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta product list error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando lista de productos',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Commerce: Flow message ─────────────────────────────────────────────────

  async sendFlowMessage(
    channel: any,
    to: string,
    flowId: string,
    flowToken: string,
    body: string,
    header?: string,
    footer?: string,
    screenId?: string,
    dataPayload?: Record<string, any>,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
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
        type: 'interactive',
        interactive: {
          type: 'flow',
          ...(header ? { header: { type: 'text', text: header } } : {}),
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: flowToken,
              flow_id: flowId,
              flow_cta: body,
              ...(screenId ? { flow_action: 'navigate', flow_action_payload: { screen: screenId, data: dataPayload ?? {} } } : {}),
            },
          },
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta flow message error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando flow',
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
      // Fetch all active WhatsApp channels and filter in-memory
      // to handle both object and string config_json values
      const channels = await this.prisma.channel.findMany({
        where: { type: "WHATSAPP", status: "ACTIVE" },
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
      type: "WHATSAPP",
      status: "ACTIVE",
      config_json: { path: ["phone_number_id"], equals: phoneNumberId },
    };
    if (workspaceId) fastWhere.workspace_id = workspaceId;

    const direct = await this.prisma.channel.findFirst({
      where: fastWhere,
      select: { id: true, workspace_id: true, config_json: true },
    });

    if (direct) return direct as any;

    // Legacy fallback: handles config_json stored as string JSON
    const fallbackWhere: Record<string, any> = { type: "WHATSAPP", status: "ACTIVE" };
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
      throw new Error("Missing phone_number_id in webhook payload");
    }

    const workspaceId = await this.resolveWorkspaceFromPhoneNumberId(phoneNumberId);
    if (!workspaceId) {
      this.logger.error(
        `No workspace found for phone_number_id=${phoneNumberId} — event=${eventId}`,
      );
      throw new Error(`No workspace configured for phone_number_id: ${phoneNumberId}`);
    }

    // Process status updates (delivery receipts: sent, delivered, read, failed)
    if (value?.statuses?.length) {
      await this.processStatuses(workspaceId, value.statuses);
      return;
    }

    // Process incoming messages
    if (!value?.messages?.length) {
      this.logger.debug('Webhook without messages or statuses — ignored');
      return;
    }

    for (const msg of value.messages) {
      const from = msg.from;

      // ── User typing indicator ──────────────────────────────────────────
      if (msg.type === 'typing') {
        const conversation = await this.messages.findConversationByPhone(workspaceId, from);
        if (conversation) {
          this.events.server
            .to(`conversation:${conversation.id}`)
            .emit('user:typing', { conversationId: conversation.id, from });
        }
        continue;
      }

      let bodyText = "";
      if (msg.type === "text") {
        bodyText = msg.text?.body ?? "";
      } else if (msg.type === "location") {
        const loc = msg.location ?? {};
        bodyText = [
          loc.name ? `📍 ${loc.name}` : "📍 Ubicación compartida",
          loc.address,
          `${loc.latitude}, ${loc.longitude}`,
        ]
          .filter(Boolean)
          .join("\n");
      } else if (msg.type === "image") {
        bodyText = msg.image?.caption ? `🖼️ ${msg.image.caption}` : "🖼️ Imagen";
      } else if (msg.type === "document") {
        const fn = msg.document?.filename ? ` (${msg.document.filename})` : "";
        bodyText = msg.document?.caption ? `📄 ${msg.document.caption}` : `📄 Documento${fn}`;
      } else if (msg.type === "audio") {
        bodyText = msg.audio?.caption ? `🎧 ${msg.audio.caption}` : "🎧 Audio";
      } else if (msg.type === "video") {
        bodyText = msg.video?.caption ? `🎬 ${msg.video.caption}` : "🎬 Video";
      } else if (msg.type === "sticker") {
        bodyText = "💬 Sticker";
      } else if (msg.type === "button") {
        bodyText = msg.button?.text ?? msg.button?.payload ?? "📩 Botón";
      } else if (msg.type === "interactive") {
        const ir = msg.interactive;
        if (ir?.button_reply) {
          bodyText = ir.button_reply.title ?? ir.button_reply.id ?? "📩 Botón";
        } else if (ir?.list_reply) {
          bodyText = ir.list_reply.title ?? ir.list_reply.id ?? "📩 Opción";
        } else {
          bodyText = "📩 Mensaje interactivo";
        }
      } else if (msg.type === "contacts") {
        const contactNames = (msg.contacts || [])
          .map((c: Record<string, any>) => c.name?.formatted_name ?? "Contacto")
          .join(", ");
        bodyText = `👤 Contacto compartido: ${contactNames}`;
      } else {
        bodyText = `📩 Mensaje de tipo ${msg.type}`;
      }
      const senderName = value.contacts?.[0]?.profile?.name ?? from;
      const providerMessageId = msg.id;
      const whatsappMedia = extractWhatsAppMediaFromMessage(msg);

      // NOTE: receiveProviderInbound runs inside an interactive transaction
      // (upsert contact + find-or-create conversation + insert message). This
      // keeps the critical path durable but may hold a DB connection longer
      // than desired. Consider breaking into non-transactional steps if latency
      // becomes a concern.
      const result = await this.messages.receiveProviderInbound({
        provider: "whatsapp",
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

      if (result.status === "duplicate") {
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
          this.logger.error(`Failed to download inbound media — msg=${messageId}: ${err.message}`),
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
    media: {
      whatsappMediaId: string;
      mediaType: string;
      mimeType: string | null;
      caption: string | null;
      filename: string | null;
    },
  ): Promise<void> {
    const channel = await this.findActiveWhatsappChannelByPhoneNumberId(phoneNumberId, workspaceId);
    if (!channel) {
      this.logger.warn(
        `downloadInboundMediaToStorage: no channel for phoneNumberId=${phoneNumberId}`,
      );
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
      this.logger.warn(
        `downloadInboundMediaToStorage: Meta metadata fetch failed — id=${mediaId} status=${metaRes.status}`,
      );
      return;
    }
    const metaData: Record<string, any> = await metaRes.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || media.mimeType || "application/octet-stream";

    // Download file
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!fileRes.ok) {
      this.logger.warn(
        `downloadInboundMediaToStorage: file download failed — id=${mediaId} status=${fileRes.status}`,
      );
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
      provider: "whatsapp",
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
      media_status: "available",
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
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "video/mp4": ".mp4",
      "video/3gp": ".3gp",
      "audio/ogg": ".ogg",
      "audio/mpeg": ".mp3",
      "audio/mp4": ".m4a",
      "audio/amr": ".amr",
      "application/pdf": ".pdf",
    };
    if (map[mimeType]) return map[mimeType];
    if (mediaType === "image") return ".jpg";
    if (mediaType === "video") return ".mp4";
    if (mediaType === "audio") return ".ogg";
    if (mediaType === "document") return ".bin";
    if (mediaType === "sticker") return ".webp";
    return ".bin";
  }

  /**
   * Process a single incoming WhatsApp message of any type
   */
  private async processIncomingMessage(
    workspaceId: string,
    msg: any,
    value: any,
  ): Promise<void> {
    const from = msg.from;
    const senderName = value.contacts?.[0]?.profile?.name ?? from;

    // Determine message type and extract content
    let bodyText = '';
    let messageType = 'TEXT';
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaFilename: string | null = null;
    let mediaCaption: string | null = null;
    let hasMedia = false;
    let replyToMessageId: string | null = null;
    let interactiveType: string | null = null;
    let buttonPayload: any = null;

    // ── Text ──
    if (msg.text) {
      bodyText = msg.text.body ?? '';
      messageType = 'TEXT';
    }

    // ── Image ──
    if (msg.image) {
      messageType = 'IMAGE';
      hasMedia = true;
      mediaMimeType = msg.image.mime_type ?? null;
      mediaCaption = msg.image.caption ?? null;
      // Store the Meta media ID — real download URL via /media endpoint later
      mediaUrl = msg.image.id ?? null;
    }

    // ── Video ──
    if (msg.video) {
      messageType = 'VIDEO';
      hasMedia = true;
      mediaMimeType = msg.video.mime_type ?? null;
      mediaCaption = msg.video.caption ?? null;
      mediaUrl = msg.video.id ?? null;
    }

    // ── Audio ──
    if (msg.audio) {
      messageType = 'AUDIO';
      hasMedia = true;
      mediaMimeType = msg.audio.mime_type ?? null;
      mediaUrl = msg.audio.id ?? null;
    }

    // ── Document ──
    if (msg.document) {
      messageType = 'DOCUMENT';
      hasMedia = true;
      mediaMimeType = msg.document.mime_type ?? null;
      mediaFilename = msg.document.filename ?? null;
      mediaCaption = msg.document.caption ?? null;
      mediaUrl = msg.document.id ?? null;
    }

    // ── Sticker ──
    if (msg.sticker) {
      messageType = 'STICKER';
      hasMedia = true;
      mediaMimeType = msg.sticker.mime_type ?? 'image/webp';
      mediaUrl = msg.sticker.id ?? null;
    }

    // ── Location ──
    if (msg.location) {
      messageType = 'LOCATION';
      bodyText = JSON.stringify({
        lat: msg.location.latitude,
        lng: msg.location.longitude,
        name: msg.location.name ?? '',
        address: msg.location.address ?? '',
      });
    }

    // ── Contact ──
    if (msg.contacts?.length) {
      messageType = 'CONTACT';
      const contact = msg.contacts[0];
      bodyText = JSON.stringify({
        name: contact.name?.formatted_name ?? '',
        phones: contact.phones?.map((p: any) => p.phone) ?? [],
      });
    }

    // ── Reaction ──
    if (msg.reaction) {
      messageType = 'REACTION';
      bodyText = msg.reaction.emoji ?? '';
      replyToMessageId = msg.reaction.message_id ?? null;
    }

    // ── Reply context (attached to any message type) ──
    if (msg.context?.id) {
      replyToMessageId = replyToMessageId ?? msg.context.id;
    }

    // ── Button reply ──
    if (msg.button) {
      interactiveType = 'button_reply';
      bodyText = msg.button.text ?? '';
      buttonPayload = { payload: msg.button.payload, id: msg.button.id };
    }

    // ── List reply ──
    if (msg.interactive?.list_reply) {
      interactiveType = 'list_reply';
      bodyText = msg.interactive.list_reply.title ?? '';
      buttonPayload = { id: msg.interactive.list_reply.id, description: msg.interactive.list_reply.description };
    }

    // ── Order ──
    if (msg.order) {
      messageType = 'ORDER';
      bodyText = JSON.stringify({
        catalog_id: msg.order.catalog_id,
        items: msg.order.product_items,
        text: msg.order.text ?? '',
      });
    }

    const normalizedPayload = {
      from,
      name: senderName,
      text: bodyText,
      message_type: messageType,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      media_filename: mediaFilename,
      media_caption: mediaCaption,
      has_media: hasMedia,
      reply_to_message_id: replyToMessageId,
      interactive_type: interactiveType,
      button_payload: buttonPayload,
      external_id: msg.id, // wamid.xxx
      raw: value,
    };

    await this.messages.receiveInbound('whatsapp', workspaceId, normalizedPayload);
  }

  /**
   * Process delivery status webhook updates from Meta
   */
  private async processStatuses(workspaceId: string, statuses: any[]): Promise<void> {
    for (const status of statuses) {
      const wamid = status.id; // the external message ID
      const deliveryStatus = this.mapMetaStatus(status.status);

      if (!wamid) continue;

      try {
        const messages = await this.prisma.message.findMany({
          where: {
            workspace_id: workspaceId,
            external_message_id: wamid,
          },
          select: { id: true, conversation_id: true },
        });
        if (messages.length === 0) {
          this.logger.warn(`No local message matched WhatsApp status for ${wamid}`);
        }

        const deliveryError = status.errors?.length
          ? status.errors
              .map((e: any) => `${e.code}: ${e.title ?? e.message}`)
              .join('; ')
          : null;
        const finalStatus = deliveryError ? MessageDeliveryStatus.FAILED : deliveryStatus;

        const updated = await this.prisma.message.updateMany({
          where: {
            workspace_id: workspaceId,
            external_message_id: wamid,
          },
          data: {
            delivery_status: finalStatus,
            ...(deliveryError
              ? {
                  delivery_error: deliveryError,
                }
              : {}),
          },
        });

        if (updated.count > 0) {
          this.logger.debug(
            `Updated message ${wamid} status → ${finalStatus} (${updated.count} rows)`,
          );
          for (const message of messages) {
            this.events.emitMessageStatus({
              message_id: message.id,
              conversation_id: message.conversation_id,
              workspace_id: workspaceId,
              delivery_status: finalStatus,
              delivery_error: deliveryError,
              external_message_id: wamid,
              provider_message_id: wamid,
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error updating status for ${wamid}: ${err?.message}`);
      }
    }
  }

  /**
   * Map Meta status string to our enum
   */
  private mapMetaStatus(metaStatus: string): MessageDeliveryStatus {
    switch (metaStatus) {
      case 'sent':      return MessageDeliveryStatus.SENT;
      case 'delivered': return MessageDeliveryStatus.DELIVERED;
      case 'read':      return MessageDeliveryStatus.READ;
      case 'failed':    return MessageDeliveryStatus.FAILED;
      default:          return MessageDeliveryStatus.SENT;
    }
  }

  // ── Verificar webhook de Meta ──────────────────────────────────────────────

  /**
   * Verify the X-Hub-Signature-256 header using the app secret
   */
  verifySignature(
    rawBody: string | Buffer,
    appSecret: string,
    signatureHeader: string,
  ): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expected =
      'sha256=' +
      crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signatureHeader),
      );
    } catch {
      return false;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode === "subscribe" && token === verifyToken) {
      this.logger.log("WhatsApp webhook verified successfully");
      return challenge;
    }
    this.logger.warn(`Webhook verification failed — token mismatch`);
    return null;
  }

  async downloadMedia(
    messageId: string,
    workspaceId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, workspace_id: workspaceId },
      select: {
        raw_payload_json: true,
        attachments_json: true,
        conversation: { select: { channel_id: true } },
      },
    });
    if (!msg) throw new BadGatewayException("Mensaje no encontrado");

    // ── Prioritize MinIO storage ──────────────────────────────────────────
    const attachments = msg.attachments_json as any[] | null | undefined;
    const attachmentEntry = attachments?.[0] ?? null;
    if (attachmentEntry?.storageKey) {
      try {
        const presignedUrl = await this.storage.getPresignedUrl(attachmentEntry.storageKey, 3600);
        const fileRes = await fetch(presignedUrl, { signal: AbortSignal.timeout(30_000) });
        if (fileRes.ok) {
          const buffer = Buffer.from(await fileRes.arrayBuffer());
          const contentType =
            attachmentEntry.mimeType ||
            fileRes.headers.get("content-type") ||
            "application/octet-stream";
          this.logger.log(
            `downloadMedia: served from MinIO — msg=${messageId} key=${attachmentEntry.storageKey}`,
          );
          return { buffer, contentType };
        }
        this.logger.warn(
          `downloadMedia: MinIO fetch failed — msg=${messageId} status=${fileRes.status}, falling back to Meta`,
        );
      } catch (err) {
        this.logger.warn(
          `downloadMedia: MinIO error — msg=${messageId}: ${err.message}, falling back to Meta`,
        );
      }
    }

    // ── Fallback: fetch from Meta API ─────────────────────────────────────
    const payload = msg.raw_payload_json as any;
    if (!payload) {
      this.logger.warn(`downloadMedia: raw_payload_json is null for message ${messageId}`);
      throw new BadGatewayException("Media no disponible");
    }

    // Handle string payloads (legacy stringifyJson)
    const parsed = parseJsonValue<Record<string, any>>(payload, {});

    let mediaId: string | null = null;

    // Canonical: whatsapp_media field stored during inbound processing
    const wm = parsed.whatsapp_media;
    if (wm) {
      if (wm.whatsappMediaId) {
        mediaId = wm.whatsappMediaId;
        this.logger.log(
          `downloadMedia: found media via whatsapp_media.whatsappMediaId — id=${mediaId}`,
        );
      } else if (wm.id) {
        mediaId = wm.id;
        this.logger.log(
          `downloadMedia: found media via whatsapp_media.id (legacy) — id=${mediaId}`,
        );
      }
    }

    // Fallback: navigate full webhook payload structure
    if (!mediaId) {
      const wrappedBody = parsed?.raw_payload ?? parsed;
      const inner = wrappedBody?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const msgPayload = parsed?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ?? inner ?? parsed;
      const mediaObj =
        msgPayload?.image ?? msgPayload?.document ?? msgPayload?.audio ?? msgPayload?.video;
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
      throw new BadGatewayException("No se encontró media en el mensaje");
    }

    const channel = await this.prisma.channel.findFirst({
      where: { id: msg.conversation.channel_id, workspace_id: workspaceId },
      select: { config_json: true },
    });
    if (!channel) throw new BadGatewayException("Canal no encontrado");

    const raw = channel.config_json as any;
    const cfg = parseJsonValue<Record<string, any>>(raw, {});
    if (!cfg?.access_token_encrypted)
      throw new BadGatewayException("WhatsApp access token no configurado");

    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);

    const mediaRes = await fetch(`${META_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!mediaRes.ok) throw new BadGatewayException("Error al obtener metadata del media");

    const mediaData: Record<string, any> = await mediaRes.json();
    const downloadUrl = mediaData.url;

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!fileRes.ok) throw new BadGatewayException("Error al descargar media");

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const contentType =
      mediaData.mime_type || fileRes.headers.get("content-type") || "application/octet-stream";

    return { buffer, contentType };
  }
}
