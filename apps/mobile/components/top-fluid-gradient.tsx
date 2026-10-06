import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

import {
	BREATH_WEIGHTS,
	mixOklab,
	RAMP_LOCATIONS,
	RAMP_WEIGHTS,
} from "@/lib/color";
import { duration, EASE_BREATH } from "@/lib/motion";
import type { ColorScheme } from "@/theme";

/**
 * What the band is allowed to do, which is not a motion preference but a promise about what is
 * on screen. `still` is what the caller passes when this screen is not the focused one, and it
 * means the band holds its shape rather than that it prefers to.
 */
export type FluidMotion = "normal" | "still" | "reduced";

type Stops = readonly [
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
];

/** Both ramps are built from the same weights table, so the cast is the same claim twice. */
const asStops = (weights: readonly number[], from: string, to: string) =>
	weights.map((weight) => mixOklab(from, to, weight)) as unknown as Stops;

/**
 * The delivery band: **the gradient study's ramp, breathing.**
 *
 * ## The band itself
 *
 * Ten stops at the study's own positions, built in Oklab by `lib/color.ts` so the falloff
 * matches the study's perceived shape on whatever two colours the theme supplies. The colour is
 * spent by 62% and the remaining 38% holds the page, which gives the status text a clean field
 * instead of a tint. Static geometry, one `LinearGradient` per state.
 *
 * ## The breath
 *
 * Two ramps — `RAMP_WEIGHTS` at rest and `BREATH_WEIGHTS` at the top of an inhale — stacked,
 * with the second one's opacity on a `withRepeat`. What animates is **the ramp's falloff shape**,
 * not the band's brightness: at rest the colour lets go at 62% of the height, at the top of the
 * breath it has been stretched to 100%, so the band's own gradient advances down the band and
 * retreats. An opacity animation on a single gradient would have been cheaper and would have
 * been a fade, because the whole band would dim at once and the shape would never move.
 *
 * Both curves are pinned to the same two endpoint colours (`1` at the band colour, `0` at the
 * page), so the breath cannot change where the band starts or ends — only how fast it lets go.
 *
 * `duration.breathHalf` is the half-cycle and `EASE_BREATH` flattens both ends, because a
 * breath that starts or stops abruptly reads as a stutter. A full breath is twice `breathHalf`.
 *
 * ## Why the composition is measured rather than asserted
 *
 * Every earlier attempt at this band was rejected on a device measurement, recorded in the
 * table below. The short version: the ramp's rendered luminance span is 97.8 code values over
 * 905 px, so 8-bit sRGB can express at most ~98 steps and each one *necessarily* covers 9.2 px.
 * The gradient's longest plateau is 10 px, which is that ceiling rather than a defect. Grain,
 * posterised bands, a 1D ordered dither in SVG and a 2D Bayer dither in a GL shader were all
 * built and measured; the shader worked (2x2 px) and was removed anyway, because a native
 * dependency and a GPU surface on the home screen is a price no header band earns.
 *
 * ## Motion is a promise about the screen, not a preference
 *
 * `still` and `reduced` both render the **rest** ramp and mount no animation at all — not a
 * faster one. That is what `still` means when a screen is not focused: the band is on screen, so
 * it has to have its shape, it just does not get to move. See `./home-gradient`, which passes
 * `still` whenever this route is not focused.
 */
export function TopFluidGradient({
	height = 360,
	motion = "normal",
	// Accepted and ignored - see the docblock. The band no longer branches on scheme.
	scheme: _scheme,
	color,
	backgroundColor,
}: {
	height?: number;
	motion?: FluidMotion;
	scheme: ColorScheme;
	color: string;
	backgroundColor: string;
}) {
	const breathing = motion === "normal";
	const breath = useSharedValue(0);

	useEffect(() => {
		if (!breathing) {
			// Stop the repeat *and* park it at rest, so a band that goes from animated to
			// `still` while off-screen is already in its resting shape when it comes back.
			breath.value = 0;
			return;
		}
		breath.value = 0;
		breath.value = withRepeat(
			withTiming(1, {
				duration: duration.breathHalf,
				easing: Easing.bezier(
					// Spelled out rather than `Object.values(EASE_BREATH)`: `Easing.bezier`
					// takes its four points in order, and reading them off the object relies on
					// key insertion order staying as written.
					EASE_BREATH.x1,
					EASE_BREATH.y1,
					EASE_BREATH.x2,
					EASE_BREATH.y2,
				),
			}),
			-1,
			// Reverse rather than restart: a breath that jumped back to empty would restart
			// with the same easing it is leaving with, which reads as a hitch on the turn.
			true,
		);
	}, [breath, breathing]);

	const overlay = useAnimatedStyle(() => ({ opacity: breath.value }));

	// Built unconditionally rather than only when `breathing`: the colours are ten
	// `mixOklab` calls, and gating them would mean the band changes identity when it is
	// toggled between animated and still.
	const rest = asStops(RAMP_WEIGHTS, color, backgroundColor);
	const inhaled = asStops(BREATH_WEIGHTS, color, backgroundColor);

	return (
		<View style={[styles.fluid, { height }]} pointerEvents="none">
			<LinearGradient
				colors={rest}
				locations={RAMP_LOCATIONS}
				style={StyleSheet.absoluteFill}
			/>
			{breathing ? (
				<Animated.View style={[StyleSheet.absoluteFill, overlay]}>
					<LinearGradient
						colors={inhaled}
						locations={RAMP_LOCATIONS}
						style={StyleSheet.absoluteFill}
					/>
				</Animated.View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	fluid: { width: "100%", overflow: "hidden" },
});
