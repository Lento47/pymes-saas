import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import type { Category } from "@pymeshub/shared";
import { router } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { categoryIcon } from "@/lib/category-icon";
import { chunkPairs } from "@/lib/chunk-pairs";
import { useT } from "@/lib/i18n";
import { radius, space, useTheme } from "@/theme";
import { Pressable } from "./pressable";
import { Text } from "./text";

/** The category page passes only published, visible children in their display order. */
export function SubcategoryGrid({ items }: { items: Category[] }) {
	const { colors } = useTheme();
	const { t, tp, locale } = useT();
	const { width, fontScale } = useWindowDimensions();
	const singleColumn = width < 360 || fontScale > 1.3;
	const rows = singleColumn
		? items.map((item): [Category] => [item])
		: chunkPairs(items);
	return (
		<View style={styles.section}>
			<Text variant="heading" bold accessibilityRole="header">
				{t("category.subcategories")}
			</Text>
			{rows.map((row) => (
				<View key={row[0].id} style={styles.row}>
					{row.map((category) => {
						const name = localizedName(category, locale);
						const count =
							category.productCount && category.productCount > 0
								? tp("store.category.count", category.productCount)
								: null;
						return (
							<Pressable
								key={category.id}
								accessibilityRole="button"
								accessibilityLabel={count ? `${name}, ${count}` : name}
								onPress={() =>
									router.push({
										pathname: "/category/[slug]",
										params: { slug: category.slug },
									})
								}
								style={[
									styles.tile,
									{ backgroundColor: colors.card, borderColor: colors.border },
								]}
							>
								<View style={[styles.icon, { backgroundColor: colors.muted }]}>
									<Ionicons
										name={categoryIcon(category.iconName)}
										size={20}
										color={colors.foreground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								</View>
								<View style={styles.names}>
									<Text variant="label" bold>
										{name}
									</Text>
									{count ? (
										<Text variant="caption" tone="muted">
											{count}
										</Text>
									) : null}
								</View>
							</Pressable>
						);
					})}
					{!singleColumn && row.length === 1 ? (
						<View style={styles.spacer} />
					) : null}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: space.md },
	row: { flexDirection: "row", gap: space.sm },
	tile: {
		flex: 1,
		minWidth: 0,
		minHeight: 80,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		padding: space.md,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
	},
	icon: {
		width: 32,
		height: 32,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
	},
	names: { flex: 1, gap: space.xs },
	spacer: { flex: 1 },
});
