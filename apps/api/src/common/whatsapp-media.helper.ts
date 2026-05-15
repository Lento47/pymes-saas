export type WhatsAppMediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface ExtractedWhatsAppMedia {
  id: string;
  kind: WhatsAppMediaKind;
  mime_type?: string;
  sha256?: string;
  filename?: string;
  caption?: string;
}

export function extractWhatsAppMediaFromMessage(msg: any): ExtractedWhatsAppMedia | null {
  if (!msg || typeof msg !== 'object') return null;

  const kind = msg.type as WhatsAppMediaKind | undefined;
  if (!kind) return null;

  const mediaObj =
    msg.image ??
    msg.video ??
    msg.audio ??
    msg.document ??
    msg.sticker ??
    null;

  if (!mediaObj?.id) return null;

  return {
    id: mediaObj.id,
    kind,
    mime_type: mediaObj.mime_type,
    sha256: mediaObj.sha256,
    filename: mediaObj.filename,
    caption: mediaObj.caption,
  };
}
