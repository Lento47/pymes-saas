import { memo, useCallback } from "react";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import type { InboxConversation } from "../types";
import { AvatarFallback } from "@/components/shared/avatar-fallback";
import { ChannelBadge } from "@/components/shared/channel-badge";

function ConversationListItemImpl({
  conversation,
  selected,
  onSelect,
}: {
  conversation: InboxConversation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const onClick = useCallback(() => onSelect(conversation.id), [onSelect, conversation.id]);
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
        "relative w-full px-4 py-3 text-left transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted/40",
      ].join(" ")}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r-full bg-primary"
        />
      )}

      <div className="flex gap-3 items-start">
        <div className="shrink-0">
          <AvatarFallback name={contactName} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {contactName}
            </p>
            {timestamp && (
              <span className="shrink-0 text-[11px] text-muted-foreground/70">
                {formatDistanceToNow(new Date(timestamp), { addSuffix: false })}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ChannelBadge channel={conversation.channel?.type} />
            {!conversation.assigned_user && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400/80">
                Sin asignar
              </span>
            )}
            {/* WhatsApp 24h service window indicator */}
            {conversation.channel?.type === "WHATSAPP" && conversation.is_service_window_open !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
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

          <p className="mt-1.5 truncate text-xs leading-relaxed text-muted-foreground">
            {preview}
          </p>
        </div>
      </div>
    </button>
  );
}

export const ConversationListItem = memo(ConversationListItemImpl);
