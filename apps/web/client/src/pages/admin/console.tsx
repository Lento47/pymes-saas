import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

import { PageTemplate } from "@/components/layout/page-template";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  type AdminAction,
  type AdminBusinessRow,
  type AdminMetrics,
  type AdminUserRow,
  adminApi,
  BUSINESS_STATUSES,
  needsReason,
  REASON_MIN_LENGTH,
  type SubscriptionStatus,
} from "@/lib/admin";
import { EmptyState, QueryErrorState } from "./console-states";
import { CONSOLE_TABS, resolveConsoleTab } from "./console-tabs";

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
              Esta acción queda en el registro de auditoría con tu nombre, y el motivo va
              con ella. No se puede deshacer desde aquí.
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
    { label: "Negocios pendientes", value: metrics.businesses.pendingVerification, urgent: metrics.businesses.pendingVerification > 0 },
    { label: "Negocios activos", value: metrics.businesses.active },
    { label: "Negocios suspendidos", value: metrics.businesses.suspended },
    { label: "Usuarios", value: metrics.users.total },
    { label: "Admins", value: metrics.users.admins },
    { label: "Órdenes hoy", value: metrics.orders.today },
    { label: "Órdenes activas", value: metrics.orders.active },
    { label: "Tasa de cancelación", value: `${Math.round(metrics.orders.cancelledRate * 100)}%` },
  ];

  const summary = [
    metrics.businesses.pendingVerification > 0
      ? `${metrics.businesses.pendingVerification} por verificar`
      : null,
    `${metrics.orders.today} órdenes hoy`,
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
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {tiles.map((t) => (
          <Card key={t.label} className={t.urgent ? "border-amber-500/50" : undefined}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${t.urgent ? "text-amber-600" : ""}`}>
                {t.value}
              </p>
            </CardContent>
          </Card>
        ))}
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
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "businesses", onlyPending, search],
    queryFn: () =>
      onlyPending
        ? adminApi.pendingVerifications()
        : adminApi.businesses({ search: search || undefined }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
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
      {!onlyPending ? (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, slug o correo"
          className="max-w-md"
          aria-label="Buscar negocios"
        />
      ) : null}
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <BusinessTable rows={data.rows} />
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => adminApi.users({ search: search || undefined }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
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
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o correo"
        className="max-w-md"
        aria-label="Buscar usuarios"
      />
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
                  {!u.isAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => adminApi.grantAdmin(u.id).catch(() => undefined)}
                    >
                      Dar admin
                    </Button>
                  ) : null}
                  <ActionButton
                    label="Suspender"
                    action="user.suspend"
                    targetName={u.name}
                    onRun={(reason) => adminApi.suspendUser(u.id, reason ?? "")}
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

function OrdersTab() {
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => adminApi.orders(),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
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
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referencia</TableHead>
            <TableHead>Negocio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
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
              <TableCell className="text-right tabular-nums">
                {money(o.totalMinor, o.currency)}
              </TableCell>
              <TableCell className="text-muted-foreground">{shortDate(o.placedAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
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
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "couriers", onlyPending ? "PENDING" : "all", search],
    queryFn: () =>
      adminApi.couriers({
        search: search || undefined,
        status: onlyPending ? "PENDING" : undefined,
      }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
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
          onChange={(e) => setSearch(e.target.value)}
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

  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "tickets", status, search],
    queryFn: () =>
      adminApi.supportTickets({
        search: search || undefined,
        // `live` hides what is already answered, which is the default an operator wants and
        // the wrong default for auditing: the list's own note says filtering out closed
        // tickets makes a quiet weekend look like an ignored one. So `all` is one click away.
        status: status === "live" ? ["OPEN", "WAITING"] : undefined,
      }),
  });

  if (isPending) return <Skeleton className="h-72 w-full" />;
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por asunto, cuerpo, comercio o persona"
          className="max-w-md"
          aria-label="Buscar tickets"
        />
        <div className="flex gap-1">
          <Button
            variant={status === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("live")}
          >
            Sin resolver
          </Button>
          <Button
            variant={status === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("all")}
          >
            Todos
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{data?.total ?? 0} en total</p>
      </div>

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
  currency,
  onDone,
}: {
  subscriptionId: string;
  businessName: string;
  arrearsMinor: number;
  currency: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const amountMinor = toMinor(amount);
  /**
   * A mismatch needs a reason, and that is the service's rule
   * (`recordPaymentInput` documents it) rather than a nicety here. Offering the field
   * unconditionally and requiring it only on a mismatch keeps the common case — paying
   * the exact balance — to one input.
   */
  const mismatch = amountMinor !== null && amountMinor !== arrearsMinor;
  const canSubmit =
    amountMinor !== null && reference.trim().length >= 4 && (!mismatch || reason.trim().length >= 8);

  const save = useMutation({
    mutationFn: () =>
      adminApi.recordPayment({
        subscriptionId,
        amountMinor: amountMinor as number,
        reference: reference.trim(),
        reason: mismatch ? reason.trim() : undefined,
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
              Debe {money(arrearsMinor, currency)}. La referencia del banco o de SINPE es
              obligatoria: es lo único que hace el pago conciliable después.
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
                placeholder={String(arrearsMinor / 100)}
                className="mt-1"
              />
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
            {mismatch ? (
              <div>
                <label htmlFor="pay-reason" className="text-xs text-muted-foreground">
                  El monto no cuadra con la deuda — motivo (obligatorio)
                </label>
                <Textarea
                  id="pay-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            ) : null}
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
function BillingTab() {
  const [status, setStatus] = useState<"all" | SubscriptionStatus>("all");
  const [sort, setSort] = useState<"arrears" | "periodEnd" | "businessName">("arrears");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "subscriptions", status, sort, search],
    queryFn: () =>
      adminApi.subscriptions({
        search: search || undefined,
        status: status === "all" ? undefined : status,
        sort,
      }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por comercio o correo"
          className="max-w-xs"
          aria-label="Buscar suscripciones"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", "ACTIVE", "GRACE", "PAST_DUE", "SUSPENDED"] as const).map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "Todos" : (SUBSCRIPTION_STATUS_LABEL[s] ?? s)}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {(["arrears", "periodEnd", "businessName"] as const).map((s) => (
            <Button
              key={s}
              variant={sort === s ? "default" : "outline"}
              size="sm"
              onClick={() => setSort(s)}
            >
              {s === "arrears" ? "Deuda" : s === "periodEnd" ? "Vence" : "Nombre"}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {owing > 0 ? `${owing} con deuda · ` : ""}
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

function AuditTab() {
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => adminApi.auditLog(),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
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
      <p className="text-xs text-muted-foreground">{data.total} en total</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuándo</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-muted-foreground">{shortDate(e.createdAt)}</TableCell>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{e.reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
