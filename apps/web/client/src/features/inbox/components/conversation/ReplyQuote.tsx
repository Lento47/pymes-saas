import type { UiMessage } from "@/features/inbox/message-types";

interface ReplyQuoteProps {
  quotedMessage: Pick<UiMessage, "bodyText" | "senderName" | "direction">;
  isOutbound: boolean;
  quoteCls: string;
  senderCls: string;
  textCls: string;
}

export function ReplyQuote({ quotedMessage, isOutbound, quoteCls, senderCls, textCls }: ReplyQuoteProps) {
  const sender = quotedMessage.direction === "OUTBOUND" ? "Tú" : (quotedMessage.senderName || "Contacto");
  const preview = quotedMessage.bodyText?.trim() || "[Multimedia]";

  return (
    <div className={`mb-1.5 flex flex-col rounded-md px-2.5 py-1.5 ${quoteCls}`}>
      <span className={`text-[10px] font-semibold leading-tight ${senderCls}`}>{sender}</span>
      <span className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${textCls}`}>{preview}</span>
    </div>
  );
}
