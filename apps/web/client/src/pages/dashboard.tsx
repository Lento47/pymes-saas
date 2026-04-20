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
import { RefreshCw, Loader2, ArrowRight } from "lucide-react";
import { InsightsWidget } from "@/components/shared/insights-widget";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Stat card — Cloudflare style: label top, number bottom ──────────────────
function StatCard({ label, value, loading }: { label: string; value: any; loading?: boolean }) {
  return (
    <div
      style={{
        background: "hsl(var(--bg-card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "4px",
        padding: "16px 20px",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 500, color: "hsl(var(--fg-2))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
        {label}
      </div>
      {loading
        ? <Skeleton className="h-8 w-16" />
        : <div style={{ fontSize: "28px", fontWeight: 600, color: "hsl(var(--fg))", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </div>
      }
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, linkTo, linkLabel, loading, empty, children }: {
  title: string; linkTo: string; linkLabel: string;
  loading?: boolean; empty?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", borderRadius: "4px", overflow: "hidden" }}>
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <span style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--fg))" }}>{title}</span>
        <Link href={linkTo}>
          <span className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            style={{ fontSize: "12px", color: "hsl(var(--fg-2))" }}>
            {linkLabel} <ArrowRight style={{ width: 12, height: 12 }} />
          </span>
        </Link>
      </div>
      {loading ? (
        <div className="px-5 py-3 space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      ) : empty ? (
        <div className="px-5 py-8 text-center" style={{ fontSize: "13px", color: "hsl(var(--fg-3))" }}>
          Sin datos aún
        </div>
      ) : children}
    </div>
  );
}

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: summaries } = useQuery({
    queryKey: ["/api/summaries/daily"],
    queryFn: api.getDailySummaries,
  });
  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/workspaces/current/stats/today"],
    queryFn: api.getTodayStats,
    refetchInterval: 60000,
  });
  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/conversations", "dash"],
    queryFn: () => api.getConversations({ limit: "5" }),
  });
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", "dash"],
    queryFn: () => api.getTasks({ limit: "5" }),
  });

  const generateMutation = useMutation({
    mutationFn: api.generateSummary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/summaries/daily"] });
      toast({ title: "Resumen generado" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const lastSummary = Array.isArray(summaries) ? summaries[0] : summaries?.data?.[0] ?? null;
  const convList    = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList    = Array.isArray(tasks) ? tasks : tasks?.data ?? [];

  const stats = [
    { label: "Conversaciones hoy",  value: todayStats?.new_conversations  ?? "—" },
    { label: "Mensajes recibidos",  value: todayStats?.received_messages   ?? "—" },
    { label: "Tareas creadas",      value: todayStats?.created_tasks       ?? "—" },
    { label: "Documentos subidos",  value: todayStats?.uploaded_documents  ?? "—" },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Dashboard"
        description={format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="h-7 text-xs gap-1.5"
        >
          {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Resumen IA
        </Button>
      </PageHeader>

      <div className="px-6 py-6 space-y-6 max-w-6xl">

        {/* Greeting */}
        <div>
          <p style={{ fontSize: "20px", fontWeight: 600, color: "hsl(var(--fg))", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {greeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
          </p>
        </div>

        {/* Stats — 4 cards, no icons, CF style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(s => <StatCard key={s.label} label={s.label} value={s.value} loading={statsLoading} />)}
        </div>

        {/* AI summary */}
        {(lastSummary?.generated_text || lastSummary?.summary) && (
          <div style={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", borderRadius: "4px", padding: "16px 20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 500, color: "hsl(var(--fg-3))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
              Resumen IA
            </div>
            <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", lineHeight: 1.6 }}>
              {lastSummary.generated_text || lastSummary.summary}
            </p>
          </div>
        )}

        {/* Automatic Insights */}
        <InsightsWidget />

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <SectionCard
            title="Conversaciones recientes"
            linkTo="/inbox" linkLabel="Ver todas"
            loading={convsLoading}
            empty={convList.length === 0}
          >
            <div>
              {convList.slice(0, 5).map((conv: any, i: number) => (
                <Link key={conv.id} href={`/inbox/${conv.id}`}>
                  <div
                    className="flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors"
                    style={{
                      borderTop: i > 0 ? "1px solid hsl(var(--border))" : undefined,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--bg-hover))")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <PriorityDot priority={conv.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: "13px", color: "hsl(var(--fg))" }}>
                        {conv.subject || "Sin asunto"}
                      </p>
                      <p className="truncate" style={{ fontSize: "11px", color: "hsl(var(--fg-3))" }}>
                        {conv.contact?.full_name ?? "—"}
                        {conv.updated_at && ` · ${format(new Date(conv.updated_at), "d MMM", { locale: es })}`}
                      </p>
                    </div>
                    <StatusBadge status={conv.status} type="conversation" />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Tareas recientes"
            linkTo="/tasks" linkLabel="Ver todas"
            loading={tasksLoading}
            empty={taskList.length === 0}
          >
            <div>
              {taskList.slice(0, 5).map((task: any, i: number) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors"
                  style={{ borderTop: i > 0 ? "1px solid hsl(var(--border))" : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--bg-hover))")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <PriorityDot priority={task.priority} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "13px", color: "hsl(var(--fg))" }}>{task.title}</p>
                    <p style={{ fontSize: "11px", color: "hsl(var(--fg-3))" }}>
                      {task.due_date ? `Vence ${format(new Date(task.due_date), "d MMM", { locale: es })}` : "Sin fecha"}
                    </p>
                  </div>
                  <StatusBadge status={task.status} type="task" />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
