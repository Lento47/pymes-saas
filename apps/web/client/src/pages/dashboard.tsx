import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  TrendingUp, Receipt, CheckSquare, BarChart4, ChevronDown, Sparkles, ArrowRight,
  ShieldCheck, TriangleAlert, CircleAlert, Info, Plus, FileText, MessageCircle,
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 400, H = 80;
  const now = new Date();
  const points = 30;
  const monthName = now.toLocaleString("es-CR", { month: "short" });
  const today = now.getDate();

  const ys = Array.from({ length: points }, (_, i) => {
    const progress = (i + 1) / points;
    const val = progress * (monthlyRevenue || 1);
    const noise = Math.sin(i * 0.4) * (monthlyRevenue || 1) * 0.05;
    return H - Math.max(5, Math.min(H - 3, ((val + noise) / (monthlyRevenue || 1)) * H * 0.7 + H * 0.2));
  });
  const xs = ys.map((_, i) => (i / (points - 1)) * W);
  const activeIdx = hoverIdx ?? Math.min(today - 1, points - 1);

  const pathD = `M ${xs[0]} ${ys[0]} ` + xs.slice(1).map((x, i) => `L ${x} ${ys[i + 1]}`).join(" ");
  const areaD = pathD + ` L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full"
      onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoverIdx(Math.round(((e.clientX - rect.left) / rect.width) * (points - 1))); }}
      onMouseLeave={() => setHoverIdx(null)}>
      <defs><linearGradient id="rfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.01" /></linearGradient></defs>
      {monthlyRevenue === 0 ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" opacity="0.5">Track your first invoice to see revenue here.</text>
      ) : (
        <>
          <path d={areaD} fill="url(#rfill)" />
          <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={xs[activeIdx]} cy={ys[activeIdx]} r="3" fill="hsl(var(--primary))" />
          {hoverIdx !== null && (
            <text x={Math.min(W - 35, Math.max(35, xs[activeIdx]))} y={Math.max(14, ys[activeIdx] - 8)} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontWeight="500">
              {monthName} {Math.round((activeIdx / points) * 30) || 1}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

// ── Insight styles ──
const INSIGHT_STYLES: Record<string, { Icon: any; color: string; bg: string }> = {
  danger:   { Icon: CircleAlert,    color: "#ef4444", bg: "bg-red-500/10 dark:bg-red-500/[0.12]" },
  warning:  { Icon: TriangleAlert, color: "#f59e0b", bg: "bg-amber-500/10 dark:bg-amber-500/[0.12]" },
  positive: { Icon: ShieldCheck,   color: "#22c55e", bg: "bg-emerald-500/10 dark:bg-emerald-500/[0.12]" },
  info:     { Icon: Info,          color: "#818cf8", bg: "bg-indigo-500/10 dark:bg-indigo-500/[0.12]" },
};

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { messages } = useI18n();
  const dash = messages.dashboard;
  const [activeTab, setActiveTab] = useState<"tasks" | "messages">("tasks");

  const { data: todayStats, isLoading: statsLoading } = useQuery({ queryKey: ["/api/workspaces/current/stats/today"], queryFn: api.getTodayStats, refetchInterval: 60000 });
  const { data: workspaceStats } = useQuery({ queryKey: ["/api/workspaces/current/stats"], queryFn: api.getWorkspaceStats, refetchInterval: 60000 });
  const { data: conversations, isLoading: convsLoading } = useQuery({ queryKey: ["/api/conversations", "dash"], queryFn: () => api.getConversations({ limit: "10" }) });
  const { data: tasks, isLoading: tasksLoading } = useQuery({ queryKey: ["/api/tasks", "dash"], queryFn: () => api.getTasks({ limit: "10" }) });
  const { data: overdueInvoices, isLoading: invoicesLoading } = useQuery({ queryKey: ["/api/invoices", "overdue-widget"], queryFn: () => api.getInvoices({ status: "OVERDUE", limit: "5" }), refetchInterval: 60000 });
  const { data: pipelineStagesData, isLoading: pipelineLoading } = useQuery({ queryKey: ["/api/pipeline/stages", "dash"], queryFn: () => api.getPipelineStages(), refetchInterval: 60000 });
  const { data: insights } = useQuery({ queryKey: ["/api/insights"], queryFn: api.getInsights, staleTime: 3 * 60 * 1000 });

  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const invoiceList = Array.isArray(overdueInvoices) ? overdueInvoices : overdueInvoices?.data ?? [];
  const stageList: PipelineStageSummary[] = Array.isArray(pipelineStagesData) ? pipelineStagesData : pipelineStagesData?.data ?? [];
  const insightList: any[] = Array.isArray(insights) ? insights : [];

  const revenueChange = workspaceStats?.revenue_change_pct ?? 0;
  const revenueStr = revenueChange >= 0 ? `↑ ${revenueChange}%` : `↓ ${Math.abs(revenueChange)}%`;
  const revenueClass = revenueChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
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
          progress={workspaceStats?.settings?.quick_start_progress ?? {}}
          onDismiss={() => {}}
        />
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
        <div className="relative rounded-xl overflow-hidden border border-border/60 mb-4" style={{ backgroundImage: `url('${STATUS_BG}')`, backgroundSize: "cover", backgroundPosition: "center right" }}>
          <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 relative">
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
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0"><span className="text-muted-foreground/60">{dash.pipeline}</span><span className={`font-semibold ${activeConvs > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40"}`}>{pipelineStatus}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2-Column Grid ── */}
      <div className="px-4 sm:px-6 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* ── Left: Revenue + Today (8 col) ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* Revenue Overview */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
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
          <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
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
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${task.priority === "HIGH" ? "bg-red-500/10 text-red-600 dark:text-red-400" : task.priority === "MEDIUM" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-slate-500/10 text-slate-600 dark:text-slate-400"}`}>
                      {task.priority === "HIGH" ? dash.high : task.priority === "MEDIUM" ? dash.medium : dash.low}
                    </span>
                    {task.due_date && <span className="text-[11px] text-muted-foreground/50">{format(new Date(task.due_date), "MMM d", { locale: es })}</span>}
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
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
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
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
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
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
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
