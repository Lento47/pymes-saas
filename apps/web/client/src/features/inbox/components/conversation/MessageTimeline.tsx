import { useEffect } from "react";
import { ArrowDown } from "lucide-react";
import { isSameDay } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UiMessage } from "@/features/inbox/message-types";
import { isConsecutiveMessage } from "@/features/inbox/message-adapters";
import { DateSeparator } from "./DateSeparator";
import { EmptyConversationState } from "./EmptyConversationState";
import { MessageBubble } from "./MessageBubble";

interface MessageTimelineProps {
  messages: UiMessage[];
  isLoading: boolean;
  contactName?: string;
  contactAvatarInitials?: string;
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
  contactName,
  contactAvatarInitials,
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
    estimateSize: () => 60,
    overscan: 5,
  });

  const scrollToBottomViaVirtualizer = () => {
    virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
  };

  // Auto-scroll to bottom on initial load and when new messages arrive
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    const timer = setTimeout(() => {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "instant" });
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoading, messages.length]);

  if (isLoading) {
    return <EmptyConversationState isLoading />;
  }

  if (messages.length === 0) {
    return <EmptyConversationState isLoading={false} contactName={contactName} />;
  }

  return (
    <div className={`relative flex-1 min-h-0 overflow-hidden bg-muted/[0.12] ${className ?? ""}`}>
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-4 py-4"
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
                  contactName={contactName}
                  contactAvatarInitials={contactAvatarInitials}
                />
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {!nearBottom && messages.length > 0 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <button
            onClick={() => {
              scrollToBottomViaVirtualizer();
              onScrollToBottom();
            }}
            aria-label="Ir al final de la conversación"
            className="pointer-events-auto px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowDown className="w-3 h-3 inline mr-1" /> Nuevos mensajes
          </button>
        </div>
      )}
    </div>
  );
}
