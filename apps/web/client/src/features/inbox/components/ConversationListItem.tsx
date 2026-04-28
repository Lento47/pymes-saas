import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
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
          ? "border-primary/50 bg-primary/15 "
          : "border-transparent bg-foreground/[0.015] hover:border-border hover:bg-foreground/[0.045]",
      ].join(" ")}
    >
      <div className="flex gap-3">
        <AvatarFallback name={contactName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {contactName}
            </p>

            {timestamp && (
              <span className="shrink-0 text-[11px] text-muted-foreground/70">
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
            {/* WhatsApp 24h service window indicator */}
            {conversation.channel?.type === "WHATSAPP" && conversation.is_service_window_open !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  conversation.is_service_window_open
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-red-500/10 text-red-300"
                }`}
                title={
                  conversation.is_service_window_open && conversation.service_window_expires_at
                    ? `Ventana cierra en ${formatDistanceToNowStrict(new Date(conversation.service_window_expires_at))}`
                    : "Ventana de 24h cerrada — requiere template"
                }
              >
                {conversation.is_service_window_open ? "Ventana abierta" : "Template requerido"}
              </span>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {preview}
          </p>
        </div>
      </div>
    </button>
  );
}
