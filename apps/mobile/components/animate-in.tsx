import { useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
	Easing,
	LinearTransition,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";

import { duration, ENTER_RISE, spring, staggerDelay } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";

/**
 * The reorder transition, built from the vocabulary rather than from numbers typed here.
 *
 * `docs/design-mobile.md` gives layout and reorder the spring between the press and the
 * sheet — damping 20, stiffness 200 — because a row closing a gap is bigger than a button
 * and smaller than a screen. `LinearTransition` is the transition that carries a view from
 * where it was to where it now is, and `.springify()` is what makes it interruptible: a
 * second line removed while the first is still settling turns the row around from where it
 * actually is, which is the whole reason the vocabulary is springs for anything a finger
 * owns — and a reorder is owned by the thumb that removed the line above it.
 *
 * It is a transition and not an `entering`/`exiting` pair because nothing arrives or
 * leaves: the row was already on screen and it is still on screen, one gap closer. The two
 * numbers stay in `lib/motion.ts`, which does not import reanimated on purpose, so they
 * feed the fallback path in `./pressable` from the same place.
 */
const LAYOUT = LinearTransition.springify()
	.damping(spring.layout.damping)
	.stiffness(spring.layout.stiffness);

/**
 * A block arriving: it rises `ENTER_RISE` points and fades in over `entering`.
 *
 * The staggering lives here rather than at the call site, because the rule has an end to
 * it: item `index` waits `staggerDelay(index)` — 40ms apart, and after the sixth they all
 * go together. A twenty-item list that animates for 800ms is a list that is late, and the
 * stagger has already done its job by the sixth item, which is telling the reader "this is
 * a group, and it just arrived".
 *
 * `style` is layout and belongs to the caller, exactly as it does on any other primitive:
 * this wrapper is one extra view, so a card that needs `flex: 1` inside a row passes it.
 *
 * ## Reduced motion
 *
 * The rise goes and the stagger goes with it — a stagger is movement spread over time, and
 * six items that arrive together are not a worse answer than six that arrive in sequence.
 * The fade stays, shortened to `instant`: it is opacity, and opacity is the half of every
 * transition that keeps answering "did it register" when the transforms are gone.
 *
 * The state change is unconditional. The content is on screen either way; only how it gets
 * there differs, which is the rule for everything in this app.
 *
 * ## Reordering, and why it is one prop and not two
 *
 * A block in a list can do a second thing: *move*, because the list around it changed — a
 * cart line removed, a receipt that grows a discount row, a step that fills. `reorder` is
 * that block, and it sets two things that are the same fact about the list it is in:
 *
 * - the layout transition above, so the movement is animated rather than a jump;
 * - a **mount** entrance. `index` is in the effect's deps above because a recycled list row
 *   is a new item and has to enter as one; in a list that changes under the reader, a row
 *   whose position merely shifted is the *same* row, and re-running the fade for it is every
 *   line below a removal blinking. So the position still drives the stagger of the arrival
 *   and nothing after it.
 *
 * It is opt-in because a layout animation is not free: reanimated keeps the view's previous
 * frame and re-measures it on every layout pass, and a list that cannot change — a placed
 * order's items, a feed — has no reorder to spend that on.
 *
 * Under reduced motion there is no transition at all, not a faster one: reanimated moves the
 * view with nothing when it is handed nothing. A reorder is a transform over time, which is
 * the half of every transition the setting turns off, and the row lands in its new place
 * either way — the layout is the layout.
 */

export function AnimateIn({
	index = 0,
	reorder = false,
	children,
	style,
}: {
	/** Position in the group. Drives the stagger and nothing else. */
	index?: number;
	/**
	 * This block is in a list that can change under the reader — a line that can be removed,
	 * a receipt that gains a row, a step that fills. It takes the layout transition and a
	 * mount-only entrance; see "Reordering" above.
	 */
	reorder?: boolean;
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	const reduceMotion = useReducedMotion();
	const enter = useSharedValue(0);
	// Read only when `reorder` is set, which is the case where the entrance belongs to the
	// mount rather than to the position. See "Reordering" above.
	const entered = useRef(false);
	const previousIndex = useRef(index);

	useEffect(() => {
		// Changing an OS preference must not replay content that has already arrived.
		if (entered.current && (reorder || previousIndex.current === index)) {
			if (reduceMotion) enter.value = 1;
			return;
		}
		previousIndex.current = index;
		entered.current = true;
		// `enter` is reset before the animation because a list row can be recycled onto a
		// new item, and a shared value left at 1 would show the next one without an entrance.
		enter.value = 0;
		enter.value = withDelay(
			reduceMotion ? 0 : staggerDelay(index),
			withTiming(1, {
				duration: reduceMotion ? duration.instant : duration.entering,
				easing: Easing.out(Easing.cubic),
			}),
		);
	}, [enter, index, reduceMotion, reorder]);

	const animated = useAnimatedStyle(() => {
		if (reduceMotion) return { opacity: enter.value };
		return {
			opacity: enter.value,
			transform: [{ translateY: ENTER_RISE * (1 - enter.value) }],
		};
	});

	return (
		<Animated.View
			layout={reorder && !reduceMotion ? LAYOUT : undefined}
			style={[animated, style]}
		>
			{children}
		</Animated.View>
	);
}
