import { useMemo } from "react";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
  LoadMore,
  LoadingGrid,
} from "@/components/marketplace/cards";
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { useBrowserLocation } from "@/hooks/use-browser-location";
import { useBusinessesInfinite, useCategories } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

/**
 * One sector, and every shop in it.
 *
 * The list is paged, which it was not before: this read asked for 24 businesses and threw
 * away the `nextCursor` the API had already computed, so a category with more than 24 shops
 * silently stopped at 24 and nothing on the page said a shop was missing. The cursor was
 * only ever being discarded here — the API side needed no change.
 *
 * The guards are ordered deliberately. `!category` is answered before the loading state,
 * because the query is `enabled` only once the taxonomy has supplied an id: a slug that
 * matches nothing leaves the query disabled rather than resolving, so a page that reached
 * for `!data` first would show a spinner forever on a category that does not exist.
 */
export default function MarketplaceCategoryPage({ slug }: { slug: string }) {
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { coords } = useBrowserLocation();

  const category = useMemo(
    () => categories?.find((item) => item.slug === slug) ?? null,
    [categories, slug],
  );

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useBusinessesInfinite(
    {
      categoryId: category?.id,
      lat: coords?.lat,
      lng: coords?.lng,
      sort: coords ? "distance" : "popular",
      limit: 24,
    },
    // Undefined until the taxonomy read resolves, and an unpinned `businesses.list` is every
    // shop on the marketplace drawn under this category's name.
    { enabled: Boolean(category?.id) },
  );

  const visible = data?.pages.flatMap((page) => page.items) ?? [];
  const waitForCategory = loadingCategories && !category;

  return (
    <MarketplaceShell>
      <h1 className="mb-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        {category?.name ?? "Categoría"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Negocios disponibles en esta categoría.</p>

      {isError ? (
        <ErrorState message="No pudimos cargar los negocios." onRetry={() => void refetch()} />
      ) : waitForCategory ? (
        <LoadingGrid count={6} />
      ) : !category ? (
        <EmptyState
          title="No encontramos esa categoría."
          description="Puede que ya no esté disponible."
        />
      ) : isLoading || !data ? (
        <LoadingGrid count={6} />
      ) : visible.length === 0 ? (
        <EmptyState title="Todavía no hay negocios en esta categoría." />
      ) : (
        <>
          <div
            aria-busy={isFetching}
            className={cn("transition-opacity", isFetching && "opacity-60")}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((business) => (
                <BusinessCardView key={business.id} card={business} />
              ))}
            </div>
          </div>

          <LoadMore
            hasNextPage={hasNextPage}
            isLoadingMore={isFetchingNextPage}
            blocked={isPlaceholderData}
            pages={data.pages.length}
            onLoadMore={() => void fetchNextPage()}
            total={visible.length}
            singular="negocio"
            plural="negocios"
          />
        </>
      )}
    </MarketplaceShell>
  );
}
