import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ScrollView,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import {
	runOnJS,
	type SharedValue,
	useAnimatedReaction,
	useSharedValue,
} from "react-native-reanimated";

import { selection } from "@/lib/haptics";
import { duration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The storefront's sticky group rail: it says which part of the menu is under the reader, and
 * takes them to another part in one tap.
 *
 * `docs/design-mobile.md`'s Rule 4 is the job: a menu of fifty products in one column is the
 * clearest tell of a prototype, so products group by category, groups are headed, and the
 * storefront carries a rail of those groups that follows the scroll and jumps on tap. This is
 * that rail. It is a *sibling* of `./category-rail`, not a second dialect: the same chip
 * shape, the same `./pressable` spring and Android ripple, the same `accessibilityRole`
 * + `accessibilityState` treatment, and no haptic for the navigation it *is*. The difference
 * is one word — a category chip opens a page, a group chip moves the page under the reader —
 * and that difference is why this one fires `selection()` (see below).
 *
 * ## It follows the scroll on the UI thread, and that is why the caller passes a shared value
 *
 * The rail highlights the last group whose heading has passed under it. Reading that from a
 * `contentOffset` in React state would re-render every chip on every frame of every scroll —
 * up to sixty times a second for a control whose answer changes perhaps four times a page —
 * so the offset arrives as a `SharedValue<number>`, the comparison runs in a worklet, and
 * `runOnJS` crosses back only when the *answer* changes. That is the same reason
 * `./animate-in` reads `useReducedMotion` inside its worklet: the work is on the animation
 * thread because that is where the values are.
 *
 * The caller owns the `ScrollView` and writes the value from `useAnimatedScrollHandler`; this
 * component renders the rail and never reaches into a parent's scroll. Two lines at the call
 * site, named in the handover.
 *
 * ## "Has passed under it" is measured, not guessed
 *
 * `offsets` is `{ [group key]: y }` as the caller measured it with `onLayout` in the scroll's
 * content — no measuring library, no dependency. The reading line is the rail's **own height**,
 * measured the same way: a heading is under the rail, and so belongs to what the reader is
 * looking at, exactly when `scrollY >= y - railHeight`. A hardcoded allowance would be wrong
 * the first time somebody runs the app at 200% text, because the rail grows with its labels.
 *
 * ## The tap answers immediately, and the highlight is not stolen back
 *
 * A tap sets the highlighted chip at once and suppresses the scroll reaction until the
 * programmatic scroll lands (within `JUMP_TOLERANCE` of its target, or `duration.sheet` at the
 * outside — the longest move the vocabulary allows). Without that, tapping "Postres" from the
 * top of a long menu runs the highlight through every group on the way down, which reads as
 * the rail disagreeing with the finger that just pressed it.
 *
 * ## Reduced motion
 *
 * The jump is handed to the caller as `onJump(y, animated)` with `animated` already decided
 * here, so a screen cannot forget the setting: under reduced motion it is `false` and the page
 * arrives without travelling. Nothing else in this component moves — the highlight is a fill,
 * not a slide — so the setting changes exactly one thing.
 *
 * ## The haptic
 *
 * `selection()` on tap, and nowhere else. This is a picker settling on a value, which is what
 * `lib/haptics` names that haptic for, and it is *not* navigation — `./category-rail` fires
 * nothing because its chips open pages, and a rail that buzzed on every scroll-driven
 * highlight change would be a haptic on scroll, which is forbidden outright. A phone on silent
 * loses nothing: the fill and the state change are already there.
 */

/** One group in the rail. The label is already a word — this component holds no keys. */
export type StoreNavGroup = { key: string; label: string };

/**
 * How close the offset must get to a jump's target before the scroll reaction is let go again.
 *
 * A point of slack for the last event of a platform-driven scroll, which lands on the target
 * exactly; anything wider would release the suppression while the page was still travelling.
 */
const JUMP_TOLERANCE = 1;

export function StoreNav({
	groups,
	offsets,
	scrollY,
	onJump,
	style,
}: {
	/** The sections, in the order they appear in the page — that order is the rail's order. */
	groups: readonly StoreNavGroup[];
	/**
	 * Where each group's heading sits, in the scroll content's own coordinates, as the caller
	 * measured it with `onLayout`. A group that has not been measured yet simply cannot be
	 * reached by scrolling; it becomes reachable on the next render.
	 */
	offsets: Readonly<Record<string, number>>;
	/** The caller's `ScrollView` offset, written by `useAnimatedScrollHandler`. */
	scrollY: SharedValue<number>;
	/**
	 * Move the page there. `animated` is decided by this component and already respects
	 * reduced motion — a screen must not re-decide it.
	 */
	onJump: (y: number, animated: boolean) => void;
	/** Layout, and only layout. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const reduceMotion = useReducedMotion();

	const [activeIndex, setActiveIndex] = useState(0);
	const active = useSharedValue(0);
	/**
	 * The group a tap is travelling to, or `-1` when no jump is in flight. The reaction reads
	 * it to know it must keep its hands off the highlight.
	 */
	const jumping = useSharedValue(-1);
	/** The rail's own height, which is the distance a heading has to clear to be under it. */
	const railHeight = useSharedValue(0);
	const release = useRef<ReturnType<typeof setTimeout> | null>(null);

	const ys = useMemo(
		() => groups.map((group) => offsets[group.key] ?? Number.POSITIVE_INFINITY),
		[groups, offsets],
	);

	useAnimatedReaction(
		() => scrollY.value,
		(y) => {
			// A jump is in flight: the highlight belongs to the finger that started it until the
			// page lands. See "The tap answers immediately" above.
			if (jumping.value >= 0) {
				if (Math.abs(y - (ys[jumping.value] ?? 0)) <= JUMP_TOLERANCE) {
					jumping.value = -1;
				}
				return;
			}

			let next = 0;
			for (let index = 0; index < ys.length; index += 1) {
				if (y >= (ys[index] ?? 0) - railHeight.value) next = index;
				else break;
			}

			if (next !== active.value) {
				active.value = next;
				runOnJS(setActiveIndex)(next);
			}
		},
	);

	useEffect(
		() => () => {
			if (release.current !== null) clearTimeout(release.current);
		},
		[],
	);

	const jumpTo = useCallback(
		(index: number) => {
			jumping.value = index;
			active.value = index;
			setActiveIndex(index);
			selection();
			// The release is the safety net for the case the tolerance cannot catch: a target the
			// page cannot actually reach — the last group on a menu whose tail is shorter than
			// the viewport — never brings the offset close enough, and without the timer the rail
			// would sit frozen on that chip for the rest of the screen's life.
			if (release.current !== null) clearTimeout(release.current);
			release.current = setTimeout(() => {
				jumping.value = -1;
			}, duration.sheet);
			onJump(ys[index] ?? 0, !reduceMotion);
		},
		[active, jumping, onJump, reduceMotion, ys],
	);

	useEffect(() => {
		if (!reduceMotion || jumping.value < 0) return;
		const target = ys[jumping.value];
		if (target !== undefined && Number.isFinite(target)) onJump(target, false);
		jumping.value = -1;
		if (release.current !== null) clearTimeout(release.current);
	}, [jumping, onJump, reduceMotion, ys]);

	// A rail of one chip is a chip that goes where the reader already is — `./category-rail`
	// gives the same reason for hiding its "Todo" chip when there is no destination.
	if (groups.length < 2) return null;

	return (
		<View
			// The two colours are here and not in `styles.rail` because a static `StyleSheet`
			// cannot read the theme, and a `borderBottomWidth` with no colour does not draw
			// nothing — it draws React Native's default border, which is opaque black. The
			// width stays in the sheet below; see its docblock.
			style={[
				styles.rail,
				{
					backgroundColor: colors.background,
					borderBottomColor: colors.border,
				},
				style,
			]}
			// The rail's own height is the reading line. Measured rather than assumed, because a
			// chip grows with the reader's text size.
			onLayout={(event) => {
				railHeight.value = event.nativeEvent.layout.height;
			}}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.content}
			>
				{groups.map((group, index) => (
					<Chip
						key={group.key}
						label={group.label}
						selected={index === activeIndex}
						onPress={() => jumpTo(index)}
					/>
				))}
			</ScrollView>
		</View>
	);
}

/**
 * One chip, drawn and announced exactly as `./category-rail` draws and announces its own.
 *
 * It is duplicated rather than exported from that file because the two are one prop apart and
 * a shared `Chip` would need a mode flag — the rail's chip navigates and says `selected`, this
 * one is a position marker inside a page. Same tokens, same `MIN_TOUCH_TARGET` floor, same
 * selection-as-state: a reader who has learned one rail has learned both.
 */
function Chip({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			// The position reaches the accessibility tree as a state, not only as a fill.
			accessibilityState={selected ? { selected: true } : undefined}
			style={({ pressed }) => [
				styles.chip,
				{
					// A pressed *active* chip keeps its fill: dimming it towards `accent` reads as
					// the position being given up on the way out. The spring and the opacity step
					// `./pressable` owns are the feedback there.
					backgroundColor: selected
						? colors.primary
						: pressed
							? colors.accent
							: colors.card,
					borderColor: selected ? colors.primary : colors.border,
				},
			]}
		>
			<Text variant="label" tone={selected ? "inverse" : "default"}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	/**
	 * The rail is sticky over a scrolling page, so it pays a background of its own and the
	 * hairline every other divided surface in this app uses (`./list-row`, `./product-row`) —
	 * content sliding under a transparent band reads as a rendering fault rather than as a
	 * header. The hairline is `StyleSheet.hairlineWidth`, which is the one-width that lands as
	 * a single physical pixel on each platform's density.
	 *
	 * The width is here and the *colour* is at the render, which is the same split
	 * `./list-row` and `./product-row` use and the reason is the same: this object is built
	 * once at module load and cannot see `colors`. The colour used to be missing entirely,
	 * and a missing border colour is not an absent border — it is the platform's default one,
	 * which is black on both natives. That drew a hard dark rule across the top of every
	 * storefront's menu in the light theme and a line that disappeared into the ground in the
	 * dark one, on the two surfaces this docblock names as its models.
	 */
	rail: {
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	content: {
		paddingHorizontal: space.lg,
		paddingVertical: space.sm,
		gap: space.sm,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
		paddingHorizontal: space.md,
		borderRadius: radius.full,
		borderWidth: 1,
	},
});
