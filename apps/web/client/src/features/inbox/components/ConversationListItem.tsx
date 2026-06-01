import { memo, useCallback } from "react";
import { format, formatDistanceToNowStrict, isToday, isThisWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { InboxConversation } from "../types";
import { AvatarFallback } from "@/components/shared/avatar-fallback";
import { ChannelBadge } from "@/components/shared/channel-badge";
import { hasSensitiveContent } from "@/components/shared/sensitive-text";
import { AlertCircle, Bot, Clock3, Lock, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

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
  NEW: "bg-primary",
  OPEN: "bg-emerald-500",
  IN_PROGRESS: "bg-blue-500",
  WAITING_CLIENT: "bg-amber-500",
  REQUIRES_HUMAN: "bg-red-500",
  IA_ATTENDING: "bg-violet-500",
  BLOCKED: "bg-red-500",
  PENDING: "bg-amber-500",
  RESOLVED: "bg-muted-foreground/30",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  WAITING_CLIENT: "Esp. cliente",
  REQUIRES_HUMAN: "Req. humano",
  IA_ATTENDING: "IA activa",
  BLOCKED: "Bloqueado",
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
  SPAM: "Spam",
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

  const contactIdentity =
    conversation.contact?.email ||
    conversation.contact?.phone ||
    conversation.contact?.id ||
    null;

  const msgs = conversation.messages;
  const preview =
    msgs?.[msgs.length - 1]?.body_text ||
    conversation.subject ||
    "Sin mensajes todavía";

  const timestamp = conversation.last_message_at || conversation.updated_at;
  const isPrivate = hasSensitiveContent(preview);
  const status = String(conversation.status ?? "").toUpperCase();
  const statusDot = STATUS_DOT[status] ?? "bg-muted-foreground/30";
  const statusLabel = STATUS_LABELS[status] ?? conversation.status;
  const assigneeName = conversation.assigned_user?.full_name ?? conversation.assigned_user?.name ?? conversation.assigned_user?.email ?? null;
  const isAiActive = status === "IA_ATTENDING" || conversation.metadata_json?.ai_state === "AI_ACTIVE";
  const requiresHuman = status === "REQUIRES_HUMAN" || status === "BLOCKED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left transition-colors md:border-b md:border-border/30 md:last:border-0",
        "rounded-xl border border-border/50 bg-card px-3 py-3 shadow-none md:rounded-none md:border-x-0 md:border-t-0 md:px-4 md:py-3",
        selected ? "border-primary/25 bg-primary/[0.06] md:bg-primary/[0.08]" : "hover:bg-muted/40",
      )}
    >
      {/* ── Active indicator bar ── */}
      {selected && (
        <span
          aria-hidden
          className="absolute bottom-2.5 left-0 top-2.5 hidden w-[3px] rounded-r-full bg-primary md:block"
        />
      )}

      <div className="flex items-start gap-3">
        {/* ── Avatar + status dot ── */}
        <div className="relative shrink-0">
          <AvatarFallback name={contactName} identity={contactIdentity} />
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
              statusDot,
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* ── Name + time ── */}
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn(
              "truncate text-[13px] leading-snug",
              selected ? "font-semibold text-foreground" : "font-medium text-foreground/90",
            )}>
              {contactName}
            </p>
            {timestamp && (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                {formatSmartTimestamp(timestamp)}
              </span>
            )}
          </div>

          {/* ── Preview ── */}
          <div className="mt-1">
            {isPrivate ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                <Lock className="h-2.5 w-2.5 shrink-0" />
                Contenido sensible
              </span>
            ) : (
              <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/60 md:truncate md:text-[11px]">
                {preview}
              </p>
            )}
          </div>

          {/* ── Meta line: channel + status + assignee ── */}
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground/50 md:mt-1">
            <ChannelBadge channel={conversation.channel?.type} />

            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/20" />

            <span className="inline-flex items-center gap-1 truncate">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} />
              {statusLabel}
            </span>

            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/20" />

            {assigneeName ? (
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <UserRound className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate">{assigneeName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground/40">
                <UserRound className="h-3 w-3 shrink-0" />
                Sin asignar
              </span>
            )}

            {/* ── Inline flags (subtle) ── */}
            {requiresHuman && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-red-500/70" title="Requiere humano">
                <AlertCircle className="h-3 w-3" />
              </span>
            )}
            {isAiActive && !requiresHuman && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-violet-500/60" title="IA activa">
                <Bot className="h-3 w-3" />
              </span>
            )}

            {conversation.channel?.type === "WHATSAPP" && conversation.is_service_window_open !== undefined && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5",
                  conversation.is_service_window_open ? "text-emerald-500/60" : "text-red-500/60",
                )}
                title={
                  conversation.is_service_window_open && conversation.service_window_expires_at
                    ? `Ventana cierra en ${formatDistanceToNowStrict(new Date(conversation.service_window_expires_at))}`
                    : "Ventana cerrada — requiere template"
                }
              >
                <Clock3 className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export const ConversationListItem = memo(ConversationListItemImpl);
