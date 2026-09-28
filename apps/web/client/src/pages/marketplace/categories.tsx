import type { Category } from "@pymeshub/shared";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

import { EmptyState, ErrorState, LoadMore, LoadingGrid, Section } from "@/components/marketplace/cards";
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
 * The page draws one band per sector with the categories it holds nested under it, because
 * that is the shape the rows already arrive in and the one thing a flat grid of 248 tiles
 * could not say: which of them are siblings, and which hold the others. Tiles of one weight
 * in one grid made a sector look like a peer of the twelve categories inside it, and the
 * reader had to reconstruct the tree from the order the server happened to return.
 *
 * A count is drawn only above zero. `catalog.categories` counts a category's own *buyable*
 * products, and the taxonomy is mostly a list of what a business may sell rather than a
 * measurement of what is in stock — of the 226 children on the current data 224 count zero,
 * so a number on every tile would be a column of zeroes and a reader would stop reading it.
 *
 * A **root's** own count is drawn only when the band has no children under it. The
 * taxonomy's three such rows — `cafe`, `panaderia`, `frutas-y-verduras` — are seeded flat
 * categories with eight products each, and the number is the whole of what the heading
 * holds. On a sector that does have children the same number counts only the products filed
 * on the sector itself, so beside twelve child tiles it would read as the band's total,
 * which it is not.
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

  const visibleGroups = groups.slice(0, shownGroups);

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
          {visibleGroups.map((group) => (
            <Section
              key={group.root.id}
              title={group.root.name}
              // The sector is browseable on its own — `/category/:slug` reads a sector as
              // everything inside it — but it is not the destination this page is for, so
              // it is the band's action rather than a tile competing with its children.
              action={
                <div className="flex shrink-0 items-center gap-2.5">
                  {group.items.length === 0 && group.root.productCount ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {group.root.productCount} productos
                    </span>
                  ) : null}
                  <Link
                    href={`/category/${group.root.slug}`}
                    // Twenty-two links reading "Ver todo" are twenty-two identical stops for a
                    // screen reader, so each one says what it opens. The visible text stays
                    // short because the heading directly beside it already names the sector.
                    aria-label={`Ver todo en ${group.root.name}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-link transition hover:underline"
                  >
                    Ver todo
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </div>
              }
            >
              {/* No children is a flat top-level category, not an empty sector: the band is
                  the heading and its own `Ver todo`, which is where its products are. */}
              {group.items.length === 0 ? null : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.items.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/category/${child.slug}`}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition hover:border-primary/50"
                      >
                        <span className="truncate text-sm text-foreground">{child.name}</span>
                        {child.productCount ? (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {child.productCount}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ))}

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
