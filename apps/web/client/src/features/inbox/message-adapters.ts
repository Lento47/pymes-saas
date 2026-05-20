import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import type { MessageDirection, MediaType, MediaStatus, UiMessage, MessageAttachment, MessageGroup } from "./message-types";

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
  if (raw.body_html) return String(raw.body_html).replace(/<[^>]*>/g, "");
  return "";
}

function detectMediaType(raw: Record<string, any>, bodyText: string): MediaType | null {
  const messageType = raw.message_type;
  const mediaType = raw.media_type;

  if (mediaType === "image" || mediaType === "video" || mediaType === "audio" || mediaType === "document" || mediaType === "sticker" || mediaType === "location" || mediaType === "contact") {
    return mediaType;
  }

  if (messageType === "sticker" || messageType === "location" || messageType === "contact") {
    return messageType;
  }

  if (bodyText.startsWith("\ud83d\udccd ")) return "location";
  if (bodyText.startsWith("\ud83d\udc64 ")) return "contact";

  return null;
}

function detectSticker(raw: Record<string, any>): boolean {
  if (raw.media_type === "sticker" || raw.message_type === "sticker") return true;

  const mimeType = raw.media_mime_type;
  const filename = raw.media_filename;
  if (mimeType === "image/webp" && filename?.endsWith(".webp")) return true;

  return false;
}

function detectLocation(raw: Record<string, any>, bodyText: string): boolean {
  return raw.media_type === "location" || raw.message_type === "location" || bodyText.startsWith("\ud83d\udccd ");
}

function detectContact(raw: Record<string, any>, bodyText: string): boolean {
  return raw.media_type === "contact" || raw.message_type === "contact" || bodyText.startsWith("\ud83d\udc64 ");
}

function buildMediaUrl(raw: Record<string, any>): string | null {
  if (raw.media_download_url) return String(raw.media_download_url);
  if (raw.has_media) return `/api/conversations/messages/${raw.id}/media`;
  return null;
}

function extractMediaStatus(raw: Record<string, any>): MediaStatus {
  const status = raw.media_status;
  if (status === "none" || status === "processing" || status === "available" || status === "error") return status;
  return raw.has_media ? "available" : "none";
}

function buildAttachments(raw: Record<string, any>): MessageAttachment[] {
  const json = raw.attachments_json;
  if (!Array.isArray(json) || json.length === 0) return [];

  return json.map((a: Record<string, any>) => {
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
  });
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
    sentAt: raw.sent_at ? new Date(raw.sent_at) : raw.created_at ? new Date(raw.created_at) : null,
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
    provider: raw.provider ?? null,
    deliveryStatus: raw.delivery_status ?? null,
    deliveryError: raw.delivery_error ?? null,
    raw,
  };
}

export function groupMessagesByDate(messages: UiMessage[]): MessageGroup[] {
  const sorted = [...messages].sort((a, b) => {
    if (!a.sentAt) return 1;
    if (!b.sentAt) return -1;
    return a.sentAt.getTime() - b.sentAt.getTime();
  });

  const groups: MessageGroup[] = [];

  for (const msg of sorted) {
    if (!msg.sentAt) continue;

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && isSameDay(lastGroup.date, msg.sentAt)) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: msg.sentAt, messages: [msg] });
    }
  }

  return groups;
}

export function isConsecutiveMessage(current: UiMessage, previous: UiMessage | null): boolean {
  if (!previous) return false;
  if (current.direction !== previous.direction) return false;
  if (!current.sentAt || !previous.sentAt) return false;

  const diffMs = Math.abs(current.sentAt.getTime() - previous.sentAt.getTime());
  if (diffMs > 5 * 60 * 1000) return false;

  const currentSender = current.senderRef ?? current.senderName;
  const previousSender = previous.senderRef ?? previous.senderName;
  if (currentSender !== previousSender) return false;

  return true;
}
