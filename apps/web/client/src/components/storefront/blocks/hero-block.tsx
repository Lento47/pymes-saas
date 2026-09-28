import { ArrowRight, MapPin } from "lucide-react";

import { ContourField } from "@/components/storefront/gl/contour-field";
import { useI18n } from "@/components/providers/i18n-provider";
import { TextReveal, Reveal } from "@/lib/motion/text-reveal";
import { AmberButton, OutlineButton } from "@/components/marketplace/public-shell";
import { money } from "@/components/marketplace/cards";
import type { BrowserLocationState } from "@/hooks/use-browser-location";

/**
 * Block one: the hero.
 *
 * The identity on the left, two panels on the right, the actions on the foot, and the
 * contour field behind all of it. The layout is the reference's overlay arrangement —
 * a full-bleed scene with the type laid over it — rather than a card in a column, which
 * is what the storefront was before.
 *
 * Everything in the panels is real. The location row reflects the actual permission
 * state, the payment row is what the platform actually accepts, and the cart count comes
 * from the cart query. A panel that cannot be filled says so rather than showing a
 * placeholder.
 */

type Props = {
  /** The real permission state, including `pending` and the initial `idle`. */
  locationStatus: BrowserLocationState;
  onRequestLocation: () => void;
  shopCount: number | null;
  currency: string;
  cartTotalMinor: number | null;
  onBrowse: () => void;
};

export function HeroBlock({
  locationStatus,
  onRequestLocation,
  shopCount,
  currency,
  cartTotalMinor,
  onBrowse,
}: Props) {
  const { messages } = useI18n();
  const t = messages.site.showcase.hero;

  const locationLabel =
    locationStatus === "granted" ? t.meta.location : t.meta.locationUnknown;

  return (
    <section className="showcase relative isolate overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24">
      <ContourField tone="ink" opacity={0.07} className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />

      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-16">
        {/* The identity. */}
        <div>
          <Reveal>
            <p className="showcase-sans mb-5 text-[0.75rem] font-bold uppercase tracking-[0.22em] text-[var(--sc-accent-text)]">
              {t.eyebrow}
            </p>
          </Reveal>

          <TextReveal
            as="h1"
            text={t.title}
            mode="once"
            unit="words"
            stagger={42}
            delay={120}
            className="showcase-sans max-w-[16ch] text-balance text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.055em] text-[var(--sc-ink)]"
          />

          <Reveal delay={520}>
            <p className="showcase-sans mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
              {t.subtitle}
            </p>
          </Reveal>

          {/* The actions, on the foot. */}
          <Reveal delay={760} className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <AmberButton onClick={onBrowse} className="min-h-12">
                {t.primary}
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </AmberButton>
              <OutlineButton onClick={onRequestLocation} className="min-h-12">
                <MapPin aria-hidden="true" className="mr-1.5 h-4 w-4" />
                {t.secondary}
              </OutlineButton>
            </div>
          </Reveal>

          {locationStatus === "denied" ? (
            <Reveal delay={900}>
              <p className="showcase-sans mt-4 max-w-md text-xs leading-relaxed text-[var(--sc-accent-text)]">
                {t.locationDenied}
              </p>
            </Reveal>
          ) : null}
        </div>

        {/* The panels. */}
        <div className="flex flex-col gap-3">
          <Reveal delay={880} from="0.75rem">
            <div className="showcase-sans rounded-[var(--sc-radius-lg)] border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] p-5">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.18em] text-[var(--sc-ink-muted)]">
                {t.meta.location}
              </p>
              <p className="mt-3 flex items-center gap-3 text-sm font-semibold text-[var(--sc-ink)]">
                {/* The brand's icon tile rather than a loose glyph, which is how the old
                    platform cards set theirs. */}
                <span className="showcase-icon-tile h-9 w-9 rounded-xl">
                  <MapPin aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                {locationLabel}
              </p>
            </div>
          </Reveal>

          <Reveal delay={1020} from="0.75rem">
            <div className="showcase-sans rounded-[var(--sc-radius-lg)] border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] p-5">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.18em] text-[var(--sc-ink-muted)]">
                {t.meta.payment}
              </p>
              <p className="mt-3 text-sm font-semibold text-[var(--sc-ink)]">{t.meta.paymentValue}</p>
              {/* The cart total is real money from the cart query, and it carries its own
                  currency rather than inheriting the page's. */}
              {cartTotalMinor !== null && cartTotalMinor > 0 ? (
                <p className="mt-2 text-sm text-[var(--sc-ink-muted)]">
                  {money(cartTotalMinor, currency)}
                </p>
              ) : null}
            </div>
          </Reveal>

          {shopCount !== null && shopCount > 0 ? (
            <Reveal delay={1160} from="0.75rem">
              <div className="showcase-sans rounded-[var(--sc-radius-lg)] border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] p-5">
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.18em] text-[var(--sc-ink-muted)]">
                  {t.meta.shops}
                </p>
                <p className="showcase-sans mt-2 text-[var(--sc-type-figure)] font-semibold leading-none tracking-[-0.055em] text-[var(--sc-ink)]">
                  {shopCount}
                </p>
              </div>
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}
