import {
  type BusinessCard,
  formatMoney,
  type ProductCard,
  type PromotionCard,
} from "@pymeshub/shared";
import {
  AlertCircle,
  Bike,
  Clock,
  Loader2,
  MapPin,
  Package,
  Plus,
  Star,
  Store,
  Tag,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKETPLACE_API_URL } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";

/**
 * The storefront's shared cards and states.
 *
 * Every surface here is token-driven, which is what lets one card serve the dark and the
 * light storefront: the `.storefront` scope in `index.css` defines `bg-card`,
 * `border-border`, `text-foreground` and `text-muted-foreground` for both palettes, so
 * nothing in this file branches on the theme or spells a colour.
 *
 * Two conventions worth keeping:
 *
 * - **A skeleton is `bg-foreground/[0.07]`, never `bg-muted`.** `muted` maps to the card
 *   colour, so a skeleton drawn on a card would be invisible in both themes — the shape
 *   has to be a lift *off* the surface it sits on.
 * - **Adjectives that describe state use semantic tokens.** "Agotado", "Cerrado" and the
 *   error state read from `destructive` / `success` / `muted-foreground` rather than from
 *   a Tailwind palette colour, because `text-red-100` is legible on navy and invisible on
 *   white.
 */

/** Resolve an API image path to an absolute URL. Uploads are served from the Worker. */
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${MARKETPLACE_API_URL}${url}`;
}

export function money(minor: number, currency: string): string {
  // The shared formatter owns the currency's exponent, so a colon amount is never
  // divided by 100 the way a dollar amount is.
  return formatMoney(minor, currency as Parameters<typeof formatMoney>[1]);
}

/** Failed uploads get the same calm fallback as missing images. */
export function MarketplaceImage({
  src,
  alt = "",
  className,
  fallback,
  width = 640,
  height = 480,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
  width?: number;
  height?: number;
}) {
  const url = imageSrc(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && failedUrl !== url ? (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(url)}
      className={className}
    />
  ) : (
    <div aria-hidden="true" className={cn("market-image-fallback", className)}>
      {fallback ?? <Package className="h-8 w-8" strokeWidth={1.25} />}
    </div>
  );
}

/**
 * A titled band of the page.
 *
 * Marketplace typography is scoped in marketplace.css, independently of the console.
 */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="market-section mt-10 first:mt-0 sm:mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-balance text-xl font-semibold tracking-[-0.025em] text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  if (value <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Star
        aria-hidden="true"
        className="h-3.5 w-3.5 fill-primary text-primary"
      />
      <span className="tabular-nums">{value.toFixed(1)}</span>
      {count !== undefined && count > 0 ? (
        <span className="tabular-nums">({count})</span>
      ) : null}
    </span>
  );
}

/**
 * A shop in a grid.
 *
 * The logo sits in the content row rather than overlapping the cover. The overlap is a
 * chunky, app-store idiom and it forces the logo's border to be painted in the page
 * canvas colour — a value that is wrong the moment the page is light. Inline, the logo
 * only needs `border-border` and the card works in both themes.
 */
export function BusinessCardView({ card }: { card: BusinessCard }) {
  const logo = imageSrc(card.logoUrl);
  return (
    <article className="market-card relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Link
        href={`/store/${card.slug}`}
        className="group flex min-w-0 flex-1 flex-col"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-elevated">
          <MarketplaceImage
            src={card.coverUrl}
            width={640}
            height={360}
            className="market-card-image h-full w-full object-cover"
            fallback={<Store className="h-8 w-8" strokeWidth={1.25} />}
          />
          {!card.isOpen ? (
            <span className="absolute right-2 top-2 rounded-md border border-border bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur">
              Cerrado
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {logo ? (
              <MarketplaceImage
                src={logo}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-xl border border-border object-cover"
                fallback={<Store className="h-4 w-4" />}
              />
            ) : null}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {card.name}
              </h3>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                {card.categoryName ? (
                  <span className="truncate">{card.categoryName}</span>
                ) : null}
                <Rating value={card.ratingAvg} count={card.ratingCount} />
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Bike aria-hidden="true" className="h-3.5 w-3.5" />
              {!card.deliveryEnabled
                ? "Sin entrega"
                : card.merchantCoversDelivery
                  ? "El comercio cubre el envío"
                  : card.deliveryPriceAtCheckout
                    ? "Envío calculado al pagar"
                    : `Envío ${money(card.deliveryFeeMinor, card.currency)}`}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {card.prepTimeMinutes} min
            </span>
            {card.distanceKm !== null ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                {card.distanceKm.toFixed(1)} km
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <FavoriteButton
        businessId={card.id}
        name={card.name}
        className="absolute left-3 top-3 z-10"
      />
    </article>
  );
}

export function ProductCardView({
  product,
  onAdd,
  adding,
  onProtectedAction,
}: {
  product: ProductCard;
  onAdd?: (product: ProductCard) => void;
  adding?: boolean;
  /** Called instead of `onAdd` when adding requires a session the visitor does not have. */
  onProtectedAction?: () => void;
}) {
  const soldOut = !product.availability.inStock;
  return (
    <article className="market-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[4/3] min-h-32 w-full overflow-hidden bg-elevated">
        <Link
          href={`/product/${product.id}`}
          className="market-image-link absolute inset-0 z-[1] rounded-t-2xl"
        >
          <span className="sr-only">{product.title}</span>
        </Link>
        <MarketplaceImage
          src={product.imageUrl}
          className="market-card-image h-full w-full object-cover"
        />
        <FavoriteButton
          productId={product.id}
          name={product.title}
          className="absolute right-2 top-2 z-10"
        />
        {product.discountPercent ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold tabular-nums text-primary-foreground">
            -{product.discountPercent}%
          </span>
        ) : null}
        {soldOut ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Agotado
            </span>
          </div>
        ) : null}
        {onAdd || onProtectedAction ? (
          <Button
            type="button"
            size="icon"
            disabled={soldOut || adding}
            aria-busy={adding || undefined}
            aria-label={`Agregar ${product.title}`}
            onClick={(event) => {
              event.preventDefault();
              if (onProtectedAction) onProtectedAction();
              else onAdd?.(product);
            }}
            className="market-add absolute bottom-2 right-2 z-10 h-11 w-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {adding ? (
              <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <Plus aria-hidden="true" className="h-5 w-5" />
            )}
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <Link
          href={`/product/${product.id}`}
          className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground hover:underline underline-offset-4"
        >
          {product.title}
        </Link>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {product.seller.name}
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="break-words text-base font-semibold tabular-nums text-foreground">
              {money(product.priceMinor, product.currency)}
            </span>
            {product.compareAtPriceMinor ? (
              <span className="text-xs text-muted-foreground line-through tabular-nums">
                {money(product.compareAtPriceMinor, product.currency)}
              </span>
            ) : null}
          </div>
          <Rating value={product.rating ?? 0} count={product.reviewCount} />
        </div>
      </div>
    </article>
  );
}

export function PromotionCardView({ promotion }: { promotion: PromotionCard }) {
  const label =
    promotion.kind === "PERCENT"
      ? `${promotion.value}% de descuento`
      : promotion.kind === "FIXED"
        ? `${money(promotion.value, promotion.currency)} de descuento`
        : "Envío gratis";
  return (
    <Link
      href={`/store/${promotion.business.slug}`}
      className="market-card flex w-[min(80vw,22rem)] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Tag aria-hidden="true" className="h-3.5 w-3.5" />
        {promotion.business.name}
      </span>
      <span className="text-xl font-semibold tracking-[-0.01em] text-foreground">
        {label}
      </span>
      <span className="mt-auto border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
        Código{" "}
        <span className="font-mono font-semibold text-foreground">
          {promotion.code}
        </span>
      </span>
    </Link>
  );
}

export function ProductGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * A horizontal rail, for the home screen's bands.
 *
 * Shared rather than repeated per band so the three rails on the home page cannot drift
 * into three different gutter treatments. The negative margin and matching padding let
 * the first tile sit flush with the page's left edge while the row still scrolls edge to
 * edge on a phone; above `sm` the page padding is already the gutter and both go away.
 */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="market-rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 sm:mx-0 sm:gap-4 sm:px-0">
      {children}
    </div>
  );
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando productos…"
      className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <Skeleton className="aspect-[4/3] min-h-32 w-full rounded-none bg-foreground/[0.07]" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-3/4 bg-foreground/[0.07]" />
            <Skeleton className="h-3 w-1/2 bg-foreground/[0.07]" />
            <Skeleton className="mt-2 h-5 w-1/3 bg-foreground/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The end of a paged list: a button, and a sentinel that presses it for you.
 *
 * One implementation for every paged surface, because the subtle parts are exactly the ones
 * that would be re-derived per screen and get it wrong per screen:
 *
 * - **The observer clicks the button instead of calling the loader.** The loader is
 *   re-created on every render, so an effect depending on it would rebuild the observer on
 *   every render, re-report the sentinel, and ask for another page each time. Letting React
 *   own the click keeps this depending on the shape of the list alone — and a disabled
 *   button ignores a click, so the guard against requesting the same page twice is the same
 *   `disabled` the customer can see rather than a second condition that could disagree.
 * - **`blocked` is not decoration.** While a new query is in flight the hook still hands
 *   back the *previous* one's pages, so `hasNextPage` and the cursor belong to a query the
 *   reader has navigated away from. Advancing in that window sends the old cursor with the
 *   new input and returns the wrong rows rather than an error.
 * - **`pages` is a dependency on purpose.** An `IntersectionObserver` reports transitions,
 *   so a sentinel that never left the viewport would fire once and then never again;
 *   re-observing makes it report the current state instead, which is what fills a tall
 *   window whose first page does not reach the fold.
 *
 * The button stays a real button, so this is an accelerator and not the only way to reach
 * the rest of a list: a keyboard or a screen reader gets the same control without scrolling.
 * Where there is nothing more to load, the count is stated instead — a reader at the bottom
 * cannot otherwise tell a list of 24 from one whose next page failed.
 */
export function LoadMore({
  hasNextPage,
  isLoadingMore,
  blocked = false,
  pages,
  onLoadMore,
  total,
  label = "Cargar más",
  singular = "resultado",
  plural = "resultados",
}: {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  /** True while the visible rows still belong to a previous query. */
  blocked?: boolean;
  /** How many pages are loaded. Only used to re-arm the observer after each one. */
  pages: number;
  onLoadMore: () => void;
  total: number;
  label?: string;
  singular?: string;
  plural?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const node = buttonRef.current;
    if (!node || !hasNextPage || blocked) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) node.click();
      },
      // One screen ahead, so reaching the end finds the next page already in flight
      // instead of showing a reader the button and only then starting to wait on it.
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, blocked, pages]);

  if (hasNextPage) {
    return (
      <div className="mt-6 flex justify-center">
        <button
          ref={buttonRef}
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore || blocked}
          className="min-h-11 rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground transition hover:border-primary/50 disabled:opacity-60"
        >
          {isLoadingMore ? "Cargando…" : label}
        </button>
      </div>
    );
  }

  if (total === 0) return null;

  return (
    <p className="mt-6 text-center text-xs text-muted-foreground tabular-nums">
      {total} {total === 1 ? singular : plural} en total
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center sm:py-20">
      <span className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-elevated">
        <Store
          aria-hidden="true"
          className="h-6 w-6 text-muted-foreground"
          strokeWidth={1.5}
        />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/[0.07] px-6 py-10 text-center"
    >
      <AlertCircle aria-hidden="true" className="h-6 w-6 text-destructive" />
      <p className="text-sm text-foreground">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          className="min-h-11 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export { cn };
