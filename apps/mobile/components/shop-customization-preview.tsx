import Ionicons from "@expo/vector-icons/Ionicons";
import {
	type BusinessStorefront,
	brandAccentCheck,
	formatMoney,
	type ProductCard,
	type StorefrontAppearance,
} from "@pymeshub/shared";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { bandAnchor, contrastRatio } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { radius, space, ThemeColorsOverrideProvider, useTheme } from "@/theme";
import { Image } from "./image";
import { ShopCustomizationSections } from "./shop-customization-sections";
import { Text } from "./text";

/** A scaled shop page made from the same data and optional sections as the live page. */
export function ShopCustomizationPreview({
	storefront,
	appearance,
	products,
}: {
	storefront: BusinessStorefront;
	appearance: StorefrontAppearance;
	products: ProductCard[];
}) {
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const colorCheck = appearance.accentColor
		? brandAccentCheck(appearance.accentColor)
		: null;
	const brand =
		colorCheck?.valid && appearance.accentColor
			? appearance.accentColor
			: colors.accent;
	const brandInk = colorCheck?.valid
		? colorCheck.ink
		: contrastRatio(brand, "#000000") >= 4.5
			? "#000000"
			: "#FFFFFF";
	const coverMode = appearance.header === "cover";
	const hasCover = coverMode && !!storefront.card.coverUrl;
	const headerInk = coverMode ? colors.foreground : brandInk;
	const previewColors = colorCheck?.valid
		? {
				...colors,
				primary: brand,
				primaryForeground: brandInk,
				action: bandAnchor(brand, colors.background),
			}
		: colors;
	return (
		<ThemeColorsOverrideProvider colors={previewColors}>
			<View
				style={[
					styles.frame,
					{ backgroundColor: colors.background, borderColor: colors.border },
				]}
			>
				<View
					style={[
						styles.header,
						coverMode ? styles.coverHeader : styles.compactHeader,
						{
							backgroundColor: coverMode
								? hasCover
									? colors.muted
									: colors.accent
								: brand,
						},
					]}
				>
					{hasCover ? (
						<Image
							uri={storefront.card.coverUrl}
							style={StyleSheet.absoluteFill}
							resizeMode="cover"
						/>
					) : null}
					{coverMode ? (
						<LinearGradient
							colors={[`${colors.background}00`, colors.background]}
							style={StyleSheet.absoluteFill}
							pointerEvents="none"
						/>
					) : null}
					<View style={styles.identity}>
						{storefront.card.logoUrl ? (
							<Image uri={storefront.card.logoUrl} style={styles.logo} />
						) : null}
						<View style={styles.identityText}>
							<Text
								variant="title"
								bold
								style={{ color: headerInk }}
								numberOfLines={2}
							>
								{storefront.card.name}
							</Text>
							<Text variant="caption" style={{ color: headerInk }}>
								{storefront.isOpen ? t("store.open") : t("store.closed")}
								{" · "}
								{storefront.card.city}
							</Text>
						</View>
					</View>
				</View>
				{coverMode && appearance.accentColor && colorCheck?.valid ? (
					<View style={{ height: 4, backgroundColor: brand }} />
				) : null}

				<View style={{ paddingTop: space.lg }}>
					<ShopCustomizationSections
						appearance={appearance}
						card={storefront.card}
						hours={storefront.hours}
						isOpen={storefront.isOpen}
						preview
					/>
				</View>

				<View style={styles.menu}>
					<View style={[styles.search, { borderColor: colors.border }]}>
						<Ionicons
							name="search-outline"
							size={18}
							color={colors.mutedForeground}
						/>
						<Text variant="body" tone="muted" style={styles.searchLabel}>
							{t("search.title")}
						</Text>
						<Ionicons name="cart-outline" size={20} color={colors.foreground} />
					</View>
					{storefront.categories.length > 0 ? (
						<View style={styles.categories}>
							{storefront.categories.slice(0, 3).map((category) => (
								<View
									key={category.id}
									style={[styles.category, { borderColor: colors.border }]}
								>
									<Text variant="caption" numberOfLines={1}>
										{category.name}
									</Text>
								</View>
							))}
						</View>
					) : null}
					<Text variant="title" bold>
						{t("biz.nav.products")}
					</Text>
					{products.map((product) => (
						<View
							key={product.id}
							style={[styles.product, { borderBottomColor: colors.border }]}
						>
							{product.imageUrl ? (
								<Image uri={product.imageUrl} style={styles.productImage} />
							) : null}
							<View style={styles.productText}>
								<Text variant="body" bold numberOfLines={2}>
									{product.title}
								</Text>
								<Text variant="caption" tone="muted">
									{formatMoney(product.priceMinor, product.currency, {
										locale: intlLocale,
									})}
								</Text>
							</View>
						</View>
					))}
					<View style={[styles.reviews, { borderTopColor: colors.border }]}>
						<Ionicons name="star-outline" size={17} color={brand} />
						<Text variant="caption" tone="muted">
							{t("biz.reviews.title")} · {storefront.card.ratingCount}
						</Text>
					</View>
				</View>
			</View>
		</ThemeColorsOverrideProvider>
	);
}

const styles = StyleSheet.create({
	frame: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
	header: { padding: space.lg, justifyContent: "flex-end" },
	coverHeader: { minHeight: 170 },
	compactHeader: { minHeight: 105 },
	identity: { flexDirection: "row", alignItems: "center", gap: space.sm },
	identityText: { flex: 1, gap: space.xs },
	logo: { width: 48, height: 48, borderRadius: radius.md },
	menu: { padding: space.lg, gap: space.md },
	search: {
		borderWidth: 1,
		borderRadius: radius.md,
		padding: space.sm,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	searchLabel: { flex: 1 },
	categories: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
	category: {
		borderWidth: 1,
		borderRadius: radius.full,
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
	},
	product: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingBottom: space.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	productImage: { width: 52, height: 52, borderRadius: radius.sm },
	productText: { flex: 1, gap: space.xs },
	reviews: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		paddingTop: space.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
});
