import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Sparkles, Loader2, MessageCircle, FileText, ArrowUpRight } from "lucide-react";

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
  return n >= 1_000_000
    ? `₡${(n / 1_000_000).toFixed(1)}M`
    : `₡${n.toLocaleString("es-CR")}`;
}

const urgency = (inv: any): "overdue" | "soon" | "ok" => {
  const days = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "ok";
};

// ── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({
  items,
}: {
  items: { label: string; value: string; sub?: string; urgent?: boolean }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card dash-card">
      <div className="flex divide-x divide-border">
        {items.map((item, i) => (
          <div key={i} className="flex-1 text-center py-2.5 px-3">
            <div className="flex items-center justify-center gap-1.5">
              {item.urgent && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
              <div className="text-lg font-semibold text-foreground tabular-nums leading-none">
                {item.value}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
            {item.sub && (
              <div className="text-[10px] text-muted-foreground/70 mt-0.5">{item.sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pipeline Strip ───────────────────────────────────────────────────────────

function PipelineStrip({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  const maxDeals = Math.max(...stages.map((s) => s.deals.length), 1);

  return (
    <div className="flex gap-1.5">
      {stages.map((stage) => {
        const count = stage.deals.length;
        const value = stage.deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
        return (
          <Link key={stage.id} href="/pipeline" className="flex-1 min-w-0">
            <div className="rounded-md border border-border bg-card dash-card px-3 py-2.5 hover:border-primary/30 transition-colors cursor-pointer h-full">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-[11px] font-medium text-foreground truncate">{stage.name}</span>
              </div>
              <div className="text-lg font-semibold text-foreground tabular-nums leading-none">{count}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / maxDeals) * 100}%`, backgroundColor: stage.color, opacity: count > 0 ? 0.7 : 0.15 }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{crc(value)}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  linkTo,
}: {
  title: string;
  count?: number;
  linkTo?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
        {title}
        {count != null && (
          <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">
            {count}
          </span>
        )}
      </h2>
      {linkTo && (
        <ArrowUpRight className="w-3 h-3 text-muted-foreground/40" />
      )}
    </div>
  );
  return linkTo ? (
    <Link href={linkTo} className="block px-4 py-2.5 border-b border-border hover:bg-muted/30 transition-colors">
      {inner}
    </Link>
  ) : (
    <div className="px-4 py-2.5 border-b border-border">{inner}</div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyRow({ icon: Icon, text, cta, href }: { icon: any; text: string; cta?: string; href?: string }) {
  return (
    <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
      <Icon className="w-4 h-4 text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">{text}</span>
      {cta && href && (
        <Link href={href} className="text-[11px] text-primary hover:underline">
          {cta}
        </Link>
      )}
    </div>
  );
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === "NEW" || status === "OPEN"
      ? "bg-emerald-500"
      : status === "PENDING"
      ? "bg-amber-500"
      : "bg-border";
  return <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />;
}

// ── Conversation status badge ────────────────────────────────────────────────

const CONV_STATUS: Record<string, string> = {
  NEW: "Nuevo",
  OPEN: "Abierto",
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
};

// ── Main Dashboard ───────────────────────────────────────────────────────────

const ACTIVE_STAGES = ["Ganado", "Perdido"];

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();

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

  // ── Parse ──────────────────────────────────────────────────────────────────

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
  const hasOverdueInvoices = upcomingInvoices.some((inv: any) => urgency(inv) === "overdue");
  const unreadCount = t.received_messages || 0;

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
        {/* ── Header ─────────────────────────────────────────────────── */}
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
            Resumen IA
          </Button>
        </div>

        {/* ── AI Brief ────────────────────────────────────────────────── */}
        {summaryLoading || isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : todaySummary?.generated_text ? (
          <div className="rounded-lg border border-border bg-card dash-card p-4">
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {todaySummary.generated_text}
            </p>
          </div>
        ) : generateMutation.isPending ? (
          <div className="rounded-lg border border-border bg-card dash-card p-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">Generando resumen...</span>
          </div>
        ) : null}

        {/* ── KPI Strip ───────────────────────────────────────────────── */}
        {!isLoading && (
          <KpiStrip
            items={[
              {
                label: "Ingresos del mes",
                value: crc(s.monthly_revenue || 0),
                sub: s.monthly_revenue > 0 ? undefined : "Sin ingresos",
              },
              {
                label: "Por cobrar",
                value: crc(totalOutstanding),
                sub: `${outstandingInvoices.length} facturas`,
                urgent: hasOverdueInvoices,
              },
              {
                label: "Pipeline",
                value: String(pipelineTotalDeals),
                sub: pipelineTotalDeals > 0 ? crc(pipelineTotalValue) : "Sin negocios",
              },
              {
                label: "Mensajes hoy",
                value: String(unreadCount),
                sub: urgentTasks > 0 ? `${urgentTasks} urgentes` : undefined,
              },
            ]}
          />
        )}

        {/* ── Pipeline Strip ──────────────────────────────────────────── */}
        {!pipelineLoading && activeStages.length > 0 && (
          <div>
            <SectionHeader title="Pipeline" count={pipelineTotalDeals} linkTo="/pipeline" />
            <div className="mt-2.5">
              <PipelineStrip stages={activeStages} />
            </div>
          </div>
        )}

        {/* ── Tasks + Invoices ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tasks */}
          <div className="rounded-lg border border-border bg-card dash-card">
            <SectionHeader title="Tareas" count={taskList.length} linkTo="/tasks" />
            {taskList.length === 0 ? (
              <EmptyRow
                icon={FileText}
                text="No tenés tareas pendientes"
                cta="Crear primera tarea"
                href="/tasks"
              />
            ) : (
              taskList.slice(0, 8).map((task: any) => (
                <Link key={task.id} href={`/tasks`}>
                  <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                    <StatusDot status={task.priority === "HIGH" ? "NEW" : task.priority === "MEDIUM" ? "PENDING" : "RESOLVED"} />
                    <span className="text-[13px] text-foreground truncate flex-1">{task.title}</span>
                    {task.due_date && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Invoices */}
          <div className="rounded-lg border border-border bg-card dash-card">
            <SectionHeader title="Por cobrar" count={upcomingInvoices.length} linkTo="/invoices" />
            {upcomingInvoices.length === 0 ? (
              <EmptyRow
                icon={FileText}
                text="No tenés facturas por cobrar"
                cta="Ir a facturación"
                href="/invoices"
              />
            ) : (
              upcomingInvoices.slice(0, 8).map((inv: any) => {
                const state = urgency(inv);
                return (
                  <Link key={inv.id} href={`/invoices`}>
                    <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                      <StatusDot
                        status={state === "overdue" ? "NEW" : state === "soon" ? "PENDING" : "RESOLVED"}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground truncate">
                          {inv.client_name || `#${inv.id?.slice(0, 8)}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {state === "overdue"
                            ? `Vencida ${formatDistanceToNow(new Date(inv.due_date), { addSuffix: true, locale: es })}`
                            : `Vence ${formatDistanceToNow(new Date(inv.due_date), { addSuffix: true, locale: es })}`}
                        </p>
                      </div>
                      <span className="text-[13px] font-medium text-foreground tabular-nums shrink-0">
                        {crc(Number(inv.balance_due ?? inv.amount) || 0)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* ── Activity ────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card dash-card">
          <SectionHeader title="Actividad reciente" linkTo="/inbox" />
          {convList.length === 0 ? (
            <EmptyRow
              icon={MessageCircle}
              text="Sin actividad reciente"
              cta="Conectar un canal"
              href="/settings?tab=channels"
            />
          ) : (
            convList.slice(0, 5).map((conv: any) => (
              <Link key={conv.id} href={`/inbox/${conv.id}`}>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <StatusDot status={conv.status} />
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shrink-0">
                    {conv.contact?.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] text-foreground truncate">
                        {conv.contact?.full_name || "Sin nombre"}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {CONV_STATUS[conv.status] || conv.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {conv.subject || conv.last_message_preview || "Sin asunto"}
                    </p>
                  </div>
                  {conv.updated_at && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: es })}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
