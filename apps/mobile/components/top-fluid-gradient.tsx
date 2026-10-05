import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedProps,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import Svg, {
	Defs,
	Path,
	type PathProps,
	Stop,
	LinearGradient as SvgLinearGradient,
} from "react-native-svg";

import { mixHex } from "@/lib/color";
import type { ColorScheme } from "@/theme";

export type FluidMotion = "normal" | "still" | "reduced";

type RegionSpec = {
	period: number;
	phase: number;
	driftPeriod: number;
	secondaryPeriod: number;
};

const REGIONS = [
	{ period: 6600, phase: 0.12, driftPeriod: 11_500, secondaryPeriod: 9600 },
	{ period: 7600, phase: 0.58, driftPeriod: 13_700, secondaryPeriod: 10_800 },
	{ period: 7200, phase: 0.84, driftPeriod: 12_300, secondaryPeriod: 9200 },
	{ period: 8400, phase: 0.34, driftPeriod: 14_200, secondaryPeriod: 11_600 },
	{ period: 6200, phase: 0.72, driftPeriod: 10_800, secondaryPeriod: 10_200 },
] as const satisfies readonly RegionSpec[];

const BASE_X = [
	-100, -5, 95, 180, 300, 390, 480, 620, 710, 800, 930, 1100,
] as const;
const BASE_Y = [
	265, 288, 346, 332, 254, 326, 354, 252, 328, 346, 268, 330,
] as const;
const CURVE_TENSION = [
	5.2, 6.8, 4.9, 7.1, 5.4, 6.3, 4.8, 7.4, 5.1, 6.9, 5.6,
] as const;
const FULL_CYCLE = Math.PI * 2;
const AnimatedPath = Animated.createAnimatedComponent(Path);

function smoothStep(value: number): number {
	"worklet";
	const clamped = Math.max(0, Math.min(1, value));
	return clamped * clamped * (3 - 2 * clamped);
}

function gatherEnvelope(progress: number): number {
	"worklet";
	if (progress < 0.38) return smoothStep(progress / 0.38);
	if (progress < 0.52) return 1;
	if (progress < 0.9) return 1 - smoothStep((progress - 0.52) / 0.38);
	return 0;
}

function releaseEnvelope(progress: number): number {
	"worklet";
	if (progress < 0.5 || progress > 0.94) return 0;
	return Math.sin(((progress - 0.5) / 0.44) * Math.PI);
}

function transparent(hex: string): string {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${red}, ${green}, ${blue}, 0)`;
}

function useRegionDriver(spec: RegionSpec, active: boolean) {
	const primary = useSharedValue(0);
	const secondary = useSharedValue(0);
	const drift = useSharedValue(0);

	useEffect(() => {
		if (active) {
			primary.set(0);
			secondary.set(0);
			drift.set(0);
			primary.set(
				withRepeat(
					withTiming(1, {
						duration: spec.period,
						easing: Easing.linear,
					}),
					-1,
					false,
				),
			);
			secondary.set(
				withRepeat(
					withTiming(1, {
						duration: spec.secondaryPeriod,
						easing: Easing.linear,
					}),
					-1,
					false,
				),
			);
			drift.set(
				withRepeat(
					withTiming(1, {
						duration: spec.driftPeriod,
						easing: Easing.linear,
					}),
					-1,
					false,
				),
			);
		} else {
			cancelAnimation(primary);
			cancelAnimation(secondary);
			cancelAnimation(drift);
		}

		return () => {
			cancelAnimation(primary);
			cancelAnimation(secondary);
			cancelAnimation(drift);
		};
	}, [active, drift, primary, secondary, spec]);

	return { primary, secondary, drift, phase: spec.phase };
}

function useLoopDriver(period: number, active: boolean) {
	const progress = useSharedValue(0);

	useEffect(() => {
		if (active) {
			progress.set(0);
			progress.set(
				withRepeat(
					withTiming(1, { duration: period, easing: Easing.linear }),
					-1,
					false,
				),
			);
		} else {
			cancelAnimation(progress);
		}

		return () => cancelAnimation(progress);
	}, [active, period, progress]);

	return progress;
}

export function TopFluidGradient({
	height = 360,
	intensity = 1,
	motion = "normal",
	color,
	backgroundColor,
	scheme,
}: {
	height?: number;
	intensity?: number;
	motion?: FluidMotion;
	color: string;
	backgroundColor: string;
	scheme: ColorScheme;
}) {
	const active = motion === "normal";
	const strength = Math.max(0, Math.min(1, intensity));
	const topColor = color;
	const bloom = mixHex(
		topColor,
		scheme === "dark" ? "#AFCBFF" : backgroundColor,
		scheme === "dark" ? 0.76 : 0.84,
	);
	const mid = mixHex(topColor, backgroundColor, scheme === "dark" ? 0.7 : 0.56);

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			<LinearGradient
				colors={[
					mixHex(topColor, backgroundColor, scheme === "dark" ? 0.085 : 0.07),
					backgroundColor,
					mixHex(topColor, backgroundColor, scheme === "dark" ? 0.035 : 0.045),
				]}
				locations={[0, 0.6, 1]}
				style={StyleSheet.absoluteFill}
			/>
			<View style={[styles.fluid, { height }]}>
				<LinearGradient
					colors={[topColor, topColor, mid, transparent(mid)]}
					locations={[0, 0.45, 0.76, 1]}
					style={[styles.body, { height: height * 0.68 }]}
				/>
				<View style={styles.boundary}>
					<FluidBoundary
						active={active}
						bloom={bloom}
						color={topColor}
						intensity={strength}
						mid={mid}
					/>
				</View>
			</View>
		</View>
	);
}

function FluidBoundary({
	active,
	bloom,
	color,
	intensity,
	mid,
}: {
	active: boolean;
	bloom: string;
	color: string;
	intensity: number;
	mid: string;
}) {
	const region0 = useRegionDriver(REGIONS[0], active);
	const region1 = useRegionDriver(REGIONS[1], active);
	const region2 = useRegionDriver(REGIONS[2], active);
	const region3 = useRegionDriver(REGIONS[3], active);
	const region4 = useRegionDriver(REGIONS[4], active);
	const macro = useLoopDriver(12_400, active);
	const luminance = useLoopDriver(13_700, active);

	const animatedPath = useAnimatedProps<PathProps>(() => {
		const macroProgress = macro.get();
		const gather = gatherEnvelope(macroProgress);
		const release = releaseEnvelope(macroProgress);
		const secondary = [
			Math.sin((region0.secondary.get() + region0.phase + 0.63) * FULL_CYCLE),
			Math.sin((region1.secondary.get() + region1.phase + 0.63) * FULL_CYCLE),
			Math.sin((region2.secondary.get() + region2.phase + 0.63) * FULL_CYCLE),
			Math.sin((region3.secondary.get() + region3.phase + 0.63) * FULL_CYCLE),
			Math.sin((region4.secondary.get() + region4.phase + 0.63) * FULL_CYCLE),
		] as const;
		const drift = [
			Math.sin((region0.drift.get() + region0.phase + 0.29) * FULL_CYCLE),
			Math.sin((region1.drift.get() + region1.phase + 0.29) * FULL_CYCLE),
			Math.sin((region2.drift.get() + region2.phase + 0.29) * FULL_CYCLE),
			Math.sin((region3.drift.get() + region3.phase + 0.29) * FULL_CYCLE),
			Math.sin((region4.drift.get() + region4.phase + 0.29) * FULL_CYCLE),
		] as const;
		const primary = [
			Math.sin(
				(region0.primary.get() +
					region0.phase +
					secondary[0] * 0.1 +
					drift[1] * 0.035) *
					FULL_CYCLE,
			),
			Math.sin(
				(region1.primary.get() +
					region1.phase +
					secondary[1] * 0.13 +
					drift[0] * 0.04) *
					FULL_CYCLE,
			),
			Math.sin(
				(region2.primary.get() +
					region2.phase +
					secondary[2] * 0.09 +
					drift[3] * 0.05) *
					FULL_CYCLE,
			),
			Math.sin(
				(region3.primary.get() +
					region3.phase +
					secondary[3] * 0.12 +
					drift[2] * 0.035) *
					FULL_CYCLE,
			),
			Math.sin(
				(region4.primary.get() +
					region4.phase +
					secondary[4] * 0.11 +
					drift[3] * 0.045) *
					FULL_CYCLE,
			),
		] as const;
		const turbulence = [
			Math.sin((region0.primary.get() * 2 + region0.phase * 1.7) * FULL_CYCLE) *
				0.55 +
				secondary[1] * drift[0] * 0.45,
			Math.sin((region1.primary.get() * 2 + region1.phase * 1.9) * FULL_CYCLE) *
				0.48 +
				secondary[0] * drift[2] * 0.52,
			Math.sin((region2.primary.get() * 2 + region2.phase * 1.6) * FULL_CYCLE) *
				0.58 +
				secondary[3] * drift[1] * 0.42,
			Math.sin((region3.primary.get() * 2 + region3.phase * 1.8) * FULL_CYCLE) *
				0.5 +
				secondary[2] * drift[4] * 0.5,
			Math.sin((region4.primary.get() * 2 + region4.phase * 2.1) * FULL_CYCLE) *
				0.54 +
				secondary[3] * drift[4] * 0.46,
		] as const;
		const rawY = [
			primary[0] * 23 + secondary[0] * 10 + turbulence[0] * 10,
			primary[0] * 31 + primary[1] * 7 + secondary[0] * 8 + turbulence[0] * 12,
			primary[0] * 38 + primary[1] * 8 + secondary[0] * 11 + turbulence[0] * 14,
			primary[1] * 31 + primary[0] * 7 + secondary[1] * 10 + turbulence[1] * 12,
			primary[1] * 36 + primary[2] * 8 + secondary[1] * 10 + turbulence[1] * 14,
			primary[2] * 30 +
				primary[1] * 10 +
				secondary[2] * 10 +
				turbulence[2] * 12,
			primary[2] * 40 +
				primary[3] * 10 +
				secondary[2] * 10 +
				turbulence[2] * 15,
			primary[3] * 31 +
				primary[2] * 10 +
				secondary[3] * 10 +
				turbulence[3] * 13,
			primary[3] * 39 + primary[4] * 8 + secondary[3] * 11 + turbulence[3] * 15,
			primary[4] * 30 + primary[3] * 8 + secondary[4] * 10 + turbulence[4] * 12,
			primary[4] * 38 + primary[3] * 8 + secondary[4] * 10 + turbulence[4] * 14,
			primary[4] * 24 + secondary[4] * 10 + turbulence[4] * 10,
		];
		const macroY = [
			-gather * 7 + release * 9,
			-gather * 10 + release * 12,
			-gather * 12 + release * 16,
			-gather * 9 + release * 11,
			-gather * 8 + release * 13,
			-gather * 11 + release * 10,
			-gather * 9 + release * 15,
			-gather * 7 + release * 9,
			-gather * 10 + release * 14,
			-gather * 8 + release * 11,
			-gather * 11 + release * 16,
			-gather * 6 + release * 8,
		] as const;
		const globalFlow = (drift[0] + drift[2] + drift[4]) * 3;
		const sidewind = [
			secondary[0] * 12,
			primary[0] * 16,
			primary[0] * 30,
			primary[1] * -26,
			secondary[1] * 20,
			primary[2] * 32,
			primary[2] * -24,
			secondary[3] * 24,
			primary[3] * 32,
			primary[4] * -26,
			primary[4] * 30,
			secondary[4] * -14,
		] as const;
		const rawX = [
			globalFlow + drift[0] * 18 + secondary[0] * 5 + turbulence[0] * 4,
			globalFlow + drift[0] * 24 + secondary[0] * 8 - turbulence[0] * 5,
			globalFlow + drift[0] * 28 + secondary[1] * 10 + turbulence[0] * 8,
			globalFlow + drift[1] * 24 - secondary[0] * 12 - turbulence[1] * 7,
			globalFlow + drift[1] * 22 + secondary[2] * 8 + turbulence[1] * 6,
			globalFlow + drift[2] * 30 + secondary[1] * 12 - turbulence[2] * 8,
			globalFlow + drift[2] * 24 - secondary[3] * 10 + turbulence[2] * 7,
			globalFlow + drift[3] * 26 + secondary[2] * 12 - turbulence[3] * 6,
			globalFlow + drift[3] * 30 + secondary[4] * 10 + turbulence[3] * 8,
			globalFlow + drift[4] * 24 - secondary[3] * 12 - turbulence[4] * 7,
			globalFlow + drift[4] * 30 + secondary[4] * 9 + turbulence[4] * 8,
			globalFlow + drift[4] * 18 - secondary[4] * 6 + turbulence[4] * 4,
		];
		const points: { x: number; y: number }[] = [];

		for (let index = 0; index < BASE_X.length; index += 1) {
			const previousIndex = Math.max(0, index - 1);
			const nextIndex = Math.min(BASE_X.length - 1, index + 1);
			const previousMotion =
				(rawY[previousIndex] ?? 0) + (macroY[previousIndex] ?? 0);
			const currentMotion = (rawY[index] ?? 0) + (macroY[index] ?? 0);
			const nextMotion = (rawY[nextIndex] ?? 0) + (macroY[nextIndex] ?? 0);
			const previousDrift =
				(rawX[previousIndex] ?? 0) + (sidewind[previousIndex] ?? 0);
			const currentDrift = (rawX[index] ?? 0) + (sidewind[index] ?? 0);
			const nextDrift = (rawX[nextIndex] ?? 0) + (sidewind[nextIndex] ?? 0);
			const smoothY =
				(currentMotion * 0.72 + previousMotion * 0.14 + nextMotion * 0.14) *
				intensity;
			const smoothX =
				(currentDrift * 0.82 + previousDrift * 0.09 + nextDrift * 0.09) *
				intensity;
			points.push({
				x: (BASE_X[index] ?? 0) + smoothX,
				y: (BASE_Y[index] ?? 220) + smoothY,
			});
		}

		let path = `M -110 -24 L ${points[0]?.x ?? -90} ${points[0]?.y ?? 194}`;
		for (let index = 0; index < points.length - 1; index += 1) {
			const previous = points[Math.max(0, index - 1)];
			const current = points[index];
			const next = points[index + 1];
			const following = points[Math.min(points.length - 1, index + 2)];
			if (!(previous && current && next && following)) continue;
			const outgoingTension = CURVE_TENSION[index] ?? 6;
			const incomingTension = CURVE_TENSION[index + 1] ?? 6;
			const control1X = current.x + (next.x - previous.x) / outgoingTension;
			const control1Y = current.y + (next.y - previous.y) / outgoingTension;
			const control2X = next.x - (following.x - current.x) / incomingTension;
			const control2Y = next.y - (following.y - current.y) / incomingTension;
			path += ` C ${control1X} ${control1Y} ${control2X} ${control2Y} ${next.x} ${next.y}`;
		}

		const lightPulse =
			(Math.sin((luminance.get() + 0.17) * FULL_CYCLE) + 1) * 0.5;
		return {
			d: `${path} L 1110 -24 Z`,
			opacity: 0.94 + lightPulse * 0.06,
		};
	});

	return (
		<Svg
			width="100%"
			height="100%"
			viewBox="0 0 1000 380"
			preserveAspectRatio="none"
		>
			<Defs>
				<SvgLinearGradient
					id="fluidFill"
					x1="0"
					y1="0"
					x2="0"
					y2="380"
					gradientUnits="userSpaceOnUse"
				>
					<Stop offset="0" stopColor={color} stopOpacity={1} />
					<Stop offset="0.36" stopColor={color} stopOpacity={0.98} />
					<Stop offset="0.48" stopColor={mid} stopOpacity={0.64} />
					<Stop offset="0.62" stopColor={bloom} stopOpacity={0.3} />
					<Stop offset="0.76" stopColor={bloom} stopOpacity={0.11} />
					<Stop offset="0.9" stopColor={bloom} stopOpacity={0.025} />
					<Stop offset="1" stopColor={bloom} stopOpacity={0} />
				</SvgLinearGradient>
			</Defs>
			<AnimatedPath animatedProps={animatedPath} fill="url(#fluidFill)" />
		</Svg>
	);
}

const styles = StyleSheet.create({
	fluid: { width: "100%", overflow: "hidden" },
	body: { position: "absolute", top: 0, left: 0, right: 0 },
	boundary: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: -12,
		right: -12,
	},
});
