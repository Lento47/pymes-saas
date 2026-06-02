import { useMemo } from "react";
import type { UiMessage } from "@/features/inbox/message-types";
import { getChannelTheme } from "@/features/inbox/channel-theme";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageMeta } from "./MessageMeta";
import { MessageText } from "./MessageText";
import { ReplyQuote } from "./ReplyQuote";
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
  quotedMessage?: Pick<UiMessage, "bodyText" | "senderName" | "direction"> | null;
  className?: string;
}

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

const EMOJI_ONLY_RE = /^[\s​]*(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,5}[\s​]*$/u;

function isEmojiOnly(text: string): boolean {
  return !!text?.trim() && EMOJI_ONLY_RE.test(text);
}

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export const MessageBubble = function MessageBubble({
  message,
  isConsecutive,
  showSenderName,
  isNew = false,
  contactName,
  contactAvatarInitials,
  contactAvatarUrl,
  quotedMessage,
  className,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";
  const isShort = (message.bodyText?.length ?? 0) < 100;
  const variant = getBubbleVariant(message);
  const theme = getChannelTheme(message.provider);

  const isLargeEmoji =
    variant === "text" &&
    !message.bodyHtml &&
    !message.hasMedia &&
    !message.isReaction &&
    isEmojiOnly(message.bodyText ?? "");

  const timeString = useMemo(
    () => message.sentAt ? new Date(message.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }) : "",
    [message.sentAt],
  );

  const senderLabel = isOutbound ? "Tú" : (contactName || "Contacto");

  const surface = isOutbound ? theme.outboundCls : theme.inboundCls;
  const radius = isConsecutive
    ? "rounded-2xl"
    : isOutbound
      ? "rounded-2xl rounded-br-md"
      : "rounded-2xl rounded-bl-md";

  const textCls   = isOutbound ? theme.outboundTextCls   : theme.inboundTextCls;
  const linkCls   = isOutbound ? theme.outboundLinkCls   : theme.inboundLinkCls;
  const codeCls   = isOutbound ? theme.outboundCodeCls   : theme.inboundCodeCls;
  const preCls    = isOutbound ? theme.outboundPreCls    : theme.inboundPreCls;
  const metaCls   = isOutbound ? theme.outboundMetaCls   : theme.inboundMetaCls;

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
            isOutbound={isOutbound}
          />
        );
      }
      default:
        if (isLargeEmoji) {
          return (
            <div className={`text-4xl sm:text-5xl leading-none py-1 select-none ${textCls}`}>
              {message.bodyText}
            </div>
          );
        }
        return (
          <MessageText
            text={message.bodyText}
            bodyHtml={message.bodyHtml}
            provider={message.provider}
            isOutbound={isOutbound}
            isShort={isShort}
            textCls={textCls}
            linkCls={linkCls}
            codeCls={codeCls}
            preCls={preCls}
          />
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

  const metaProps = {
    message,
    isOutbound,
    showSenderName,
    metaCls,
    statusVariant: theme.statusVariant,
  } as const;

  // ── System messages: pill-style ──
  if (variant === "system") {
    return (
      <div className={`flex justify-center ${isConsecutive ? "mt-0.5" : "mt-3"} ${entryClass} ${className ?? ""}`}>
        <div className="max-w-[88%] rounded-full border border-border/30 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          {message.bodyText}
          {timeString && <span className="ml-1.5 text-[10px] opacity-60">{timeString}</span>}
        </div>
      </div>
    );
  }

  // ── Large emoji: no card wrapper ──
  if (isLargeEmoji) {
    return (
      <div
        className={`flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`}
        role="article"
        aria-label={`${senderLabel} · ${timeString}`}
      >
        {!isOutbound && !isConsecutive && (
          <Avatar className="mt-auto h-6 w-6 sm:h-7 sm:w-7">
            {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] sm:text-[10px]">
              {contactAvatarInitials || getInitials(contactName || "")}
            </AvatarFallback>
          </Avatar>
        )}
        {!isOutbound && isConsecutive && <div className="w-6 shrink-0 sm:w-7" aria-hidden="true" />}
        <div className={`max-w-[84%] sm:max-w-[68%] ${isConsecutive ? "mt-0.5" : "mt-3"}`}>
          {renderContent()}
        </div>
      </div>
    );
  }

  // ── Sticker: no card wrapper ──
  if (variant === "sticker") {
    return (
      <div
        className={`flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`}
        role="article"
        aria-label={`${senderLabel} · ${timeString}`}
      >
        {!isOutbound && !isConsecutive && (
          <Avatar className="mt-auto h-6 w-6 sm:h-7 sm:w-7">
            {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] sm:text-[10px]">
              {contactAvatarInitials || getInitials(contactName || "")}
            </AvatarFallback>
          </Avatar>
        )}
        {!isOutbound && isConsecutive && <div className="w-6 shrink-0 sm:w-7" aria-hidden="true" />}
        <div className={`max-w-[160px] sm:max-w-[180px] ${isConsecutive ? "mt-0.5" : "mt-3"}`}>
          {renderContent()}
        </div>
      </div>
    );
  }

  // ── Document, Location, Contact, Interactive: transparent card ──
  if (variant === "document" || variant === "location" || variant === "contact" || variant === "interactive") {
    return (
      <div
        className={`flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`}
        role="article"
        aria-label={`${senderLabel} · ${timeString}`}
      >
        {!isOutbound && !isConsecutive && (
          <Avatar className="mt-auto h-6 w-6 sm:h-7 sm:w-7">
            {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt="" />}
            <AvatarFallback className="text-[9px] sm:text-[10px]">
              {contactAvatarInitials || getInitials(contactName || "")}
            </AvatarFallback>
          </Avatar>
        )}
        {!isOutbound && isConsecutive && <div className="w-6 shrink-0 sm:w-7" aria-hidden="true" />}
        <div className={`max-w-[86%] sm:max-w-[360px] ${isConsecutive ? "mt-0.5" : "mt-3"}`}>
          {renderContent()}
          <MessageMeta {...metaProps} compact />
        </div>
      </div>
    );
  }

  // ── Text, Audio, Media: Card-based bubble ──
  const cardSpacing = isConsecutive ? "mt-0.5" : "mt-3";
  const maxWidth = variant === "media"
    ? "max-w-[84%] sm:max-w-[360px]"
    : variant === "audio"
      ? "max-w-[86%] sm:max-w-[340px]"
      : "max-w-[84%] sm:max-w-[68%]";

  return (
    <div
      className={`flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`}
      role="article"
      aria-label={`${senderLabel} · ${timeString}`}
    >
      {/* Inbound avatar */}
      {!isOutbound && !isConsecutive && (
        <Avatar className="mt-auto h-6 w-6 sm:h-7 sm:w-7">
          {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt="" />}
          <AvatarFallback className="text-[9px] sm:text-[10px]">
            {contactAvatarInitials || getInitials(contactName || "")}
          </AvatarFallback>
        </Avatar>
      )}
      {!isOutbound && isConsecutive && <div className="w-6 shrink-0 sm:w-7" aria-hidden="true" />}

      <Card
        className={`
          ${maxWidth} ${cardSpacing} ${surface} ${radius}
          border-0 shadow-sm
          ${variant === "media" ? "overflow-hidden p-1" : ""}
          ${variant === "audio" ? "px-2.5 py-2" : ""}
          ${variant === "text" ? (isShort ? "px-3.5 py-2" : "px-4 py-2.5") : ""}
        `}
      >
        {/* Reply quote */}
        {quotedMessage && (
          <ReplyQuote
            quotedMessage={quotedMessage}
            isOutbound={isOutbound}
            quoteCls={isOutbound ? theme.outboundQuoteCls : theme.inboundQuoteCls}
            senderCls={isOutbound ? theme.outboundQuoteSenderCls : theme.inboundQuoteSenderCls}
            textCls={isOutbound ? theme.outboundQuoteTextCls : theme.inboundQuoteTextCls}
          />
        )}

        <CardContent className="p-0">
          {renderContent()}
        </CardContent>

        <CardFooter className="p-0 mt-0.5">
          <MessageMeta
            {...metaProps}
            compact={variant === "media"}
            overlay={variant === "media"}
          />
        </CardFooter>
      </Card>
    </div>
  );
};
