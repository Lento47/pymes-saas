import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Plus, ArrowRight, Activity, Bell, Search,
  Users, CheckSquare, FileText, MessageCircle, TrendingUp,
  Receipt, Zap, BarChart2, Clock, ChevronDown, Sparkles,
  CheckCircle2, AlertTriangle, AlertCircle, Info, UserPlus,
  KanbanSquare,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_BG = "https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/statusBackground.png";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PipelineDealSummary { value: string | null; currency: string; }
interface PipelineStageSummary { id: string; name: string; color: string; deals: PipelineDealSummary[]; }

function sumPipelineValue(deals: PipelineDealSummary[]) {
  return deals.reduce((s, d) => { const n = d.value ? parseFloat(d.value) : 0; return isFinite(n) ? s + n : s; }, 0);
}
function fmtMoney(n: number, cur: string) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}
function timeAgo(date: string) {
  try { return formatDistanceToNowStrict(new Date(date), { addSuffix: true }); }
  catch { return ""; }
}

// ── Revenue area chart ────────────────────────────────────────────────────────
function RevenueChart() {
  const W = 500, H = 110;
  // Decorative upward-trending line (placeholder shape)
  const ys = [95, 88, 91, 82, 78, 74, 70, 65, 60, 68, 55, 50, 44, 38, 30];
  const xs = ys.map((_, i) => (i / (ys.length - 1)) * W);
  // Smooth bezier path
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`;
  // Tooltip dot at ~80% of the way (May 22)
  const dotIdx = 11;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 140 }}>
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Y-axis guide lines */}
      {[25, 50, 75, 100].map(y => (
        <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#rev-fill)" />
      <path d={d} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Tooltip dot */}
      <circle cx={xs[dotIdx]} cy={ys[dotIdx]} r="5" fill="#6366f1" />
      <circle cx={xs[dotIdx]} cy={ys[dotIdx]} r="9" fill="#6366f1" fillOpacity="0.15" />
      {/* Tooltip box */}
      <rect x={xs[dotIdx] - 36} y={ys[dotIdx] - 32} width="72" height="24" rx="6" fill="#1e1b4b" />
      <text x={xs[dotIdx]} y={ys[dotIdx] - 16} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">May 22 · €4,560</text>
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, currency, subLabel, icon: Icon, iconBg, loading }: {
  label: string; value: any; currency?: string; subLabel?: string;
  icon: any; iconBg: string; loading?: boolean;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-100 p-5 hover:shadow-md transition-shadow"
      style={{ backgroundImage: `url('${STATUS_BG}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-white/[0.88] rounded-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? <Skeleton className="h-7 w-20" /> : (
          <>
            <p className="text-2xl font-bold text-gray-900">
              {currency}{typeof value === "number" ? value.toLocaleString("es-ES") : value}
            </p>
            {subLabel && <p className="text-xs text-gray-400 mt-1">{subLabel}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    HIGH:   "bg-red-100 text-red-600",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW:    "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[priority] ?? map.LOW}`}>
      {labels[priority] ?? priority}
    </span>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Card({ title, linkTo, linkLabel, headerExtra, loading, empty, children }: {
  title?: string; linkTo?: string; linkLabel?: string; headerExtra?: React.ReactNode;
  loading?: boolean; empty?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {(title || linkTo || headerExtra) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <div className="flex items-center gap-2">
            {headerExtra}
            {linkTo && (
              <Link href={linkTo}>
                <a className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium">
                  {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </Link>
            )}
          </div>
        </div>
      )}
      {loading
        ? <div className="px-5 py-4 space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-4 w-full" />)}</div>
        : empty
        ? <div className="px-5 py-8 text-center text-sm text-gray-400">No data yet</div>
        : <div>{children}</div>
      }
    </div>
  );
}

// ── Insight severity → visual ─────────────────────────────────────────────────
const INSIGHT_STYLES: Record<string, { Icon: any; ring: string; iconColor: string; bg: string }> = {
  danger:   { Icon: AlertCircle,  ring: "#ef4444", iconColor: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  warning:  { Icon: AlertTriangle,ring: "#f59e0b", iconColor: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  positive: { Icon: CheckCircle2, ring: "#22c55e", iconColor: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  info:     { Icon: Info,         ring: "#818cf8", iconColor: "#818cf8", bg: "rgba(129,140,248,0.12)" },
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"tasks" | "messages">("tasks");

  const { data: todayStats,       isLoading: statsLoading    } = useQuery({ queryKey: ["/api/workspaces/current/stats/today"], queryFn: api.getTodayStats, refetchInterval: 60000 });
  const { data: workspaceStats } = useQuery({ queryKey: ["/api/workspaces/current/stats"], queryFn: api.getWorkspaceStats, refetchInterval: 60000 });
  const { data: conversations,    isLoading: convsLoading    } = useQuery({ queryKey: ["/api/conversations", "dash"],           queryFn: () => api.getConversations({ limit: "10" }) });
  const { data: tasks,            isLoading: tasksLoading    } = useQuery({ queryKey: ["/api/tasks", "dash"],                   queryFn: () => api.getTasks({ limit: "10" }) });
  const { data: overdueInvoices,  isLoading: invoicesLoading } = useQuery({ queryKey: ["/api/invoices", "overdue-widget"],      queryFn: () => api.getInvoices({ status: "OVERDUE", limit: "5" }), refetchInterval: 60000 });
  const { data: pipelineStagesData, isLoading: pipelineLoading } = useQuery({ queryKey: ["/api/pipeline/stages", "dash"],       queryFn: () => api.getPipelineStages(), refetchInterval: 60000 });
  const { data: insights } = useQuery({ queryKey: ["/api/insights"], queryFn: api.getInsights, staleTime: 3 * 60 * 1000 });

  // Parsed lists
  const convList    = Array.isArray(conversations)   ? conversations   : conversations?.data   ?? [];
  const taskList    = Array.isArray(tasks)            ? tasks           : tasks?.data           ?? [];
  const invoiceList = Array.isArray(overdueInvoices)  ? overdueInvoices : overdueInvoices?.data ?? [];
  const stageList: PipelineStageSummary[] = Array.isArray(pipelineStagesData) ? pipelineStagesData : pipelineStagesData?.data ?? [];
  const insightList: any[] = Array.isArray(insights) ? insights : [];

  const revenueChange = workspaceStats?.revenue_change_pct ?? 0;
  const revenueStr = revenueChange >= 0 ? `↑ ${revenueChange}%` : `↓ ${Math.abs(revenueChange)}%`;
  const revenueClass = revenueChange >= 0 ? "text-green-500" : "text-red-500";
  const activeConvs = workspaceStats?.activeConversations ?? 0;
  const pipelineStatus = activeConvs > 0 ? "Active" : "Empty";
  const stageRows = stageList
    .map(s => ({ id: s.id, name: s.name, color: s.color || "#6366F1", dealCount: s.deals?.length ?? 0, totalValue: sumPipelineValue(s.deals ?? []), currency: s.deals?.find(d => d.currency)?.currency ?? "CRC" }))
    .filter(s => s.dealCount > 0).slice(0, 5);
  const maxDeals    = Math.max(...stageRows.map(s => s.dealCount), 1);
  const totalPipeline = stageRows.reduce((s, r) => s + r.totalValue, 0);
  const firstCurrency = stageRows[0]?.currency ?? "CRC";

  // Derived counts
  const overdueCount  = invoiceList.length;
  const overdueAmount = invoiceList.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const urgentTasks   = taskList.filter((t: any) => t.priority === "HIGH").length;
  const pipelineDeals = stageList.reduce((s, st) => s + (st.deals?.length ?? 0), 0);

  // AI banner
  const _insightSummary = insightList.slice(0, 3).map((i: any) => `${i.severity}: ${i.title}`).join("; ");
  const aiPromptReady   = !statsLoading && !tasksLoading && !invoicesLoading && !pipelineLoading;
  const { data: bannerAI } = useQuery({
    queryKey: ["/api/ai/banner", overdueCount, urgentTasks, pipelineDeals, _insightSummary],
    queryFn: () => api.askAssistant(
      `You are a smart business assistant. Write exactly 2 short lines for a dashboard status banner: ` +
      `Line 1: a title (max 6 words, friendly tone). Line 2: a subtitle (max 12 words, actionable). ` +
      `Reply in this exact format: TITLE|||SUBTITLE — no markdown, no extra text. ` +
      `Business snapshot: overdue invoices=${overdueCount}, urgent tasks=${urgentTasks}, pipeline deals=${pipelineDeals}, monthly revenue trend=+18%. ` +
      `Alerts: ${_insightSummary || "none"}.`
    ),
    enabled: aiPromptReady,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const [bannerTitle, bannerSubtitle] = (() => {
    const raw: string = bannerAI?.reply ?? "";
    const parts = raw.split("|||");
    return (parts.length === 2 && parts[0].trim() && parts[1].trim())
      ? [parts[0].trim(), parts[1].trim()]
      : ["Everything looks good today", "Your business is on track. Keep going! ✨"];
  })();

  // Activity feed: merge conversations + invoices sorted by date
  const activityItems = [
    ...convList.slice(0, 3).map((c: any) => ({
      id: `c-${c.id}`, type: "message" as const,
      title: `New message from ${c.contact?.full_name || "Unknown"}`,
      sub: c.subject || "No subject",
      date: c.updated_at, amount: null,
    })),
    ...invoiceList.slice(0, 2).map((i: any) => ({
      id: `i-${i.id}`, type: "invoice" as const,
      title: `Invoice #${i.id?.slice(0, 8)} overdue`,
      sub: i.client_name || "Client",
      date: i.due_date, amount: i.amount,
    })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 5);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening";
  };

  return (
    <div className="min-h-full" style={{ background: "#F4F5F9" }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="px-3 md:px-8 pt-4 md:pt-7 pb-5 flex items-start justify-between max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user?.name?.split(" ")[0] || "Usuario"} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bannerSubtitle || "Here's what's happening with your business today."}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-400 min-w-[220px]">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Search in PymesHub...</span>
            <span className="text-xs text-gray-300 font-mono hidden md:inline">⌘ K</span>
          </div>
          <button className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-3 md:px-8 pb-8 max-w-[1400px] mx-auto space-y-4">

        {/* ── Status banner ───────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-gray-100"
          style={{ backgroundImage: `url('${STATUS_BG}')`, backgroundSize: "cover", backgroundPosition: "center right", minHeight: 96 }}>
          <div className="flex items-center gap-6 px-7 py-5">
            <div className="w-14 h-14 rounded-2xl bg-white/75 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-sm">
              <Activity className="w-7 h-7 text-indigo-500" />
            </div>
            <div className="flex-shrink-0 min-w-[220px]">
              {!bannerAI && aiPromptReady ? (
                <><div className="h-5 w-48 rounded bg-gray-200/70 animate-pulse mb-1.5" /><div className="h-3.5 w-56 rounded bg-gray-200/50 animate-pulse" /></>
              ) : (
                <><h2 className="text-[17px] font-bold text-gray-900 leading-snug">{bannerTitle}</h2><p className="text-sm text-gray-500 mt-0.5">{bannerSubtitle}</p></>
              )}
            </div>
            <div className="h-12 w-px bg-gray-300/60 mx-2 flex-shrink-0" />
            <div className="flex items-center gap-6 flex-1 overflow-x-auto scroll-snap-x-mandatory -mx-4 px-4">
              {[
                { bg: "linear-gradient(135deg,#6366f1,#818cf8)", Icon: TrendingUp, label: "Revenue", value: revenueStr, sub: "vs last month", valueClass: revenueClass },
                { bg: "linear-gradient(135deg,#0ea5e9,#38bdf8)", Icon: Receipt, label: `${overdueCount} Invoices`, value: "Pending", sub: "", valueClass: "text-gray-800" },
                { bg: "linear-gradient(135deg,#64748b,#94a3b8)", Icon: CheckSquare, label: `${urgentTasks} Tasks`, value: "Urgent", sub: "", valueClass: "text-gray-800" },
                { bg: "linear-gradient(135deg,#7c3aed,#a78bfa)", Icon: BarChart2, label: "Pipeline", value: pipelineStatus, sub: "", valueClass: activeConvs > 0 ? "text-green-500" : "text-gray-400" },
              ].map(({ bg, Icon, label, value, sub, valueClass }, i, arr) => (
                <div key={label} className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{label}</p>
                      <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
                      {sub && <p className="text-xs text-gray-400">{sub}</p>}
                    </div>
                  </div>
                  {i < arr.length - 1 && <div className="h-10 w-px bg-gray-200/70 ml-3" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Metric cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard label="Revenue this month" value={todayStats?.monthly_revenue ?? 0}  currency="€" subLabel="↑ 18.6% vs. last month"                                   icon={TrendingUp}  iconBg="bg-indigo-100 text-indigo-600" loading={statsLoading} />
          <MetricCard label="Outstanding"        value={overdueAmount}                      currency="€" subLabel={`${overdueCount} invoices pending`}                         icon={Receipt}     iconBg="bg-orange-100 text-orange-500" loading={invoicesLoading} />
          <MetricCard label="Pipeline value"     value={totalPipeline}                      currency="€" subLabel="Potential revenue"                                          icon={BarChart2}   iconBg="bg-blue-100 text-blue-500"     loading={pipelineLoading} />
          <MetricCard label="New messages"       value={todayStats?.new_messages ?? 0}                   subLabel={todayStats?.new_messages ? `${todayStats.new_messages} unread` : "No unread messages"} icon={MessageCircle} iconBg="bg-purple-100 text-purple-500" loading={statsLoading} />
          <MetricCard label="Tasks today"        value={taskList.length}                                 subLabel={taskList.length === 0 ? "You're all caught up" : `${urgentTasks} urgent`}             icon={Clock}         iconBg="bg-teal-100 text-teal-500"     loading={tasksLoading} />
        </div>

        {/* ── Main grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── Left col: Revenue + Tasks/Messages (5) ── */}
          <div className="lg:col-span-5 space-y-4">

            {/* Revenue overview */}
            <Card title="Revenue overview"
              headerExtra={
                <button className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition font-medium">
                  This month <ChevronDown className="w-3 h-3" />
                </button>
              }
            >
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-gray-900">€{(todayStats?.monthly_revenue ?? 0).toLocaleString("es-ES")}</span>
                  <span className="text-sm text-green-500 font-medium">↑ 18.6% vs. last month</span>
                </div>
                <RevenueChart />
                <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                  {["May 1", "May 8", "May 15", "May 22", "May 29"].map(d => <span key={d}>{d}</span>)}
                </div>
              </div>
            </Card>

            {/* Tasks / Messages */}
            <Card
              linkTo={activeTab === "tasks" ? "/tasks" : "/inbox"}
              linkLabel={activeTab === "tasks" ? "View all tasks →" : "View all →"}
              headerExtra={
                <div className="flex gap-0.5 border-b border-transparent">
                  {(["tasks", "messages"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium transition capitalize ${
                        activeTab === tab ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"
                      }`}>
                      {tab === "tasks" ? "Tasks" : "Messages"}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="divide-y divide-gray-50">
                {activeTab === "tasks" ? (
                  taskList.length === 0
                    ? <p className="px-5 py-6 text-sm text-center text-gray-400">No tasks yet</p>
                    : taskList.slice(0, 5).map((task: any) => (
                        <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-indigo-600" />
                          <p className="flex-1 text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <PriorityBadge priority={task.priority} />
                          {task.due_date && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {format(new Date(task.due_date), "MMM d", { locale: es })}
                            </span>
                          )}
                        </div>
                      ))
                ) : (
                  convList.length === 0
                    ? <p className="px-5 py-6 text-sm text-center text-gray-400">No messages yet</p>
                    : convList.slice(0, 5).map((conv: any) => (
                        <Link key={conv.id} href={`/inbox/${conv.id}`}>
                          <a className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
                              {conv.contact?.full_name?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{conv.contact?.full_name || "Unknown"}</p>
                              <p className="text-xs text-gray-400 truncate">{conv.subject || "No subject"}</p>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{conv.updated_at && format(new Date(conv.updated_at), "HH:mm")}</span>
                          </a>
                        </Link>
                      ))
                )}
              </div>
            </Card>
          </div>

          {/* ── Middle col: Pipeline + Recent activity (4) ── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Pipeline overview */}
            <Card title="Pipeline overview" linkTo="/pipeline" linkLabel="View pipeline →" loading={pipelineLoading} empty={!pipelineLoading && stageRows.length === 0}>
              <div className="px-5 py-4 space-y-3.5">
                {stageRows.map(stage => (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-800">{stage.name}</span>
                          <span className="text-xs text-gray-400">{stage.dealCount} deals</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">
                          {stage.totalValue > 0 ? fmtMoney(stage.totalValue, stage.currency) : "—"}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max((stage.dealCount / maxDeals) * 100, 6)}%`, backgroundColor: stage.color }} />
                      </div>
                    </div>
                  </div>
                ))}
                {stageRows.length > 0 && (
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Total pipeline value</span>
                    <span className="text-sm font-bold text-gray-900">{fmtMoney(totalPipeline, firstCurrency)}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Recent activity */}
            <Card title="Recent activity" linkTo="/inbox" linkLabel="View all →">
              <div className="divide-y divide-gray-50">
                {activityItems.length === 0 && (
                  <p className="px-5 py-6 text-sm text-center text-gray-400">No recent activity</p>
                )}
                {activityItems.map(item => {
                  const isMsg = item.type === "message";
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isMsg ? "bg-indigo-100" : "bg-green-100"}`}>
                        {isMsg
                          ? <MessageCircle className="w-4 h-4 text-indigo-600" />
                          : <Receipt className="w-4 h-4 text-green-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-400 truncate">{item.sub}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.amount != null && (
                          <p className="text-xs font-semibold text-green-600">€{item.amount.toLocaleString("es-ES")}</p>
                        )}
                        <p className="text-xs text-gray-400">{item.date ? timeAgo(item.date) : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── Right col: AI Insights + Quick actions (3) ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* AI Insights panel */}
            <div className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#4c1d95 100%)" }}>
              <div className="px-5 pt-5 pb-3 flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-violet-500/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                  </div>
                  <span className="text-sm font-semibold text-white">AI Insights</span>
                </div>

                <div className="space-y-2">
                  {insightList.length === 0 ? (
                    // Placeholder insights that match the screenshot style
                    [
                      { severity: "positive", title: "No urgent alerts",       suggestion: "Great! Everything is under control." },
                      { severity: "warning",  title: `${overdueCount || 0} invoices overdue`, suggestion: `Total amount pending review.` },
                      { severity: "info",     title: "Best time to follow up", suggestion: "Based on contact engagement patterns." },
                    ].map((ins, i) => {
                      const st = INSIGHT_STYLES[ins.severity] ?? INSIGHT_STYLES.info;
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: st.bg }}>
                            <st.Icon className="w-3.5 h-3.5" style={{ color: st.ring }} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white leading-snug">{ins.title}</p>
                            <p className="text-xs text-white/50 mt-0.5 leading-snug">{ins.suggestion}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    insightList.slice(0, 4).map((ins: any, i: number) => {
                      const st = INSIGHT_STYLES[ins.severity] ?? INSIGHT_STYLES.info;
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: st.bg }}>
                            <st.Icon className="w-3.5 h-3.5" style={{ color: st.ring }} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white leading-snug">{ins.title}</p>
                            <p className="text-xs text-white/50 mt-0.5 leading-snug">{ins.suggestion}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Open Copilot button */}
              <div className="px-5 pb-5 pt-3">
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(90deg,#6366f1 0%,#7c3aed 100%)" }}
                >
                  <Zap className="w-4 h-4" /> Open Copilot
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick actions</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { Icon: Receipt,     label: "New invoice",      href: "/invoices",    bg: "bg-indigo-50",  ic: "text-indigo-600" },
                  { Icon: UserPlus,    label: "Add contact",      href: "/contacts",    bg: "bg-blue-50",    ic: "text-blue-600"   },
                  { Icon: KanbanSquare,label: "New opportunity",  href: "/pipeline",    bg: "bg-violet-50",  ic: "text-violet-600" },
                  { Icon: MessageCircle,label:"Send message",     href: "/inbox",       bg: "bg-green-50",   ic: "text-green-600"  },
                  { Icon: FileText,    label: "Upload file",      href: "/documents",   bg: "bg-orange-50",  ic: "text-orange-500" },
                  { Icon: Zap,         label: "Automation",       href: "/automations", bg: "bg-pink-50",    ic: "text-pink-500"   },
                ].map(({ Icon, label, href, bg, ic }) => (
                  <Link key={href + label} href={href}>
                    <a className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl hover:bg-gray-50 transition group">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                        <Icon className={`w-5 h-5 ${ic}`} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
                    </a>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
