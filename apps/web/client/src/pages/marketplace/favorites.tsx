import { useLocation } from "wouter";

import {
  BusinessCardView,
  EmptyState,
  ErrorState,
  LoadingGrid,
  ProductCardView,
  ProductGrid,
  Section,
} from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { useToast } from "@/hooks/use-toast";
import {
  cartErrorMessage,
  useAddToCart,
  useFavorites,
  useMarketplaceSession,
} from "@/lib/marketplace";

export default function MarketplaceFavoritesPage() {
  const { data: session, isLoading: loadingSession } = useMarketplaceSession();
  const { data, isLoading, isError, refetch } = useFavorites(Boolean(session));
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  if (loadingSession || (session && isLoading)) {
    return (
      <MarketplaceShell>
        <LoadingGrid count={4} />
      </MarketplaceShell>
    );
  }

  if (!session) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Iniciá sesión para guardar favoritos."
          description="Marcá negocios y productos con el corazón para encontrarlos rápido."
          action={<AmberButton onClick={() => navigate("/sign-in")}>Ingresar</AmberButton>}
        />
      </MarketplaceShell>
    );
  }

  if (isError) {
    return (
      <MarketplaceShell>
        <ErrorState message="No pudimos cargar tus favoritos." onRetry={() => void refetch()} />
      </MarketplaceShell>
    );
  }

  const empty = !data || (data.businesses.length === 0 && data.products.length === 0);

  return (
    <MarketplaceShell>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-white">Favoritos</h1>

      {empty ? (
        <EmptyState
          title="Todavía no tenés favoritos."
          description="Explorá negocios y tocá el corazón para guardarlos acá."
          action={<AmberButton onClick={() => navigate("/categories")}>Explorar categorías</AmberButton>}
        />
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

          {data.products.length > 0 ? (
            <Section title="Productos">
              <ProductGrid>
                {data.products.map((product) => (
                  <ProductCardView
                    key={product.id}
                    product={product}
                    adding={addToCart.isPending}
                    onAdd={(item) =>
                      addToCart.mutate(
                        { productId: item.id },
                        {
                          onError: (error) =>
                            toast({ title: cartErrorMessage(error), variant: "destructive" }),
                        },
                      )
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
