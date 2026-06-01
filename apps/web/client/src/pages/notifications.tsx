import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  Bell, BellOff, Check, CheckCheck,
  MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, Bot,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string; icon: typeof Bell }> = {
  task_completed:        { label: "Tarea completada", bg: "bg-emerald-500/10", color: "text-emerald-500", icon: CheckSquare  },
  task_overdue:          { label: "Tarea vencida",    bg: "bg-red-500/10",     color: "text-red-500",     icon: AlertTriangle },
  new_message:           { label: "Nuevo mensaje",    bg: "bg-blue-500/10",    color: "text-blue-500",    icon: MessageCircle },
  AI_TASK_CREATED:       { label: "Tarea sugerida",   bg: "bg-muted",          color: "text-muted-foreground", icon: Bot   },
  deal_created:          { label: "Negocio creado",   bg: "bg-amber-500/10",   color: "text-amber-500",   icon: KanbanSquare  },
  deal_stage_changed:    { label: "Etapa cambiada",   bg: "bg-sky-500/10",     color: "text-sky-500",     icon: KanbanSquare  },
  deal_won:              { label: "Negocio ganado",   bg: "bg-emerald-500/10", color: "text-emerald-500", icon: KanbanSquare  },
  invoice_paid:          { label: "Factura pagada",   bg: "bg-emerald-500/10", color: "text-emerald-500", icon: Receipt       },
  payment_received:      { label: "Pago recibido",    bg: "bg-emerald-500/10", color: "text-emerald-500", icon: Receipt       },
  invoice_overdue:       { label: "Factura vencida",  bg: "bg-red-500/10",     color: "text-red-500",     icon: Receipt       },
  automation:            { label: "Automatización",   bg: "bg-muted",          color: "text-muted-foreground", icon: Zap   },
  conversation_no_reply: { label: "Sin respuesta",    bg: "bg-amber-500/10",   color: "text-amber-500",   icon: MessageCircle },
};

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

export default function NotificationsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => api.getNotifications(),
  });

  const notifications = Array.isArray(data?.data) ? data.data : data?.data?.data ?? [];
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
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
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
        ) : filtered.length === 0 ? (
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
            {filtered.map((n: any) => {
              const cfg = TYPE_BADGE[n.type] ?? { label: n.type, bg: "bg-muted", color: "text-muted-foreground", icon: Bell };
              const Icon = cfg.icon;
              const isUnread = !n.read_at;
              const time = n.created_at
                ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
                : "";

              return (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    isUnread
                      ? "border-accent/20 bg-accent/5"
                      : "border-border bg-card/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60", cfg.bg)}>
                      <Icon className={cn("h-4 w-4", cfg.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                        <Badge
                          variant="outline"
                          className={cn("border-border/60 px-1.5 py-0 text-[9px]", cfg.bg, cfg.color)}
                        >
                          {cfg.label}
                        </Badge>
                        {isUnread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                        {isUnread && (
                          <button
                            className="flex items-center gap-1 text-[10px] font-medium text-accent transition-colors hover:text-accent/80"
                            onClick={() => handleMarkRead([n.id])}
                          >
                            <Check className="h-3 w-3" />
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
