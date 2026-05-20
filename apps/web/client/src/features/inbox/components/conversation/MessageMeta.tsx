import type { UiMessage } from "@/features/inbox/message-types";
import { formatMessageTime } from "@/features/inbox/media-utils";
import { MessageStatus } from "./MessageStatus";

interface MessageMetaProps {
  message: UiMessage;
  isOutbound: boolean;
  showSenderName: boolean;
}

export function MessageMeta({ message, isOutbound, showSenderName }: MessageMetaProps) {
  if (isOutbound) {
    return (
      <div className="text-[10px] text-muted-foreground/50 mt-1.5 text-right flex items-center justify-end gap-1">
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
    <div className="text-[10px] text-muted-foreground/50 mt-1.5 text-left flex items-center gap-1">
      {showSenderName && message.senderName && (
        <span className="font-medium text-muted-foreground/70">{message.senderName}</span>
      )}
      <span>{formatMessageTime(message.sentAt)}</span>
    </div>
  );
}
