import { isSameDay } from "date-fns";
import type { MessageDirection, MediaType, MediaStatus, UiMessage, MessageAttachment, MessageGroup } from "./message-types";

function safeDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}

function extractDirection(raw: Record<string, any>): MessageDirection {
  const dir = raw.direction;
  if (dir === "INBOUND" || dir === "OUTBOUND" || dir === "INTERNAL") return dir;
  return "INBOUND";
}

function extractSenderInfo(raw: Record<string, any>): { name?: string | null; ref?: string | null; avatarUrl?: string | null } {
  const senderUser = raw.sender_user;
  return {
    name: raw.sender_name ?? senderUser?.name ?? null,
    ref: raw.sender_ref ?? senderUser?.id ?? null,
    avatarUrl: senderUser?.avatar_url ?? null,
  };
}

function extractBodyText(raw: Record<string, any>): string {
  if (raw.body_text) return String(raw.body_text);
  if (raw.body_html) {
    const stripped = String(raw.body_html).replace(/<[^>]*>/g, "");
    return stripped
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\\d+);/g, (_, num) => String.fromCharCode(Number(num)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return "";
}

function parseJsonValue(value: unknown): any {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function getRawPayload(raw: Record<string, any>): Record<string, any> | null {
  const payload = parseJsonValue(raw.raw_payload_json);
  return payload && typeof payload === "object" ? payload : null;
}

function getWhatsAppMessage(rawPayload: Record<string, any> | null): Record<string, any> | null {
  if (!rawPayload) return null;
  if (rawPayload.messages?.[0]) return rawPayload.messages[0];

  const entryMessage = rawPayload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (entryMessage) return entryMessage;

  return null;
}

function isGenericInteractiveText(text: string): boolean {
  return /mensaje (de tipo interactive|interactivo de whatsapp)/i.test(text);
}

type InteractiveAttachmentData = Pick<
  MessageAttachment,
  "type" | "interactiveType" | "title" | "body" | "description" | "footer" | "actionLabel" | "buttons" | "sections"
>;

function extractInteractiveAttachment(raw: Record<string, any>, bodyText: string): InteractiveAttachmentData | null {
  const payload = parseJsonValue(raw.button_payload_json);
  const rawPayload = getRawPayload(raw);

  // New: structured interactive content stored by backend
  const storedInteractive = rawPayload?.whatsapp_interactive as Record<string, any> | undefined;
  if (storedInteractive?.type) {
    const sit = storedInteractive;
    switch (sit.type) {
      case "button_reply":
        return { type: "interactive", interactiveType: "button_reply", title: sit.title ?? bodyText, body: "Respuesta seleccionada" };
      case "list_reply":
        return { type: "interactive", interactiveType: "list_reply", title: sit.title ?? bodyText, description: sit.description, body: "Opción seleccionada" };
      case "nfm_reply":
        return { type: "interactive", interactiveType: "nfm_reply", title: sit.title ?? "Flow", description: sit.description, body: "Respuesta de flow" };
    }
  }

  // Fallback: parse raw WhatsApp webhook payload
  const whatsAppMessage = getWhatsAppMessage(rawPayload);
  const whatsAppInteractive = whatsAppMessage?.interactive;
  const dbInteractiveType = raw.interactive_type ? String(raw.interactive_type) : null;
  const payloadType = payload?.type ? String(payload.type) : null;
  const whatsAppType = whatsAppInteractive?.type ? String(whatsAppInteractive.type) : null;
  const interactiveType = dbInteractiveType ?? payloadType ?? whatsAppType ?? (isGenericInteractiveText(bodyText) ? "interactive" : null);

  if (!interactiveType && !payload && !whatsAppInteractive && !whatsAppMessage?.button) return null;

  if (whatsAppMessage?.button) {
    return {
      type: "interactive",
      interactiveType: "button_reply",
      title: whatsAppMessage.button.text ?? bodyText ?? null,
      body: "Respuesta seleccionada",
    };
  }

  if (whatsAppInteractive?.button_reply) {
    return {
      type: "interactive",
      interactiveType: "button_reply",
      title: whatsAppInteractive.button_reply.title ?? bodyText ?? null,
      body: "Respuesta seleccionada",
    };
  }

  if (whatsAppInteractive?.list_reply) {
    return {
      type: "interactive",
      interactiveType: "list_reply",
      title: whatsAppInteractive.list_reply.title ?? bodyText ?? null,
      description: whatsAppInteractive.list_reply.description ?? null,
      body: "Opción seleccionada",
    };
  }

  if (interactiveType === "button_reply" || interactiveType === "list_reply") {
    return {
      type: "interactive",
      interactiveType,
      title: bodyText && !isGenericInteractiveText(bodyText) ? bodyText : payload?.title ?? null,
      body: interactiveType === "list_reply" ? "Opción seleccionada" : "Respuesta seleccionada",
      description: payload?.description ?? null,
    };
  }

  if (payloadType === "button" || interactiveType === "button") {
    const buttons = Array.isArray(payload?.buttons)
      ? payload.buttons
          .map((button: Record<string, any>) => ({ title: String(button.title ?? button.text ?? "") }))
          .filter((button: { title: string }) => button.title.length > 0)
      : [];

    return {
      type: "interactive",
      interactiveType: "button",
      body: payload?.body ?? (bodyText && !isGenericInteractiveText(bodyText) ? bodyText : null),
      footer: payload?.footer ?? null,
      buttons,
    };
  }

  if (payloadType === "list" || interactiveType === "list") {
    const sections = Array.isArray(payload?.sections)
      ? payload.sections
          .map((section: Record<string, any>) => ({
            title: section.title ?? null,
            rows: Array.isArray(section.rows)
              ? section.rows
                  .map((row: Record<string, any>) => ({
                    title: String(row.title ?? ""),
                    description: row.description ?? null,
                  }))
                  .filter((row: { title: string }) => row.title.length > 0)
              : [],
          }))
          .filter((section: { rows: Array<{ title: string }> }) => section.rows.length > 0)
      : [];

    return {
      type: "interactive",
      interactiveType: "list",
      body: payload?.body ?? (bodyText && !isGenericInteractiveText(bodyText) ? bodyText : null),
      footer: payload?.footer ?? null,
      actionLabel: payload?.buttonText ?? payload?.button_text ?? "Ver opciones",
      sections,
    };
  }

  if (
    payloadType === "location_request" ||
    interactiveType === "location_request" ||
    interactiveType === "location_request_message" ||
    whatsAppType === "location_request_message"
  ) {
    return {
      type: "interactive",
      interactiveType: "location_request",
      body: payload?.body ?? whatsAppInteractive?.body?.text ?? (bodyText && !isGenericInteractiveText(bodyText) ? bodyText : "Comparte tu ubicación"),
      actionLabel: "Enviar ubicación",
    };
  }

  return {
    type: "interactive",
    interactiveType: interactiveType ?? "interactive",
    body: bodyText && !isGenericInteractiveText(bodyText) ? bodyText : "Mensaje interactivo de WhatsApp",
  };
}

/**
 * Priority: DB message_type → msg.media_type → inferred from body
 */
function detectMediaType(raw: Record<string, any>, bodyText: string): MediaType | null {
  // DB-level type
  const dbType = raw.message_type;
  const mediaType = raw.media_type;

  if (dbType) {
    const t = String(dbType).toLowerCase();
    if (t === "image" || t === "video" || t === "audio" || t === "document" ||
        t === "sticker" || t === "location" || t === "contact" || t === "interactive") {
      return t as MediaType;
    }
  }

  if (mediaType === "image" || mediaType === "video" || mediaType === "audio" ||
      mediaType === "document" || mediaType === "sticker" || mediaType === "location" ||
      mediaType === "contact" || mediaType === "interactive") {
    return mediaType;
  }

  if (extractInteractiveAttachment(raw, bodyText)) return "interactive";

  // Detect from bodyText patterns
  if (bodyText.startsWith("\ud83d\udccd ")) return "location";
  if (bodyText.startsWith("\ud83d\udc64 ")) return "contact";

  return null;
}

function detectSticker(raw: Record<string, any>): boolean {
  const dbType = String(raw.message_type ?? "").toLowerCase();
  if (dbType === "sticker") return true;
  if (raw.media_type === "sticker" || raw.message_type === "sticker") return true;

  const mimeType = raw.media_mime_type;
  const filename = raw.media_filename;
  if (mimeType === "image/webp" && filename?.endsWith(".webp")) return true;

  return false;
}

function detectLocation(raw: Record<string, any>, bodyText: string): boolean {
  return detectMediaType(raw, bodyText) === "location" ||
    raw.media_type === "location" || raw.message_type === "location" ||
    bodyText.startsWith("\ud83d\udccd ");
}

function detectContact(raw: Record<string, any>, bodyText: string): boolean {
  return detectMediaType(raw, bodyText) === "contact" ||
    raw.media_type === "contact" || raw.message_type === "contact" ||
    bodyText.startsWith("\ud83d\udc64 ");
}

function detectReaction(raw: Record<string, any>): boolean {
  return String(raw.message_type ?? "").toLowerCase() === "reaction";
}

function buildMediaUrl(raw: Record<string, any>): string | null {
  if (raw.media_download_url) return String(raw.media_download_url);
  if (raw.media_url) return String(raw.media_url);
  if (raw.has_media) return `/api/conversations/messages/${raw.id}/media`;
  return null;
}

function extractMediaStatus(raw: Record<string, any>): MediaStatus {
  const status = raw.media_status;
  if (status === "none" || status === "processing" || status === "available" || status === "error") return status;
  return raw.has_media ? "available" : "none";
}

function extractDeliveryStatus(raw: Record<string, any>): string | null {
  return raw.delivery_status ?? raw.provider_status ?? null;
}

function parseAttachments(raw: Record<string, any>): { type: string; url: string; filename?: string; mimeType?: string } | null {
  // Check explicit media_url from DB
  const mediaUrl = raw.media_url ?? raw.media_download_url;
  if (mediaUrl) {
    return {
      type: raw.message_type ?? "document",
      url: String(mediaUrl),
      filename: raw.media_filename ?? undefined,
      mimeType: raw.media_mime_type ?? undefined,
    };
  }
  return null;
}

function buildAttachments(raw: Record<string, any>): MessageAttachment[] {
  const bodyText = extractBodyText(raw);
  const interactive = extractInteractiveAttachment(raw, bodyText);
  let json = raw.attachments_json ?? raw.attachments;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch { return interactive ? [interactive] : []; }
  }
  if (!Array.isArray(json) || json.length === 0) return interactive ? [interactive] : [];

  const attachments = json.map((a: Record<string, any>) => {
    if (!a) return null;
    const attachment: MessageAttachment = {
      type: a.type ?? "document",
      mimeType: a.mimeType ?? null,
      fileName: a.filename ?? null,
      sizeBytes: a.sizeBytes ?? null,
      url: a.url ?? null,
      caption: a.caption ?? null,
    };

    if (a.type === "location") {
      attachment.latitude = a.latitude ?? null;
      attachment.longitude = a.longitude ?? null;
      attachment.address = a.address ?? null;
    }

    if (a.type === "contact") {
      attachment.displayName = a.displayName ?? null;
      attachment.phone = a.phone ?? null;
      attachment.email = a.email ?? null;
    }

    attachment.width = a.width ?? null;
    attachment.height = a.height ?? null;
    attachment.durationMs = a.durationMs ?? null;
    attachment.thumbnailUrl = a.thumbnailUrl ?? null;

    return attachment;
  }).filter(Boolean) as MessageAttachment[];

  return interactive ? [interactive, ...attachments] : attachments;
}

export function normalizeMessage(raw: Record<string, any>): UiMessage {
  const bodyText = extractBodyText(raw);
  const mediaType = detectMediaType(raw, bodyText);
  const sender = extractSenderInfo(raw);

  return {
    id: String(raw.id),
    direction: extractDirection(raw),
    senderName: sender.name,
    senderRef: sender.ref,
    senderAvatarUrl: sender.avatarUrl,
    bodyText,
    sentAt: safeDate(raw.sent_at) ?? safeDate(raw.created_at),
    hasMedia: Boolean(raw.has_media),
    mediaType,
    mediaStatus: extractMediaStatus(raw),
    mediaUrl: buildMediaUrl(raw),
    mediaMimeType: raw.media_mime_type ?? null,
    mediaFilename: raw.media_filename ?? null,
    mediaCaption: raw.media_caption ?? null,
    attachments: buildAttachments(raw),
    isSticker: detectSticker(raw),
    isLocation: detectLocation(raw, bodyText),
    isContact: detectContact(raw, bodyText),
    isReaction: detectReaction(raw),
    provider: raw.provider ?? null,
    deliveryStatus: extractDeliveryStatus(raw),
    deliveryError: raw.delivery_error ?? null,
    replyToMessageId: raw.reply_to_message_id ?? null,
    wamid: raw.external_message_id ?? null,
    raw,
  };
}

export function isConsecutiveMessage(current: UiMessage, previous: UiMessage | null): boolean {
  if (!previous) return false;
  if (current.direction !== previous.direction) return false;
  if (!current.sentAt || !previous.sentAt) return false;

  const diffMs = Math.abs(current.sentAt.getTime() - previous.sentAt.getTime());
  if (diffMs > 5 * 60 * 1000) return false;

  const currentSender = current.senderRef ?? current.senderName;
  const previousSender = previous.senderRef ?? previous.senderName;
  if (!currentSender || !previousSender) return false;
  if (currentSender !== previousSender) return false;

  return true;
}
