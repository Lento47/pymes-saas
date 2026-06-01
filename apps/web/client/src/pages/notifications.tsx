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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  Bell, BellOff, Check, CheckCheck,
  MessageCircle, CheckSquare, KanbanSquare, Receipt, Zap, AlertTriangle, Bot,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// 3 semantic variants — no rainbow
const TYPE_BADGE: Record<string, { label: string; variant: "default" | "success" | "destructive"; icon: typeof Bell }> = {
  task_completed:    { label: "Tarea completada", variant: "success",      icon: CheckSquare },
  task_overdue:      { label: "Tarea vencida",     variant: "destructive", icon: AlertTriangle },
  new_message:       { label: "Nuevo mensaje",     variant: "default",     icon: MessageCircle },
  AI_TASK_CREATED:   { label: "Tarea sugerida",    variant: "default",     icon: Bot },
  deal_created:      { label: "Negocio creado",    variant: "default",     icon: KanbanSquare },
  deal_stage_changed:{ label: "Etapa cambiada",    variant: "default",     icon: KanbanSquare },
  deal_won:          { label: "Negocio ganado",    variant: "success",     icon: KanbanSquare },
  invoice_paid:      { label: "Factura pagada",    variant: "success",     icon: Receipt },
  payment_received:  { label: "Pago recibido",     variant: "success",     icon: Receipt },
  invoice_overdue:   { label: "Factura vencida",   variant: "destructive", icon: Receipt },
  automation:        { label: "Automatización",    variant: "default",     icon: Zap },
  conversation_no_reply: { label: "Sin respuesta", variant: "destructive", icon: MessageCircle },
};

const VARIANT_CLASSES: Record<string, string> = {
  default:     "bg-muted/40 text-muted-foreground",
  success:     "bg-emerald-500/10 text-emerald-500",
  destructive: "bg-destructive/10 text-destructive",
};

const ICON_WRAPPER_CLASSES: Record<string, string> = {
  default:     "bg-muted/40 border-border/60",
  success:     "bg-emerald-500/10 border-emerald-500/20",
  destructive: "bg-destructive/10 border-destructive/20",
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
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => { if (v) setFilter(v as "all" | "unread"); }}
            className="border border-border rounded-md overflow-hidden"
            size="sm"
          >
            <ToggleGroupItem value="all" className="text-[11px] px-3 h-7 data-[state=on]:bg-muted data-[state=on]:text-foreground">
              Todas
            </ToggleGroupItem>
            <ToggleGroupItem value="unread" className="text-[11px] px-3 h-7 data-[state=on]:bg-muted data-[state=on]:text-foreground">
              Sin leer {unreadCount > 0 && `(${unreadCount})`}
            </ToggleGroupItem>
          </ToggleGroup>
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
              const cfg = TYPE_BADGE[n.type] || { label: n.type, variant: "default" as const, icon: Bell };
              const Icon = cfg.icon;
              const isUnread = !n.read_at;
              const time = n.created_at
                ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
                : "";

              return (
                <div
                  key={n.id}
                  className={cn("rounded-lg border p-4 transition-colors", isUnread ? "border-border bg-card" : "border-border/60 bg-card/40")}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border", ICON_WRAPPER_CLASSES[cfg.variant])}>
                      <Icon className={cn("w-4 h-4", VARIANT_CLASSES[cfg.variant].split(" ").pop())} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-border/60", VARIANT_CLASSES[cfg.variant])}>
                          {cfg.label}
                        </Badge>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                        {isUnread && (
                          <button
                            className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
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
