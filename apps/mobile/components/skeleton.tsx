import { useCallback, useEffect, useRef, useState } from "react";
import {
	type LayoutChangeEvent,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

import { SKELETON_MIN_HOLD, SKELETON_SWEEP } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { radius, type, useTheme } from "@/theme";

/**
 * Waiting, when the shape of the answer is already known.
 *
 * A product list, a business page, an order detail: the layout exists before the data
 * does, so the layout is what gets drawn — in `muted`, the same colour a disabled surface
 * uses, with a band sweeping across it every 1200ms. A spinner is for the two cases where
 * the shape genuinely is unknown (a sign-in round trip and a payment), and using one here
 * would be throwing away the one thing this state is for.
 *
 * The block owns its colour, its corner and its shimmer; **size is the caller's**, because
 * a skeleton's width and height *are* the layout it is standing in for. It carries a
 * minimum height of one line of `label` text so a bare `<Skeleton />` is still visible
 * rather than a zero-height nothing.
 *
 * ## Reduced motion
 *
 * The sweep is off, and the block is simply a muted rectangle. That is not a degraded
 * state: the skeleton still says "this shape is coming", which is the whole message. The
 * shimmer is the part that was decoration.
 */

/**
 * The shortest a skeleton may stay on screen once it has appeared.
 *
 * A screen renders its skeletons when `useSkeletonHold(isLoading)` says so, not when
 * `isLoading` does. The difference is the flash: a request that answers in 60ms would
 * otherwise paint grey for 60ms, which reads as a flicker the reader has to look at twice,
 * and "instant" is the honest answer on a fast connection.
 */
export function useSkeletonHold(
	loading: boolean,
	hold: number = SKELETON_MIN_HOLD,
): boolean {
	const [visible, setVisible] = useState(loading);
	const shownAt = useRef<number | null>(null);

	useEffect(() => {
		if (loading) {
			if (shownAt.current === null) shownAt.current = Date.now();
			setVisible(true);
			return;
		}

		if (shownAt.current === null) {
			setVisible(false);
			return;
		}

		// Still inside the minimum: hold for the remainder rather than clearing now, so the
		// total time on screen is `hold` from the moment it appeared, not from this render.
		const remaining = hold - (Date.now() - shownAt.current);
		if (remaining <= 0) {
			shownAt.current = null;
			setVisible(false);
			return;
		}

		const timer = setTimeout(() => {
			shownAt.current = null;
			setVisible(false);
		}, remaining);

		return () => clearTimeout(timer);
	}, [hold, loading]);

	return visible;
}

type SkeletonProps = {
	/** Layout only — width, height, flex. Colour, corner and shimmer are the block's. */
	style?: StyleProp<ViewStyle>;
	/** The corner, named by token. `sm` is the control radius a thumbnail or a line uses. */
	radiusToken?: keyof typeof radius;
	/** What is being waited for, already translated. Omit for a decorative block. */
	label?: string;
};

export function Skeleton({ style, radiusToken = "sm", label }: SkeletonProps) {
	const { colors } = useTheme();
	const reduceMotion = useReducedMotion();
	const [width, setWidth] = useState(0);
	const sweep = useSharedValue(0);

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		setWidth(event.nativeEvent.layout.width);
	}, []);

	// The band starts fully outside the block and ends fully outside it, so the loop
	// restart is invisible and no fade is needed at either edge.
	const bandWidth = Math.round(width / 3);

	useEffect(() => {
		if (reduceMotion || width === 0) return;
		sweep.value = 0;
		sweep.value = withRepeat(
			withTiming(1, {
				duration: SKELETON_SWEEP,
				easing: Easing.inOut(Easing.ease),
			}),
			-1,
			false,
		);
		return () => cancelAnimation(sweep);
	}, [reduceMotion, sweep, width]);

	const band = useAnimatedStyle(() => ({
		transform: [{ translateX: -bandWidth + sweep.value * (width + bandWidth) }],
	}));

	return (
		<View
			onLayout={handleLayout}
			// A skeleton that is standing in for something named should be announced as
			// waiting rather than read as an empty group; one with no `label` is decorative
			// and stays out of the tree.
			accessible={label !== undefined}
			accessibilityRole={label === undefined ? undefined : "progressbar"}
			accessibilityLabel={label}
			style={[
				styles.block,
				{ backgroundColor: colors.muted, borderRadius: radius[radiusToken] },
				style,
			]}
		>
			{!reduceMotion && bandWidth > 0 ? (
				// A solid band rather than a gradient: a gradient would need transparent ends, and
				// the palette has no alpha colours. A low-contrast band is what a shimmer should
				// be anyway — it is a hint that something is moving, not a light show.
				//
				// `shimmer`, and not `border`, which this was: `border` is a hairline drawn
				// against a *page*, and against the block it sweeps it measured 1.21:1 in the
				// light theme and 1.06:1 in the dark one — a sweep nobody could see, on the one
				// element whose whole job is to be seen moving. The token is named for this and
				// nothing else, so it cannot drift when a card's edge is retuned.
				<Animated.View
					style={[
						styles.band,
						{ width: bandWidth, backgroundColor: colors.shimmer },
						band,
					]}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	block: {
		// One line of the smallest text, so a skeleton with no height is still a block.
		minHeight: type.label.lineHeight,
		// The band is drawn outside the block's bounds for most of the sweep; this is what
		// keeps it inside the rounded corner instead of flashing past it.
		overflow: "hidden",
	},
	band: { position: "absolute", top: 0, bottom: 0, left: 0 },
});
