import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
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
function RevenueChart({ monthlyRevenue, changePct }: { monthlyRevenue: number; changePct: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 500, H = 110;

  // Use current month dates
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "short" });
  const year = now.getFullYear();
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const points = Math.min(daysInMonth, 31);

  // Generate proportional data points based on actual revenue
  const ys = Array.from({ length: points }, (_, i) => {
    // Revenue grows proportionally through the month
    const dayProgress = (i + 1) / daysInMonth;
    const expectedRevenue = monthlyRevenue * dayProgress;
    const noise = monthlyRevenue > 0 ? Math.sin(i * 0.3) * (monthlyRevenue * 0.05) : 0;
    const value = Math.max(0, expectedRevenue + noise);
    // Scale to chart height (log scale for better visualization)
    const maxVal = monthlyRevenue || 1;
    const scaled = (value / maxVal) * (H * 0.8) + H * 0.1;
    return H - Math.min(H - 5, Math.max(5, scaled));
  });
  const xs = ys.map((_, i) => (i / (ys.length - 1)) * W);
  const activeIdx = hoverIdx ?? Math.min(today - 1, points - 1);

  // Generate week labels from actual dates
  const weekLabels = Array.from({ length: Math.min(5, Math.ceil(points / 7)) }, (_, w) => {
    const d = Math.min(w * 7 + 1, daysInMonth);
    return `${monthName} ${d}`;
  });

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`;

  // Tooltip date
  const tooltipDay = Math.min(Math.round((activeIdx / (points - 1)) * daysInMonth), daysInMonth) || 1;
  const tooltipRevenue = monthlyRevenue > 0
    ? Math.round(monthlyRevenue * (activeIdx + 1) / points)
    : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full cursor-pointer" style={{ height: 140 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * W;
        const idx = Math.round((x / W) * (points - 1));
        setHoverIdx(Math.max(0, Math.min(points - 1, idx)));
      }}
      onMouseLeave={() => setHoverIdx(null)}
      onTouchMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
        const idx = Math.round((x / W) * (points - 1));
        setHoverIdx(Math.max(0, Math.min(points - 1, idx)));
      }}
    >
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b7cf6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8b7cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[25, 50, 75, 100].map(y => (
        <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#rev-fill)" />
      <path d={d} fill="none" stroke="#8b7cf6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Today indicator line */}
      <line x1={xs[Math.min(today - 1, points - 1)]} y1="0" x2={xs[Math.min(today - 1, points - 1)]} y2={H} stroke="#8b7cf6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
      {/* Active dot */}
      <circle cx={xs[activeIdx]} cy={ys[activeIdx]} r="5" fill="#8b7cf6" />
      <circle cx={xs[activeIdx]} cy={ys[activeIdx]} r="9" fill="#8b7cf6" fillOpacity="0.15" />
      {/* Tooltip */}
      <rect x={Math.max(0, Math.min(W - 90, xs[activeIdx] - 45))} y={Math.max(0, ys[activeIdx] - 38)} width="90" height="24" rx="6" fill="#1e1b4b" />
      <text x={Math.max(45, Math.min(W - 45, xs[activeIdx]))} y={Math.max(16, ys[activeIdx] - 22)} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">
        {monthName} {tooltipDay} · ₡{tooltipRevenue.toLocaleString()}
      </text>
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, currency, subLabel, icon: Icon, iconBg, loading }: {
  label: string; value: any; currency?: string; subLabel?: string;
  icon: any; iconBg: string; loading?: boolean;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.04] p-5 hover:shadow-md transition-shadow"
      style={{ backgroundImage: `url('${STATUS_BG}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-[#0c0c0e]/[0.88] rounded-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-white/70">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? <Skeleton className="h-7 w-20" /> : (
          <>
            <p className="text-2xl font-bold text-white/90">
              {currency}{typeof value === "number" ? value.toLocaleString("es-ES") : value}
            </p>
            {subLabel && <p className="text-xs text-white/50 mt-1">{subLabel}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    HIGH:   "bg-red-500/15 text-red-400",
    MEDIUM: "bg-yellow-500/15 text-yellow-400",
    LOW:    "bg-white/[0.02] text-white/40",
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
    <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden">
      {(title || linkTo || headerExtra) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h3 className="font-semibold text-white/90 text-sm">{title}</h3>
          <div className="flex items-center gap-2">
            {headerExtra}
            {linkTo && (
              <Link href={linkTo}>
                <a className="text-xs text-[#8b7cf6] hover:text-[#a78bfa] flex items-center gap-1 font-medium">
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
        ? <div className="px-5 py-8 text-center text-sm text-white/30">No data yet</div>
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
    .map(s => ({ id: s.id, name: s.name, color: s.color || "#8b7cf6", dealCount: s.deals?.length ?? 0, totalValue: sumPipelineValue(s.deals ?? []), currency: s.deals?.find(d => d.currency)?.currency ?? "CRC" }))
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

  const { messages } = useI18n();
  const dash = messages.dashboard;

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? dash.morning : h < 19 ? dash.afternoon : dash.evening;
  };

  return (
    <div className="min-h-full" style={{ background: "#0c0c0e" }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-4 md:pt-7 pb-5 flex items-start justify-between gap-3 max-w-[1400px] mx-auto">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-white/90 truncate">{greeting()}, {user?.name?.split(" ")[0] || dash.unknownContact} 👋</h1>
          <p className="text-sm text-white/40 mt-0.5">{bannerSubtitle || dash.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] text-sm text-white/30 min-w-[200px]">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{dash.search}</span>
            <span className="text-xs text-white/20 font-mono">⌘ K</span>
          </div>
          <button className="p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] text-white/40 hover:bg-white/[0.03] transition">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-xl bg-[#8b7cf6] text-white hover:opacity-90 transition">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-3 md:px-8 pb-8 max-w-[1400px] mx-auto space-y-4">

        {/* ── Status banner ───────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-border/40 relative"
          style={{ backgroundImage: `url('${STATUS_BG}')`, backgroundSize: "cover", backgroundPosition: "center right", minHeight: 96 }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 md:px-7 md:py-5 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                <Activity className="w-5 h-5 md:w-7 md:h-7 text-[#8b7cf6]" />
              </div>
              <div className="min-w-0">
                {!bannerAI && aiPromptReady ? (
                  <><div className="h-5 w-36 rounded bg-black/10 animate-pulse mb-1.5" /><div className="h-3.5 w-44 rounded bg-black/10 animate-pulse" /></>
                ) : (
                  <><h2 className="text-[15px] md:text-[17px] font-bold text-gray-900 leading-snug">{bannerTitle}</h2><p className="text-sm text-gray-700 mt-0.5">{bannerSubtitle}</p></>
                )}
              </div>
            </div>
            <div className="hidden sm:block h-12 w-px bg-black/10 flex-shrink-0" />
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-none -mx-1 px-1">
              {[
                { bg: "linear-gradient(135deg,#8b7cf6,#a78bfa)", Icon: TrendingUp, label: dash.revenue, value: revenueStr, sub: "vs last month", valueClass: revenueClass },
                { bg: "linear-gradient(135deg,#0ea5e9,#38bdf8)", Icon: Receipt, label: `${overdueCount} ${dash.invoices}`, value: "Pending", sub: "", valueClass: "text-gray-800" },
                { bg: "linear-gradient(135deg,#64748b,#94a3b8)", Icon: CheckSquare, label: `${urgentTasks} ${dash.tasks}`, value: "Urgent", sub: "", valueClass: "text-gray-800" },
                { bg: "linear-gradient(135deg,#7c3aed,#a78bfa)", Icon: BarChart2, label: dash.pipeline, value: pipelineStatus, sub: "", valueClass: activeConvs > 0 ? "text-green-600" : "text-gray-400" },
              ].map(({ bg, Icon, label, value, sub, valueClass }, i, arr) => (
                <div key={label} className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium">{label}</p>
                      <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
                      {sub && <p className="text-xs text-gray-500">{sub}</p>}
                    </div>
                  </div>
                  {i < arr.length - 1 && <div className="h-10 w-px bg-black/10 ml-3" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Metric cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">

          {/* 1 — Revenue: gradient hero */}
          <div className="col-span-2 md:col-span-1 rounded-2xl p-5 flex flex-col justify-between min-h-[110px]"
            style={{ background: "linear-gradient(135deg,rgba(139,124,246,0.22) 0%,rgba(91,92,240,0.12) 100%)", border: "1px solid rgba(139,124,246,0.28)" }}>
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a78bfa]/70">{dash.revenueThisMonth}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#8b7cf6]/20 text-[#a78bfa]">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
              <>
                <p className="text-[1.75rem] font-bold text-white tracking-tight leading-none mt-2">
                  ₡{(workspaceStats?.monthly_revenue ?? 0).toLocaleString("es-ES")}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${(workspaceStats?.revenue_change_pct ?? 0) >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {(workspaceStats?.revenue_change_pct ?? 0) >= 0 ? "+" : ""}{workspaceStats?.revenue_change_pct ?? 0}%
                  </span>
                  <span className="text-[11px] text-white/30">vs. last month</span>
                </div>
              </>
            )}
          </div>

          {/* 2 — Outstanding: amber alert */}
          <div className="rounded-2xl p-4 flex flex-col justify-between min-h-[110px]"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.20)" }}>
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-400/60">{dash.outstanding}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-400">
                <Receipt className="w-3.5 h-3.5" />
              </div>
            </div>
            {invoicesLoading ? <Skeleton className="h-7 w-20 mt-2" /> : (
              <>
                <p className="text-2xl font-bold text-white/90 mt-2 tracking-tight">₡{overdueAmount.toLocaleString("es-ES")}</p>
                <span className={`mt-2 self-start text-[10px] font-medium px-2 py-0.5 rounded-full ${overdueCount > 0 ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.04] text-white/30"}`}>
                  {overdueCount} {overdueCount === 1 ? "invoice" : "invoices"} pending
                </span>
              </>
            )}
          </div>

          {/* 3 — Pipeline: blue with bottom bar */}
          <div className="rounded-2xl p-4 flex flex-col justify-between min-h-[110px] overflow-hidden relative"
            style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)" }}>
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-sky-500/60 via-blue-400/40 to-transparent" />
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-400/60">{dash.pipelineValue}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/15 text-sky-400">
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
            </div>
            {pipelineLoading ? <Skeleton className="h-7 w-20 mt-2" /> : (
              <>
                <p className="text-2xl font-bold text-white/90 mt-2 tracking-tight">₡{totalPipeline.toLocaleString("es-ES")}</p>
                <p className="text-[11px] text-sky-400/50 mt-1.5">Potential revenue</p>
              </>
            )}
          </div>

          {/* 4 — Messages: minimal with live indicator */}
          <div className="rounded-2xl p-4 flex flex-col justify-between min-h-[110px]"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/30">{dash.newMessages}</p>
              <div className="flex items-center gap-1">
                {(todayStats?.received_messages ?? 0) > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.05] text-white/40">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-7 w-12 mt-2" /> : (
              <>
                <p className="text-[2.25rem] font-bold text-white/90 leading-none mt-1">{todayStats?.received_messages ?? 0}</p>
                <p className="text-[11px] text-white/25 mt-2">{(todayStats?.received_messages ?? 0) > 0 ? "received today" : "No messages today"}</p>
              </>
            )}
          </div>

          {/* 5 — Tasks: teal completion */}
          <div className="rounded-2xl p-4 flex flex-col justify-between min-h-[110px]"
            style={{ background: "rgba(20,184,166,0.07)", border: "1px solid rgba(20,184,166,0.20)" }}>
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-400/60">{dash.tasksToday}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-500/15 text-teal-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            {tasksLoading ? <Skeleton className="h-7 w-16 mt-2" /> : (
              <>
                <p className="text-2xl font-bold text-white/90 mt-2 tracking-tight">{taskList.length}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  {taskList.length === 0
                    ? <span className="text-[11px] text-teal-400/60">✓ All caught up</span>
                    : <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${urgentTasks > 0 ? "bg-red-500/15 text-red-400" : "bg-teal-500/15 text-teal-300"}`}>{urgentTasks > 0 ? `${urgentTasks} urgent` : "on track"}</span>
                  }
                </div>
              </>
            )}
          </div>

        </div>

        {/* ── Main grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── Left col: Revenue + Tasks/Messages (5) ── */}
          <div className="lg:col-span-5 space-y-4">

            {/* Revenue overview */}
            <Card title={dash.revenueOverview}
              headerExtra={
                <span className="text-xs text-white/40 bg-white/[0.02] px-2.5 py-1.5 rounded-lg font-medium">
                  {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
                </span>
              }
            >
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-white/90">₡{(workspaceStats?.monthly_revenue ?? 0).toLocaleString("es-ES")}</span>
                  <span className="text-sm text-green-500 font-medium">{workspaceStats?.revenue_change_pct ?? 0}% vs. last month</span>
                </div>
                <RevenueChart monthlyRevenue={workspaceStats?.monthly_revenue ?? 0} changePct={workspaceStats?.revenue_change_pct ?? 0} />
                <div className="flex justify-between text-xs text-white/30 mt-2 px-1">
                  {(() => {
                    const now = new Date();
                    const month = now.toLocaleString("en-US", { month: "short" });
                    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    const step = Math.max(1, Math.floor(days / 5));
                    return Array.from({ length: Math.min(5, Math.ceil(days / step)) }, (_, i) => {
                      const d = Math.min(i * step + 1, days);
                      return <span key={d}>{month} {d}</span>;
                    });
                  })()}
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
                        activeTab === tab ? "text-[#8b7cf6] border-b-2 border-[#8b7cf6]" : "text-white/40 hover:text-white/70"
                      }`}>
                      {tab === "tasks" ? "Tasks" : "Messages"}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="divide-y divide-white/[0.02]">
                {activeTab === "tasks" ? (
                  taskList.length === 0
                    ? <p className="px-5 py-6 text-sm text-center text-white/30">No tasks yet</p>
                    : taskList.slice(0, 5).map((task: any) => (
                        <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                          <input type="checkbox" className="w-4 h-4 rounded border-white/[0.04] cursor-pointer accent-[#8b7cf6]" />
                          <p className="flex-1 text-sm font-medium text-white/90 truncate">{task.title}</p>
                          <PriorityBadge priority={task.priority} />
                          {task.due_date && (
                            <span className="text-xs text-white/30 whitespace-nowrap">
                              {format(new Date(task.due_date), "MMM d", { locale: es })}
                            </span>
                          )}
                        </div>
                      ))
                ) : (
                  convList.length === 0
                    ? <p className="px-5 py-6 text-sm text-center text-white/30">No messages yet</p>
                    : convList.slice(0, 5).map((conv: any) => (
                        <Link key={conv.id} href={`/inbox/${conv.id}`}>
                          <a className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition">
                            <div className="w-8 h-8 rounded-full bg-[#8b7cf6]/15 flex items-center justify-center text-xs font-semibold text-[#8b7cf6] flex-shrink-0">
                              {conv.contact?.full_name?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/90 truncate">{conv.contact?.full_name || "Unknown"}</p>
                              <p className="text-xs text-white/30 truncate">{conv.subject || "No subject"}</p>
                            </div>
                            <span className="text-xs text-white/30 whitespace-nowrap">{conv.updated_at && format(new Date(conv.updated_at), "HH:mm")}</span>
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
            <Card title={dash.pipelineOverview} linkTo="/pipeline" linkLabel={dash.viewPipeline + " →"} loading={pipelineLoading} empty={!pipelineLoading && stageRows.length === 0}>
              <div className="px-5 py-4 space-y-3.5">
                {stageRows.map(stage => (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-white/80">{stage.name}</span>
                          <span className="text-xs text-white/30">{stage.dealCount} deals</span>
                        </div>
                        <span className="text-xs font-semibold text-white/70">
                          {stage.totalValue > 0 ? fmtMoney(stage.totalValue, stage.currency) : "—"}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/[0.02] overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max((stage.dealCount / maxDeals) * 100, 6)}%`, backgroundColor: stage.color }} />
                      </div>
                    </div>
                  </div>
                ))}
                {stageRows.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/70">{dash.totalPipelineValue}</span>
                    <span className="text-sm font-bold text-white/90">{fmtMoney(totalPipeline, firstCurrency)}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Recent activity */}
            <Card title="Recent activity" linkTo="/inbox" linkLabel="View all →">
              <div className="divide-y divide-white/[0.02]">
                {activityItems.length === 0 && (
                  <p className="px-5 py-6 text-sm text-center text-white/30">No recent activity</p>
                )}
                {activityItems.map(item => {
                  const isMsg = item.type === "message";
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isMsg ? "bg-[#8b7cf6]/15" : "bg-green-500/15"}`}>
                        {isMsg
                          ? <MessageCircle className="w-4 h-4 text-[#8b7cf6]" />
                          : <Receipt className="w-4 h-4 text-green-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">{item.title}</p>
                        <p className="text-xs text-white/30 truncate">{item.sub}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.amount != null && (
                          <p className="text-xs font-semibold text-green-400">€{item.amount.toLocaleString("es-ES")}</p>
                        )}
                        <p className="text-xs text-white/30">{item.date ? timeAgo(item.date) : ""}</p>
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
                  <span className="text-sm font-semibold text-white">{dash.aiInsights}</span>
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
                  style={{ background: "linear-gradient(90deg,#8b7cf6 0%,#a78bfa 100%)" }}
                >
                  <Zap className="w-4 h-4" /> Open Copilot
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Quick actions</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { Icon: Receipt,     label: "New invoice",      href: "/invoices",    bg: "bg-[#8b7cf6]/15",  ic: "text-[#8b7cf6]" },
                  { Icon: UserPlus,    label: "Add contact",      href: "/contacts",    bg: "bg-blue-500/15",    ic: "text-blue-400"   },
                  { Icon: KanbanSquare,label: dash.newOpportunity,  href: "/pipeline",    bg: "bg-violet-500/15",  ic: "text-violet-400" },
                  { Icon: MessageCircle,label:"Send message",     href: "/inbox",       bg: "bg-green-500/15",   ic: "text-green-400"  },
                  { Icon: FileText,    label: "Upload file",      href: "/documents",   bg: "bg-orange-500/15",  ic: "text-orange-400" },
                  { Icon: Zap,         label: "Automation",       href: "/automations", bg: "bg-pink-500/15",    ic: "text-pink-400"   },
                ].map(({ Icon, label, href, bg, ic }) => (
                  <Link key={href + label} href={href}>
                    <a className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl hover:bg-white/[0.02] transition group">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                        <Icon className={`w-5 h-5 ${ic}`} />
                      </div>
                      <span className="text-xs font-medium text-white/60 text-center leading-tight">{label}</span>
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
