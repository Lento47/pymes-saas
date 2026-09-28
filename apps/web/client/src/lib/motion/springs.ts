import type { Transition } from "framer-motion";

/**
 * The named springs the public marketing surface animates on.
 *
 * These are the reference design's motion table, ported. Its source is react-spring,
 * where a config is `tension` and `friction` at mass 1; framer-motion calls the same
 * two numbers `stiffness` and `damping`, so the values carry over unchanged rather
 * than being re-tuned by eye. Anything on the page that moves uses one of these —
 * there are no ad-hoc durations, which is what keeps a page assembled from five very
 * different blocks feeling like one page.
 *
 * Higher tension is faster and more eager, higher friction settles sooner with less
 * overshoot. `mass: 1` everywhere is not a default we left alone: it is the assumption
 * the whole table was drawn under.
 */
export const SPRINGS = {
  /** Whole-element entrance. Soft, a little of a settle at the end. */
  reveal: { type: "spring", stiffness: 90, damping: 26, mass: 1 },
  /** A row in a stack, a list item. The workhorse. */
  row: { type: "spring", stiffness: 170, damping: 24, mass: 1 },
  item: { type: "spring", stiffness: 170, damping: 24, mass: 1 },
  /** A full-screen sheet opening over the page. */
  sheet: { type: "spring", stiffness: 190, damping: 26, mass: 1 },
  /** A photographic or procedural figure settling into place. */
  figure: { type: "spring", stiffness: 200, damping: 24, mass: 1 },
  /** Display type. The stiffest of the set — large type needs to arrive decisively. */
  type: { type: "spring", stiffness: 210, damping: 24, mass: 1 },
  /** A year or figure assembling out of digits. */
  year: { type: "spring", stiffness: 190, damping: 24, mass: 1 },
  /** Body copy. Slow and almost undamped, so a paragraph drifts in rather than snaps. */
  copySoft: { type: "spring", stiffness: 110, damping: 26, mass: 1 },
  copy: { type: "spring", stiffness: 150, damping: 24, mass: 1 },
  /** The name on the hero. */
  name: { type: "spring", stiffness: 190, damping: 24, mass: 1 },
  /** The loading veil lifting. Very low tension: this one is allowed to feel heavy. */
  veil: { type: "spring", stiffness: 70, damping: 24, mass: 1 },
  /** Clearing an obstruction — the veil clearing, a shade receding. */
  clear: { type: "spring", stiffness: 140, damping: 26, mass: 1 },
  /** An eyebrow or label. */
  label: { type: "spring", stiffness: 110, damping: 26, mass: 1 },
  /** A progress meter still waiting on assets — almost critically damped, so it crawls. */
  progressWaiting: { type: "spring", stiffness: 10, damping: 30, mass: 1 },
  /** The same meter once the scene is ready. */
  progressReady: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
  /** A figure relaxing back to its resting opacity. */
  yearSettle: { type: "spring", stiffness: 32, damping: 26, mass: 1 },
  /** A scroll trigger being armed. */
  trigger: { type: "spring", stiffness: 140, damping: 30, mass: 1 },
} satisfies Record<string, Transition>;

/**
 * A plain tween, for the cases the reference expresses as `{ duration, easing }`
 * rather than as a spring. A tween is the right tool when the motion is a mechanical
 * sweep with no overshoot to hide — a veil wiping off, a meter filling.
 */
export function tween(duration: number, easing: Transition["ease"] = [0.2, 0, 0, 1]): Transition {
  return { duration, ease: easing };
}

/** The entrance used by hover-state colour and the plates' inset. Never a spring. */
export const DURATION_FAST = 0.15;
export const DURATION_NORMAL = 0.25;
export const DURATION_PLATE = 0.7;
