import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { canAccessAppFeature } from "@/lib/app-access";
import { hasPermission, Permission } from "@/lib/permissions";
import { Button } from "@/components/arc/button/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeShortcuts } from "@/components/home/home-shortcuts";
import { SetupChecklist } from "@/components/shared/setup-checklist";
import type { TaskRecord } from "@/components/tasks/task-model";
import { priorityLabels } from "@/components/tasks/task-model";

type QueryState = {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => unknown;
};
type Page<T> = { data: T[]; meta: { total: number } };
type Conversation = {
  id: string;
  subject?: string;
  messages?: { body_text?: string }[];
  contact?: { full_name: string };
  updated_at?: string;
};
type Invoice = {
  id: string;
  number?: string;
  currency: string;
  amount: number | string;
  balance_due: number;
  due_date?: string;
  contact?: { full_name: string; company_name?: string };
};
type Stage = {
  id: string;
  name: string;
  deals: { id: string; value: number | string | null; currency: string }[];
};

function RemoteSection({
  title,
  href,
  query,
  children,
}: {
  title: string;
  href?: string;
  query: QueryState;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const es = locale === "es";
  return (
    <section
      aria-label={title}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-primary/90 hover:text-primary"
          >
            {es ? "Ver todo" : "View all"}
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {query.isLoading ? (
        <div role="status" className="space-y-3 px-4 pb-5">
          <span className="sr-only">{es ? "Cargando…" : "Loading…"}</span>
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-2 px-4 pb-5">
          <p className="text-sm">
            {es
              ? "No se pudo cargar esta información."
              : "This information could not be loaded."}
          </p>
          <Button
            variant="secondary"
            className="min-h-12 rounded-xl"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {es ? "Reintentar" : "Try again"}
          </Button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function PulseMetric({
  label,
  value,
  href,
  query,
  icon: Icon,
}: {
  label: string;
  value?: number;
  href: string;
  query: QueryState;
  icon?: typeof Inbox;
}) {
  const { locale } = useI18n();
  return (
    <Link
      href={href}
      className="mobile-tab group relative flex flex-1 flex-col justify-center gap-2.5 px-3 py-3.5 first:pl-0 last:pr-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-background/5"
      aria-label={`${label}: ${query.isError || value == null ? "—" : value}`}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="h-4.5 w-4.5 shrink-0 text-foreground/45 transition-colors group-hover:text-foreground/80"
            strokeWidth={1.75}
          />
        )}
        {query.isLoading ? (
          <span aria-hidden="true" className="block h-7 w-14 rounded bg-background/15" />
        ) : (
          <p className="flex items-center gap-2 text-3xl font-bold tabular-nums leading-none sm:text-4xl">
            {query.isError || value == null
              ? "—"
              : new Intl.NumberFormat(locale).format(value)}
            {query.isFetching && (
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-foreground/40" />
            )}
          </p>
        )}
      </div>
      <span className="text-xs leading-tight text-foreground/60 transition-colors group-hover:text-foreground/80">{label}</span>
      {query.isError && (
        <span className="block text-[10.5px] leading-tight text-foreground/75">
          {locale === "es" ? "No disponible" : "Unavailable"}
        </span>
      )}
    </Link>
  );
}

function AttentionBanner({
  severity,
  icon: Icon,
  text,
  href,
}: {
  severity: "critical" | "warning" | "info";
  icon: typeof AlertTriangle;
  text: string;
  href: string;
}) {
  const rail =
    severity === "critical"
      ? "bg-destructive"
      : severity === "warning"
        ? "bg-warning"
        : "bg-info";
  const surface =
    severity === "critical"
      ? "bg-destructive/8"
      : severity === "warning"
        ? "bg-warning/8"
        : "bg-info/8";
  const iconColor =
    severity === "critical"
      ? "text-destructive"
      : severity === "warning"
        ? "text-warning"
        : "text-info";
  return (
    <Link
      href={href}
      className={["mobile-tab relative flex min-h-13 items-center gap-3 overflow-hidden rounded-xl border border-border py-3 pl-5 pr-4 hover:brightness-105", surface].join(" ")}
    >
      <span aria-hidden="true" className={"absolute inset-y-0 left-0 w-1 " + rail} />
      <Icon aria-hidden="true" className={"h-5 w-5 shrink-0 " + iconColor} strokeWidth={1.75} />
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{text}</span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground/70" />
    </Link>
  );
}

export default function DashboardPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { locale } = useI18n();
  const es = locale === "es";
  const workspaceId = user?.workspace.id;
  const features = useQuery({
    queryKey: ["/api/workspaces/current/features", workspaceId],
    queryFn: api.getCurrentFeatures,
    staleTime: 120000,
  });
  const can = (key: string) =>
    features.isSuccess &&
    canAccessAppFeature(key, user, features.data?.features);
  const inboxAllowed = can("inbox");
  const tasksAllowed = can("tasks");
  const invoicesAllowed = can("invoices");
  const pipelineAllowed = can("pipeline");
  const summaryAllowed = can("agents");
  const canSetup = hasPermission(
    user?.role ?? "",
    Permission.WORKSPACE_UPDATE,
    !!user?.is_platform_admin,
  );
  const today = useQuery({
    queryKey: ["/api/workspaces/current/stats/today", workspaceId],
    queryFn: api.getTodayStats,
    enabled: inboxAllowed,
    refetchInterval: 60000,
  });
  const conversations = useQuery({
    queryKey: ["/api/conversations", "home", workspaceId],
    queryFn: () =>
      api.getConversations({ limit: "5" }) as unknown as Promise<
        Page<Conversation>
      >,
    enabled: inboxAllowed,
    refetchInterval: 30000,
  });
  const tasks = useQuery({
    queryKey: ["/api/tasks", "home", workspaceId],
    queryFn: () =>
      api.getTasks({ limit: "5" }) as unknown as Promise<Page<TaskRecord>>,
    enabled: tasksAllowed,
  });
  const invoices = useQuery({
    queryKey: ["/api/invoices", "home", workspaceId],
    queryFn: () =>
      api.getInvoices({ limit: "1" }) as unknown as Promise<Page<Invoice>>,
    enabled: invoicesAllowed,
    refetchInterval: 120000,
  });
  const overdue = useQuery({
    queryKey: ["/api/invoices", "home-overdue", workspaceId],
    queryFn: () =>
      api.getInvoices({
        limit: "5",
        overdue_only: "true",
      }) as unknown as Promise<Page<Invoice>>,
    enabled: invoicesAllowed,
    refetchInterval: 120000,
  });
  const pipeline = useQuery({
    queryKey: ["/api/pipeline/stages", workspaceId],
    queryFn: () => api.getPipelineStages() as unknown as Promise<Stage[]>,
    enabled: pipelineAllowed,
    refetchInterval: 120000,
  });
  const summaryKey = ["/api/summaries/daily/today", workspaceId];
  const summary = useQuery({
    queryKey: summaryKey,
    queryFn: async () => {
      try {
        return await api.getTodaySummary();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: summaryAllowed,
    staleTime: 300000,
    retry: false,
  });
  const generate = useMutation({
    mutationFn: api.generateSummary,
    onSuccess: (value) => queryClient.setQueryData(summaryKey, value),
  });

  const queries = [
    features,
    ...(inboxAllowed ? [today, conversations] : []),
    ...(tasksAllowed ? [tasks] : []),
    ...(invoicesAllowed ? [invoices, overdue] : []),
    ...(pipelineAllowed ? [pipeline] : []),
    ...(summaryAllowed ? [summary] : []),
  ];
  const refreshing = queries.some((query) => query.isFetching);
  const taskList = tasks.data?.data ?? [];
  const invoiceList = overdue.data?.data ?? [];
  const stages = pipeline.data ?? [];
  const openDeals = stages.reduce(
    (count, stage) => count + stage.deals.length,
    0,
  );
  const overdueCount = overdue.data?.meta.total ?? 0;
  const unansweredCount = today.data?.unanswered_conversations ?? 0;
  const pendingTaskCount = tasks.data?.meta.total ?? 0;

  function dateLabel(value?: string | null) {
    if (!value) return es ? "Sin fecha" : "No date";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      return es ? "Fecha no disponible" : "Date unavailable";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  function money(value: number | string, currency: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || !currency)
      return es ? "Monto no disponible" : "Amount unavailable";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "code",
      }).format(amount);
    } catch {
      return es ? "Moneda no disponible" : "Currency unavailable";
    }
  }
  const hour = new Date().getHours();
  const greeting = es
    ? hour < 12
      ? "Buenos días"
      : hour < 19
        ? "Buenas tardes"
        : "Buenas noches"
    : hour < 12
      ? "Good morning"
      : hour < 19
        ? "Good afternoon"
        : "Good evening";
  const empty = (text: string) => (
    <p className="px-4 pb-5 text-sm text-muted-foreground">{text}</p>
  );

  return (
    <div className="home-page mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight">
            {user?.name?.split(" ")[0]}
          </h1>
        </div>
        <Button
          variant="secondary"
          className="min-h-12 rounded-xl"
          disabled={refreshing}
          onClick={() => queries.forEach((query) => void query.refetch())}
        >
          <RefreshCw
            aria-hidden="true"
            className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")}
          />
          {refreshing
            ? es
              ? "Actualizando…"
              : "Updating…"
            : es
              ? "Actualizar"
              : "Refresh"}
        </Button>
      </header>

      {features.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : features.isError ? (
        <div role="alert" className="rounded-xl border border-border p-5">
          <p>
            {es
              ? "No se pudo cargar el acceso a las funciones de tu espacio."
              : "Workspace feature access could not be loaded."}
          </p>
          <Button
            className="mt-3 min-h-12"
            onClick={() => void features.refetch()}
          >
            {es ? "Reintentar" : "Try again"}
          </Button>
        </div>
      ) : (
        <HomeShortcuts can={can} />
      )}

      {(inboxAllowed || tasksAllowed || invoicesAllowed) && (
        <section
          aria-label={es ? "Pulso operativo de hoy" : "Today's operational pulse"}
          className="-mx-4 bg-foreground text-background md:-mx-6 lg:-mx-8"
        >
          <div className="px-5 py-4 md:px-6 lg:px-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest opacity-70">
                {es ? "Hoy" : "Today"}
              </h2>
              <span className="text-xs tabular-nums opacity-60">
                {new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "short",
                }).format(new Date())}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 divide-x divide-foreground/12">
              {inboxAllowed && (
                <PulseMetric
                  label={es ? "Por responder" : "Awaiting reply"}
                  value={today.data?.unanswered_conversations}
                  href="/inbox"
                  query={today}
                  icon={Inbox}
                />
              )}
              {tasksAllowed && (
                <PulseMetric
                  label={es ? "Tareas" : "Tasks"}
                  value={tasks.data?.meta.total}
                  href="/tasks"
                  query={tasks}
                  icon={CheckSquare}
                />
              )}
              {invoicesAllowed && (
                <PulseMetric
                  label={es ? "Vencidas" : "Past due"}
                  value={overdue.data?.meta.total}
                  href="/invoices"
                  query={overdue}
                  icon={Receipt}
                />
              )}
            </div>
          </div>
          {(today.isError || overdue.isError) && (
            <div className="border-t border-background/20 px-5 py-2 md:px-6 lg:px-8">
              <button
                type="button"
                className="mobile-tab min-h-12 text-xs font-semibold underline-offset-2 hover:underline"
                onClick={() => {
                  if (inboxAllowed) void today.refetch();
                  if (invoicesAllowed) void overdue.refetch();
                }}
              >
                {es ? "Reintentar indicadores" : "Retry metrics"}
              </button>
            </div>
          )}
        </section>
      )}

      {(overdueCount > 0 || unansweredCount > 0 || pendingTaskCount > 0) && (
        <section
          aria-label={es ? "Necesita atención" : "Needs attention"}
          className="space-y-2"
        >
          {overdueCount > 0 && (
            <AttentionBanner
              severity="critical"
              icon={AlertTriangle}
              href="/invoices"
              text={
                overdueCount === 1
                  ? es
                    ? "1 factura con vencimiento pasado"
                    : "1 invoice past due"
                  : es
                    ? `${overdueCount} facturas con vencimiento pasado`
                    : `${overdueCount} invoices past due`
              }
            />
          )}
          {unansweredCount > 0 && (
            <AttentionBanner
              severity="warning"
              icon={Inbox}
              href="/inbox"
              text={
                unansweredCount === 1
                  ? es
                    ? "1 conversación sin responder"
                    : "1 conversation awaiting reply"
                  : es
                    ? `${unansweredCount} conversaciones sin responder`
                    : `${unansweredCount} conversations awaiting reply`
              }
            />
          )}
          {pendingTaskCount > 0 && (
            <AttentionBanner
              severity="info"
              icon={CheckSquare}
              href="/tasks"
              text={
                pendingTaskCount === 1
                  ? es
                    ? "1 tarea pendiente"
                    : "1 pending task"
                  : es
                    ? `${pendingTaskCount} tareas pendientes`
                    : `${pendingTaskCount} pending tasks`
              }
            />
          )}
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {tasksAllowed && (
          <RemoteSection
            title={es ? "Lo siguiente" : "Up next"}
            href="/tasks"
            query={tasks}
          >
            {taskList.length ? (
              <ul className="divide-y divide-border">
                {taskList.map((task) => (
                  <li key={task.id}>
                    <Link
                      href="/tasks"
                      className="mobile-tab flex min-h-20 items-center gap-3 px-4 py-4"
                    >
                      <CheckSquare
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold">
                          {task.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dateLabel(task.due_at)} ·{" "}
                          {priorityLabels[locale][
                            task.priority as keyof typeof priorityLabels.es
                          ] ?? task.priority}
                        </p>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              empty(
                es
                  ? "No hay tareas pendientes."
                  : "There are no pending tasks.",
              )
            )}
          </RemoteSection>
        )}
        {inboxAllowed && (
          <RemoteSection
            title={es ? "Conversaciones recientes" : "Recent conversations"}
            href="/inbox"
            query={conversations}
          >
            {conversations.data?.data.length ? (
              <ul className="divide-y divide-border">
                {conversations.data.data.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={"/inbox/" + conversation.id}
                      className="mobile-tab flex min-h-20 items-center gap-3 px-4 py-4"
                    >
                      <Inbox aria-hidden="true" className="h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {conversation.contact?.full_name ??
                            (es ? "Sin nombre" : "Unnamed")}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {conversation.messages?.[0]?.body_text ||
                            conversation.subject ||
                            (es ? "Abrir conversación" : "Open conversation")}
                        </p>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              empty(
                es
                  ? "Todavía no hay conversaciones."
                  : "There are no conversations yet.",
              )
            )}
          </RemoteSection>
        )}
        {invoicesAllowed && (
          <RemoteSection
            title={es ? "Revisar vencimientos" : "Review due dates"}
            href="/invoices"
            query={overdue}
          >
            {invoiceList.length ? (
              <>
                <p className="px-4 pb-3 text-sm text-muted-foreground">
                  {es
                    ? "Primeras facturas con fecha de vencimiento pasada."
                    : "First invoices whose due date has passed."}
                </p>
                <ul className="divide-y divide-border">
                  {invoiceList.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        href="/invoices"
                        className="mobile-tab flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-semibold">
                            {invoice.contact?.full_name ||
                              invoice.contact?.company_name ||
                              invoice.number ||
                              invoice.id.slice(0, 8)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {dateLabel(invoice.due_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {es ? "Total factura" : "Invoice total"}
                          </p>
                          <p className="font-semibold tabular-nums">
                            {money(invoice.amount, invoice.currency)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              empty(
                es
                  ? "No hay facturas con vencimiento pasado."
                  : "No invoices have a past due date.",
              )
            )}
          </RemoteSection>
        )}
        {pipelineAllowed && (
          <RemoteSection
            title={es ? "Ventas abiertas" : "Open sales"}
            href="/pipeline"
            query={pipeline}
          >
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              {openDeals} {es ? "oportunidades abiertas" : "open opportunities"}
            </p>
            <ul className="divide-y divide-border">
              {stages.map((stage) => {
                const byCurrency = new Map<string, number>();
                for (const deal of stage.deals)
                  if (
                    deal.currency &&
                    deal.value != null &&
                    Number.isFinite(Number(deal.value))
                  )
                    byCurrency.set(
                      deal.currency,
                      (byCurrency.get(deal.currency) ?? 0) + Number(deal.value),
                    );
                return (
                  <li key={stage.id}>
                    <Link
                      href="/pipeline"
                      className="mobile-tab flex min-h-16 items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 break-words font-medium">
                        {stage.name}
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">
                          {stage.deals.length}
                        </span>
                        {[...byCurrency].map(([currency, total]) => (
                          <span
                            key={currency}
                            className="block text-sm text-muted-foreground"
                          >
                            {money(total, currency)}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </RemoteSection>
        )}
      </div>

      {summaryAllowed && (
        <RemoteSection
          title={es ? "Resumen del día" : "Daily summary"}
          query={summary}
        >
          <div className="space-y-4 px-4 pb-5">
            {summary.data?.generated_text ? (
              <p className="whitespace-pre-line break-words text-sm leading-relaxed">
                {summary.data.generated_text}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {es
                  ? "Todavía no has generado el resumen de hoy."
                  : "Today's summary has not been generated yet."}
              </p>
            )}
            {generate.error && (
              <p role="alert" className="text-sm text-destructive">
                {generate.error.message}
              </p>
            )}
            <Button
              variant="secondary"
              className="min-h-12 rounded-xl"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              )}
              {generate.isPending
                ? es
                  ? "Preparando…"
                  : "Preparing…"
                : es
                  ? "Generar resumen"
                  : "Generate summary"}
            </Button>
          </div>
        </RemoteSection>
      )}
      {canSetup && <SetupChecklist />}
    </div>
  );
}
