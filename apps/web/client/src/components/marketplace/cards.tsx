import { formatMoney, type BusinessCard, type ProductCard, type PromotionCard } from "@pymeshub/shared";
import { AlertCircle, Bike, Clock, MapPin, Plus, Star, Store, Tag } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKETPLACE_API_URL } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

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

/**
 * A titled band of the page.
 *
 * `text-xl` is 17px in this app's scale rather than the 20px Tailwind's default would
 * give, which is the size that keeps a section heading clearly above a card title
 * (`text-sm`) without competing with the page's own `h1`.
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
    <section className="mt-8 first:mt-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
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
      <Star aria-hidden="true" className="h-3.5 w-3.5 fill-primary text-primary" />
      <span className="tabular-nums">{value.toFixed(1)}</span>
      {count !== undefined && count > 0 ? <span className="opacity-70 tabular-nums">({count})</span> : null}
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
    <Link
      href={`/store/${card.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-elevated">
        {card.coverUrl ? (
          <img
            src={imageSrc(card.coverUrl) ?? ""}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Store aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
        {!card.isOpen ? (
          <span className="absolute right-2 top-2 rounded-md border border-border bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur">
            Cerrado
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {logo ? (
            <img src={logo} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md border border-border object-cover" />
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{card.name}</h3>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              {card.categoryName ? <span className="truncate">{card.categoryName}</span> : null}
              <Rating value={card.ratingAvg} count={card.ratingCount} />
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Bike aria-hidden="true" className="h-3.5 w-3.5" />
            {card.deliveryFeeMinor === 0 ? "Envío gratis" : `Envío ${money(card.deliveryFeeMinor, card.currency)}`}
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
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-elevated">
        <Link href={`/product/${product.id}`} className="absolute inset-0 z-0">
          <span className="sr-only">{product.title}</span>
        </Link>
        {product.imageUrl ? (
          <img
            src={imageSrc(product.imageUrl) ?? ""}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground/50">
            {product.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        {product.discountPercent ? (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground">
            -{product.discountPercent}%
          </span>
        ) : null}
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
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
            aria-label={`Agregar ${product.title}`}
            onClick={(event) => {
              event.preventDefault();
              if (onProtectedAction) onProtectedAction();
              else onAdd?.(product);
            }}
            className="absolute bottom-2 right-2 z-10 h-9 w-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <Link href={`/product/${product.id}`} className="line-clamp-2 text-sm font-medium text-foreground">
          {product.title}
        </Link>
        <p className="line-clamp-1 text-xs text-muted-foreground">{product.seller.name}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-foreground">
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
    </div>
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
      className="flex min-w-[15rem] flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.07] p-4 transition hover:border-primary/60"
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-link">
        <Tag aria-hidden="true" className="h-3.5 w-3.5" />
        {promotion.business.name}
      </span>
      <span className="text-xl font-semibold tracking-[-0.01em] text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">
        Código <span className="font-mono font-semibold text-foreground">{promotion.code}</span>
      </span>
    </Link>
  );
}

export function ProductGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
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
  return <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">{children}</div>;
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-[4/3] w-full rounded-none bg-foreground/[0.07]" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4 bg-foreground/[0.07]" />
            <Skeleton className="h-3 w-1/2 bg-foreground/[0.07]" />
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

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <Store aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-md text-xs text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-6 py-10 text-center">
      <AlertCircle aria-hidden="true" className="h-6 w-6 text-destructive" />
      <p className="text-sm text-foreground">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export { cn };
