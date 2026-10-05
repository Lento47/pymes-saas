import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { deliveryFluidColor } from "@/lib/purchase-colors";
import type { PurchaseStage } from "@/lib/purchase-state";
import { type ColorScheme, palette } from "@/theme";

import { type FluidMotion, TopFluidGradient } from "./top-fluid-gradient";

/**
 * The four-stop lime ramp, per scheme, and why the dark one is the odd one out.
 *
 * **`LIME_LIGHT` is unchanged and must stay that way.** It is what the light theme has always
 * drawn, and `lib/home-gradient.test.ts` asserts it byte for byte so that "do not touch the
 * light theme" is a fact the suite enforces rather than a promise this file makes.
 *
 * **`LIME_DARK` is the only browsing ramp that ends opaque.** The purchase-state ramps start
 * opaque but dissolve to alpha zero. This one ends on `#0F0F0F`, the dark theme's own
 * `background`, and that opaque edge must land above the first card. So it is shorter, and it
 * holds its bright stop well past the header text before it starts falling.
 *
 * ## The stops, and where each one lands on a 914pt screen
 *
 * `0.34` of 914 is **311pt**. At `locations[1] = 0.5` the second stop arrives at 155pt, which
 * is below the search field and below every mark in the header — so the greeting, the meta
 * line and the pins all sit on the lime half and never on the fall. The third stop at 224pt
 * (0.72) takes the olive out well before the first card, and the last reaches the background
 * at 311pt.
 *
 * ## Why the header ink on this band is `primaryForeground` and not `foreground`
 *
 * Because the band is now *light*. `lime.light` has drawn `#111111` on `#C8FF18` since it
 * existed, and this makes dark do the same rather than diverge from it. Measured on the
 * darkest colour any header mark sits on (`#A9DE00`, the meta line at 112pt):
 *
 * | mark | pt | contrast vs `#111111` |
 * |---|---|---|
 * | status bar | 20 | 15.43:1 |
 * | greeting, 22px bold | 79 | 13.73:1 |
 * | meta lead, 13px | 100 | 13.23:1 |
 * | meta value, 13px | 112 | 12.88:1 |
 *
 * The 13px meta line is the binding one — normal text owes 4.5:1 and clears it by 8. The
 * avatar is *not* in that table: `./image` paints `colors.muted`, so the initials sit on
 * their own `#232322` disc and never see this ramp.
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
	const { height } = useWindowDimensions();
	const focused = useIsFocused();
	const isLime = color.toLowerCase() === "#c8ff18";
	const strengths: readonly [number, number, number, number] =
		scheme === "dark" ? [0.42, 0.24, 0.04, 0] : [0.8, 0.6, 0.16, 0];

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
	const colors = journeyBand
		? ([
				journeyBand,
				smoothBand ? withAlpha(journeyBand, 0.72) : journeyBand,
				withAlpha(journeyBand, smoothBand ? 0.18 : compact ? 0.05 : 0.3),
				withAlpha(journeyBand, 0),
			] as const)
		: browsingColors;
	const shortBand = Boolean(journeyBand) || darkLime;
	const bandHeight =
		height *
		(compact && !smoothBand ? COMPACT_BAND : shortBand ? DARK_LIME_BAND : BAND);
	const locations = smoothBand
		? SMOOTH_LOCATIONS
		: compact
			? COMPACT_LOCATIONS
			: journeyBand || darkLime
				? DARK_LIME_LOCATIONS
				: LOCATIONS;
	if (stage === "delivery" && journeyBand) {
		return (
			<TopFluidGradient
				height={Math.min(height * 0.38, 380)}
				color={deliveryFluidColor(journeyBand, palette.light.primary, scheme)}
				backgroundColor={backgroundColor}
				scheme={scheme}
				motion={focused ? fluidMotion : "still"}
			/>
		);
	}
	return (
		<View style={{ height: bandHeight }} pointerEvents="none">
			<LinearGradient
				colors={colors}
				locations={locations}
				start={{ x: 0.5, y: 0 }}
				end={{ x: 0.5, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
		</View>
	);
}

function withAlpha(hex: string, alpha: number): string {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
