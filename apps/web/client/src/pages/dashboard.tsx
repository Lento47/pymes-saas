import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { SetupChecklist } from "@/components/shared/setup-checklist";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

/* ── Types ── */

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

interface DashInvoice {
  id: string;
  status?: string;
  collection_state?: string;
  due_date?: string | null;
  balance_due?: number | null;
  amount?: number;
  client_name?: string;
}

interface DashTask {
  id: string;
  title: string;
  priority?: string;
  due_date?: string | null;
}

type TodayStats = {
  unread_conversations?: number;
  open_conversations?: number;
  received_messages?: number;
};

type Tone = "neutral" | "danger" | "warning" | "success";

const ACTIVE_STAGES = ["Ganado", "Perdido"];

/* ── Helpers ── */

function crc(n: number): string {
  return n >= 1_000_000
    ? `₡${(n / 1_000_000).toFixed(1)}M`
    : `₡${n.toLocaleString("es-CR")}`;
}

function invoiceUrgency(inv: DashInvoice): "overdue" | "soon" | "ok" {
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

/* ── Tone → Badge variant ── */

const toneVariant: Record<Tone, "default" | "destructive" | "secondary" | "outline"> = {
  danger: "destructive",
  warning: "outline",
  success: "secondary",
  neutral: "secondary",
};

const toneDotClass: Record<Tone, string> = {
  danger: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-muted-foreground/40",
};

/* ── Shared Sub-components ── */

function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <Badge variant={toneVariant[tone]} className="gap-1.5 h-5 text-[11px] font-medium px-2">
      <span className={`h-1.5 w-1.5 rounded-full ${toneDotClass[tone]}`} />
      {label}
    </Badge>
  );
}

function MetricCard({
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
  const dotClass = toneDotClass[tone];

  const inner = (
    <Card className="group relative h-full transition-colors hover:bg-accent/50 cursor-pointer">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
        </div>

        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
            {value}
          </div>
        )}

        {detail && (
          <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
        )}

        {linkTo && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="h-3 w-3 text-muted-foreground/40" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return linkTo ? <Link href={linkTo}>{inner}</Link> : inner;
}

function SectionCard({
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
  return (
    <Card className={className}>
      {linkTo ? (
        <Link href={linkTo}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-primary/[0.12] bg-primary/[0.03] px-4 py-3 cursor-pointer transition-colors hover:bg-primary/[0.06]">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              {title}
              {count != null && (
                <span className="font-normal text-primary/40">{count}</span>
              )}
            </CardTitle>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary/50" />
          </CardHeader>
        </Link>
      ) : (
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-primary/[0.12] bg-primary/[0.03] px-4 py-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
            {title}
            {count != null && (
              <span className="font-normal text-primary/40">{count}</span>
            )}
          </CardTitle>
        </CardHeader>
      )}
      {children}
    </Card>
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
      <Icon className="h-5 w-5 text-primary/40" />
      <span className="text-sm text-muted-foreground">{text}</span>
      {cta && href && (
        <Link href={href} className="text-xs font-medium text-primary hover:text-primary/80">
          {cta}
        </Link>
      )}
    </div>
  );
}

function RowItem({ children, href }: { children: React.ReactNode; href?: string }) {
  const content = (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer hover:bg-accent/50">
      {children}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

const CONV_STATUS: Record<string, string> = {
  NEW: "Nuevo",
  OPEN: "Abierto",
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
};

/* ── Pipeline Band ── */

function PipelineBand({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;

  const maxDeals = Math.max(...stages.map((stage) => stage.deals.length), 1);

  return (
    <SectionCard
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
              <div className="px-4 py-3 transition-colors duration-150 cursor-pointer bg-card hover:bg-accent/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                      className="h-2 w-2 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: stage.color ?? "hsl(var(--primary))" }}
                    />
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
                    className="h-full rounded-full bg-primary/70 transition-all duration-500"
                    style={{ width }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ── Dashboard Page ── */

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

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/conversations", "dash"],
    queryFn: () => api.getConversations({ limit: "5" }),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", "dash"],
    queryFn: () => api.getTasks({ limit: "10" }),
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices", "dash"],
    queryFn: () => api.getInvoices({ limit: "50" }),
    refetchInterval: 120000,
  });

  /* ── Data processing ── */
  const t = (todayStats as TodayStats | undefined) ?? {};
  const pipelineStages: PipelineStage[] = Array.isArray(pipeline) ? pipeline : [];
  const activeStages = pipelineStages.filter((stage) => !ACTIVE_STAGES.includes(stage.name));
  const convList = Array.isArray(conversations) ? conversations : (conversations as { data?: unknown[] } | undefined)?.data ?? [];
  const taskList: DashTask[] = Array.isArray(tasks) ? tasks : (tasks as { data?: DashTask[] } | undefined)?.data ?? [];
  const allInvoices: DashInvoice[] = Array.isArray(invoicesData) ? invoicesData : (invoicesData as { data?: DashInvoice[] } | undefined)?.data ?? [];
  const outstandingInvoices = allInvoices.filter((inv) =>
    ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status ?? inv.collection_state ?? "")
  );
  const upcomingInvoices = [...outstandingInvoices].sort(
    (a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime()
  );
  const overdueInvoices = upcomingInvoices.filter((inv) => invoiceUrgency(inv) === "overdue");
  const soonInvoices = upcomingInvoices.filter((inv) => invoiceUrgency(inv) === "soon");
  const priorityInvoices = [...overdueInvoices, ...soonInvoices, ...upcomingInvoices.filter((inv) => invoiceUrgency(inv) === "ok")];
  const urgentTasks = taskList.filter((task) => task.priority === "HIGH");
  const attentionTasks = [...urgentTasks, ...taskList.filter((task) => task.priority !== "HIGH")];
  const pipelineTotalDeals = activeStages.reduce((sum, stage) => sum + stage.deals.length, 0);
  const pipelineTotalValue = activeStages.reduce(
    (sum, stage) => sum + stage.deals.reduce((stageSum, deal) => stageSum + (Number(deal.value) || 0), 0),
    0,
  );
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (Number(inv.balance_due ?? inv.amount) || 0), 0);
  const unreadCount = Number(t.unread_conversations ?? t.open_conversations ?? t.received_messages ?? 0);
  const operatingTone: Tone = overdueInvoices.length > 0 || urgentTasks.length > 0 ? "danger" : soonInvoices.length > 0 ? "warning" : "success";

  return (
    <div className="min-h-full bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 lg:px-8">

        {/* ── Header ── */}
        <header className="flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-[-0.03em] text-foreground md:text-2xl">
                {greeting()},{" "}
                <span className="text-primary">
                  {user?.name?.split(" ")[0] || "Usuario"}
                </span>
              </h1>
              {(operatingTone === "danger" || operatingTone === "warning") && (
                <StatusBadge
                  label={operatingTone === "danger" ? "Facturas vencidas" : "Facturas próximas a vencer"}
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

        <Separator className="mb-1" />

        {/* ── AI Summary card ── */}
        {(summaryLoading || statsLoading || todaySummary?.generated_text || generateMutation.isPending) && (
          <Card>
            <CardContent className="px-4 py-3">
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
            </CardContent>
          </Card>
        )}

        {/* ── Metrics strip ── */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Por cobrar"
            value={crc(totalOutstanding)}
            detail={outstandingInvoices.length > 0 ? `${outstandingInvoices.length} facturas abiertas` : "Nada pendiente de cobro"}
            tone={overdueInvoices.length > 0 ? "danger" : "neutral"}
            loading={statsLoading}
            icon={Wallet}
            linkTo="/invoices"
          />
          <MetricCard
            label="Vencidas"
            value={String(overdueInvoices.length)}
            detail={overdueInvoices.length > 0
              ? `${crc(overdueInvoices.reduce((sum, inv) => sum + (Number(inv.balance_due ?? inv.amount) || 0), 0))} atrasado`
              : "Todo cobrado al día"}
            tone={overdueInvoices.length > 0 ? "danger" : "neutral"}
            loading={statsLoading}
            icon={Receipt}
            linkTo="/invoices"
          />
          <MetricCard
            label="Ventas abiertas"
            value={String(pipelineTotalDeals)}
            detail={pipelineTotalDeals > 0 ? crc(pipelineTotalValue) : "Sin tratos en el pipeline"}
            tone="neutral"
            loading={pipelineLoading}
            icon={KanbanSquare}
            linkTo="/pipeline"
          />
          <MetricCard
            label="Sin atender"
            value={String(unreadCount)}
            detail={urgentTasks.length > 0 ? `${urgentTasks.length} tareas urgentes` : "Todo atendido"}
            tone={unreadCount > 0 ? "warning" : "neutral"}
            loading={statsLoading}
            icon={MessageCircle}
            linkTo="/inbox"
          />
        </section>

        {/* ── Pipeline band ── */}
        {pipelineLoading ? (
          <Card>
            <CardContent className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 p-0 bg-primary/[0.08]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card px-4 py-3 space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-7 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : activeStages.length > 0 ? (
          <PipelineBand stages={activeStages} />
        ) : null}

        {/* ── Main grid ── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
          <div className="space-y-5">
            <SectionCard title="Actividad reciente" count={convsLoading ? undefined : convList.length} linkTo="/inbox">
              {convsLoading ? (
                <div className="divide-y divide-primary/[0.08]">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : convList.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  text="Ningún mensaje nuevo por ahora"
                  cta="Conectar un canal"
                  href="/settings?tab=channels"
                />
              ) : (
                <div className="divide-y divide-primary/[0.08]">
                  {(convList as Array<Record<string, unknown>>).slice(0, 7).map((conv) => {
                    const status = conv.status as string | undefined;
                    const statusTone: Tone = status === "NEW" || status === "OPEN" ? "warning" : status === "PENDING" ? "neutral" : "success";
                    return (
                      <RowItem key={conv.id as string} href={`/inbox/${conv.id as string}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {(conv.contact as { full_name?: string } | undefined)?.full_name || "Sin nombre"}
                            </p>
                            <span className="shrink-0 text-[11px] text-muted-foreground/70">
                              {CONV_STATUS[status ?? ""] || status}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {(conv.subject as string | undefined) || (conv.last_message_preview as string | undefined) || "Sin asunto"}
                          </p>
                        </div>
                        {conv.updated_at && (
                          <span className="hidden text-xs text-muted-foreground sm:block">
                            {formatDistanceToNow(new Date(conv.updated_at as string), { addSuffix: true, locale: es })}
                          </span>
                        )}
                      </RowItem>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="space-y-5">
            <SetupChecklist />

            <SectionCard title="Cobranza crítica" count={invoicesLoading ? undefined : priorityInvoices.length} linkTo="/invoices">
              {invoicesLoading ? (
                <div className="divide-y divide-primary/[0.08]">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-4 w-16 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : priorityInvoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  text="No hay facturas por vencer esta semana"
                  cta="Ir a facturación"
                  href="/invoices"
                />
              ) : (
                <div className="divide-y divide-primary/[0.08]">
                  {priorityInvoices.slice(0, 6).map((inv) => {
                    const state = invoiceUrgency(inv);
                    const tone: Tone = state === "overdue" ? "danger" : state === "soon" ? "warning" : "neutral";
                    return (
                      <RowItem key={inv.id} href="/invoices">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              label={state === "overdue" ? "Vencida" : state === "soon" ? "Próxima" : "Pendiente"}
                              tone={tone}
                            />
                            <p className="truncate text-sm font-medium text-foreground">
                              {inv.client_name || `#${inv.id?.slice(0, 8)}`}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dueText(inv.due_date, state === "overdue")}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {crc(Number(inv.balance_due ?? inv.amount ?? 0))}
                        </span>
                      </RowItem>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title={urgentTasks.length > 0 ? "Tareas urgentes" : "Tareas pendientes"}
              count={tasksLoading ? undefined : urgentTasks.length || taskList.length}
              linkTo="/tasks"
            >
              {tasksLoading ? (
                <div className="divide-y divide-primary/[0.08]">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : attentionTasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  text="Sin tareas asignadas por ahora"
                  cta="Crear primera tarea"
                  href="/tasks"
                />
              ) : (
                <div className="divide-y divide-primary/[0.08]">
                  {attentionTasks.slice(0, 7).map((task) => {
                    const tone: Tone = task.priority === "HIGH" ? "danger" : task.priority === "MEDIUM" ? "warning" : "neutral";
                    return (
                      <RowItem key={task.id} href="/tasks">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {task.priority === "HIGH" && (
                              <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                            )}
                            <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                          </div>
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
                          <StatusBadge label="Urgente" tone="danger" />
                        )}
                      </RowItem>
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
