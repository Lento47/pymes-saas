import { useMemo, useRef, useCallback } from "react";
import type { UiMessage } from "@/features/inbox/message-types";
import { getChannelTheme } from "@/features/inbox/channel-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Reply } from "lucide-react";
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
  quotedMessage?: Pick<UiMessage, "bodyText" | "senderName" | "direction" | "mediaType" | "mediaCaption" | "mediaFilename"> | null;
  onReply?: (message: UiMessage) => void;
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

function bubbleRadius(isOutbound: boolean, isConsecutive: boolean) {
  const base = "rounded-2xl";
  if (isConsecutive) return base;
  // Asymmetric bottom corner suggests direction (WhatsApp-style)
  return isOutbound ? `${base} rounded-br-md` : `${base} rounded-bl-md`;
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
  onReply,
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

  // Tail only for text and audio (media has overflow-hidden which would clip it).
  // System/internal messages are rendered as pills — no tail.
  // Uses CSS-only approach (border-radius asymmetry) — no SVG that gets clipped.
  const showTail =
    !isConsecutive &&
    !isLargeEmoji &&
    message.direction !== "INTERNAL" &&
    (variant === "text" || variant === "audio");

  const timeString = useMemo(
    () => message.sentAt ? new Date(message.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }) : "",
    [message.sentAt],
  );

  const senderLabel = isOutbound ? "Tú" : (contactName || "Contacto");

  const surface = isOutbound ? theme.outboundCls : theme.inboundCls;

  const bubbleClasses = useMemo(() => {
    const spacing = isConsecutive ? "mt-0.5" : "mt-3";
    const radius = bubbleRadius(isOutbound, isConsecutive);

    switch (variant) {
      case "sticker":
        return `max-w-[160px] sm:max-w-[180px] ${spacing} border-0 bg-transparent px-0 py-0 shadow-none`;
      case "media":
        return `relative max-w-[84%] sm:max-w-[360px] ${spacing} ${surface} ${radius} overflow-hidden p-1`;
      case "audio":
        return `max-w-[86%] sm:max-w-[340px] ${spacing} ${surface} ${radius} px-2.5 py-2`;
      case "document":
      case "location":
      case "contact":
      case "interactive":
        return `max-w-[86%] sm:max-w-[360px] ${spacing} border-0 bg-transparent p-0 shadow-none`;
      case "system":
        return `max-w-[88%] ${spacing} rounded-full border border-border/30 bg-muted/30 px-3 py-1.5`;
      case "text":
      default:
        if (isLargeEmoji) {
          return `max-w-[84%] sm:max-w-[68%] ${spacing} bg-transparent border-0 shadow-none px-1 py-0.5`;
        }
        return `max-w-[84%] sm:max-w-[68%] ${spacing} ${surface} ${radius} ${isShort ? "px-3.5 py-2" : "px-4 py-2.5"}`;
    }
  }, [variant, isConsecutive, isOutbound, isShort, isLargeEmoji, surface]);

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

  // ── Reply gesture: swipe right (touch) + double-click (desktop) ─────────
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeOffsetRef = useRef(0);
  const bubbleWrapRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onReply || message.direction === "INTERNAL") return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, [onReply, message.direction]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    // Only horizontal swipe (dx > 0 = right, dy < 45°)
    if (dx > 10 && dx > dy && dx < 120) {
      swipeOffsetRef.current = dx;
      if (bubbleWrapRef.current) {
        bubbleWrapRef.current.style.transform = `translateX(${Math.min(dx * 0.4, 40)}px)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !onReply) {
      touchStartRef.current = null;
      return;
    }
    const elapsed = Date.now() - touchStartRef.current.time;
    if (swipeOffsetRef.current > 50 && elapsed < 500) {
      onReply(message);
    }
    // Reset position
    swipeOffsetRef.current = 0;
    touchStartRef.current = null;
    if (bubbleWrapRef.current) {
      bubbleWrapRef.current.style.transform = "";
      bubbleWrapRef.current.style.transition = "transform 0.2s ease-out";
      setTimeout(() => {
        if (bubbleWrapRef.current) bubbleWrapRef.current.style.transition = "";
      }, 200);
    }
  }, [onReply, message]);

  const handleDoubleClick = useCallback(() => {
    if (onReply && message.direction !== "INTERNAL") {
      onReply(message);
    }
  }, [onReply, message]);

  return (
    <div
      ref={bubbleWrapRef}
      className={`flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 ${isOutbound ? "justify-end" : ""} ${entryClass} ${className ?? ""}`}
      role="article"
      aria-label={`${senderLabel} · ${timeString}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      {/* Inbound avatar */}
      {!isOutbound && !isConsecutive && (
        <Avatar className="mt-auto h-6 w-6 sm:h-7 sm:w-7" aria-label={`Avatar de ${senderLabel}`}>
          {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt="" />}
          <AvatarFallback className="text-[9px] font-semibold sm:text-[10px]">
            {contactAvatarInitials || getInitials(contactName || "")}
          </AvatarFallback>
        </Avatar>
      )}
      {!isOutbound && isConsecutive && (
        <div className="w-6 shrink-0 sm:w-7" aria-hidden="true" />
      )}

      {/* Bubble — Card base with defaults reset so channel theme classes take precedence */}
      <div className="group/bubble relative">
        <Card className={`border-0 bg-transparent shadow-none ${bubbleClasses}`}>
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
              compact={variant === "sticker" || variant === "document" || variant === "location" || variant === "contact" || variant === "interactive"}
            overlay={variant === "media"}
            isLargeEmoji={isLargeEmoji}
          />
          </CardFooter>
        </Card>

        {/* Desktop reply button — visible on hover, positioned on the outer edge */}
        {onReply && message.direction !== "INTERNAL" && (
          <button
            type="button"
            onClick={() => onReply(message)}
            className={`absolute top-1/2 -translate-y-1/2 hidden sm:flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background/90 text-muted-foreground shadow-sm opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 hover:bg-muted hover:text-foreground z-10 ${isOutbound ? "-left-9" : "-right-9"}`}
            aria-label="Responder"
            title="Responder"
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
