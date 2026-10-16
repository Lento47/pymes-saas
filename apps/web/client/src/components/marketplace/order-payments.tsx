import { createTranslator, type MessageKey } from "@pymeshub/i18n";
import {
  choosePaymentMethodInput,
  MAX_UPLOAD_BYTES,
  orderPaymentsSchema,
  PAYMENT_ERROR_KEYS,
  submitPaymentProofInput,
  type OrderPayment,
  UPLOAD_MIME_TYPES,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { trpc } from "@/lib/marketplace";
import { money } from "./cards";
import { AmberButton } from "./public-shell";

const { t } = createTranslator("es");
const queryKey = (orderId: string) => ["order-payments", orderId];
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return (PAYMENT_ERROR_KEYS as readonly string[]).includes(message)
    ? t(message as MessageKey)
    : "No se pudo actualizar el pago. Intenta de nuevo.";
}

export function CustomerOrderPayments({ orderId }: { orderId: string }) {
  const query = useQuery({
    queryKey: queryKey(orderId),
    queryFn: async () =>
      orderPaymentsSchema.parse(await trpc.orders.payments.query({ orderId })),
    refetchInterval: 5000,
  });
  if (query.isPending) return <p role="status">Cargando pagos…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>{failure(query.error)}</p>
        <button onClick={() => query.refetch()} className="min-h-11 underline">
          Intentar de nuevo
        </button>
      </div>
    );
  return (
    <section className="space-y-4" aria-label={t("payments.title")}>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">{t("payments.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            query.data.legacy
              ? "payments.legacy"
              : query.data.cashAdvance
                ? "payments.cashCustomer"
                : query.data.courierChargeMinor > 0
                  ? "payments.sinpeCustomer"
                  : "payments.payShop",
          )}
        </p>
      </div>
      {query.data.payments
        .filter(
          (pay) => pay.amountMinor > 0 && pay.purpose !== "MERCHANT_DELIVERY",
        )
        .map((pay) => (
          <CustomerPaymentStep
            key={pay.id}
            orderId={orderId}
            payment={pay}
            cashAdvance={query.data.cashAdvance}
          />
        ))}
    </section>
  );
}
function CustomerPaymentStep({
  orderId,
  payment: pay,
  cashAdvance,
}: {
  orderId: string;
  payment: OrderPayment;
  cashAdvance: boolean;
}) {
  const cache = useQueryClient();
  const [reference, setReference] = useState("");
  const [view, setView] = useState(false);
  const [localError, setLocalError] = useState("");
  const refresh = async () => {
    setView(false);
    await cache.invalidateQueries({ queryKey: queryKey(orderId) });
    await cache.invalidateQueries({ queryKey: ["order", orderId] });
  };
  const method = useMutation({
    mutationFn: async (value: "CASH" | "SINPE_MOVIL") =>
      orderPaymentsSchema.parse(
        await trpc.orders.choosePaymentMethod.mutate(
          choosePaymentMethodInput.parse({
            orderId,
            purpose: pay.purpose,
            expectedVersion: pay.version,
            method: value,
          }),
        ),
      ),
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: async (input: z.infer<typeof submitPaymentProofInput>) =>
      orderPaymentsSchema.parse(
        await trpc.orders.submitPaymentProof.mutate(
          submitPaymentProofInput.parse(input),
        ),
      ),
    onSuccess: refresh,
  });
  const proof = useQuery({
    queryKey: ["payment-proof", orderId, pay.purpose, pay.proofId],
    enabled: view && pay.canViewProof && Boolean(pay.proofId),
    queryFn: async () =>
      z
        .object({ mimeType: z.enum(UPLOAD_MIME_TYPES), base64: z.string() })
        .parse(
          await trpc.orders.paymentProof.query({
            orderId,
            purpose: pay.purpose,
            proofId: pay.proofId,
          }),
        ),
  });
  const busy = method.isPending || upload.isPending;
  const title =
    pay.purpose === "MERCHANT_ORDER"
      ? cashAdvance
        ? "payments.courierAdvance"
        : "payments.merchantAmount"
      : cashAdvance
        ? "payments.courierCollection"
        : "payments.deliveryAmount";
  const stateKeys: Record<OrderPayment["status"], MessageKey> = {
    AWAITING_PAYMENT: "payments.status.AWAITING_PAYMENT",
    AWAITING_VERIFICATION: "payments.status.AWAITING_VERIFICATION",
    CONFIRMED: "payments.status.CONFIRMED",
    REJECTED: "payments.status.REJECTED",
    NOT_REQUIRED: "payments.status.NOT_REQUIRED",
  };
  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    if (
      file.size > MAX_UPLOAD_BYTES ||
      !(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setLocalError(t("payments.refusal.image"));
      return;
    }
    setLocalError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read"));
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });
      upload.mutate({
        orderId,
        purpose: pay.purpose,
        expectedVersion: pay.version,
        mimeType: file.type as (typeof UPLOAD_MIME_TYPES)[number],
        base64,
        reference: reference.trim() || undefined,
      });
    } catch {
      setLocalError(t("payments.refusal.image"));
    }
  };
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{t(title)}</h3>
        <strong className="tabular-nums">
          {money(pay.amountMinor, pay.currency)}
        </strong>
      </div>
      <p className="text-sm" role="status">
        {t(stateKeys[pay.status])}
      </p>
      {pay.rejectionReason ? (
        <p className="text-sm text-destructive">{pay.rejectionReason}</p>
      ) : null}
      {!pay.unlocked && !["CONFIRMED", "NOT_REQUIRED"].includes(pay.status) ? (
        <p className="text-sm text-muted-foreground">
          {t(
            pay.purpose === "MERCHANT_ORDER"
              ? "payments.awaitCourier"
              : "payments.wait",
          )}
        </p>
      ) : null}
      {pay.canPay && pay.unlocked && pay.status !== "AWAITING_VERIFICATION" ? (
        <>
          {pay.purpose === "COURIER_COLLECTION" ? (
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Método de pago de entrega</legend>
              {(["CASH", "SINPE_MOVIL"] as const).map((value) => (
                <label className="flex min-h-11 items-center gap-2" key={value}>
                  <input
                    type="radio"
                    name={`method-${pay.id}`}
                    checked={pay.method === value}
                    disabled={
                      busy || (value === "SINPE_MOVIL" && !pay.sinpeAvailable)
                    }
                    onChange={() => method.mutate(value)}
                  />
                  {t(value === "CASH" ? "payments.cash" : "payments.sinpe")}
                </label>
              ))}
            </fieldset>
          ) : null}
          {pay.method === "SINPE_MOVIL" && pay.sinpePhone ? (
            <>
              <p className="text-xl font-semibold tabular-nums">
                {pay.sinpePhone}
              </p>
              <p>{pay.payeeName}</p>
              <label className="block space-y-1 text-sm">
                <span>{t("payments.reference")}</span>
                <input
                  className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                  value={reference}
                  maxLength={120}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>{t("payments.upload")}</span>
                <input
                  className="block min-h-11 w-full max-w-full"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => void selectFile(event.target.files?.[0])}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {t("payments.uploadHelp")}
              </p>
            </>
          ) : (
            <p>
              {t("payments.cash")} · {money(pay.amountMinor, pay.currency)}
            </p>
          )}
        </>
      ) : null}
      {pay.canViewProof ? (
        <AmberButton onClick={() => setView((current) => !current)}>
          {t("payments.viewProof")}
        </AmberButton>
      ) : null}
      {view && proof.data ? (
        <img
          className="max-h-96 w-full rounded-md object-contain"
          src={`data:${proof.data.mimeType};base64,${proof.data.base64}`}
          alt={t("payments.proofLabel")}
        />
      ) : null}
      {upload.isPending ? <p role="status">Enviando comprobante…</p> : null}
      {localError || method.error || upload.error || proof.error ? (
        <p role="alert" className="text-sm text-destructive">
          {localError || failure(method.error ?? upload.error ?? proof.error)}
        </p>
      ) : null}
    </div>
  );
}
