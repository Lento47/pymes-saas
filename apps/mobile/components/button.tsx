import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { StyleSheet, type TextStyle, View, type ViewStyle } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { duration, STATE_POP, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	type ThemeColors,
	type,
	useTheme,
} from "@/theme";

import { Pressable } from "./pressable";
import { Spinner } from "./spinner";
import { Text } from "./text";

/**
 * The one button in the app.
 *
 * The press feedback — the spring to `PRESS_SCALE`, the dim, and Android's ripple — comes
 * from `./pressable`, so a button and a row answer a thumb the same way. The button adds
 * the colour: pressed is the *pressed* colour of the same variant rather than a hardcoded
 * overlay, so the feedback survives a palette change.
 *
 * The minimum height is `MIN_TOUCH_TARGET` and it is a floor rather than a wish. The small
 * size exists for a control beside a row of text, and it is still 44 points *tall* with
 * reduced horizontal padding — the target shrinks sideways, never vertically, and at 200%
 * text the height grows with the label.
 *
 * ## An action and a choice are not the same control
 *
 * `selected` makes the button one of a *set* rather than a pair of *actions*: the role becomes
 * `radio` (or `checkbox`, via `choiceRole`) and the state is announced, so a reader is told which
 * option is on instead of hearing "Recoger, botón. Entrega, botón" and being left to guess.
 * `./pressable` is the primitive that
 * takes a state; a button that set its own `accessibilityState` for busy and disabled and had
 * no room for `checked` is why `app/account.tsx`'s language picker had to be built by
 * hand rather than placed, and `selected` is that gap closed instead of worked around again.
 *
 * The tick is the visible half of the same answer, and it is on the *chosen* one, so the
 * choice survives a colour vision deficiency and a greyscale screenshot — a fill is not a
 * status. It is hidden from the accessibility tree because the radio's own state already said
 * it, and an image read after "selected" says the same thing a second time. It replaces
 * `icon` rather than joining it: a choice is a word and a tick, not a word, a tick and a
 * glyph.
 *
 * ## The tick lands with a pop
 *
 * A tick arriving is a state change, and `lib/motion` reserves `STATE_POP` → `spring.press`
 * for exactly that — the same movement `./favorite-button` gives the heart that just filled.
 * The first render is skipped (a group of options mounts together and would twitch as one),
 * and reduced motion leaves the tick at rest: it still appears, which is the state itself,
 * and the pop is only the echo. Only the appear direction pops — deselect unmounts the tick,
 * so there is nothing on screen to animate out.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export const BUTTON_BORDER_WIDTH = 1;

/**
 * `lg` is the screen's one decision — the CTA in an `ActionBar` — and `sm` is a control
 * beside a row of text. All three are `MIN_TOUCH_TARGET` tall or taller; the horizontal
 * padding and the vertical breathing room are what change.
 */
export type ButtonSize = "lg" | "md" | "sm";

/**
 * `rounded` is the control's own corner (`radius.sm`), `pill` is `radius.full`.
 *
 * A shape and not a radius prop, because a caller passing a number here is a caller making
 * a design decision at a call site, and the palette's four steps are the whole vocabulary.
 * Pill exists because a bottom action bar and a "Place order" button are read as *the*
 * control of the screen, and the shape is what says so before the label is read.
 */
export type ButtonShape = "rounded" | "pill";

type ButtonProps = {
	label: string;
	onPress: () => void;
	variant?: ButtonVariant;
	size?: ButtonSize;
	shape?: ButtonShape;
	disabled?: boolean;
	/** Shows a spinner in place of the label. The label stays for the screen reader. */
	loading?: boolean;
	/** Leading node — an icon, usually. `@expo/vector-icons` at `label` size and current colour. */
	icon?: React.ReactNode;
	fullWidth?: boolean;
	accessibilityHint?: string;
	/**
	 * One option out of several: a fulfilment kind, a payment method, a saved address. Omit
	 * for an action — the two are different roles and the difference is announced. The caller
	 * still picks the variant, so `primary`/`secondary` keep meaning what they mean here.
	 */
	selected?: boolean;
	/**
	 * Which kind of choice `selected` is describing: one-of-a-set (`radio`, the default) or
	 * any-number-of-them (`checkbox`).
	 *
	 * Read only when `selected` is given. It exists because not every option group picks one —
	 * a product's `MULTI` group takes as many as the customer wants, and announcing `radio`
	 * there tells a screen reader the opposite of the rule it is under. A radio is a promise
	 * that choosing this unchooses the last one; a group where that is false has to say so.
	 */
	choiceRole?: "radio" | "checkbox";
	style?: ViewStyle;
};

const SURFACES: Record<ButtonVariant, keyof ThemeColors> = {
	primary: "primary",
	secondary: "secondary",
	ghost: "card",
	destructive: "destructive",
};

const INKS: Record<ButtonVariant, keyof ThemeColors> = {
	primary: "primaryForeground",
	secondary: "secondaryForeground",
	ghost: "foreground",
	destructive: "destructiveForeground",
};

/**
 * The tick's drawn size, read from the token at module scope.
 *
 * A constant rather than `icon.control` down in the render, because the prop named `icon`
 * shadows the token inside the component — one word for two things, and the one in scope there
 * is a `ReactNode`. The number is the token either way; this is simply where it can be read.
 */
const TICK_SIZE = icon.control;

export function Button({
	label,
	onPress,
	variant = "primary",
	size = "md",
	shape = "rounded",
	disabled = false,
	loading = false,
	icon,
	fullWidth = false,
	accessibilityHint,
	selected,
	choiceRole = "radio",
	style,
}: ButtonProps) {
	const { colors } = useTheme();
	const inert = disabled || loading;
	const choice = selected !== undefined;

	/**
	 * The tick's pop, exactly `./favorite-button`'s: a `shown` ref seeded with the value the
	 * button mounted at so the first render is not a change, then `STATE_POP` → `spring.press`
	 * on the false→true transition only. The magnitudes are `lib/motion`'s and none is typed
	 * here; see the docblock's "The tick lands with a pop" for why reduced motion and the
	 * deselect direction are left alone.
	 */
	const scale = useSharedValue(1);
	const reduceMotion = useReducedMotion();
	const shown = useRef(selected);

	useEffect(() => {
		if (!choice) return;
		if (reduceMotion) {
			shown.current = selected;
			cancelAnimation(scale);
			scale.value = 1;
			return;
		}
		if (shown.current === selected) return;
		shown.current = selected;
		if (selected !== true) {
			// Deselect unmounts the tick — nothing is on screen to animate out — so the value
			// only returns to rest, ready for the next selection to pop from.
			cancelAnimation(scale);
			scale.value = 1;
			return;
		}
		scale.value = withSequence(
			withTiming(STATE_POP, { duration: duration.instant }),
			withSpring(1, spring.press),
		);
	}, [choice, reduceMotion, scale, selected]);

	const tickPop = useAnimatedStyle(() => ({
		transform: [{ scale: reduceMotion ? 1 : scale.value }],
	}));

	/*
	 * The two inert states are not one state, and drawing them with one mechanism is what this
	 * used to do: `disabledOpacity={0.5}` faded the fill *and* the label toward the page, so a
	 * disabled primary button's own name measured **2.10:1** in the light theme and **2.42:1**
	 * in the dark one. (WCAG exempts an inactive component from 1.4.3, so that was not a
	 * violation — it was a button whose label a customer has to work to read, on a control that
	 * exists to explain why it is off.)
	 *
	 * So the two are separated, and each gets the treatment its meaning deserves:
	 *
	 * - **`loading`** — the button is doing the thing it says. It keeps its colour, and the
	 *   spinner is the state; `accessibilityState.busy` is what announces it.
	 * - **`disabled`** — the button is not taking input. `muted` is the palette's own word for
	 *   that surface (`./skeleton` says the same), and `mutedForeground` on it is **6.03:1**
	 *   light and **5.86:1** dark. The label is *more* readable than the resting state of some
	 *   variants, which is the point: the reason is the part that has to be read.
	 *
	 * `disabledOpacity` is raised to 1 for both, because the colour is now the whole signal and
	 * a second dimmer on top of it would be the same defect at a smaller size.
	 */
	const unavailable = disabled && !loading;
	const surface = unavailable ? colors.muted : colors[SURFACES[variant]];
	const ink = unavailable ? colors.mutedForeground : colors[INKS[variant]];

	return (
		<Pressable
			onPress={onPress}
			disabled={inert}
			disabledOpacity={1}
			accessibilityRole={choice ? choiceRole : "button"}
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			// The disabled state has to reach the accessibility tree. `Pressable` does not
			// derive it from `disabled` for a screen reader on every platform, and a button
			// that reads as tappable but does nothing is worse than one that says it is off.
			// `checked` rides in the same object as the other two rather than in one of its
			// own: an option can be unchosen *and* disabled, and the reader has to hear both.
			accessibilityState={
				choice
					? { disabled: inert, busy: loading, checked: selected }
					: { disabled: inert, busy: loading }
			}
			style={[
				styles.base,
				size === "sm" ? styles.sm : size === "lg" ? styles.lg : styles.md,
				// After the size, so it wins over `base`'s radius. `Pressable` clips its ripple
				// to whatever radius it is given, so the ripple follows the pill without the
				// bar having to say anything.
				shape === "pill" && styles.pill,
				fullWidth && styles.fullWidth,
				{
					backgroundColor: surface,
					// A ghost button's outline goes with it: an unavailable control that keeps the
					// resting hairline is a control that still looks pressable.
					borderColor:
						variant === "ghost" && !unavailable ? colors.border : "transparent",
				},
				style,
			]}
		>
			{loading ? (
				// The label's own line box, so the busy state is exactly the height of the state it
				// replaces. `./spinner`'s unlabelled variant carries no floor of its own, and the
				// indicator is shorter than a `heading` line - without this the button would shrink
				// by the few points between them, which is the same jump in the other direction.
				<View style={styles.content}>
					<Spinner color={ink} />
				</View>
			) : (
				<View style={styles.content}>
					{selected ? (
						<Animated.View style={tickPop}>
							<Ionicons
								name="checkmark"
								size={TICK_SIZE}
								color={ink}
								// The radio's state is announced; an image read after it would say the
								// same thing a second time. See the note at the top of this file.
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</Animated.View>
					) : (
						icon
					)}
					<Text variant="heading" bold style={{ color: ink } as TextStyle}>
						{label}
					</Text>
				</View>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.sm,
		borderWidth: BUTTON_BORDER_WIDTH,
		alignItems: "center",
		justifyContent: "center",
	},
	md: { paddingHorizontal: space.xl, paddingVertical: space.md },
	// Still `MIN_TOUCH_TARGET` tall — the horizontal padding is what shrinks.
	sm: { paddingHorizontal: space.lg, paddingVertical: space.sm },
	// The screen's CTA: 58 tall, which is `space.lg` twice plus the heading's line height
	// and both border widths.
	// Taller than the 44pt floor on purpose — the floor is the minimum for a control that is
	// one of several, and this one is the only one.
	lg: { paddingHorizontal: space.xxl, paddingVertical: space.lg },
	pill: { borderRadius: radius.full },
	fullWidth: { alignSelf: "stretch" },
	content: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		minHeight: type.heading.lineHeight,
	},
});
