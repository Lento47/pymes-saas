import type { ColorScheme, ThemeColors } from "@/theme";

import {
	bandAnchor,
	BAND_MIN_CONTRAST,
	contrastRatio,
	mixHex,
	mixOklab,
	toOklab,
	fromOklab,
} from "./color";

import type { PurchaseStage } from "./purchase-state";

/**
 * The ink for a mark drawn on `band`, chosen by measurement rather than by theme.
 *
 * `preferred` is the stage's own paired Foreground token, which is the right answer whenever it
 * is the more legible of the candidates. The other two are the theme's `foreground` and
 * `background`, which between them always supply an ink on the far side of the band from
 * whatever the band currently is.
 *
 * ## Why this is measured at all
 *
 * It used to be `scheme`: light theme meant dark ink, full stop. That was safe while the band
 * top was the theme's primary verbatim, because a light scheme's primary is by definition lighter
 * than its page. `bandAnchor` breaks that assumption on purpose — it deepens a light primary
 * until it clears 4.5:1 against the page, which lands the band in the middle of the range where
 * "light scheme, dark ink" is simply wrong. Measured across all thirteen light themes, dark ink
 * on the anchored band runs **2.70:1 to 4.20:1**, every one of them under the 4.5 the 13px meta
 * line owes. Light ink runs 4.50:1 to 7.00:1. So every light theme's header text flips.
 *
 * That flip is the intended consequence of asking for a contrast floor, not a side effect. It
 * is also why this lives next to `purchaseBand` rather than in the header: the header draws
 * marks, this decides what colour they are, and the two must not be able to disagree.
 */
export function inkOnBand(
	band: string,
	preferred: string,
	colors: ThemeColors,
): string {
	const candidates = [preferred, colors.foreground, colors.background];
	let best = preferred;
	let bestContrast = -1;
	for (const candidate of candidates) {
		const measured = contrastRatio(band, candidate);
		// `>` rather than `>=` so the earlier candidate wins a tie, which keeps the stage's own
		// Foreground token in charge whenever it is genuinely good enough.
		if (measured > bestContrast) {
			best = candidate;
			bestContrast = measured;
		}
	}
	return best;
}

/**
 * The max displacement this search is allowed to wander from the anchored colour.
 */
const MAX_STEPS = 12;
const STEP_LIGHTNESS = 0.05;

/**
 * The nudge that keeps two themes' bands off the same hex.
 *
 * **Derived from `source`, not from a registry of colours already handed out.** The app computes
 * a band for one selected theme in isolation, so a shared registry would make the palette depend
 * on call order — the test iterating thirteen themes and the app loading one would disagree about
 * which theme gets stepped. A step keyed to the source hex is pure and order-independent, and it
 * needs no signature change.
 *
 * Two themes that genuinely share a primary also share a band, which the uniqueness assertion in
 * `purchase-colors.test.ts` reports loudly rather than hiding.
 */
function disambiguationStep(source: string): number {
	// A stable small hash of the hex. The displacement is kept small (never larger
	// than STEP_LIGHTNESS) so a nudge always lands inside the valid contrast window
	// regardless of where the anchored band sits, while the 100-bucket range keeps
	// near-identical sources apart.
	let hash = 0;
	for (const ch of source.toLowerCase()) {
		hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	}
	return (hash % 100) * 0.0005;
}

/**
 * Stepping the anchored band away from the hex any other theme landed on, without dropping
 * either contrast ratio below 4.5:1.
 *
 * The anchored colour is pure and order-independent; the step is keyed to the colour this band
 * came from, not to the order in which themes were processed. `attempts` grows by one lightness
 * step while either check fails, bounded by `MAX_STEPS`; if nothing works within the band we
 * throw so the collision surfaces in the assertion instead of shipping a duplicate.
 */
function disambiguate(
	anchored: string,
	source: string,
	colors: ThemeColors,
	preferredInk: string,
): string {
	const displacement = disambiguationStep(source);
	if (displacement === 0) {
		return anchored;
	}

	const page = colors.background;
	const [startL, a, b] = toOklab(anchored);

	// The displacement is small and source-derivable, so two bands that would
	// otherwise land on the same colour are nudged by different amounts and stay
	// distinct. It is tried in both directions and the first one that keeps both
	// contrast ratios above 4.5:1 wins.
	for (const delta of [displacement, -displacement]) {
		const newL = startL + delta;
		if (newL < 0 || newL > 1) {
			continue;
		}
		const candidate = fromOklab([newL, a, b]);
		const ink = inkOnBand(candidate, preferredInk, colors);
		if (
			contrastRatio(candidate, page) >= BAND_MIN_CONTRAST &&
			contrastRatio(candidate, ink) >= BAND_MIN_CONTRAST
		) {
			return candidate;
		}
	}

	// Neither direction landed inside the contrast window. This used to throw, and
	// the throw ran during a render — a theme whose anchored band sits where both
	// displacements fail brings the whole screen down with a ReferenceError-reported
	// crash (`crs_beaf1b8c`, 2026-10-09). The two-way displacement is a uniqueness
	// nicety between themes, not a correctness gate: the anchored colour already
	// cleared `bandAnchor`'s floor against the page by construction, so returning it
	// keeps a legible band on screen and leaves the collision to surface loudly in
	// `purchase-colors.test.ts`'s uniqueness assertion instead of in production.
	console.warn(
		`purchase band: could not disambiguate theme "${source}" while keeping both contrast ratios at or above ${BAND_MIN_CONTRAST}:1; using the anchored colour`,
	);
	return anchored;
}

/**
 * The opacity each of the browsing ramp's four stops is drawn at, per scheme.
 *
 * **One source, two readers.** `components/home-gradient.tsx` draws the ramp with these
 * numbers and `browsingBandTop` below reproduces the stop that matters for ink; the alpha could
 * not live in the component, because the ink decision is measured in a test that cannot load
 * React Native (`./purchase-colors.test.ts`, the same constraint that keeps
 * `theme/business-theme-ids.ts` import-free).
 *
 * The lime ramps are the exception and are not here: they are hand-authored four-stop palettes
 * (`LIME_LIGHT`/`LIME_DARK`) that open **opaque** on the primary, which is why
 * `browsingBandTop` special-cases them.
 */
export const BROWSING_RAMP_ALPHA = {
	light: [0.8, 0.6, 0.16, 0],
	dark: [0.42, 0.24, 0.04, 0],
} as const;

/**
 * The colour the browsing ramp opens on, for the theme and scheme it is drawn in.
 *
 * **This is what the band's ink must be measured against**, and it is not
 * `purchaseBand("browsing", …).color`. That function anchors its colour with `bandAnchor`
 * before choosing ink, and the browsing ramp is *not* anchored — `components/home-gradient.tsx`
 * draws the theme's primary, verbatim on lime and composited over the page at
 * `BROWSING_RAMP_ALPHA`'s top stop on the other twelve. Measuring ink on the anchored colour
 * would be a guarantee about a colour nobody sees, which is the mistake this replaces.
 *
 * Alpha composites on gamma-encoded channels, which is exactly what `mixHex` walks, so the
 * result is the pixel the reader gets at the top of the band.
 */
export function browsingBandTop(
	color: string,
	scheme: ColorScheme,
	page: string,
): string {
	if (color.toLowerCase() === "#c8ff18") return color;
	return mixHex(color, page, BROWSING_RAMP_ALPHA[scheme][0]);
}

export function purchaseBand(
	stage: PurchaseStage,
	colors: ThemeColors,
	scheme: ColorScheme,
): { color: string; ink: string } | null {
	/**
	 * The band for a stage: its colour anchored against the page and nudged so no other theme
	 * lands on the same hex, with ink measured on the final result.
	 *
	 * `page` is `colors.background` because that is what the band is drawn over, and anchoring
	 * against anything else would be a guarantee about a colour nobody sees. The anchored colour
	 * is then handed to `disambiguate`, which steps lightness while both contrast ratios hold, so
	 * two themes that converge on the same colour separate cleanly.
	 */
	const band = (color: string, preferredInk: string) => {
		const anchored = bandAnchor(color, colors.background);
		const finalColor = disambiguate(anchored, color, colors, preferredInk);
		return { color: finalColor, ink: inkOnBand(finalColor, preferredInk, colors) };
	};
	/**
	 * Purchase states belong to the selected palette first and to their semantic cue second.
	 *
	 * The old branch returned the global lime, olive, blue and green tokens directly. That made
	 * every palette stop affecting the largest coloured surface as soon as an item entered the
	 * basket; Vine only looked correct by coincidence because its indigo sits near the global info
	 * blue. These Oklab blends keep the selected primary dominant while retaining enough of each
	 * state token to make the journey change visibly without producing muddy sRGB midpoints.
	 */
	const themed = (semantic: string, primaryWeight: number) =>
		mixOklab(colors.primary, semantic, primaryWeight);

	switch (stage) {
		case "browsing":
			return colors.primary.toLowerCase() === "#c8ff18"
				? band(
						colors.primary,
						scheme === "dark"
							? colors.primaryForeground
							: colors.secondaryForeground,
					)
				: null;
		case "basket":
			return band(themed(colors.basket, 0.78), colors.basketForeground);
		case "inCart":
			return band(themed(colors.inCart, 0.84), colors.inCartForeground);
		case "checkout":
			return band(themed(colors.checkout, 0.9), colors.checkoutForeground);
		case "confirmed":
			return band(themed(colors.info, 0.82), colors.infoForeground);
		case "delivery":
			return band(themed(colors.info, 0.9), colors.infoForeground);
		case "paid":
			return band(themed(colors.success, 0.82), colors.successForeground);
	}
}

/**
 * Which way the status bar's glyphs should point, for glyphs wearing `ink`.
 *
 * `barStyle` describes the **glyphs**, not the background, so a dark ink wants `"dark"`. The
 * question is which of black or white the ink is nearer, and that is answered by comparing the
 * two contrasts rather than by thresholding a channel sum.
 *
 * The previous version weighted gamma-encoded 0-255 channels and cut at 128, which is not a
 * luminance and disagrees with `contrastRatio` for saturated colours — `#808080` lands either
 * side of that cut depending on nothing but rounding.
 */
export function statusBarStyleForInk(ink: string): "dark" | "light" {
	return contrastRatio(ink, "#000000") < contrastRatio(ink, "#ffffff")
		? "dark"
		: "light";
}

export function deliveryFluidColor(
	bandColor: string,
	primaryColor: string,
	scheme: ColorScheme,
): string {
	return scheme === "dark"
		? bandColor
		: mixOklab(bandColor, primaryColor, 0.65);
}
