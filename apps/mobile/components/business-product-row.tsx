import Ionicons from "@expo/vector-icons/Ionicons";
import type { ProductCard } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Button } from "./button";
import { Image } from "./image";
import { Pressable } from "./pressable";
import { Price } from "./price";
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

	const availabilityControl = onAvailabilityChange ? (
		<Pressable
			accessibilityRole="switch"
			accessibilityLabel={
				available
					? t("biz.products.markSoldOut")
					: t("biz.products.markAvailable")
			}
			accessibilityState={{ checked: available, disabled: availabilityPending }}
			disabled={availabilityPending}
			onPress={() => onAvailabilityChange(available ? 0 : 1)}
			style={styles.switchTarget}
		>
			<View
				style={[
					styles.switchTrack,
					{
						backgroundColor: available ? colors.primary : colors.muted,
						borderColor: available ? colors.primary : colors.border,
					},
				]}
			>
				<View
					style={[
						styles.switchThumb,
						{
							backgroundColor: available
								? colors.primaryForeground
								: colors.mutedForeground,
							transform: [{ translateX: available ? 16 : 0 }],
						},
					]}
				/>
			</View>
		</Pressable>
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
						<Text variant="heading" bold numberOfLines={2}>
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
			<Pressable onPress={onPress} style={styles.rowPressable}>
				<Image
					uri={product.imageUrl}
					style={styles.thumbnail}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<View style={styles.rowCopy}>
					<Text bold numberOfLines={1}>
						{product.title}
					</Text>
					<Text variant="caption" tone={available ? "muted" : "destructive"}>
						{stockText}
					</Text>
				</View>
				<Price
					amountMinor={product.priceMinor}
					currency={product.currency}
					variant="body"
				/>
			</Pressable>
			<View style={styles.rowActions}>
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
	);
}

const styles = StyleSheet.create({
	featured: {
		minHeight: 144,
		maxHeight: 170,
		height: 156,
		flexDirection: "row",
		gap: space.md,
		padding: space.md,
		borderWidth: 1,
		borderRadius: radius.md,
	},
	featuredImage: {
		width: "45%",
		height: "100%",
		borderRadius: radius.sm,
	},
	featuredCopy: { flex: 1, justifyContent: "space-between" },
	featuredText: { gap: space.xs },
	featuredActions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	row: {
		minHeight: 72,
		height: 78,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		borderBottomWidth: 1,
	},
	rowPressable: {
		flex: 1,
		minHeight: MIN_TOUCH_TARGET,
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	thumbnail: {
		width: 52,
		height: 52,
		borderRadius: radius.sm,
	},
	rowCopy: { flex: 1, gap: space.xs },
	rowActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
	switchTarget: {
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
	},
	switchTrack: {
		width: 44,
		height: 28,
		borderRadius: radius.full,
		borderWidth: 1,
		padding: 3,
		justifyContent: "center",
	},
	switchThumb: {
		width: 20,
		height: 20,
		borderRadius: radius.full,
	},
});
