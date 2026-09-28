import { useMemo } from "react";
import { Link, useLocation } from "wouter";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
  LoadingGrid,
  ProductCardView,
  ProductGrid,
  Rail,
  Section,
} from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { HeroBlock } from "@/components/storefront/blocks/hero-block";
import { DeliveryZoneBlock } from "@/components/storefront/blocks/delivery-zone-block";
import { OrderJourneyBlock } from "@/components/storefront/blocks/order-journey-block";
import { OffersBlock } from "@/components/storefront/blocks/offers-block";
import { SignoffBlock } from "@/components/storefront/blocks/signoff-block";
import { useBrowserLocation } from "@/hooks/use-browser-location";
import { cartErrorMessage, useAddToCart, useCart, useFeed, useMarketplaceSession } from "@/lib/marketplace";
import { useToast } from "@/hooks/use-toast";

/**
 * The storefront home.
 *
 * Five blocks in the art direction: the hero on the light ground, the delivery zone and
 * the order journey on near-black, then the offers back on light and the sign-off. The
 * commerce itself — categories, offers, products, shops near you — is still the API's
 * and still in the same order it was, below the blocks.
 *
 * ## Where the line is between display and data
 *
 * The blocks *display*: the delivery zone plots the `distanceKm` the API returned, the
 * offers list the promotion codes it returned, the hero counts what came back. None of
 * them invent a value, and each one distinguishes empty from unavailable — a denied
 * location says so, and no offers says so, rather than either rendering as a blank
 * panel that reads as a bug.
 *
 * The rails and grids below are where you actually shop, and they are untouched.
 */
export default function MarketplaceHomePage() {
  const { coords, status, request } = useBrowserLocation();
  const { data, isLoading, isError, refetch } = useFeed(coords);
  const { data: session } = useMarketplaceSession();
  const { data: cart } = useCart();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const requireSession = (action: () => void) => {
    if (session) action();
    else navigate("/sign-in");
  };

  /**
   * The hero's shop count and cart total.
   *
   * Both are summed from what actually came back rather than from a query total, and
   * both are `null` — not zero — when the feed has not resolved, so the panels can be
   * withheld instead of claiming a business has none. `useMemo` keeps the sum off the
   * render path when the feed has not changed.
   */
  const shopCount = useMemo(
    () => (data ? data.nearby.length : null),
    [data],
  );

  // The cart's own `totals`, which the API computed. Not a client-side sum of the
  // line items: the total carries discounts, delivery, tax and tip, and re-deriving it
  // here would disagree with checkout the moment a promotion applied.
  const cartTotalMinor = cart?.totals.totalMinor ?? null;
  const cartCurrency = cart?.totals.currency ?? cart?.currency ?? "CRC";

  return (
    <MarketplaceShell>
      <HeroBlock
        locationStatus={status}
        onRequestLocation={request}
        shopCount={shopCount}
        currency={cartCurrency}
        cartTotalMinor={cartTotalMinor}
        onBrowse={() => navigate("/categories")}
      />

      <DeliveryZoneBlock
        businesses={data?.nearby ?? []}
        hasLocation={status === "granted"}
        onRequestLocation={request}
      />

      <OrderJourneyBlock />

      <OffersBlock promotions={data?.promotions ?? []} />

      {isError ? (
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ErrorState message="No pudimos cargar el inicio." onRetry={() => void refetch()} />
        </div>
      ) : isLoading || !data ? (
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <LoadingGrid />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
        </div>
      )}

      <SignoffBlock />
    </MarketplaceShell>
  );
}
