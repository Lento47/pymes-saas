import { Link } from "wouter";

import { EmptyState, ErrorState, LoadingGrid } from "@/components/marketplace/cards";
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { useCategories } from "@/lib/marketplace";

export default function MarketplaceCategoriesPage() {
  const { data, isLoading, isError, refetch } = useCategories();

  return (
    <MarketplaceShell>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white">Categorías</h1>
      <p className="mb-6 text-sm text-slate-400">Elegí una categoría para ver los negocios disponibles.</p>

      {isError ? (
        <ErrorState message="No pudimos cargar las categorías." onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <LoadingGrid count={12} />
      ) : data.length === 0 ? (
        <EmptyState title="Todavía no hay categorías disponibles." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((category) => (
            <li key={category.id}>
              <Link
                href={`/category/${category.slug}`}
                className="flex min-h-[5.5rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-amber-500/40 hover:bg-white/[0.07]"
              >
                <span className="text-sm font-medium text-white">{category.name}</span>
                {category.productCount !== undefined ? (
                  <span className="text-xs text-slate-400">{category.productCount} productos</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MarketplaceShell>
  );
}
