import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import {
  TrendingUp, Receipt, CheckSquare, BarChart4, ChevronDown, Sparkles, ArrowRight,
  ShieldCheck, TriangleAlert, CircleAlert, Info, Plus, FileText, MessageCircle, Package,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import OnboardingTour from "@/components/shared/onboarding-tour";
import QuickStartChecklist from "@/components/shared/quick-start-checklist";

const STATUS_BG = "https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/statusBackground.png";

// ── Types ──
interface PipelineDealSummary { value: string | null; currency: string; }
interface PipelineStageSummary { id: string; name: string; color: string; deals: PipelineDealSummary[]; }
function sumPipelineValue(deals: PipelineDealSummary[]) { return deals.reduce((s, d) => { const n = d.value ? parseFloat(d.value) : 0; return isFinite(n) ? s + n : s; }, 0); }
function fmtMoney(n: number, cur: string) { return new Intl.NumberFormat("es-CR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); }
function timeAgo(date: string) { try { return formatDistanceToNowStrict(new Date(date), { addSuffix: true }); } catch { return ""; } }

// ── Clean revenue chart ──
function RevenueChart({ monthlyRevenue }: { monthlyRevenue: number }) {
  const W = 400, H = 90, PAD = 20;
  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthName = now.toLocaleString("es-CR", { month: "short" });
  const hasRevenue = monthlyRevenue > 0;
  const maxY = hasRevenue ? monthlyRevenue : 1;

  const todayX = PAD + ((today / daysInMonth) * (W - PAD * 2));
  const lineY = hasRevenue ? H - PAD - ((monthlyRevenue / maxY) * (H - PAD * 2)) : H - PAD;

  const pathD = `M ${PAD} ${lineY} L ${todayX} ${lineY}`;
  const areaD = `M ${PAD} ${H - PAD} L ${PAD} ${lineY} L ${todayX} ${lineY} L ${todayX} ${H - PAD} Z`;

  const fmtVal = (v: number) => v >= 1000000 ? `₡${(v / 1000000).toFixed(1)}M`
    : v >= 1000 ? `₡${(v / 1000).toFixed(1)}K`
    : `₡${Math.round(v)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="rfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.01"/>
        </linearGradient>
      </defs>

      {/* X axis */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="hsl(var(--border))" strokeWidth="0.5"/>
      {/* Y axis */}
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="hsl(var(--border))" strokeWidth="0.5"/>

      {/* Day labels */}
      <text x={PAD} y={H - 2} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5" textAnchor="middle">1</text>
      <text x={W - PAD} y={H - 2} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5" textAnchor="middle">{daysInMonth}</text>

      {hasRevenue ? (
        <>
          {/* Filled area + line */}
          <path d={areaD} fill="url(#rfill)"/>
          <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          {/* Today dot */}
          <circle cx={todayX} cy={lineY} r="3.5" fill="hsl(var(--primary))"/>
          <circle cx={todayX} cy={lineY} r="7" fill="hsl(var(--primary))" opacity="0.12"/>
          {/* Value label */}
          <text x={todayX} y={lineY - 10} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontWeight="600">
            {fmtVal(monthlyRevenue)}
          </text>
          <text x={todayX} y={H - 2} fill="hsl(var(--primary))" fontSize="8" fontWeight="500" textAnchor="middle">
            {monthName} {today}
          </text>
        </>
      ) : (
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" opacity="0.5">
          Track your first invoice to see revenue here.
        </text>
      )}
    </svg>
  );
}

// ── Insight styles ──
const INSIGHT_STYLES: Record<string, { Icon: any; color: string; bg: string }> = {
  danger:   { Icon: CircleAlert,    color: "hsl(var(--danger))",  bg: "bg-red-500/10" },
  warning:  { Icon: TriangleAlert, color: "hsl(var(--warning))", bg: "bg-amber-500/10" },
  positive: { Icon: ShieldCheck,   color: "hsl(var(--success))", bg: "bg-emerald-500/10" },
  info:     { Icon: Info,          color: "#818cf8",              bg: "bg-indigo-500/10" },
};

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { messages } = useI18n();
  const dash = messages.dashboard;
  const [activeTab, setActiveTab] = useState<"tasks" | "messages">("tasks");

  const { data: todayStats, isLoading: statsLoading } = useQuery({ queryKey: ["/api/workspaces/current/stats/today"], queryFn: api.getTodayStats, refetchInterval: 60000 });
  const { data: dashboard } = useQuery({ queryKey: ["/api/workspaces/current/dashboard"], queryFn: api.getDashboard, staleTime: 0, refetchOnMount: true, refetchInterval: 60000 });
  const workspaceStats = dashboard?.stats;
  const workspace = dashboard?.workspace;
  const { data: conversations, isLoading: convsLoading } = useQuery({ queryKey: ["/api/conversations", "dash"], queryFn: () => api.getConversations({ limit: "10" }) });
  const { data: tasks, isLoading: tasksLoading } = useQuery({ queryKey: ["/api/tasks", "dash"], queryFn: () => api.getTasks({ limit: "10" }) });
  const { data: overdueInvoices, isLoading: invoicesLoading } = useQuery({ queryKey: ["/api/invoices", "overdue-widget"], queryFn: () => api.getInvoices({ status: "OVERDUE", limit: "5" }), refetchInterval: 60000 });
  const { data: pipelineStagesData, isLoading: pipelineLoading } = useQuery({ queryKey: ["/api/pipeline/stages", "dash"], queryFn: () => api.getPipelineStages(), refetchInterval: 60000 });
  const { data: insights } = useQuery({ queryKey: ["/api/insights"], queryFn: api.getInsights, staleTime: 3 * 60 * 1000 });
  const { data: onboardStatus } = useQuery({ queryKey: ["onboarding-status"], queryFn: api.getOnboardingStatus, staleTime: 5 * 60 * 1000, retry: false });
  const { data: lowStock } = useQuery({ queryKey: ["low-stock-dash"], queryFn: api.getLowStock, refetchInterval: 120000, retry: false });
  const { data: pendingApprovals } = useQuery({ queryKey: ["pending-approvals"], queryFn: api.getPendingApprovals, refetchInterval: 30000, retry: false });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-approvals"] }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectInvoice(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-approvals"] }),
  });

  const approvalList: any[] = Array.isArray(pendingApprovals) ? pendingApprovals : [];

  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const invoiceList = Array.isArray(overdueInvoices) ? overdueInvoices : overdueInvoices?.data ?? [];
  const stageList: PipelineStageSummary[] = Array.isArray(pipelineStagesData) ? pipelineStagesData : pipelineStagesData?.data ?? [];
  const insightList: any[] = Array.isArray(insights) ? insights : [];

  const revenueChange = workspaceStats?.revenue_change_pct ?? 0;
  const hasPrevRevenue = (workspaceStats?.prev_month_revenue ?? 0) > 0;
  const revenueStr = hasPrevRevenue
    ? (revenueChange >= 0 ? `↑ ${revenueChange}%` : `↓ ${Math.abs(revenueChange)}%`)
    : (workspaceStats?.monthly_revenue > 0 ? "Primer mes" : "Sin datos");
  const revenueClass = hasPrevRevenue
    ? (revenueChange >= 0 ? "text-emerald-500" : "text-red-500")
    : "text-muted-foreground/60";
  const activeConvs = workspaceStats?.activeConversations ?? 0;
  const pipelineStatus = activeConvs > 0 ? dash.active : dash.empty;
  const stageRows = stageList.map(s => ({ id: s.id, name: s.name, color: s.color || "hsl(var(--primary))", dealCount: s.deals?.length ?? 0, totalValue: sumPipelineValue(s.deals ?? []), currency: s.deals?.find(d => d.currency)?.currency ?? "CRC" })).filter(s => s.dealCount > 0).slice(0, 5);
  const maxDeals = Math.max(...stageRows.map(s => s.dealCount), 1);
  const totalPipeline = stageRows.reduce((s, r) => s + r.totalValue, 0);
  const firstCurrency = stageRows[0]?.currency ?? "CRC";
  const overdueCount = invoiceList.length;
  const overdueAmount = invoiceList.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const urgentTasks = taskList.filter((t: any) => t.priority === "HIGH").length;

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? dash.morning : h < 19 ? dash.afternoon : dash.evening;
  };

  const monthName = new Date().toLocaleString("es-CR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-full bg-background">
      {/* Quick Start Checklist */}
      <div className="px-4 sm:px-6 pt-3 sm:pt-4">
        <QuickStartChecklist
          progress={workspace?.settings?.quick_start_progress ?? {}}
          plan={user?.workspace?.plan}
          onDismiss={() => {}}
        />
      </div>

      {/* Pending approvals */}
      {approvalList.length > 0 && (
        <div className="px-4 sm:px-6 pb-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-[15px] h-[15px] text-amber-400" />
              <h2 className="text-sm font-medium text-foreground">Facturas pendientes de aprobación</h2>
              <span className="text-[11px] text-muted-foreground">{approvalList.length}</span>
            </div>
            <div className="space-y-2">
              {approvalList.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{inv.number}</span>
                      <span className="text-[10px] text-muted-foreground">{inv.contact?.full_name || "—"}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Intl.NumberFormat("es-CR", { style: "currency", currency: inv.currency ?? "USD", maximumFractionDigits: 0 }).format(inv.amount ?? 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => rejectMut.mutate({ id: inv.id, reason: "Rechazada" })}
                      disabled={rejectMut.isPending}
                      className="h-6 px-2 text-[10px] rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                      Rechazar
                    </button>
                    <button
                      onClick={() => approveMut.mutate(inv.id)}
                      disabled={approveMut.isPending}
                      className="h-6 px-2 text-[10px] rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                      Aprobar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 pb-1">
        <DiagnosticButton module="dashboard" />
      </div>

      {/* ── Greeting + Summary Ribbon ── */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[18px] sm:text-[22px] font-medium text-foreground tracking-tight">{greeting()}, {user?.name?.split(" ")[0] || dash.unknownContact}</h1>
            <p className="text-[11px] sm:text-[13px] text-muted-foreground/60 mt-0.5">{dash.subtitle}</p>
          </div>
        </div>

        {/* Status banner with image */}
        <div className="relative rounded-md overflow-hidden border border-border/60 mb-4 min-h-[72px] sm:min-h-[88px]" style={{ backgroundImage: `url('${STATUS_BG}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 sm:py-5 relative h-full">
            <div className="flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary/80" />
            </div>
            <div className="flex items-center gap-3 sm:gap-6 flex-1 flex-wrap text-[11px] sm:text-[13px]">
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0"><span className="text-muted-foreground/60">{dash.revenue}</span><span className={`font-semibold ${revenueClass}`}>{revenueStr}</span><span className="text-muted-foreground/40 text-[10px] sm:text-[11px]">{dash.vsLastMonth}</span></div>
              <div className="w-px h-4 sm:h-5 bg-border/60 shrink-0" />
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0"><span className="text-muted-foreground/60">{overdueCount} {dash.invoices}</span><span className="font-semibold text-foreground/80">{dash.pending}</span></div>
              <div className="w-px h-4 sm:h-5 bg-border/60 shrink-0" />
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0"><span className="text-muted-foreground/60">{urgentTasks} {dash.tasks}</span><span className="font-semibold text-foreground/80">{dash.urgent}</span></div>
              <div className="w-px h-4 sm:h-5 bg-border/60 shrink-0" />
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0"><span className="text-muted-foreground/60">{dash.pipeline}</span><span className={`font-semibold ${activeConvs > 0 ? "text-emerald-500" : "text-muted-foreground/40"}`}>{pipelineStatus}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding prompt */}
      {onboardStatus && (!onboardStatus.exists || (onboardStatus.completed < (onboardStatus.total || 15))) && (
        <div className="px-4 sm:px-6 pb-1">
          <Link href="/onboarding">
            <div className="rounded-md border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent px-5 py-3 cursor-pointer hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🚀</span>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      {onboardStatus.exists ? "Continúa la configuración de tu empresa" : "Completa la configuración de tu empresa"}
                    </p>
                    {onboardStatus.exists && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-32 h-1 rounded-full bg-border/60 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(onboardStatus.completed / (onboardStatus.total || 1)) * 100}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{onboardStatus.completed} de {onboardStatus.total || 15}</span>
                      </div>
                    )}
          </div>

          {/* Low Stock Alert */}
          {Array.isArray(lowStock) && lowStock.length > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-[15px] h-[15px] text-amber-400" />
                <h2 className="text-sm font-medium text-foreground">Stock Bajo</h2>
              </div>
              <div className="space-y-2">
                {lowStock.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[140px]">{p.name}</span>
                    <span className="text-amber-400 font-medium">
                      {p.current_stock} / {p.min_stock} {p.unit_of_measure || "uds"}
                    </span>
                  </div>
                ))}
              </div>
              <Link href="/inventory">
                <span className="text-[11px] text-primary hover:text-primary/80 mt-3 inline-block cursor-pointer">Ver inventario →</span>
              </Link>
            </div>
          )}
        </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── 2-Column Grid ── */}
      <div className="px-4 sm:px-6 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* ── Left: Revenue + Today (8 col) ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* Revenue Overview */}
          <div className="rounded-md border border-border/60 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-foreground">{dash.revenueOverview}</h2>
                <span className="text-[11px] text-muted-foreground/50">{monthName}</span>
              </div>
            </div>
            <div className="flex items-end gap-6">
              <div className="shrink-0">
                <p className="text-[28px] font-medium text-foreground tracking-tight leading-none">₡{(workspaceStats?.monthly_revenue ?? 0).toLocaleString("es-ES")}</p>
                <p className={`text-[13px] mt-1 ${revenueClass}`}>{workspaceStats?.revenue_change_pct ?? 0}% {dash.vsLastMonth}</p>
              </div>
              <div className="flex-1 h-[80px]">
                <RevenueChart monthlyRevenue={workspaceStats?.monthly_revenue ?? 0} />
              </div>
            </div>
          </div>

          {/* Today: Tasks + Messages */}
          <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
            <div className="flex items-center border-b border-border/60">
              {(["tasks", "messages"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-[13px] font-medium transition-colors relative ${activeTab === tab ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>
                  {tab === "tasks" ? dash.tasks : dash.newMessages}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />}
                </button>
              ))}
            </div>
            <div className="divide-y divide-border/60">
              {activeTab === "tasks" ? (
                taskList.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[13px] text-muted-foreground/50">{dash.noTasks}</div>
                ) : taskList.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-border/60 cursor-pointer hover:border-primary/50 transition-colors shrink-0" />
                    <span className="flex-1 text-[13px] text-foreground truncate">{task.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
            task.priority === "HIGH" ? "bg-red-500/10 text-red-500 border-red-500/20" :
            task.priority === "MEDIUM" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
            "bg-slate-500/10 text-slate-500 border-slate-500/20"
                    }`}>
                      {task.priority === "HIGH" ? dash.high : task.priority === "MEDIUM" ? dash.medium : dash.low}
                    </span>
                    {task.due_date && <span className="text-[11px] text-muted-foreground">{format(new Date(task.due_date), "MMM d", { locale: es })}</span>}
                  </div>
                ))
              ) : (
                convList.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[13px] text-muted-foreground/50">{dash.noMessagesToday}</div>
                ) : convList.slice(0, 5).map((conv: any) => (
                  <Link key={conv.id} href={`/inbox/${conv.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-foreground/[0.02] transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                        {conv.contact?.full_name?.charAt(0) || "?"}
                      </div>
                      <span className="flex-1 text-[13px] text-foreground truncate">{conv.contact?.full_name || dash.unknownContact}</span>
                      <span className="text-[11px] text-muted-foreground/50">{conv.updated_at && format(new Date(conv.updated_at), "HH:mm")}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="px-5 py-2.5 border-t border-border/60 text-right">
              <Link href={activeTab === "tasks" ? "/tasks" : "/inbox"} className="text-[12px] text-primary hover:text-primary/80 font-medium">
                {activeTab === "tasks" ? dash.viewAllTasks : dash.viewAll} <ArrowRight className="w-3 h-3 inline ml-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right: Pipeline + Activity + Insights + Quick Actions (4 col) ── */}
        <div className="lg:col-span-4 space-y-5">
          {/* Pipeline */}
          <div className="rounded-md border border-border/60 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-foreground">{dash.pipelineOverview}</h2>
              <Link href="/pipeline" className="text-[11px] text-primary hover:text-primary/80">{dash.viewPipeline} →</Link>
            </div>
            {pipelineLoading ? <Skeleton className="h-16 w-full" /> : stageRows.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-[13px] text-muted-foreground/70">You don't have any opportunities yet.</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Create your first opportunity to track potential deals.</p>
                <Link href="/pipeline"><button className="mt-3 text-[12px] px-4 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors">{dash.newOpportunity}</button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stageRows.map(stage => (
                  <div key={stage.id} className="space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-foreground/80">{stage.name}</span>
                      <span className="text-muted-foreground">{stage.dealCount} {dash.deals} · {stage.totalValue > 0 ? fmtMoney(stage.totalValue, stage.currency) : "—"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max((stage.dealCount / maxDeals) * 100, 8)}%`, backgroundColor: stage.color }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border/60 flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{dash.totalPipelineValue}</span>
                  <span className="font-medium text-foreground">{fmtMoney(totalPipeline, firstCurrency)}</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Insights */}
          <div className="rounded-md border border-border/60 bg-card/40 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-[15px] h-[15px] text-primary" />
              <h2 className="text-sm font-medium text-foreground">{dash.aiInsights}</h2>
            </div>
            <div className="space-y-3">
              {(insightList.length === 0 ? [
                { severity: "positive", title: dash.insightNoAlerts, desc: dash.insightNoAlertsDesc },
                { severity: "warning", title: `${overdueCount} ${dash.insightAlertsInvoices}`, desc: dash.insightAlertsDesc },
                { severity: "info", title: dash.insightFollowUp, desc: dash.insightFollowUpDesc },
              ] : insightList.slice(0, 3).map((ins: any) => ({ severity: ins.severity, title: ins.title, desc: ins.suggestion })))
                .map((ins, i) => {
                  const st = INSIGHT_STYLES[ins.severity] ?? INSIGHT_STYLES.info;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${st.bg}`}>
                        <st.Icon className="w-3.5 h-3.5" style={{ color: st.color }} />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{ins.title}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{ins.desc}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-md border border-border/60 bg-card/40 p-5">
            <h2 className="text-sm font-medium text-foreground mb-4">{dash.quickActions}</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: dash.newInvoice, href: "/invoices", Icon: Receipt },
                { label: dash.addContact, href: "/contacts", Icon: Plus },
                { label: dash.newOpportunity, href: "/pipeline", Icon: BarChart4 },
                { label: dash.sendMessage, href: "/inbox", Icon: MessageCircle },
                { label: dash.uploadDocument, href: "/documents", Icon: FileText },
                { label: dash.automation, href: "/automations", Icon: Sparkles },
              ].map(({ label, href, Icon }) => (
                <Link key={label} href={href}>
                  <div className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-lg hover:bg-foreground/[0.03] transition-colors cursor-pointer">
                    <Icon className="w-[16px] h-[16px] text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground/70 text-center leading-tight">{label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <OnboardingTour />
    </div>
  );
}
