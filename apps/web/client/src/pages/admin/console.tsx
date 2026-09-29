import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  type AdminAction,
  type AdminBusinessRow,
  type AdminUserRow,
  adminApi,
  BUSINESS_STATUSES,
  needsReason,
} from "@/lib/admin";

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

function Metrics() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: adminApi.metrics,
    refetchInterval: 30_000,
  });

  if (isPending) return <Skeleton className="h-24 w-full" />;
  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="pt-6 text-sm text-destructive">
          {(error as Error)?.message}
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const tiles = [
    { label: "Negocios pendientes", value: data.businesses.pendingVerification, urgent: data.businesses.pendingVerification > 0 },
    { label: "Negocios activos", value: data.businesses.active },
    { label: "Negocios suspendidos", value: data.businesses.suspended },
    { label: "Usuarios", value: data.users.total },
    { label: "Admins", value: data.users.admins },
    { label: "Órdenes hoy", value: data.orders.today },
    { label: "Órdenes activas", value: data.orders.active },
    { label: "Tasa de cancelación", value: `${Math.round(data.orders.cancelledRate * 100)}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
  );
}

function BusinessTable({ rows }: { rows: AdminBusinessRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nada por aquí.</p>;
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
              <div className="font-medium">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.ownerEmail ?? "—"}</div>
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
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "businesses", onlyPending, search],
    queryFn: () =>
      onlyPending
        ? adminApi.pendingVerifications()
        : adminApi.businesses({ search: search || undefined }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>;
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
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => adminApi.users({ search: search || undefined }),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>;
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
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => adminApi.orders(),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>;
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
  const { data, isPending, isError, error } = useQuery({
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
      <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>
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

  const { data, isPending, isError, error } = useQuery({
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
      <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>
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

  const { data, isPending, isError, error } = useQuery({
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
      <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>
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

function AuditTab() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => adminApi.auditLog(),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</p>;
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
  const { data, isPending, isError, error } = useQuery({
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
  if (isError) {
    const status = (error as { data?: { code?: string } } | undefined)?.data?.code;
    return (
      <div className="p-6">
        <Card className="mx-auto max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-lg font-semibold">No pudimos verificar tu sesión</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {status === "UNAUTHORIZED"
                ? "Inicia sesión en PymesHub y vuelve a abrir la consola."
                : "Vuelve a intentarlo en un momento."}
            </p>
          </CardContent>
        </Card>
      </div>
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
  const { data: metrics } = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: adminApi.metrics,
    refetchInterval: 30_000,
  });

  // The courier queue has no count in `adminMetricsSchema`, so its badge asks for one row.
  // It is the same query the tab makes, cached under the same key, so it costs no extra
  // round trip once the tab is open — and `staleTime` keeps it from re-fetching on every
  // 30s metrics tick, which is the whole reason to set it.
  const { data: pendingCourierPage } = useQuery({
    queryKey: ["admin", "couriers", "PENDING", 1],
    queryFn: () => adminApi.couriers({ status: "PENDING", limit: 1 }),
    staleTime: 60_000,
  });
  const pendingCouriers = pendingCourierPage?.total ?? 0;

  const pending = metrics?.businesses.pendingVerification ?? 0;
  const hasQueue = pending > 0 || pendingCouriers > 0;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consola de plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que hay aquí queda registrado con tu nombre.
          </p>
        </div>
      </header>

      <Metrics />

      <Tabs defaultValue={hasQueue ? "approvals" : "businesses"}>
        <TabsList>
          <TabsTrigger value="approvals">
            Aprobaciones
            {hasQueue ? (
              <Badge className="ml-2 bg-amber-500 text-black">{pending + pendingCouriers}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="couriers">
            Repartidores
            {pendingCouriers > 0 ? (
              <Badge className="ml-2 bg-amber-500 text-black">{pendingCouriers}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="businesses">Negocios</TabsTrigger>
          <TabsTrigger value="users">Personas</TabsTrigger>
          <TabsTrigger value="orders">Órdenes</TabsTrigger>
          <TabsTrigger value="support">Soporte</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4">
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

        <TabsContent value="couriers" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <CouriersTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="businesses" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <BusinessTab onlyPending={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <UsersTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <OrdersTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <SupportTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <AuditTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {metrics && metrics.orders.cancelledRate > 0.2 ? (
        <p className="flex items-center gap-2 text-xs text-amber-600">
          <XCircle className="h-3 w-3" />
          La tasa de cancelación está por encima del 20%. Vale la pena mirarla en Auditoría.
        </p>
      ) : null}
    </div>
  );
}

export { BUSINESS_STATUSES };
