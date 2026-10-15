import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { radius, space } from "@/theme";

/** Decorative color at the cover's curved edge; text stays on an opaque canvas. */
export function ShopBrandAccent({ color }: { color: string }) {
	return (
		<View
			style={styles.decoration}
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
		>
			<LinearGradient
				colors={[`${color}16`, `${color}00`]}
				style={StyleSheet.absoluteFill}
			/>
			<View style={[styles.arc, { borderColor: `${color}12` }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	decoration: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: space.huge * 3,
		borderTopLeftRadius: radius.xl,
		borderTopRightRadius: radius.xl,
		overflow: "hidden",
	},
	arc: {
		position: "absolute",
		width: space.huge * 4,
		height: space.huge * 4,
		right: -space.huge,
		top: -space.huge * 2,
		borderRadius: radius.full,
		borderWidth: space.md,
	},
});
