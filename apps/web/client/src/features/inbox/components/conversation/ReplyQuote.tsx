import type { UiMessage } from "@/features/inbox/message-types";
import { Image, Music, FileText, MapPin, User, MessageSquare, Video, Smile } from "lucide-react";

interface ReplyQuoteProps {
  quotedMessage: Pick<UiMessage, "bodyText" | "senderName" | "direction" | "mediaType" | "mediaCaption" | "mediaFilename">;
  isOutbound: boolean;
  quoteCls: string;
  senderCls: string;
  textCls: string;
}

/** Icon + label for each media type — matches WhatsApp/Telegram reply preview style */
const MEDIA_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  image:       { icon: Image,        label: "Foto" },
  video:       { icon: Video,        label: "Video" },
  audio:       { icon: Music,        label: "Audio" },
  document:    { icon: FileText,     label: "Documento" },
  sticker:     { icon: Smile,        label: "Sticker" },
  location:    { icon: MapPin,       label: "Ubicación" },
  contact:     { icon: User,         label: "Contacto" },
  interactive: { icon: MessageSquare, label: "Mensaje" },
};

export function ReplyQuote({ quotedMessage, isOutbound, quoteCls, senderCls, textCls }: ReplyQuoteProps) {
  const sender = quotedMessage.direction === "OUTBOUND" ? "Tú" : (quotedMessage.senderName || "Contacto");

  const mediaType = quotedMessage.mediaType;
  const meta = mediaType ? MEDIA_META[mediaType] : null;
  const Icon = meta?.icon;

  // Build preview: caption takes priority, then bodyText, then media label
  const captionOrText = (quotedMessage.mediaCaption || quotedMessage.bodyText || "").trim();
  const preview = captionOrText || meta?.label || "Mensaje";
  const showMediaTag = meta && !captionOrText; // show icon+label when there's no text/caption
  const showMediaBadge = meta && captionOrText; // show small badge when there IS text alongside media

  return (
    <div className={`mb-1.5 rounded-md px-2.5 py-1.5 ${quoteCls}`}>
      <span className={`block text-[10px] font-semibold leading-tight ${senderCls}`}>{sender}</span>

      {/* Media tag: icon + label when no text (e.g. quoted a pure image) */}
      {showMediaTag && Icon && (
        <span className={`mt-0.5 flex items-center gap-1 text-[11px] leading-snug ${textCls}`}>
          <Icon className="h-3 w-3 shrink-0 opacity-70" />
          {meta.label}
          {quotedMessage.mediaFilename && (
            <span className="opacity-50 truncate max-w-[120px]">· {quotedMessage.mediaFilename}</span>
          )}
        </span>
      )}

      {/* Text preview — block layout so line-clamp works properly */}
      {captionOrText && (
        <p className={`mt-0.5 text-[11px] leading-snug line-clamp-2 break-words ${textCls}`}>
          {showMediaBadge && Icon && (
            <Icon className="mr-1 inline h-3 w-3 align-text-bottom opacity-60" />
          )}
          {preview}
        </p>
      )}
    </div>
  );
}
