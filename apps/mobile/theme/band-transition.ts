import { useEffect, useRef, useState } from "react";

import { duration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";

import { bandColorAt } from "./transition-math";

/**
 * The band's colour, part-way between where it was and where it is going.
 * ## Why this exists
 *
 * `theme/transition.tsx` animates `ThemeColors`, and it works: the thirteen swatches
 * glide, because every `useTheme()` consumer is handed a colour already part-way
 * between the two palettes. It knows nothing about a `purchaseStage`.
 *
 * `components/screen.tsx` composes the band as `purchaseBand(activeStage, colors,
 * scheme)`. When the **stage** changes, that substitution is a hard switch - one
 * render, `colors.primary` becomes `colors.basket` - and the result reaches
 * `<LinearGradient colors={...}>`, which **swaps** colours rather than animating
 * them. That is the snap. The two inputs to one colour move at different speeds,
 * and only the theme was being eased.
 *
 * So the band gets the same treatment the palette already has, and it is composed in
 * exactly one place, so it is fixed in exactly one place.
 *
 * ## Everything is copied from the palette on purpose
 *
 * `duration.banner`, `easeOutCubic`, blend-from-what-is-on-screen, a
 * `requestAnimationFrame` loop, and the reduced-motion jump. Not because those are the
 * only right values, but because **a band that arrives after the cards looks broken**,
 * and that is louder than any argument for a curve of its own. Changing a swatch and a
 * step together must move as one thing, and that only holds if both move identically.
 *
 * ## Oklab, where the palette uses sRGB
 *
 * `transition-math.ts` interpolates the palette in sRGB, which is fine: theme swatches
 * are near-neighbours. A stage jump is a **hue** change - step five is described as
 * "the accent changes hue" - and a hue change is exactly where an sRGB channel lerp
 * passes through a dull midpoint. The band's own ramp is already built in Oklab by
 * `mixOklab` (`top-fluid-gradient.tsx`'s `asStops`), so mixing there keeps the accent
 * and its ten stops in one space rather than lerping in one and composing in the other.
 *
 * **A colour leaving is not a fade.** `purchaseBand` returns `null` for `browsing` on a
 * non-lime theme, and `HomeGradient` discards the band for `browsing` on every theme
 * anyway (`stage !== "browsing" && bandColor ? bandColor : null`) - so the band is not
 * drawn on that step to begin with. Holding the last colour is therefore correct where
 * it is visible and invisible where it is not. An alpha fade would need an alpha-aware
 * Oklab mix built for one transition in seven, and `mixOklab` cannot take an 8-digit
 * value today; if that is wanted later it is a self-contained follow-up.
 */

/**
 * A colour that travels to its new value instead of arriving on it.
 *
 * The pure half — `bandColorAt` — lives in `./transition-math`, so this file is the only
 * part that needs a renderer. That is the split `transition-math` / `transition` already
 * makes, and it is why the interpolation is testable at all.
 *
 * Returns `undefined` until it has something to show — there is no band before the
 * first target, and inventing a colour for that first frame is a flash.
 */
export function useTweenedBandColor(
	target: string | undefined,
): string | undefined {
	const reduceMotion = useReducedMotion();
	const [shown, setShown] = useState(target);
	const shownRef = useRef(target);
	const frameRef = useRef<number | null>(null);
	const mountedRef = useRef(false);

	useEffect(() => {
		if (!mountedRef.current) {
			// The first target is what the band mounts with. Easing from nothing would fade
			// the header in on every cold start.
			mountedRef.current = true;
			shownRef.current = target;
			setShown(target);
			return;
		}

		// A target that disappeared leaves the band where it is. See the class docblock:
		// the only stage that does this is one where the band is not drawn anyway.
		if (target === undefined) return;

		if (reduceMotion) {
			shownRef.current = target;
			setShown(target);
			return;
		}

		/**
		 * Blend from **what is on screen**, not from the previous target.
		 *
		 * A reader tapping 1-2-3 quickly gets one continuous move rather than three
		 * overlapping ones, and an interrupted tween resumes from where it looked like it
		 * was instead of snapping back to a colour that was up for less than a frame.
		 */
		const from = shownRef.current ?? target;
		let start = 0;

		const step = (now: number) => {
			if (start === 0) start = now;
			const t = Math.min(1, (now - start) / duration.banner);
			const next = bandColorAt(from, target, t);
			shownRef.current = next;
			setShown(next);
			if (t < 1) {
				frameRef.current = requestAnimationFrame(step);
			} else {
				frameRef.current = null;
			}
		};
		frameRef.current = requestAnimationFrame(step);

		return () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		};
	}, [reduceMotion, target]);

	return shown;
}
