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

function renderTextWithLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return <SensitiveText key={i} text={part} />;
  });
}

export function MessageBubble({
  message,
  isConsecutive,
  showSenderName,
  contactName,
  contactAvatarInitials,
  className,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";

  const bubbleClasses = isOutbound
    ? "bg-primary/[0.08] border border-primary/[0.12] rounded-br-sm"
    : "bg-card border border-border/50 rounded-bl-sm shadow-[0_1px_2px_0_rgb(0,0,0,0.04)]";

  const spacingClass = isConsecutive ? "mt-0.5 pt-1" : "mt-2";

  const renderContent = () => {
    switch (message.mediaType) {
      case "image":
        return <ImageAttachment messageId={message.id} caption={message.mediaCaption} mimeType={message.mediaMimeType} />;
      case "sticker":
        return <StickerAttachment messageId={message.id} />;
      case "audio":
        return <AudioAttachment messageId={message.id} caption={message.mediaCaption} durationMs={message.attachments[0]?.durationMs} />;
      case "video":
        return <VideoAttachment messageId={message.id} caption={message.mediaCaption} />;
      case "document":
        return <DocumentAttachment messageId={message.id} fileName={message.mediaFilename} mimeType={message.mediaMimeType} sizeBytes={message.attachments[0]?.sizeBytes} caption={message.mediaCaption} />;
      case "location": {
        const loc = message.attachments[0];
        return <LocationAttachment latitude={loc?.latitude} longitude={loc?.longitude} address={loc?.address} legacyText={message.bodyText} />;
      }
      case "contact": {
        const c = message.attachments[0];
        return <ContactAttachment displayName={c?.displayName} phone={c?.phone} email={c?.email} />;
      }
      default:
        return (
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {renderTextWithLinks(message.bodyText)}
          </div>
        );
    }
  };

  return (
    <div className={`flex gap-2 ${isOutbound ? "justify-end" : ""} ${className ?? ""}`}>
      {!isOutbound && !isConsecutive && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-auto">
          <span className="text-[9px] font-semibold text-muted-foreground">
            {contactAvatarInitials || "?"}
          </span>
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${bubbleClasses} ${spacingClass}`}>
        {!isOutbound && showSenderName && message.senderName && (
          <div className="text-[10px] font-medium text-muted-foreground/70 mb-1">
            {message.senderName}
          </div>
        )}
        {renderContent()}
        {message.hasMedia && message.mediaCaption && message.mediaType && (
          <p className="text-[11px] text-muted-foreground/80 mt-1.5">{message.mediaCaption}</p>
        )}
        <MessageMeta
          message={message}
          isOutbound={isOutbound}
          showSenderName={showSenderName}
        />
      </div>
    </div>
  );
}
