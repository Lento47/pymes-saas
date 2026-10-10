import Ionicons from "@expo/vector-icons/Ionicons";
import type { ProductCard } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Button } from "./button";
import { Image } from "./image";
import { Pressable } from "./pressable";
import { Price } from "./price";
import { Switch } from "./switch";
import { Text } from "./text";

export function BusinessProductRow({
	product,
	onPress,
	onAvailabilityChange,
	availabilityPending = false,
	featured = false,
}: {
	product: ProductCard;
	onPress: () => void;
	onAvailabilityChange?: (quantity: number) => void;
	availabilityPending?: boolean;
	featured?: boolean;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const available = product.availability.inStock;
	const quantity = product.availability.quantity;
	const stockText =
		quantity === null
			? available
				? t("biz.products.available")
				: t("biz.products.outOfStock")
			: t("biz.products.stockCount", { count: quantity });

	// `./switch` draws it, and this call site only names what it stands for. The
	// label is the sentence for the *state it will move to*, which is the reading
	// the row has always had; `./switch`'s contract leaves that choice to the
	// caller beside the control, and this row's caller is the product's own board.
	const availabilityControl = onAvailabilityChange ? (
		<Switch
			checked={available}
			onChange={(next) => onAvailabilityChange(next ? 1 : 0)}
			label={
				available
					? t("biz.products.markSoldOut")
					: t("biz.products.markAvailable")
			}
			disabled={availabilityPending}
		/>
	) : null;

	if (featured) {
		return (
			<View style={[styles.featured, { borderColor: colors.border }]}>
				<Image
					uri={product.imageUrl}
					style={styles.featuredImage}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<View style={styles.featuredCopy}>
					<Pressable onPress={onPress} style={styles.featuredText}>
						<Text variant="heading" bold>
							{product.title}
						</Text>
						<Text variant="caption" tone={available ? "muted" : "destructive"}>
							{stockText}
						</Text>
						<Price
							amountMinor={product.priceMinor}
							currency={product.currency}
							variant="body"
						/>
					</Pressable>
					<View style={styles.featuredActions}>
						<Button
							label={t("biz.products.edit")}
							icon={<Ionicons name="create-outline" size={18} />}
							variant="secondary"
							size="sm"
							onPress={onPress}
						/>
						{availabilityControl}
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.row, { borderColor: colors.border }]}>
			<Image
				uri={product.imageUrl}
				style={styles.thumbnail}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<View style={styles.rowCopy}>
				<Pressable onPress={onPress} style={styles.rowPressable}>
					<Text bold>{product.title}</Text>
					<Text variant="caption" tone={available ? "muted" : "destructive"}>
						{stockText}
					</Text>
				</Pressable>
				<View style={styles.rowActions}>
					<View style={styles.rowPrice}>
						<Price
							amountMinor={product.priceMinor}
							currency={product.currency}
							variant="body"
						/>
					</View>
					<Button
						label={t("biz.products.edit")}
						icon={<Ionicons name="create-outline" size={18} />}
						variant="secondary"
						size="sm"
						onPress={onPress}
					/>
					{availabilityControl}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	featured: {
		minHeight: 144,
		flexDirection: "row",
		gap: space.md,
		padding: space.md,
		borderWidth: 1,
		borderRadius: radius.md,
	},
	featuredImage: {
		width: "45%",
		minHeight: 144,
		alignSelf: "stretch",
		borderRadius: radius.sm,
	},
	featuredCopy: { flex: 1, minWidth: 0, justifyContent: "space-between" },
	featuredText: { gap: space.xs },
	featuredActions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	row: {
		minHeight: 72,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.md,
		paddingVertical: space.sm,
		borderBottomWidth: 1,
	},
	rowPressable: {
		minHeight: MIN_TOUCH_TARGET,
		gap: space.xs,
	},
	thumbnail: {
		width: 52,
		height: 52,
		borderRadius: radius.sm,
	},
	rowCopy: { flex: 1, minWidth: 0, gap: space.sm },
	rowPrice: { flexShrink: 0, marginRight: "auto" },
	rowActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: space.sm,
	},
});
