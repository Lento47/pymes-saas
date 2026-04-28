import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BellOff, Check, CheckCheck, Loader2,
  MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, Bot,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string; icon: typeof Bell }> = {
  task_completed: { label: "Tarea completada", bg: "bg-emerald-500/10", color: "text-emerald-400", icon: CheckSquare },
  task_overdue: { label: "Tarea vencida", bg: "bg-red-500/10", color: "text-red-400", icon: AlertTriangle },
  new_message: { label: "Nuevo mensaje", bg: "bg-blue-500/10", color: "text-blue-400", icon: MessageCircle },
  AI_TASK_CREATED: { label: "Tarea IA", bg: "bg-violet-500/10", color: "text-violet-400", icon: Bot },
  deal_created: { label: "Negocio creado", bg: "bg-amber-500/10", color: "text-amber-400", icon: KanbanSquare },
  deal_stage_changed: { label: "Etapa cambiada", bg: "bg-sky-500/10", color: "text-sky-400", icon: KanbanSquare },
  deal_won: { label: "Negocio ganado", bg: "bg-emerald-500/10", color: "text-emerald-400", icon: KanbanSquare },
  invoice_paid: { label: "Factura pagada", bg: "bg-emerald-500/10", color: "text-emerald-400", icon: Receipt },
  payment_received: { label: "Pago recibido", bg: "bg-emerald-500/10", color: "text-emerald-400", icon: Receipt },
  invoice_overdue: { label: "Factura vencida", bg: "bg-red-500/10", color: "text-red-400", icon: Receipt },
  automation: { label: "Automatización", bg: "bg-violet-500/10", color: "text-violet-400", icon: Zap },
  conversation_no_reply: { label: "Sin respuesta", bg: "bg-amber-500/10", color: "text-amber-400", icon: MessageCircle },
};

export default function NotificationsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => api.getNotifications(),
  });

  const notifications = Array.isArray(data?.data) ? data.data : data?.data?.data || [];
  const filtered = filter === "unread"
    ? notifications.filter((n: any) => !n.read_at)
    : notifications;
  const unreadCount = notifications.filter((n: any) => !n.read_at).length;

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
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="w-3.5 h-3.5" /> Marcar todas leídas
            </Button>
          )}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${filter === "all" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setFilter("all")}
            >
              Todas
            </button>
            <button
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${filter === "unread" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setFilter("unread")}
            >
              Sin leer {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="px-6 py-4">
        {isLoading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filter === "unread" ? Bell : BellOff}
            title={filter === "unread" ? "Sin notificaciones pendientes" : "Sin notificaciones"}
            description={filter === "unread" ? "No tienes notificaciones sin leer." : "Aún no has recibido notificaciones. Aparecerán aquí cuando haya actividad relevante."}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((n: any) => {
              const cfg = TYPE_BADGE[n.type] || { label: n.type, bg: "bg-zinc-500/10", color: "text-zinc-400", icon: Bell };
              const Icon = cfg.icon;
              const isUnread = !n.read_at;
              const time = n.created_at
                ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
                : "";

              return (
                <div
                  key={n.id}
                  className={`rounded-lg border p-4 transition-colors ${isUnread ? "bg-accent/5 border-accent/20" : "bg-card/40 border-border/60"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} border border-border/60`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border border-border/60 ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "hsl(var(--accent))" }} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                        {isUnread && (
                          <button
                            className="text-[10px] font-medium hover:text-foreground transition-colors flex items-center gap-1"
                            style={{ color: "hsl(var(--accent))" }}
                            onClick={() => handleMarkRead([n.id])}
                          >
                            <Check className="w-3 h-3" />
                            Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
