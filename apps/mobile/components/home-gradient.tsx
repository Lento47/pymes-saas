import { LinearGradient } from "expo-linear-gradient";
import { useWindowDimensions } from "react-native";

import type { ColorScheme } from "@/theme";

export function HomeGradient({
	scheme,
	color,
}: {
	scheme: ColorScheme;
	color: string;
}) {
	const { height } = useWindowDimensions();
	const isLime = color.toLowerCase() === "#c8ff18";
	const strengths: readonly [number, number, number, number] =
		scheme === "dark" ? [0.42, 0.24, 0.04, 0] : [0.8, 0.6, 0.16, 0];
	const colors = isLime
		? scheme === "dark"
			? (["#455B16", "#2C3C0F", "#1A240F", "#0F0F0F"] as const)
			: (["#C8FF18", "#A9DE00", "#E2F4AC", "#FFFFFF"] as const)
		: ([
				withAlpha(color, strengths[0]),
				withAlpha(color, strengths[1]),
				withAlpha(color, strengths[2]),
				withAlpha(color, strengths[3]),
			] as const);

	return (
		<LinearGradient
			colors={colors}
			locations={[0, 18 / 52, 35 / 52, 1]}
			start={{ x: 0.5, y: 0 }}
			end={{ x: 0.5, y: 1 }}
			style={{ height: height * 0.52 }}
		/>
	);
}

function withAlpha(hex: string, alpha: number): string {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
