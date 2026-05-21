import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Plus, TrendingUp, TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  loading,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { direction: "up" | "down"; pct: number };
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        accent
          ? "border-amber-500/20 bg-amber-500/[0.04]"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.10]"
      }`}
    >
      <div className="px-4 py-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[1px] text-muted-foreground mb-1.5">
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div
              className={`text-[28px] font-semibold leading-none tracking-[-0.5px] ${
                accent ? "text-amber-400" : "text-foreground"
              }`}
            >
              {value}
            </div>
            {(sub || trend) && (
              <div className="flex items-center gap-2 mt-1.5">
                {trend && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                      trend.direction === "up"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {trend.direction === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {trend.pct}%
                  </span>
                )}
                {sub && (
                  <span className="text-[11px] text-muted-foreground">
                    {sub}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

const ACTIVE_STAGES = ["Ganado", "Perdido"];

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();

  // Data fetching
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

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", "dash"],
    queryFn: () => api.getTasks({ limit: "5" }),
  });

  const { data: overdueInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices", "overdue-widget"],
    queryFn: () => api.getInvoices({ status: "OVERDUE", limit: "5" }),
    refetchInterval: 120000,
  });

  // Parse data
  const s = (stats as any) ?? {};
  const t = (todayStats as any) ?? {};
  const pipelineStages: PipelineStage[] = Array.isArray(pipeline) ? pipeline : [];
  const activeStages = pipelineStages.filter(
    (stage) => !ACTIVE_STAGES.includes(stage.name)
  );
  const pipelineTotalValue = activeStages.reduce(
    (sum, stage) =>
      sum + stage.deals.reduce((s, d) => s + (Number(d.value) || 0), 0),
    0
  );
  const pipelineTotalDeals = activeStages.reduce(
    (sum, stage) => sum + stage.deals.length,
    0
  );
  const totalActiveConversations = s.activeConversations ?? 0;

  const convList = Array.isArray(conversations)
    ? conversations
    : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const overdueList = Array.isArray(overdueInvoices)
    ? overdueInvoices
    : overdueInvoices?.data ?? [];

  const highPriorityTasks = taskList.filter(
    (t: any) => t.priority === "HIGH"
  ).length;

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
      {/* Welcome Bar */}
      <div className="border-b border-white/[0.06]">
        <div className="px-6 py-5 max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-foreground tracking-[-0.3px]">
              {greeting()},{" "}
              <span className="font-medium">{user?.name?.split(" ")[0] || "Usuario"}</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nuevo
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Ingresos del mes"
            value={`₡${(s.monthly_revenue || 0).toLocaleString("es-CR")}`}
            sub={
              s.monthly_revenue > 0
                ? `${(s.monthly_revenue / 1000).toFixed(0)}k este mes`
                : "Sin ingresos aún"
            }
            loading={isLoading}
          />
          <KpiCard
            label="Por cobrar"
            value={`₡${overdueList
              .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)
              .toLocaleString("es-CR")}`}
            sub={`${overdueList.length} facturas`}
            loading={invoicesLoading}
          />
          <KpiCard
            label="Conversaciones"
            value={totalActiveConversations}
            sub={`${t.received_messages || 0} mensajes hoy`}
            loading={isLoading}
          />
          <KpiCard
            label="Pipeline activo"
            value={`₡${pipelineTotalValue.toLocaleString("es-CR")}`}
            sub={`${pipelineTotalDeals} negocios`}
            loading={pipelineLoading || isLoading}
            accent
          />
          <KpiCard
            label="Tareas urgentes"
            value={highPriorityTasks}
            sub={`${taskList.length} pendientes`}
            loading={tasksLoading}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Conversations + Tasks */}
          <div className="space-y-6">
            <SectionCard title="Conversaciones recientes">
              {convList.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No hay conversaciones activas
                </div>
              ) : (
                <div>
                  {convList.slice(0, 5).map((conv: any) => (
                    <Link key={conv.id} href={`/inbox/${conv.id}`}>
                      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0 cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                          {conv.contact?.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground truncate">
                            {conv.contact?.full_name || "Sin nombre"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {conv.subject || "Sin asunto"}
                          </p>
                        </div>
                        {conv.updated_at && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {format(new Date(conv.updated_at), "HH:mm", {
                              locale: es,
                            })}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Tareas pendientes">
              {taskList.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No hay tareas pendientes
                </div>
              ) : (
                <div>
                  {taskList.slice(0, 5).map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          task.priority === "HIGH"
                            ? "bg-red-400"
                            : task.priority === "MEDIUM"
                            ? "bg-amber-400"
                            : "bg-white/[0.25]"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground truncate">
                          {task.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {task.department_name}
                        </p>
                      </div>
                      {task.due_date && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {format(new Date(task.due_date), "dd MMM", {
                            locale: es,
                          })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right: Pipeline + Invoices */}
          <div className="space-y-6">
            <SectionCard title="Pipeline de ventas">
              {activeStages.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Sin pipeline configurado.{" "}
                  <Link href="/pipeline" className="text-amber-400 hover:underline">
                    Crear etapas
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {activeStages.map((stage) => {
                    const dealCount = stage.deals.length;
                    const stageValue = stage.deals.reduce(
                      (sum, d) => sum + (Number(d.value) || 0),
                      0
                    );
                    const maxDeals = Math.max(
                      ...activeStages.map((s) => s.deals.length),
                      1
                    );
                    const barWidth = (dealCount / maxDeals) * 100;
                    return (
                      <div key={stage.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="text-[13px] font-medium text-foreground">
                              {stage.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-muted-foreground">
                              {dealCount} {dealCount === 1 ? "negocio" : "negocios"}
                            </span>
                            <span className="text-[13px] font-medium text-foreground tabular-nums">
                              ₡{stageValue.toLocaleString("es-CR")}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: stage.color,
                              opacity: dealCount > 0 ? 0.7 : 0.15,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Facturas por vencer">
              {overdueList.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Sin facturas pendientes
                </div>
              ) : (
                <div>
                  {overdueList.slice(0, 5).map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground truncate">
                          {inv.client_name || `Factura #${inv.id?.slice(0, 8)}`}
                        </p>
                        {inv.due_date && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Vence {format(new Date(inv.due_date), "dd MMM", { locale: es })}
                          </p>
                        )}
                      </div>
                      <span className="text-[13px] font-medium text-foreground tabular-nums shrink-0">
                        ₡{inv.amount?.toLocaleString("es-CR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
