import type { ProductCard } from "@pymeshub/shared";
import { ArrowRight, MapPin } from "lucide-react";
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
import { MarketplaceShell } from "@/components/marketplace/public-shell";
import { useBrowserLocation } from "@/hooks/use-browser-location";
import {
  cartErrorMessage,
  useAddToCart,
  useFeed,
  useMarketplaceSession,
} from "@/lib/marketplace";
import { useToast } from "@/hooks/use-toast";

/** Shopping content and its states use the same cards as search and category pages. */
export default function MarketplaceHomePage() {
  const { coords, status, request } = useBrowserLocation();
  const { data, isLoading, isError, refetch } = useFeed(coords);
  const { data: session } = useMarketplaceSession();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const onAdd = (product: ProductCard) => {
    if (!session) {
      navigate("/sign-in");
      return;
    }
    addToCart.mutate(
      { productId: product.id },
      {
        onSuccess: () =>
          toast({ title: `${product.title} agregado al carrito` }),
        onError: (error) =>
          toast({ title: cartErrorMessage(error), variant: "destructive" }),
      },
    );
  };

  return (
    <MarketplaceShell>
      <section className="market-intro mb-8 grid gap-6 rounded-3xl border border-border bg-card p-6 sm:mb-10 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end lg:p-10">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground">
            TU MARKETPLACE LOCAL
          </p>
          <h1 className="max-w-[18ch] text-balance text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.045em]">
            Lo que te gusta.
            <br />
            Más cerca de vos.
          </h1>
          <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
            Descubrí productos y negocios locales. Elegí tu próximo pedido y
            recibilo donde estés.
          </p>
          <Link href="/categories" className="market-section-link mt-4">
            Explorar categorías{" "}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="max-w-sm border-t border-border pt-5 lg:w-64 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="hidden text-sm font-semibold lg:block">
            Comprá cerca de vos
          </p>
          <p className="mt-2 hidden text-sm leading-relaxed text-muted-foreground lg:block">
            Activá tu ubicación para encontrar los negocios más cercanos.
          </p>
          <button
            type="button"
            onClick={request}
            disabled={status === "pending" || status === "granted"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:border-primary/50 disabled:cursor-default disabled:opacity-70 lg:mt-4"
          >
            <MapPin aria-hidden="true" className="h-4 w-4" />
            {status === "pending"
              ? "Buscando ubicación…"
              : status === "granted"
                ? "Ubicación activada"
                : "Usar mi ubicación"}
          </button>
          <p
            role="status"
            className="mt-2 text-xs leading-relaxed text-muted-foreground"
          >
            {status === "denied"
              ? "No pudimos acceder a tu ubicación. Podés habilitarla en tu navegador o seguir explorando."
              : status === "unavailable"
                ? "Tu navegador no ofrece ubicación. Podés seguir explorando por categorías."
                : null}
          </p>
        </div>
      </section>

      {isError ? (
        <div>
          <ErrorState
            message="No pudimos cargar el inicio."
            onRetry={() => void refetch()}
          />
        </div>
      ) : isLoading || !data ? (
        <div>
          <LoadingGrid />
        </div>
      ) : (
        <>
          {data.categories.length > 0 ? (
            <Section
              title="¿Qué estás buscando?"
              action={
                <Link href="/categories" className="market-section-link">
                  Ver todas{" "}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              }
            >
              <Rail>
                {data.categories.slice(0, 14).map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="inline-flex min-h-12 shrink-0 items-center rounded-2xl border border-border bg-card px-5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-bg-hover"
                  >
                    {category.name}
                  </Link>
                ))}
              </Rail>
            </Section>
          ) : null}
          {data.promotions.length > 0 ? (
            <Section title="Un buen motivo para pedir">
              <Rail>
                {data.promotions.map((promotion) => (
                  <PromotionCardView key={promotion.id} promotion={promotion} />
                ))}
              </Rail>
            </Section>
          ) : null}
          {data.offers.length > 0 ? (
            <Section title="Ofertas para aprovechar">
              <Rail>
                {data.offers.map((product) => (
                  <div
                    key={product.id}
                    className="flex w-[min(72vw,16rem)] shrink-0 [&>article]:w-full"
                  >
                    <ProductCardView
                      product={product}
                      onAdd={onAdd}
                      adding={addToCart.isPending}
                    />
                  </div>
                ))}
              </Rail>
            </Section>
          ) : null}
          {data.featured.length > 0 ||
          (data.nearby.length === 0 && data.offers.length === 0) ? (
            <Section
              title="Descubrí tu próximo favorito"
              action={
                <Link href="/search" className="market-section-link">
                  Explorar <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              }
            >
              {data.featured.length > 0 ? (
                <ProductGrid>
                  {data.featured.map((product) => (
                    <ProductCardView
                      key={product.id}
                      product={product}
                      onAdd={onAdd}
                      adding={addToCart.isPending}
                    />
                  ))}
                </ProductGrid>
              ) : (
                <EmptyState
                  title="Pronto vas a encontrar más productos acá."
                  description="Mientras tanto, explorá los negocios y las categorías disponibles."
                  action={
                    <Link href="/categories" className="market-section-link">
                      Ver categorías{" "}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  }
                />
              )}
            </Section>
          ) : null}
          <Section
            title={
              status === "granted"
                ? "Negocios cerca de vos"
                : "Conocé los negocios"
            }
          >
            {data.nearby.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.nearby.map((business) => (
                  <BusinessCardView key={business.id} card={business} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Todavía no hay negocios disponibles en esta búsqueda."
                description="Explorá otras categorías o probá de nuevo más tarde."
              />
            )}
          </Section>
        </>
      )}
    </MarketplaceShell>
  );
}
