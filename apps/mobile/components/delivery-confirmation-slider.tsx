import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";

import { SLIDER_COMPLETE_RATIO } from "@/lib/courier-motion";
import { light } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import {
	type CourierMotionTokens,
	courierMotionSpace,
	MIN_TOUCH_TARGET,
	radius,
	space,
	type,
} from "@/theme";

import { Button } from "./button";
import { Text } from "./text";

/**
 * Swipe-to-complete for the last courier action.
 *
 * The thumb is a real pan. Completing the animation is not completing the delivery:
 * `onComplete` fires once the thumb crosses the threshold, and the server mutation is
 * the caller's to run. A failed write must leave the slider at rest.
 */
export function DeliveryConfirmationSlider({
	label,
	accessibleLabel,
	motion,
	disabled,
	loading,
	onComplete,
}: {
	label: string;
	accessibleLabel: string;
	motion: CourierMotionTokens;
	disabled?: boolean;
	loading?: boolean;
	onComplete: () => void;
}) {
	const reduced = useReducedMotion();
	const trackWidth = useSharedValue(0);
	const x = useSharedValue(0);
	const inert = Boolean(disabled || loading);

	useEffect(() => {
		if (!loading) x.value = 0;
	}, [loading, x]);

	const fire = () => {
		if (inert) return;
		light();
		onComplete();
	};

	const thumbStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: x.value }],
	}));

	if (reduced) {
		return (
			<Button
				label={accessibleLabel}
				fullWidth
				size="lg"
				shape="pill"
				loading={loading}
				disabled={inert}
				onPress={onComplete}
			/>
		);
	}

	const pan = Gesture.Pan()
		.enabled(!inert)
		.activeOffsetX(8)
		.failOffsetY(16)
		.onUpdate((event) => {
			const max = Math.max(0, trackWidth.value - courierMotionSpace.thumb - 8);
			x.value = Math.min(max, Math.max(0, event.translationX));
		})
		.onEnd(() => {
			const max = Math.max(0, trackWidth.value - courierMotionSpace.thumb - 8);
			if (max > 0 && x.value >= max * SLIDER_COMPLETE_RATIO) {
				runOnJS(fire)();
			}
			x.value = withSpring(0, spring.press);
		});

	return (
		<View
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={label}
			accessibilityHint={accessibleLabel}
			accessibilityState={{ disabled: inert, busy: loading }}
			onAccessibilityAction={(event) => {
				if (event.nativeEvent.actionName === "activate") fire();
			}}
			accessibilityActions={[{ name: "activate", label: accessibleLabel }]}
			onLayout={(event) => {
				trackWidth.value = event.nativeEvent.layout.width;
			}}
			style={[
				styles.track,
				{ backgroundColor: motion.sliderTrack },
				inert ? styles.inert : null,
			]}
		>
			<Text
				variant="label"
				bold
				style={[styles.caption, { color: motion.sliderInk }]}
				pointerEvents="none"
			>
				{label}
			</Text>
			<GestureDetector gesture={pan}>
				<Animated.View
					style={[styles.thumb, { backgroundColor: motion.brand }, thumbStyle]}
				>
					<Ionicons
						name="arrow-forward"
						size={22}
						color={motion.brandInk}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

const styles = StyleSheet.create({
	track: {
		height: courierMotionSpace.control,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.full,
		justifyContent: "center",
		overflow: "hidden",
		paddingHorizontal: 4,
	},
	inert: { opacity: 0.7 },
	caption: {
		...type.label,
		position: "absolute",
		left: courierMotionSpace.thumb + space.md,
		right: space.lg,
		textAlign: "center",
	},
	thumb: {
		width: courierMotionSpace.thumb,
		height: courierMotionSpace.thumb,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
});
