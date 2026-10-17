import { Bike, Clock, MapPin, Star, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import {
  EmptyState,
  ErrorState,
  imageSrc,
  MarketplaceImage,
  LoadingGrid,
  LoadMore,
  money,
  ProductCardView,
  ProductGrid,
} from "@/components/marketplace/cards";
import {
  BackLink,
  MarketplaceShell,
} from "@/components/marketplace/public-shell";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useAddToCart,
  useMarketplaceSession,
  useProductListInfinite,
  useStorefront,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/marketplace/favorite-button";

export default function MarketplaceStorePage({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useStorefront(slug);
  const businessId = data?.card.id;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  /**
   * The chip filter is a server query, not a `.filter()` over the loaded pages.
   *
   * It cannot be local: `ProductCard` carries no `categoryId` — `productDetailSchema` adds
   * it, and the card is defined as the detail page minus what only a detail page needs. And
   * it should not be, even if it could. The grid is paged now, so a filter applied in the
   * browser would answer from whichever pages happened to have loaded and would call a
   * category empty while its products were still unfetched. Sending `categoryId` also
   * resets the cursor, which is the part that matters: the second page of "everything" is
   * not the second page of "sodas".
   *
   * `products.list` narrows through `inCategory`, which matches a product filed under any
   * child of the id it is given, so a sector chip returns its whole subtree rather than
   * nothing.
   *
   * `enabled` because `businessId` is undefined until the storefront read resolves, and an
   * unpinned `products.list` is not an empty list — it is every ACTIVE product on the
   * marketplace.
   */
  const {
    data: products,
    isFetching: productsFetching,
    isError: productsFailed,
    refetch: refetchProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useProductListInfinite(
    // 24 rather than the 50 the API caps at: the cap was only ever doing duty as a page
    // size, and a first page that paints sooner is worth more than a longer one.
    {
      businessId,
      categoryId: activeCategory ?? undefined,
      limit: 24,
      status: ["ACTIVE"],
    },
    { enabled: Boolean(businessId) },
  );
  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // wouter re-renders this page for a new slug rather than remounting it, so a chip picked
  // in one shop would still be set on the next one — where that category id matches nothing,
  // which reads as an empty catalogue. The reset lands during the storefront read that a
  // new slug always starts, so the stale filter never paints.
  useEffect(() => {
    setActiveCategory(null);
  }, [slug]);

  const requireSession = (action: () => void) => {
    if (session) action();
    else navigate("/sign-in");
  };

  if (isError) {
    return (
      <MarketplaceShell>
        <ErrorState
          message="No pudimos cargar esta tienda."
          onRetry={() => void refetch()}
        />
      </MarketplaceShell>
    );
  }

  if (isLoading) {
    return (
      <MarketplaceShell>
        <LoadingGrid count={6} />
      </MarketplaceShell>
    );
  }

  if (!data) {
    return (
      <MarketplaceShell>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Tienda no disponible
        </h1>
        <EmptyState
          title="No encontramos esta tienda."
          description="Puede que ya no esté disponible. Conocé otros negocios del marketplace."
          action={
            <Link href="/categories" className="market-section-link">
              Explorar categorías
            </Link>
          }
        />
      </MarketplaceShell>
    );
  }

  const { card } = data;
  const cover = imageSrc(card.coverUrl);
  const logo = imageSrc(card.logoUrl);
  const visible = products?.pages.flatMap((page) => page.items) ?? [];
  // Only ever true on the first read: `keepPreviousData` in the hook keeps the previous
  // rows up while a chip change resolves, so the grid does not blink out on every tap.
  const productsPending = productsFetching && products === undefined;

  return (
    <MarketplaceShell>
      <div className="mb-4">
        <BackLink href="/">Volver al inicio</BackLink>
      </div>
      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative h-40 w-full bg-elevated sm:h-56">
          <MarketplaceImage
            src={cover}
            width={1200}
            height={400}
            className="h-full w-full object-cover"
            fallback={<Store className="h-10 w-10" strokeWidth={1.25} />}
          />
          <FavoriteButton
            businessId={card.id}
            name={card.name}
            className="absolute right-4 top-4"
          />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            {logo ? (
              <MarketplaceImage
                src={logo}
                width={80}
                height={80}
                className="h-16 w-16 shrink-0 rounded-2xl border border-border bg-background object-cover sm:h-20 sm:w-20"
                fallback={<Store className="h-6 w-6" />}
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                {card.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {card.categoryName ? <span>{card.categoryName}</span> : null}
                {card.ratingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Star
                      aria-hidden="true"
                      className="h-3.5 w-3.5 fill-primary text-primary"
                    />
                    {card.ratingAvg.toFixed(1)} ({card.ratingCount})
                  </span>
                ) : null}
                <span
                  className={cn(
                    card.isOpen ? "text-success" : "text-destructive",
                  )}
                >
                  {card.isOpen ? "Abierto" : "Cerrado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Bike aria-hidden="true" className="h-3.5 w-3.5" />
              {card.deliveryEnabled
                ? card.merchantCoversDelivery
                  ? "El comercio cubre el envío"
                  : card.deliveryPriceAtCheckout
                    ? "Envío calculado al pagar"
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
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-6">
            {card.description}
          </p>
        ) : null}
      </section>

      {data.categories.length > 0 ? (
        <div
          role="group"
          aria-label="Filtrar por categoría"
          className="market-rail -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-3 pt-1 sm:mx-0 sm:px-0"
        >
          <button
            type="button"
            aria-pressed={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            className={cn(
              "min-h-12 shrink-0 rounded-xl border px-4 text-sm transition-colors",
              activeCategory === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            Todo el menú
          </button>
          {data.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "min-h-12 shrink-0 rounded-xl border px-4 text-sm transition-colors",
                activeCategory === category.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {productsPending ? (
          <LoadingGrid count={6} />
        ) : productsFailed ? (
          // Without this branch a failed read falls through to "no publicó productos",
          // which is a claim about the shop and not about the request that failed.
          <ErrorState
            message="No pudimos cargar los productos de esta tienda."
            onRetry={() => void refetchProducts()}
          />
        ) : visible.length > 0 ? (
          <div
            aria-busy={productsFetching}
            className={cn(
              "transition-opacity",
              productsFetching && "opacity-60",
            )}
          >
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
                            toast({
                              title: cartErrorMessage(error),
                              variant: "destructive",
                            }),
                        },
                      );
                    })
                  }
                />
              ))}
            </ProductGrid>
          </div>
        ) : activeCategory ? (
          // Reachable only in a race — the chips come from the products this shop has, so a
          // category arrives non-empty and can empty out between that read and this one.
          // "Este negocio no publicó productos" would be the wrong sentence for it.
          <EmptyState
            title="Esta categoría no tiene productos disponibles."
            description="Probá con otra categoría o mirá todo el menú."
            action={
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="text-sm font-semibold text-link hover:text-link/80"
              >
                Ver todo el menú
              </button>
            }
          />
        ) : (
          <EmptyState
            title="Este negocio todavía no publicó productos."
            description="Volvé más tarde o explorá otras tiendas."
            action={
              <Link
                href="/categories"
                className="text-sm font-semibold text-link hover:text-link/80"
              >
                Explorar categorías
              </Link>
            }
          />
        )}

        <LoadMore
          hasNextPage={hasNextPage}
          isLoadingMore={isFetchingNextPage}
          blocked={isPlaceholderData}
          pages={products?.pages.length ?? 0}
          onLoadMore={() => void fetchNextPage()}
          total={visible.length}
          label="Cargar más productos"
          singular="producto"
          plural="productos"
        />
      </div>
    </MarketplaceShell>
  );
}
