import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

import { EmptyState, ErrorState, imageSrc, money } from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useApplyPromotion,
  useCart,
  useClearCart,
  useMarketplaceSession,
  useRemoveCartItem,
  useRemovePromotion,
  useUpdateCartItem,
} from "@/lib/marketplace";

export default function MarketplaceCartPage() {
  const { data: session, isLoading: loadingSession } = useMarketplaceSession();
  const cart = useCart(Boolean(session));
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const applyPromotion = useApplyPromotion();
  const removePromotion = useRemovePromotion();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");

  if (loadingSession) {
    return (
      <MarketplaceShell>
        <Skeleton className="h-40 w-full rounded-3xl bg-white/10" />
      </MarketplaceShell>
    );
  }

  if (!session) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Iniciá sesión para ver tu carrito."
          description="Tu carrito se guarda en tu cuenta."
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

  if (cart.isLoading || !cart.data) {
    return (
      <MarketplaceShell>
        <Skeleton className="h-40 w-full rounded-3xl bg-white/10" />
      </MarketplaceShell>
    );
  }

  const data = cart.data;

  if (data.items.length === 0) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Tu carrito está vacío."
          description="Explorá negocios y agregá productos para pedir."
          action={
            <Link href="/categories" className="text-sm font-semibold text-amber-400 hover:text-amber-300">
              Explorar categorías
            </Link>
          }
        />
      </MarketplaceShell>
    );
  }

  return (
    <MarketplaceShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Tu carrito</h1>
        {data.businessSlug ? (
          <Link href={`/store/${data.businessSlug}`} className="text-sm text-amber-400 hover:text-amber-300">
            {data.businessName}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ul className="flex flex-col gap-3">
          {data.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                {item.imageUrl ? (
                  <img src={imageSrc(item.imageUrl) ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-500">
                    <ShoppingBag aria-hidden="true" className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium text-white">{item.name}</p>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.name}`}
                    onClick={() => removeItem.mutate({ cartItemId: item.id })}
                    className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-red-300"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>

                {item.options.length > 0 ? (
                  <p className="text-xs text-slate-400">{item.options.map((option) => option.name).join(", ")}</p>
                ) : null}
                {item.notes ? <p className="text-xs text-slate-400">Nota: {item.notes}</p> : null}
                {item.unavailableReason ? (
                  <p className="text-xs text-red-300">{item.unavailableReason}</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <div className="inline-flex items-center rounded-lg border border-white/15">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar una unidad de ${item.name}`}
                      onClick={() => updateItem.mutate({ cartItemId: item.id, quantity: item.quantity - 1 })}
                      className="h-9 w-9 rounded-l-lg rounded-r-none text-white hover:bg-white/10"
                    >
                      <Minus aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold text-white">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Agregar una unidad de ${item.name}`}
                      onClick={() => updateItem.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })}
                      className="h-9 w-9 rounded-r-lg rounded-l-none text-white hover:bg-white/10"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {money(item.lineTotalMinor, data.currency)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Resumen</h2>

          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Código promocional"
              className="h-10 border-white/10 bg-white/5 text-sm text-white uppercase placeholder:text-slate-400 focus-visible:ring-amber-500"
            />
            <Button
              type="button"
              variant="outline"
              disabled={applyPromotion.isPending || code.trim().length === 0}
              onClick={() =>
                applyPromotion.mutate(
                  { code: code.trim() },
                  {
                    onSuccess: (updated) =>
                      toast({
                        title: updated.promotionError
                          ? "Ese código no se puede aplicar."
                          : "Código aplicado",
                      }),
                    onError: (error) => toast({ title: cartErrorMessage(error), variant: "destructive" }),
                  },
                )
              }
              className="border-white/15 text-white hover:bg-white/10"
            >
              Aplicar
            </Button>
          </div>

          {data.promotionCode ? (
            <div className="mt-2 flex items-center justify-between text-xs text-amber-300">
              <span>
                {data.promotionCode}
                {data.promotionError ? " (no aplicable)" : ""}
              </span>
              <button
                type="button"
                onClick={() => removePromotion.mutate()}
                className="text-slate-400 underline-offset-2 hover:text-white hover:underline"
              >
                Quitar
              </button>
            </div>
          ) : null}

          <dl className="mt-4 space-y-2 text-sm text-slate-300">
            <Row label="Subtotal" value={money(data.totals.subtotalMinor, data.currency)} />
            {data.totals.discountMinor > 0 ? (
              <Row label="Descuento" value={`-${money(data.totals.discountMinor, data.currency)}`} />
            ) : null}
            {data.totals.deliveryFeeMinor > 0 ? (
              <Row label="Envío" value={money(data.totals.deliveryFeeMinor, data.currency)} />
            ) : null}
            {data.totals.taxMinor > 0 ? (
              <Row label="Impuestos" value={money(data.totals.taxMinor, data.currency)} />
            ) : null}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <span>Total</span>
              <span>{money(data.totals.totalMinor, data.currency)}</span>
            </div>
          </dl>

          {data.totals.missingForMinOrderMinor > 0 ? (
            <p className="mt-3 text-xs text-amber-300">
              Te faltan {money(data.totals.missingForMinOrderMinor, data.currency)} para el pedido mínimo de esta
              tienda.
            </p>
          ) : null}

          <AmberButton
            className="mt-4 w-full"
            disabled={data.totals.missingForMinOrderMinor > 0}
            onClick={() => navigate("/checkout")}
          >
            Continuar al pago
          </AmberButton>

          <button
            type="button"
            onClick={() => clearCart.mutate()}
            disabled={clearCart.isPending}
            className="mt-3 w-full text-xs text-slate-400 underline-offset-2 transition hover:text-white hover:underline"
          >
            Vaciar carrito
          </button>
        </aside>
      </div>
    </MarketplaceShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
