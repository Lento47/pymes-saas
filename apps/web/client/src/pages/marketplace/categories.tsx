import type { Category } from "@pymeshub/shared";
import { useMemo, useState } from "react";
import { Link } from "wouter";

import { EmptyState, ErrorState, LoadMore, LoadingGrid } from "@/components/marketplace/cards";
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { useCategories } from "@/lib/marketplace";

/** How many sectors are revealed at a time. */
const GROUPS_PER_PAGE = 6;

/**
 * The taxonomy index.
 *
 * `catalog.categories` answers with the whole active taxonomy in one read — 248 rows on the
 * current data, 22 sectors and their 226 children — and this page drew every one of them at
 * once. It is paged now, but deliberately not by tiles.
 *
 * The rows arrive in an order that puts a sector immediately before the categories it holds
 * (`sortOrder` numbers a sector 100 and its children 101, 102 …, and the seeded demo
 * categories follow the same shape). The service says in as many words that this ordering
 * exists so a client can render a two-level taxonomy out of a flat list. Cutting the list at
 * a fixed tile count would split a sector across a page boundary and leave its children
 * sitting under the previous heading, which is the one thing that ordering is there to
 * prevent — so the page steps by whole sectors instead, and a sector brings its children
 * along whether or not they fit the count.
 *
 * The grid itself is unchanged, flat tiles in the same places; the grouping only decides
 * where a page ends.
 */
export default function MarketplaceCategoriesPage() {
  const { data, isLoading, isError, refetch } = useCategories();
  const [shownGroups, setShownGroups] = useState(GROUPS_PER_PAGE);

  const groups = useMemo(() => {
    const items = data ?? [];
    const byId = new Map(items.map((category) => [category.id, category]));
    const grouped: { root: Category; items: Category[] }[] = [];
    const position = new Map<string, number>();

    for (const category of items) {
      const parent = category.parentId ? byId.get(category.parentId) : undefined;

      if (parent) {
        const at = position.get(parent.id);
        if (at !== undefined) {
          grouped[at].items.push(category);
          continue;
        }
        // A child that arrives before its own sector — the ordering is supposed to prevent
        // that, but a row reordered by hand can produce it, and a parent that is inactive
        // while its child is not drops out of this read entirely. Emitting the sector here
        // keeps the child under it rather than filing it under whatever came last.
        position.set(parent.id, grouped.length);
        grouped.push({ root: parent, items: [category] });
        continue;
      }

      position.set(category.id, grouped.length);
      grouped.push({ root: category, items: [] });
    }

    return grouped;
  }, [data]);

  const visible = groups.slice(0, shownGroups).flatMap((group) => [group.root, ...group.items]);

  return (
    <MarketplaceShell>
      <h1 className="mb-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">Categorías</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Elegí una categoría para ver los negocios disponibles.
      </p>

      {isError ? (
        <ErrorState message="No pudimos cargar las categorías." onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <LoadingGrid count={12} />
      ) : data.length === 0 ? (
        <EmptyState title="Todavía no hay categorías disponibles." />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
                >
                  <span className="text-sm font-medium text-foreground">{category.name}</span>
                  {category.productCount !== undefined ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {category.productCount} productos
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <LoadMore
            hasNextPage={shownGroups < groups.length}
            isLoadingMore={false}
            pages={shownGroups}
            onLoadMore={() => setShownGroups((current) => current + GROUPS_PER_PAGE)}
            total={data.length}
            label="Mostrar más sectores"
            singular="categoría"
            plural="categorías"
          />
        </>
      )}
    </MarketplaceShell>
  );
}
