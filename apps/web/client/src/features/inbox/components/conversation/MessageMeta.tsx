import type { UiMessage } from "@/features/inbox/message-types";
import { formatMessageTime } from "@/features/inbox/media-utils";
import { MessageStatus } from "./MessageStatus";

interface MessageMetaProps {
  message: UiMessage;
  isOutbound: boolean;
  showSenderName: boolean;
  compact?: boolean;
  overlay?: boolean;
}

export function MessageMeta({ message, isOutbound, showSenderName, compact, overlay }: MessageMetaProps) {
  const className = overlay
    ? "absolute bottom-1.5 right-2 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] text-white/85 backdrop-blur-sm flex items-center justify-end gap-1"
    : compact
      ? `text-[9px] text-muted-foreground/45 mt-0.5 ${isOutbound ? "text-right justify-end" : "text-left"} flex items-center gap-1`
      : `text-[10px] text-muted-foreground/50 mt-1.5 ${isOutbound ? "text-right justify-end" : "text-left"} flex items-center gap-1`;

  if (isOutbound) {
    return (
      <div className={className}>
        <span>{formatMessageTime(message.sentAt)}</span>
        <MessageStatus
          direction={message.direction}
          deliveryStatus={message.deliveryStatus}
          deliveryError={message.deliveryError}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {showSenderName && message.senderName && (
        <span className="font-medium text-muted-foreground/70">{message.senderName}</span>
      )}
      <span>{formatMessageTime(message.sentAt)}</span>
    </div>
  );
}
