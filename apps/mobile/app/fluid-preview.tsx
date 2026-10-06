import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { HomeGradient } from "@/components/home-gradient";
import { purchaseBand } from "@/lib/purchase-colors";
import type { PurchaseStage } from "@/lib/purchase-state";
import { businessThemeColors, type ColorScheme } from "@/theme";

/** Throwaway preview. Not part of the app. */
const STAGES: readonly PurchaseStage[] = [
	"delivery",
	"browsing",
	"basket",
	"inCart",
	"checkout",
	"confirmed",
	"paid",
];
function StageRow({
	stage,
	scheme,
}: {
	stage: PurchaseStage;
	scheme: ColorScheme;
}) {
	const colors = businessThemeColors("lime", scheme);
	const band = purchaseBand(stage, colors, scheme);

	return (
		<View style={styles.row}>
			<Text
				style={[
					styles.label,
					{ color: scheme === "dark" ? "#ffffff" : "#000000" },
				]}
			>
				{`${scheme} / ${stage}   band ${band?.color ?? "none"}`}
			</Text>
			<HomeGradient
				scheme={scheme}
				color={colors.primary}
				stage={stage}
				bandColor={band?.color}
				backgroundColor={colors.background}
			/>
		</View>
	);
}

export default function FluidPreview() {
	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.root}>
				<StageRow stage="delivery" scheme="dark" />
				{STAGES.slice(1).map((stage) => (
					<StageRow key={stage} stage={stage} scheme="dark" />
				))}
				<StageRow stage="delivery" scheme="light" />
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: "#0F0F0F" },
	row: { height: 340, justifyContent: "flex-end" },
	label: { fontSize: 11, paddingHorizontal: 8, paddingBottom: 4 },
});
