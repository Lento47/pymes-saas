import { Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
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
  useSearch,
} from "@/lib/marketplace";

function initialQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

export default function MarketplaceSearchPage() {
  const [term, setTerm] = useState(initialQuery);
  const [debounced, setDebounced] = useState(term);
  const { coords } = useBrowserLocation();
  const { data, isLoading, isError, refetch } = useSearch(debounced, coords);
  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();

  // One debounce for the whole page: the input stays responsive while the query waits for
  // the customer to stop typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  return (
    <MarketplaceShell>
      <label className="relative block">
        <span className="sr-only">Buscar productos, negocios o categorías</span>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar productos, negocios o categorías"
          className="h-12 border-white/10 bg-white/5 pl-9 text-base text-white placeholder:text-slate-400 focus-visible:ring-amber-500"
        />
      </label>

      {debounced.trim().length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">Escribí algo para empezar a buscar.</p>
      ) : isError ? (
        <div className="mt-6">
          <ErrorState message="No pudimos completar la búsqueda." onRetry={() => void refetch()} />
        </div>
      ) : isLoading || !data ? (
        <div className="mt-6">
          <LoadingGrid count={6} />
        </div>
      ) : data.products.length === 0 && data.businesses.length === 0 && data.categories.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={`Sin resultados para “${debounced.trim()}”`}
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
                    className="min-h-9 rounded-full border border-white/10 bg-white/5 px-4 text-sm leading-9 text-slate-200 transition hover:border-amber-500/40 hover:text-white"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}

          {data.products.length > 0 ? (
            <Section title="Productos">
              <ProductGrid>
                {data.products.map((product) => (
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
            </Section>
          ) : null}
        </>
      )}
    </MarketplaceShell>
  );
}
