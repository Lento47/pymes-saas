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
import { InteractiveAttachment } from "../media/InteractiveAttachment";

interface MessageBubbleProps {
  message: UiMessage;
  isConsecutive: boolean;
  showSenderName: boolean;
  isNew?: boolean;
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
  | "interactive"
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
          className="break-all text-primary hover:underline"
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
    case "interactive":
      return "interactive";
    case "text":
    case null:
    case undefined:
      return message.direction === "INTERNAL" ? "system" : "text";
    default:
      return "text";
  }
}

function bubbleRadius(isOutbound: boolean, isConsecutive: boolean, loose = false) {
  if (!isConsecutive) return loose ? "rounded-[17px] sm:rounded-[18px]" : "rounded-[17px] sm:rounded-2xl";
  return isOutbound
    ? loose ? "rounded-[17px] rounded-tr-md sm:rounded-[18px]" : "rounded-[17px] rounded-tr-md sm:rounded-2xl"
    : loose ? "rounded-[17px] rounded-tl-md sm:rounded-[18px]" : "rounded-[17px] rounded-tl-md sm:rounded-2xl";
}

export const MessageBubble = function MessageBubble({
  message,
  isConsecutive,
  showSenderName,
  isNew = false,
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
    const spacing = isConsecutive ? "mt-0.5" : "mt-2";
    const surface = isOutbound
      ? "border border-primary/[0.14] bg-primary/[0.075]"
      : "border border-border/55 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

    switch (variant) {
      case "sticker":
        return `max-w-[160px] sm:max-w-[180px] ${spacing} border-0 bg-transparent px-0 py-0 shadow-none`;
      case "media":
        return `relative max-w-[84%] sm:max-w-[360px] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive, true)} overflow-hidden p-1`;
      case "audio":
        return `max-w-[86%] sm:max-w-[340px] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive, true)} px-2.5 py-2`;
      case "document":
      case "location":
      case "contact":
      case "interactive":
        return `max-w-[86%] sm:max-w-[360px] ${spacing} border-0 bg-transparent p-0 shadow-none`;
      case "system":
        return `max-w-[88%] ${spacing} rounded-full border border-border/40 bg-muted/45 px-3 py-1.5`;
      case "text":
      default:
        return `max-w-[84%] sm:max-w-[68%] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive)} ${isShort ? "px-3 py-2" : "px-3.5 py-2.5"}`;
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
      case "interactive": {
        const interactive = message.attachments.find(a => a.type === "interactive");
        return (
          <InteractiveAttachment
            interactiveType={interactive?.interactiveType}
            title={interactive?.title}
            body={interactive?.body}
            description={interactive?.description}
            footer={interactive?.footer}
            actionLabel={interactive?.actionLabel}
            buttons={interactive?.buttons}
            sections={interactive?.sections}
            fallbackText={message.bodyText}
          />
        );
      }
      default:
        return (
          <div className={`whitespace-pre-wrap break-words text-[13.5px] text-foreground sm:text-sm ${isShort ? "leading-snug" : "leading-relaxed"} overflow-hidden`}>
            {renderTextWithLinks(message.bodyText)}
          </div>
        );
    }
  };

  const entryClass = isNew
    ? message.direction === "INTERNAL"
      ? "message-entry-system"
      : isOutbound
        ? "message-entry-outbound"
        : "message-entry-inbound"
    : "";

  return (
    <div className={`flex gap-1.5 px-0.5 sm:gap-2 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`} role="article" aria-label={`${senderLabel} · ${timeString}`}>
      {!isOutbound && !isConsecutive && (
        <div className="mt-auto flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/50 sm:h-6 sm:w-6" aria-label={`Avatar de ${senderLabel}`}>
          {contactAvatarUrl ? (
            <img src={contactAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
              {contactAvatarInitials || getInitials(contactName || "")}
            </span>
          )}
        </div>
      )}
      {!isOutbound && isConsecutive && (
        <div className="w-5 shrink-0 sm:w-6" aria-hidden="true" />
      )}
      <div className={bubbleClasses}>
        {renderContent()}
        <MessageMeta
          message={message}
          isOutbound={isOutbound}
          showSenderName={showSenderName}
          compact={variant === "sticker" || variant === "document" || variant === "location" || variant === "contact" || variant === "interactive"}
          overlay={variant === "media"}
        />
      </div>
    </div>
  );
};
