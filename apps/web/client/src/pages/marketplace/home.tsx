import { ArrowRight, MapPin, UtensilsCrossed } from "lucide-react";
import { Link, useLocation } from "wouter";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
  LoadingGrid,
  ProductCardView,
  ProductGrid,
  PromotionCardView,
  Section,
} from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { useBrowserLocation } from "@/hooks/use-browser-location";
import { cartErrorMessage, useAddToCart, useFeed, useMarketplaceSession } from "@/lib/marketplace";
import { useToast } from "@/hooks/use-toast";

export default function MarketplaceHomePage() {
  const { coords, status, request } = useBrowserLocation();
  const { data, isLoading, isError, refetch } = useFeed(coords);
  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const requireSession = (action: () => void) => {
    if (session) action();
    else navigate("/sign-in");
  };

  return (
    <MarketplaceShell>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 via-white/5 to-transparent px-6 py-10 sm:px-10">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          <UtensilsCrossed aria-hidden="true" className="h-4 w-4" />
          Pedidos a domicilio
        </p>
        <h1 className="max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
          Pedí de los negocios de tu barrio, sin llamar a nadie.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
          Restaurantes, farmacias, ferreterías y más — comparás, pedís y seguís tu entrega desde
          PymesHub.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <AmberButton onClick={() => navigate("/categories")}>
            Explorar categorías
            <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </AmberButton>
          <button
            type="button"
            onClick={request}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          >
            <MapPin aria-hidden="true" className="h-4 w-4" />
            {status === "granted" ? "Ubicación activa" : "Usar mi ubicación"}
          </button>
        </div>
        {status === "denied" ? (
          <p className="mt-3 text-xs text-amber-300">
            No pudimos usar tu ubicación. Podés seguir explorando por categorías.
          </p>
        ) : null}
      </section>

      {isError ? (
        <div className="mt-7">
          <ErrorState message="No pudimos cargar el inicio." onRetry={() => void refetch()} />
        </div>
      ) : isLoading || !data ? (
        <div className="mt-7">
          <LoadingGrid />
        </div>
      ) : (
        <>
          {data.categories.length > 0 ? (
            <Section
              title="Categorías"
              action={
                <Link href="/categories" className="text-xs font-semibold text-amber-400 hover:text-amber-300">
                  Ver todas
                </Link>
              }
            >
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {data.categories.slice(0, 14).map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="min-h-11 shrink-0 rounded-full border border-white/10 bg-white/5 px-4 text-sm leading-[2.75rem] text-slate-200 transition hover:border-amber-500/40 hover:text-white"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}

          {data.offers.length > 0 ? (
            <Section title="Ofertas">
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {data.offers.slice(0, 8).map((product) => (
                  <div key={product.id} className="w-[15rem] shrink-0">
                    <ProductCardView
                      product={product}
                      adding={addToCart.isPending}
                      onAdd={(item) =>
                        requireSession(() => {
                          addToCart.mutate(
                            { productId: item.id },
                            {
                              onError: (error) =>
                                toast({ title: cartErrorMessage(error), variant: "destructive" }),
                            },
                          );
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {data.promotions.length > 0 ? (
            <Section title="Cupones">
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {data.promotions.slice(0, 6).map((promotion) => (
                  <PromotionCardView key={promotion.id} promotion={promotion} />
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Destacados">
            {data.featured.length > 0 ? (
              <ProductGrid>
                {data.featured.map((product) => (
                  <ProductCardView
                    key={product.id}
                    product={product}
                    adding={addToCart.isPending}
                    onAdd={(item) =>
                      requireSession(() => {
                        addToCart.mutate(
                          { productId: item.id },
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
              <EmptyState title="Todavía no hay productos destacados." />
            )}
          </Section>

          <Section title="Cerca de ti">
            {data.nearby.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.nearby.map((business) => (
                  <BusinessCardView key={business.id} card={business} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No encontramos negocios cerca."
                description="Activá tu ubicación para ver los negocios más cercanos, o explorá por categorías."
                action={<AmberButton onClick={request}>Usar mi ubicación</AmberButton>}
              />
            )}
          </Section>
        </>
      )}
    </MarketplaceShell>
  );
}
