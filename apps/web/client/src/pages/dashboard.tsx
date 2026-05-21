import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Sparkles, Loader2 } from "lucide-react";

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

// ── KPI inline ───────────────────────────────────────────────────────────────

function KpiInline({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center px-3 py-2">
      <div className="text-lg font-semibold text-foreground tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

// ── Pipeline strip ───────────────────────────────────────────────────────────

function PipelineStrip({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  const maxDeals = Math.max(...stages.map((s) => s.deals.length), 1);

  return (
    <div className="flex gap-1.5">
      {stages.map((stage) => {
        const count = stage.deals.length;
        const value = stage.deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
        return (
          <div key={stage.id} className="flex-1 min-w-0 rounded-md border border-border bg-card dash-card px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              <span className="text-[11px] font-medium text-foreground truncate">{stage.name}</span>
            </div>
            <div className="text-lg font-semibold text-foreground tabular-nums leading-none">{count}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(count / maxDeals) * 100}%`, backgroundColor: stage.color, opacity: count > 0 ? 0.7 : 0.15 }} />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{crc(value)}</span>
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

  // AI Summary
  const { data: todaySummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/summaries/daily/today"],
    queryFn: () => api.getTodaySummary().catch(() => null),
    retry: false,
    staleTime: 300000,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateSummary(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/summaries/daily/today"] });
    },
  });

  // Business data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats"],
    queryFn: () => api.getWorkspaceStats(),
    refetchInterval: 120000,
  });

  const { data: todayStats } = useQuery({
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
  const pipelineStages: PipelineStage[] = Array.isArray(pipeline) ? pipeline : [];
  const activeStages = pipelineStages.filter((s) => !ACTIVE_STAGES.includes(s.name));
  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const allInvoices: any[] = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data ?? [];
  const outstandingInvoices = allInvoices.filter((inv: any) =>
    ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status ?? inv.collection_state)
  );
  const upcomingInvoices = [...outstandingInvoices].sort(
    (a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  const pipelineTotalDeals = activeStages.reduce((s, st) => s + st.deals.length, 0);
  const pipelineTotalValue = activeStages.reduce((s, st) => s + st.deals.reduce((ss, d) => ss + (Number(d.value) || 0), 0), 0);
  const totalOutstanding = outstandingInvoices.reduce((s: number, inv: any) => s + (Number(inv.balance_due ?? inv.amount) || 0), 0);
  const urgentTasks = taskList.filter((t: any) => t.priority === "HIGH").length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const isLoading = statsLoading;

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 py-5 max-w-4xl mx-auto space-y-5">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-foreground tracking-[-0.3px]">
              {greeting()},{" "}
              <span className="font-medium">{user?.name?.split(" ")[0] || "Usuario"}</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => void generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {todaySummary?.generated_text ? "Regenerar" : "Generar resumen IA"}
          </Button>
        </div>

        {/* AI Brief or fallback */}
        {summaryLoading || isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : todaySummary?.generated_text ? (
          <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.04] dash-card p-4">
            <p className="text-sm leading-relaxed text-foreground">
              {todaySummary.generated_text}
            </p>
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              Generado por IA · {format(new Date(todaySummary.summary_date || todaySummary.created_at), "d MMM", { locale: es })}
            </div>
          </div>
        ) : generateMutation.isPending ? (
          <div className="rounded-lg border border-border bg-card dash-card p-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Generando resumen con IA...</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card dash-card p-4">
            <p className="text-sm text-muted-foreground">
              Tocá <span className="text-foreground font-medium">"Generar resumen IA"</span> para obtener un briefing diario de tu negocio.
            </p>
          </div>
        )}

        {/* KPI Strip */}
        {!isLoading && (
          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="flex divide-x divide-border">
              <div className="flex-1"><KpiInline label="Ingresos del mes" value={crc(s.monthly_revenue || 0)} sub={s.monthly_revenue > 0 ? undefined : "Sin ingresos"} /></div>
              <div className="flex-1"><KpiInline label="Por cobrar" value={crc(totalOutstanding)} sub={`${outstandingInvoices.length} facturas`} /></div>
              <div className="flex-1"><KpiInline label="Pipeline" value={String(pipelineTotalDeals)} sub={pipelineTotalDeals > 0 ? crc(pipelineTotalValue) : "Sin negocios"} /></div>
              <div className="flex-1"><KpiInline label="Mensajes hoy" value={String(t.received_messages || 0)} sub={urgentTasks > 0 ? `${urgentTasks} urgentes` : undefined} /></div>
            </div>
          </div>
        )}

        {/* Pipeline strip */}
        {!pipelineLoading && activeStages.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground mb-2.5">Pipeline</h2>
            <PipelineStrip stages={activeStages} />
          </div>
        )}

        {/* Two columns: Tasks + Invoices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">Tareas</h2>
            </div>
            {taskList.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-muted-foreground">Todo al día</div>
            ) : (
              taskList.slice(0, 8).map((task: any) => (
                <div key={task.id} className="flex items-center gap-2.5 px-4 py-2 border-b border-border last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.priority === "HIGH" ? "bg-red-500" : task.priority === "MEDIUM" ? "bg-amber-500" : "bg-border"}`} />
                  <span className="text-[13px] text-foreground truncate flex-1">{task.title}</span>
                  {task.due_date && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">Facturas por cobrar</h2>
            </div>
            {upcomingInvoices.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-muted-foreground">Sin facturas pendientes</div>
            ) : (
              upcomingInvoices.slice(0, 8).map((inv: any) => {
                const due = new Date(inv.due_date);
                const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                const isOverdue = days < 0;
                const isSoon = days >= 0 && days <= 3;
                return (
                  <div key={inv.id} className="flex items-center gap-2.5 px-4 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground truncate">{inv.client_name || `Factura #${inv.id?.slice(0, 8)}`}</p>
                      <p className={`text-[11px] ${isOverdue ? "text-red-500" : isSoon ? "text-amber-500" : "text-muted-foreground"}`}>
                        {isOverdue ? `Vencida ${formatDistanceToNow(due, { addSuffix: true, locale: es })}` : `Vence ${formatDistanceToNow(due, { addSuffix: true, locale: es })}`}
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

        {/* Activity */}
        {convList.length > 0 && (
          <div className="rounded-lg border border-border bg-card dash-card">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">Actividad reciente</h2>
            </div>
            {convList.slice(0, 5).map((conv: any) => (
              <Link key={conv.id} href={`/inbox/${conv.id}`}>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shrink-0">
                    {conv.contact?.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground">{conv.contact?.full_name || "Sin nombre"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{conv.subject || "Sin asunto"}</p>
                  </div>
                  {conv.updated_at && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: es })}
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
