import { Bike, Clock, MapPin, Star, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

import {
  EmptyState,
  ErrorState,
  LoadingGrid,
  ProductCardView,
  ProductGrid,
  imageSrc,
  money,
} from "@/components/marketplace/cards";
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useAddToCart,
  useMarketplaceSession,
  useProductList,
  useStorefront,
} from "@/lib/marketplace";

export default function MarketplaceStorePage({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useStorefront(slug);
  const businessId = data?.card.id;
  const { data: products } = useProductList({ businessId, limit: 50, status: ["ACTIVE"] });
  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const visible = useMemo(() => {
    const items = products?.items ?? [];
    return activeCategory ? items.filter((item) => item.seller && item.id) : items;
  }, [products?.items, activeCategory]);

  const requireSession = (action: () => void) => {
    if (session) action();
    else navigate("/sign-in");
  };

  if (isError) {
    return (
      <MarketplaceShell>
        <ErrorState message="No pudimos cargar esta tienda." onRetry={() => void refetch()} />
      </MarketplaceShell>
    );
  }

  if (isLoading || !data) {
    return (
      <MarketplaceShell>
        <LoadingGrid count={6} />
      </MarketplaceShell>
    );
  }

  const { card } = data;
  const cover = imageSrc(card.coverUrl);
  const logo = imageSrc(card.logoUrl);

  return (
    <MarketplaceShell>
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="relative h-40 w-full bg-amber-500/10 sm:h-56">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Store aria-hidden="true" className="h-10 w-10 text-amber-500/50" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="flex items-end gap-4">
            {logo ? (
              <img
                src={logo}
                alt=""
                className="-mt-10 h-16 w-16 rounded-2xl border-2 border-[#05091d] bg-[#05091d] object-cover sm:-mt-14 sm:h-20 sm:w-20"
              />
            ) : null}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">{card.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                {card.categoryName ? <span>{card.categoryName}</span> : null}
                {card.ratingCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {card.ratingAvg.toFixed(1)} ({card.ratingCount})
                  </span>
                ) : null}
                <span className={cn(card.isOpen ? "text-emerald-400" : "text-red-400")}>
                  {card.isOpen ? "Abierto" : "Cerrado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Bike aria-hidden="true" className="h-3.5 w-3.5" />
              {card.deliveryEnabled
                ? card.deliveryFeeMinor === 0
                  ? "Envío gratis"
                  : `Envío ${money(card.deliveryFeeMinor, card.currency)}`
                : "Sin entrega"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {card.prepTimeMinutes} min
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
              {card.city}
            </span>
          </div>
        </div>
        {card.description ? (
          <p className="border-t border-white/10 px-4 py-3 text-sm text-slate-300 sm:px-6">{card.description}</p>
        ) : null}
      </section>

      {data.categories.length > 0 ? (
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-sm transition",
              activeCategory === null
                ? "border-amber-500 bg-amber-500 text-[#05091d]"
                : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-500/40",
            )}
          >
            Todo el menú
          </button>
          {data.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-4 text-sm transition",
                activeCategory === category.id
                  ? "border-amber-500 bg-amber-500 text-[#05091d]"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-500/40",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {visible.length > 0 ? (
          <ProductGrid>
            {visible.map((product) => (
              <ProductCardView
                key={product.id}
                product={product}
                adding={addToCart.isPending}
                onAdd={(item) =>
                  requireSession(() => {
                    addToCart.mutate(
                      { productId: item.id, onBusinessConflict: "replace" },
                      {
                        onError: (error) =>
                          toast({ title: cartErrorMessage(error), variant: "destructive" }),
                      },
                    );
                  })
                }
              />
            ))}
          </ProductGrid>
        ) : (
          <EmptyState
            title="Este negocio todavía no publicó productos."
            description="Volvé más tarde o explorá otras tiendas."
            action={
              <Link href="/categories" className="text-sm font-semibold text-amber-400 hover:text-amber-300">
                Explorar categorías
              </Link>
            }
          />
        )}
      </div>
    </MarketplaceShell>
  );
}
