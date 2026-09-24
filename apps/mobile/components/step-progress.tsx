import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { duration } from "@/lib/motion";
import { radius, space, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * How far into a flow the customer is, and how much is left.
 *
 * `docs/design-mobile.md` puts the goal gradient on this and on the order timeline, and
 * adds the rule that makes it honest: **every step shown is one that actually happens.**
 * So the count is not decoration — the caller passes the number of real steps its flow has,
 * and a flow that grows a step has to grow this with it. A three-segment bar over a
 * two-step form is a promise the form does not keep.
 *
 * The name of the current step is beside the bar and not only inside it, because a bar
 * tells a reader that they are somewhere in the middle and never tells them where. The
 * word is the step's own heading, translated at the call site, so the bar and the heading
 * below it cannot disagree.
 *
 * ## The count for a screen reader, without inventing a sentence in either language
 *
 * The bar is one node with `accessibilityRole="progressbar"` and a `min`/`max`/`now` value.
 * The platforms read that in the device's own language — "2 de 3", "2 of 3" — which is the
 * whole indicator, correctly translated by the only thing that knows how. A Spanish
 * sentence baked in here would read "Paso 2 de 3" to a phone set to English, and the
 * dictionary is in `packages/i18n`, outside this app. The `step / total` beside the name
 * is numerals and a separator: it has no language to get wrong.
 *
 * ## What moves, and what that movement is for
 *
 * A completed segment fills, and the fill is the one animation here: `duration.standard`
 * (180ms), which `lib/motion` names for "a colour settling". Nothing travels, nothing
 * springs and nothing is a transform — so there is **one code path, with no reduced-motion
 * branch**, because the animation is a pure crossfade and a crossfade is the half of motion
 * `docs/design-mobile.md` keeps when the reader asks for less of it ("opacity … still
 * answers 'did it register'"). It is `./segmented`'s fill, in the same two layers and for
 * the same reason: the bar must not measure its segments to animate one, and a colour that
 * snaps from `border` to `primary` between two frames is a progress bar that jumps.
 *
 * The label and the count do not move at all. A goal gradient is the fill advancing toward
 * a word that is already there; animating the word would be motion for its own sake.
 */
export function StepProgress({
	step,
	total,
	label,
}: {
	/** 1-based: the step the customer is on. */
	step: number;
	total: number;
	/** The current step's own name, already translated. */
	label: string;
}) {
	const { colors } = useTheme();

	return (
		<View style={styles.wrap}>
			<View
				style={styles.bars}
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel={label}
				accessibilityValue={{ min: 1, max: total, now: step }}
			>
				{Array.from({ length: total }, (_, index) => (
					<Segment
						// biome-ignore lint/suspicious/noArrayIndexKey: the segment's position *is* its identity. There is no item here and nothing to reorder — segment three is the third step of the flow, forever, and a key derived from anything else would be a fact about the step dressed up as the segment's name.
						key={index}
						filled={index < step}
						border={colors.border}
						primary={colors.primary}
					/>
				))}
			</View>
			<View style={styles.head}>
				<Text variant="label" bold>
					{label}
				</Text>
				<Text variant="label" tone="muted" tabular>
					{`${step} / ${total}`}
				</Text>
			</View>
		</View>
	);
}

/**
 * One segment, filling over `duration.standard`.
 *
 * Two layers and a crossfade rather than an animated `backgroundColor`, and the reason is
 * `./segmented`'s: a colour is not a value reanimated interpolates cleanly across themes,
 * while an opacity between two painted layers is — and it is the same one code path that
 * survives reduced motion. The overlay is `pointerEvents="none"` and absolute, so the
 * label's position and the bar's hit box never depend on which step the customer is on.
 */
function Segment({
	filled,
	border,
	primary,
}: {
	filled: boolean;
	border: string;
	primary: string;
}) {
	const fill = useSharedValue(filled ? 1 : 0);

	useEffect(() => {
		fill.value = withTiming(filled ? 1 : 0, { duration: duration.standard });
	}, [fill, filled]);

	const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

	return (
		<View style={[styles.bar, { backgroundColor: border }]}>
			<Animated.View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: primary },
					// The fill is a pill inside a pill: without the corner the overlay would
					// square off the bar's own `radius.full` at the ends of the flow.
					{ borderRadius: radius.full },
					fillStyle,
				]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: space.sm },
	bars: { flexDirection: "row", gap: space.xs },
	bar: {
		flex: 1,
		height: space.xs,
		borderRadius: radius.full,
		// The overlay is clipped to the pill rather than allowed to square it off — the same
		// reason `./segmented` clips its own group.
		overflow: "hidden",
	},
	head: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.sm,
	},
});
