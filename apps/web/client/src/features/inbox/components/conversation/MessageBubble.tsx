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
  className?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
const URL_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/;

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

export const MessageBubble = function MessageBubble({
  message,
  isConsecutive,
  showSenderName,
  contactName,
  contactAvatarInitials,
  className,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";
  const hasMedia = !!message.mediaType && message.mediaType !== "text";
  const isShort = message.bodyText?.length < 100;

  const timeString = useMemo(() => {
    return message.sentAt ? new Date(message.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }) : "";
  }, [message.sentAt]);

  const senderLabel = isOutbound ? "Tú" : (contactName || "Contacto");

  const bubbleClasses = useMemo(() => {
    const base = "max-w-[75%]";
    const spacing = isConsecutive ? "mt-0.5" : "mt-2";

    if (message.mediaType === "sticker") {
      return `${base} ${spacing} bg-transparent border-0 shadow-none rounded-none px-0 py-0`;
    }

    if (message.mediaType === "image" || message.mediaType === "video") {
      const radius = isConsecutive
        ? isOutbound ? "rounded-tr-sm rounded-bl-lg rounded-br-lg" : "rounded-tl-sm rounded-bl-lg rounded-br-lg"
        : "rounded-2xl";
      const bg = isOutbound
        ? "bg-primary/[0.06] border border-primary/[0.10]"
        : "bg-card border border-border/40 shadow-sm";
      return `${base} ${spacing} ${bg} ${radius} px-1 py-1`;
    }

    if (message.mediaType === "audio") {
      const radius = isConsecutive
        ? isOutbound ? "rounded-tr-sm rounded-bl-lg rounded-br-lg" : "rounded-tl-sm rounded-bl-lg rounded-br-lg"
        : "rounded-2xl";
      const bg = isOutbound
        ? "bg-primary/[0.06] border border-primary/[0.10]"
        : "bg-card border border-border/40 shadow-sm";
      return `${base} ${spacing} ${bg} ${radius} px-2 py-1.5`;
    }

    if (message.mediaType === "document" || message.mediaType === "location" || message.mediaType === "contact") {
      const radius = isConsecutive
        ? isOutbound ? "rounded-tr-sm rounded-bl-lg rounded-br-lg" : "rounded-tl-sm rounded-bl-lg rounded-br-lg"
        : "rounded-2xl";
      const bg = isOutbound
        ? "bg-primary/[0.06] border border-primary/[0.10]"
        : "bg-card border border-border/40 shadow-sm";
      return `${base} ${spacing} ${bg} ${radius} px-2 py-2`;
    }

    const radius = isConsecutive
      ? isOutbound ? "rounded-tr-md rounded-bl-2xl rounded-br-2xl" : "rounded-tl-md rounded-bl-2xl rounded-br-2xl"
      : "rounded-2xl";
    const bg = isOutbound
      ? "bg-primary/[0.08] border border-primary/[0.12]"
      : "bg-card border border-border/50 shadow-sm";
    const padding = isShort ? "px-3 py-2" : "px-3.5 py-2.5";
    return `${base} ${spacing} ${bg} ${radius} ${padding}`;
  }, [message.mediaType, isConsecutive, isOutbound, isShort]);

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
    <div className={`flex gap-2 ${isOutbound ? "justify-end" : ""} ${className ?? ""}`} role="article" aria-label={`${senderLabel} · ${timeString}`}>
      {!isOutbound && !isConsecutive && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-auto ring-1 ring-border/50" aria-label={`Avatar de ${senderLabel}`}>
          <span className="text-[10px] font-semibold text-muted-foreground">
            {contactAvatarInitials || getInitials(contactName || "")}
          </span>
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
        />
      </div>
    </div>
  );
};
