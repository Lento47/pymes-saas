import { useMemo, useState } from "react";
import { useLocation } from "wouter";

import { EmptyState, ErrorState, money } from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useAddresses,
  useCart,
  useMarketplaceSession,
  usePlaceOrder,
  useSaveAddress,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Efectivo al recibir" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export default function MarketplaceCheckoutPage() {
  const { data: session, isLoading: loadingSession } = useMarketplaceSession();
  const cart = useCart(Boolean(session));
  const addresses = useAddresses(Boolean(session));
  const saveAddress = useSaveAddress();
  const placeOrder = usePlaceOrder();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">("DELIVERY");
  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);

  const clientRequestId = useMemo(
    () => `web_${crypto.randomUUID()}`,
    [],
  );

  if (loadingSession || (session && cart.isLoading)) {
    return (
      <MarketplaceShell>
        <Skeleton className="h-64 w-full rounded-xl bg-foreground/[0.07]" />
      </MarketplaceShell>
    );
  }

  if (!session) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Iniciá sesión para finalizar tu pedido."
          action={<AmberButton onClick={() => navigate("/sign-in")}>Ingresar</AmberButton>}
        />
      </MarketplaceShell>
    );
  }

  if (cart.isError) {
    return (
      <MarketplaceShell>
        <ErrorState message="No pudimos cargar tu carrito." onRetry={() => void cart.refetch()} />
      </MarketplaceShell>
    );
  }

  const data = cart.data;
  if (!data || data.items.length === 0) {
    return (
      <MarketplaceShell>
        <EmptyState title="No hay nada para pagar." action={<AmberButton onClick={() => navigate("/")}>Volver al inicio</AmberButton>} />
      </MarketplaceShell>
    );
  }

  const deliveryEnabled = data.totals.deliveryFeeMinor >= 0;
  const effectiveFulfilment = deliveryEnabled ? fulfilment : "PICKUP";
  const canPlace = effectiveFulfilment === "PICKUP" || Boolean(addressId);

  const onPlace = () => {
    placeOrder.mutate(
      {
        fulfilment: effectiveFulfilment,
        addressId: effectiveFulfilment === "DELIVERY" ? addressId : undefined,
        paymentMethod,
        customerNotes: notes.trim() || undefined,
        promotionCode: data.promotionCode ?? undefined,
        clientRequestId,
      },
      {
        onSuccess: (order) => {
          toast({ title: "¡Pedido enviado!" });
          navigate(order?.id ? `/order/${order.id}` : "/orders");
        },
        onError: (error) => toast({ title: cartErrorMessage(error), variant: "destructive" }),
      },
    );
  };

  return (
    <MarketplaceShell>
      <h1 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-foreground">Finalizar pedido</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <fieldset className="rounded-xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">Entrega</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["DELIVERY", "PICKUP"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFulfilment(value)}
                  className={cn(
                    "min-h-12 rounded-md border px-4 text-left text-sm transition",
                    effectiveFulfilment === value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <span className="font-medium">{value === "DELIVERY" ? "A domicilio" : "Retiro en tienda"}</span>
                </button>
              ))}
            </div>

            {effectiveFulfilment === "DELIVERY" ? (
              <div className="mt-4">
                {addresses.data && addresses.data.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {addresses.data.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => setAddressId(address.id)}
                        className={cn(
                          "min-h-12 rounded-md border px-4 text-left text-sm transition",
                          addressId === address.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        <span className="font-medium">{address.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {address.line1}, {address.city}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Todavía no tenés direcciones guardadas.</p>
                )}

                {showAddressForm ? (
                  <AddressForm
                    saving={saveAddress.isPending}
                    onCancel={() => setShowAddressForm(false)}
                    onSave={(input) =>
                      saveAddress.mutate(input, {
                        onSuccess: () => {
                          setShowAddressForm(false);
                          toast({ title: "Dirección guardada" });
                        },
                        onError: () => toast({ title: "No pudimos guardar la dirección", variant: "destructive" }),
                      })
                    }
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddressForm(true)}
                    className="mt-3 text-sm font-semibold text-link hover:text-link/80"
                  >
                    + Agregar dirección
                  </button>
                )}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="rounded-xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">Forma de pago</legend>
            <div className="mt-2 flex flex-col gap-2">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-4 text-sm transition",
                    paymentMethod === method.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {method.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-xl border border-border bg-card p-4">
            <label className="text-sm font-semibold text-foreground" htmlFor="checkout-notes">
              Notas para la tienda
            </label>
            <textarea
              id="checkout-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Sin cebolla, timbre roto, etc."
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Resumen del pedido</h2>
          <ul className="mb-3 space-y-1.5 text-sm text-muted-foreground">
            {data.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {item.quantity}× {item.name}
                </span>
                <span className="shrink-0">{money(item.lineTotalMinor, data.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{money(data.totals.totalMinor, data.currency)}</span>
          </div>

          <AmberButton className="mt-4 w-full" disabled={!canPlace || placeOrder.isPending} onClick={onPlace}>
            {placeOrder.isPending ? "Enviando…" : "Confirmar pedido"}
          </AmberButton>
          {!canPlace ? (
            <p className="mt-2 text-xs text-link">Elegí una dirección para entrega a domicilio.</p>
          ) : null}
        </aside>
      </div>
    </MarketplaceShell>
  );
}

function AddressForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (input: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState("Casa");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Etiqueta (Casa, Oficina)"
        className="h-10 border-border bg-card text-sm placeholder:text-muted-foreground"
      />
      <Input
        value={line1}
        onChange={(event) => setLine1(event.target.value)}
        placeholder="Dirección"
        className="h-10 border-border bg-card text-sm placeholder:text-muted-foreground"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Ciudad"
          className="h-10 border-border bg-card text-sm placeholder:text-muted-foreground"
        />
        <Input
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          placeholder="Provincia"
          className="h-10 border-border bg-card text-sm placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex gap-2">
        <AmberButton
          disabled={saving || !line1.trim() || !city.trim() || !region.trim()}
          onClick={() =>
            onSave({
              label: label.trim() || "Casa",
              line1: line1.trim(),
              city: city.trim(),
              region: region.trim(),
            })
          }
        >
          {saving ? "Guardando…" : "Guardar dirección"}
        </AmberButton>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
