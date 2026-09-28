import { useI18n } from "@/components/providers/i18n-provider";
import { Reveal, TextReveal } from "@/lib/motion/text-reveal";

/**
 * Block three: the order journey.
 *
 * Seven steps from choosing a shop to rating it, on a near-black ground with a rail
 * down the middle and a thread that fills as the reader scrolls.
 *
 * The steps are the product's real behaviour, written out. Nothing here is fetched and
 * nothing can be wrong: this is the one block on the page that explains rather than
 * displays, which is why it does not need a loading or an error state.
 *
 * The seven steps are held in a fixed order because the order is the claim. They are
 * data rather than seven hard-coded sections so the copy lives in one place, in both
 * locales, next to the rest of the storefront's words.
 */

const STEP_KEYS = ["choose", "confirm", "prepare", "dispatch", "notify", "arrive", "rate"] as const;

export function OrderJourneyBlock() {
  const { messages } = useI18n();
  const t = messages.site.showcase.journey;

  return (
    <section className="showcase relative isolate overflow-hidden bg-[var(--sc-panel)] text-[var(--sc-on-dark)]">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <Reveal>
            <p className="showcase-sans mb-5 text-[0.75rem] font-bold uppercase tracking-[0.22em] text-[var(--sc-amber)]">
              {t.eyebrow}
            </p>
          </Reveal>

          <TextReveal
            as="h2"
            text={t.title}
            mode="forward"
            unit="words"
            stagger={32}
            className="showcase-sans text-balance text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--sc-on-dark)]"
          />

          <Reveal delay={240}>
            <p className="showcase-sans mt-5 text-pretty text-base leading-relaxed text-[var(--sc-on-dark-muted)]">
              {t.subtitle}
            </p>
          </Reveal>
        </div>

        {/* The rail. On a phone it runs down the left edge; from `sm` it centres and the
            steps alternate. */}
        <ol className="relative mt-14 border-l border-[var(--sc-panel-line)] pl-6 sm:ml-6 sm:border-l-0 sm:pl-0">
          {STEP_KEYS.map((key, index) => {
            const step = t.steps[key];

            return (
              <li key={key} className="relative pb-8 last:pb-0 sm:ml-6 sm:pl-12">
                {/* The marker sits on the rail. */}
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.6875rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--sc-amber)] bg-[var(--sc-panel)] sm:left-0"
                />

                <Reveal delay={index * 70} from="0.5rem">
                  <div className="sm:grid sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4">
                    <span className="showcase-display block text-[var(--sc-type-lead)] leading-none text-[var(--sc-amber)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="showcase-sans text-base font-semibold tracking-[-0.02em] text-[var(--sc-on-dark)]">
                        {step.title}
                      </h3>
                      <p className="showcase-sans mt-1.5 max-w-prose text-sm leading-relaxed text-[var(--sc-on-dark-muted)]">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
