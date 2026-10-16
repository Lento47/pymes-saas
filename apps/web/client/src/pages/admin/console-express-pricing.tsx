import {
  DEFAULT_DELIVERY_PRICING_TERMS,
  deliveryPricingTermsSchema,
  type DeliveryPricingTerms,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminApi } from "@/lib/admin";

const queryKey = ["admin", "express-pricing"];
const money = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(value);
type Policy = Awaited<ReturnType<typeof adminApi.pricingPolicy>>;
type Draft = Policy["rows"][number];

export function ExpressPricingTab() {
  const query = useQuery({ queryKey, queryFn: adminApi.pricingPolicy });
  if (query.isPending) return <p role="status">Cargando tarifas…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>No se pudieron cargar las tarifas.</p>
        <Button onClick={() => query.refetch()}>Reintentar</Button>
      </div>
    );
  return <PricingEditor key={query.data.headVersion} policy={query.data} />;
}

function PricingEditor({ policy }: { policy: Policy }) {
  const queryClient = useQueryClient();
  const [terms, setTerms] = useState<DeliveryPricingTerms>(policy.active.terms);
  const [reason, setReason] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [saved, setSaved] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [km, setKm] = useState("4");
  const [minutes, setMinutes] = useState("12");
  const [validation, setValidation] = useState("");
  const save = useMutation({
    mutationFn: adminApi.savePricingPolicyDraft,
    onSuccess: (draft) => {
      setSaved(draft);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const publish = useMutation({
    mutationFn: adminApi.updatePricingPolicy,
    onSuccess: () => {
      setConfirm(false);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const simulate = useMutation({ mutationFn: adminApi.simulatePricingPolicy });
  const busy = save.isPending || publish.isPending;
  const changed = (key: keyof DeliveryPricingTerms, value: number | null) => {
    setTerms((current) => ({ ...current, [key]: value }));
    setSaved(null);
    simulate.reset();
    setValidation("");
  };
  const parsed = () => {
    const result = deliveryPricingTermsSchema.safeParse(terms);
    if (!result.success) {
      setValidation("Usa importes enteros. La base debe ser al menos ₡1; el máximo por campo es ₡10 000 000.");
      return null;
    }
    return result.data;
  };
  const saveDraft = () => {
    const valid = parsed();
    if (!valid) return;
    if (reason.trim().length < 10) {
      setValidation("Explica el motivo del cambio en al menos 10 caracteres.");
      return;
    }
    const activeFrom = scheduled ? new Date(scheduled) : undefined;
    if (activeFrom && !Number.isFinite(activeFrom.getTime())) {
      setValidation("Elige una fecha de vigencia válida.");
      return;
    }
    save.mutate({
      terms: valid,
      expectedVersion: policy.headVersion,
      reason,
      activeFrom,
    });
  };
  const preview = () => {
    const valid = parsed();
    const distance = Number(km),
      duration = Number(minutes);
    if (!valid) return;
    if (
      !km.trim() ||
      !minutes.trim() ||
      !Number.isFinite(distance) ||
      distance < 0 ||
      distance > 1000 ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > 2880
    ) {
      setValidation(
        "Usa una distancia de 0 a 1000 km y un tiempo estimado de 0 a 2880 minutos.",
      );
      return;
    }
    setValidation("");
    simulate.mutate({
      terms: valid,
      distanceMeters: distance * 1000,
      durationSeconds: duration * 60,
    });
  };
  const error =
    validation ||
    save.error?.message ||
    publish.error?.message ||
    simulate.error?.message;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tarifa vigente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xl font-semibold tabular-nums">
            {money(policy.active.terms.baseCRC)} +{" "}
            {money(policy.active.terms.perKmCRC)}/km +{" "}
            {money(policy.active.terms.perEstimatedMinuteCRC)}/min estimado
          </p>
          <p className="text-sm text-muted-foreground">
            El precio se confirma al pedir. Esperas, tráfico y cambios de ETA no
            aumentan el cobro ni el pago aceptado por el repartidor.
          </p>
          <p className="break-all text-xs text-muted-foreground">
            Versión: {policy.active.version}
          </p>
          {!policy.canManage ? (
            <p>
              Solo Super Admin con pricing.manage puede cambiar estas tarifas.
            </p>
          ) : null}
        </CardContent>
      </Card>
      {policy.canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>1. Preparar cambio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["baseCRC", "Base (₡)"],
                    ["perKmCRC", "Por kilómetro (₡)"],
                    ["perEstimatedMinuteCRC", "Por minuto estimado (₡)"],
                  ] as const
                ).map(([key, label]) => (
                  <Input
                    key={key}
                    label={label}
                    type="number"
                    min={key === "baseCRC" ? 1 : 0}
                    max={10000000}
                    step={1}
                    required
                    value={Number.isFinite(terms[key]) ? terms[key] : ""}
                    disabled={busy}
                    onChange={(event) =>
                      changed(
                        key,
                        event.target.value === ""
                          ? Number.NaN
                          : event.target.valueAsNumber,
                      )
                    }
                  />
                ))}
              </div>
              <Input
                label="Tope para aceptar un envío (₡, opcional)"
                type="number"
                min={0}
                step={1}
                value={terms.customerPriceCapCRC ?? ""}
                disabled={busy}
                description="Vacío: sin tope. Si el precio lo supera, el envío no se ofrece. No reduce el pago del repartidor."
                onChange={(event) =>
                  changed(
                    "customerPriceCapCRC",
                    event.target.value === ""
                      ? null
                      : event.target.valueAsNumber,
                  )
                }
              />
              <Input
                label="Vigencia desde (hora local, opcional)"
                type="datetime-local"
                value={scheduled}
                disabled={busy}
                description="Vacío: al publicar. Una fecha futura mantiene la tarifa vigente hasta ese momento."
                onChange={(event) => {
                  setScheduled(event.target.value);
                  setSaved(null);
                }}
              />
              <Textarea
                label="Motivo del cambio"
                value={reason}
                minLength={10}
                maxLength={1000}
                disabled={busy}
                onChange={(event) => {
                  setReason(event.target.value);
                  setSaved(null);
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  setTerms({ ...DEFAULT_DELIVERY_PRICING_TERMS });
                  setSaved(null);
                  simulate.reset();
                }}
                disabled={busy}
              >
                Restablecer
              </Button>
              <details className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer font-medium">
                  Descuentos y recargos: desactivados
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">
                  Proximidad: máximo 10%, hasta 3 minutos por carretera. Pedido
                  listo: máximo 5%. Combinado: máximo 15%. Recargo dinámico: ₡0.
                  Requieren presupuesto, margen verificado y controles de abuso
                  antes de habilitarse.
                </p>
              </details>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Simular antes de publicar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Distancia por carretera (km)"
                  type="number"
                  min={0}
                  max={1000}
                  step="any"
                  value={km}
                  onChange={(e) => {
                    setKm(e.target.value);
                    simulate.reset();
                  }}
                />
                <Input
                  label="Tiempo de conducción estimado (min)"
                  type="number"
                  min={0}
                  max={2880}
                  step="any"
                  value={minutes}
                  onChange={(e) => {
                    setMinutes(e.target.value);
                    simulate.reset();
                  }}
                />
              </div>
              <Button
                variant="secondary"
                onClick={preview}
                disabled={simulate.isPending || busy}
              >
                Simular
              </Button>
              {simulate.data ? (
                <div className="rounded-lg bg-muted p-4" role="status">
                  <p className="text-xl font-semibold">
                    Cliente: {money(simulate.data.customerFeeCRC)}
                  </p>
                  <p>
                    Repartidor: {money(simulate.data.courierPayoutCRC)} por esta
                    entrega.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sin descuento ni subsidio. Si el comercio ofrece envío
                    gratis, debe cubrir {money(simulate.data.courierPayoutCRC)}.
                  </p>
                  {simulate.data.exceedsCap ? (
                    <p className="mt-2 font-medium">
                      Supera el tope. Esta ruta no se ofrecerá al cliente.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Se redondea una sola vez a colones enteros. El minuto
                corresponde a esta estimación, nunca a un cronómetro.
              </p>
            </CardContent>
          </Card>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={saveDraft} disabled={busy}>
              Guardar borrador
            </Button>
            <Button
              onClick={() => setConfirm(true)}
              style={{ color: "hsl(var(--background))" }}
              disabled={!saved || !simulate.data || busy}
            >
              Revisar y publicar
            </Button>
          </div>
          {saved ? (
            <p role="status" className="text-sm text-muted-foreground">
              Borrador guardado. Aún no cambia ningún precio.
            </p>
          ) : null}
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Publicar esta tarifa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Base {money(terms.baseCRC)}, {money(terms.perKmCRC)}/km y{" "}
                  {money(terms.perEstimatedMinuteCRC)}/min estimado. Solo
                  cambiarán las nuevas cotizaciones desde{" "}
                  {saved?.activeFrom.toLocaleString("es-CR")}. Las cotizaciones
                  vigentes, pedidos y pagos aceptados conservan su precio.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <p className="text-sm">Motivo: {reason}</p>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={publish.isPending}>
                  Volver
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={publish.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (saved)
                      publish.mutate({
                        draftId: saved.id,
                        expectedVersion: policy.headVersion,
                        reason,
                      });
                  }}
                >
                  Publicar tarifa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {policy.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Se usa la tarifa inicial. Todavía no hay cambios publicados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {policy.rows.map((row) => (
                <li key={row.id} className="space-y-2 py-4">
                  <p className="font-medium">
                    {row.status === "DRAFT"
                      ? "Borrador"
                      : row.activeFrom > new Date()
                        ? "Programada"
                        : row.version === policy.active.version
                          ? "Vigente"
                          : "Histórica"}{" "}
                    · {row.activeFrom.toLocaleString("es-CR")}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {row.version}
                  </p>
                  <p className="text-sm">{row.approvedReason}</p>
                  {policy.canManage &&
                  row.status === "DRAFT" &&
                  row.previousVersion === policy.headVersion ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setTerms(row.terms);
                        setReason(row.approvedReason);
                        setSaved(row);
                        setScheduled("");
                        simulate.reset();
                      }}
                    >
                      Abrir borrador
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
