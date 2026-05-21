export type WhatsAppMediaKind = "image" | "video" | "audio" | "document" | "sticker";

export interface ExtractedWhatsAppMedia {
  whatsappMediaId: string;
  mediaType: WhatsAppMediaKind;
  mimeType: string | null;
  sha256: string | null;
  caption: string | null;
  filename: string | null;
  isVoice: boolean | null;
  isAnimated: boolean | null;
  rawMedia: Record<string, unknown>;
}

export function extractWhatsAppMediaFromMessage(
  msg: Record<string, any>,
): ExtractedWhatsAppMedia | null {
  if (!msg || typeof msg !== "object") return null;

  const type = msg.type as WhatsAppMediaKind | undefined;
  if (!type) return null;

  const supportedMediaTypes: WhatsAppMediaKind[] = [
    "image",
    "video",
    "audio",
    "document",
    "sticker",
  ];
  if (!supportedMediaTypes.includes(type)) return null;

  const mediaObj = msg.image ?? msg.video ?? msg.audio ?? msg.document ?? msg.sticker ?? null;

  if (!mediaObj?.id) return null;

  return {
    whatsappMediaId: mediaObj.id,
    mediaType: type,
    mimeType: mediaObj.mime_type ?? null,
    sha256: mediaObj.sha256 ?? null,
    caption: mediaObj.caption ?? null,
    filename: mediaObj.filename ?? null,
    isVoice: mediaObj.voice ?? null,
    isAnimated: mediaObj.animated ?? null,
    rawMedia: mediaObj,
  };
}
