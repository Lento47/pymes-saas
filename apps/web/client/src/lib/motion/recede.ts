/**
 * The recede maths, separated from the DOM.
 *
 * A covered layer shrinks toward `RECEDE_SCALE` and darkens toward `RECEDE_SHADE` as
 * the layer above it takes the viewport. This file holds those two numbers and the one
 * function that turns a progress value into a transform, so both can be asserted
 * without mounting anything.
 */

/** How far a covered layer shrinks. */
export const RECEDE_SCALE = 0.9;

/** How dark a fully covered layer goes, as a black overlay. */
export const RECEDE_SHADE = 0.55;

/**
 * The transform for a given progress, or an empty string at rest.
 *
 * Returning an empty string rather than `scale(1)` is load-bearing. A `scale(1)` is
 * still a transform, and a transformed ancestor takes `position: sticky` out of the
 * viewport's frame of reference — so leaving one on the element stops the layer
 * pinning, and makes it the containing block for any `position: fixed` child, which is
 * how a full-screen loading veil ends up centred in a section instead of in the
 * viewport.
 *
 * `shrink` is zero on a phone, where the stack shades but does not shrink because the
 * shrunken type would be unreadable at that width.
 */
export function recedeTransform(progress: number, shrink: number): string {
  if (!(progress > 0) || !(shrink > 0)) return "";
  return `scale(${1 - shrink * progress})`;
}
