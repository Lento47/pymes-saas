import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, router } from "expo-router";
import {
	Image,
	type ImageSourcePropType,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";

import { useT } from "@/lib/i18n";
import { icon, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

const PHOTO = {
	comida: require("../assets/categories/category-food-beverage.png") as number,
	super: require("../assets/categories/category-groceries.jpg") as number,
	tiendas:
		require("../assets/categories/category-home-furniture-decor.png") as number,
	farmacia:
		require("../assets/categories/category-beauty-health-personal-care.png") as number,
	express:
		require("../assets/categories/category-travel-hospitality-tourism.png") as number,
};

/**
 * Editorial category ribbon: five slanted photographic panels, then a See more tile.
 *
 * Destinations are real routes. Express is `/nearby` because the taxonomy has no Express
 * sector. See more opens the full taxonomy. Panel tints are local to this ribbon, not a
 * second app palette.
 */
const ITEMS: {
	id: keyof typeof PHOTO;
	labelKey:
		| "home.editorial.cat.comida"
		| "home.editorial.cat.supermercado"
		| "home.editorial.cat.tiendas"
		| "home.editorial.cat.farmacia"
		| "home.editorial.cat.express";
	tint: string;
	href: Href;
	lean: number;
	topLeft: number;
	topRight: number;
}[] = [
	{
		id: "comida",
		labelKey: "home.editorial.cat.comida",
		tint: "#F3C7B0",
		href: { pathname: "/category/[slug]", params: { slug: "food-beverage" } },
		lean: -8,
		topLeft: 22,
		topRight: 6,
	},
	{
		id: "super",
		labelKey: "home.editorial.cat.supermercado",
		tint: "#C5D4B8",
		href: { pathname: "/category/[slug]", params: { slug: "groceries" } },
		lean: -5,
		topLeft: 8,
		topRight: 18,
	},
	{
		id: "tiendas",
		labelKey: "home.editorial.cat.tiendas",
		tint: "#E4D4C2",
		href: "/nearby",
		lean: -7,
		topLeft: 16,
		topRight: 8,
	},
	{
		id: "farmacia",
		labelKey: "home.editorial.cat.farmacia",
		tint: "#D5E3F0",
		href: {
			pathname: "/category/[slug]",
			params: { slug: "pharmacy-otc" },
		},
		lean: -4,
		topLeft: 6,
		topRight: 20,
	},
	{
		id: "express",
		labelKey: "home.editorial.cat.express",
		tint: "#D4D0EA",
		href: "/nearby",
		lean: -9,
		topLeft: 20,
		topRight: 10,
	},
];

export function AngledCategoryRail() {
	const { t } = useT();
	const { colors } = useTheme();

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
			style={styles.scroller}
		>
			{ITEMS.map((item) => (
				<Panel
					key={item.id}
					label={t(item.labelKey)}
					tint={item.tint}
					photo={PHOTO[item.id]}
					href={item.href}
					lean={item.lean}
					topLeft={item.topLeft}
					topRight={item.topRight}
					ink={colors.foreground}
					labelFill={colors.card}
				/>
			))}
			<MorePanel
				label={t("home.editorial.cat.more")}
				ink={colors.foreground}
				labelFill={colors.card}
				tileFill={colors.muted}
				iconColor={colors.foreground}
			/>
		</ScrollView>
	);
}

function Panel({
	label,
	tint,
	photo,
	href,
	lean,
	topLeft,
	topRight,
	ink,
	labelFill,
}: {
	label: string;
	tint: string;
	photo: ImageSourcePropType;
	href: Href;
	lean: number;
	topLeft: number;
	topRight: number;
	ink: string;
	labelFill: string;
}) {
	return (
		<Pressable
			onPress={() => router.push(href)}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={styles.panel}
		>
			<View
				style={[
					styles.upper,
					{
						backgroundColor: tint,
						borderTopLeftRadius: topLeft,
						borderTopRightRadius: topRight,
						transform: [{ skewY: `${lean}deg` }],
					},
				]}
			>
				<Image
					source={photo}
					resizeMode="contain"
					style={styles.photo}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
			<View style={[styles.lower, { backgroundColor: labelFill }]}>
				<Text variant="caption" bold style={{ color: ink }}>
					{label}
				</Text>
			</View>
		</Pressable>
	);
}

function MorePanel({
	label,
	ink,
	labelFill,
	tileFill,
	iconColor,
}: {
	label: string;
	ink: string;
	labelFill: string;
	tileFill: string;
	iconColor: string;
}) {
	return (
		<Pressable
			onPress={() => router.push("/categories")}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={styles.panel}
		>
			<View
				style={[
					styles.upper,
					{
						backgroundColor: tileFill,
						borderTopLeftRadius: 14,
						borderTopRightRadius: 14,
						transform: [{ skewY: "-6deg" }],
						alignItems: "center",
						justifyContent: "center",
					},
				]}
			>
				<Ionicons
					name="grid-outline"
					size={icon.back}
					color={iconColor}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
			<View style={[styles.lower, { backgroundColor: labelFill }]}>
				<Text variant="caption" bold style={{ color: ink }} numberOfLines={1}>
					{label}
				</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	scroller: {
		marginTop: space.sm,
		height: 108,
	},
	row: {
		paddingHorizontal: space.lg,
		gap: 4,
		alignItems: "flex-end",
	},
	panel: {
		width: 86,
		height: 104,
		overflow: "hidden",
		alignItems: "stretch",
		justifyContent: "flex-end",
		minWidth: 86,
	},
	upper: {
		height: 72,
		overflow: "hidden",
		marginBottom: -6,
	},
	photo: {
		width: "118%",
		height: "118%",
		marginLeft: -8,
		marginTop: -4,
	},
	lower: {
		height: 32,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 4,
	},
});
