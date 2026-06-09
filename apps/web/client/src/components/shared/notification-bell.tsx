import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Bell, CheckCheck, ChevronRight, ChevronDown,
  MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, ClipboardList, Users, FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

type Notification = {
  id: string;
  read_at?: string | null;
  body?: string;
  title?: string;
  type?: string;
  created_at?: string;
  related_entity_type?: string;
  related_entity_id?: string;
};

type NotifGroup = {
  key: string;
  groupLabel: string;
  groupIcon: typeof Bell;
  groupColor: string;
  groupBg: string;
  items: Notification[];
  unreadCount: number;
  latestAt: string;
};

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  task_completed:        { icon: CheckSquare,   color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Tarea completada"  },
  task_overdue:          { icon: AlertTriangle, color: "text-red-500",     bg: "bg-red-500/10",     label: "Tarea vencida"     },
  new_message:           { icon: MessageCircle, color: "text-blue-500",    bg: "bg-blue-500/10",    label: "Nuevo mensaje"     },
  AI_TASK_CREATED:       { icon: ClipboardList, color: "text-muted-foreground", bg: "bg-muted",    label: "Tarea IA"          },
  deal_created:          { icon: KanbanSquare,  color: "text-amber-500",   bg: "bg-amber-500/10",   label: "Negocio creado"    },
  deal_stage_changed:    { icon: KanbanSquare,  color: "text-sky-500",     bg: "bg-sky-500/10",     label: "Etapa cambiada"    },
  deal_won:              { icon: KanbanSquare,  color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Negocio ganado"    },
  invoice_paid:          { icon: Receipt,       color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Factura pagada"    },
  payment_received:      { icon: Receipt,       color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Pago recibido"     },
  invoice_overdue:       { icon: Receipt,       color: "text-red-500",     bg: "bg-red-500/10",     label: "Factura vencida"   },
  automation:            { icon: Zap,           color: "text-muted-foreground", bg: "bg-muted",    label: "Automatización"    },
  conversation_no_reply: { icon: MessageCircle, color: "text-amber-500",   bg: "bg-amber-500/10",   label: "Sin respuesta"     },
};

const ENTITY_META: Record<string, { label: string; icon: typeof Bell; color: string; bg: string }> = {
  conversation:  { label: "Conversación", icon: MessageCircle, color: "text-blue-500",    bg: "bg-blue-500/10"    },
  conversations: { label: "Conversación", icon: MessageCircle, color: "text-blue-500",    bg: "bg-blue-500/10"    },
  contact:       { label: "Contacto",     icon: Users,         color: "text-slate-500",   bg: "bg-slate-500/10"   },
  task:          { label: "Tarea",        icon: CheckSquare,   color: "text-emerald-500", bg: "bg-emerald-500/10" },
  deal:          { label: "Negocio",      icon: KanbanSquare,  color: "text-amber-500",   bg: "bg-amber-500/10"   },
  invoice:       { label: "Factura",      icon: Receipt,       color: "text-slate-500",   bg: "bg-slate-500/10"   },
  document:      { label: "Documento",   icon: FileText,      color: "text-slate-500",   bg: "bg-slate-500/10"   },
};

function getTypeConfig(type?: string) {
  return (type && TYPE_CONFIG[type]) || { icon: Bell, color: "text-muted-foreground", bg: "bg-muted", label: "Notificación" };
}

function resolveLink(n: Notification): string | null {
  if (!n.related_entity_type || !n.related_entity_id) return null;
  const t = n.related_entity_type.toLowerCase();
  if (t === "conversation" || t === "conversations") return `/inbox/${n.related_entity_id}`;
  if (t === "task") return `/tasks`;
  if (t === "contact") return `/contacts/${n.related_entity_id}`;
  if (t === "deal") return `/pipeline`;
  if (t === "invoice") return `/invoices`;
  return null;
}

function groupNotifications(notifications: Notification[]): NotifGroup[] {
  const map = new Map<string, Notification[]>();

  for (const n of notifications) {
    const key = n.related_entity_id
      ? `entity:${(n.related_entity_type ?? "").toLowerCase()}:${n.related_entity_id}`
      : `type:${n.type ?? "unknown"}`;
    const bucket = map.get(key) ?? [];
    bucket.push(n);
    map.set(key, bucket);
  }

  const groups: NotifGroup[] = [];
  Array.from(map.entries()).forEach(([key, items]) => {
    const first = items[0];
    const entityType = first.related_entity_type?.toLowerCase();
    const typeCfg = getTypeConfig(first.type);
    const entityM = entityType ? ENTITY_META[entityType] : null;

    groups.push({
      key,
      groupLabel: entityM?.label ?? typeCfg.label,
      groupIcon: entityM?.icon ?? typeCfg.icon,
      groupColor: entityM?.color ?? typeCfg.color,
      groupBg: entityM?.bg ?? typeCfg.bg,
      items,
      unreadCount: items.filter((n: Notification) => !n.read_at).length,
      latestAt: first.created_at ?? "",
    });
  });

  return groups;
}

// Single notification row inside a group
function NotifRow({
  n,
  onMarkRead,
  onNavigate,
}: {
  n: Notification;
  onMarkRead: () => void;
  onNavigate: () => void;
}) {
  const isUnread = !n.read_at;
  const cfg = getTypeConfig(n.type);
  const Icon = cfg.icon;
  const link = resolveLink(n);
  const timeAgo = n.created_at
    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
    : "";

  const handleClick = () => {
    if (isUnread) onMarkRead();
    if (link) onNavigate();
  };

  const body = (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 transition-colors",
        isUnread && "bg-accent/5",
        link && "cursor-pointer hover:bg-muted/50",
      )}
      onClick={handleClick}
    >
      <div className="mt-0.5 flex w-1.5 shrink-0 items-center justify-center">
        {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </div>
      <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", cfg.bg)}>
        <Icon className={cn("h-3 w-3", cfg.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-xs font-medium", isUnread ? "text-foreground" : "text-muted-foreground")}>
          {n.title ?? n.type}
        </p>
        {n.body && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{n.body}</p>
        )}
        {timeAgo && (
          <p className="mt-0.5 text-[9px] text-muted-foreground/60">{timeAgo}</p>
        )}
      </div>
    </div>
  );

  return link ? <Link href={link}>{body}</Link> : body;
}

// Compact group item for popover
function BellGroupItem({
  group,
  onMarkRead,
  onNavigate,
}: {
  group: NotifGroup;
  onMarkRead: (ids: string[]) => void;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(group.unreadCount > 0 && group.items.length > 1);
  const GroupIcon = group.groupIcon;
  const isSingle = group.items.length === 1;
  const first = group.items[0];
  const timeAgo = group.latestAt
    ? formatDistanceToNow(new Date(group.latestAt), { addSuffix: true, locale: es })
    : "";

  // Single: render like original flat item
  if (isSingle) {
    return (
      <NotifRow
        n={first}
        onMarkRead={() => onMarkRead([first.id])}
        onNavigate={onNavigate}
      />
    );
  }

  const groupUnreadIds = group.items.filter((n) => !n.read_at).map((n) => n.id);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* Group trigger row */}
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
            group.unreadCount > 0 && "bg-accent/[0.04]",
          )}
        >
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", group.groupBg)}>
            <GroupIcon className={cn("h-3.5 w-3.5", group.groupColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-foreground">{group.groupLabel}</span>
              <Badge variant="secondary" className="h-3.5 min-w-[14px] px-1 text-[9px]">
                {group.items.length}
              </Badge>
              {group.unreadCount > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </div>
            {!open && (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {first.title} · {timeAgo}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {group.unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[9px] font-medium text-accent hover:text-accent hover:bg-accent/10"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onMarkRead(groupUnreadIds); }}
              >
                <CheckCheck className="h-3 w-3" />
              </Button>
            )}
            <ChevronDown
              className={cn("h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-150", open && "rotate-180")}
            />
          </div>
        </button>
      </CollapsibleTrigger>

      {/* Expanded items */}
      <CollapsibleContent>
        <div className="ml-3 border-l border-border/50 pl-0">
          {group.items.map((n) => (
            <NotifRow
              key={n.id}
              n={n}
              onMarkRead={() => onMarkRead([n.id])}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: api.getUnreadCount,
    refetchInterval: 30000,
  });

  const { data: notifData } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => api.getNotifications(),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.markRead({ ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.markRead({ all: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications: Notification[] = Array.isArray(notifData?.data)
    ? notifData.data
    : Array.isArray(notifData)
    ? notifData
    : [];

  const groups = groupNotifications(notifications);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Notificaciones"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-accent px-[3px] text-[9px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notificaciones</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-[16px] px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </Button>
          )}
        </div>

        <Separator />

        {/* Grouped list */}
        <ScrollArea className="max-h-[380px]">
          {groups.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {groups.map((group) => (
                <BellGroupItem
                  key={group.key}
                  group={group}
                  onMarkRead={(ids) => markRead.mutate(ids)}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-accent transition-colors hover:bg-muted/40"
            >
              Ver todas las notificaciones
              <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
