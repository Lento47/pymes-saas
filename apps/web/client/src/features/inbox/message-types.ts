export type MessageDirection = "INBOUND" | "OUTBOUND" | "INTERNAL";
export type MediaType = "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact" | "interactive" | "text";
export type MediaStatus = "none" | "processing" | "available" | "error";

export interface MessageAttachment {
  type: MediaType;
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  caption?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  thumbnailUrl?: string | null;
  interactiveType?: string | null;
  title?: string | null;
  body?: string | null;
  description?: string | null;
  footer?: string | null;
  actionLabel?: string | null;
  buttons?: Array<{ title: string }>;
  sections?: Array<{ title?: string | null; rows: Array<{ title: string; description?: string | null }> }>;
}

export interface UiMessage {
  id: string;
  direction: MessageDirection;
  senderName?: string | null;
  senderRef?: string | null;
  senderAvatarUrl?: string | null;
  bodyText: string;
  sentAt: Date | null;
  hasMedia: boolean;
  mediaType: MediaType | null;
  mediaStatus: MediaStatus;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  mediaCaption: string | null;
  attachments: MessageAttachment[];
  isSticker: boolean;
  isLocation: boolean;
  isContact: boolean;
  isReaction: boolean;
  provider?: string | null;
  deliveryStatus?: string | null;
  deliveryError?: string | null;
  replyToMessageId?: string | null;
  wamid?: string | null;
  bodyHtml?: string | null;
  raw?: Record<string, any>;
}

export interface MessageGroup {
  date: Date;
  messages: UiMessage[];
}
