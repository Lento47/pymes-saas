import { formatDistanceToNow } from "date-fns";
import type { InboxConversation } from "../types";
import { AvatarFallback } from "@/components/shared/avatar-fallback";
import { ChannelBadge } from "@/components/shared/channel-badge";

export function ConversationListItem({
  conversation,
  selected,
  onClick,
}: {
  conversation: InboxConversation;
  selected: boolean;
  onClick: () => void;
}) {
  const contactName =
    conversation.contact?.full_name ||
    conversation.contact?.name ||
    "Contacto desconocido";

  const preview =
    conversation.messages?.[0]?.body_text ||
    conversation.subject ||
    "Sin mensajes todavía";

  const timestamp = conversation.last_message_at || conversation.updated_at;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-2xl border p-3 text-left transition-all",
        selected
          ? "border-brand-indigo/50 bg-brand-indigo/15 shadow-glow"
          : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.045]",
      ].join(" ")}
    >
      <div className="flex gap-3">
        <AvatarFallback name={contactName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-100">
              {contactName}
            </p>

            {timestamp && (
              <span className="shrink-0 text-[11px] text-slate-500">
                {formatDistanceToNow(new Date(timestamp), { addSuffix: false })}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <ChannelBadge channel={conversation.channel?.type} />
            {!conversation.assigned_user && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Sin asignar
              </span>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {preview}
          </p>
        </div>
      </div>
    </button>
  );
}
