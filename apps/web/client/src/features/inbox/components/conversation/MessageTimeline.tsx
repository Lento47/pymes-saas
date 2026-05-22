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
  if (!msg?.mediaType) return 60;
  switch (msg.mediaType) {
    case "sticker": return 120;
    case "image":
    case "video": return 280;
    case "audio": return 80;
    case "document":
    case "location":
    case "contact": return 100;
    default: return 60;
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

  if (isLoading) {
    return (
      <div className={`relative flex-1 min-h-0 overflow-hidden bg-muted/[0.12] ${className ?? ""}`}>
        <EmptyConversationState isLoading />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`relative flex-1 min-h-0 overflow-hidden bg-muted/[0.12] ${className ?? ""}`}>
        <EmptyConversationState isLoading={false} contactName={contactName} />
      </div>
    );
  }

  return (
    <div className={`relative flex-1 min-h-0 overflow-hidden bg-muted/[0.12] ${className ?? ""}`}>
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-3 py-4 sm:px-4 sm:py-5"
        onScroll={onScroll}
        style={{ scrollbarWidth: "thin" }}
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
                />
              </div>
            );
          })}
        </div>
        {/* Typing indicator */}
        {isUserTyping && (
          <div className="flex items-center gap-1.5 px-3 py-2 ml-10">
            <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/40 rounded-bl-md">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-[11px] text-muted-foreground/70">escribiendo...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!nearBottom && messages.length > 0 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <button
            onClick={onScrollToBottom}
            aria-label="Ir al final de la conversación"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur transition-all duration-200 hover:border-primary/30 hover:text-primary active:scale-95"
          >
            <ArrowDown className="w-3 h-3" /> Nuevos mensajes
          </button>
        </div>
      )}
    </div>
  );
}
