import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

import {
  EmptyState,
  ErrorState,
  MarketplaceImage,
  money,
} from "@/components/marketplace/cards";
import {
  AmberButton,
  BackLink,
  MarketplaceShell,
} from "@/components/marketplace/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ConfirmAction } from "@/components/marketplace/confirm-action";
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
        <Skeleton className="h-40 w-full rounded-xl bg-foreground/[0.07]" />
      </MarketplaceShell>
    );
  }

  if (!session) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Iniciá sesión para ver tu carrito."
          description="Tu carrito se guarda en tu cuenta."
          action={
            <AmberButton onClick={() => navigate("/sign-in")}>
              Ingresar
            </AmberButton>
          }
        />
      </MarketplaceShell>
    );
  }

  if (cart.isError) {
    return (
      <MarketplaceShell>
        <ErrorState
          message="No pudimos cargar tu carrito."
          onRetry={() => void cart.refetch()}
        />
      </MarketplaceShell>
    );
  }

  if (cart.isLoading || !cart.data) {
    return (
      <MarketplaceShell>
        <Skeleton className="h-40 w-full rounded-xl bg-foreground/[0.07]" />
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
            <Link
              href="/categories"
              className="text-sm font-semibold text-link hover:text-link/80"
            >
              Explorar categorías
            </Link>
          }
        />
      </MarketplaceShell>
    );
  }

  return (
    <MarketplaceShell>
      <div className="mb-3">
        <BackLink
          href={
            data.businessSlug ? `/store/${data.businessSlug}` : "/categories"
          }
        >
          Seguir comprando
        </BackLink>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Tu carrito
        </h1>
        {data.businessSlug ? (
          <Link
            href={`/store/${data.businessSlug}`}
            className="text-sm text-link hover:text-link/80"
          >
            {data.businessName}
          </Link>
        ) : null}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="flex min-w-0 flex-col gap-4">
          {data.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-2xl border border-border bg-card p-3 sm:gap-4 sm:p-5"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-elevated sm:h-24 sm:w-24">
                <MarketplaceImage
                  src={item.imageUrl}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.name}`}
                    disabled={removeItem.isPending || updateItem.isPending}
                    onClick={() => removeItem.mutate({ cartItemId: item.id })}
                    className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-bg-hover hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>

                {item.options.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {item.options.map((option) => option.name).join(", ")}
                  </p>
                ) : null}
                {item.notes ? (
                  <p className="text-xs text-muted-foreground">
                    Nota: {item.notes}
                  </p>
                ) : null}
                {item.unavailableReason ? (
                  <p className="text-xs text-destructive">
                    {item.unavailableReason}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
                  <div className="inline-flex items-center rounded-md border border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar una unidad de ${item.name}`}
                      disabled={updateItem.isPending || removeItem.isPending}
                      onClick={() =>
                        updateItem.mutate({
                          cartItemId: item.id,
                          quantity: item.quantity - 1,
                        })
                      }
                      className="h-11 w-11 rounded-l-lg rounded-r-none text-foreground hover:bg-bg-hover"
                    >
                      <Minus aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <span
                      aria-live="polite"
                      className="w-8 text-center text-sm font-semibold tabular-nums text-foreground"
                    >
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Agregar una unidad de ${item.name}`}
                      disabled={updateItem.isPending || removeItem.isPending}
                      onClick={() =>
                        updateItem.mutate({
                          cartItemId: item.id,
                          quantity: item.quantity + 1,
                        })
                      }
                      className="h-11 w-11 rounded-r-lg rounded-l-none text-foreground hover:bg-bg-hover"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {money(item.lineTotalMinor, data.currency)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-40">
          <h2 className="mb-5 text-lg font-semibold tracking-tight text-foreground">
            Resumen
          </h2>

          <label
            htmlFor="promotion-code"
            className="mb-2 block text-sm text-muted-foreground"
          >
            Código promocional
          </label>
          <div className="flex gap-2">
            <Input
              value={code}
              id="promotion-code"
              name="promotionCode"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Ingresá tu código"
              className="h-12 min-w-0 border-border bg-background text-sm uppercase placeholder:text-muted-foreground focus-visible:ring-primary"
            />
            <Button
              type="button"
              variant="secondary"
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
                    onError: (error) =>
                      toast({
                        title: cartErrorMessage(error),
                        variant: "destructive",
                      }),
                  },
                )
              }
              className="min-h-12 shrink-0 rounded-xl border-border text-foreground hover:bg-bg-hover"
            >
              Aplicar
            </Button>
          </div>

          {data.promotionCode ? (
            <div className="mt-2 flex items-center justify-between text-xs text-link">
              <span>
                {data.promotionCode}
                {data.promotionError ? " (no aplicable)" : ""}
              </span>
              <button
                type="button"
                onClick={() => removePromotion.mutate()}
                className="min-h-11 px-2 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Quitar
              </button>
            </div>
          ) : null}

          <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
            <Row
              label="Subtotal"
              value={money(data.totals.subtotalMinor, data.currency)}
            />
            {data.totals.discountMinor > 0 ? (
              <Row
                label="Descuento"
                value={`-${money(data.totals.discountMinor, data.currency)}`}
              />
            ) : null}
            {data.totals.deliveryFeeMinor > 0 ? (
              <Row
                label="Envío"
                value={money(data.totals.deliveryFeeMinor, data.currency)}
              />
            ) : null}
            {data.totals.taxMinor > 0 ? (
              <Row
                label="Impuestos"
                value={money(data.totals.taxMinor, data.currency)}
              />
            ) : null}
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{money(data.totals.totalMinor, data.currency)}</span>
            </div>
          </dl>

          {data.totals.missingForMinOrderMinor > 0 ? (
            <p className="mt-3 text-xs text-link">
              Te faltan{" "}
              {money(data.totals.missingForMinOrderMinor, data.currency)} para
              el pedido mínimo de esta tienda.
            </p>
          ) : null}

          <AmberButton
            className="mt-4 w-full"
            disabled={data.totals.missingForMinOrderMinor > 0}
            onClick={() => navigate("/checkout")}
          >
            Continuar al pago
          </AmberButton>

          <ConfirmAction
            key={data.id}
            title="¿Vaciar tu carrito?"
            description="Se quitarán todos los productos de este carrito. Podés seguir comprando para conservarlos."
            confirmLabel="Vaciar carrito"
            cancelLabel="Seguir comprando"
            errorMessage="No pudimos vaciar el carrito. Intentá de nuevo."
            onConfirm={() => clearCart.mutateAsync()}
          >
            <button
              type="button"
              disabled={clearCart.isPending}
              className="mt-3 min-h-11 w-full rounded-xl text-sm text-muted-foreground underline-offset-2 transition-colors hover:bg-bg-hover hover:text-foreground hover:underline"
            >
              Vaciar carrito
            </button>
          </ConfirmAction>
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
