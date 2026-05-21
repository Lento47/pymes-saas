import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageDeal {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  contact: { full_name: string; company_name: string | null } | null;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  deals: StageDeal[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function crc(n: number): string {
  return `₡${n.toLocaleString("es-CR")}`;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// ── Brief composer — builds narrative from real data ─────────────────────────

function composeBrief(data: {
  revenue: number;
  outstanding: number;
  outstandingCount: number;
  pipelineDeals: number;
  pipelineValue: number;
  pipelineTopStage: string;
  messagesToday: number;
  urgentTasks: number;
  upcomingInvoices: any[];
  conversations: any[];
}) {
  const lines: string[] = [];

  // Revenue line
  if (data.revenue > 0) {
    lines.push(
      `Este mes llevás ${crc(data.revenue)} en ingresos.`
    );
  } else {
    lines.push("Aún no registrás ingresos este mes.");
  }

  // Outstanding
  if (data.outstanding > 0) {
    lines.push(
      `Tenés ${plural(data.outstandingCount, "factura", "facturas")} por cobrar (${crc(data.outstanding)}).`
    );
  }

  // Pipeline
  if (data.pipelineDeals > 0) {
    lines.push(
      `El pipeline está activo con ${plural(data.pipelineDeals, "negocio", "negocios")} por ${crc(data.pipelineValue)}${data.pipelineTopStage ? ` — la mayoría en ${data.pipelineTopStage.toLowerCase()}` : "."}`
    );
  } else {
    lines.push("No hay negocios en el pipeline.");
  }

  // Messages
  if (data.messagesToday > 0) {
    lines.push(
      `Hoy entraron ${plural(data.messagesToday, "mensaje nuevo", "mensajes nuevos")}.`
    );
  }

  // Urgent items
  const alerts: string[] = [];

  // Upcoming invoices (< 5 days)
  const soon = data.upcomingInvoices.filter((inv: any) => {
    const due = new Date(inv.due_date);
    const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 5;
  });
  if (soon.length > 0) {
    const names = soon
      .slice(0, 3)
      .map((inv: any) => inv.client_name || `Factura #${inv.id?.slice(0, 6)}`)
      .join(", ");
    alerts.push(
      `${plural(soon.length, "factura vence pronto", "facturas vencen pronto")}: ${names}`
    );
  }

  // Overdue invoices
  const overdue = data.upcomingInvoices.filter((inv: any) => {
    const due = new Date(inv.due_date);
    return due.getTime() < Date.now();
  });
  if (overdue.length > 0) {
    alerts.push(
      `${plural(overdue.length, "factura vencida", "facturas vencidas")} (${crc(overdue.reduce((s: number, i: any) => s + (Number(i.balance_due ?? i.amount) || 0), 0))})`
    );
  }

  if (data.urgentTasks > 0) {
    alerts.push(
      `${plural(data.urgentTasks, "tarea urgente pendiente", "tareas urgentes pendientes")}`
    );
  }

  return { body: lines.join(" "), alerts };
}

// ── Pipeline strip ───────────────────────────────────────────────────────────

function PipelineStrip({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  const maxDeals = Math.max(...stages.map((s) => s.deals.length), 1);

  return (
    <div className="flex gap-1.5">
      {stages.map((stage) => {
        const count = stage.deals.length;
        const value = stage.deals.reduce(
          (s, d) => s + (Number(d.value) || 0),
          0
        );
        return (
          <div
            key={stage.id}
            className="flex-1 min-w-0 rounded-md border border-border bg-card dash-card px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-[11px] font-medium text-foreground truncate">
                {stage.name}
              </span>
            </div>
            <div className="text-lg font-semibold text-foreground tabular-nums leading-none">
              {count}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(count / maxDeals) * 100}%`,
                    backgroundColor: stage.color,
                    opacity: count > 0 ? 0.7 : 0.15,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {crc(value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

const ACTIVE_STAGES = ["Ganado", "Perdido"];

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats"],
    queryFn: () => api.getWorkspaceStats(),
    refetchInterval: 120000,
  });

  const { data: todayStats, isLoading: todayLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats/today"],
    queryFn: api.getTodayStats,
    refetchInterval: 60000,
  });

  const { data: pipeline, isLoading: pipelineLoading } = useQuery({
    queryKey: ["/api/pipeline/stages"],
    queryFn: () => api.getPipelineStages() as Promise<PipelineStage[]>,
    refetchInterval: 120000,
  });

  const { data: conversations } = useQuery({
    queryKey: ["/api/conversations", "dash"],
    queryFn: () => api.getConversations({ limit: "5" }),
  });

  const { data: tasks } = useQuery({
    queryKey: ["/api/tasks", "dash"],
    queryFn: () => api.getTasks({ limit: "10" }),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["/api/invoices", "dash"],
    queryFn: () => api.getInvoices({ limit: "50" }),
    refetchInterval: 120000,
  });

  // Parse
  const s = (stats as any) ?? {};
  const t = (todayStats as any) ?? {};
  const pipelineStages: PipelineStage[] = Array.isArray(pipeline)
    ? pipeline
    : [];
  const activeStages = pipelineStages.filter(
    (s) => !ACTIVE_STAGES.includes(s.name)
  );

  const convList = Array.isArray(conversations)
    ? conversations
    : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const allInvoices: any[] = Array.isArray(invoicesData)
    ? invoicesData
    : invoicesData?.data ?? [];
  const outstandingInvoices = allInvoices.filter((inv: any) =>
    ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(
      inv.status ?? inv.collection_state
    )
  );
  const upcomingInvoices = [...outstandingInvoices].sort(
    (a: any, b: any) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  // Find top pipeline stage by deal count
  const topStage = [...activeStages].sort(
    (a, b) => b.deals.length - a.deals.length
  )[0];

  const brief = composeBrief({
    revenue: s.monthly_revenue || 0,
    outstanding: outstandingInvoices.reduce(
      (sum: number, inv: any) =>
        sum + (Number(inv.balance_due ?? inv.amount) || 0),
      0
    ),
    outstandingCount: outstandingInvoices.length,
    pipelineDeals: activeStages.reduce((s, st) => s + st.deals.length, 0),
    pipelineValue: activeStages.reduce(
      (s, st) => s + st.deals.reduce((ss, d) => ss + (Number(d.value) || 0), 0),
      0
    ),
    pipelineTopStage: topStage?.name ?? "",
    messagesToday: t.received_messages || 0,
    urgentTasks: taskList.filter((t: any) => t.priority === "HIGH").length,
    upcomingInvoices,
    conversations: convList,
  });

  // Greeting
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const isLoading = statsLoading || todayLoading;

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 py-5 max-w-4xl mx-auto space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-normal text-foreground tracking-[-0.3px]">
            {greeting()},{" "}
            <span className="font-medium">
              {user?.name?.split(" ")[0] || "Usuario"}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>

        {/* Brief */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card dash-card p-4">
            <p className="text-sm leading-relaxed text-foreground">
              {brief.body}
            </p>
            {brief.alerts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {brief.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pipeline strip */}
        {!pipelineLoading && activeStages.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground mb-2.5">
              Pipeline
            </h2>
            <PipelineStrip stages={activeStages} />
          </div>
        )}

        {/* Two-column: Tasks + Invoices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tasks */}
          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
                Tareas pendientes
              </h2>
            </div>
            {taskList.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                Todo al día
              </div>
            ) : (
              taskList.slice(0, 8).map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 px-4 py-2 border-b border-border last:border-0"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.priority === "HIGH"
                        ? "bg-red-500"
                        : task.priority === "MEDIUM"
                        ? "bg-amber-500"
                        : "bg-border"
                    }`}
                  />
                  <span className="text-[13px] text-foreground truncate flex-1">
                    {task.title}
                  </span>
                  {task.due_date && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(task.due_date), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Invoices */}
          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
                Facturas por cobrar
              </h2>
            </div>
            {upcomingInvoices.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                Sin facturas pendientes
              </div>
            ) : (
              upcomingInvoices.slice(0, 8).map((inv: any) => {
                const due = new Date(inv.due_date);
                const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                const isOverdue = days < 0;
                const isSoon = days >= 0 && days <= 3;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2.5 px-4 py-2 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground truncate">
                        {inv.client_name ||
                          `Factura #${inv.id?.slice(0, 8)}`}
                      </p>
                      <p
                        className={`text-[11px] ${
                          isOverdue
                            ? "text-red-500"
                            : isSoon
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isOverdue
                          ? `Vencida ${formatDistanceToNow(due, {
                              addSuffix: true,
                              locale: es,
                            })}`
                          : `Vence ${formatDistanceToNow(due, {
                              addSuffix: true,
                              locale: es,
                            })}`}
                      </p>
                    </div>
                    <span className="text-[13px] font-medium text-foreground tabular-nums shrink-0">
                      {crc(Number(inv.balance_due ?? inv.amount) || 0)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent activity */}
        {convList.length > 0 && (
          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
                Actividad reciente
              </h2>
            </div>
            {convList.slice(0, 5).map((conv: any) => (
              <Link key={conv.id} href={`/inbox/${conv.id}`}>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shrink-0">
                    {conv.contact?.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground">
                      {conv.contact?.full_name || "Sin nombre"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {conv.subject || "Sin asunto"}
                    </p>
                  </div>
                  {conv.updated_at && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.updated_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
