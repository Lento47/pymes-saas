import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  CheckSquare,
  Clock3,
  KanbanSquare,
  Loader2,
  MessageCircle,
  Receipt,
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

function tone(t: Tone) {
  switch (t) {
    case "danger":  return { dot: "bg-red-500",         value: "text-red-400",    cardBorder: "border-red-500/20",    cardBg: "bg-red-500/[0.04]",    bar: "bg-red-500",         pill: "border-red-500/25 bg-red-500/[0.07] text-red-400" };
    case "warning": return { dot: "bg-orange-400",      value: "text-orange-400", cardBorder: "border-orange-500/20", cardBg: "bg-orange-500/[0.04]", bar: "bg-orange-400",      pill: "border-orange-400/25 bg-orange-400/[0.07] text-orange-400" };
    case "success": return { dot: "bg-emerald-500",     value: "text-foreground", cardBorder: "border-border",        cardBg: "bg-card",              bar: "bg-emerald-500/60",  pill: "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400" };
    default:        return { dot: "bg-muted-foreground/40", value: "text-foreground", cardBorder: "border-border",   cardBg: "bg-card",              bar: "bg-primary/40",      pill: "border-border bg-card text-muted-foreground" };
  }
}

function StatusPill({ label, t: toneKey = "neutral" }: { label: string; t?: Tone }) {
  const c = tone(toneKey);
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium", c.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {label}
    </span>
  );
}

function SectionCard({
  title,
  count,
  linkTo,
  children,
  className,
}: {
  title: string;
  count?: number;
  linkTo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
        {count != null && (
          <span className="ml-2 font-normal text-muted-foreground/50">{count}</span>
        )}
      </h2>
      {linkTo && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
    </div>
  );

  return (
    <section className={cn("overflow-hidden rounded-card border border-border bg-card", className)}>
      {linkTo ? (
        <Link href={linkTo} className="block hover:bg-muted/20 transition-colors">
          {header}
        </Link>
      ) : (
        header
      )}
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  t: toneKey = "neutral",
  loading,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  t?: Tone;
  loading?: boolean;
  icon?: React.ElementType;
}) {
  const c = tone(toneKey);
  return (
    <div className={cn("relative overflow-hidden rounded-card border px-4 py-4 transition-colors", c.cardBorder, c.cardBg)}>
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", c.bar)} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className={cn("text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums", c.value)}>
          {value}
        </p>
      )}
      {detail && <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  cta,
  href,
}: {
  icon: React.ElementType;
  text: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <Icon className="h-4 w-4 text-muted-foreground/40" />
      <span className="text-sm text-muted-foreground">{text}</span>
      {cta && href && (
        <Link href={href} className="text-xs font-medium text-primary hover:text-primary/80">
          {cta}
        </Link>
      )}
    </div>
  );
}

function StatusDot({ t: toneKey }: { t: Tone }) {
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone(toneKey).dot)} />;
}

function PipelineBand({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  const maxDeals = Math.max(...stages.map((s) => s.deals.length), 1);

  return (
    <SectionCard
      title="Pipeline abierto"
      count={stages.reduce((sum, s) => sum + s.deals.length, 0)}
      linkTo="/pipeline"
    >
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {stages.slice(0, 4).map((stage) => {
          const count = stage.deals.length;
          const value = stage.deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
          const pct = Math.max(8, (count / maxDeals) * 100);
          return (
            <Link key={stage.id} href="/pipeline" className="bg-card px-4 py-3 hover:bg-muted/25 transition-colors block">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{stage.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{crc(value)}</p>
                </div>
                <span className="text-2xl font-bold tabular-nums tracking-[-0.03em] text-foreground">{count}</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/50" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

const CONV_STATUS: Record<string, string> = {
  NEW: "Nuevo", OPEN: "Abierto", PENDING: "Pendiente", RESOLVED: "Resuelto",
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/summaries/daily/today"] }),
  });

  const { isLoading: statsLoading } = useQuery({
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
  const activeStages = pipelineStages.filter((s) => !ACTIVE_STAGES.includes(s.name));
  const convList = Array.isArray(conversations) ? conversations : conversations?.data ?? [];
  const taskList = Array.isArray(tasks) ? tasks : tasks?.data ?? [];
  const allInvoices: any[] = Array.isArray(invoicesData) ? invoicesData : invoicesData?.data ?? [];

  const outstandingInvoices = allInvoices.filter((inv) =>
    ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status ?? inv.collection_state)
  );
  const upcomingInvoices = [...outstandingInvoices].sort(
    (a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime()
  );
  const overdueInvoices  = upcomingInvoices.filter((inv) => invoiceUrgency(inv) === "overdue");
  const soonInvoices     = upcomingInvoices.filter((inv) => invoiceUrgency(inv) === "soon");
  const priorityInvoices = [...overdueInvoices, ...soonInvoices, ...upcomingInvoices.filter((inv) => invoiceUrgency(inv) === "ok")];

  const urgentTasks     = taskList.filter((task: any) => task.priority === "HIGH");
  const attentionTasks  = [...urgentTasks, ...taskList.filter((task: any) => task.priority !== "HIGH")];
  const pipelineTotalDeals = activeStages.reduce((sum, s) => sum + s.deals.length, 0);
  const pipelineTotalValue = activeStages.reduce(
    (sum, s) => sum + s.deals.reduce((ss, d) => ss + (Number(d.value) || 0), 0), 0,
  );
  const totalOutstanding = outstandingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.balance_due ?? inv.amount) || 0), 0);
  const unreadCount      = Number(t.unread_conversations ?? t.open_conversations ?? t.received_messages ?? 0);
  const operatingTone: Tone = overdueInvoices.length > 0 || urgentTasks.length > 0 ? "danger"
    : soonInvoices.length > 0 ? "warning" : "success";

  return (
    <div className="min-h-full bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 lg:px-8">

        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground md:text-2xl">
                {greeting()}, {user?.name?.split(" ")[0] || "Usuario"}
              </h1>
              <StatusPill
                label={
                  operatingTone === "danger" ? "Atención requerida"
                  : operatingTone === "warning" ? "Revisar hoy"
                  : "Sin pendientes críticos"
                }
                t={operatingTone}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-fit gap-2 text-xs text-muted-foreground"
            onClick={() => void generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <BrainCircuit className="h-3.5 w-3.5" />}
            Resumen IA
          </Button>
        </header>

        {/* AI Summary */}
        {(summaryLoading || statsLoading || todaySummary?.generated_text || generateMutation.isPending) && (
          <section className="rounded-card border border-primary/20 bg-primary/[0.04] px-4 py-3">
            {summaryLoading || statsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            ) : todaySummary?.generated_text ? (
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm leading-relaxed text-foreground/90">{todaySummary.generated_text}</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando resumen operativo...
              </div>
            )}
          </section>
        )}

        {/* Metrics */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Por cobrar"
            value={crc(totalOutstanding)}
            detail={`${outstandingInvoices.length} facturas abiertas`}
            t={overdueInvoices.length > 0 ? "danger" : "neutral"}
            loading={statsLoading}
            icon={Wallet}
          />
          <MetricCard
            label="Vencidas"
            value={String(overdueInvoices.length)}
            detail={overdueInvoices.length > 0
              ? `${crc(overdueInvoices.reduce((s: number, inv: any) => s + (Number(inv.balance_due ?? inv.amount) || 0), 0))} atrasado`
              : "Sin atraso"}
            t={overdueInvoices.length > 0 ? "danger" : "neutral"}
            loading={statsLoading}
            icon={Receipt}
          />
          <MetricCard
            label="Pipeline abierto"
            value={String(pipelineTotalDeals)}
            detail={pipelineTotalDeals > 0 ? crc(pipelineTotalValue) : "Sin negocios activos"}
            t="neutral"
            loading={pipelineLoading}
            icon={KanbanSquare}
          />
          <MetricCard
            label="Sin atender"
            value={String(unreadCount)}
            detail={urgentTasks.length > 0 ? `${urgentTasks.length} tareas urgentes` : "Sin conversaciones pendientes"}
            t={unreadCount > 0 ? "warning" : "neutral"}
            loading={statsLoading}
            icon={MessageCircle}
          />
        </section>

        {/* Pipeline */}
        {!pipelineLoading && activeStages.length > 0 && <PipelineBand stages={activeStages} />}

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">

          {/* Conversations */}
          <SectionCard title="Actividad reciente" count={convList.length} linkTo="/inbox">
            {convList.length === 0 ? (
              <EmptyState icon={MessageCircle} text="Sin actividad reciente" cta="Conectar un canal" href="/settings/channels" />
            ) : (
              <div className="divide-y divide-border">
                {convList.slice(0, 7).map((conv: any) => {
                  const statusTone: Tone = conv.status === "NEW" || conv.status === "OPEN" ? "warning"
                    : conv.status === "PENDING" ? "neutral" : "success";
                  return (
                    <Link key={conv.id} href={`/inbox/${conv.id}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/25 transition-colors block"
                    >
                      <StatusDot t={statusTone} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {conv.contact?.full_name || "Sin nombre"}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground/60">
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
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <aside className="space-y-5">

            {/* Invoices */}
            <SectionCard title="Cobranza crítica" count={priorityInvoices.length} linkTo="/invoices">
              {priorityInvoices.length === 0 ? (
                <EmptyState icon={Receipt} text="No tenés facturas por cobrar" cta="Ir a facturación" href="/invoices" />
              ) : (
                <div className="divide-y divide-border">
                  {priorityInvoices.slice(0, 6).map((inv: any) => {
                    const state = invoiceUrgency(inv);
                    const t: Tone = state === "overdue" ? "danger" : state === "soon" ? "warning" : "neutral";
                    return (
                      <Link key={inv.id} href="/invoices"
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/25 transition-colors block"
                      >
                        <StatusDot t={t} />
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
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Tasks */}
            <SectionCard
              title={urgentTasks.length > 0 ? "Tareas urgentes" : "Tareas pendientes"}
              count={urgentTasks.length || taskList.length}
              linkTo="/tasks"
            >
              {attentionTasks.length === 0 ? (
                <EmptyState icon={CheckSquare} text="No tenés tareas pendientes" cta="Crear primera tarea" href="/tasks" />
              ) : (
                <div className="divide-y divide-border">
                  {attentionTasks.slice(0, 7).map((task: any) => {
                    const t: Tone = task.priority === "HIGH" ? "danger" : task.priority === "MEDIUM" ? "warning" : "neutral";
                    return (
                      <Link key={task.id} href="/tasks"
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/25 transition-colors block"
                      >
                        <StatusDot t={t} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {task.due_date
                                ? formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })
                                : "Sin fecha"}
                            </span>
                          </div>
                        </div>
                        {task.priority === "HIGH" && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>

          </aside>
        </div>
      </main>
    </div>
  );
}
