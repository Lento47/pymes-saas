import { Heart, Loader2, RotateCw } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  useFavorites,
  useMarketplaceSession,
  useToggleFavorite,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type Props = { name: string; className?: string } & (
  | { productId: string; businessId?: never }
  | { businessId: string; productId?: never }
);

/** The shared query keeps every copy of a product's heart in sync with the API. */
export function FavoriteButton({
  name,
  className,
  productId,
  businessId,
}: Props) {
  const { data: session, isLoading: loadingSession } = useMarketplaceSession();
  const favorites = useFavorites(Boolean(session));
  const toggle = useToggleFavorite();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const selected = productId
    ? (favorites.data?.products.some((product) => product.id === productId) ??
      false)
    : (favorites.data?.businesses.some(
        (business) => business.id === businessId,
      ) ?? false);
  const loading =
    loadingSession ||
    Boolean(session && favorites.isLoading) ||
    toggle.isPending;
  const failed = Boolean(session && favorites.isError);
  const label = failed
    ? `Reintentar favoritos de ${name}`
    : selected
      ? `Quitar ${name} de favoritos`
      : `Guardar ${name} en favoritos`;

  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading || undefined}
      aria-label={label}
      title={label}
      aria-pressed={
        session && !failed && !favorites.isLoading ? selected : undefined
      }
      className={cn(
        "market-favorite inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/50 hover:bg-bg-hover disabled:opacity-60",
        className,
      )}
      onClick={() => {
        if (!session) {
          navigate("/sign-in");
          return;
        }
        if (failed) {
          void favorites.refetch();
          return;
        }
        toggle.mutate(productId ? { productId } : { businessId }, {
          onSuccess: ({ favorited }) =>
            toast({
              title: favorited
                ? "Guardado en favoritos"
                : "Quitado de favoritos",
            }),
          onError: () =>
            toast({
              title: "No pudimos actualizar tus favoritos. Intentá de nuevo.",
              variant: "destructive",
            }),
        });
      }}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : failed ? (
        <RotateCw aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Heart
          aria-hidden="true"
          className={cn("h-4 w-4", selected && "fill-current")}
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}
