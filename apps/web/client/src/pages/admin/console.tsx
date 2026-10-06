import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Bike,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { PageTemplate } from "@/components/layout/page-template";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import {
  type AdminAction,
  type AdminBusinessRow,
  type AdminCourierRow,
  type AdminMetrics,
  type AdminOrderRow,
  type AdminSubscription,
  type AdminSupportTicketRow,
  type AdminUserRow,
  type AuditLogEntry,
  adminApi,
  BUSINESS_STATUSES,
  needsReason,
  REASON_MIN_LENGTH,
  type SubscriptionStatus,
} from "@/lib/admin";
import { CatalogueTab } from "./console-catalogue";
import { DateRangeFilter, useDateRange } from "./console-date-range";
import { ActivityPanel, OperatorPanel, SignupsPanel, seriesTotal, VolumePanel } from "./console-metrics";
import { TablePager } from "./console-pager";
import {
  type AdminListSort,
  directionLabel,
  flipDirection,
  LIST_SORT_OPTIONS,
  nextSort,
  type SortState,
  TICKET_SORT_OPTIONS,
  type TicketSort,
} from "./console-sort";
import { EmptyState, QueryErrorState } from "./console-states";
import { CONSOLE_TABS, resolveConsoleTab } from "./console-tabs";
import { useAdminPage } from "./use-admin-page";

/**
 * The platform console, on the marketplace API.
 *
 * ## The queue is the first tab on purpose
 *
 * `metrics.businesses.pendingVerification` is the number of shops that asked to be seen and
 * have not been answered, and it is the only thing on this screen with a deadline attached
 * to it — an unverified merchant is a merchant who signed up and got nothing. Everything
 * else here can wait a day; that cannot. So it is the first tab, it carries the count in its
 * label, and it is the tab the route opens on.
 *
 * ## Why a reason is asked for, and why only sometimes
 *
 * `REASON_REQUIRED_ACTIONS` in the service refuses those without one, and the check is
 * server-side so no caller can skip it. This page mirrors it with `needsReason` so the
 * person is asked *before* a round trip, and so a refusal is never a surprise. Verifying a
 * business is not on that list: it is the answer the merchant is waiting for, and asking a
 * reason for a yes would only teach people to type noise.
 *
 * ## Every button here is audited, so this page is thin
 *
 * Each mutation writes an `audit_log` row server-side with the actor and the before/after
 * values. The console does not record anything itself, which is why there is no
 * "add a note" field anywhere below: a second record of the same act is a second thing to
 * disagree with the first. The Audit tab is the read side of the one true record.
 */

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Sin verificar",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CLOSED: "Cerrado",
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  SUSPENDED: "bg-red-500/10 text-red-600 border-red-500/30",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status] ?? STATUS_CLASS.CLOSED}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency,
maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${minor} ${currency}`;
  }
}

function shortDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CR");
}

/**
 * One action, and the reason dialog when the action needs one.
 *
 * The dialog is a child of the row rather than of the page so it carries the row's own
 * name into its title — "Suspender Ferretería El Coco" says what is about to happen, which
 * is the only thing a confirmation has to do.
 */
function ActionButton({
  label,
  action,
  targetName,
  onRun,
  variant = "default",
  size = "sm",
}: {
  label: string;
  action: AdminAction;
  targetName: string;
  onRun: (reason?: string) => Promise<unknown>;
  variant?: "default" | "outline" | "destructive" | "secondary";
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const run = useMutation({
    mutationFn: async () => {
      if (!needsReason(action) || reason.trim().length > 0) {
        return onRun(reason.trim() || undefined);
      }
      throw new Error("Falta el motivo.");
    },
    onSuccess: async () => {
      setOpen(false);
      setReason("");
      toast({ title: "Listo", description: `${label} aplicado.` });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "No se pudo completar", description: error.message, variant: "destructive" });
    },
  });

  if (!needsReason(action)) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={run.isPending}
        // The row's own name is the context a screen reader is missing here: ten rows
        // that all say "Verificar" are ten buttons the listener cannot tell apart.
        aria-label={`${label}: ${targetName}`}
        onClick={() => run.mutate()}
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} aria-label={`${label}: ${targetName}`} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {label}: {targetName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {/*
                Was "No se puede deshacer desde aquí." — a claim about every action in this
                console, including the ones it had just made reversible: `user.suspend` and
                `user.revoke_admin` both have their counterpart on this same row now. A
                destructive dialog that lies about being irreversible is worse than one that
                says nothing, because the operator stops reading it.

                What replaces it is the part that is true of *all* of them: the act is
                recorded, with a name and a reason, and it outlives the screen.
              */}
              Esta acción queda en el registro de auditoría con tu nombre, y el motivo va
              con ella.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (obligatorio)"
            aria-label="Motivo"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reason.trim().length === 0 || run.isPending}
              onClick={() => run.mutate()}
            >
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The metrics query, in one hook.
 *
 * It was written out twice under the same key — once in `AdminConsole` for the queue badges,
 * once in `Metrics` for the tiles — and each copy carried its own `refetchInterval`. React
 * Query collapses that into one request, but two observers with two timers is not the same
 * as one, and the second `refetchInterval` is invisible until you go looking for it.
 */
function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: adminApi.metrics,
    refetchInterval: 30_000,
  });
}

/**
 * The KPI tiles, collapsed to one line until asked for.
 *
 * These eight tiles used to sit above every one of ten tabs, which meant the tab an operator
 * actually works in opened with two rows of platform-wide numbers above it and its own
 * content below the fold. The line that stays visible keeps the two numbers that change on
 * their own — the queue, and today's orders — because those are the ones worth glancing at,
 * and puts the four slow-moving counts one click away instead of always in the way.
 *
 * `query` arrives as a prop rather than being fetched here, so this component adds no
 * second observer to the metrics query. Passing `data` alone would have looked like the
 * same idea and left `isPending`/`isError` needing their own `useQuery` call — which is
 * exactly the duplicate this hook exists to remove.
 */
function Metrics({ query }: { query: UseQueryResult<AdminMetrics> }) {
  const { data: metrics, isPending, isError, isFetching, error, refetch } = query;
  const [open, setOpen] = useState(false);

  /*
    The operator's own identity and trail, as two queries rather than one endpoint.

    Both existed already — `viewer()` and `admin.auditLog({ actorId })` — and combining them
    server-side would mean a procedure whose only job is to join two things the client can
    already join, plus a schema to describe the join. The cost here is one extra round trip on
    a dashboard that is already fetching metrics; the benefit is that "my actions" stays
    available to any other screen that wants it.
  */
  const viewerQuery = useQuery({ queryKey: ["admin", "viewer"], queryFn: adminApi.viewer });
  const myActionsQuery = useQuery({
    queryKey: ["admin", "auditLog", "actor", viewerQuery.data?.id],
    // Not run until the id is known: filtering by `actorId: undefined` would ask for the
    // **whole** audit log — every operator's actions on the platform — and then render the
    // first five of them under the heading "Tu actividad".
    enabled: !!viewerQuery.data?.id,
    queryFn: () =>
      adminApi.auditLog({ actorId: viewerQuery.data?.id, limit: 5, sort: "newest", direction: "desc" }),
  });

  if (isPending) return <Skeleton className="h-9 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las métricas."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!metrics) return null;

  const tiles = [
    { label: "Negocios pendientes", value: metrics.businesses.pendingVerification, urgent: metrics.businesses.pendingVerification > 0, context: "Esperan verificación" },
    { label: "Negocios activos", value: metrics.businesses.active, context: "Publicados en el mercado" },
    { label: "Negocios suspendidos", value: metrics.businesses.suspended, context: "Cerrados por la plataforma" },
    // Three counts the service has always sent and this table never drew. `businesses.total`
    // is the denominator for the three above it, so an operator reading "3 suspendidos" with
    // no total cannot tell 3 of 40 from 3 of 400 — and `users.suspended` was the only signal
    // that anybody had been cut off.
    { label: "Negocios totales", value: metrics.businesses.total, context: "Registrados en la plataforma" },
    { label: "Usuarios", value: metrics.users.total, context: "Cuentas de cliente y comercio" },
    { label: "Usuarios suspendidos", value: metrics.users.suspended, context: "Cuentas cortadas" },
    { label: "Admins", value: metrics.users.admins, context: "Con acceso a esta consola" },
    { label: "Órdenes hoy", value: metrics.orders.today, context: "Desde medianoche, UTC" },
    { label: "Órdenes activas", value: metrics.orders.active, context: "En curso ahora" },
    { label: "Órdenes totales", value: metrics.orders.total, context: "Histórico completo" },
    // The one rate on the screen, so it is the one tile that is not an integer. It gets the
    // same treatment as a count and the same `suffix`, which is why `value` stayed a number
    // and the string is built here rather than baked into the card's API.
    { label: "Tasa de cancelación", value: Math.round(metrics.orders.cancelledRate * 100), suffix: "%", context: "Canceladas sobre el total" },
  ];

  const summary = [
    metrics.businesses.pendingVerification > 0
      ? `${metrics.businesses.pendingVerification} por verificar`
      : null,
    `${metrics.orders.today} órdenes hoy`,
    // The thirty-day signup head, on the line that is always visible — it is the only part
    // of the trend worth a glance, and putting it here means the growth figure costs no
    // space above the tab somebody is working in.
    seriesTotal(metrics.signupsSeries) > 0
      ? `${seriesTotal(metrics.signupsSeries)} negocios en 30 días`
      : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3">
      {/*
        `aria-expanded` and `aria-controls` rather than a bare button, because the toggle
        shows and hides a region and a screen reader has no other way to know that the row
        below it is there. `id` on the region is what makes the relationship real.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">{summary}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-0 px-1.5 py-0.5 text-xs"
          aria-expanded={open}
          aria-controls="admin-metrics-tiles"
          onClick={() => setOpen((was) => !was)}
        >
          {open ? "Ocultar métricas" : "Ver métricas"}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/*
        Mounted whether or not it is open, and hidden with the `hidden` attribute when
        collapsed rather than removed from the tree.

        `aria-controls` on the button has to name something that exists, in both states, or
        it is a dangling reference — the same defect as putting a tab strip in one Radix
        `Tabs` root and its panels in another. `hidden` is what removes the region from the
        accessibility tree *and* from the layout, which is what actually wants to happen when
        the tiles are collapsed, so one attribute does both jobs correctly.
      */}
      <div
        id="admin-metrics-tiles"
        hidden={!open}
        className="space-y-3"
      >
        {/*
          The two panels that were being fetched and discarded, drawn inside the region that
          is already collapsed by default.

          `volumeByCurrency` and `signupsSeries` have been in `adminMetricsSchema` from the
          start and rendered by nothing, on a query that refetches every thirty seconds — so
          every operator paid for them on every poll and saw nothing.

          They are inside this `hidden` container rather than beside it, deliberately. The
          file's own rule is that the tab somebody works in must not open with platform-wide
          numbers above it; putting a chart outside this region would break that rule in the
          name of closing the gap, and the always-visible summary line above already carries
          the thirty-day total for anyone who wants the headline.
        */}
        {/*
          Three panels, not two. `orderSeries` joins the two charts that were already here
          because it answers a different question than either: `signupsSeries` is "is the
          marketplace growing", `volumeByCurrency` is "how much money moved", and nothing on
          this dashboard said "are people ordering" — which is the first question, and the one
          every other number here is downstream of.
        */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActivityPanel series={metrics.orderSeries} />
          <SignupsPanel series={metrics.signupsSeries} />
          <VolumePanel volumes={metrics.volumeByCurrency} format={money} />
          <OperatorPanel
            viewer={viewerQuery.data}
            entries={myActionsQuery.data?.rows ?? []}
            isLoading={viewerQuery.isPending || myActionsQuery.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <MetricCard
              key={t.label}
              label={t.label}
              value={t.value}
              suffix={"suffix" in t ? t.suffix : undefined}
              context={t.context}
              urgent={t.urgent}
            />
          ))}
        </div>

        {/*
          When these numbers were taken. The query refetches every thirty seconds, so an
          operator reading "12 órdenes hoy" deserves to know it is not a cached hour-old
          figure — and it is the one field in the schema that has never been drawn.
        */}
        <p className="text-xs text-muted-foreground">
          Actualizado a las{" "}
          {metrics.generatedAt.toLocaleTimeString("es-CR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function BusinessTable({ rows }: { rows: AdminBusinessRow[] }) {
  if (rows.length === 0) {
    // Specific copy rather than "Nada por aquí", which said nothing about whether the
    // absence was expected. The hint carries the one fact that tells them: a shop that asked
    // to be seen is never in this table, so an empty one is not a sign that nobody has signed
    // up — it means there is nothing to verify, which is the good outcome.
    return (
      <EmptyState
        message="No hay negocios en esta lista."
        hint="Los negocios que esperan verificación aparecen en Aprobaciones."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Negocio</TableHead>
          <TableHead>Ciudad</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Productos</TableHead>
          <TableHead className="text-right">Órdenes</TableHead>
          <TableHead className="text-right">Volumen</TableHead>
          <TableHead>Alta</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((b) => (
          <TableRow key={b.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.ownerEmail ?? "—"}</div>
                </div>
                <BusinessSheet businessId={b.id} />
              </div>
            </TableCell>
            <TableCell>{b.city}</TableCell>
            <TableCell>
              <StatusBadge status={b.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{b.productCount}</TableCell>
            <TableCell className="text-right tabular-nums">{b.orderCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {money(b.grossVolumeMinor, b.currency)}
            </TableCell>
            <TableCell className="text-muted-foreground">{shortDate(b.createdAt)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                {b.status === "DRAFT" || !b.isVerified ? (
                  <ActionButton
                    label="Verificar"
                    action="business.verify"
                    targetName={b.name}
                    onRun={(reason) => adminApi.verifyBusiness(b.id, reason)}
                    size="sm"
                  />
                ) : null}
                {b.status === "SUSPENDED" ? (
                  <ActionButton
                    label="Reactivar"
                    action="business.reactivate"
                    targetName={b.name}
                    onRun={(reason) => adminApi.reactivateBusiness(b.id, reason)}
                    variant="outline"
                    size="sm"
                  />
                ) : (
                  <ActionButton
                    label="Suspender"
                    action="business.suspend"
                    targetName={b.name}
                    onRun={(reason) => adminApi.suspendBusiness(b.id, reason ?? "")}
                    variant="destructive"
                    size="sm"
                  />
                )}
                {/*
                  Delete is **not** a third button in that pair, and never was going to be.

                  `business.delete` exists and is in `REASON_REQUIRED_ACTIONS`, but the service
                  refuses outright for any business with an order, a subscription or a support
                  ticket — which is every business that has ever done anything. So this only
                  ever appears for a signup that never traded, and it is deliberately last in
                  the row: it is irreversible, and the refusal that comes back names
                  suspension as the alternative.

                  Offered from the row rather than hidden behind a kebab menu, because
                  "eliminar" is one word and burying it is how it gets clicked by accident.
                */}
                <ActionButton
                  label="Eliminar"
                  action="business.delete"
                  targetName={b.name}
                  onRun={(reason) => adminApi.deleteBusiness(b.id, reason ?? "")}
                  variant="destructive"
                  size="sm"
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BusinessTab({ onlyPending }: { onlyPending: boolean }) {
  const [search, setSearch] = useState("");
  /*
    The ordering is state rather than a fixed query, because the API has supported it since
    `adminListInput` gained `sort` and no tab ever sent it: an operator looking for the shop
    with the most orders had no way to ask.

    Both halves of this tab share one control and one set of options. There is deliberately
    **no** "oldest first" for the approvals queue, which is the ordering a work queue wants:
    `adminListInput.sort` has keys `newest | name | orders | revenue` and no `oldest`, so the
    oldest shop is reachable by flipping *Más recientes* to ascending — not by naming
    something the schema would refuse at the wire.
  */
  const [order, setOrder] = useState<SortState<AdminListSort>>({
    sort: "newest",
    direction: "desc",
  });
  /*
    `from`/`to` have been on `adminListInput` since it was written and this tab has never sent
    them — the query was already there (`gte(createdAt, from)`), and so was the index it uses.
  */
  const dates = useDateRange();

  /**
   * The search box writes straight into the query key, and every keystroke resets the page.
   *
   * The reset is the part that matters: a narrowed result set makes the old offset
   * meaningless, so without it an operator who filters on page four is looking at an empty
   * table that is not empty.
   */
  const page = useAdminPage<AdminBusinessRow>({
    queryKey: [onlyPending, search, order, dates.from, dates.to],
    queryFn: ({ cursor, limit }) =>
      onlyPending
        ? adminApi.pendingVerifications({ sort: order.sort, direction: order.direction, cursor, limit })
        : adminApi.businesses({
            search: search || undefined,
            sort: order.sort,
            direction: order.direction,
            from: dates.range.from,
            to: dates.range.to,
            cursor,
            limit,
          }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar los negocios."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!onlyPending ? (
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              page.reset();
            }}
            placeholder="Buscar por nombre, slug o correo"
            className="max-w-md"
            aria-label="Buscar negocios"
          />
        ) : null}
        {!onlyPending ? (
          <DateRangeFilter range={dates} onChange={page.reset} column="alta" />
        ) : null}
        <TableSort
          options={LIST_SORT_OPTIONS}
          value={order}
          onChange={(next) => {
            setOrder(next);
            page.reset();
          }}
          label="negocios"
        />
      </div>
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <BusinessTable rows={data.rows} />
      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="negocios"
      />
    </div>
  );
}

/**
 * One person, in full — the twin of `BusinessSheet`.
 *
 * The Personas tab had no way to open a person while `admin.userDetail` sat on the router,
 * fully built and unaudited from the console's side. This is the drawer that uses it, and it
 * is deliberately the same shape as the business one so an operator who learns one learns the
 * other.
 *
 * The courier block is conditional because a courier profile is a *different persona wearing
 * the same account*: a shop owner can also be a courier, and showing "repartidor: Verificado"
 * unconditionally would be a lie for everyone else. `userDetail` returns `null` rather than
 * omitting the key for exactly this reason.
 */
function UserSheet({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => adminApi.user(userId),
    enabled: open,
  });

  const person = data?.user ?? null;
  const courier = data?.courierProfile ?? null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="text-left font-medium underline-offset-2 hover:underline"
        >
          Ver ficha
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{person?.name ?? "Persona"}</SheetTitle>
          <SheetDescription>
            {isError ? "No se pudo abrir la ficha." : person ? person.email : "Cargando…"}
          </SheetDescription>
        </SheetHeader>
        {isError ? (
          <QueryErrorState
            error={error}
            fallback="No se pudo cargar la ficha de la persona."
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        ) : isPending || !data || !person ? (
          <Skeleton className="mt-4 h-48 w-full" />
        ) : (
          <>
            <dl className="mt-6 space-y-4 text-sm">
              {[
                ["Correo", person.email],
                ["Teléfono", person.phone ?? "—"],
                [
                  "Plataforma",
                  person.isAdmin ? (
                    <Badge
                      key="admin"
                      variant="outline"
                      className="border-amber-500/40 text-amber-600"
                    >
                      admin
                    </Badge>
                  ) : (
                    "—"
                  ),
                ],
                ["Suspendida", person.isSuspended ? "Sí" : "No"],
                ["Órdenes", String(person.orderCount)],
                [
                  "Negocios",
                  person.businessRoles.length === 0
                    ? "—"
                    : person.businessRoles.map((r) => `${r.businessName} (${r.role})`).join(", "),
                ],
                ["Alta", shortDate(person.createdAt)],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>

            {courier ? (
              <section className="mt-6">
                <h3 className="text-sm font-semibold">Repartidor</h3>
                <dl className="mt-2 space-y-3 text-sm">
                  {[
                    ["Zona de servicio", courier.serviceArea],
                    ["Vehículo", courier.vehicleName ?? "—"],
                    ["Placa", courier.vehiclePlate ?? "—"],
                    [
                      "Verificación",
                      courier.verificationStatus === "VERIFIED"
                        ? "Verificado"
                        : courier.verificationStatus === "PENDING"
                          ? "Pendiente"
                          : "Rechazado",
                    ],
                    ["Bio", courier.bio ?? "—"],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section className="mt-6">
              <h3 className="text-sm font-semibold">Últimas órdenes</h3>
              {data.recentOrders.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta persona todavía no ha pedido nada.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono">{o.reference}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {money(o.totalMinor, o.currency)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {o.businessName} · {o.status} · {shortDate(o.placedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-semibold">Auditoría</h3>
              {data.auditLog.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nadie ha tocado esta cuenta.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.auditLog.map((e) => (
                    <li key={e.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono">{e.action}</span>
                        <span className="text-muted-foreground">
                          {e.actorName ?? "—"} · {shortDate(e.createdAt)}
                        </span>
                      </div>
                      {e.reason ? (
                        <p className="mt-0.5 text-muted-foreground">{e.reason}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Granting the platform flag, with the feedback it never used to give.
 *
 * This was `onClick={() => adminApi.grantAdmin(u.id).catch(() => undefined)}` — a
 * fire-and-forget call whose failure was discarded and whose success changed nothing on
 * screen. Pressing it looked identical to pressing nothing: no toast, no refetch, and the
 * `admin` badge appeared only if the operator happened to reload. A mutation an operator
 * cannot tell worked is indistinguishable from one that did not happen.
 *
 * Now it is a real `useMutation`, so it reports its own outcome and invalidates the list.
 *
 * It was, for a while, the only button here with no opposite — `grantAdmin` had no revoke,
 * and this file's own docblock said so and called it a one-way door. It isn't one any more:
 * `revokeAdmin` is on the same row, and the reverse of it *does* demand a reason, because
 * taking the flag back is a removal and handing it out is not.
 */
function GrantAdminButton({ userId, userName }: { userId: string; userName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const grant = useMutation({
    mutationFn: () => adminApi.grantAdmin(userId),
    onSuccess: async () => {
      toast({ title: "Admin otorgado", description: `${userName} ya es de plataforma.` });
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) =>
      toast({
        title: "No se pudo otorgar",
        description: e.message,
        variant: "destructive",
      }),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={grant.isPending}
      onClick={() => grant.mutate()}
    >
      {grant.isPending ? "Dando…" : "Dar admin"}
    </Button>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<SortState<AdminListSort>>({
    sort: "newest",
    direction: "desc",
  });
  const dates = useDateRange();

  const page = useAdminPage<AdminUserRow>({
    queryKey: [search, order, dates.from, dates.to],
    queryFn: ({ cursor, limit }) =>
      adminApi.users({
        search: search || undefined,
        sort: order.sort,
        direction: order.direction,
        from: dates.range.from,
        to: dates.range.to,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las personas."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            page.reset();
          }}
          placeholder="Buscar por nombre o correo"
          className="max-w-md"
          aria-label="Buscar usuarios"
        />
        <DateRangeFilter range={dates} onChange={page.reset} column="alta" />
        <TableSort
          options={LIST_SORT_OPTIONS}
          value={order}
          onChange={(next) => {
            setOrder(next);
            page.reset();
          }}
          label="personas"
        />
      </div>
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>Negocios</TableHead>
            <TableHead className="text-right">Órdenes</TableHead>
            <TableHead>Alta</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((u: AdminUserRow) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.name}</span>
                  {u.isAdmin ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                      <ShieldCheck className="mr-1 h-3 w-3" /> admin
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
                {/*
                  The drawer, on the row itself rather than in the actions column. It reads
                  as part of the person's name — "who is this" is a question about the name —
                  and it is the same affordance `BusinessTable` uses, so the two tables that
                  have a detail view open the same way.
                */}
                <UserSheet userId={u.id} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {u.businessRoles.length === 0
                  ? "—"
                  : u.businessRoles.map((r) => `${r.businessName} (${r.role})`).join(", ")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{u.orderCount}</TableCell>
              <TableCell className="text-muted-foreground">{shortDate(u.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {/*
                    Both pairs are **exclusive on state**, not merely hidden when idle.
                    Offering "Suspender" to somebody already suspended, and "Dar admin" to
                    somebody already an admin, meant two of the three buttons on this row
                    were no-ops that still wrote an audit entry claiming something had been
                    done. `grantAdmin` was already idempotent server-side and that is why the
                    old UI got away with it; the fix is to not offer the act at all, so the
                    row says what can actually happen to this person right now.
                  */}
                  {u.isAdmin ? (
                    <ActionButton
                      label="Quitar admin"
                      action="user.revoke_admin"
                      targetName={u.name}
                      onRun={(reason) => adminApi.revokeAdmin(u.id, reason ?? "")}
                      variant="outline"
                      size="sm"
                    />
                  ) : (
                    <GrantAdminButton userId={u.id} userName={u.name} />
                  )}
                  {u.isSuspended ? (
                    <ActionButton
                      label="Reactivar"
                      action="user.reactivate"
                      targetName={u.name}
                      onRun={(reason) => adminApi.reactivateUser(u.id, reason)}
                      size="sm"
                    />
                  ) : (
                    <ActionButton
                      label="Suspender"
                      action="user.suspend"
                      targetName={u.name}
                      onRun={(reason) => adminApi.suspendUser(u.id, reason ?? "")}
                      variant="destructive"
                      size="sm"
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrdersTab() {
  const [order, setOrder] = useState<SortState<AdminListSort>>({
    sort: "newest",
    direction: "desc",
  });
  const dates = useDateRange();

  const page = useAdminPage<AdminOrderRow>({
    queryKey: [order, dates.from, dates.to],
    queryFn: ({ cursor, limit }) =>
      adminApi.orders({
        sort: order.sort,
        direction: order.direction,
        // `orders` filters on `placedAt`, not `createdAt` — the one table where the column
        // name matters, which is why the label says "fecha" rather than "alta".
        from: dates.range.from,
        to: dates.range.to,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las órdenes."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/*
          *Volumen* here is the order total, which is the only money figure on this table.
          `admin.orders`'s own docblock notes that its `orders` sort key degenerates to
          `placedAt` because a row has no order count of its own — so the option reads
          "Volumen" rather than "Órdenes", which would promise something the query cannot
          do.
        */}
        <TableSort
          options={LIST_SORT_OPTIONS}
          value={order}
          onChange={(next) => {
            setOrder(next);
            page.reset();
          }}
          label="órdenes"
        />
        <DateRangeFilter range={dates} onChange={page.reset} column="fecha" />
      </div>
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referencia</TableHead>
            <TableHead>Negocio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono text-xs">{o.reference}</TableCell>
              <TableCell>{o.businessName}</TableCell>
              <TableCell>{o.customerName}</TableCell>
              <TableCell className="text-xs">{o.status}</TableCell>
              {/*
                The payment column is not decoration. `order.refund` only applies to a captured
                payment, and the operator cannot know which orders have one without reading
                `payment_status` — so a refund button on every row would be a button that is
                wrong most of the time, and "wrong" on a money action means a refusal the
                operator has to interpret.
              */}
              <TableCell className="text-xs">{o.paymentStatus}</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(o.totalMinor, o.currency)}
              </TableCell>
              <TableCell className="text-muted-foreground">{shortDate(o.placedAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {o.paymentStatus === "PAID" ? (
                    <ActionButton
                      label="Reembolsar"
                      action="order.refund"
                      targetName={o.reference}
                      onRun={(reason) => adminApi.refundOrder(o.id, reason ?? "")}
                      size="sm"
                    />
                  ) : null}
                  <ActionButton
                    label="Cancelar"
                    action="order.cancel"
                    targetName={o.reference}
                    onRun={(reason) => adminApi.cancelOrder(o.id, reason ?? "")}
                    variant="destructive"
                    size="sm"
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="órdenes"
      />
    </div>
  );
}

/**
 * The courier queue — the second approvals queue, and a different kind of thing.
 *
 * A shop asks to be seen by filling in a form; a courier asks by having a shop invite them
 * and pressing accept. The consequence is that this queue is not a form to read so much as a
 * person to judge, which is why the table shows the vehicle and the service area and not
 * just a name. `vehiclePhotoUrl` and `bio` are the two fields a reviewer actually opens, and
 * they are rendered rather than truncated away: a link that is not followed is a courier
 * who is not reviewed, and the queue is the only place that link is ever offered.
 *
 * `pendingCouriers` is a separate query from the courier table below rather than a filter on
 * it, so the tab can badge a count without pulling twenty-five rows to count them. It exists
 * because `adminMetricsSchema` has no courier block — `metrics` covers businesses, users and
 * orders — and a badge that needs a page of rows to know one number is a badge that flashes
 * empty while loading.
 */
function CouriersTab({ onlyPending }: { onlyPending?: boolean } = {}) {
  const [search, setSearch] = useState("");

  /*
    No sort control here, and it is not an oversight: `adminCourierListInput` has no `sort`
    field at all — search, status, cursor, limit. There is nothing to send, so offering a
    picker would produce an ordering the API refuses or ignores.
  */
  const page = useAdminPage<AdminCourierRow>({
    queryKey: [onlyPending, search],
    queryFn: ({ cursor, limit }) =>
      adminApi.couriers({
        search: search || undefined,
        status: onlyPending ? "PENDING" : undefined,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar los repartidores."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      {!onlyPending ? (
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            page.reset();
          }}
          placeholder="Buscar por nombre, zona o correo"
          className="max-w-md"
          aria-label="Buscar repartidores"
        />
      ) : null}
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repartidor</TableHead>
            <TableHead>Zona</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Alta</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="font-medium">{c.displayName}</div>
                <div className="text-xs text-muted-foreground">{c.userEmail}</div>
                {c.bio ? (
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">{c.bio}</p>
                ) : null}
                {c.vehiclePhotoUrl ? (
                  <a
                    href={c.vehiclePhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-amber-600 underline"
                  >
                    Ver foto del vehículo
                  </a>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{c.serviceArea}</TableCell>
              <TableCell className="text-sm">
                {c.vehicleName ?? "—"}
                {c.vehiclePlate ? (
                  <div className="font-mono text-xs text-muted-foreground">
                    {c.vehiclePlate}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    c.verificationStatus === "VERIFIED"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : c.verificationStatus === "PENDING"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border"
                  }
                >
                  {c.verificationStatus === "VERIFIED"
                    ? "Verificado"
                    : c.verificationStatus === "PENDING"
                      ? "Pendiente"
                      : "Rechazado"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{shortDate(c.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {c.verificationStatus !== "VERIFIED" ? (
                    <ActionButton
                      label="Verificar"
                      action="courier.verify"
                      targetName={c.displayName}
                      onRun={(reason) => adminApi.reviewCourier(c.id, "VERIFIED", reason)}
                      size="sm"
                    />
                  ) : null}
                  {c.verificationStatus !== "REJECTED" ? (
                    <ActionButton
                      label="Rechazar"
                      action="courier.reject"
                      targetName={c.displayName}
                      onRun={(reason) => adminApi.reviewCourier(c.id, "REJECTED", reason ?? "")}
                      variant="destructive"
                      size="sm"
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="repartidores"
      />
    </div>
  );
}

/**
 * The support desk, as two panes: the queue on the left, the thread on the right.
 *
 * ## Why one screen and not a list that opens something
 *
 * A support thread is a conversation, and a conversation you have to leave to read is a
 * conversation that gets answered from memory. The list is narrow so the thread has room,
 * and selecting is local state rather than a route — there is no URL to share, because
 * "the ticket about the double charge" is not a thing two people can be shown at once and
 * the operator who is in the thread is the one who should be in it.
 *
 * ## The three controls, and why there are exactly three
 *
 * Reply, resolve, close. `replyOnTicket` is a plain message and does **not** move the
 * ticket, because an operator who is still working should not have to flip a ticket to
 * `WAITING` to record what they said. `resolveTicket` requires a `note` and posts it as the
 * closing message, so a resolution always carries the words that resolved it — there is no
 * control here that closes a ticket silently, and no `WAITING` button, because that is the
 * merchant's to move and they move it themselves.
 *
 * Both of the closing actions are `RESOLVED` and `CLOSED` from the same required note. The
 * difference is what the merchant is told: resolved means answered, closed means finished.
 * They are two buttons rather than one dropdown because an operator reaching for the wrong
 * one is a mistake the merchant sees, not one the operator undoes.
 */
const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierto",
  WAITING: "Esperando al comercio",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

const TICKET_CATEGORY_LABEL: Record<string, string> = {
  BILLING: "Facturación",
  TECHNICAL: "Técnico",
  ACCOUNT: "Cuenta",
  PRODUCT: "Producto",
  OTHER: "Otro",
};

function TicketThread({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState<"RESOLVED" | "CLOSED" | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "ticket", ticketId],
    queryFn: () => adminApi.supportTicket(ticketId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "ticket", ticketId] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] }),
    ]);
  };

  const send = useMutation({
    mutationFn: () => adminApi.replyOnSupportTicket(ticketId, body.trim()),
    onSuccess: async () => {
      setBody("");
      toast({ title: "Respuesta enviada" });
      await refresh();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo enviar", description: e.message, variant: "destructive" }),
  });

  const resolve = useMutation({
    mutationFn: (status: "RESOLVED" | "CLOSED") =>
      adminApi.resolveSupportTicket(ticketId, status, note.trim()),
    onSuccess: async () => {
      setClosing(null);
      setNote("");
      toast({ title: "Ticket cerrado" });
      await refresh();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo cerrar", description: e.message, variant: "destructive" }),
  });

  if (isPending) return <Skeleton className="h-72 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudo cargar el ticket."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  const done = data.status === "RESOLVED" || data.status === "CLOSED";

  return (
    <div className="flex h-full flex-col">
      <header className="border-b pb-3">
        <p className="text-xs text-muted-foreground">
          {data.businessName} · {data.openedByName} ·{" "}
          {TICKET_CATEGORY_LABEL[data.category] ?? data.category}
        </p>
        <h3 className="mt-0.5 font-semibold">{data.subject}</h3>
        <Badge
          variant="outline"
          className={done ? "mt-2" : "mt-2 bg-amber-500/10 text-amber-600 border-amber-500/30"}
        >
          {TICKET_STATUS_LABEL[data.status] ?? data.status}
        </Badge>
      </header>

      <ol className="flex-1 space-y-3 overflow-y-auto py-4">
        {data.messages.map((m) => (
          <li
            key={m.id}
            className={m.fromSupport ? "ml-6 border-l-2 border-amber-500/40 pl-3" : "mr-6 pl-3"}
          >
            <p className="text-xs text-muted-foreground">
              {m.fromSupport ? "PymesHub" : data.openedByName} ·{" "}
              {new Date(m.createdAt).toLocaleString("es-CR")}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.body}</p>
          </li>
        ))}
      </ol>

      {done ? (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Cerrado el {data.resolvedAt ? shortDate(data.resolvedAt) : ""}. Un ticket cerrado se
          puede reabrir desde el comercio.
        </p>
      ) : (
        <div className="space-y-3 border-t pt-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Responder al comercio…"
            rows={3}
            aria-label="Respuesta"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClosing("RESOLVED")}
            >
              Resolver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClosing("CLOSED")}
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              disabled={body.trim().length === 0 || send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? "Enviando…" : "Responder"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={closing !== null} onOpenChange={(o) => !o && setClosing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {closing === "RESOLVED" ? "Resolver" : "Cerrar"}: {data.subject}
            </AlertDialogTitle>
            <AlertDialogDescription>
              La nota es obligatoria y queda publicada como el último mensaje del ticket, así
              que el comercio ve exactamente por qué se cerró.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo del cierre (obligatorio)"
            rows={4}
            aria-label="Nota de cierre"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={note.trim().length === 0 || resolve.isPending}
              onClick={() => closing && resolve.mutate(closing)}
            >
              {closing === "RESOLVED" ? "Resolver" : "Cerrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SupportTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"live" | "all">("live");
  const [search, setSearch] = useState("");
  /*
    Activity first, and not by accident.

    `admin.supportTickets`'s own docblock calls `activity` *"the queue's own ordering and the
    one an operator wants by default in spirit"* — it sorts on the computed
    `lastMessageAt`, so the ticket somebody spoke on last is at the top, which is the one
    that might still be waiting. The schema defaults to `newest` because `activity` cannot
    use an index, so on the console this control is how the better ordering is reachable at
    all. Before this, no tab sent `sort`, and the queue was ordered by column order rather
    than by anything a person chose.
  */
  const [order, setOrder] = useState<SortState<TicketSort>>({
    sort: "activity",
    direction: "desc",
  });

  const page = useAdminPage<AdminSupportTicketRow>({
    queryKey: [status, search, order],
    queryFn: ({ cursor, limit }) =>
      adminApi.supportTickets({
        search: search || undefined,
        // `live` hides what is already answered, which is the default an operator wants and
        // the wrong default for auditing: the list's own note says filtering out closed
        // tickets makes a quiet weekend look like an ignored one. So `all` is one click away.
        status: status === "live" ? ["OPEN", "WAITING"] : undefined,
        sort: order.sort,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-72 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar los tickets."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            page.reset();
          }}
          placeholder="Buscar por asunto, cuerpo, comercio o persona"
          className="max-w-md"
          aria-label="Buscar tickets"
        />
        {/*
          `sort` has no `direction` of its own on this query: `oldest` already says "the
          other way", and `activity` and `messages` are aggregates that only read one way. So
          the support table gets the column picker and **no** flip button — a direction
          control here would promise an ordering the service cannot produce.
        */}
        <TableSort
          options={TICKET_SORT_OPTIONS}
          value={order}
          onChange={(next) => {
            setOrder(next);
            page.reset();
          }}
          label="tickets"
          showDirection={false}
        />
        {/*
          The same two-way control, for the same reason. This one **is** paged, so changing
          it has to reset the offset — a narrower queue makes the old page meaningless.
        */}
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(next) => {
            if (next === "") return;
            setStatus(next as "live" | "all");
            page.reset();
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="live" className="text-xs">
            Sin resolver
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="text-xs">
            Todos
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{data?.total ?? 0} en total</p>
      </div>

      {/*
        The pager sits between the filter row and the two panes, so it reads as belonging to
        the queue rather than to the thread beside it. On a narrow screen that puts it above
        both, which is why it is not inside the left column — that column is a fixed 20rem and
        would clip the buttons at 375px.
      */}
      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="tickets"
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {data && data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay tickets aquí.
            </p>
          ) : null}
          {data?.rows.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              aria-pressed={selected === t.id}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                selected === t.id
                  ? "border-amber-500/50 bg-amber-500/5"
                  : "border-border hover:bg-accent"
              }`}
            >
              <p className="truncate text-sm font-medium">{t.subject}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {t.businessName} · {TICKET_CATEGORY_LABEL[t.category] ?? t.category}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.messageCount} {t.messageCount === 1 ? "mensaje" : "mensajes"} ·{" "}
                {shortDate(t.lastMessageAt ?? t.createdAt)}
              </p>
            </button>
          ))}
        </div>

        <div className="min-h-[24rem] rounded-md border p-4">
          {selected ? (
            <TicketThread key={selected} ticketId={selected} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Elegí un ticket para ver la conversación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Al día",
  GRACE: "En gracia",
  PAST_DUE: "Vencido",
  SUSPENDED: "Suspendido",
};

const SUBSCRIPTION_STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  GRACE: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  PAST_DUE: "bg-red-500/10 text-red-600 border-red-500/30",
  SUSPENDED: "bg-muted text-muted-foreground border-border",
};

/**
 * Colones as an operator types them, to the minor units the API takes.
 *
 * The round trip matters more than it looks: the wire is integer minor units because
 * money cannot be a float, and a figure typed as `1234.56` has to become `123456` and not
 * `123456.00000001`. `Math.round` is what makes that exact. A blank or unparseable field
 * returns `null` rather than `0` — **zero is a real amount** (a merchant who paid nothing
 * off an arrears balance is a fact worth recording) and must not be what an empty form
 * sends.
 */
function toMinor(typed: string): number | null {
  const cleaned = typed.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (cleaned.trim() === "") return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** Recording a payment: the dialog an arrears row opens. */
function RecordPaymentDialog({
  subscriptionId,
  businessName,
  arrearsMinor,
  periodsOwed,
  priceMinor,
  currency,
  onDone,
}: {
  subscriptionId: string;
  businessName: string;
  arrearsMinor: number;
  periodsOwed: number;
  /** The price of the one period a payment settles. */
  priceMinor: number | null;
  currency: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const amountMinor = toMinor(amount);
  const invoicedMinor = priceMinor ?? 0;

  /**
   * What one payment actually does, stated before it is submitted.
   *
   * A payment settles **one period** and starts a new one. Arrears is derived from
   * `periodEnd`, so on a shop three periods behind the debt does not fall by one period —
   * it goes to zero, and the guard then refuses a second payment for the length of the new
   * period. That is the intended rule (the platform is not a credit account), but it used
   * to be invisible: the operator typed a figure, the service discarded it and recorded the
   * invoice instead, and the audit row named the successor period's price under a key that
   * read as what had been collected. Nobody could see that ₡4,000 of debt had been
   * forgiven, least of all the person who had to justify it later.
   *
   * So the write-off is computed here and shown, and it is now on the audit row as
   * `writtenOffMinor` with the operator's name and reason beside it.
   */
  const writtenOffMinor =
    amountMinor === null ? 0 : Math.max(0, arrearsMinor - amountMinor);
  const periodsForgiven = Math.max(0, periodsOwed - 1);

  const canSubmit =
    amountMinor !== null &&
    amountMinor >= invoicedMinor &&
    reference.trim().length >= 4 &&
    reason.trim().length >= REASON_MIN_LENGTH;

  const save = useMutation({
    mutationFn: () =>
      adminApi.recordPayment({
        subscriptionId,
        amountMinor: amountMinor as number,
        reference: reference.trim(),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setOpen(false);
      setAmount("");
      setReference("");
      setReason("");
      toast({ title: "Pago registrado" });
      onDone();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo registrar", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Registrar pago
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pago de {businessName}</AlertDialogTitle>
            <AlertDialogDescription>
              Debe {money(arrearsMinor, currency)} en {periodsOwed}{" "}
              {periodsOwed === 1 ? "periodo" : "periodos"}. La referencia del banco o de
              SINPE es obligatoria: es lo único que hace el pago conciliable después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="pay-amount" className="text-xs text-muted-foreground">
                Monto recibido
              </label>
              <Input
                id="pay-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={String(invoicedMinor / 100)}
                className="mt-1"
              />
              {/*
                The period's own price, not the arrears total. The old placeholder was
                `arrearsMinor / 100`, which is three periods' worth — so the field
                defaulted a figure that would be read as a single overpayment. One payment
                settles one period; the debt beside it is what the write-off line accounts
                for.
              */}
              <p className="mt-1 text-xs text-muted-foreground">
                Un pago cubre un periodo: {money(invoicedMinor, currency)}.
              </p>
              {amountMinor !== null && amountMinor < invoicedMinor ? (
                <p className="mt-1 text-xs text-red-600">
                  Menor que la factura del periodo. El API lo rechaza.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="pay-ref" className="text-xs text-muted-foreground">
                Referencia
              </label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Referencia bancaria o SINPE"
                className="mt-1"
              />
            </div>
            {/*
              The write-off, in words, before the operator commits to it. `writtenOffMinor`
              is the same figure the service will write to the audit row, computed there from
              the same expression that renders the arrears table — so this sentence and the
              record cannot disagree.
            */}
            {writtenOffMinor > 0 ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                Con este pago quedan saldados {money(arrearsMinor, currency)}. Se perdona{" "}
                {money(writtenOffMinor, currency)}{" "}
                {periodsForgiven === 1 ? "de 1 periodo" : `de ${periodsForgiven} periodos`}{" "}
                que nadie pagó, y queda anotado en la auditoría con tu nombre.
              </p>
            ) : null}
            <div>
              <label htmlFor="pay-reason" className="text-xs text-muted-foreground">
                Motivo (obligatorio)
              </label>
              <Textarea
                id="pay-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
              Registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Cobros — who owes the platform money.
 *
 * This is the platform's whole billing surface, and the router is blunt about why it is
 * shaped this way: *"There is no settlement now — the consumer pays the merchant and the
 * courier, and the platform charges a flat subscription."* So there is no gross, no
 * commission and no payout to compute, and this table is an **arrears** table rather than
 * a settlement one. `arrears` is therefore the default sort, not a nicety: someone opening
 * this is chasing debt, and a table sorted by name would hide the shop that owes the most.
 *
 * The action is recording that a merchant paid, and its required field is the bank's
 * reference. That is the reconciliation key, and it is why the dialog refuses to submit
 * without one.
 */
/*
  **No pager here, deliberately, and this is the one table in the console that is paged by
  hand or not at all.**

  `admin.subscriptions` applies its status filter *after* shaping — deliberately, because the
  stored `status` column is stale and the derived one is correct — which means its `total` is
  **unfiltered**. Verified against the service:

      unfiltered        -> rows: 3 | total: 3
      filtered PAST_DUE -> rows: 1 | total: 3

  A pager built on `total` would offer "page 2 of 3" on a list holding one row, and the
  operator would click into an empty table that is not empty. So this table keeps its own
  25-row window and says so in the footer, rather than gaining a control that lies.

  The fix is a service change — `total` should count the shaped set — and it belongs in its
  own commit, where it can be reviewed as a behaviour change rather than smuggled in beside a
  pager.
  */
function BillingTab() {
  const [status, setStatus] = useState<"all" | SubscriptionStatus>("all");
  const [sort, setSort] = useState<"arrears" | "periodEnd" | "businessName">("arrears");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // Paged like the other five tables, and only now honestly so. Cobros was the one table
  // left out of pagination because `total` counted the **unfiltered** set — the status
  // filter ran in JavaScript after the page was chosen — so a pager over it would have
  // offered "página 1 de 4" above a single matching row. `derivedStatusSql` fixed the count,
  // and this is that fix's other half.
  const page = useAdminPage<AdminSubscription>({
    queryKey: [status, sort, search],
    queryFn: ({ cursor, limit }) =>
      adminApi.subscriptions({
        search: search || undefined,
        status: status === "all" ? undefined : status,
        sort,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las suscripciones."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  const owing = data.rows.filter((s) => s.arrearsMinor > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            // The offset is meaningless against a new result set: typing narrows the list
            // the operator is three pages into.
            page.reset();
          }}
          placeholder="Buscar por comercio o correo"
          className="max-w-xs"
          aria-label="Buscar suscripciones"
        />
        {/*
          Radix's own `ToggleGroup`, which is what this row of buttons was hand-rolling:
          five `Button`s each computing `variant={status === s ? "default" : "outline"}`.

          **The empty-string guard is load-bearing.** A single-select `ToggleGroup` emits `""`
          when the selected item is clicked again, so writing `onValueChange={setStatus}`
          straight through would let an operator deselect the filter by clicking it — and
          `status` would become `""`, which is falsy, which silently means "no filter". The
          filter would look chosen and not be. Ignoring `""` is what makes these two controls
          and the three below behave like radio buttons rather than like toggles.
        */}
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(next) => {
            if (next === "") return;
            setStatus(next as SubscriptionStatus);
            page.reset();
          }}
          variant="outline"
          size="sm"
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="all" className="text-xs">
            Todos
          </ToggleGroupItem>
          {(["ACTIVE", "GRACE", "PAST_DUE", "SUSPENDED"] as const).map((s) => (
            <ToggleGroupItem key={s} value={s} className="text-xs">
              {SUBSCRIPTION_STATUS_LABEL[s] ?? s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="ml-auto">
          <ToggleGroup
            type="single"
            value={sort}
            onValueChange={(next) => {
              if (next === "") return;
              setSort(next as "arrears" | "periodEnd" | "businessName");
              page.reset();
            }}
            variant="outline"
            size="sm"
          >
            {(["arrears", "periodEnd", "businessName"] as const).map((s) => (
              <ToggleGroupItem key={s} value={s} className="text-xs">
                {s === "arrears" ? "Deuda" : s === "periodEnd" ? "Vence" : "Nombre"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/*
        `owing` is counted over `data.rows`, which is now **one page** — so the number is
        about what is on screen and nothing else. Saying "3 con deuda · 200 en total" without
        that distinction reads as "three shops owe money out of two hundred", which is a claim
        about the platform, not about the table. It is scoped to the page in the label because
        the count the service could give for the whole set does not exist yet: summing
        `arrearsMinor` over a page of a `total`-ordered query is not the platform's debt.
    */}
      <p className="text-xs text-muted-foreground">
        {owing > 0 ? `${owing} con deuda en esta página · ` : ""}
        {data.total} en total
      </p>

      {data.rows.length === 0 ? (
        <EmptyState
          message="No hay suscripciones."
          hint="Un negocio aparece aquí en cuanto se registra; sus facturas pendientes se cobran desde aquí."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="text-right">Períodos</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Último pago</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((s) => (
              <TableRow key={s.id} className={s.arrearsMinor > 0 ? "bg-red-500/[0.03]" : undefined}>
                <TableCell>
                  <div className="font-medium">{s.businessName}</div>
                  <div className="text-xs text-muted-foreground">{s.ownerEmail ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm">{s.plan}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={SUBSCRIPTION_STATUS_CLASS[s.status] ?? SUBSCRIPTION_STATUS_CLASS.SUSPENDED}
                  >
                    {SUBSCRIPTION_STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.priceMinor === null ? "—" : money(s.priceMinor, s.currency)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${s.arrearsMinor > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}`}
                >
                  {money(s.arrearsMinor, s.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.periodsOwed || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.periodEnd ? shortDate(s.periodEnd) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.lastPaidAt ? shortDate(s.lastPaidAt) : "Nunca"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    {s.arrearsMinor > 0 ? (
                      <RecordPaymentDialog
                        subscriptionId={s.id}
                        businessName={s.businessName}
                        arrearsMinor={s.arrearsMinor}
                        periodsOwed={s.periodsOwed}
                        priceMinor={s.priceMinor}
                        currency={s.currency}
                        onDone={() => queryClient.invalidateQueries()}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="suscripciones"
      />
    </div>
  );
}

/**
 * Planes — the price books, and the lever for raising the price as the app grows.
 *
 * A book is a **row, not a setting**, and that is the whole design: inserting one raises
 * what *new* merchants pay from `effectiveFrom` and moves nobody already subscribed,
 * because a merchant's `priceMinor` was captured when their period began. A merchant is
 * never charged a price they were not shown.
 *
 * That is also why this form asks for a date and does not try to stop you picking a past
 * one. `createPriceBook` refuses a past `effectiveFrom` server-side, with a sentence
 * explaining exactly that outcome, and duplicating the rule here would mean two places to
 * disagree about the boundary — the clock is the service's to judge, and its message is
 * better than any `min` attribute.
 */
function PriceBooksTab() {
  const [label, setLabel] = useState("");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const [from, setFrom] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "priceBooks"],
    queryFn: adminApi.priceBooks,
  });

  const weeklyMinor = toMinor(weekly);
  const monthlyMinor = toMinor(monthly);
  const canSubmit =
    label.trim().length >= 2 &&
    weeklyMinor !== null &&
    monthlyMinor !== null &&
    from !== "" &&
    reason.trim().length >= REASON_MIN_LENGTH;

  const create = useMutation({
    mutationFn: () =>
      adminApi.createPriceBook({
        label: label.trim(),
        weeklyMinor: weeklyMinor as number,
        monthlyMinor: monthlyMinor as number,
        // `new Date("YYYY-MM-DD")` is UTC midnight; a local-time parse of the same string
        // would shift the effective date by a day either side of it.
        effectiveFrom: new Date(`${from}T00:00:00Z`),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setLabel("");
      setWeekly("");
      setMonthly("");
      setFrom("");
      setReason("");
      toast({ title: "Precio staged" });
      queryClient.invalidateQueries();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo crear", description: e.message, variant: "destructive" }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar los planes."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Libro</TableHead>
            <TableHead className="text-right">Semanal</TableHead>
            <TableHead className="text-right">Mensual</TableHead>
            <TableHead>Vigente desde</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No hay libros de precio todavía.
              </TableCell>
            </TableRow>
          ) : null}
          {data.map((book) => (
            <TableRow key={book.id}>
              <TableCell className="font-medium">{book.label}</TableCell>
              <TableCell className="text-right tabular-nums">{money(book.weeklyMinor, "CRC")}</TableCell>
              <TableCell className="text-right tabular-nums">{money(book.monthlyMinor, "CRC")}</TableCell>
              <TableCell className="text-muted-foreground">{shortDate(book.effectiveFrom)}</TableCell>
              <TableCell>
                {book.isStaged ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Programado
                  </Badge>
                ) : book.isCurrent ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Vigente
                  </Badge>
                ) : (
                  <Badge variant="outline">Reemplazado</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programar un precio nuevo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="pb-label" className="text-xs text-muted-foreground">
                Etiqueta
              </label>
              <Input
                id="pb-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="2026-Q2"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="pb-weekly" className="text-xs text-muted-foreground">
                Semanal (₡)
              </label>
              <Input
                id="pb-weekly"
                value={weekly}
                onChange={(e) => setWeekly(e.target.value)}
                inputMode="decimal"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="pb-monthly" className="text-xs text-muted-foreground">
                Mensual (₡)
              </label>
              <Input
                id="pb-monthly"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                inputMode="decimal"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="pb-from" className="text-xs text-muted-foreground">
                Vigente desde
              </label>
              <Input
                id="pb-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {/*
            The reason, and it is required. `subscription.create_price_book` is in
            `REASON_REQUIRED_ACTIONS`, so this is the console mirroring a server rule rather
            than inventing a field: the rise is the one act here that changes what *every*
            future merchant pays, and the audit log is the only place the question "why is
            everyone being charged ₡20,000" can ever be answered from.

            `REASON_MIN_LENGTH` is the same constant the schema's `min` reads, imported from
            `@pymeshub/shared` through `@/lib/admin` — not a number typed here, which is how
            the reason-required list drifted in the first place.
          */}
          <div className="mt-3">
            <label htmlFor="pb-reason" className="text-xs text-muted-foreground">
              Motivo (obligatorio)
            </label>
            <Textarea
              id="pb-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por qué sube el precio, y desde cuándo"
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Guardando…" : "Programar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Create or edit a category. An absent `id` is a create; that is the service's contract. */
function CategoryDialog({
  category,
  onDone,
}: {
  category?: {
    id: string;
    name: string;
    nameEn: string | null;
    imageUrl: string | null;
    sortOrder: number;
  };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      adminApi.saveCategory({
        id: category?.id,
        name: name.trim(),
        // An empty English box is sent as `null` — "clear it" — rather than as an empty
        // string, because absent and `null` are different facts here (see
        // `adminCategoryInput`): absent would leave an existing name untouched.
        nameEn: nameEn.trim() === "" ? null : nameEn.trim(),
        // Same convention, third time. An empty photo box clears the picture and the tile
        // falls back to its icon; a box left alone must send nothing at all, because this
        // form is also how a name gets corrected and the photograph is on the row rather
        // than in the form.
        imageUrl: imageUrl.trim() === "" ? null : imageUrl.trim(),
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      }),
    onSuccess: () => {
      setOpen(false);
      toast({ title: category ? "Categoría actualizada" : "Categoría creada" });
      queryClient.invalidateQueries();
      onDone();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Button size="sm" variant={category ? "outline" : "default"} onClick={() => setOpen(true)}>
        {category ? "Editar" : "Nueva categoría"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</AlertDialogTitle>
            <AlertDialogDescription>
              El nombre en español es el que ve el mercado. El inglés es opcional; dejarlo vacío
              lo borra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="cat-name" className="text-xs text-muted-foreground">
                Nombre (es)
              </label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="cat-name-en" className="text-xs text-muted-foreground">
                Nombre (en)
              </label>
              <Input
                id="cat-name-en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="cat-image" className="text-xs text-muted-foreground">
                Foto
              </label>
              <Input
                id="cat-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="/files/… o https://…"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Cuadrada, sin texto ni logotipos. Es lo que ve el cliente en la tira de
                categorías; vacío vuelve al ícono. Vaciar el campo borra la foto.
              </p>
              {imageUrl.trim() === "" ? null : (
                <img
                  src={imageUrl.trim()}
                  alt=""
                  className="mt-2 size-16 rounded-md border object-cover"
                />
              )}
            </div>
            <div>
              <label htmlFor="cat-sort" className="text-xs text-muted-foreground">
                Orden
              </label>
              <Input
                id="cat-sort"
                type="number"
                min={0}
                max={999}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={name.trim().length === 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CategoriesTab() {
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: adminApi.categories,
  });
  const queryClient = useQueryClient();

  // No second delete path here on purpose: `category.delete` is in
  // `REASON_REQUIRED_ACTIONS`, so deleting goes through `ActionButton`, which asks for the
  // reason and reports its own outcome. A second path to the same call would be the one
  // that skips the reason — and it used to be worse than that: the button asked, the
  // callback dropped the answer, and the audit row said `reason: null`.

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las categorías."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{data.length} categorías</p>
        <CategoryDialog onDone={() => queryClient.invalidateQueries()} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>English</TableHead>
            <TableHead>Foto</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="text-right">Productos</TableHead>
            <TableHead className="text-right">Orden</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.nameEn ?? "—"}</TableCell>
              <TableCell>
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="size-9 rounded border object-cover"
                  />
                ) : (
                  // The glyph, not a dash. A category with no photograph draws its icon in
                  // the app, so the table showing "—" where the tile shows a fork would
                  // make the operator hunt for a photo that is legitimately absent.
                  <span className="text-xs text-muted-foreground">ícono</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
              <TableCell className="text-right tabular-nums">{c.productCount ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{c.sortOrder}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <CategoryDialog
                    category={{
                      id: c.id,
                      name: c.name,
                      nameEn: c.nameEn,
                      imageUrl: c.imageUrl,
                      sortOrder: c.sortOrder,
                    }}
                    onDone={() => queryClient.invalidateQueries()}
                  />
                  <ActionButton
                    label="Eliminar"
                    action="category.delete"
                    targetName={c.name}
                    onRun={(reason) => adminApi.deleteCategory(c.id, reason ?? "")}
                    variant="destructive"
                    size="sm"
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * A table's ordering: which column, and which way.
 *
 * A `Select` rather than the row of buttons *Cobros* uses, because the support queue has
 * four options and the other three have too — a button strip that wide stops being a control
 * and starts being a second toolbar. The direction is a separate button beside it, so
 * reversing a sort does not require re-picking the column.
 *
 * **The icon is never the only signal.** Each way carries its own label on the trigger
 * itself, so the state is readable without hovering, without colour, and by a screen reader.
 *
 * `options` is passed rather than looked up from a table name, because the option lists are
 * genuinely different — `activity` exists on tickets and nowhere else — and a lookup keyed by
 * a string would be one more thing that can disagree with the schema.
 */
function TableSort<T extends string>({
  options,
  value,
  onChange,
  label,
  showDirection = true,
}: {
  options: readonly { value: T; label: string }[];
  value: SortState<T>;
  onChange: (next: SortState<T>) => void;
  /** What is being ordered, for the accessible name. */
  label: string;
  /**
   * Whether this list has a direction to reverse.
   *
   * False for the support queue, where the ordering is fixed: `oldest` already says "the
   * other way", and `activity` and `messages` are aggregates that only read one way. A flip
   * button there would change nothing and look like it had, which is worse than having none.
   */
  showDirection?: boolean;
}) {
  const chosen = options.find((option) => option.value === value.sort);

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={value.sort}
        onValueChange={(next) => onChange(nextSort(value, next as T))}
      >
        <SelectTrigger
          aria-label={`Ordenar por — ${label}`}
          className="h-8 w-auto min-w-40 text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showDirection ? (
        <Button
          variant="outline"
          size="sm"
          aria-label={`${directionLabel(value.direction)} — ${label}`}
          title={directionLabel(value.direction)}
          onClick={() => onChange(flipDirection(value))}
        >
          {value.direction === "asc" ? (
            <ArrowUpNarrowWide className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownNarrowWide className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5 text-xs">{directionLabel(value.direction)}</span>
        </Button>
      ) : null}
      {chosen ? (
        /*
          The current choice, in text, for a screen reader.

          `SelectTrigger` renders the selected item's own children, so the label is already
          visible on screen; this is the same fact in the accessibility tree, where the
          trigger's `aria-label` deliberately describes the *control* ("Ordenar por") rather
          than overwriting what it currently says.
        */
        <span className="sr-only">{`Ordenado por ${chosen.label}`}</span>
      ) : null}
    </div>
  );
}

/**
 * One business, in full.
 *
 * `admin.business` is the only live procedure the table above did not use, and it earns
 * its place by carrying the two fields the row cannot: `ownerName` and `suspendedReason`.
 * A suspended shop's reason is the sentence somebody will be asked to justify, and it is
 * the one field on this record that a `SUSPENDED` badge cannot carry on its own.
 */
function BusinessSheet({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "business", businessId],
    queryFn: () => adminApi.business(businessId),
    enabled: open,
  });

  /*
    The envelope, not the row.

    `admin.business` answers with `{ business, recentOrders, auditLog }`, and every field
    read below used to be `data.<field>` against what is really `data.business.<field>`.
    The query therefore threw a `ZodError` on open and this sheet could render nothing but
    its error state — for every business, on every row.

    Naming the row once here rather than at twelve access sites is the point: a sheet that
    reads `data.business.status` is legible, and one that reads `data.status` reads as
    though the endpoint had returned the row on its own, which is the belief that produced
    the bug.
  */
  const detail = data ?? null;
  const business = detail?.business ?? null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="text-left font-medium underline-offset-2 hover:underline"
        >
          Ver ficha
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{business?.name ?? "Negocio"}</SheetTitle>
          <SheetDescription>
            {isError
              ? "No se pudo abrir la ficha."
              : business
                ? `/${business.slug}`
                : "Cargando…"}
          </SheetDescription>
        </SheetHeader>
        {/*
          This one used to render `isPending || !data` and nothing else, so a failed read
          left a sheet titled "Negocio" showing "Cargando…" above a skeleton that never
          resolved. It is the only query on the page with no `isError` branch, and it is the
          worst version of the bug the others had: the others said something was wrong, this
          one said it was still working.
        */}
        {isError ? (
          <QueryErrorState
            error={error}
            fallback="No se pudo cargar la ficha del negocio."
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        ) : isPending || !business || !detail ? (
          <Skeleton className="mt-4 h-48 w-full" />
        ) : (
          <>
            <dl className="mt-6 space-y-4 text-sm">
              {[
                ["Estado", <StatusBadge key="s" status={business.status} />],
                ["Verificado", business.isVerified ? "Sí" : "No"],
                ["Ciudad", business.city],
                ["Propietario", business.ownerName ?? "—"],
                ["Correo", business.ownerEmail ?? "—"],
                ["Productos", String(business.productCount)],
                ["Órdenes", String(business.orderCount)],
                ["Volumen", money(business.grossVolumeMinor, business.currency)],
                ["Alta", shortDate(business.createdAt)],
                ["Motivo de suspensión", business.suspendedReason ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>

            {/*
              The two lists the endpoint already returns and the sheet used to throw away.

              They are here because "Ver ficha" is opened to answer a question about a shop,
              and the question is rarely "what is its product count" — it is "what has this
              merchant been doing" and "who touched this account". The service was already
              fetching ten orders and twenty-five audit entries for exactly this; the
              console parsed them out of existence.

              Each list says so when it is empty rather than rendering nothing, because an
              absent section and a section with nothing in it look identical otherwise, and
              "no orders yet" is an answer an operator is asking for.
            */}
            <section className="mt-6">
              <h3 className="text-sm font-semibold">Últimas órdenes</h3>
              {detail.recentOrders.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Este negocio todavía no tiene órdenes.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {detail.recentOrders.map((o) => (
                    <li key={o.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono">{o.reference}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {money(o.totalMinor, o.currency)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {o.customerName} · {o.status} · {shortDate(o.placedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-semibold">Auditoría</h3>
              {detail.auditLog.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nadie ha tocado este negocio desde que se registró.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {detail.auditLog.map((e) => (
                    <li key={e.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono">{e.action}</span>
                        <span className="text-muted-foreground">
                          {e.actorName ?? "—"} · {shortDate(e.createdAt)}
                        </span>
                      </div>
                      {e.reason ? (
                        <p className="mt-0.5 text-muted-foreground">{e.reason}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Before and after, for the audit entries that carry them.
 *
 * A separate table rather than two more columns because the halves are variable-width JSON:
 * a subscription payment's `after` has six keys and a category update's has seven, and a
 * column sized for one of them is wrong for the other. A row that expands is also the only
 * way to show them without a column per target type.
 *
 * Only entries where `after` is not `null` are listed. A `category.delete` writes
 * `after: null` — the row is gone, and "after: null" *is* the information — so it is
 * excluded here for a different reason and worth saying so: an operator reading this table is
 * looking for what changed, and a deletion changed nothing because there is nothing left.
 * It is still in the main table above, with the reason that explains it.
 */
function AuditDiffTable({ rows }: { rows: readonly AuditLogEntry[] }) {
  const changed = rows.filter((entry) => entry.after !== null && entry.after !== undefined);
  if (changed.length === 0) return null;

  return (
    <details className="rounded-md border">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
        Qué cambió ({changed.length} {changed.length === 1 ? "entrada" : "entradas"})
      </summary>
      <div className="border-t p-4">
        <ul className="space-y-3">
          {changed.map((entry) => (
            <li key={entry.id}>
              <p className="font-mono text-xs">{entry.action}</p>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px]">
                  {JSON.stringify(entry.before ?? null, null, 2)}
                </pre>
                <pre className="overflow-x-auto rounded bg-amber-500/5 p-2 text-[11px]">
                  {JSON.stringify(entry.after, null, 2)}
                </pre>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function AuditTab() {
  const dates = useDateRange();
  const page = useAdminPage<AuditLogEntry>({
    /*
      No sort is sent, and no sort control is offered.

      `adminListInput` carries `sort` and `adminApi.auditLog` would forward it — but
      `auditLogEntries` never reads it: the query orders by `createdAt` and nothing else. A
      picker on this table would change nothing while looking like it had, and an operator
      sorting by *Volumen* here would be reading an order they did not ask for with no cue
      that tells them it is one.

      A missing feature is recoverable; a lying control is not. This is the one table in the
      console that gets a pager and no sort, and that asymmetry is deliberate.
    */
    queryKey: [dates.from, dates.to],
    queryFn: ({ cursor, limit }) =>
      adminApi.auditLog({
        from: dates.range.from,
        to: dates.range.to,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudo cargar la auditoría."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <DateRangeFilter range={dates} onChange={page.reset} column="cuándo" />
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuándo</TableHead>
            <TableHead>Acción</TableHead>
            {/*
              `actorName` and `targetType` were being sent and not drawn.

              An audit entry without an actor is not an audit entry — it is a timestamp with
              a verb — and `auditLogEntrySchema` has carried `actorName`, `targetType` and
              `targetId` from the start. The actor is rendered as a fallback pair rather than
              a dash, because `auditLogEntries` left-joins `user` **deliberately**: an admin
              whose account is gone keeps their name on the record only while the row
              survives, so the id is the honest last resort and hiding it would lose the trail.
            */}
            <TableHead>Quién</TableHead>
            <TableHead>Sobre</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {shortDate(e.createdAt)}
              </TableCell>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell className="text-xs">
                {e.actorName ?? <span className="font-mono text-muted-foreground">{e.actorId}</span>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.targetType}
                <span className="block font-mono text-[11px] opacity-70">{e.targetId}</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{e.reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/*
        Before and after, for the entries that have both.

        `auditLogEntrySchema` types these as `z.unknown()` because the targets differ — a
        suspension has statuses, a category delete has a name and a slug, a payment has
        amounts — so a column would have to guess at a shape. Rather than print `[object
        Object]`, an entry that changed something gets a disclosure showing the two
        JSON-serialised halves side by side.

        This is the part of the log that answers "what did this actually do", and it was the
        reason the tab existed, so rendering only the action name was the least useful half of
        the row.
      */}
      <AuditDiffTable rows={data.rows} />
      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="entradas de auditoría"
      />
    </div>
  );
}

/**
 * The gate, on the page, and not in a layout.
 *
 * `PlatformAdminLayout` is the *saas-api* admin shell: it reads `useAuth()`, which calls
 * `api.getMe()` and `api.login(email, password, workspaceSlug)` — endpoints the marketplace
 * Worker has never mounted. Anything wrapped in it inherits a broken session, so the
 * console does not use it and carries its own gate instead.
 *
 * Reading `isAdmin` before rendering is a courtesy, not a control. Every procedure behind
 * `adminProcedure` checks the same flag server-side, so this only decides whether to draw
 * a console or a sentence — the security is entirely on the Worker, and a page that skipped
 * this check would still be correct and merely ugly.
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "viewer"],
    queryFn: adminApi.viewer,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // A failed `users.me` is a signed-out visitor, not a server fault, and the two deserve
  // different words: one is "sign in", the other is "try again".
  //
  // Only the second one is retryable, and until this was split the branch drew both with the
  // same dead end — "Vuelve a intentarlo en un momento" with nothing to press, on the one
  // screen an operator sees before they have done anything at all. Asking somebody whose
  // session expired to try again is pointless; showing them a button on a genuine server
  // fault is the whole point.
  if (isError) {
    const status = (error as { data?: { code?: string } } | undefined)?.data?.code;
    if (status === "UNAUTHORIZED") {
      return (
        <div className="p-6">
          <Card className="mx-auto max-w-md">
            <CardContent className="pt-6 text-center">
              <h1 className="text-lg font-semibold">No pudimos verificar tu sesión</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Inicia sesión en PymesHub y vuelve a abrir la consola.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <QueryErrorState
        error={error}
        fallback="No pudimos verificar tu sesión."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  if (!data?.isAdmin) {
    return (
      <div className="p-6">
        <Card className="mx-auto max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Esta consola es para el equipo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu cuenta está iniciada pero no es de plataforma. Si debería serlo, pídele a
              alguien con acceso que te la otorgue.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminConsolePage() {
  return (
    <AdminGate>
      <AdminConsole />
    </AdminGate>
  );
}
function AdminConsole() {
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();

  // One metrics query, read by the tiles only. It used to be declared twice under the same
  // key - once here, once in `Metrics` - which React Query deduplicates into a single request
  // but leaves as two observers each carrying their own `refetchInterval`.
  const metricsQuery = useAdminMetrics();
  const { data: metrics } = metricsQuery;

  /*
   * Queue depth, from `admin.approvalCounts`.
   *
   * These two integers used to come from two different places: `pendingVerification` out of
   * `metrics` - a ~30-row payload that refetches every 30 seconds, read for one number - and
   * the courier half from `couriers({ status: "PENDING", limit: 1 })`, reading `.total` off a
   * one-row page. One request now, for both, and the badge no longer rides on the metrics
   * poll: a failing metrics endpoint used to take the queue badge down with it, which is the
   * wrong dependency - the queue is the thing that matters when the KPIs are broken.
   *
   * `staleTime` because queue depth changes on somebody else's action, not on a timer, and
   * re-reading it every 30 seconds would be asking the same question 30 times.
   */
  const approvalCountsQuery = useQuery({
    queryKey: ["admin", "approvalCounts"],
    queryFn: adminApi.approvalCounts,
    staleTime: 30_000,
  });
  const pending = approvalCountsQuery.data?.pendingVerification ?? 0;
  const pendingCouriers = approvalCountsQuery.data?.pendingCouriers ?? 0;

  /*
   * `isFetched` rather than `isPending`, so a *failed* count still lets the redirect
   * happen. Waiting on success would leave a console whose queue endpoint is down sitting
   * on a spinner forever, with no tab and no way forward except the URL bar.
   */
  const queueKnown = approvalCountsQuery.isFetched;

  // An unknown or missing `:tab` is rewritten to the default rather than rendered as an
  // empty page. `/admin/console` with no param is the link the sidebar uses, and an old
  // bookmark naming a tab that has since been renamed should land somewhere useful too.
  const { tab, needsRedirect } = resolveConsoleTab(
    routeTab,
    { pending, couriers: pendingCouriers },
    queueKnown,
  );
  useEffect(() => {
    if (needsRedirect && tab) navigate(`/admin/console/${tab}`, { replace: true });
  }, [needsRedirect, tab, navigate]);

  const approvalBadge = pending + pendingCouriers;

  /*
   * Nothing is rendered until the tab is known.
   *
   * The alternative — falling back to `businesses` while the queue is still being counted —
   * is the bug this branch exists to avoid: the operator sees one tab for a few hundred
   * milliseconds, the redirect lands, and the tab they were reading is replaced by another.
   * A skeleton for the length of two requests is cheaper than a page that moves under
   * somebody who has already started working in it.
   */
  if (!tab) {
    return (
      <PageTemplate
        title="Consola de plataforma"
        description="Todo lo que hay aquí queda registrado con tu nombre."
      >
        <Skeleton className="h-9 w-full" />
        <Skeleton className="mt-5 h-72 w-full" />
      </PageTemplate>
    );
  }

  /*
   * One `Tabs` root wrapping the whole page, not one around the strip and another around
   * the panels.
   *
   * They have to be the same root: Radix wires each trigger's `aria-controls` to a panel
   * inside *its own* context, so a strip in one root and panels in another leaves every
   * trigger announcing a panel that does not exist. `Tabs.Root` renders no DOM node of its
   * own — it is context only — so wrapping `PageTemplate` costs nothing structurally, and
   * it is what lets the strip sit in the sticky header while the panels sit in the body.
   * That split is the reason `PageTemplate` grew a `headerExtra` slot.
   */
  return (
    <Tabs value={tab} onValueChange={(next) => navigate(`/admin/console/${next}`)}>
      <PageTemplate
        title="Consola de plataforma"
        description="Todo lo que hay aquí queda registrado con tu nombre."
        headerExtra={
          /*
            Horizontally scrollable rather than wrapped or clipped. Ten labels do not fit a
            768px viewport, and the three ways to deal with that are each worse than a
            scroll: wrapping puts the second row's tabs at an unpredictable distance from the
            first, clipping hides tabs with no affordance that more exist, and a "Más" menu
            moves the tabs an operator uses daily one tap further away. A scrollbar keeps
            every tab one click away and keeps Radix's roving arrow-key focus intact, which
            a hand-built dropdown menu would not.
          */
          <TabsList className="w-full justify-start overflow-x-auto">
            {CONSOLE_TABS.map((entry) => {
              const badge =
                entry.value === "approvals"
                  ? approvalBadge
                  : entry.value === "couriers"
                    ? pendingCouriers
                    : 0;
              return (
                <TabsTrigger key={entry.value} value={entry.value} className="shrink-0">
                  {entry.label}
                  {badge > 0 ? (
                    <Badge className="ml-2 bg-amber-500 text-black">{badge}</Badge>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        }
      >
        <div className="space-y-5">
          <Metrics query={metricsQuery} />

          <TabsContent value="approvals" className="mt-0">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4 text-amber-600" />
                    Esperan verificación
                    {pending > 0 ? (
                      <Badge className="bg-amber-500 text-black">{pending}</Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BusinessTab onlyPending />
                </CardContent>
              </Card>

              {/*
                The second queue, on the same screen, because "Aprobaciones" is the tab someone
                opens when they are told someone is waiting. Splitting the courier queue onto
                its own tab meant the tab with the amber badge hid half of what the badge counts,
                and a badge that does not add up is worse than no badge.
              */}
              {pendingCouriers > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bike className="h-4 w-4 text-amber-600" />
                      Repartidores por revisar
                      <Badge className="bg-amber-500 text-black">{pendingCouriers}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CouriersTab onlyPending />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="couriers" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <CouriersTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="businesses" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <BusinessTab onlyPending={false} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <UsersTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <OrdersTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <BillingTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prices" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <PriceBooksTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <CategoriesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <SupportTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalogue" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <CatalogueTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <AuditTab />
              </CardContent>
            </Card>
          </TabsContent>

          {metrics && metrics.orders.cancelledRate > 0.2 ? (
            <p className="flex items-center gap-2 text-xs text-amber-600">
              <XCircle className="h-3 w-3" />
              La tasa de cancelación está por encima del 20%. Vale la pena mirarla en Auditoría.
            </p>
          ) : null}
        </div>
      </PageTemplate>
    </Tabs>
  );
}

export { BUSINESS_STATUSES };
