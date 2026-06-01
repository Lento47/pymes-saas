import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Bell, X, CheckCheck, ChevronRight,
  MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, ClipboardList,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

type Notification = {
  id: string;
  read_at?: string | null;
  body?: string;
  title?: string;
  type?: string;
  created_at?: string;
};

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  task_completed:        { icon: CheckSquare,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
  task_overdue:          { icon: AlertTriangle, color: "text-red-500",     bg: "bg-red-500/10"     },
  new_message:           { icon: MessageCircle, color: "text-blue-500",    bg: "bg-blue-500/10"    },
  AI_TASK_CREATED:       { icon: ClipboardList, color: "text-muted-foreground", bg: "bg-muted"    },
  deal_created:          { icon: KanbanSquare,  color: "text-amber-500",   bg: "bg-amber-500/10"   },
  deal_stage_changed:    { icon: KanbanSquare,  color: "text-sky-500",     bg: "bg-sky-500/10"     },
  deal_won:              { icon: KanbanSquare,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
  invoice_paid:          { icon: Receipt,       color: "text-emerald-500", bg: "bg-emerald-500/10" },
  payment_received:      { icon: Receipt,       color: "text-emerald-500", bg: "bg-emerald-500/10" },
  invoice_overdue:       { icon: Receipt,       color: "text-red-500",     bg: "bg-red-500/10"     },
  automation:            { icon: Zap,           color: "text-muted-foreground", bg: "bg-muted"    },
  conversation_no_reply: { icon: MessageCircle, color: "text-amber-500",   bg: "bg-amber-500/10"   },
};

function getTypeConfig(type?: string) {
  return (type && TYPE_CONFIG[type]) || { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
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
          <span className="text-sm font-semibold text-foreground">Notificaciones</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas leídas
            </Button>
          )}
        </div>

        <Separator />

        {/* List */}
        <ScrollArea className="max-h-[320px]">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <NotifItem
                  key={n.id}
                  notification={n}
                  onMarkRead={() => markRead.mutate([n.id])}
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

function NotifItem({
  notification: n,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const isUnread = !n.read_at;
  const cfg = getTypeConfig(n.type);
  const Icon = cfg.icon;
  const timeAgo = n.created_at
    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
    : "";

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0",
        isUnread && "bg-accent/5",
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Unread dot */}
      <div className="mt-2 flex w-2 shrink-0 items-center justify-center">
        {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </div>

      {/* Type icon */}
      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", cfg.bg)}>
        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-xs font-medium text-foreground">{n.title ?? n.type}</span>
          {hovering && isUnread && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
              title="Marcar como leída"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>
        )}
        {timeAgo && (
          <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo}</p>
        )}
      </div>
    </div>
  );
}
