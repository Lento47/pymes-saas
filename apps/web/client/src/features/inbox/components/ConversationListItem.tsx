import { memo, useCallback } from "react";
import { format, formatDistanceToNowStrict, isToday, isThisWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { InboxConversation } from "../types";
import { AvatarFallback } from "@/components/shared/avatar-fallback";
import { ChannelBadge } from "@/components/shared/channel-badge";
import { hasSensitiveContent } from "@/components/shared/sensitive-text";
import { Lock } from "lucide-react";

function formatSmartTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a", { locale: es });
  }
  if (isThisWeek(date, { weekStartsOn: 1 })) {
    return format(date, "EEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase()).slice(0, 3);
  }
  return format(date, "d MMM", { locale: es });
}

const STATUS_DOT: Record<string, string> = {
  OPEN: "bg-emerald-400",
  PENDING: "bg-amber-400",
  RESOLVED: "bg-muted-foreground/40",
};

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

  // Privacy-safe identity for avatar hashing (never use raw name)
  const contactIdentity =
    conversation.contact?.email ||
    conversation.contact?.phone ||
    conversation.contact?.id ||
    null;

  const msgs = conversation.messages;
  const preview =
    (msgs?.[msgs.length - 1]?.body_text) ||
    conversation.subject ||
    "Sin mensajes todavía";

  const timestamp = conversation.last_message_at || conversation.updated_at;
  const isPrivate = hasSensitiveContent(preview);
  const statusDot = STATUS_DOT[conversation.status] ?? "bg-muted-foreground/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative w-full px-4 py-3.5 text-left transition-colors border-b border-border/40 last:border-0",
        selected ? "bg-primary/[0.06]" : "hover:bg-muted/30",
      ].join(" ")}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-primary shadow-sm"
        />
      )}

      <div className="flex gap-3 items-start">
        {/* Avatar with status dot */}
        <div className="relative shrink-0">
          <AvatarFallback name={contactName} identity={contactIdentity} />
          <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${statusDot}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Row 1: Name + timestamp */}
          <div className="flex items-baseline justify-between gap-2">
            <p className={`truncate text-[13px] leading-snug ${selected ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
              {contactName}
            </p>
            {timestamp && (
              <span className="shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                {formatSmartTimestamp(timestamp)}
              </span>
            )}
          </div>

          {/* Row 2: Badges */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <ChannelBadge channel={conversation.channel?.type} />
            {!conversation.assigned_user && (
              <span className="rounded-full bg-amber-500/[0.06] px-1.5 py-px text-[10px] font-medium text-amber-400/60">
                Sin asignar
              </span>
            )}
            {conversation.channel?.type === "WHATSAPP" &&
              conversation.is_service_window_open !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                    conversation.is_service_window_open
                      ? "bg-emerald-500/8 text-emerald-400/80"
                      : "bg-red-500/8 text-red-400/80"
                  }`}
                  title={
                    conversation.is_service_window_open &&
                    conversation.service_window_expires_at
                      ? `Ventana cierra en ${formatDistanceToNowStrict(new Date(conversation.service_window_expires_at))}`
                      : "Ventana de 24h cerrada — requiere template"
                  }
                >
                  {conversation.is_service_window_open ? "Ventana abierta" : "Template requerido"}
                </span>
              )}
          </div>

          {/* Row 3: Preview */}
          <div className="mt-1">
            {isPrivate ? (
              <span className="flex items-center gap-1 text-[11px] text-amber-400/60">
                <Lock className="w-2.5 h-2.5 shrink-0" />
                Contiene datos sensibles
              </span>
            ) : (
              <p className="truncate text-[11px] leading-relaxed text-muted-foreground/70">
                {preview}
              </p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export const ConversationListItem = memo(ConversationListItemImpl);
