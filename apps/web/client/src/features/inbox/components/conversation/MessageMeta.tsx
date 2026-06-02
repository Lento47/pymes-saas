import type { UiMessage } from "@/features/inbox/message-types";
import { formatMessageTime } from "@/features/inbox/media-utils";
import { MessageStatus } from "./MessageStatus";
import { Send, MessageCircle } from "lucide-react";

interface MessageMetaProps {
  message: UiMessage;
  isOutbound: boolean;
  showSenderName: boolean;
  compact?: boolean;
  overlay?: boolean;
  isLargeEmoji?: boolean;
  /** Timestamp text color class (from channel theme) */
  metaCls: string;
  /** Icon variant for status ticks (from channel theme) */
  statusVariant: "light" | "dark";
}

export function MessageMeta({
  message,
  isOutbound,
  showSenderName,
  compact,
  overlay,
  isLargeEmoji,
  metaCls,
  statusVariant,
}: MessageMetaProps) {
  if (overlay) {
    return (
      <div className="absolute bottom-1.5 right-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] text-white/90 backdrop-blur-sm flex items-center justify-end gap-1">
        <span>{formatMessageTime(message.sentAt)}</span>
        <MessageStatus
          direction={message.direction}
          deliveryStatus={message.deliveryStatus}
          deliveryError={message.deliveryError}
          variant="light"
        />
      </div>
    );
  }

  const timeColor = isLargeEmoji ? "text-muted-foreground/60" : metaCls;
  const sizeCls = compact ? "text-[9px] mt-0.5" : "text-[10px] mt-1.5";

  if (isOutbound) {
    return (
      <div className={`${sizeCls} ${timeColor} text-right justify-end flex items-center gap-1`}>
        <span>{formatMessageTime(message.sentAt)}</span>
        <MessageStatus
          direction={message.direction}
          deliveryStatus={message.deliveryStatus}
          deliveryError={message.deliveryError}
          variant={statusVariant}
        />
      </div>
    );
  }

  const isTelegram = message.provider === "TELEGRAM";
  const isWhatsApp = message.provider === "WHATSAPP";

  return (
    <div className={`${sizeCls} ${timeColor} text-left flex items-center gap-1`}>
      {showSenderName && message.senderName && (
        <span className="font-medium opacity-75">{message.senderName}</span>
      )}
      <span>{formatMessageTime(message.sentAt)}</span>
      {isTelegram && <Send className="h-3 w-3 text-sky-400/70" />}
      {isWhatsApp && <MessageCircle className="h-3 w-3 opacity-40" />}
    </div>
  );
}
