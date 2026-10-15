import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";

import { radius, space } from "@/theme";

/** A quiet signature above the shop name, shared with the personalization preview. */
export function ShopBrandAccent({ color }: { color: string }) {
	return (
		<LinearGradient
			colors={[color, `${color}38`]}
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 0 }}
			style={styles.mark}
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
		/>
	);
}

const styles = StyleSheet.create({
	mark: {
		width: space.huge + space.xl,
		height: space.xs,
		borderRadius: radius.full,
		alignSelf: "flex-start",
		marginBottom: space.sm,
	},
});
