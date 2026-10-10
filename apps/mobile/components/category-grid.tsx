import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import type { Category } from "@pymeshub/shared";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { categoryIcon } from "@/lib/category-icon";
import { chunkPairs } from "@/lib/chunk-pairs";
import { useT } from "@/lib/i18n";
import { icon, space, TEXT_STACK_GAP, useTheme } from "@/theme";

import { AnimateIn } from "./animate-in";
import { Card } from "./card";
import { Text } from "./text";

/**
 * The 2-up sector index: name, glyph, product count, tap into `/category/[slug]`.
 *
 * `/categories` is the dedicated page; search idle is the same tiles under the field so
 * that tab is not a one-row rail over an empty canvas. `lib/chunk-pairs` owns the lone
 * trailing tile. Callers filter to sectors (`parentId === null`); this draws what it is handed.
 */
export function CategoryGrid({ items }: { items: Category[] }) {
	const rows = useMemo(() => chunkPairs(items), [items]);

	if (items.length === 0) return null;

	return (
		<View style={styles.rows}>
			{rows.map((pair, row) => (
				<View key={pair[0].id} style={styles.row}>
					{pair.map((category, column) => (
						<CategoryTile
							key={category.id}
							category={category}
							index={row * 2 + column}
						/>
					))}
					{pair.length === 1 ? <View style={styles.tile} /> : null}
				</View>
			))}
		</View>
	);
}

function CategoryTile({
	category,
	index,
}: {
	category: Category;
	index: number;
}) {
	const { colors } = useTheme();
	const { tp, locale } = useT();
	const name = localizedName(category, locale);
	const count =
		category.productCount === undefined
			? null
			: tp("store.category.count", category.productCount);
	const spoken = count === null ? name : `${name} · ${count}`;

	return (
		<AnimateIn index={index} style={styles.tile}>
			<Card
				style={styles.tile}
				onPress={() =>
					router.push({
						pathname: "/category/[slug]" as const,
						params: { slug: category.slug },
					})
				}
				accessibilityLabel={spoken}
			>
				<View style={styles.body}>
					<Ionicons
						name={categoryIcon(category.iconName)}
						size={icon.action}
						color={colors.mutedForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
					<View style={styles.names}>
						<Text variant="body" bold>
							{name}
						</Text>
						{count === null ? null : (
							<Text variant="caption" tone="muted">
								{count}
							</Text>
						)}
					</View>
				</View>
			</Card>
		</AnimateIn>
	);
}

const styles = StyleSheet.create({
	rows: { paddingHorizontal: space.lg, gap: space.md },
	row: { flexDirection: "row", gap: space.md },
	tile: { flex: 1 },
	body: { flex: 1, gap: space.sm },
	names: { gap: TEXT_STACK_GAP },
});
