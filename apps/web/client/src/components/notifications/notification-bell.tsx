import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, CheckCheck, MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, Bot, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  task_completed: { icon: CheckSquare, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Tarea completada" },
  task_overdue: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", label: "Tarea vencida" },
  new_message: { icon: MessageCircle, color: "text-blue-400", bg: "bg-blue-500/10", label: "Nuevo mensaje" },
  AI_TASK_CREATED: { icon: Bot, color: "text-violet-400", bg: "bg-violet-500/10", label: "Tarea IA" },
  deal_created: { icon: KanbanSquare, color: "text-amber-400", bg: "bg-amber-500/10", label: "Negocio creado" },
  deal_stage_changed: { icon: KanbanSquare, color: "text-sky-400", bg: "bg-sky-500/10", label: "Etapa cambiada" },
  deal_won: { icon: KanbanSquare, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Negocio ganado" },
  invoice_paid: { icon: Receipt, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Factura pagada" },
  payment_received: { icon: Receipt, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Pago recibido" },
  invoice_overdue: { icon: Receipt, color: "text-red-400", bg: "bg-red-500/10", label: "Factura vencida" },
  automation: { icon: Zap, color: "text-violet-400", bg: "bg-violet-500/10", label: "Automatización" },
  conversation_no_reply: { icon: MessageCircle, color: "text-amber-400", bg: "bg-amber-500/10", label: "Sin respuesta" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Bell, color: "text-zinc-400", bg: "bg-zinc-500/10", label: "Notificación" };
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

  return (
    <div className="relative">
      <button
        className="relative p-1 rounded-md hover:bg-white/10 transition-colors"
        onClick={() => setOpen(!open)}
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" style={{ color: "hsl(var(--fg-2))" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-semibold px-1"
            style={{ background: "hsl(var(--accent))", color: "white" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border shadow-xl"
            style={{ background: "hsl(var(--bg-elevated))", borderColor: "hsl(var(--border))" }}
          >
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <span className="text-xs font-medium text-foreground">Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  className="text-[10px] hover:text-foreground transition-colors flex items-center gap-1"
                  style={{ color: "hsl(var(--fg-3))" }}
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas leídas
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[11px]" style={{ color: "hsl(var(--fg-3))" }}>
                    No hay notificaciones
                  </p>
                </div>
              ) : (
                notifications.map((n: any) => {
                  const cfg = getTypeConfig(n.type);
                  const Icon = cfg.icon;
                  const timeAgo = n.created_at
                    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
                    : "";
                  const isUnread = !n.read_at;

                  return (
                    <button
                      key={n.id}
                      className={cn(
                        "w-full text-left px-3 py-2.5 transition-colors hover:bg-white/5 flex items-start gap-2.5",
                        isUnread && "bg-accent/5",
                      )}
                      style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)" }}
                      onClick={() => isUnread && handleMarkRead([n.id])}
                    >
                      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5", cfg.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium text-foreground truncate">{n.title}</span>
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(var(--accent))" }} />
                          )}
                        </div>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: "hsl(var(--fg-2))" }}>
                          {n.body}
                        </p>
                        <span className="text-[9px]" style={{ color: "hsl(var(--fg-3))" }}>
                          {timeAgo}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <Link href="/notifications">
              <div
                className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium hover:bg-white/5 transition-colors"
                style={{ borderTop: "1px solid hsl(var(--border))", color: "hsl(var(--accent))" }}
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
