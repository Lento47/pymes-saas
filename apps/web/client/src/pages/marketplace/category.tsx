import { useMemo } from "react";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
  LoadingGrid,
} from "@/components/marketplace/cards";
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { useBrowserLocation } from "@/hooks/use-browser-location";
import { useBusinesses, useCategories } from "@/lib/marketplace";

export default function MarketplaceCategoryPage({ slug }: { slug: string }) {
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { coords } = useBrowserLocation();

  const category = useMemo(
    () => categories?.find((item) => item.slug === slug) ?? null,
    [categories, slug],
  );

  const { data, isLoading, isError, refetch } = useBusinesses({
    categoryId: category?.id,
    lat: coords?.lat,
    lng: coords?.lng,
    sort: coords ? "distance" : "popular",
    limit: 24,
  });

  const waitForCategory = loadingCategories && !category;

  return (
    <MarketplaceShell>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white">
        {category?.name ?? "Categoría"}
      </h1>
      <p className="mb-6 text-sm text-slate-400">Negocios disponibles en esta categoría.</p>

      {isError ? (
        <ErrorState message="No pudimos cargar los negocios." onRetry={() => void refetch()} />
      ) : waitForCategory || isLoading || !data ? (
        <LoadingGrid count={6} />
      ) : !category ? (
        <EmptyState title="No encontramos esa categoría." description="Puede que ya no esté disponible." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Todavía no hay negocios en esta categoría." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((business) => (
            <BusinessCardView key={business.id} card={business} />
          ))}
        </div>
      )}
    </MarketplaceShell>
  );
}
