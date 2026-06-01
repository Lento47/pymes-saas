import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, CheckCheck, MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, ClipboardList, ChevronRight, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; variant: "default" | "success" | "destructive"; label: string }> = {
  task_completed: { icon: CheckSquare, variant: "success", label: "Tarea completada" },
  task_overdue: { icon: AlertTriangle, variant: "destructive", label: "Tarea vencida" },
  new_message: { icon: MessageCircle, variant: "default", label: "Nuevo mensaje" },
  AI_TASK_CREATED: { icon: Bot, variant: "default", label: "Tarea IA" },
  deal_created: { icon: KanbanSquare, variant: "default", label: "Negocio creado" },
  deal_stage_changed: { icon: KanbanSquare, variant: "default", label: "Etapa cambiada" },
  deal_won: { icon: KanbanSquare, variant: "success", label: "Negocio ganado" },
  invoice_paid: { icon: Receipt, variant: "success", label: "Factura pagada" },
  payment_received: { icon: Receipt, variant: "success", label: "Pago recibido" },
  invoice_overdue: { icon: Receipt, variant: "destructive", label: "Factura vencida" },
  automation: { icon: Zap, variant: "default", label: "Automatización" },
  conversation_no_reply: { icon: MessageCircle, variant: "destructive", label: "Sin respuesta" },
};

const VARIANT_STYLES: Record<string, { icon: string; bg: string }> = {
  default: { icon: "text-foreground/70", bg: "bg-muted border-border/60" },
  success: { icon: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  destructive: { icon: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Bell, variant: "default" as const, label: type };
}

/** Resolve navigation target from notification's related entity */
function resolveLink(n: any): string | null {
  if (!n.related_entity_type || !n.related_entity_id) return null;
  const t = n.related_entity_type.toLowerCase();
  if (t === "conversation" || t === "conversations") return `/inbox/${n.related_entity_id}`;
  if (t === "task") return `/tasks`;
  if (t === "contact") return `/contacts/${n.related_entity_id}`;
  if (t === "deal") return `/pipeline`;
  if (t === "invoice") return `/invoices`;
  return null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: api.getUnreadCount,
    refetchInterval: 30000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => api.getNotifications(),
    enabled: open,
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications = (notificationsData?.data ?? []).slice(0, 5);

  const handleMarkRead = async (ids: string[]) => {
    await api.markRead({ ids });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  };

  const handleMarkAllRead = async () => {
    await api.markRead({ ids: [] });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  };

  const handleNotificationClick = (n: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!n.read_at) handleMarkRead([n.id]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 rounded-md"
        onClick={() => setOpen(!open)}
        title="Notificaciones"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-semibold px-1 bg-primary text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-14 z-50 w-80 rounded-lg border border-border bg-card shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-foreground">Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas leídas
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[11px] text-muted-foreground">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map((n: any) => {
                  const cfg = getTypeConfig(n.type);
                  const Icon = cfg.icon;
                  const timeAgo = n.created_at
                    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
                    : "";
                  const isUnread = !n.read_at;
                  const link = resolveLink(n);

                  const item = (
                    <div
                      className={cn(
                        "flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer",
                        isUnread && "bg-primary/5",
                      )}
                      style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)" }}
                      onClick={(e) => {
                        if (isUnread) {
                          e.stopPropagation();
                          handleMarkRead([n.id]);
                        }
                      }}
                    >
                      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border", VARIANT_STYLES[cfg.variant]?.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", VARIANT_STYLES[cfg.variant]?.icon)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium text-foreground truncate">{n.title}</span>
                          {isUnread && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.body}</p>
                        <span className="text-[9px] text-muted-foreground/70">{timeAgo}</span>
                      </div>
                    </div>
                  );

                  return link ? (
                    <Link key={n.id} href={link} onClick={(e: any) => handleNotificationClick(n, e)}>
                      {item}
                    </Link>
                  ) : (
                    <div key={n.id}>{item}</div>
                  );
                })
              )}
            </div>

            <Link href="/notifications">
              <div
                className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-primary hover:bg-muted/50 transition-colors border-t border-border"
                onClick={() => setOpen(false)}
              >
                Ver todas las notificaciones
                <ChevronRight className="w-3 h-3" />
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
