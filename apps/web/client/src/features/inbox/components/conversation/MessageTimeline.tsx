import { isSameDay } from "date-fns";
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
  if (isLoading) {
    return <EmptyConversationState isLoading />;
  }

  if (messages.length === 0) {
    return <EmptyConversationState isLoading={false} contactName={contactName} />;
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={scrollRef}
        className="overflow-y-auto px-4 py-3 min-h-0 bg-muted/[0.15]"
        onScroll={onScroll}
      >
        {messages.map((msg, idx) => {
          const prev = idx > 0 ? messages[idx - 1] : null;
          const showDateSeparator = !prev || !msg.sentAt || !prev.sentAt || !isSameDay(msg.sentAt, prev.sentAt);
          const isConsecutive = isConsecutiveMessage(msg, prev);
          const showSenderName = !isConsecutive && msg.direction === "INBOUND" && (!prev || prev.direction !== "INBOUND");

          return (
            <div key={msg.id}>
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
        <div ref={bottomRef} />
      </div>

      {!nearBottom && messages.length > 0 && (
        <div className="sticky bottom-2 flex justify-center z-10">
          <button
            onClick={onScrollToBottom}
            className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium shadow-lg hover:bg-primary/90 transition-colors"
          >
            ↓ Nuevos mensajes
          </button>
        </div>
      )}
    </div>
  );
}
