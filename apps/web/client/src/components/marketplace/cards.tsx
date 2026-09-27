import { formatMoney, type BusinessCard, type ProductCard, type PromotionCard } from "@pymeshub/shared";
import { AlertCircle, Bike, Clock, MapPin, Plus, Star, Store, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKETPLACE_API_URL } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

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
    <section className="mt-7 first:mt-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  if (value <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-300">
      <Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
      {count !== undefined && count > 0 ? <span className="text-slate-500">({count})</span> : null}
    </span>
  );
}

export function BusinessCardView({ card }: { card: BusinessCard }) {
  const logo = imageSrc(card.logoUrl);
  return (
    <Link
      href={`/store/${card.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-amber-500/40 hover:bg-white/[0.07]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-white/5">
        {card.coverUrl ? (
          <img
            src={imageSrc(card.coverUrl) ?? ""}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-amber-500/10">
            <Store aria-hidden="true" className="h-8 w-8 text-amber-500/60" />
          </div>
        )}
        {!card.isOpen ? (
          <span className="absolute left-2 top-2 rounded-full bg-[#05091d]/90 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
            Cerrado
          </span>
        ) : null}
        {logo ? (
          <img
            src={logo}
            alt=""
            className="absolute -bottom-4 left-3 h-10 w-10 rounded-xl border-2 border-[#05091d] bg-[#05091d] object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 pt-5">
        <h3 className="line-clamp-1 font-semibold text-white">{card.name}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {card.categoryName ? <span>{card.categoryName}</span> : null}
          <Rating value={card.ratingAvg} count={card.ratingCount} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Bike aria-hidden="true" className="h-3.5 w-3.5" />
            {card.deliveryFeeMinor === 0 ? "Envío gratis" : `Envío ${money(card.deliveryFeeMinor, card.currency)}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            {card.prepTimeMinutes} min
          </span>
          {card.distanceKm !== null ? (
            <span className="inline-flex items-center gap-1">
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
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-amber-500/40">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
        <Link href={`/product/${product.id}`} className="absolute inset-0 z-0">
          <span className="sr-only">{product.title}</span>
        </Link>
        {product.imageUrl ? (
          <img
            src={imageSrc(product.imageUrl) ?? ""}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-amber-500/10 text-2xl font-semibold text-amber-500/70">
            {product.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        {product.discountPercent ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-[#05091d]">
            -{product.discountPercent}%
          </span>
        ) : null}
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#05091d]/60">
            <span className="text-xs font-semibold uppercase tracking-wide text-white">Agotado</span>
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
            className="absolute bottom-2 right-2 z-10 h-10 w-10 rounded-full bg-amber-500 text-[#05091d] shadow-lg hover:bg-amber-400 disabled:opacity-60"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <Link href={`/product/${product.id}`} className="line-clamp-2 text-sm font-medium text-white">
          {product.title}
        </Link>
        <p className="line-clamp-1 text-xs text-slate-400">{product.seller.name}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-white">{money(product.priceMinor, product.currency)}</span>
            {product.compareAtPriceMinor ? (
              <span className="text-xs text-slate-500 line-through">
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
      className="flex min-w-[15rem] flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 transition hover:border-amber-500/60"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
        <Tag aria-hidden="true" className="h-3.5 w-3.5" />
        {promotion.business.name}
      </span>
      <span className="text-lg font-semibold text-white">{label}</span>
      <span className="text-xs text-slate-300">
        Código <span className="font-mono font-semibold text-white">{promotion.code}</span>
      </span>
    </Link>
  );
}

export function ProductGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <Skeleton className="aspect-[4/3] w-full rounded-none bg-white/10" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4 bg-white/10" />
            <Skeleton className="h-3 w-1/2 bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
      <Store aria-hidden="true" className="h-7 w-7 text-slate-500" />
      <p className="text-sm font-semibold text-white">{title}</p>
      {description ? <p className="max-w-md text-xs text-slate-400">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-10 text-center">
      <AlertCircle aria-hidden="true" className="h-6 w-6 text-red-400" />
      <p className="text-sm text-red-100">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry} className="border-red-400/40 text-red-100 hover:bg-red-500/10">
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export { cn };
