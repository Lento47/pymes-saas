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
import { TelegramRichText } from "./TelegramRichText";
import { WhatsAppRichText } from "./WhatsAppRichText";

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

function renderTextWithLinks(text: string, isOutbound: boolean) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`break-all ${isOutbound ? "text-white/90 underline decoration-white/30" : "text-primary hover:underline"}`}
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
  const base = loose ? "rounded-2xl" : "rounded-2xl";
  if (!isConsecutive) return base;
  return isOutbound
    ? `${base} rounded-tr-md`
    : `${base} rounded-tl-md`;
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
    const spacing = isConsecutive ? "mt-0.5" : "mt-3";

    // ── PymesHub branded: solid indigo outbound, clean white inbound ──
    const surface = isOutbound
      ? "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]"
      : message.provider === "TELEGRAM"
        ? "bg-card border border-sky-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        : "bg-card border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

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
        return `max-w-[88%] ${spacing} rounded-full border border-border/30 bg-muted/30 px-3 py-1.5`;
      case "text":
      default:
        return `max-w-[84%] sm:max-w-[68%] ${spacing} ${surface} ${bubbleRadius(isOutbound, isConsecutive)} ${isShort ? "px-3.5 py-2" : "px-4 py-2.5"}`;
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
        return <AudioAttachment messageId={message.id} caption={message.mediaCaption} durationMs={audio?.durationMs} provider={message.provider} />;
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
            provider={message.provider}
          />
        );
      }
      default:
        if (message.provider === "TELEGRAM" && message.bodyHtml) {
          return (
            <div className={`overflow-hidden ${isOutbound ? "text-primary-foreground" : "text-foreground"}`}>
              <TelegramRichText html={message.bodyHtml} isOutbound={isOutbound} />
            </div>
          );
        }
        if (message.provider === "WHATSAPP") {
          return (
            <div className={`overflow-hidden ${isOutbound ? "text-primary-foreground" : "text-foreground"}`}>
              <WhatsAppRichText text={message.bodyText} isOutbound={isOutbound} />
            </div>
          );
        }
        return (
          <div className={`whitespace-pre-wrap break-words text-[13.5px] sm:text-[14px] ${isShort ? "leading-snug" : "leading-relaxed"} overflow-hidden ${isOutbound ? "text-primary-foreground" : "text-foreground"}`}>
            {renderTextWithLinks(message.bodyText, isOutbound)}
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
    <div className={`flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`} role="article" aria-label={`${senderLabel} · ${timeString}`}>
      {!isOutbound && !isConsecutive && (
        <div className="mt-auto flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/30 sm:h-7 sm:w-7" aria-label={`Avatar de ${senderLabel}`}>
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
        <div className="w-6 shrink-0 sm:w-7" aria-hidden="true" />
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
