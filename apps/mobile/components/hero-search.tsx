import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { radius, shadow, space, useTheme } from "@/theme";

import { hitSlopFor, Pressable } from "./pressable";
import { Text } from "./text";

/**
 * Home search capsule: magnifier, one-line placeholder, sliders.
 *
 * The field is a floating white pill on the canvas / theme-form seam. There is no heavy
 * ring. `catalog.search` still takes `{q, lat?, lng?}` and no filters, so the sliders
 * control opens the same universal search the field does — nearby is the surface that
 * actually mounts `./filter-sheet`.
 */
export function HeroSearch({
	onPress,
	onFilterPress,
	accessibilityHint,
}: {
	onPress: () => void;
	onFilterPress?: () => void;
	accessibilityHint?: string;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const placeholder = t("home.search.editorial");
	const openFilters = onFilterPress ?? onPress;

	return (
		<View
			style={[
				styles.wrap,
				styles.hero,
				shadow.card,
				{ backgroundColor: colors.card, borderColor: colors.border },
			]}
		>
			<Pressable
				onPress={onPress}
				accessibilityRole="search"
				accessibilityLabel={placeholder}
				accessibilityHint={accessibilityHint}
				style={styles.field}
			>
				<Ionicons
					name="search-outline"
					size={21}
					color={colors.foreground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<Text
					variant="label"
					tone="muted"
					numberOfLines={1}
					style={styles.flex}
				>
					{placeholder}
				</Text>
			</Pressable>
			<Pressable
				onPress={openFilters}
				hitSlop={hitSlopFor(20)}
				accessibilityRole="button"
				accessibilityLabel={t("home.search.filters")}
				style={styles.filter}
			>
				<Ionicons
					name="options-outline"
					size={20}
					color={colors.foreground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		marginHorizontal: space.xxl,
		marginTop: 14,
	},
	hero: {
		flexDirection: "row",
		alignItems: "center",
		height: 42,
		paddingLeft: 16,
		paddingRight: 6,
		gap: 10,
		borderRadius: 24,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	field: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		minWidth: 0,
	},
	flex: { flex: 1 },
	filter: {
		width: 36,
		height: 36,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.full,
		overflow: "hidden",
	},
});
