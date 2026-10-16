import { useCallback, useEffect, useState } from "react";
import {
	type AccessibilityProps,
	type Insets,
	Pressable as RNPressable,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { duration, PRESS_OPACITY, PRESS_SCALE, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { MIN_TOUCH_TARGET, radius, useTheme } from "@/theme";

/**
 * The one pressable in the app.
 *
 * Every control that answers a finger goes through here so that "did it register" is
 * answered the same way everywhere: a spring to `PRESS_SCALE` (or `PRESS_SCALE_ROW` for a
 * full-width row) and a soft wash covering the control's rounded outline. Labels keep
 * their opacity, and the highlight fades without a travelling circle or a second fill.
 *
 * ## Reduced motion
 *
 * The scale is a transform and every transform is off when the reader has asked for less
 * motion; the wash changes immediately and carries the feedback on its own.
 *
 * ## Why it owns opacity
 *
 * Controls opting out of the wash retain a subtle opacity response. It is animated here
 * so there is one answer to "how much does a press dim" instead of one per component. A
 * caller that sets its own `opacity` in `style` will fight this and lose unpredictably —
 * reach for `disabledOpacity` instead.
 *
 * ## `disabledOpacity` is for a *busy* control, not for an unavailable one
 *
 * The default is 0.5, and it is right for the case it was written for: a control that is
 * mid-write and whose mark is a glyph — `app/admin`'s refresh, `app/addresses`' delete. The
 * dim says "working", the shape survives it, and nothing has to be read.
 *
 * It is the wrong tool for a control that is **unavailable**, and every caller of that kind
 * has opted out of it. Fading a labelled control toward the page fades its *label* too:
 * 0.5 took a disabled primary button's own name to 2.10:1 in the light theme and 2.42:1 in
 * the dark one, which is a control whose reason for being off cannot be comfortably read —
 * on the control that exists to give that reason. WCAG exempts an inactive component from
 * 1.4.3, so this was never a violation; it was a bad state.
 *
 * The palette's own answer is `muted` for the surface and `mutedForeground` for its ink
 * (**6.03:1** light, **5.86:1** dark), which is the pair `./button`, `./option-card` and
 * `./quantity-stepper` now draw — each passing `disabledOpacity={1}` so this multiplier is
 * out of the way and the colour is the whole signal.
 *
 * ## The 44-point floor
 *
 * The base style carries `minHeight` and `minWidth` of `MIN_TOUCH_TARGET`, so a control
 * that is laid out normally is already large enough. One that is *drawn* small — a 32pt
 * icon button — widens its touch area with `hitSlopFor(32)`, which keeps the two readings
 * of "44" out of the call site. Both are floors rather than fixed sizes: at 200% text a
 * button grows, and it must be allowed to.
 */

type PressableProps = AccessibilityProps & {
	children?: React.ReactNode;
	onPress?: () => void;
	onLongPress?: () => void;
	onPressIn?: () => void;
	onPressOut?: () => void;
	disabled?: boolean;
	/**
	 * The scale the control springs to while held. Defaults to `PRESS_SCALE`; a full-width
	 * row passes `PRESS_SCALE_ROW`, because a row whose edges are the screen's edges looks
	 * like the screen itself shifted when it moves the full 3%.
	 */
	scaleTo?: number;
	/**
	 * Opacity at rest while `disabled`. Controls without a wash use `PRESS_OPACITY` on press.
	 *
	 * For a *busy* control. An unavailable one wants `muted`/`mutedForeground` and `1` here —
	 * see the docblock above before reaching for this.
	 */
	disabledOpacity?: number;
	/** Enable the shared press wash. Legacy name retained for existing opt-outs. */
	ripple?: boolean;
	/** Optional wash tint; the default is the theme's foreground at low opacity. */
	rippleColor?: string;
	hitSlop?: number | Insets;
	style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
};

/** What a caller's `style` callback is told, so a pressed colour can survive here. */
export type PressState = { pressed: boolean };

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/**
 * The touch margin to add around a control drawn at `drawnSize` to reach the 44pt floor.
 *
 * Half the shortfall on each side, because `hitSlop` is an inset rather than a total. A
 * control already at or above the floor gets zero — an inflated target on a full-width row
 * would overlap the row above it and steal its presses.
 */
export function hitSlopFor(drawnSize: number): number {
	return Math.max(0, Math.ceil((MIN_TOUCH_TARGET - drawnSize) / 2));
}

export function Pressable({
	children,
	onPress,
	onLongPress,
	onPressIn,
	onPressOut,
	disabled = false,
	scaleTo = PRESS_SCALE,
	disabledOpacity = 0.5,
	ripple = true,
	rippleColor,
	hitSlop,
	style,
	...a11y
}: PressableProps) {
	const { colors, scheme } = useTheme();
	const reduceMotion = useReducedMotion();
	const [pressed, setPressed] = useState(false);

	const scale = useSharedValue(0);
	const fade = useSharedValue(disabled ? disabledOpacity : 1);
	const highlight = useSharedValue(0);

	useEffect(() => {
		if (reduceMotion) scale.value = 0;
	}, [reduceMotion, scale]);

	const settle = useCallback(
		(to: 0 | 1) => {
			scale.value = reduceMotion ? 0 : withSpring(to, spring.press);
		},
		[reduceMotion, scale],
	);

	useEffect(() => {
		if (!disabled) return;
		// An async action can disable its control before press-out is delivered.
		setPressed(false);
		settle(0);
	}, [disabled, settle]);

	useEffect(() => {
		fade.value = withTiming(
			disabled ? disabledOpacity : pressed && !ripple ? PRESS_OPACITY : 1,
			{ duration: duration.instant },
		);
	}, [disabled, disabledOpacity, fade, pressed, ripple]);

	useEffect(() => {
		highlight.value = withTiming(pressed && !disabled && ripple ? 1 : 0, {
			duration: reduceMotion
				? 0
				: pressed
					? duration.instant / 2
					: duration.instant,
			easing: Easing.out(Easing.quad),
		});
	}, [disabled, highlight, pressed, reduceMotion, ripple]);
	const highlightStyle = useAnimatedStyle(() => ({
		opacity: highlight.value * (scheme === "dark" ? 0.07 : 0.05),
	}));

	const animated = useAnimatedStyle(() => ({
		opacity: fade.value,
		transform: [{ scale: 1 + (scaleTo - 1) * scale.value }],
	}));

	const handlePressIn = useCallback(() => {
		setPressed(true);
		settle(1);
		onPressIn?.();
	}, [onPressIn, settle]);

	const handlePressOut = useCallback(() => {
		setPressed(false);
		settle(0);
		onPressOut?.();
	}, [onPressOut, settle]);

	const resolved = typeof style === "function" ? style({ pressed }) : style;
	const flat = StyleSheet.flatten(resolved) ?? {};
	const { clip, radii } = pressOutline(flat);
	const wash = ripple ? (
		<Animated.View
			pointerEvents="none"
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[
				StyleSheet.absoluteFill,
				radii,
				{ backgroundColor: rippleColor ?? colors.foreground },
				styles.highlight,
				highlightStyle,
			]}
		/>
	) : null;

	const shared = {
		onPress,
		onLongPress,
		onPressIn: handlePressIn,
		onPressOut: handlePressOut,
		disabled,
		hitSlop,
		...a11y,
	};

	if (!hasShadow(flat)) {
		return (
			<AnimatedPressable
				{...shared}
				style={[styles.base, resolved, clip, animated]}
			>
				{children}
				{wash}
			</AnimatedPressable>
		);
	}

	// Lift lives on a wrapper so the inner clip cannot square it. iOS draws a
	// rectangular shadow for any layer whose overflow is hidden; Android's
	// elevation is the same square. The fill is copied onto the wrapper so the
	// shadow follows the rounded background rather than an empty rectangle.
	const { outer, inner } = splitPressStyle(flat);
	const fills =
		outer.flex != null ||
		outer.flexGrow != null ||
		outer.width != null ||
		outer.height != null;
	return (
		<View
			style={[
				outer,
				radii,
				flat.backgroundColor != null
					? { backgroundColor: flat.backgroundColor }
					: null,
			]}
		>
			<AnimatedPressable
				{...shared}
				style={[styles.base, inner, clip, fills ? styles.fill : null, animated]}
			>
				{children}
				{wash}
			</AnimatedPressable>
		</View>
	);
}

/**
 * The rounded outline the press wash has to match.
 *
 * Clip to the caller's corners, including rows with square bottom corners. The same
 * outline is applied to the overlay so a pill never flashes a rectangular highlight.
 */
function pressOutline(flat: ViewStyle): { clip: ViewStyle; radii: ViewStyle } {
	const radii: ViewStyle = {};
	const hasCorner =
		flat.borderTopLeftRadius != null ||
		flat.borderTopRightRadius != null ||
		flat.borderBottomLeftRadius != null ||
		flat.borderBottomRightRadius != null;
	if (flat.borderRadius != null) {
		radii.borderRadius = flat.borderRadius;
	} else if (!hasCorner) {
		radii.borderRadius = radius.sm;
	}
	if (flat.borderTopLeftRadius != null) {
		radii.borderTopLeftRadius = flat.borderTopLeftRadius;
	}
	if (flat.borderTopRightRadius != null) {
		radii.borderTopRightRadius = flat.borderTopRightRadius;
	}
	if (flat.borderBottomLeftRadius != null) {
		radii.borderBottomLeftRadius = flat.borderBottomLeftRadius;
	}
	if (flat.borderBottomRightRadius != null) {
		radii.borderBottomRightRadius = flat.borderBottomRightRadius;
	}
	return { radii, clip: { ...radii, overflow: "hidden" } };
}

function hasShadow(flat: ViewStyle): boolean {
	if (typeof flat.elevation === "number" && flat.elevation > 0) return true;
	if (typeof flat.shadowOpacity === "number" && flat.shadowOpacity > 0) {
		return true;
	}
	if (typeof flat.boxShadow === "string" && flat.boxShadow.length > 0) {
		return true;
	}
	return false;
}

const OUTER_KEYS = [
	"flex",
	"flexGrow",
	"flexShrink",
	"flexBasis",
	"alignSelf",
	"width",
	"height",
	"minWidth",
	"minHeight",
	"maxWidth",
	"maxHeight",
	"aspectRatio",
	"margin",
	"marginTop",
	"marginRight",
	"marginBottom",
	"marginLeft",
	"marginHorizontal",
	"marginVertical",
	"marginStart",
	"marginEnd",
	"position",
	"top",
	"right",
	"bottom",
	"left",
	"start",
	"end",
	"zIndex",
	"shadowColor",
	"shadowOffset",
	"shadowOpacity",
	"shadowRadius",
	"elevation",
	"boxShadow",
] as const;

function splitPressStyle(flat: ViewStyle): {
	outer: ViewStyle;
	inner: ViewStyle;
} {
	const outer: ViewStyle = {};
	const inner: ViewStyle = { ...flat };
	for (const key of OUTER_KEYS) {
		const value = inner[key];
		if (value === undefined) continue;
		(outer as Record<string, unknown>)[key] = value;
		if (
			key !== "minWidth" &&
			key !== "minHeight" &&
			key !== "maxWidth" &&
			key !== "maxHeight"
		) {
			delete inner[key];
		}
	}
	return { outer, inner };
}

const styles = StyleSheet.create({
	base: {
		minHeight: MIN_TOUCH_TARGET,
		minWidth: MIN_TOUCH_TARGET,
		backgroundColor: "transparent",
	},
	highlight: { zIndex: 1 },
	fill: { alignSelf: "stretch", flex: 1 },
});
