import { useI18n } from "@/components/providers/i18n-provider";
import { Reveal, TextReveal } from "@/lib/motion/text-reveal";
import { money } from "@/components/marketplace/cards";

import type { PromotionCard } from "@pymeshub/shared";

/**
 * Block four: live offers.
 *
 * Back to the light ground after two dark blocks, and the only block that shows a
 * discount. Amber therefore appears here as a figure and as a code, never as a wash
 * behind the type — the accent is for the thing being announced.
 *
 * Every code shown is a real promotion the API returned. There is no example code and
 * no "up to" — a promotion card is a specific code with a specific value.
 */

type Props = { promotions: PromotionCard[] };

type PromotionStrings = { percent: string; fixed: string; freeDelivery: string };

/** How each promotion kind reads. `PERCENT` and `FIXED` both carry a value. */
function describePromotion(promotion: PromotionCard, t: PromotionStrings) {
  if (promotion.kind === "FREE_DELIVERY") return t.freeDelivery;

  if (promotion.kind === "PERCENT") {
    return t.percent.replace("{value}", String(promotion.value));
  }

  // FIXED is in the shop's own minor units, and the card carries that currency
  // precisely so the client never has to guess the exponent.
  return t.fixed.replace("{value}", money(promotion.value, promotion.currency));
}

function usePromotionStrings(): PromotionStrings {
  const { messages } = useI18n();
  return messages.site.showcase.offers.kind;
}

export function OffersBlock({ promotions }: Props) {
  const { messages } = useI18n();
  const t = messages.site.showcase.offers;
  const kind = usePromotionStrings();

  return (
    <section className="showcase relative isolate overflow-hidden bg-[var(--sc-ground)] text-[var(--sc-ink)]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="showcase-sans mb-5 text-[0.75rem] font-bold uppercase tracking-[0.22em] text-[var(--sc-accent-text)]">
                {t.eyebrow}
              </p>
            </Reveal>

            <TextReveal
              as="h2"
              text={t.title}
              mode="forward"
              unit="words"
              stagger={32}
              className="showcase-sans text-balance text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[0.95] tracking-[-0.05em]"
            />

            <Reveal delay={240}>
              <p className="showcase-sans mt-5 max-w-lg text-pretty text-base leading-relaxed text-[var(--sc-ink-muted)]">
                {t.subtitle}
              </p>
            </Reveal>
          </div>
        </div>

        {promotions.length === 0 ? (
          <Reveal delay={320} className="mt-10">
            <p className="showcase-sans max-w-md text-sm leading-relaxed text-[var(--sc-ink-muted)]">
              {t.empty}
            </p>
          </Reveal>
        ) : (
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promotion, index) => (
              <li key={promotion.id}>
                <Reveal delay={index * 80} from="0.75rem">
                  <article className="h-full rounded-[var(--sc-radius-lg)] border border-[var(--sc-hairline)] bg-[var(--sc-paper-card)] p-5">
                    <p className="showcase-sans text-[0.75rem] font-bold uppercase tracking-[0.18em] text-[var(--sc-ink-muted)]">
                      {t.code}
                    </p>

                    {/* The code is the thing being announced, so it is the one place the
                        accent is allowed to be large. */}
                    <p className="showcase-sans mt-3 text-[var(--sc-type-title)] font-bold tracking-[-0.03em] text-[var(--sc-accent-text)]">
                      {promotion.code}
                    </p>

                    <p className="showcase-sans mt-3 text-sm font-semibold text-[var(--sc-ink)]">
                      {describePromotion(promotion, kind)}
                    </p>

                    <p className="showcase-sans mt-1 text-sm text-[var(--sc-ink-muted)]">
                      {promotion.business.name}
                    </p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
