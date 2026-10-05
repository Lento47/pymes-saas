import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	Extrapolation,
	interpolate,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import Svg, {
	Defs,
	Path,
	type PathProps,
	Stop,
	LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { mixHex } from "@/lib/color";
import { statusBarStyleForInk } from "@/lib/purchase-colors";
import {
	useReducedMotion,
	useReducedMotionResolved,
} from "@/lib/reduced-motion";
import { icon, space } from "@/theme";

import { Text } from "./text";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 1000;
const BASE_EDGE = 330;
const FULL_EDGE = 1500;
const FILL_MS = 900;
const HOLD_MS = 500;
const RELEASE_MS = 700;
const REDUCED_FADE_MS = 180;
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const EDGE_POINTS = [
	{ x: 0, offset: 28 },
	{ x: 145, offset: 62 },
	{ x: 310, offset: -26 },
	{ x: 465, offset: 48 },
	{ x: 635, offset: -34 },
	{ x: 805, offset: 54 },
	{ x: 1000, offset: 12 },
] as const;

function smoothStep(value: number): number {
	"worklet";
	const clamped = Math.max(0, Math.min(1, value));
	return clamped * clamped * (3 - 2 * clamped);
}

export function DeliveryCompletionOverlay({
	active,
	color,
	ink,
	title,
	onComplete,
}: {
	active: boolean;
	color: string;
	ink: string;
	title: string;
	onComplete: () => void;
}) {
	const { height } = useWindowDimensions();
	const reduceMotion = useReducedMotion();
	const motionResolved = useReducedMotionResolved();
	const progress = useSharedValue(0);
	const overlayOpacity = useSharedValue(1);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;
	const finish = useCallback(() => onCompleteRef.current(), []);

	useEffect(() => {
		if (!active || !motionResolved) return;

		cancelAnimation(progress);
		cancelAnimation(overlayOpacity);
		if (reduceMotion) {
			progress.set(1);
			overlayOpacity.set(0);
			overlayOpacity.set(
				withSequence(
					withTiming(1, { duration: REDUCED_FADE_MS }),
					withDelay(
						HOLD_MS,
						withTiming(0, { duration: REDUCED_FADE_MS }, (finished) => {
							if (finished) scheduleOnRN(finish);
						}),
					),
				),
			);
		} else {
			progress.set(0);
			overlayOpacity.set(1);
			progress.set(
				withSequence(
					withTiming(1, { duration: FILL_MS, easing: EASE_IN_OUT }),
					withDelay(
						HOLD_MS,
						withTiming(
							-1,
							{ duration: RELEASE_MS, easing: EASE_IN_OUT },
							(finished) => {
								if (finished) scheduleOnRN(finish);
							},
						),
					),
				),
			);
		}

		return () => {
			cancelAnimation(progress);
			cancelAnimation(overlayOpacity);
		};
	}, [active, finish, motionResolved, overlayOpacity, progress, reduceMotion]);

	const path = useAnimatedProps<PathProps>(() => {
		const value = progress.get();
		const entering = Math.max(0, value);
		const leaving = Math.max(0, -value);
		const edge =
			value >= 0
				? BASE_EDGE + (FULL_EDGE - BASE_EDGE) * smoothStep(entering)
				: BASE_EDGE * (1 - smoothStep(leaving));
		const organicStrength =
			(1 - smoothStep(entering) * 0.84) * (1 - smoothStep(leaving));
		const lateralFlow = Math.sin(entering * Math.PI) * 18;
		const points = EDGE_POINTS.map((point, index) => ({
			x:
				index === 0 || index === EDGE_POINTS.length - 1
					? point.x
					: point.x +
						lateralFlow * (index % 2 === 0 ? 1 : -0.72) * organicStrength,
			y: edge + point.offset * organicStrength,
		}));

		let valuePath = `M 0 0 L ${points[0]?.x ?? 0} ${points[0]?.y ?? edge}`;
		for (let index = 0; index < points.length - 1; index += 1) {
			const current = points[index];
			const next = points[index + 1];
			if (!(current && next)) continue;
			const control = (next.x - current.x) * 0.46;
			valuePath += ` C ${current.x + control} ${current.y} ${next.x - control} ${next.y} ${next.x} ${next.y}`;
		}

		return { d: `${valuePath} L ${VIEWBOX_WIDTH} 0 Z` };
	});

	const containerStyle = useAnimatedStyle(() => ({
		opacity: overlayOpacity.get(),
	}));
	const solidHoldStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			progress.get(),
			[0.78, 0.96, 1],
			[0, 0.9, 1],
			Extrapolation.CLAMP,
		),
	}));
	const confirmationStyle = useAnimatedStyle(() => {
		const value = progress.get();
		return {
			opacity: interpolate(
				value,
				[0.72, 0.9, 1],
				[0, 1, 1],
				Extrapolation.CLAMP,
			),
			transform: [
				{
					scale: interpolate(value, [0.72, 1], [0.96, 1], Extrapolation.CLAMP),
				},
			],
		};
	});
	const lowerColor = mixHex(color, "#FFFFFF", 0.2);

	return (
		<Modal
			visible={active && motionResolved}
			transparent
			presentationStyle="overFullScreen"
			statusBarTranslucent
			navigationBarTranslucent
			onRequestClose={finish}
		>
			<Animated.View
				style={[styles.root, containerStyle]}
				accessibilityViewIsModal
				accessibilityLiveRegion="polite"
			>
				<StatusBar style={statusBarStyleForInk(ink)} />
				<Svg
					width="100%"
					height={height}
					viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
					preserveAspectRatio="none"
					style={StyleSheet.absoluteFill}
				>
					<Defs>
						<SvgLinearGradient id="completionFill" x1="0" y1="0" x2="0" y2="1">
							<Stop offset="0" stopColor={color} stopOpacity={1} />
							<Stop offset="0.72" stopColor={color} stopOpacity={1} />
							<Stop offset="0.9" stopColor={lowerColor} stopOpacity={0.22} />
							<Stop offset="1" stopColor={lowerColor} stopOpacity={0} />
						</SvgLinearGradient>
					</Defs>
					<AnimatedPath animatedProps={path} fill="url(#completionFill)" />
				</Svg>
				<Animated.View
					pointerEvents="none"
					style={[styles.solidHold, { backgroundColor: color }, solidHoldStyle]}
				/>
				<Animated.View
					style={[styles.confirmation, confirmationStyle]}
					accessible
					accessibilityRole="header"
					accessibilityLabel={title}
				>
					<View style={[styles.mark, { borderColor: ink }]}>
						<Ionicons
							name="checkmark"
							size={icon.back * 1.5}
							color={ink}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</View>
					<Text variant="display" bold style={{ color: ink }}>
						{title}
					</Text>
				</Animated.View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	solidHold: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 1,
	},
	confirmation: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 2,
		alignItems: "center",
		justifyContent: "center",
		gap: space.lg,
		paddingHorizontal: space.xxl,
	},
	mark: {
		width: 80,
		height: 80,
		borderRadius: 40,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
});
