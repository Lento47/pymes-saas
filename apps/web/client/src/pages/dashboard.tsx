import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { InsightsWidget } from "@/components/shared/insights-widget";
import {
  Plus, ArrowRight, Activity, Bell, Search,
  Users, CheckSquare, FileText, MessageCircle, TrendingUp,
  Receipt, Zap, BarChart2, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_BG = "https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/statusBackground.png";

interface PipelineDealSummary { value: string | null; currency: string; }
interface PipelineStageSummary { id: string; name: string; color: string; deals: PipelineDealSummary[]; }

function sumPipelineValue(deals: PipelineDealSummary[]) {
  return deals.reduce((sum, d) => {
    const n = d.value ? Number.parseFloat(d.value) : 0;
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, currency, subLabel, icon: Icon, iconBg, loading,
}: {
  label: string; value: any; currency?: string; subLabel?: string;
  icon: any; iconBg: string; loading?: boolean;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-white border border-gray-100 p-5 hover:shadow-md transition-shadow"
      style={{
        backgroundImage: `url('${STATUS_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* white overlay so text stays readable */}
      <div className="absolute inset-0 bg-white/88 rounded-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
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

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({
  title, linkTo, linkLabel, loading, empty, children,
}: {
  title: string; linkTo?: string; linkLabel?: string;
  loading?: boolean; empty?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {(title || linkTo) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {linkTo && (
            <Link href={linkTo}>
              <a className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium">
                {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </Link>
          )}
        </div>
      )}
      {loading ? (
        <div className="px-5 py-4 space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-4 w-full" />)}</div>
      ) : empty ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">Sin datos aún</div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, href, iconColor }: { icon: any; label: string; href: string; iconColor: string }) {
  return (
    <Link href={href}>
      <a className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl hover:bg-gray-50 transition group">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
      </a>
    </Link>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    HIGH: "bg-red-100 text-red-600",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[priority] ?? map.LOW}`}>
      {priority === "HIGH" ? "High" : priority === "MEDIUM" ? "Medium" : "Low"}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"tasks" | "messages">("tasks");

  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats/today"],
    queryFn: api.getTodayStats,
    refetchInterval: 60000,
  });
  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/conversations", "dash"],
    queryFn: () => api.getConversations({ limit: "10" }),
  });
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", "dash"],
    queryFn: () => api.getTasks({ limit: "10" }),
  });
  const { data: overdueInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices", "overdue-widget"],
    queryFn: () => api.getInvoices({ status: "OVERDUE", limit: "5" }),
    refetchInterval: 60000,
  });
  const { data: pipelineStagesData, isLoading: pipelineLoading } = useQuery({
    queryKey: ["/api/pipeline/stages", "dash"],
    queryFn: () => api.getPipelineStages(),
    refetchInterval: 60000,
  });
  const { data: insights } = useQuery({
    queryKey: ["/api/insights"],
    queryFn: api.getInsights,
    staleTime: 3 * 60 * 1000,
  });

  // Derived totals needed for the AI prompt — only computed once data loads
  const _overdueCount  = Array.isArray(overdueInvoices) ? overdueInvoices.length : overdueInvoices?.data?.length ?? 0;
  const _urgentTasks   = (Array.isArray(tasks) ? tasks : tasks?.data ?? []).filter((t: any) => t.priority === "HIGH").length;
  const _pipelineCount = Array.isArray(pipelineStagesData)
    ? pipelineStagesData.reduce((s: number, st: any) => s + (st.deals?.length ?? 0), 0)
    : 0;
  const _insightSummary = Array.isArray(insights)
    ? insights.slice(0, 3).map((i: any) => `${i.severity}: ${i.title}`).join("; ")
    : "";

  const aiPromptReady = !statsLoading && !tasksLoading && !invoicesLoading && !pipelineLoading;

  const { data: bannerAI } = useQuery({
    queryKey: ["/api/ai/banner", _overdueCount, _urgentTasks, _pipelineCount, _insightSummary],
    queryFn: () => api.askAssistant(
      `You are a smart business assistant. Write exactly 2 short lines for a dashboard status banner: ` +
      `Line 1: a title (max 6 words, friendly tone). ` +
      `Line 2: a subtitle (max 12 words, actionable). ` +
      `Reply in this exact format: TITLE|||SUBTITLE — no markdown, no extra text. ` +
      `Business snapshot: overdue invoices=${_overdueCount}, urgent tasks=${_urgentTasks}, ` +
      `pipeline deals=${_pipelineCount}, monthly revenue trend=+18%. ` +
      `Alerts: ${_insightSummary || "none"}.`
    ),
    enabled: aiPromptReady,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const overdueInvoiceList = Array.isArray(overdueInvoices) ? overdueInvoices : overdueInvoices?.data ?? [];
  const pipelineStages: PipelineStageSummary[] = Array.isArray(pipelineStagesData) ? pipelineStagesData : pipelineStagesData?.data ?? [];

  const pipelineStageRows = pipelineStages
    .map((stage) => {
      const dealCount = stage.deals?.length ?? 0;
      const currency = stage.deals?.find(d => d.currency)?.currency ?? "CRC";
      return { id: stage.id, name: stage.name, color: stage.color || "#6366F1", dealCount, totalValue: sumPipelineValue(stage.deals ?? []), currency };
    })
    .filter(s => s.dealCount > 0)
    .slice(0, 5);

  const maxPipelineDeals = Math.max(...pipelineStageRows.map(s => s.dealCount), 1);
  const pipelineDealCount = pipelineStages.reduce((sum, s) => sum + (s.deals?.length ?? 0), 0);
  const overdueCount = overdueInvoiceList.length;
  const overdueAmount = overdueInvoiceList.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
  const urgentTasks = taskList.filter((t: any) => t.priority === "HIGH").length;

  // Parse the AI response (TITLE|||SUBTITLE format) with a sensible fallback
  const [bannerTitle, bannerSubtitle] = (() => {
    const raw: string = bannerAI?.answer ?? "";
    const parts = raw.split("|||");
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return [parts[0].trim(), parts[1].trim()];
    }
    return ["Everything looks good today", "Your business is on track. Keep going! ✨"];
  })();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 19) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-full" style={{ background: "#F4F5F9" }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-7 pb-5 flex items-start justify-between max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.name?.split(" ")[0] || "Usuario"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-400 min-w-[220px]">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Search in PymesHub...</span>
            <span className="text-xs text-gray-300 font-mono">⌘ K</span>
          </div>
          <button className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-8 pb-8 max-w-[1400px] mx-auto space-y-4">

        {/* ── Status banner ───────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden border border-gray-100"
          style={{
            backgroundImage: `url('${STATUS_BG}')`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
            minHeight: 96,
          }}
        >
          <div className="flex items-center gap-6 px-7 py-5">
            {/* Pulse icon box */}
            <div className="w-14 h-14 rounded-2xl bg-white/75 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-sm">
              <Activity className="w-7 h-7 text-indigo-500" />
            </div>

            {/* AI-powered title + subtitle */}
            <div className="flex-shrink-0 min-w-[220px]">
              {!bannerAI && aiPromptReady ? (
                <>
                  <div className="h-5 w-48 rounded bg-gray-200/70 animate-pulse mb-1.5" />
                  <div className="h-3.5 w-56 rounded bg-gray-200/50 animate-pulse" />
                </>
              ) : (
                <>
                  <h2 className="text-[17px] font-bold text-gray-900 leading-snug">{bannerTitle}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{bannerSubtitle}</p>
                </>
              )}
            </div>

            {/* Vertical divider */}
            <div className="h-12 w-px bg-gray-300/60 mx-2 flex-shrink-0" />

            {/* Mini-metrics row */}
            <div className="flex items-center gap-6 flex-1 overflow-x-auto">
              {/* Revenue */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)" }}>
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Revenue</p>
                  <p className="text-sm font-bold text-green-500">↑ 18%</p>
                  <p className="text-xs text-gray-400">vs last month</p>
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200/70 flex-shrink-0" />
              {/* Invoices */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0ea5e9,#38bdf8)" }}>
                  <Receipt className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{overdueCount} Invoices</p>
                  <p className="text-xs text-gray-400">Pending payment</p>
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200/70 flex-shrink-0" />
              {/* Tasks */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#64748b,#94a3b8)" }}>
                  <CheckSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{urgentTasks} Tasks</p>
                  <p className="text-xs text-gray-400">Urgent</p>
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200/70 flex-shrink-0" />
              {/* Pipeline */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                  <BarChart2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Pipeline</p>
                  <p className="text-sm font-bold text-green-500">Healthy</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Metric cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            label="Revenue this month"
            value={todayStats?.monthly_revenue ?? 0}
            currency="€"
            subLabel="↑ 18.6% vs. last month"
            icon={TrendingUp}
            iconBg="bg-indigo-100 text-indigo-600"
            loading={statsLoading}
          />
          <MetricCard
            label="Outstanding"
            value={overdueAmount}
            currency="€"
            subLabel={`${overdueCount} invoices pending`}
            icon={Receipt}
            iconBg="bg-orange-100 text-orange-500"
            loading={invoicesLoading}
          />
          <MetricCard
            label="Pipeline value"
            value={pipelineStageRows.reduce((s, r) => s + r.totalValue, 0)}
            currency="€"
            subLabel="Potential revenue"
            icon={BarChart2}
            iconBg="bg-blue-100 text-blue-500"
            loading={pipelineLoading}
          />
          <MetricCard
            label="New messages"
            value={todayStats?.new_messages ?? 0}
            subLabel={todayStats?.new_messages ? `${todayStats.new_messages} unread` : "No unread messages"}
            icon={MessageCircle}
            iconBg="bg-purple-100 text-purple-500"
            loading={statsLoading}
          />
          <MetricCard
            label="Tasks today"
            value={taskList.length}
            subLabel={taskList.length === 0 ? "You're all caught up" : `${urgentTasks} urgent`}
            icon={Clock}
            iconBg="bg-teal-100 text-teal-500"
            loading={tasksLoading}
          />
        </div>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Revenue overview + Tasks/Messages  (col 1-6) */}
          <div className="lg:col-span-6 space-y-4">

            {/* Revenue overview placeholder */}
            <SectionCard title="Revenue overview">
              <div className="px-5 py-4">
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    €{(todayStats?.monthly_revenue ?? 0).toLocaleString("es-ES")}
                  </span>
                  <span className="text-sm text-green-500 font-medium">↑ 18.6% vs. last month</span>
                </div>
                <div className="h-36 rounded-xl bg-gradient-to-t from-indigo-50 to-transparent flex items-end px-2 gap-1">
                  {[30, 45, 35, 55, 48, 62, 58, 70, 55, 80, 72, 90].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{ height: `${h}%`, background: i === 11 ? "#6366F1" : "#E0E7FF" }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                  {["May 1", "May 8", "May 15", "May 22", "May 29"].map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Tasks / Messages tabs */}
            <SectionCard
              title=""
              linkTo={activeTab === "tasks" ? "/tasks" : "/inbox"}
              linkLabel={activeTab === "tasks" ? "View all tasks →" : "View all →"}
            >
              <div className="px-5 pb-1 pt-2 border-b border-gray-100">
                <div className="flex gap-1">
                  {(["tasks", "messages"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition capitalize ${
                        activeTab === tab
                          ? "text-indigo-600 border-b-2 border-indigo-600 rounded-none"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab === "tasks" ? "Tasks" : "Messages"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {activeTab === "tasks"
                  ? taskList.slice(0, 5).map((task: any) => (
                      <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-indigo-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        </div>
                        <PriorityBadge priority={task.priority} />
                        {task.due_date && (
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {format(new Date(task.due_date), "MMM d", { locale: es })}
                          </span>
                        )}
                      </div>
                    ))
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
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {conv.updated_at && format(new Date(conv.updated_at), "HH:mm")}
                          </span>
                        </a>
                      </Link>
                    ))
                }
              </div>
            </SectionCard>
          </div>

          {/* Pipeline + Recent activity  (col 7-9) */}
          <div className="lg:col-span-3 space-y-4">
            <SectionCard title="Pipeline overview" linkTo="/pipeline" linkLabel="View pipeline →" loading={pipelineLoading} empty={!pipelineLoading && pipelineStageRows.length === 0}>
              <div className="px-5 py-4 space-y-3">
                {pipelineStageRows.map(stage => (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-xs font-medium text-gray-700">{stage.name}</span>
                        <span className="text-xs text-gray-400 ml-1">{stage.dealCount} deals</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-800">
                        {stage.totalValue > 0 ? fmtMoney(stage.totalValue, stage.currency) : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max((stage.dealCount / maxPipelineDeals) * 100, 8)}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                ))}
                {pipelineStageRows.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Total pipeline value</span>
                    <span className="text-sm font-bold text-gray-900">
                      {fmtMoney(pipelineStageRows.reduce((s, r) => s + r.totalValue, 0), pipelineStageRows[0]?.currency ?? "CRC")}
                    </span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Recent activity */}
            <SectionCard title="Recent activity" linkTo="/inbox" linkLabel="View all →">
              <div className="divide-y divide-gray-50">
                {overdueInvoiceList.slice(0, 4).map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        Invoice #{inv.id?.slice(0, 8)} pending
                      </p>
                      <p className="text-xs text-gray-400 truncate">{inv.client_name}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">€{inv.amount?.toLocaleString("es-ES")}</span>
                  </div>
                ))}
                {overdueInvoiceList.length === 0 && (
                  <div className="px-5 py-6 text-center text-xs text-gray-400">No recent activity</div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* AI Insights + Quick actions  (col 10-12) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 60%,#4c1d95 100%)" }}>
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-violet-300" />
                  <span className="text-sm font-semibold text-white">AI Insights</span>
                </div>
                <InsightsWidget />
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick actions</h3>
              <div className="grid grid-cols-3 gap-1">
                <QuickAction icon={FileText} label="New invoice" href="/invoices" iconColor="bg-indigo-100 text-indigo-600" />
                <QuickAction icon={Users} label="Add contact" href="/contacts" iconColor="bg-blue-100 text-blue-600" />
                <QuickAction icon={CheckSquare} label="New task" href="/tasks" iconColor="bg-violet-100 text-violet-600" />
                <QuickAction icon={MessageCircle} label="Send message" href="/inbox" iconColor="bg-green-100 text-green-600" />
                <QuickAction icon={FileText} label="Upload file" href="/documents" iconColor="bg-orange-100 text-orange-500" />
                <QuickAction icon={Zap} label="Automation" href="/automations" iconColor="bg-pink-100 text-pink-500" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
