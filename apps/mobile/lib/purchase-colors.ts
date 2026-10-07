import type { ColorScheme, ThemeColors } from "@/theme";

import { bandAnchor, contrastRatio, mixOklab } from "./color";

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

export function purchaseBand(
	stage: PurchaseStage,
	colors: ThemeColors,
	scheme: ColorScheme,
): { color: string; ink: string } | null {
	/**
	 * The band for a stage: its colour anchored against the page, and ink measured on the result.
	 *
	 * `page` is `colors.background` because that is what the band is drawn over, and anchoring
	 * against anything else would be a guarantee about a colour nobody sees.
	 */
	const band = (color: string, preferredInk: string) => {
		const anchored = bandAnchor(color, colors.background);
		return { color: anchored, ink: inkOnBand(anchored, preferredInk, colors) };
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
