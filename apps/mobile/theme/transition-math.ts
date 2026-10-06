import { mixOklab } from "@/lib/color";

import type { ThemeColors } from "./tokens";

/**
 * The pure half of the theme transition: channel parsing and colour interpolation.
 *
 * **Separate from `transition.tsx` so it can be tested without a renderer.** The provider needs
 * React, a `requestAnimationFrame` and a mounted theme tree; none of that is needed to answer
 * "does this interpolation land on its endpoints, and does it keep an eight-digit border
 * transparent". `theme/transition.test.ts` exercises this file directly.
 *
 * The real reason it is its own module, though, is the alpha handling.
 */

/**
 * `out` cubic: leaves immediately, arrives without a rush.
 *
 * A wash that eases both ways reads as a dissolve. One that eases in on the way *out* reads as
 * a flash followed by a slow crawl, because the eye is handed the change at full speed and then
 * left watching the last few code values arrive.
 */
export function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

/**
 * Channel parse that keeps alpha.
 *
 * **`mixHex` from `lib/color.ts` cannot be used for this.** It reads offsets 1/3/5 and rebuilds
 * a six-digit hex, so an eight-digit value loses its alpha entirely — and thirteen `border`
 * values in the tree are eight-digit (`#11111114`, `#14121014`, …). Interpolating those with
 * `mixHex` takes every theme's hairline border to fully opaque for the length of the
 * transition, which is a visible flash on the one token that is *supposed* to be nearly
 * invisible.
 *
 * `#RGB` and `#RGBA` are legal shorthand. The tree uses neither today, but a colour helper that
 * silently mis-reads one is worse than one that handles it.
 */
export function channels(hex: string): { rgb: number[]; alpha: number } {
	const value = hex.replace("#", "");
	if (value.length === 3 || value.length === 4) {
		const parts = [...value].map((c) => Number.parseInt(c + c, 16));
		return { rgb: parts.slice(0, 3), alpha: (parts[3] ?? 255) / 255 };
	}
	const pairs = value.match(/../g) ?? [];
	return {
		rgb: pairs.slice(0, 3).map((pair) => Number.parseInt(pair, 16)),
		// No alpha given means opaque, which is what `#RRGGBB` means.
		alpha: pairs.length > 3 ? Number.parseInt(pairs[3] ?? "ff", 16) / 255 : 1,
	};
}

export function toHex(rgb: number[], alpha: number): string {
	const hex = rgb
		.map((c) =>
			Math.round(Math.min(255, Math.max(0, c)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("");
	// Alpha is only carried when it is genuinely less than opaque, so a six-digit token
	// interpolating to a six-digit token stays six digits and nothing downstream — a `match` on
	// a hex, a `toUpperCase`, a snapshot comparison — sees a new shape mid-transition.
	return alpha >= 1
		? `#${hex}`
		: `#${hex}${Math.round(alpha * 255)
				.toString(16)
				.padStart(2, "0")}`;
}

/**
 * Every token of one theme moved `t` of the way toward another.
 *
 * Channel-wise in sRGB, not in Oklab, and that is a deliberate difference from `mixOklab`.
 * `mixOklab`'s reason is that a *ramp* — several stops read as a falloff — should be
 * perceptually even, and it costs three cube roots per channel to get there. This is a
 * transition between two palettes that are both already perceptually spaced, moving for
 * `duration.banner` and arriving exactly: a perceptual path through a change of palette adds
 * nothing an eye can use, and this way the endpoints are the target's own bytes rather than a
 * round-trip through a colour space.
 */
/**
 * The band's colour at a point in its tween — the pure half of `band-transition.ts`, so it
 * can be tested without a renderer, for the same reason this file exists beside
 * `transition.tsx`.
 *
 * **Oklab, where `interpolateThemeColors` above uses sRGB.** That is not an
 * inconsistency. Theme swatches are near-neighbours and an sRGB channel lerp is good
 * enough for them; a purchase-stage change is a *hue* change, and sRGB passes through a
 * duller mid-way on one. `mixOklab` is also the space the band's own ten stops are
 * already built in (`top-fluid-gradient.tsx`'s `asStops`), so the accent and its ramp
 * stay in one space rather than being lerped in one and composed in the other.
 *
 * `mixOklab(first, second, firstWeight)` names what it measures: how much of `first`
 * survives, so `firstWeight: 1` is `first` and `0` is `second`. That is the opposite of
 * "progress towards the target", and reading it the other way round makes the tween run
 * **backwards** — which is what the first version of this function did, and what
 * `band-transition.test.ts`'s endpoint assertion caught.
 *
 * Six digits in, six out — `mixOklab` cannot take an 8-digit value, which is why a band
 * that leaves holds its last colour instead of fading. See `band-transition.ts`.
 */
export function bandColorAt(from: string, to: string, t: number): string {
	return mixOklab(from, to, 1 - easeOutCubic(t));
}

export function interpolateThemeColors(
	from: ThemeColors,
	to: ThemeColors,
	t: number,
): ThemeColors {
	// `ThemeColors` is `readonly`, so the accumulator is a mutable record cast once at the end.
	const out: Record<string, string> = {};
	for (const key of Object.keys(to) as (keyof ThemeColors)[]) {
		const a = channels(from[key] ?? to[key] ?? "#000000");
		const b = channels(to[key] ?? "#000000");
		out[key] = toHex(
			[0, 1, 2].map(
				(i) => (a.rgb[i] ?? 0) + ((b.rgb[i] ?? 0) - (a.rgb[i] ?? 0)) * t,
			),
			a.alpha + (b.alpha - a.alpha) * t,
		);
	}
	return out as ThemeColors;
}
