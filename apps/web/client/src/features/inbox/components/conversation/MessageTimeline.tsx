import { useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { isSameDay } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UiMessage } from "@/features/inbox/message-types";
import { isConsecutiveMessage } from "@/features/inbox/message-adapters";
import { DateSeparator } from "./DateSeparator";
import { EmptyConversationState } from "./EmptyConversationState";
import { MessageBubble } from "./MessageBubble";

function estimateSizeForIndex(idx: number, messages: UiMessage[]): number {
  const msg = messages[idx];
  if (!msg?.mediaType) return 58;
  switch (msg.mediaType) {
    case "sticker": return 112;
    case "image":
    case "video": return 240;
    case "audio": return 76;
    case "document":
    case "location":
    case "contact": return 96;
    default: return 58;
  }
}

interface MessageTimelineProps {
  messages: UiMessage[];
  isLoading: boolean;
  isUserTyping?: boolean;
  animatingMsgId?: string | null;
  contactName?: string;
  contactAvatarInitials?: string;
  contactAvatarUrl?: string | null;
  scrollRef: React.RefObject<HTMLDivElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  nearBottom: boolean;
  onScrollToBottom: () => void;
  onScroll?: () => void;
  className?: string;
}

export function MessageTimeline({
  messages,
  isLoading,
  isUserTyping = false,
  animatingMsgId = null,
  contactName,
  contactAvatarInitials,
  contactAvatarUrl,
  scrollRef,
  bottomRef,
  nearBottom,
  onScrollToBottom,
  onScroll,
  className,
}: MessageTimelineProps) {
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (idx) => estimateSizeForIndex(idx, messages),
    overscan: 5,
  });

  const chatBgStyle: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px)`,
    backgroundSize: `20px 20px`,
  };

  if (isLoading) {
    return (
      <div className={`relative min-h-0 flex-1 overflow-hidden bg-muted/[0.12] ${className ?? ""}`} style={chatBgStyle}>
        <EmptyConversationState isLoading />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`relative min-h-0 flex-1 overflow-hidden bg-muted/[0.12] ${className ?? ""}`} style={chatBgStyle}>
        <EmptyConversationState isLoading={false} contactName={contactName} />
      </div>
    );
  }

  return (
    <div className={`relative min-h-0 flex-1 overflow-hidden bg-muted/[0.12] ${className ?? ""}`} style={chatBgStyle}>
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-contain px-2.5 py-3 sm:px-4 sm:py-5"
        onScroll={onScroll}
        style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const idx = virtualItem.index;
            const msg = messages[idx];
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDateSeparator = !prev || !msg.sentAt || !prev.sentAt || !isSameDay(msg.sentAt, prev.sentAt);
            const isConsecutive = isConsecutiveMessage(msg, prev);
            const showSenderName = !isConsecutive && msg.direction === "INBOUND";
            const isNew = msg.id === animatingMsgId;
            const quotedRaw = msg.replyToMessageId
              ? messages.find(m => m.id === msg.replyToMessageId)
              : null;
            const quotedMessage = quotedRaw
              ? { bodyText: quotedRaw.bodyText, senderName: quotedRaw.senderName ?? null, direction: quotedRaw.direction }
              : undefined;

            return (
              <div
                key={msg.id}
                data-index={idx}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {showDateSeparator && msg.sentAt && <DateSeparator date={msg.sentAt} />}
                <MessageBubble
                  message={msg}
                  isConsecutive={isConsecutive}
                  showSenderName={showSenderName}
                  isNew={isNew}
                  contactName={contactName}
                  contactAvatarInitials={contactAvatarInitials}
                  contactAvatarUrl={contactAvatarUrl}
                  quotedMessage={quotedMessage}
                />
              </div>
            );
          })}
        </div>
        {isUserTyping && (
          <div className="ml-8 flex items-center gap-1.5 px-2 py-2 sm:ml-10 sm:px-3">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-muted/40 px-3 py-2">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
              </span>
              <span className="text-[11px] text-muted-foreground/70">escribiendo...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!nearBottom && messages.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-10 flex justify-center sm:bottom-4">
          <button
            onClick={onScrollToBottom}
            aria-label="Ir al final de la conversación"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur transition-all duration-200 hover:border-primary/30 hover:text-primary active:scale-95"
          >
            <ArrowDown className="h-3 w-3" /> Nuevos mensajes
          </button>
        </div>
      )}
    </div>
  );
}
