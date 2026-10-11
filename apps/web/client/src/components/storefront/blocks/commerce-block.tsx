import { Bike, Clock, MapPin, Plus, Star } from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "wouter";

import type { BusinessCard, Category, ProductCard } from "@pymeshub/shared";
import { imageSrc, money } from "@/components/marketplace/cards";

/**
 * The home's commerce section, brought into the page's art direction.
 *
 * The five blocks above it — hero, delivery zone, order journey, offers, sign-off —
 * are art-directed on the showcase surface, and the commerce below them used to drop
 * back to the app's plainer card styling, which split the page in two. This section
 * carries the same language through the shopping part: Manrope, hairline edges, one
 * amber accent for the action and the figure, and the amber icon tile.
 *
 * Nothing here invents content. Every category, offer, featured product and nearby shop
 * is the API's, and each band distinguishes "empty" from "unavailable" rather than
 * rendering a blank panel that reads as a bug.
 */

type Props = {
  categories: Category[];
  offers: ProductCard[];
  featured: ProductCard[];
  nearby: BusinessCard[];
  hasLocation: boolean;
  onRequestLocation: () => void;
  onAdd: (product: ProductCard) => void;
  adding: boolean;
};

export function CommerceBlock({
  categories,
  offers,
  featured,
  nearby,
  hasLocation,
  onRequestLocation,
  onAdd,
  adding,
}: Props) {
  return (
    <section className="showcase bg-[var(--sc-ground)] text-[var(--sc-ink)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {categories.length > 0 ? (
          <Block
            title="Categorías"
            action={
              <Link
                href="/categories"
                className="showcase-sans whitespace-nowrap text-xs font-bold text-[var(--sc-accent-text)] underline-offset-4 hover:underline"
              >
                Ver todas
              </Link>
            }
          >
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 14).map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="showcase-sans inline-flex min-h-11 items-center rounded-full border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] px-4 text-sm font-semibold text-[var(--sc-ink-muted)] transition-colors hover:border-[var(--sc-amber)] hover:text-[var(--sc-ink)]"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </Block>
        ) : null}

        {offers.length > 0 ? (
          <Block title="Ofertas">
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {offers.slice(0, 8).map((product) => (
                <div key={product.id} className="w-64 shrink-0">
                  <ProductTile product={product} onAdd={onAdd} adding={adding} />
                </div>
              ))}
            </div>
          </Block>
        ) : null}

        <Block
          title="Destacados"
          action={
            <Link
              href="/search"
              className="showcase-sans whitespace-nowrap text-xs font-bold text-[var(--sc-accent-text)] underline-offset-4 hover:underline"
            >
              Ver todos
            </Link>
          }
        >
          {featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductTile key={product.id} product={product} onAdd={onAdd} adding={adding} />
              ))}
            </div>
          ) : (
            <EmptyNote title="Todavía no hay productos destacados." />
          )}
        </Block>

        <Block title="Cerca de ti">
          {hasLocation ? (
            nearby.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nearby.map((business) => (
                  <ShopTile key={business.id} card={business} />
                ))}
              </div>
            ) : (
              <EmptyNote
                title="No encontramos negocios cerca."
                description="Probá de nuevo en unos minutos o explorá por categorías."
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[var(--sc-radius)] border border-dashed border-[var(--sc-hairline)] px-6 py-14 text-center">
              <p className="showcase-sans text-sm font-semibold text-[var(--sc-ink)]">
                No encontramos negocios cerca.
              </p>
              <p className="showcase-sans max-w-md text-sm text-[var(--sc-ink-muted)]">
                Activá tu ubicación para ver los negocios más cercanos, o explorá por categorías.
              </p>
              <button
                type="button"
                onClick={onRequestLocation}
                className="showcase-sans inline-flex min-h-11 items-center rounded-lg bg-[var(--sc-amber)] px-5 text-sm font-bold text-[var(--sc-navy)] transition-colors hover:bg-[var(--sc-amber-300)]"
              >
                Usar mi ubicación
              </button>
            </div>
          )}
        </Block>
      </div>
    </section>
  );
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-14 last:mb-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="showcase-sans text-[clamp(1.25rem,3vw,1.6rem)] font-bold tracking-[-0.03em] text-[var(--sc-ink)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Rating({ value, count }: { value: number; count?: number }) {
  if (value <= 0) return null;
  return (
    <span className="showcase-sans inline-flex items-center gap-1 text-xs tabular-nums text-[var(--sc-ink-muted)]">
      <Star aria-hidden="true" className="h-3.5 w-3.5 fill-[var(--sc-amber)] text-[var(--sc-amber)]" />
      <span>{value.toFixed(1)}</span>
      {count && count > 0 ? <span className="opacity-70">({count})</span> : null}
    </span>
  );
}

function ProductTile({
  product,
  onAdd,
  adding,
}: {
  product: ProductCard;
  onAdd: (product: ProductCard) => void;
  adding: boolean;
}) {
  const image = imageSrc(product.imageUrl);
  const soldOut = !product.availability.inStock;

  return (
    <article className="showcase-sans group flex min-w-0 flex-col overflow-hidden rounded-[var(--sc-radius)] border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] transition-colors hover:border-[var(--sc-amber)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--sc-ground)]">
        <Link href={`/product/${product.id}`} className="absolute inset-0 z-0">
          <span className="sr-only">{product.title}</span>
        </Link>
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--sc-ink-muted)]">
            {product.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        {product.discountPercent ? (
          <span className="absolute left-2 top-2 rounded-md bg-[var(--sc-amber)] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[var(--sc-navy)]">
            -{product.discountPercent}%
          </span>
        ) : null}
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--sc-paper)]/70">
            <span className="rounded-md border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--sc-ink)]">
              Agotado
            </span>
          </div>
        ) : (
          <button
            type="button"
            disabled={adding}
            aria-label={`Agregar ${product.title}`}
            onClick={(event) => {
              event.preventDefault();
              onAdd(product);
            }}
            className="absolute bottom-2 right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--sc-amber)] text-[var(--sc-navy)] transition-colors hover:bg-[var(--sc-amber-300)] disabled:opacity-60"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
        <Link href={`/product/${product.id}`} className="line-clamp-2 text-sm font-semibold text-[var(--sc-ink)]">
          {product.title}
        </Link>
        <p className="truncate text-xs text-[var(--sc-ink-muted)]">{product.seller.name}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tabular-nums text-[var(--sc-ink)]">
              {money(product.priceMinor, product.currency)}
            </span>
            {product.compareAtPriceMinor ? (
              <span className="text-xs tabular-nums text-[var(--sc-ink-muted)] line-through">
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

function ShopTile({ card }: { card: BusinessCard }) {
  const cover = imageSrc(card.coverUrl);
  const logo = imageSrc(card.logoUrl);
  const delivery = !card.deliveryEnabled
    ? "Sin entrega"
    : card.merchantCoversDelivery
      ? "El comercio cubre el envío"
      : `Envío ${money(card.deliveryFeeMinor, card.currency)}`;

  return (
    <Link
      href={`/store/${card.slug}`}
      className="showcase-sans group flex min-w-0 flex-col overflow-hidden rounded-[var(--sc-radius)] border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] transition-colors hover:border-[var(--sc-amber)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--sc-ground)]">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        {!card.isOpen ? (
          <span className="absolute right-2 top-2 rounded-md border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)]/90 px-2 py-0.5 text-[11px] font-medium text-[var(--sc-ink)]">
            Cerrado
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 items-start gap-3 p-3.5">
        {logo ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-lg border border-[var(--sc-hairline)] object-cover"
          />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--sc-amber)] text-sm font-extrabold text-[var(--sc-navy)]">
            {card.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-[var(--sc-ink)]">{card.name}</h3>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {card.categoryName ? (
              <span className="truncate text-xs text-[var(--sc-ink-muted)]">{card.categoryName}</span>
            ) : null}
            <Rating value={card.ratingAvg} count={card.ratingCount} />
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--sc-hairline)] px-3.5 py-3 text-xs text-[var(--sc-ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Bike aria-hidden="true" className="h-3.5 w-3.5" />
          {delivery}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
          {card.prepTimeMinutes} min
        </span>
        {card.distanceKm !== null ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
            {card.distanceKm.toFixed(1)} km
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function EmptyNote({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--sc-radius)] border border-dashed border-[var(--sc-hairline)] px-6 py-14 text-center">
      <p className="showcase-sans text-sm font-semibold text-[var(--sc-ink)]">{title}</p>
      {description ? (
        <p className="showcase-sans max-w-md text-xs text-[var(--sc-ink-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
