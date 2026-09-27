import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { duration, ENTER_RISE } from "@/lib/motion";
import {
	useReducedMotion,
	useReducedMotionResolved,
} from "@/lib/reduced-motion";
import { useTheme } from "@/theme";

const ICON = require("../assets/pymeshub-icon.png") as number;

/**
 * A brief brand welcome on a cold launch.
 *
 * It is deliberately short: the mark arrives, settles, and gets out of the way before the
 * session and role providers have finished their own work. The overlay is mounted once at
 * the root, so a route change never replays it and returning from the background does not
 * interrupt the reader with a second greeting. The 410ms timeline is a hand-off, not a
 * splash screen: it must never be the reason the app feels slow to open.
 *
 * Reduced motion keeps the same timing contract but removes the travel and scale. Opacity
 * is retained because it still communicates that the surface is being handed over.
 *
 * The timeline waits for `useReducedMotionResolved()` rather than reading the preference
 * straight away. The store answers `true` until the OS replies — a deliberate guess, so
 * that a reader who asked for less movement gets less movement — and on a cold launch that
 * reply lands a frame or two after mount. Starting on the guess and restarting on the
 * answer is what made this look half-finished: the mark arrived once without its
 * transform, snapped back to nothing, and then played the entrance it was supposed to
 * play. One timeline, one start, in the mode the device actually asked for.
 */
export function WelcomeAnimation() {
	const { colors } = useTheme();
	const reduceMotion = useReducedMotion();
	const reduceMotionResolved = useReducedMotionResolved();
	const progress = useSharedValue(0);

	useEffect(() => {
		if (!reduceMotionResolved) return;
		progress.value = 0;
		progress.value = withSequence(
			withDelay(
				reduceMotion ? 0 : 30,
				withTiming(1, {
					duration: reduceMotion ? duration.instant : 180,
					easing: Easing.out(Easing.cubic),
				}),
			),
			withDelay(40, withTiming(0, { duration: 160 })),
		);
	}, [progress, reduceMotion, reduceMotionResolved]);

	const overlay = useAnimatedStyle(() => ({
		opacity: progress.value,
	}));

	const mark = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: reduceMotion
			? []
			: [
					{
						translateY: ENTER_RISE * (1 - progress.value),
					},
					{
						scale: 0.94 + progress.value * 0.06,
					},
				],
	}));

	return (
		<Animated.View
			pointerEvents="none"
			style={[styles.overlay, { backgroundColor: colors.background }, overlay]}
		>
			<View style={styles.center}>
				<Animated.Image
					source={ICON}
					resizeMode="contain"
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					style={[styles.icon, mark]}
				/>
			</View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 100,
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	icon: {
		width: 104,
		height: 104,
	},
});
