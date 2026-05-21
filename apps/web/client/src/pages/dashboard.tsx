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
  Bot,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Loader2,
  MessageCircle,
  Receipt,
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

function toneClasses(tone: Tone) {
  switch (tone) {
    case "danger":
      return {
        dot: "bg-red-500",
        text: "text-red-600",
        bg: "bg-red-500/5",
        border: "border-red-500/20",
      };
    case "warning":
      return {
        dot: "bg-amber-500",
        text: "text-amber-700",
        bg: "bg-amber-500/5",
        border: "border-amber-500/20",
      };
    case "success":
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-700",
        bg: "bg-emerald-500/5",
        border: "border-emerald-500/20",
      };
    default:
      return {
        dot: "bg-muted-foreground/45",
        text: "text-muted-foreground",
        bg: "bg-transparent",
        border: "border-border",
      };
  }
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = toneClasses(tone);
  return (
    <span className={`inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium ${t.bg} ${t.border} ${t.text}`}>
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
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
          {count != null && <span className="ml-2 font-normal text-muted-foreground/60">{count}</span>}
        </h2>
      </div>
      {linkTo && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />}
    </div>
  );

  return (
    <section className={`overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      {linkTo ? (
        <Link href={linkTo} className="block transition-colors hover:bg-muted/25">
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
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  loading?: boolean;
}) {
  const t = toneClasses(tone);

  return (
    <div className={`rounded-lg border bg-card px-4 py-3 ${t.border}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <div className="text-2xl font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">
          {value}
        </div>
      )}
      {detail && <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
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
        <Icon className="h-4 w-4 text-muted-foreground/45" />
        <span className="text-sm text-muted-foreground">{emptyText}</span>
        {emptyCta && emptyHref && (
          <Link href={emptyHref} className="text-xs font-medium text-primary hover:text-primary/80">
            {emptyCta}
          </Link>
        )}
      </div>
    );
  }

  return <div className="divide-y divide-border">{children}</div>;
}

function RowStatus({ tone }: { tone: Tone }) {
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneClasses(tone).dot}`} />;
}

function PipelineBand({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;

  const maxDeals = Math.max(...stages.map((stage) => stage.deals.length), 1);

  return (
    <DashboardSection title="Pipeline abierto" count={stages.reduce((sum, stage) => sum + stage.deals.length, 0)} linkTo="/pipeline">
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {stages.slice(0, 4).map((stage) => {
          const count = stage.deals.length;
          const value = stage.deals.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
          const width = `${Math.max(8, (count / maxDeals) * 100)}%`;

          return (
            <Link key={stage.id} href="/pipeline" className="bg-card px-4 py-3 transition-colors hover:bg-muted/25">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="truncate text-sm font-medium text-foreground">{stage.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{crc(value)}</p>
                </div>
                <span className="text-xl font-semibold tabular-nums text-foreground">{count}</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/45" style={{ width }} />
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
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground md:text-2xl">
                {greeting()}, {user?.name?.split(" ")[0] || "Usuario"}
              </h1>
              <StatusPill
                label={
                  operatingTone === "danger"
                    ? "Requiere atención"
                    : operatingTone === "warning"
                      ? "Vigilar hoy"
                      : "Operación estable"
                }
                tone={operatingTone}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
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
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bot className="h-3.5 w-3.5" />
            )}
            Resumen IA
          </Button>
        </header>

        {(summaryLoading || statsLoading || todaySummary?.generated_text || generateMutation.isPending) && (
          <section className="rounded-lg border border-border bg-card px-4 py-3">
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OperationalMetric
            label="Por cobrar"
            value={crc(totalOutstanding)}
            detail={`${outstandingInvoices.length} facturas abiertas`}
            tone={overdueInvoices.length > 0 ? "danger" : totalOutstanding > 0 ? "warning" : "success"}
            loading={statsLoading}
          />
          <OperationalMetric
            label="Vencidas"
            value={String(overdueInvoices.length)}
            detail={overdueInvoices.length > 0 ? `${crc(overdueInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.balance_due ?? inv.amount) || 0), 0))} atrasado` : "Sin atraso"}
            tone={overdueInvoices.length > 0 ? "danger" : "success"}
            loading={statsLoading}
          />
          <OperationalMetric
            label="Pipeline abierto"
            value={String(pipelineTotalDeals)}
            detail={pipelineTotalDeals > 0 ? crc(pipelineTotalValue) : "Sin negocios activos"}
            tone="neutral"
            loading={pipelineLoading}
          />
          <OperationalMetric
            label="Mensajes sin atender"
            value={String(unreadCount)}
            detail={urgentTasks.length > 0 ? `${urgentTasks.length} tareas urgentes` : "Sin alerta crítica"}
            tone={unreadCount > 0 ? "warning" : "success"}
            loading={statsLoading}
          />
        </section>

        {!pipelineLoading && activeStages.length > 0 && <PipelineBand stages={activeStages} />}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
          <div className="space-y-5">
            <DashboardSection title="Actividad reciente" count={convList.length} linkTo="/inbox">
              <AttentionList
                isEmpty={convList.length === 0}
                emptyIcon={MessageCircle}
                emptyText="Sin actividad reciente"
                emptyCta="Conectar un canal"
                emptyHref="/settings?tab=channels"
              >
                {convList.slice(0, 7).map((conv: any) => {
                  const statusTone: Tone = conv.status === "NEW" || conv.status === "OPEN" ? "warning" : conv.status === "PENDING" ? "neutral" : "success";
                  return (
                    <Link key={conv.id} href={`/inbox/${conv.id}`} className="block transition-colors hover:bg-muted/25">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
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
                emptyText="No tenés facturas por cobrar"
                emptyCta="Ir a facturación"
                emptyHref="/invoices"
              >
                {priorityInvoices.slice(0, 6).map((inv: any) => {
                  const state = invoiceUrgency(inv);
                  const tone: Tone = state === "overdue" ? "danger" : state === "soon" ? "warning" : "neutral";
                  return (
                    <Link key={inv.id} href="/invoices" className="block transition-colors hover:bg-muted/25">
                      <div className="flex items-start gap-3 px-4 py-3">
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

            <DashboardSection title={urgentTasks.length > 0 ? "Tareas urgentes" : "Tareas pendientes"} count={urgentTasks.length || taskList.length} linkTo="/tasks">
              <AttentionList
                isEmpty={attentionTasks.length === 0}
                emptyIcon={CheckSquare}
                emptyText="No tenés tareas pendientes"
                emptyCta="Crear primera tarea"
                emptyHref="/tasks"
              >
                {attentionTasks.slice(0, 7).map((task: any) => {
                  const tone: Tone = task.priority === "HIGH" ? "danger" : task.priority === "MEDIUM" ? "warning" : "neutral";
                  return (
                    <Link key={task.id} href="/tasks" className="block transition-colors hover:bg-muted/25">
                      <div className="flex items-start gap-3 px-4 py-3">
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
                        {task.priority === "HIGH" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
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
