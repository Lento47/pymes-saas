import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { InsightsWidget } from "@/components/shared/insights-widget";
import {
  RefreshCw, Loader2, ArrowRight, AlertTriangle, Plus, MessageSquare,
  Users, CheckSquare, FileText, MessageCircle, TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Metric Card with trend ────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  currency,
  trend,
  trendLabel,
  icon: Icon,
  loading,
  color = "blue"
}: {
  label: string;
  value: any;
  currency?: string;
  trend?: number;
  trendLabel?: string;
  icon?: any;
  loading?: boolean;
  color?: "blue" | "orange" | "red" | "purple" | "green";
}) {
  const colorMap = {
    blue: "text-blue-500",
    orange: "text-orange-500",
    red: "text-red-500",
    purple: "text-purple-500",
    green: "text-green-500"
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>
        {Icon && <Icon className={`w-5 h-5 ${colorMap[color]}`} />}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">
              {currency}{typeof value === "number" ? value.toLocaleString("es-ES") : value}
            </p>
          </div>
          {trend !== undefined && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
                {trend >= 0 ? "↑" : "↓"}
              </span>
              {Math.abs(trend)}% {trendLabel || "vs. mes anterior"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({
  title,
  linkTo,
  linkLabel,
  loading,
  empty,
  children,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
  loading?: boolean;
  empty?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {(title || linkTo) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {linkTo && (
            <Link href={linkTo}>
              <a className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                {linkLabel} <ArrowRight className="w-4 h-4" />
              </a>
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="px-6 py-4 space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      ) : empty ? (
        <div className="px-6 py-8 text-center text-sm text-gray-500">
          Sin datos aún
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: any;
  label: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <a className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition">
        <Icon className="w-6 h-6 text-gray-600" />
        <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
      </a>
    </Link>
  );
}

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch all data
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

  const { data: summaries } = useQuery({
    queryKey: ["/api/summaries/daily"],
    queryFn: () => api.getDailySummaries(),
  });

  // Parse data
  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const overdueInvoiceList = Array.isArray(overdueInvoices)
    ? overdueInvoices
    : overdueInvoices?.data ?? [];
  const overdueCount = overdueInvoiceList.length;
  const overdueAmount = overdueInvoiceList.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
  const lastSummary = Array.isArray(summaries) ? summaries[0] : summaries?.data?.[0] ?? null;

  // Greeting
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting()}, {user?.name?.split(" ")[0] || "Usuario"}.
            </h1>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar en PymeHub..."
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-600">Aquí está lo más importante de tu negocio hoy.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <MetricCard
            label="Ingresos este mes"
            value={todayStats?.monthly_revenue || 0}
            currency="€"
            trend={18.6}
            trendLabel="vs. mes anterior"
            icon={TrendingUp}
            loading={statsLoading}
            color="blue"
          />
          <MetricCard
            label="Por cobrar"
            value={overdueAmount}
            currency="€"
            loading={invoicesLoading}
            color="orange"
          />
          <MetricCard
            label="Tareas urgentes"
            value={taskList.filter((t: any) => t.priority === "HIGH").length}
            trendLabel="vencen hoy"
            loading={tasksLoading}
            color="red"
          />
          <MetricCard
            label="Nuevos mensajes"
            value={todayStats?.new_messages || 0}
            trendLabel="sin leer"
            loading={statsLoading}
            color="purple"
          />
          <MetricCard
            label="Negocios en pipeline"
            value={12}
            currency="€"
            trendLabel="en valor"
            loading={statsLoading}
            color="green"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Messages by Responder */}
          <div className="lg:col-span-1">
            <SectionCard title="Mensajes por responder" linkTo="/inbox" linkLabel="Ver todos">
              <div className="divide-y divide-gray-200">
                {convList.slice(0, 5).map((conv: any, i: number) => (
                  <Link key={conv.id} href={`/inbox/${conv.id}`}>
                    <a className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700">
                        {conv.contact?.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conv.contact?.full_name || "Contacto desconocido"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {conv.subject || "Sin asunto"}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {conv.updated_at && format(new Date(conv.updated_at), "HH:mm", { locale: es })}
                      </span>
                    </a>
                  </Link>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Middle Column - Tasks & Invoices */}
          <div className="lg:col-span-1 space-y-6">
            <SectionCard title="Tareas de hoy" linkTo="/tasks" linkLabel="Ver todas">
              <div className="divide-y divide-gray-200">
                {taskList.slice(0, 5).map((task: any, i: number) => (
                  <div key={task.id} className="flex items-center gap-3 px-6 py-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.department_name}</p>
                    </div>
                    {task.due_date && (
                      <span className="text-xs text-gray-500">
                        {format(new Date(task.due_date), "HH:mm a", { locale: es })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Facturas próximas a vencer" linkTo="/invoices" linkLabel="Ver todas">
              <div className="divide-y divide-gray-200">
                {overdueInvoiceList.slice(0, 4).map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">#{inv.id?.slice(0, 4)}</p>
                      <p className="text-xs text-gray-500">{inv.client_name}</p>
                    </div>
                    {inv.due_date && (
                      <span className="text-xs text-gray-500">
                        {format(new Date(inv.due_date), "dd MMM", { locale: es })}
                      </span>
                    )}
                    <span className="font-semibold text-gray-900">€{inv.amount?.toLocaleString("es-ES")}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Right Column - Pipeline & AI Insights */}
          <div className="lg:col-span-1 space-y-6">
            <SectionCard title="Pipeline de ventas">
              <div className="px-6 py-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Lead</span>
                    <span className="text-xs font-semibold text-gray-900">4 negocios</span>
                  </div>
                  <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-blue-500"></div>
                  </div>
                  <span className="text-xs text-gray-500">€850,000</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Calificado</span>
                    <span className="text-xs font-semibold text-gray-900">3 negocios</span>
                  </div>
                  <div className="w-full h-2 bg-purple-200 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-purple-500"></div>
                  </div>
                  <span className="text-xs text-gray-500">€1,250,000</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Propuesta</span>
                    <span className="text-xs font-semibold text-gray-900">2 negocios</span>
                  </div>
                  <div className="w-full h-2 bg-yellow-200 rounded-full overflow-hidden">
                    <div className="h-full w-3/5 bg-yellow-500"></div>
                  </div>
                  <span className="text-xs text-gray-500">€1,800,000</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Insights de IA">
              <InsightsWidget />
            </SectionCard>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Acciones rápidas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <QuickAction icon={FileText} label="Nueva factura" href="/invoices" />
            <QuickAction icon={Users} label="Nuevo contacto" href="/contacts" />
            <QuickAction icon={CheckSquare} label="Nueva tarea" href="/tasks" />
            <QuickAction icon={FileText} label="Subir documento" href="/documents" />
            <QuickAction icon={MessageCircle} label="Enviar mensaje" href="/inbox" />
            <QuickAction icon={TrendingUp} label="Ver reportes" href="/invoices" />
          </div>
        </div>
      </div>
    </div>
  );
}
