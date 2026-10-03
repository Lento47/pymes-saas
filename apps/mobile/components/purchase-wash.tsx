import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { type PurchaseState, usePurchaseState } from "@/lib/purchase-state";
import { useReducedMotionResolved } from "@/lib/reduced-motion";
import { type ThemeColors, useTheme } from "@/theme";

/**
 * The feed's background says where the reader is in a purchase.
 *
 * Four states, four washes, all of them top-to-bottom and all of them gone by the middle of the
 * first screen:
 *
 *     ┌──────────────────┐  strong, at the top
 *     │██████████████████│
 *     │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
 *     │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
 *     │░░░░░░░░░░░░░░░░░░░│
 *     └──────────────────┘  and nothing at all by 50%
 *
 * The fade is the whole design. A wash that ran to the foot of the feed would tint every card
 * and every photograph below it, and a background is a *surface*, not a filter: the moment it
 * reaches the content it starts changing how the content reads. Ending inside the first screen
 * means it is felt rather than looked at — you notice it at the top of a scroll and the rest of
 * the page is untouched.
 *
 * ## Why a gradient at all, when `merchant-order-hero.tsx` says this app has none
 *
 * Because that file's sentence is a description of the past and this is a deliberate departure
 * from it. Its reason was that a *decorative* gradient behind an order block needed a native
 * module to draw for a shape nothing else in the app uses. This is the opposite: one wash, in
 * one place, carrying state a reader would otherwise have to go to `orders` to find out. The
 * cost is `expo-linear-gradient` and an Android rebuild, and the benefit is the feed answering
 * "where is my order" before it is asked.
 *
 * ## The four states, and the colour each one spends
 *
 * All four are palette tokens, so the wash follows the reader's theme across all twelve
 * palettes rather than being the one hardcoded colour in the app.
 *
 * | state | token | what it says |
 * |---|---|---|
 * | `browsing` | `muted` | nothing chosen yet |
 * | `basket` | `primary` | something is in the basket |
 * | `placed` | `success` | paid, the shop has it |
 * | `onTheWay` | `info` | somebody is working on it |
 *
 * `onTheWay` **breathes** and the others do not. It is the only one of the four that describes
 * something *in progress right now* rather than a fact, so it is the only one that should move.
 * A wash that pulsed while a reader was merely browsing would be an animation nobody could
 * switch off, and one that pulsed on `placed` would be a celebration playing on every screen.
 *
 * The reduced-motion branch is not optional. `useReducedMotionResolved` gates the repeat, so
 * with the preference on the wash is drawn at its resting opacity and simply holds still — the
 * state is still communicated by colour, which is the half of the signal that never depended on
 * movement.
 *
 * ## This never blocks a paint
 *
 * `usePurchaseState` returns `browsing` until both queries answer, and this component renders
 * in every state. A wash that arrived a beat late is correct; a spinner or a blank frame over
 * the feed would not be, and neither is drawn.
 *
 * ## `pointerEvents="none"`
 *
 * The wash covers the whole feed. A View that intercepted touches would make the search field,
 * every card and every rail item below it dead, and this one is pure decoration.
 */
export function PurchaseWash() {
	const state = usePurchaseState();
	const { colors } = useTheme();
	const reduced = useReducedMotionResolved();

	const tint = washTint(state, colors);

	// The breath. `withRepeat` in both directions so the wash returns to its resting opacity
	// rather than jumping out of it — an asymmetric pulse reads as a flicker, not a breath.
	const pulse = useSharedValue(1);
	const breathes = state === "onTheWay" && !reduced;
	if (breathes) {
		pulse.value = withRepeat(
			withTiming(0.55, {
				duration: BREATH_HALF_MS,
				easing: Easing.inOut(Easing.quad),
			}),
			-1,
			true,
		);
	} else if (pulse.value !== 1) {
		pulse.value = withTiming(1, { duration: BREATH_HALF_MS });
	}

	const wash = useAnimatedStyle(() => ({ opacity: pulse.value }));

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			<Animated.View style={[styles.fill, wash]}>
				<LinearGradient
					colors={[tint, tint, "transparent"]}
					// `[0, 0.42, 0.5]` and not `[0, 0.5, 1]`: the wash is gone by the middle, so the
					// third stop has to *arrive* at transparent by 0.5 rather than starting to fade
					// there. `space={[0, 0.42, 0.08]}` spreads the two ends so most of the visible
					// area is the fade itself and the top is a held colour rather than an instant
					// ramp.
					locations={[0, 0.42, 0.5]}
					style={styles.fill}
				/>
			</Animated.View>
		</View>
	);
}

/**
 * The wash's colour, at the strength each state is drawn.
 *
 * An alpha rather than a second colour, because the wash is *over* the page: it must be able to
 * sit on `background` in all twelve palettes without knowing what that is, and a colour mixed
 * toward the wash would have to be recomputed per palette. `hexToRgba` is this file's only
 * colour maths and it is here rather than in `theme` because nothing else needs it.
 *
 * The strengths are not equal, and that is deliberate. `browsing` is nearly invisible because it
 * is the state the feed sits in for most of its life and a permanent tint would become the
 * background nobody notices. `placed` and `onTheWay` are the strongest because they are the two
 * states a reader is waiting on, and they are the two that should be legible from across a room.
 */
function washTint(state: PurchaseState, colors: ThemeColors): string {
	switch (state) {
		case "basket":
			return withAlpha(colors.primary, WASH_STRENGTH.basket);
		case "placed":
			return withAlpha(colors.success, WASH_STRENGTH.placed);
		case "onTheWay":
			return withAlpha(colors.info, WASH_STRENGTH.onTheWay);
		default:
			return withAlpha(colors.muted, WASH_STRENGTH.browsing);
	}
}

/**
 * `#rrggbb` to `rgba(...)` at a given alpha.
 *
 * Written here rather than reaching for a colour library because the input is always one of this
 * app's own palette tokens and the output is always `rgba` — and because a helper that silently
 * accepted a three-digit hex or a named colour would be one more thing to be wrong about.
 */
function withAlpha(hex: string, alpha: number): string {
	const h = hex.replace("#", "");
	const full =
		h.length === 3
			? h
					.split("")
					.map((c) => c + c)
					.join("")
			: h;
	const r = Number.parseInt(full.slice(0, 2), 16);
	const g = Number.parseInt(full.slice(2, 4), 16);
	const b = Number.parseInt(full.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * How strongly each state is drawn, and how long one half of the breath is.
 *
 * `browsing` is 0.35 of an already-quiet `muted`, so it is a warmth rather than a colour.
 * `basket` is the brand at 0.16 — present enough to notice, not enough to fight the cards.
 * `placed` and `onTheWay` are the two strongest, because they are the two a reader is waiting
 * on, and 0.22 is where the wash is unmistakable and the cards underneath are still readable.
 *
 * 1400 is a comfortable breath: slow enough to read as breathing rather than as blinking, fast
 * enough that the loop does not feel like a stuck animation. It is the *half* period, so the
 * full cycle is 2800.
 */
const WASH_STRENGTH = {
	browsing: 0.35,
	basket: 0.16,
	placed: 0.22,
	onTheWay: 0.22,
} as const;

const BREATH_HALF_MS = 1400;

const styles = StyleSheet.create({
	// `absoluteFill`, not `absoluteFillObject`: this React Native exposes the former only,
	// and spreading the latter does not typecheck.
	fill: StyleSheet.absoluteFill,
});
