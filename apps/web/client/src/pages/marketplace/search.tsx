import { Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
  LoadMore,
  LoadingGrid,
  ProductCardView,
  ProductGrid,
  Section,
} from "@/components/marketplace/cards";
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { Input } from "@/components/ui/input";
import { useBrowserLocation } from "@/hooks/use-browser-location";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useAddToCart,
  useMarketplaceSession,
  useProductListInfinite,
  useSearch,
} from "@/lib/marketplace";

function initialQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

/**
 * One search box, three answers — and only the products are paged.
 *
 * `catalog.search` answers all three sections behind a fixed ceiling: 20 products, 10
 * businesses, 10 categories, with no cursor on any of them. For businesses and categories
 * that ceiling is reasonable — a term rarely matches ten shops in one market, and a taxonomy
 * is bounded by definition — so those two sections are still read from it.
 *
 * The Products section does not stay as it is, because it was the one that truncated in
 * practice: a search for a short string matched most of the platform and showed 20 of it,
 * with nothing on the page to say there was more. It now pages through `products.list`,
 * which returns the same rows in the same order — the search service sorts by `soldCount`
 * descending, `sortColumnOf("popular")` is `soldCount`, and the full ordering was checked
 * against the un-paged response before this replaced it. It is also the stricter of the two:
 * the search ordering carries no tiebreak, while this one adds `id`, so a page boundary is
 * total and no row is served twice or skipped between two requests.
 *
 * That is two queries where there was one, but not two round trips: both fire in the same
 * tick and the tRPC `httpBatchLink` puts a batch into a single HTTP request.
 */
export default function MarketplaceSearchPage() {
  const [term, setTerm] = useState(initialQuery);
  const [debounced, setDebounced] = useState(term);
  const { coords } = useBrowserLocation();
  const trimmed = debounced.trim();

  const { data, isLoading, isError, refetch } = useSearch(debounced, coords);

  const {
    data: productPages,
    isFetching: productsFetching,
    isError: productsFailed,
    refetch: refetchProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useProductListInfinite(
    { search: trimmed, sort: "popular", status: ["ACTIVE"], limit: 24 },
    { enabled: trimmed.length > 0 },
  );

  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();

  // One debounce for the whole page: the input stays responsive while the queries wait for
  // the customer to stop typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const products = productPages?.pages.flatMap((page) => page.items) ?? [];
  const productsPending = productsFetching && productPages === undefined;

  // Nothing anywhere. Held back while the products are still arriving, or a slow second
  // query would flash "sin resultados" over a search that does have results.
  const noResults =
    !productsPending &&
    !productsFailed &&
    products.length === 0 &&
    (data?.businesses.length ?? 0) === 0 &&
    (data?.categories.length ?? 0) === 0;

  return (
    <MarketplaceShell>
      <label className="relative block">
        <span className="sr-only">Buscar productos, negocios o categorías</span>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar productos, negocios o categorías"
          className="h-12 border-border bg-card pl-9 text-base placeholder:text-muted-foreground focus-visible:ring-primary"
        />
      </label>

      {trimmed.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Escribí algo para empezar a buscar.</p>
      ) : isError ? (
        <div className="mt-6">
          <ErrorState message="No pudimos completar la búsqueda." onRetry={() => void refetch()} />
        </div>
      ) : isLoading || !data ? (
        <div className="mt-6">
          <LoadingGrid count={6} />
        </div>
      ) : noResults ? (
        <div className="mt-6">
          <EmptyState
            title={`Sin resultados para “${trimmed}”`}
            description="Probá con otra palabra o explorá por categorías."
          />
        </div>
      ) : (
        <>
          {data.businesses.length > 0 ? (
            <Section title="Negocios">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.businesses.map((business) => (
                  <BusinessCardView key={business.id} card={business} />
                ))}
              </div>
            </Section>
          ) : null}

          {data.categories.length > 0 ? (
            <Section title="Categorías">
              <div className="flex flex-wrap gap-2">
                {data.categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="min-h-9 rounded-md border border-border bg-card px-4 text-sm leading-9 text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Productos">
            {productsPending ? (
              <LoadingGrid count={4} />
            ) : productsFailed ? (
              <ErrorState
                message="No pudimos cargar los productos de esta búsqueda."
                onRetry={() => void refetchProducts()}
              />
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin productos para esta búsqueda.</p>
            ) : (
              <>
                <div
                  aria-busy={productsFetching}
                  className={
                    productsFetching ? "opacity-60 transition-opacity" : "transition-opacity"
                  }
                >
                  <ProductGrid>
                    {products.map((product) => (
                      <ProductCardView
                        key={product.id}
                        product={product}
                        adding={addToCart.isPending}
                        onAdd={(item) =>
                          session
                            ? addToCart.mutate(
                                { productId: item.id },
                                {
                                  onError: (error) =>
                                    toast({ title: cartErrorMessage(error), variant: "destructive" }),
                                },
                              )
                            : (window.location.href = "/sign-in")
                        }
                      />
                    ))}
                  </ProductGrid>
                </div>

                <LoadMore
                  hasNextPage={hasNextPage}
                  isLoadingMore={isFetchingNextPage}
                  blocked={isPlaceholderData}
                  pages={productPages?.pages.length ?? 0}
                  onLoadMore={() => void fetchNextPage()}
                  total={products.length}
                  label="Cargar más productos"
                  singular="producto"
                  plural="productos"
                />
              </>
            )}
          </Section>
        </>
      )}
    </MarketplaceShell>
  );
}
