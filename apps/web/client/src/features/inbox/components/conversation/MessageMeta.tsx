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
  if (overlay) {
    return (
      <div className="absolute bottom-1.5 right-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] text-white/90 backdrop-blur-sm flex items-center justify-end gap-1">
        <span>{formatMessageTime(message.sentAt)}</span>
        <MessageStatus
          direction={message.direction}
          deliveryStatus={message.deliveryStatus}
          deliveryError={message.deliveryError}
        />
      </div>
    );
  }

  // ── Outbound: white text on indigo bg ──
  if (isOutbound) {
    const cls = compact
      ? "text-[9px] text-white/50 mt-0.5 text-right justify-end flex items-center gap-1"
      : "text-[10px] text-white/50 mt-1.5 text-right justify-end flex items-center gap-1";
    return (
      <div className={cls}>
        <span>{formatMessageTime(message.sentAt)}</span>
        <MessageStatus
          direction={message.direction}
          deliveryStatus={message.deliveryStatus}
          deliveryError={message.deliveryError}
        />
      </div>
    );
  }

  // ── Inbound: muted text on white bg ──
  const cls = compact
    ? "text-[9px] text-muted-foreground/40 mt-0.5 text-left flex items-center gap-1"
    : "text-[10px] text-muted-foreground/45 mt-1.5 text-left flex items-center gap-1";

  return (
    <div className={cls}>
      {showSenderName && message.senderName && (
        <span className="font-medium text-muted-foreground/60">{message.senderName}</span>
      )}
      <span>{formatMessageTime(message.sentAt)}</span>
    </div>
  );
}
