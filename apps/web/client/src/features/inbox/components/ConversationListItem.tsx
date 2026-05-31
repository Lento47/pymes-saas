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
  OPEN: "bg-emerald-400",
  IN_PROGRESS: "bg-blue-400",
  WAITING_CLIENT: "bg-amber-400",
  REQUIRES_HUMAN: "bg-red-500",
  IA_ATTENDING: "bg-violet-500",
  BLOCKED: "bg-red-500",
  PENDING: "bg-amber-400",
  RESOLVED: "bg-muted-foreground/40",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_CLIENT: "Waiting client",
  REQUIRES_HUMAN: "Needs human",
  IA_ATTENDING: "AI active",
  BLOCKED: "Blocked",
  PENDING: "Pending",
  RESOLVED: "Resolved",
  SPAM: "Spam",
};

function getIntentLabel(conversation: InboxConversation) {
  const meta = conversation.metadata_json ?? {};
  const explicitIntent = String(meta.intent ?? meta.detected_intent ?? "").toUpperCase();
  if (explicitIntent === "INVOICE") return "Invoice request";
  if (explicitIntent === "SUPPORT" || explicitIntent === "COMPLAINT") return "Support";
  if (explicitIntent === "SALES" || explicitIntent === "QUOTE") return "Sales";
  if (explicitIntent === "ORDER") return "Order";

  const text = `${conversation.subject ?? ""} ${conversation.messages?.[conversation.messages.length - 1]?.body_text ?? ""}`.toLowerCase();
  if (text.includes("factura") || text.includes("invoice")) return "Invoice request";
  if (text.includes("cotización") || text.includes("cotizacion") || text.includes("precio")) return "Sales";
  if (text.includes("problema") || text.includes("reclamo") || text.includes("error")) return "Support";
  return null;
}

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
  const intentLabel = getIntentLabel(conversation);
  const assigneeName = conversation.assigned_user?.full_name ?? conversation.assigned_user?.name ?? conversation.assigned_user?.email ?? null;
  const isAiActive = status === "IA_ATTENDING" || conversation.metadata_json?.ai_state === "AI_ACTIVE";
  const requiresHuman = status === "REQUIRES_HUMAN" || status === "BLOCKED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left transition-colors md:border-b md:border-border/40 md:last:border-0",
        "rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm md:rounded-none md:border-x-0 md:border-t-0 md:px-4 md:py-3.5 md:shadow-none",
        selected ? "border-primary/30 bg-primary/[0.08] md:bg-primary/[0.10]" : "hover:bg-muted/50",
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute bottom-3 left-0 top-3 hidden w-1 rounded-r-full bg-primary md:block"
        />
      )}

      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <AvatarFallback name={contactName} identity={contactIdentity} />
          <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${statusDot}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("truncate text-[13px] leading-snug", selected ? "font-semibold text-foreground" : "font-medium text-foreground")}>
              {contactName}
            </p>
            {timestamp && (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                {formatSmartTimestamp(timestamp)}
              </span>
            )}
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
            <ChannelBadge channel={conversation.channel?.type} />
            {intentLabel && (
              <span className="truncate rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {intentLabel}
              </span>
            )}
            {requiresHuman && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-px text-[10px] font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="h-2.5 w-2.5" />
                Needs human
              </span>
            )}
            {isAiActive && !requiresHuman && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500/10 px-1.5 py-px text-[10px] font-medium text-violet-600 dark:text-violet-300">
                <Bot className="h-2.5 w-2.5" />
                AI active
              </span>
            )}
          </div>

          <div className="mt-1.5">
            {isPrivate ? (
              <span className="flex items-center gap-1 text-[11px] text-amber-500/75">
                <Lock className="h-2.5 w-2.5 shrink-0" />
                Contains sensitive data
              </span>
            ) : (
              <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/75 md:truncate md:text-[11px]">
                {preview}
              </p>
            )}
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground/65 md:mt-1.5">
            <span className="inline-flex items-center gap-1 truncate">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} />
              {statusLabel}
            </span>
            <span className="text-muted-foreground/30">·</span>
            {assigneeName ? (
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <UserRound className="h-3 w-3 shrink-0" />
                <span className="truncate">{assigneeName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <UserRound className="h-3 w-3 shrink-0" />
                Unassigned
              </span>
            )}

            {conversation.channel?.type === "WHATSAPP" && conversation.is_service_window_open !== undefined && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1",
                    conversation.is_service_window_open ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                  )}
                  title={
                    conversation.is_service_window_open && conversation.service_window_expires_at
                      ? `Ventana cierra en ${formatDistanceToNowStrict(new Date(conversation.service_window_expires_at))}`
                      : "Ventana de 24h cerrada — requiere template"
                  }
                >
                  <Clock3 className="h-3 w-3" />
                  {conversation.is_service_window_open ? "Window open" : "Template required"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export const ConversationListItem = memo(ConversationListItemImpl);
