import { useMemo } from "react";
import { SensitiveText } from "@/components/shared/sensitive-text";
import type { UiMessage } from "@/features/inbox/message-types";
import { MessageMeta } from "./MessageMeta";
import { ImageAttachment } from "../media/ImageAttachment";
import { StickerAttachment } from "../media/StickerAttachment";
import { AudioAttachment } from "../media/AudioAttachment";
import { VideoAttachment } from "../media/VideoAttachment";
import { DocumentAttachment } from "../media/DocumentAttachment";
import { LocationAttachment } from "../media/LocationAttachment";
import { ContactAttachment } from "../media/ContactAttachment";

interface MessageBubbleProps {
  message: UiMessage;
  isConsecutive: boolean;
  showSenderName: boolean;
  contactName?: string;
  contactAvatarInitials?: string;
  contactAvatarUrl?: string | null;
  className?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
const URL_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/;

type BubbleVariant =
  | "text"
  | "media"
  | "sticker"
  | "audio"
  | "document"
  | "location"
  | "contact"
  | "system";

function renderTextWithLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return <SensitiveText key={i} text={part} />;
  });
}

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function getBubbleVariant(message: UiMessage): BubbleVariant {
  switch (message.mediaType) {
    case "image":
    case "video":
      return "media";
    case "sticker":
      return "sticker";
    case "audio":
      return "audio";
    case "document":
      return "document";
    case "location":
      return "location";
    case "contact":
      return "contact";
    case "text":
    case null:
    case undefined:
      return message.direction === "INTERNAL" ? "system" : "text";
    default:
      return "text";
  }
}

function bubbleRadius(isOutbound: boolean, isConsecutive: boolean, loose = false) {
  if (!isConsecutive) return loose ? "rounded-[18px]" : "rounded-2xl";
  return isOutbound
    ? loose ? "rounded-[18px] rounded-tr-md" : "rounded-2xl rounded-tr-md"
    : loose ? "rounded-[18px] rounded-tl-md" : "rounded-2xl rounded-tl-md";
}

export const MessageBubble = function MessageBubble({
  message,
  isConsecutive,
  showSenderName,
  contactName,
  contactAvatarInitials,
  contactAvatarUrl,
  className,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";
  const isShort = message.bodyText?.length < 100;
  const variant = getBubbleVariant(message);

  const timeString = useMemo(() => {
    return message.sentAt ? new Date(message.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }) : "";
  }, [message.sentAt]);

  const senderLabel = isOutbound ? "Tú" : (contactName || "Contacto");

  const bubbleClasses = useMemo(() => {
    const spacing = isConsecutive ? "mt-0.5" : "mt-2.5";
    const surface = isOutbound
      ? "bg-primary/[0.075] border border-primary/[0.14]"
      : "bg-card border border-border/55 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

    switch (variant) {
      case "sticker":
        return `max-w-[180px] ${spacing} bg-transparent border-0 shadow-none px-0 py-0`;
      case "media":
        return `relative max-w-[78%] sm:max-w-[360px] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive, true)} p-1 overflow-hidden`;
      case "audio":
        return `max-w-[82%] sm:max-w-[340px] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive, true)} px-2.5 py-2`;
      case "document":
      case "location":
      case "contact":
        return `max-w-[82%] sm:max-w-[360px] ${spacing} bg-transparent border-0 shadow-none p-0`;
      case "system":
        return `max-w-[82%] ${spacing} rounded-full bg-muted/45 border border-border/40 px-3 py-1.5`;
      case "text":
      default:
        return `max-w-[78%] sm:max-w-[68%] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive)} ${isShort ? "px-3 py-2" : "px-3.5 py-2.5"}`;
    }
  }, [variant, isConsecutive, isOutbound, isShort]);

  const renderContent = () => {
    switch (message.mediaType) {
      case "image":
        return <ImageAttachment messageId={message.id} caption={message.mediaCaption} mimeType={message.mediaMimeType} />;
      case "sticker":
        return <StickerAttachment messageId={message.id} caption={message.mediaCaption} />;
      case "audio": {
        const audio = message.attachments.find(a => a.type === "audio");
        return <AudioAttachment messageId={message.id} caption={message.mediaCaption} durationMs={audio?.durationMs} />;
      }
      case "video":
        return <VideoAttachment messageId={message.id} caption={message.mediaCaption} mimeType={message.mediaMimeType} />;
      case "document": {
        const doc = message.attachments.find(a => a.type === "document");
        return <DocumentAttachment messageId={message.id} fileName={message.mediaFilename} mimeType={message.mediaMimeType} sizeBytes={doc?.sizeBytes} caption={message.mediaCaption} />;
      }
      case "location": {
        const loc = message.attachments.find(a => a.type === "location");
        return <LocationAttachment latitude={loc?.latitude} longitude={loc?.longitude} address={loc?.address} legacyText={message.bodyText} />;
      }
      case "contact": {
        const c = message.attachments.find(a => a.type === "contact");
        return <ContactAttachment displayName={c?.displayName} phone={c?.phone} email={c?.email} />;
      }
      default:
        return (
          <div className={`text-sm ${isShort ? "leading-snug" : "leading-relaxed"} text-foreground whitespace-pre-wrap break-words overflow-hidden`}>
            {renderTextWithLinks(message.bodyText)}
          </div>
        );
    }
  };

  return (
    <div className={`flex gap-2 px-1 ${isOutbound ? "justify-end" : ""} ${className ?? ""}`} role="article" aria-label={`${senderLabel} · ${timeString}`}>
      {!isOutbound && !isConsecutive && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-auto ring-1 ring-border/50 overflow-hidden" aria-label={`Avatar de ${senderLabel}`}>
          {contactAvatarUrl ? (
            <img src={contactAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground">
              {contactAvatarInitials || getInitials(contactName || "")}
            </span>
          )}
        </div>
      )}
      {!isOutbound && isConsecutive && (
        <div className="w-6 shrink-0" aria-hidden="true" />
      )}
      <div className={bubbleClasses}>
        {renderContent()}
        <MessageMeta
          message={message}
          isOutbound={isOutbound}
          showSenderName={showSenderName}
          compact={variant === "sticker" || variant === "document" || variant === "location" || variant === "contact"}
          overlay={variant === "media"}
        />
      </div>
    </div>
  );
};
