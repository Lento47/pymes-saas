import { Minus, Plus, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

import {
  EmptyState,
  ErrorState,
  Rating,
  money,
  imageSrc,
} from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useAddToCart,
  useMarketplaceSession,
  useProduct,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";

export default function MarketplaceProductPage({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useProduct(id);
  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const groups = data?.optionGroups ?? [];

  const missingRequired = useMemo(
    () =>
      groups.some((group) => group.isRequired && (selected[group.id]?.length ?? 0) < Math.max(1, group.minSelect)),
    [groups, selected],
  );

  if (isError) {
    return (
      <MarketplaceShell>
        <ErrorState message="No pudimos cargar este producto." onRetry={() => void refetch()} />
      </MarketplaceShell>
    );
  }

  if (isLoading || !data) {
    return (
      <MarketplaceShell>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-xl bg-foreground/[0.07]" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-2/3 bg-foreground/[0.07]" />
            <Skeleton className="h-4 w-1/3 bg-foreground/[0.07]" />
            <Skeleton className="h-24 w-full bg-foreground/[0.07]" />
          </div>
        </div>
      </MarketplaceShell>
    );
  }

  const toggleOption = (groupId: string, optionId: string, multi: boolean) => {
    setSelected((current) => {
      const chosen = current[groupId] ?? [];
      if (multi) {
        return {
          ...current,
          [groupId]: chosen.includes(optionId)
            ? chosen.filter((value) => value !== optionId)
            : [...chosen, optionId],
        };
      }
      return { ...current, [groupId]: [optionId] };
    });
  };

  const onAdd = () => {
    if (!session) {
      navigate("/sign-in");
      return;
    }
    const optionIds = Object.values(selected).flat();
    addToCart.mutate(
      { productId: data.id, quantity, optionIds },
      {
        onSuccess: () => toast({ title: `${quantity}× ${data.title} agregado al carrito` }),
        onError: (error) => toast({ title: cartErrorMessage(error), variant: "destructive" }),
      },
    );
  };

  const soldOut = !data.availability.inStock;

  return (
    <MarketplaceShell>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative aspect-[4/3] w-full bg-elevated">
            {data.imageUrl ? (
              <img src={imageSrc(data.imageUrl) ?? ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-muted-foreground/50">
                {data.title.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">{data.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <Link href={`/store/${data.seller.slug}`} className="inline-flex items-center gap-1.5 text-link hover:text-link/80">
                <Store aria-hidden="true" className="h-4 w-4" />
                {data.seller.name}
              </Link>
              <Rating value={data.rating ?? 0} count={data.reviewCount} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {money(data.priceMinor, data.currency)}
            </span>
            {data.compareAtPriceMinor ? (
              <span className="text-sm text-muted-foreground line-through tabular-nums">
                {money(data.compareAtPriceMinor, data.currency)}
              </span>
            ) : null}
            {data.discountPercent ? (
              <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground">
                -{data.discountPercent}%
              </span>
            ) : null}
          </div>

          {data.description ? <p className="text-sm leading-6 text-muted-foreground">{data.description}</p> : null}

          {groups.map((group) => {
            const multi = group.kind === "MULTI";
            return (
              <fieldset key={group.id} className="rounded-xl border border-border bg-card p-4">
                <legend className="px-1 text-sm font-semibold text-foreground">
                  {group.name}
                  {group.isRequired ? <span className="ml-1 text-link">*</span> : null}
                </legend>
                <div className="mt-2 flex flex-col gap-1.5">
                  {group.options.map((option) => {
                    const checked = (selected[group.id] ?? []).includes(option.id);
                    const delta = option.priceDeltaMinor;
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 text-sm transition",
                          checked
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          !option.isAvailable && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type={multi ? "checkbox" : "radio"}
                            name={group.id}
                            checked={checked}
                            disabled={!option.isAvailable}
                            onChange={() => toggleOption(group.id, option.id, multi)}
                            className="h-4 w-4 accent-primary"
                          />
                          {option.name}
                        </span>
                        {delta !== 0 ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {delta > 0 ? "+" : ""}
                            {money(delta, data.currency)}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div className="flex items-center gap-4">
            <div className="inline-flex items-center rounded-md border border-border">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar una unidad"
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="h-11 w-11 rounded-l-md rounded-r-none text-foreground hover:bg-bg-hover"
              >
                <Minus aria-hidden="true" className="h-4 w-4" />
              </Button>
              <span aria-live="polite" className="w-10 text-center text-sm font-semibold tabular-nums text-foreground">
                {quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Agregar una unidad"
                disabled={quantity >= data.availability.maxOrderQuantity}
                onClick={() => setQuantity((value) => value + 1)}
                className="h-11 w-11 rounded-r-md rounded-l-none text-foreground hover:bg-bg-hover"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <AmberButton
              onClick={onAdd}
              disabled={soldOut || addToCart.isPending || missingRequired}
              className="flex-1"
            >
              {soldOut
                ? "Agotado"
                : missingRequired
                  ? "Elegí las opciones obligatorias"
                  : `Agregar · ${money(data.priceMinor * quantity, data.currency)}`}
            </AmberButton>
          </div>
        </div>
      </div>

      {data.related.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold tracking-[-0.01em] text-foreground">
            Más de {data.seller.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.related.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="rounded-lg border border-border bg-card p-3 text-sm text-foreground transition hover:border-primary/50"
              >
                {product.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data.tags.length === 0 && groups.length === 0 && !data.description ? (
        <div className="mt-8">
          <EmptyState title="Este producto todavía no tiene más detalles." />
        </div>
      ) : null}
    </MarketplaceShell>
  );
}
