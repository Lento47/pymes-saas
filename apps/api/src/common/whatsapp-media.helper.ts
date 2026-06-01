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

/** Structured representation of a WhatsApp interactive message */
export interface WhatsAppInteractiveContent {
  type: "button_reply" | "list_reply" | "nfm_reply";
  /** The option the user selected */
  title: string;
  /** Optional description or ID */
  description?: string;
  /** Original interactive payload for full rendering */
  raw: Record<string, unknown>;
}

export function extractInteractiveContent(
  msg: Record<string, any>,
): WhatsAppInteractiveContent | null {
  if (!msg || typeof msg !== "object") return null;

  if (msg.type === "button") {
    return {
      type: "button_reply",
      title: msg.button?.text ?? "Botón",
      description: msg.button?.payload,
      raw: msg.button ?? {},
    };
  }

  if (msg.type !== "interactive") return null;
  const ir = msg.interactive;
  if (!ir) return null;

  if (ir.button_reply) {
    return {
      type: "button_reply",
      title: ir.button_reply.title ?? ir.button_reply.id ?? "Botón",
      description: ir.button_reply.id,
      raw: ir,
    };
  }

  if (ir.list_reply) {
    return {
      type: "list_reply",
      title: ir.list_reply.title ?? ir.list_reply.id ?? "Opción",
      description: ir.list_reply.description,
      raw: ir,
    };
  }

  if (ir.nfm_reply) {
    return {
      type: "nfm_reply",
      title: ir.nfm_reply.name ?? "Flow",
      description: ir.nfm_reply.response_json
        ? JSON.stringify(ir.nfm_reply.response_json)
        : undefined,
      raw: ir,
    };
  }

  return null;
}
