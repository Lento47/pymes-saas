import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { selection } from "@/lib/haptics";
import { duration } from "@/lib/motion";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * Two to five choices, side by side, where the set is small enough to show at once.
 *
 * This is the filter row a list needs (all / active / done), the fulfilment kind on checkout
 * (delivery / pickup) and the theme on account. It is *not* a `CategoryRail`: a rail scrolls
 * because the set is open-ended and it navigates because each chip is somewhere else to go,
 * while this is a closed set where choosing one changes the screen you are already on. The
 * difference that matters to a reader is that a rail's selection is a place and this one's is
 * a setting — which is why this one is a `radio` group and announces itself as one.
 *
 * Five is the ceiling and it was raised from four for `app/nearby.tsx`'s sort row, which is
 * the only group that reaches it. The reason four was the ceiling was width: at 200% Dynamic
 * Type, five long labels get about 44pt each and every one of them wraps. That is survivable
 * — this component grows the whole row rather than cutting a word (below) — but it is the
 * last segment that fits, and the sixth sort should be a picker rather than a sixth segment.
 *
 * ## The selection is not carried by the fill alone
 *
 * The chosen segment is filled, its label is heavier, and `accessibilityState.checked` says
 * so out loud. Three signals rather than one, because the fill is a luminance difference of
 * about one step in the light palette and that alone is not enough to read a state off. The
 * weight is the one that survives a colour-blind reader, a greyscale screenshot and a
 * monochrome printout.
 *
 * ## Why there is no sliding thumb
 *
 * The obvious build is one indicator that slides under the selection, and it needs the
 * measured width of every segment — a layout read on every text-scale change, in a component
 * that must not be off by a pixel when Dynamic Type is at 200%. Each segment crossfades its
 * own fill instead: identical to look at over `instant`, no measurement, and correct when a
 * label changes length in another language. A crossfade is also the half of motion that
 * survives reduced motion, so there is one code path rather than two.
 *
 * A haptic fires on settle, which is what `docs/design-mobile.md` reserves `selection` for.
 * It fires only when the value actually changes — a haptic on re-tapping the segment you are
 * already on is a nudge, and nudges are the thing that file rules out.
 *
 * ## The group grows a line; it does not cut a word
 *
 * A label wraps. Every segment used to carry a one-line cap, written here rather than at a
 * call site, so this was the one component deciding that every group in the app truncates —
 * and a segment's label is UI copy, the one thing `docs/design-mobile.md` says a line cap is
 * *not* for ("truncating data, never for saving a layout"). `checkout.fulfilment` is the
 * case: `checkout.delivery` is "Entrega a domicilio", nineteen characters at
 * `type.label.fontSize` 13 — 26pt at the 200% the Dynamic Type rule requires — in a
 * two-segment group where each segment gets half the screen less `space.md` per side. One
 * line cannot hold that, and the ellipsis would have landed on the words that *are* the
 * choice: "Retiro en el local" and "Entrega a domicilio" are two different jobs, and a
 * reader who cannot finish either is choosing between two incomplete sentences.
 *
 * The segment is a `minHeight: MIN_TOUCH_TARGET` floor rather than a fixed `height` for the
 * same reason, and it already was: the floor is what a target needs, the height is the
 * label's, and a group whose labels wrap grows taller — both segments with it, so the row
 * stays one row. That is why this is contained to this file: every call site keeps its own
 * labels, its own `Segmented`, and no override.
 */

type SegmentedOption = {
	value: string;
	label: string;
	/** A count after the label — an order count, a result count. Rendered `tabular`. */
	badge?: string;
};

type SegmentedProps = {
	options: SegmentedOption[];
	value: string;
	onChange: (value: string) => void;
	/** Required: the group's name for a screen reader — "Filter orders", "Delivery kind". */
	label: string;
	disabled?: boolean;
};

export function Segmented({
	options,
	value,
	onChange,
	label,
	disabled = false,
}: SegmentedProps) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.group,
				{ backgroundColor: colors.muted, borderColor: colors.border },
			]}
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
		>
			{options.map((option) => (
				<Segment
					key={option.value}
					option={option}
					selected={option.value === value}
					disabled={disabled}
					onSelect={() => {
						// Guarded here rather than in every caller: the check is what keeps the
						// haptic meaning "your choice changed" instead of "you touched the control".
						if (option.value === value) return;
						selection();
						onChange(option.value);
					}}
				/>
			))}
		</View>
	);
}

function Segment({
	option,
	selected,
	disabled,
	onSelect,
}: {
	option: SegmentedOption;
	selected: boolean;
	disabled: boolean;
	onSelect: () => void;
}) {
	const { colors } = useTheme();
	const fill = useSharedValue(selected ? 1 : 0);

	useEffect(() => {
		fill.value = withTiming(selected ? 1 : 0, { duration: duration.instant });
	}, [fill, selected]);

	const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

	return (
		<Pressable
			onPress={onSelect}
			accessibilityRole="radio"
			disabled={disabled}
			accessibilityLabel={
				option.badge ? `${option.label}, ${option.badge}` : option.label
			}
			accessibilityState={{ checked: selected, disabled }}
			// The segment's own spring is off: the whole group is one control and a segment
			// that scales inside it looks like the group came apart. The fill is the feedback.
			scaleTo={1}
			style={styles.segment}
		>
			{/* Absolute and `pointerEvents="none"` so it is a layer under the label rather than
			    a sibling that shifts it — the label's position must not depend on selection. */}
			<Animated.View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: colors.card },
					fillStyle,
				]}
			/>
			<Text
				variant="label"
				bold={selected}
				tone={selected ? "default" : "muted"}
				style={styles.label}
			>
				{option.label}
			</Text>
			{option.badge ? (
				<Text variant="caption" tone={selected ? "default" : "muted"} tabular>
					{option.badge}
				</Text>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	label: { flexShrink: 1, textAlign: "center" },
	group: {
		flexDirection: "row",
		borderRadius: radius.sm,
		borderWidth: 1,
		// The selected fill would otherwise square off the group's corners.
		overflow: "hidden",
	},
	segment: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
	},
});
