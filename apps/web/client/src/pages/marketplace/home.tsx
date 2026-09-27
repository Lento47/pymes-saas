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
  Rail,
  Section,
} from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell, OutlineButton } from "@/components/marketplace/public-shell";
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
      {/* Flat, not a gradient. The headline carries the section, and an amber wash behind
          it would be the one place on the page where the accent competes with the type. */}
      <section className="rounded-xl border border-border bg-card px-6 py-12 sm:px-10 sm:py-16">
        <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-link">
          <UtensilsCrossed aria-hidden="true" className="h-3.5 w-3.5" />
          Pedidos a domicilio
        </p>
        <h1 className="max-w-3xl text-balance text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
          Pedí de los negocios de tu barrio, sin llamar a nadie.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Restaurantes, farmacias, ferreterías y más — comparás, pedís y seguís tu entrega desde
          PymesHub.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <AmberButton onClick={() => navigate("/categories")}>
            Explorar categorías
            <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </AmberButton>
          <OutlineButton onClick={request}>
            <MapPin aria-hidden="true" className="mr-1.5 h-4 w-4" />
            {status === "granted" ? "Ubicación activa" : "Usar mi ubicación"}
          </OutlineButton>
        </div>
        {status === "denied" ? (
          <p className="mt-4 text-xs text-link">
            No pudimos usar tu ubicación. Podés seguir explorando por categorías.
          </p>
        ) : null}
      </section>

      {isError ? (
        <div className="mt-8">
          <ErrorState message="No pudimos cargar el inicio." onRetry={() => void refetch()} />
        </div>
      ) : isLoading || !data ? (
        <div className="mt-8">
          <LoadingGrid />
        </div>
      ) : (
        <>
          {data.categories.length > 0 ? (
            <Section
              title="Categorías"
              action={
                <Link href="/categories" className="text-xs font-semibold text-link hover:text-link/80">
                  Ver todas
                </Link>
              }
            >
              <Rail>
                {data.categories.slice(0, 14).map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="min-h-11 shrink-0 rounded-md border border-border bg-card px-4 text-sm leading-[2.75rem] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {category.name}
                  </Link>
                ))}
              </Rail>
            </Section>
          ) : null}

          {data.offers.length > 0 ? (
            <Section title="Ofertas">
              <Rail>
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
              </Rail>
            </Section>
          ) : null}

          {data.promotions.length > 0 ? (
            <Section title="Cupones">
              <Rail>
                {data.promotions.slice(0, 6).map((promotion) => (
                  <PromotionCardView key={promotion.id} promotion={promotion} />
                ))}
              </Rail>
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
