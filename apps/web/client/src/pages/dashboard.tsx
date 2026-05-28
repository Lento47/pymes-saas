import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  CheckSquare,
  Clock3,
  FileText,
  KanbanSquare,
  Loader2,
  MessageCircle,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

type Tone = "neutral" | "danger" | "warning" | "success";

const ACTIVE_STAGES = ["Ganado", "Perdido"];

function crc(n: number): string {
  return n >= 1_000_000
    ? `₡${(n / 1_000_000).toFixed(1)}M`
    : `₡${n.toLocaleString("es-CR")}`;
}

function invoiceUrgency(inv: any): "overdue" | "soon" | "ok" {
  if (!inv?.due_date) return "ok";
  const days = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "ok";
}

function dueText(date: string | null | undefined, overdue = false): string {
  if (!date) return "Sin vencimiento";
  const relative = formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  return overdue ? `Vencida ${relative}` : `Vence ${relative}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function toneConfig(tone: Tone) {
  switch (tone) {
    case "danger":
      return {
        dot: "bg-red-500",
        text: "text-red-400",
        accent: "#ef4444",
        cardBg: "rgba(239,68,68,0.05)",
        cardBorder: "rgba(239,68,68,0.2)",
        pillBg: "rgba(239,68,68,0.08)",
        pillBorder: "rgba(239,68,68,0.25)",
        pillText: "#f87171",
      };
    case "warning":
      return {
        dot: "bg-orange-400",
        text: "text-orange-400",
        accent: "#fb923c",
        cardBg: "rgba(251,146,60,0.05)",
        cardBorder: "rgba(251,146,60,0.2)",
        pillBg: "rgba(251,146,60,0.08)",
        pillBorder: "rgba(251,146,60,0.25)",
        pillText: "#fb923c",
      };
    case "success":
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-400",
        accent: "#10b981",
        cardBg: "rgba(16,185,129,0.04)",
        cardBorder: "rgba(16,185,129,0.18)",
        pillBg: "rgba(16,185,129,0.08)",
        pillBorder: "rgba(16,185,129,0.2)",
        pillText: "#34d399",
      };
    default:
      return {
        dot: "bg-primary/50",
        text: "text-primary/70",
        accent: "hsl(var(--primary) / 0.5)",
        cardBg: "hsl(var(--primary) / 0.04)",
        cardBorder: "hsl(var(--primary) / 0.14)",
        pillBg: "hsl(var(--primary) / 0.08)",
        pillBorder: "hsl(var(--primary) / 0.2)",
        pillText: "hsl(var(--primary) / 0.9)",
      };
  }
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = toneConfig(tone);
  return (
    <span
      className="inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium"
      style={{ background: t.pillBg, borderColor: t.pillBorder, color: t.pillText }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

function DashboardSection({
  title,
  count,
  linkTo,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  linkTo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-primary/[0.12] bg-primary/[0.03] px-4 py-3">
      <h2 className="text-xs font-semibold text-foreground/60">
        {title}
        {count != null && (
          <span className="ml-2 font-normal text-primary/40">{count}</span>
        )}
      </h2>
      {linkTo && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary/50" />}
    </div>
  );

  return (
    <section
      className={`overflow-hidden rounded-card border border-primary/[0.14] bg-[hsl(var(--bg-card))] ${className}`}
    >
      {linkTo ? (
        <Link href={linkTo} className="block transition-colors" style={{ display: "block" }}>
          {header}
        </Link>
      ) : (
        header
      )}
      {children}
    </section>
  );
}

function OperationalMetric({
  label,
  value,
  detail,
  tone = "neutral",
  loading,
  icon: Icon,
  linkTo,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  loading?: boolean;
  icon?: React.ElementType;
  linkTo?: string;
}) {
  const t = toneConfig(tone);

  const inner = (
    <div
      className="rounded-card px-4 py-4 transition-all duration-200 h-full"
      style={{
        border: `1px solid ${t.cardBorder}`,
        background: t.cardBg,
        cursor: linkTo ? "pointer" : undefined,
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: t.accent, opacity: 0.7 }} />
        )}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div
          className="text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground"
        >
          {value}
        </div>
      )}

      {detail && (
        <p className="mt-2 truncate text-xs text-muted-foreground/60">
          {detail}
        </p>
      )}

      {linkTo && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );

  return linkTo ? (
    <Link href={linkTo} className="block group">{inner}</Link>
  ) : (
    inner
  );
}

function AttentionList({
  children,
  emptyIcon: Icon,
  emptyText,
  emptyCta,
  emptyHref,
  isEmpty,
}: {
  children: React.ReactNode;
  emptyIcon: React.ElementType;
  emptyText: string;
  emptyCta?: string;
  emptyHref?: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <Icon className="h-5 w-5 text-primary/40" />
        <span className="text-sm text-muted-foreground">{emptyText}</span>
        {emptyCta && emptyHref && (
          <Link href={emptyHref} className="text-xs font-medium text-primary hover:text-primary/80">
            {emptyCta}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-primary/[0.08]">
      {children}
    </div>
  );
}

function RowStatus(_props: { tone: Tone }) {
  return null;
}

function PipelineBand({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;

  const maxDeals = Math.max(...stages.map((stage) => stage.deals.length), 1);

  return (
    <DashboardSection
      title="Pipeline abierto"
      count={stages.reduce((sum, stage) => sum + stage.deals.length, 0)}
      linkTo="/pipeline"
    >
      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-primary/[0.08]">
        {stages.slice(0, 4).map((stage) => {
          const count = stage.deals.length;
          const value = stage.deals.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
          const width = `${Math.max(8, (count / maxDeals) * 100)}%`;

          return (
            <Link key={stage.id} href="/pipeline">
              <div className="px-4 py-3 transition-colors duration-150 cursor-pointer bg-[hsl(var(--bg-card))] hover:bg-primary/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary/50 border border-primary/30" />
                      <span className="truncate text-sm font-medium text-foreground">{stage.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{crc(value)}</p>
                  </div>
                  <span className="text-2xl font-bold tabular-nums tracking-[-0.03em] text-foreground">
                    {count}
                  </span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/[0.12]">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </DashboardSection>
  );
}

const CONV_STATUS: Record<string, string> = {
  NEW: "Nuevo",
  OPEN: "Abierto",
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
};

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

  const t = (todayStats as any) ?? {};
  const pipelineStages: PipelineStage[] = Array.isArray(pipeline) ? pipeline : [];
  const activeStages = pipelineStages.filter((stage) => !ACTIVE_STAGES.includes(stage.name));
  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const allInvoices: any[] = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data ?? [];
  const outstandingInvoices = allInvoices.filter((inv: any) =>
    ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status ?? inv.collection_state)
  );
  const upcomingInvoices = [...outstandingInvoices].sort(
    (a: any, b: any) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime()
  );

  const overdueInvoices = upcomingInvoices.filter((inv: any) => invoiceUrgency(inv) === "overdue");
  const soonInvoices = upcomingInvoices.filter((inv: any) => invoiceUrgency(inv) === "soon");
  const priorityInvoices = [...overdueInvoices, ...soonInvoices, ...upcomingInvoices.filter((inv: any) => invoiceUrgency(inv) === "ok")];
  const urgentTasks = taskList.filter((task: any) => task.priority === "HIGH");
  const attentionTasks = [
    ...urgentTasks,
    ...taskList.filter((task: any) => task.priority !== "HIGH"),
  ];
  const pipelineTotalDeals = activeStages.reduce((sum, stage) => sum + stage.deals.length, 0);
  const pipelineTotalValue = activeStages.reduce(
    (sum, stage) => sum + stage.deals.reduce((stageSum, deal) => stageSum + (Number(deal.value) || 0), 0),
    0,
  );
  const totalOutstanding = outstandingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.balance_due ?? inv.amount) || 0), 0);
  const unreadCount = Number(t.unread_conversations ?? t.open_conversations ?? t.received_messages ?? 0);
  const operatingTone: Tone = overdueInvoices.length > 0 || urgentTasks.length > 0 ? "danger" : soonInvoices.length > 0 ? "warning" : "success";

  return (
    <div className="min-h-full bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 lg:px-8">

        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-primary/[0.12] pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-[-0.03em] text-foreground md:text-2xl">
                {greeting()},{" "}
                <span className="text-primary">
                  {user?.name?.split(" ")[0] || "Usuario"}
                </span>
              </h1>
              {(operatingTone === "danger" || operatingTone === "warning") && (
                <StatusPill
                  label={operatingTone === "danger" ? "Tenés facturas vencidas" : "Mensajes sin responder"}
                  tone={operatingTone}
                />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-fit gap-2 border-primary/25 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] text-xs"
            onClick={() => void generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BrainCircuit className="h-3.5 w-3.5" />
            )}
            Resumen del día
          </Button>
        </header>

        {/* AI Summary card */}
        {(summaryLoading || statsLoading || todaySummary?.generated_text || generateMutation.isPending) && (
          <section className="rounded-card border border-primary/20 bg-primary/[0.05] px-4 py-3">
            {summaryLoading || statsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            ) : todaySummary?.generated_text ? (
              <div className="flex gap-3">
                <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <p className="text-sm leading-relaxed text-foreground/80">
                  {todaySummary.generated_text}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-primary/80">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando el resumen...
              </div>
            )}
          </section>
        )}

        {/* Metrics strip */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OperationalMetric
            label="Por cobrar"
            value={crc(totalOutstanding)}
            detail={outstandingInvoices.length > 0 ? `${outstandingInvoices.length} facturas abiertas` : "Nada pendiente de cobro"}
            tone={overdueInvoices.length > 0 ? "danger" : "neutral"}
            loading={statsLoading}
            icon={Wallet}
            linkTo="/invoices"
          />
          <OperationalMetric
            label="Vencidas"
            value={String(overdueInvoices.length)}
            detail={overdueInvoices.length > 0
              ? `${crc(overdueInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.balance_due ?? inv.amount) || 0), 0))} atrasado`
              : "Todo cobrado al día"}
            tone={overdueInvoices.length > 0 ? "danger" : "neutral"}
            loading={statsLoading}
            icon={Receipt}
            linkTo="/invoices"
          />
          <OperationalMetric
            label="Ventas abiertas"
            value={String(pipelineTotalDeals)}
            detail={pipelineTotalDeals > 0 ? crc(pipelineTotalValue) : "Sin tratos en el pipeline"}
            tone="neutral"
            loading={pipelineLoading}
            icon={KanbanSquare}
            linkTo="/pipeline"
          />
          <OperationalMetric
            label="Sin atender"
            value={String(unreadCount)}
            detail={urgentTasks.length > 0 ? `${urgentTasks.length} tareas urgentes` : "Todo atendido"}
            tone={unreadCount > 0 ? "warning" : "neutral"}
            loading={statsLoading}
            icon={MessageCircle}
            linkTo="/inbox"
          />
        </section>

        {/* Pipeline band */}
        {!pipelineLoading && activeStages.length > 0 && <PipelineBand stages={activeStages} />}

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
          <div className="space-y-5">
            <DashboardSection title="Actividad reciente" count={convList.length} linkTo="/inbox">
              <AttentionList
                isEmpty={convList.length === 0}
                emptyIcon={MessageCircle}
                emptyText="Ningún mensaje nuevo por ahora"
                emptyCta="Conectar un canal"
                emptyHref="/settings?tab=channels"
              >
                {convList.slice(0, 7).map((conv: any) => {
                  const statusTone: Tone = conv.status === "NEW" || conv.status === "OPEN" ? "warning" : conv.status === "PENDING" ? "neutral" : "success";
                  return (
                    <Link key={conv.id} href={`/inbox/${conv.id}`}>
                      <div
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer hover:bg-primary/[0.06]"
                      >
                        <RowStatus tone={statusTone} />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {conv.contact?.full_name || "Sin nombre"}
                            </p>
                            <span className="shrink-0 text-[11px] text-muted-foreground/70">
                              {CONV_STATUS[conv.status] || conv.status}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {conv.subject || conv.last_message_preview || "Sin asunto"}
                          </p>
                        </div>
                        {conv.updated_at && (
                          <span className="hidden text-xs text-muted-foreground sm:block">
                            {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: es })}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </AttentionList>
            </DashboardSection>
          </div>

          <aside className="space-y-5">
            <DashboardSection title="Cobranza crítica" count={priorityInvoices.length} linkTo="/invoices">
              <AttentionList
                isEmpty={priorityInvoices.length === 0}
                emptyIcon={Receipt}
                emptyText="No hay facturas por vencer esta semana"
                emptyCta="Ir a facturación"
                emptyHref="/invoices"
              >
                {priorityInvoices.slice(0, 6).map((inv: any) => {
                  const state = invoiceUrgency(inv);
                  const tone: Tone = state === "overdue" ? "danger" : state === "soon" ? "warning" : "neutral";
                  return (
                    <Link key={inv.id} href="/invoices">
                      <div
                        className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer hover:bg-primary/[0.06]"
                      >
                        <RowStatus tone={tone} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {inv.client_name || `#${inv.id?.slice(0, 8)}`}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {dueText(inv.due_date, state === "overdue")}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {crc(Number(inv.balance_due ?? inv.amount) || 0)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </AttentionList>
            </DashboardSection>

            <DashboardSection
              title={urgentTasks.length > 0 ? "Tareas urgentes" : "Tareas pendientes"}
              count={urgentTasks.length || taskList.length}
              linkTo="/tasks"
            >
              <AttentionList
                isEmpty={attentionTasks.length === 0}
                emptyIcon={CheckSquare}
                emptyText="Sin tareas asignadas por ahora"
                emptyCta="Crear primera tarea"
                emptyHref="/tasks"
              >
                {attentionTasks.slice(0, 7).map((task: any) => {
                  const tone: Tone = task.priority === "HIGH" ? "danger" : task.priority === "MEDIUM" ? "warning" : "neutral";
                  return (
                    <Link key={task.id} href="/tasks">
                      <div
                        className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer hover:bg-primary/[0.06]"
                      >
                        <RowStatus tone={tone} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            <span className="truncate">
                              {task.due_date
                                ? formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })
                                : "Sin fecha"}
                            </span>
                          </div>
                        </div>
                        {task.priority === "HIGH" && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </AttentionList>
            </DashboardSection>
          </aside>
        </div>
      </main>
    </div>
  );
}
