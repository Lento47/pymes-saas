import { useMemo } from "react";

import type { BusinessCard } from "@pymeshub/shared";
import { ContourField } from "@/components/storefront/gl/contour-field";
import { useI18n } from "@/components/providers/i18n-provider";
import { Reveal, TextReveal } from "@/lib/motion/text-reveal";
import { useScrollTrigger } from "@/lib/motion/scroll-trigger";

/**
 * Block two: the delivery zone.
 *
 * The first dark surface on the page, so the eye gets a break from the near-white hero.
 * The seam where it meets the hero is a chequered flag coming apart.
 *
 * ## What this diagram is, and what it is not
 *
 * It is a **distance diagram**, not a map. The API returns `distanceKm` on a business
 * card and no coordinates, so there is nothing to plot a bearing from and this does not
 * pretend otherwise: radius is the real distance, and angle carries no meaning at all —
 * the shops are spread evenly around each ring so they do not overlap, nothing more. The
 * copy says so, and the rings are labelled in kilometres.
 *
 * A shop whose `distanceKm` is null is not placed. It is listed in the table beneath the
 * diagram instead, because silently dropping it would understate what is available.
 */

type Props = {
  businesses: BusinessCard[];
  hasLocation: boolean;
  onRequestLocation: () => void;
};

const DIAGRAM = 320;
const CENTRE = DIAGRAM / 2;
/** Furthest distance drawn, in km. Chosen to sit just outside the API's own cutoff. */
const MAX_KM = 8;
const MAX_MARKS = 12;

export function DeliveryZoneBlock({ businesses, hasLocation, onRequestLocation }: Props) {
  const { messages } = useI18n();
  const t = messages.site.showcase.zone;

  const { placed, unplaced } = useMemo(() => {
    const withDistance = businesses.filter(
      (business): business is BusinessCard & { distanceKm: number } =>
        typeof business.distanceKm === "number" && business.distanceKm >= 0,
    );

    return {
      placed: withDistance.slice(0, MAX_MARKS),
      unplaced: businesses.filter((business) => typeof business.distanceKm !== "number"),
    };
  }, [businesses]);

  // The chequered seam burns off as the block is scrolled through, so the flag is
  // strongest as the dark surface arrives and a trace by the time the reader is inside.
  const ref = useScrollTrigger<HTMLElement>(
    { start: "bottom_bottom", end: "top_bottom", scrub: { from: 0, to: 1 } },
    (value) => {
      if (typeof value === "number") {
        ref.current?.style.setProperty("--zone-progress", String(value));
      }
    },
  );

  return (
    <section
      ref={ref}
      className="showcase relative isolate overflow-hidden bg-[var(--sc-surface-black)] text-[var(--sc-on-dark)] [--zone-progress:0]"
    >
      {/* The seam: a chequered flag, breaking up as the block comes in. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--sc-ground) 25%, transparent 25%, transparent 75%, var(--sc-ground) 75%), linear-gradient(45deg, var(--sc-ground) 25%, transparent 25%, transparent 75%, var(--sc-ground) 75%)",
          backgroundSize: "2rem 2rem",
          backgroundPosition: "0 0, 1rem 1rem",
          // Fades from half-opaque to a trace as the block is scrolled through.
          opacity: "calc(0.5 - 0.38 * var(--zone-progress))",
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />

      <ContourField tone="light" opacity={0.05} className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-16">
          <div>
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
              stagger={34}
              className="showcase-sans max-w-[14ch] text-balance text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--sc-on-dark)]"
            />

            <Reveal delay={260}>
              <p className="showcase-sans mt-5 max-w-lg text-pretty text-base leading-relaxed text-[var(--sc-on-dark-muted)]">
                {t.subtitle}
              </p>
            </Reveal>
          </div>

          <Reveal delay={340} from="1rem">
            {hasLocation ? (
              placed.length > 0 ? (
                <DistanceDiagram placed={placed} />
              ) : (
                <p className="showcase-sans rounded-[var(--sc-radius)] border border-[var(--sc-panel-line)] p-5 text-sm text-[var(--sc-on-dark-muted)]">
                  {t.empty}
                </p>
              )
            ) : (
              <div className="rounded-[var(--sc-radius)] border border-[var(--sc-panel-line)] p-5">
                <p className="showcase-sans text-sm leading-relaxed text-[var(--sc-on-dark-muted)]">
                  {t.needsLocation}
                </p>
                <button
                  type="button"
                  onClick={onRequestLocation}
                  className="showcase-sans mt-4 min-h-11 rounded-[var(--sc-radius)] bg-[var(--sc-amber)] px-5 text-sm font-semibold text-[var(--sc-ink)] transition-colors"
                >
                  {messages.site.showcase.hero.secondary}
                </button>
              </div>
            )}
          </Reveal>
        </div>

        {unplaced.length > 0 ? (
          <Reveal delay={420} className="mt-10">
            <ul className="showcase-sans grid gap-x-8 gap-y-2 text-sm text-[var(--sc-on-dark-muted)] sm:grid-cols-2 lg:grid-cols-3">
              {unplaced.map((business) => (
                <li key={business.id} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-amber)]" />
                  {business.name}
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The rings and the marks.
 *
 * Radius is linear in distance, so a shop twice as far out sits twice as far from the
 * centre. That is the honest reading of a distance diagram; a square-root scale would
 * spread the near shops out more attractively and would misstate the distances.
 */
function DistanceDiagram({ placed }: { placed: (BusinessCard & { distanceKm: number })[] }) {
  const { messages } = useI18n();
  const t = messages.site.showcase.zone;

  // One ring per whole kilometre, plus the outermost at the cutoff.
  const rings = Array.from({ length: MAX_KM }, (_, index) => index + 1);
  const scale = (CENTRE - 16) / MAX_KM;

  // Spread the marks around each ring by how many land on it, so two shops at the same
  // distance do not sit on top of each other. The angle is spacing only.
  const perRing = new Map<number, number>();
  for (const business of placed) {
    const ring = Math.max(1, Math.ceil(business.distanceKm));
    perRing.set(ring, (perRing.get(ring) ?? 0) + 1);
  }
  const seen = new Map<number, number>();

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${DIAGRAM} ${DIAGRAM}`}
        role="img"
        aria-label={t.subtitle}
        className="h-auto w-full max-w-[20rem]"
      >
        {rings.map((ring) => (
          <g key={ring}>
            <circle
              cx={CENTRE}
              cy={CENTRE}
              r={ring * scale}
              fill="none"
              stroke="var(--sc-panel-line)"
              strokeWidth="1"
            />
            <text
              x={CENTRE + 4}
              y={CENTRE - ring * scale + 12}
              fill="var(--sc-on-dark-muted)"
              fontSize="9"
              className="showcase-sans"
            >
              {t.rings.replace("{count}", String(ring))}
            </text>
          </g>
        ))}

        {/* The customer. */}
        <circle cx={CENTRE} cy={CENTRE} r="4" fill="var(--sc-amber)" />
        <text
          x={CENTRE}
          y={CENTRE + 20}
          textAnchor="middle"
          fill="var(--sc-amber)"
          fontSize="10"
          className="showcase-sans"
        >
          {t.you}
        </text>

        {placed.map((business) => {
          const ring = Math.max(1, Math.ceil(business.distanceKm));
          const index = seen.get(ring) ?? 0;
          seen.set(ring, index + 1);

          const total = perRing.get(ring) ?? 1;
          const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
          const radius = Math.min(business.distanceKm, MAX_KM) * scale;

          return (
            <circle
              key={business.id}
              cx={CENTRE + Math.cos(angle) * radius}
              cy={CENTRE + Math.sin(angle) * radius}
              r="3.5"
              fill="var(--sc-on-dark)"
              opacity={business.isOpen ? 0.95 : 0.4}
            >
              <title>{`${business.name} — ${business.distanceKm} km`}</title>
            </circle>
          );
        })}
      </svg>

      <figcaption className="showcase-sans mt-3 text-xs text-[var(--sc-on-dark-muted)]">
        {placed.length}
      </figcaption>
    </figure>
  );
}
