import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { bandAnchor, RAMP_LOCATIONS, RAMP_WEIGHTS } from "@/lib/color";
import { BROWSING_RAMP_ALPHA, deliveryFluidColor } from "@/lib/purchase-colors";
import type { PurchaseStage } from "@/lib/purchase-state";
import type { ColorScheme } from "@/theme";

import { BandGeometry } from "./band-geometry";
import { type FluidMotion, TopFluidGradient } from "./top-fluid-gradient";

/**
 * The lime ramps, and why the light one changed.
 *
 * **These are no longer protected.** The file used to say `LIME_LIGHT` "is unchanged and must
 * stay that way", with `lib/home-gradient.test.ts` asserting it byte for byte so that "do not
 * touch the light theme" was enforced by the suite rather than promised in a comment.
 *
 * That protection was lifted deliberately, because lime was the **worst** case for the thing the
 * band exists to do. `#C8FF18` against a white page measures **1.18:1** — no meaningful luminance
 * separation at all, and the band read purely as chroma. Every other light primary landed between
 * 1.80:1 and 7.00:1, so "is the band visible against the page" was a property of which palette
 * happened to be selected rather than something the ramp guaranteed.
 *
 * `bandAnchor` (`lib/color.ts`) now floors that at 4.5:1 against the page, holding hue exactly and
 * spending lightness instead, so both ramps open on an anchored colour. **The four-stop geometry
 * below is untouched** — the positions, the band heights and the dark ramp's opaque ending are all
 * still load-bearing, and none of them is what made lime invisible.
 *
 * ## The stops, and where each one lands on a 914pt screen
 *
 * `0.34` of 914 is **311pt**. At `locations[1] = 0.5` the second stop arrives at 155pt, which
 * is below the search field and below every mark in the header — so the greeting, the meta
 * line and the pins all sit on the lime half and never on the fall. The third stop at 224pt
 * (0.72) takes the olive out well before the first card, and the last reaches the background
 * at 311pt.
 *
 * ## Why the header ink is not decided here
 *
 * It never was, quite: this file draws the band, and `lib/purchase-colors.ts` decides what colour
 * the marks on it are. What changed is that the decision is **measured against the anchored band**
 * rather than keyed off `scheme`. A deepened band sits in the middle of the range where "light
 * scheme, dark ink" is simply wrong, and dark ink on the anchored light bands measures 2.70:1 to
 * 4.20:1 — under the 4.5 the 13px meta line owes. See `inkOnBand` in `./purchase-colors`.
 *
 * Two colours, two measurements, and the split is by **which function owns the colour**. A journey
 * stage's band arrives already anchored (`purchaseBand`), so its ink is measured on that. The
 * browsing ramp below is not anchored — it opens on the theme's primary — so its ink is measured
 * on the top stop's own composite, through `browsingBandTop`, which reproduces that stop from the
 * same `BROWSING_RAMP_ALPHA` this file draws with. `components/home-header.tsx` reads it on every
 * theme; measuring against the anchor for browsing is what once painted `#111111` on `#C8FF18`
 * (1.18:1) and, on the other twelve themes, left the meta line unmeasured entirely.
 *
 * ## The forms
 *
 * `LIME_DARK` is the only browsing ramp that ends opaque; the purchase-state ramps dissolve to
 * alpha zero. That opaque edge must land above the first card, which is why it is shorter and
 * holds its bright stop well past the header text.
 */
const LIME_LIGHT = ["#C8FF18", "#A9DE00", "#E2F4AC", "#FFFFFF"] as const;
const LIME_DARK = ["#C8FF18", "#A9DE00", "#3A3A18", "#0F0F0F"] as const;

/**
 * `[0, 18/52, 35/52, 1]` — the non-lime browsing ramp. Unchanged.
 *
 * `as const` is load-bearing, not decoration. `expo-linear-gradient` types `locations` as
 * `readonly [number, number, ...number[]]`, and a hoisted array literal widens to `number[]`,
 * which that tuple rejects — `tsc` answers `No overload matches this call` and names the
 * `number[]`, not the real cause. Inline the array and the JSX gives it the tuple type
 * contextually, which is why moving it out of the return statement broke it.
 */
const LOCATIONS = [0, 18 / 52, 35 / 52, 1] as const;

/** Lime-dark's own locations: bright half held to 155pt, fall compressed after it. */
const DARK_LIME_LOCATIONS = [0, 0.5, 0.72, 1] as const;
const COMPACT_LOCATIONS = [0, 0.54, 0.72, 1] as const;
const SMOOTH_LOCATIONS = [0, 0.28, 0.66, 1] as const;
const GEOMETRY_FADE_LOCATIONS = [0, 0.65, 1] as const;

/** `0.52` of 914 is 475pt, for the original browsing ramp. */
const BAND = 0.52;

/** `0.34` is 311pt — clears the header, ends above the first card. See the file docblock. */
const DARK_LIME_BAND = 0.34;
const COMPACT_BAND = 0.16;

export function HomeGradient({
	scheme,
	color,
	stage = "browsing",
	bandColor,
	backgroundColor,
	fluidMotion = "normal",
	compact = false,
}: {
	scheme: ColorScheme;
	color: string;
	stage?: PurchaseStage;
	bandColor?: string;
	backgroundColor: string;
	fluidMotion?: FluidMotion;
	compact?: boolean;
}) {
	const { height, width } = useWindowDimensions();
	const focused = useIsFocused();
	const isLime = color.toLowerCase() === "#c8ff18";
	/**
	 * The other twelve themes' ramp, and its alphas **come from `lib/purchase-colors.ts`** rather
	 * than being typed here.
	 *
	 * The top one is not decoration: it is what the header's ink is measured against, through
	 * `browsingBandTop`, and the header cannot reach this file's arrays without loading React
	 * Native. One constant, two readers, so the band and the ink on it cannot describe two
	 * different colours — the failure `./home-gradient.test.ts` records in full.
	 */
	const strengths = BROWSING_RAMP_ALPHA[scheme];

	/**
	 * The one combination with different geometry, and it is a *shape* fact rather than a taste
	 * one: it is the only ramp that ends opaque instead of dissolving, so it is the only one
	 * whose edge can be seen. Keyed on `isLime && dark` rather than on `scheme` so that the
	 * other twelve dark palettes keep the band they have always drawn.
	 */
	const darkLime = isLime && scheme === "dark";
	const journeyBand = stage !== "browsing" && bandColor ? bandColor : null;
	const smoothBand =
		compact &&
		(stage === "basket" ||
			stage === "inCart" ||
			stage === "checkout" ||
			stage === "confirmed" ||
			stage === "paid" ||
			stage === "delivery");

	const browsingColors = isLime
		? scheme === "dark"
			? LIME_DARK
			: LIME_LIGHT
		: ([
				withAlpha(color, strengths[0]),
				withAlpha(color, strengths[1]),
				withAlpha(color, strengths[2]),
				withAlpha(color, strengths[3]),
			] as const);
	/**
	 * Every journey band shares one composition: the ten stops of the ramp in `lib/color.ts`, at
	 * its own positions, with `RAMP_WEIGHTS` driving **alpha** here rather than lightness.
	 *
	 * ## The two channels are not the same curve, and the difference is small
	 *
	 * `RAMP_WEIGHTS` is a table of **chroma retention** — `mixOklab(color, page, w)` lerps `a`
	 * and `b` by `(1 - w)`, so `w` is what survives. On `delivery` those weights drive
	 * **lightness** through `mixOklab` in `./top-fluid-gradient` and the band ends on the page
	 * colour. Here the same weights drive **alpha** and the band dissolves to nothing.
	 *
	 * These are genuinely different curves, not one curve in two clothes: alpha composites in
	 * gamma-encoded sRGB against whatever is behind, while `mixOklab` interpolates perceptually.
	 * Measured at identical weights, chroma differs by only **1.6% to 4.8%** — and the alpha path
	 * is marginally the *stronger* of the two, not the weaker. An earlier draft of this comment
	 * claimed the shapes were "the same while the channels differ", which is not true, and
	 * implied alpha was why journey bands looked washed out. It is not: both paths are weak for
	 * one shared reason, that the table used to be derived from lightness rather than chroma.
	 * That is fixed at the source in `lib/color.ts`.
	 *
	 * **So the split stays.** Unifying would change `home-gradient.test.ts`'s pinned
	 * `withAlpha(journeyBand, weight)` and buy 2% of chroma. Alpha is also the more robust
	 * channel here, because content scrolls under the band on journey stages and the alpha path
	 * does not need to be told what the page colour is.
	 *
	 * The last two stops are both `0`, so the band is fully transparent from 70% down and the tail
	 * contributes nothing. On `delivery` that tail is the page background; here it is nothing at all.
	 */
	const colors = journeyBand
		? // Cast for the same reason `LOCATIONS` is `as const`: `expo-linear-gradient` types both
			// `colors` and `locations` as tuples, and a `.map()` result widens to `string[]`.
			// `as unknown as` because the element type is what actually changed, not the length.
			(RAMP_WEIGHTS.map((weight) =>
				withAlpha(journeyBand, weight),
			) as unknown as typeof browsingColors)
		: browsingColors;
	const shortBand = Boolean(journeyBand) || darkLime;
	const bandHeight =
		height *
		(compact && !smoothBand ? COMPACT_BAND : shortBand ? DARK_LIME_BAND : BAND);
	// A journey band uses the ramp's positions. Browsing keeps its own, because the lime ramps
	// are hand-authored four-stop palettes whose geometry is load-bearing — see the file
	// docblock — not instances of this composition.
	const locations = journeyBand
		? RAMP_LOCATIONS
		: smoothBand
			? SMOOTH_LOCATIONS
			: compact
				? COMPACT_LOCATIONS
				: darkLime
					? DARK_LIME_LOCATIONS
					: LOCATIONS;

	/**
	 * The colour the band opens on, and the one the forms are drawn in.
	 *
	 * `journeyBand` arrives already anchored — `purchaseBand` returns `bandAnchor(stage, page)`,
	 * so the contrast floor is applied once, at the source, and every consumer of the band colour
	 * gets it. The browsing ramps have no such source, so the anchor is applied here against the
	 * page they are drawn over. Both paths converge on the same guarantee, which is the point of
	 * putting it in `bandAnchor` rather than in each caller.
	 *
	 * Falls back to `color` when a journey band is absent, so the browsing ramps anchor on the
	 * theme's own primary.
	 */
	const anchor = journeyBand ?? bandAnchor(color, backgroundColor);

	/**
	 * The forms, clipped by the band's own bounds.
	 *
	 * `overflow: "hidden"` on the band is what makes them read as arcs cut by the band rather
	 * than as discs drawn over it — the same arrangement `merchant-order-hero.tsx` uses for the
	 * same shape language. Without it the circles escape into the page and the band stops being a
	 * band.
	 */
	if (stage === "delivery" && journeyBand) {
		const fluidHeight = Math.min(height * 0.38, 380);
		return (
			<View style={[styles.band, { height: fluidHeight }]} pointerEvents="none">
				<TopFluidGradient
					height={fluidHeight}
					color={deliveryFluidColor(journeyBand, color, scheme)}
					backgroundColor={backgroundColor}
					scheme={scheme}
					motion={focused ? fluidMotion : "still"}
				/>
				<BandGeometryWithFade
					color={anchor}
					page={backgroundColor}
					height={fluidHeight}
					width={width}
				/>
			</View>
		);
	}
	return (
		<View style={[styles.band, { height: bandHeight }]} pointerEvents="none">
			<LinearGradient
				colors={colors}
				locations={locations}
				start={{ x: 0.5, y: 0 }}
				end={{ x: 0.5, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
			<BandGeometryWithFade
				color={anchor}
				page={backgroundColor}
				height={bandHeight}
				width={width}
			/>
		</View>
	);
}

function BandGeometryWithFade({
	color,
	page,
	height,
	width,
}: {
	color: string;
	page: string;
	height: number;
	width: number;
}) {
	return (
		<>
			<BandGeometry color={color} page={page} height={height} width={width} />
			<LinearGradient
				colors={[withAlpha(page, 0), withAlpha(page, 0), page]}
				locations={GEOMETRY_FADE_LOCATIONS}
				start={{ x: 0.5, y: 0 }}
				end={{ x: 0.5, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	/**
	 * The band itself, and `overflow: "hidden"` is load-bearing rather than tidy: it is what
	 * clips `./band-geometry`'s circles so they read as arcs cut by the band instead of discs
	 * floating over the page. `merchant-order-hero.tsx` clips for the same reason and says so.
	 */
	band: { width: "100%", overflow: "hidden" },
});

function withAlpha(hex: string, alpha: number): string {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
