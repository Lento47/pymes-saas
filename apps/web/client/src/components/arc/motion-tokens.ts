/**
 * Motion presets, shared by every Arc component in this folder.
 *
 * Arc's values, verbatim, as TypeScript. They are the one part of the system worth keeping
 * exactly as shipped: the numbers are tuned as a set, and a component that springs with
 * `snappy` next to one that enters with `standard` only looks right if both come from the
 * same table.
 *
 * Kept in TypeScript rather than as CSS custom properties because Arc's components read
 * them for `motion`'s transition objects — springs and easings have to be values in JS, not
 * strings in CSS, and a component cannot read a CSS variable to build an easing array.
 *
 * `snappy` for presses, toggles and indicators; `smooth` for panels and height changes;
 * `morph` where two things become one another.
 */
export const motionTokens = {
  duration: {
    instant: 0.12,
    fast: 0.16,
    exit: 0.18,
    standard: 0.24,
    considered: 0.48,
  },
  ease: {
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    standard: [0.22, 1, 0.36, 1],
    /** For elements that move while already on screen. */
    inOut: [0.65, 0, 0.35, 1],
  },
  spring: {
    responsive: { type: "spring", stiffness: 520, damping: 38 },
    gentle: { type: "spring", stiffness: 340, damping: 34 },
    /** Presses, toggles, thumbs, and small indicators. Settles fast with a hint of life. */
    snappy: { type: "spring", visualDuration: 0.26, bounce: 0.12 },
    /** Panels, height changes, and layout shifts. Critically damped, never overshoots. */
    smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
    /** Shape morphs, shared layout highlights, and width changes that follow new content. */
    morph: { type: "spring", visualDuration: 0.42, bounce: 0.16 },
  },
  /** Stagger steps in seconds. Keep total stagger under roughly 0.4s. */
  stagger: { char: 0.016, word: 0.04, line: 0.08, item: 0.035 },
  /** Blur radii in px for text and content crossfades. Keep blur small and brief. */
  blur: { subtle: 2, soft: 4, text: 8 },
} as const;