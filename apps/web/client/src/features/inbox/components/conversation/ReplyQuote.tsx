import type { UiMessage } from "@/features/inbox/message-types";

interface ReplyQuoteProps {
  quotedMessage: Pick<UiMessage, "bodyText" | "senderName" | "direction">;
  isOutbound: boolean;
}

export function ReplyQuote({ quotedMessage, isOutbound }: ReplyQuoteProps) {
  const sender = quotedMessage.direction === "OUTBOUND" ? "Tú" : (quotedMessage.senderName || "Contacto");
  const preview = quotedMessage.bodyText?.trim() || "[Multimedia]";

  return (
    <div
      className={`mb-1.5 flex flex-col rounded-md px-2.5 py-1.5 ${
        isOutbound
          ? "border-l-2 border-white/40 bg-white/10"
          : "border-l-2 border-primary/50 bg-primary/[0.06]"
      }`}
    >
      <span
        className={`text-[10px] font-semibold leading-tight ${
          isOutbound ? "text-white/70" : "text-primary/80"
        }`}
      >
        {sender}
      </span>
      <span
        className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${
          isOutbound ? "text-white/60" : "text-foreground/60"
        }`}
      >
        {preview}
      </span>
    </div>
  );
}
