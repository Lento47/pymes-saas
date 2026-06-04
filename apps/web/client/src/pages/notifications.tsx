import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Bell, BellOff, Check, CheckCheck,
  MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, Bot,
  ExternalLink, ChevronDown, Users, FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

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

const TYPE_META: Record<string, { label: string; bg: string; color: string; icon: typeof Bell }> = {
  task_completed:        { label: "Tarea completada", bg: "bg-emerald-500/10", color: "text-emerald-500", icon: CheckSquare  },
  task_overdue:          { label: "Tarea vencida",    bg: "bg-red-500/10",     color: "text-red-500",     icon: AlertTriangle },
  new_message:           { label: "Nuevo mensaje",    bg: "bg-blue-500/10",    color: "text-blue-500",    icon: MessageCircle },
  AI_TASK_CREATED:       { label: "Tarea IA",         bg: "bg-muted",          color: "text-muted-foreground", icon: Bot   },
  deal_created:          { label: "Negocio creado",   bg: "bg-amber-500/10",   color: "text-amber-500",   icon: KanbanSquare  },
  deal_stage_changed:    { label: "Etapa cambiada",   bg: "bg-sky-500/10",     color: "text-sky-500",     icon: KanbanSquare  },
  deal_won:              { label: "Negocio ganado",   bg: "bg-emerald-500/10", color: "text-emerald-500", icon: KanbanSquare  },
  invoice_paid:          { label: "Factura pagada",   bg: "bg-emerald-500/10", color: "text-emerald-500", icon: Receipt       },
  payment_received:      { label: "Pago recibido",    bg: "bg-emerald-500/10", color: "text-emerald-500", icon: Receipt       },
  invoice_overdue:       { label: "Factura vencida",  bg: "bg-red-500/10",     color: "text-red-500",     icon: Receipt       },
  automation:            { label: "Automatización",   bg: "bg-muted",          color: "text-muted-foreground", icon: Zap   },
  conversation_no_reply: { label: "Sin respuesta",    bg: "bg-amber-500/10",   color: "text-amber-500",   icon: MessageCircle },
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
    const typeMeta = TYPE_META[first.type ?? ""] ?? { label: first.type ?? "Notificación", bg: "bg-muted", color: "text-muted-foreground", icon: Bell };
    const entityM = entityType ? ENTITY_META[entityType] : null;

    groups.push({
      key,
      groupLabel: entityM?.label ?? typeMeta.label,
      groupIcon: entityM?.icon ?? typeMeta.icon,
      groupColor: entityM?.color ?? typeMeta.color,
      groupBg: entityM?.bg ?? typeMeta.bg,
      items,
      unreadCount: items.filter((n: Notification) => !n.read_at).length,
      latestAt: first.created_at ?? "",
    });
  });

  return groups;
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/5" />
      </div>
    </div>
  );
}

function NotifItem({
  n,
  onMarkRead,
}: {
  n: Notification;
  onMarkRead: (ids: string[]) => void;
}) {
  const cfg = TYPE_META[n.type ?? ""] ?? { label: n.type ?? "", bg: "bg-muted", color: "text-muted-foreground", icon: Bell };
  const Icon = cfg.icon;
  const isUnread = !n.read_at;
  const time = n.created_at
    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
    : "";
  const link = resolveLink(n);

  const card = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
        isUnread ? "bg-accent/5" : "hover:bg-muted/40",
        link && "cursor-pointer hover:bg-muted/40",
      )}
    >
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/40", cfg.bg)}>
        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className={cn("text-xs font-medium", isUnread ? "text-foreground" : "text-muted-foreground")}>
            {n.title}
          </span>
          {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
          {link && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/30" />}
        </div>
        {n.body && (
          <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground/60">{time}</span>
          {isUnread && (
            <button
              className="flex items-center gap-1 text-[10px] font-medium text-accent transition-colors hover:text-accent/70"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMarkRead([n.id]); }}
            >
              <Check className="h-3 w-3" />
              Marcar leída
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return link ? (
    <Link href={link} className="block" onClick={() => isUnread && onMarkRead([n.id])}>
      {card}
    </Link>
  ) : (
    <div>{card}</div>
  );
}

function NotifGroupCard({
  group,
  defaultOpen,
  onMarkRead,
}: {
  group: NotifGroup;
  defaultOpen: boolean;
  onMarkRead: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const GroupIcon = group.groupIcon;
  const isSingle = group.items.length === 1;
  const first = group.items[0];
  const time = group.latestAt
    ? formatDistanceToNow(new Date(group.latestAt), { addSuffix: true, locale: es })
    : "";

  // Single item — render flat, no accordion chrome
  if (isSingle) {
    return (
      <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
        <NotifItem n={first} onMarkRead={onMarkRead} />
      </div>
    );
  }

  const groupUnreadIds = group.items.filter((n) => !n.read_at).map((n) => n.id);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        group.unreadCount > 0 ? "border-accent/20 bg-accent/[0.03]" : "border-border bg-card/40",
      )}>
        {/* Group header */}
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50", group.groupBg)}>
              <GroupIcon className={cn("h-4 w-4", group.groupColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{group.groupLabel}</span>
                <Badge variant="secondary" className="h-4 min-w-[18px] px-1.5 text-[10px]">
                  {group.items.length}
                </Badge>
                {group.unreadCount > 0 && (
                  <Badge className="h-4 min-w-[18px] bg-accent px-1.5 text-[10px] text-white hover:bg-accent">
                    {group.unreadCount} sin leer
                  </Badge>
                )}
              </div>
              {!open && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {first.title}
                  {group.items.length > 1 && ` · ${time}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {group.unreadCount > 0 && !open && (
                <button
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onMarkRead(groupUnreadIds); }}
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar leídas
                </button>
              )}
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Group items */}
        <CollapsibleContent>
          <div className="border-t border-border/50 px-2 py-1.5 space-y-0.5">
            {group.unreadCount > 0 && (
              <div className="flex justify-end px-1 pb-1">
                <button
                  className="flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent/70 transition-colors"
                  onClick={() => onMarkRead(groupUnreadIds)}
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todas leídas
                </button>
              </div>
            )}
            {group.items.map((n) => (
              <NotifItem key={n.id} n={n} onMarkRead={onMarkRead} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function NotificationsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => api.getNotifications(),
  });

  const notifications: Notification[] = Array.isArray(data?.data)
    ? data.data
    : data?.data?.data ?? [];

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const groups = groupNotifications(filtered);

  const handleMarkRead = async (ids: string[]) => {
    try {
      await api.markRead({ ids });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    } catch {
      toast({ title: "Error al marcar como leído", variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markRead({ ids: [] });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Todas las notificaciones marcadas como leídas" });
    } catch {
      toast({ title: "Error al marcar todas como leídas", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        description={`${unreadCount > 0 ? `${unreadCount} sin leer · ` : ""}${notifications.length} total`}
      >
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas leídas
            </Button>
          )}
          <Tabs value={filter} onValueChange={(v: string) => setFilter(v as "all" | "unread")}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="h-7 px-3 text-xs">
                Todas
              </TabsTrigger>
              <TabsTrigger value="unread" className="h-7 gap-1.5 px-3 text-xs">
                Sin leer
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </PageHeader>

      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={filter === "unread" ? Bell : BellOff}
            title={filter === "unread" ? "Sin notificaciones pendientes" : "Sin notificaciones"}
            description={
              filter === "unread"
                ? "No tienes notificaciones sin leer."
                : "Aún no has recibido notificaciones. Aparecerán aquí cuando haya actividad relevante."
            }
          />
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <NotifGroupCard
                key={group.key}
                group={group}
                defaultOpen={group.unreadCount > 0}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
