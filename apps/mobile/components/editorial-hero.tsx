import Ionicons from "@expo/vector-icons/Ionicons";
import type { PromotionCard } from "@pymeshub/shared";
import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import {
	Image,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { useT } from "@/lib/i18n";
import { rememberOfferSelection } from "@/lib/offer-intent";
import { promotionCopy } from "@/lib/promotion";
import { radius, shadow, space, useTheme } from "@/theme";

import { Image as RemoteImage } from "./image";
import { hitSlopFor, Pressable } from "./pressable";
import { Text } from "./text";

const BOWL = require("../assets/home/hero-bowl.png") as number;
const CTA_SIZE = 40;
const CAMPAIGN_SLIDE = "campaign";

/** Frosting fills for the carousel plates. Local to this hero — not the app palette. */
const CAKE = [
	"#F4C9D4",
	"#F6E3B4",
	"#CDE5C8",
	"#C9D4F0",
	"#F6D3B8",
	"#DDD0F0",
] as const;

/**
 * Editorial home composition: stacked headline, lede, circular CTA, oversized bowl,
 * local-commerce sticker, and a paging carousel when the feed has more to show.
 *
 * Slide 0 is the campaign. Later slides are `catalog.feed` promotions — the same
 * objects the feed used to draw as a second banner, so a code is not advertised twice.
 * Copy line-breaks are load-bearing. Each page sits on a rounded cake-palette plate.
 */
export function EditorialHero({
	promotions = [],
}: {
	promotions?: PromotionCard[];
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const { width } = useWindowDimensions();
	const [pageWidth, setPageWidth] = useState(width);
	const [page, setPage] = useState(0);
	const slides = 1 + promotions.length;
	const pagerKeys = [
		CAMPAIGN_SLIDE,
		...promotions.map((promotion) => promotion.id),
	];
	const bowlWidth = Math.max(pageWidth - space.xxl * 2, 0) * 0.7;

	const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		if (pageWidth <= 0) return;
		const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
		setPage(Math.min(Math.max(next, 0), slides - 1));
	};

	return (
		<View
			style={styles.stage}
			onLayout={(event) => {
				const next = event.nativeEvent.layout.width;
				if (next > 0 && next !== pageWidth) setPageWidth(next);
			}}
		>
			<ScrollView
				horizontal
				pagingEnabled
				nestedScrollEnabled
				directionalLockEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={onSettle}
				scrollEnabled={slides > 1}
				accessibilityLabel={
					slides > 1
						? t("home.editorial.slide", {
								index: page + 1,
								count: slides,
							})
						: undefined
				}
				accessibilityHint={
					slides > 1 ? t("home.editorial.carousel.hint") : undefined
				}
			>
				<SlidePlate width={pageWidth} index={0}>
					<CampaignSlide bowlWidth={bowlWidth} />
				</SlidePlate>
				{promotions.map((promotion, index) => (
					<SlidePlate key={promotion.id} width={pageWidth} index={index + 1}>
						<PromotionSlide promotion={promotion} bowlWidth={bowlWidth} />
					</SlidePlate>
				))}
			</ScrollView>

			{slides > 1 ? (
				<View
					style={styles.pager}
					accessibilityElementsHidden
					importantForAccessibility="no"
				>
					{pagerKeys.map((id, index) => (
						<View
							key={id}
							style={[
								index === page ? styles.pagerActive : styles.pagerDot,
								{
									backgroundColor:
										index === page ? colors.foreground : colors.mutedForeground,
								},
							]}
						/>
					))}
				</View>
			) : null}
		</View>
	);
}

function cakeFill(index: number) {
	return CAKE[index % CAKE.length];
}

function SlidePlate({
	width,
	index,
	children,
}: {
	width: number;
	index: number;
	children: ReactNode;
}) {
	return (
		<View style={[styles.slide, { width }]}>
			<View style={[styles.card, { backgroundColor: cakeFill(index) }]}>
				{children}
			</View>
		</View>
	);
}

function CampaignSlide({ bowlWidth }: { bowlWidth: number }) {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<>
			<View style={styles.copy}>
				<View>
					<Text
						bold
						style={[styles.headline, { color: colors.foreground }]}
						maxFontSizeMultiplier={1.35}
					>
						{`${t("home.editorial.line1")}\n${t("home.editorial.line2")}\n${t("home.editorial.line3")}`}
					</Text>
					<Text
						variant="label"
						tone="muted"
						style={styles.lede}
						maxFontSizeMultiplier={1.35}
					>
						{`${t("home.editorial.lede1")}\n${t("home.editorial.lede2")}\n${t("home.editorial.lede3")}`}
					</Text>
				</View>
				<Pressable
					onPress={() => router.push("/featured")}
					accessibilityRole="button"
					accessibilityLabel={t("home.editorial.cta")}
					accessibilityHint={t("home.featured")}
					hitSlop={hitSlopFor(CTA_SIZE)}
					style={[
						styles.cta,
						{
							width: CTA_SIZE,
							height: CTA_SIZE,
							backgroundColor: colors.primary,
						},
					]}
				>
					<Ionicons
						name="arrow-forward"
						size={18}
						color={colors.primaryForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
			</View>

			<Pressable
				onPress={() => router.push("/featured")}
				accessibilityRole="button"
				accessibilityLabel={t("home.editorial.photo")}
				style={[
					styles.photoHit,
					styles.campaignPhoto,
					{ width: bowlWidth, height: bowlWidth * 0.92 },
				]}
			>
				<Image
					source={BOWL}
					resizeMode="contain"
					style={styles.photo}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Pressable>

			<View
				pointerEvents="none"
				style={[styles.sticker, shadow.card, { backgroundColor: colors.card }]}
				accessibilityElementsHidden
				importantForAccessibility="no"
			>
				<Ionicons
					name="heart-outline"
					size={14}
					color={colors.discount}
					style={styles.heart}
				/>
				<Text bold style={[styles.stickerText, { color: colors.foreground }]}>
					{`${t("home.editorial.sticker1")}\n${t("home.editorial.sticker2")}\n${t("home.editorial.sticker3")}`}
				</Text>
			</View>
		</>
	);
}

function PromotionSlide({
	promotion,
	bowlWidth,
}: {
	promotion: PromotionCard;
	bowlWidth: number;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();
	const { benefit, minimum, eligibility } = promotionCopy(
		promotion,
		t,
		intlLocale,
	);
	const condition = minimum ?? eligibility;
	const code = t("home.promotion.code", { code: promotion.code });
	const photo = promotion.art.kind === "photo" ? promotion.art.imageUrl : null;

	const openShop = () => {
		rememberOfferSelection(promotion.business.id, promotion);
		router.push({
			pathname: "/store/[slug]",
			params: { slug: promotion.business.slug },
		});
	};

	const spoken = [promotion.business.name, benefit, code, condition]
		.filter(Boolean)
		.join(" · ");

	return (
		<>
			<View style={[styles.copy, photo ? null : styles.copyWide]}>
				<View>
					<Text
						bold
						style={[
							styles.headline,
							styles.promoHeadline,
							{ color: colors.foreground },
						]}
						maxFontSizeMultiplier={1.35}
						numberOfLines={3}
					>
						{benefit}
					</Text>
					<Text
						variant="label"
						tone="muted"
						style={styles.lede}
						maxFontSizeMultiplier={1.35}
					>
						{promotion.business.name}
						{condition ? `\n${condition}` : ""}
					</Text>
				</View>
				<Pressable
					onPress={openShop}
					accessibilityRole="button"
					accessibilityLabel={spoken}
					accessibilityHint={t("home.promotion.help")}
					hitSlop={hitSlopFor(CTA_SIZE)}
					style={[
						styles.cta,
						{
							width: CTA_SIZE,
							height: CTA_SIZE,
							backgroundColor: colors.primary,
						},
					]}
				>
					<Ionicons
						name="arrow-forward"
						size={18}
						color={colors.primaryForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
			</View>

			{photo ? (
				<Pressable
					onPress={openShop}
					accessibilityRole="button"
					accessibilityLabel={spoken}
					accessibilityHint={t("home.promotion.help")}
					style={[
						styles.photoHit,
						{ width: bowlWidth, height: bowlWidth * 0.92 },
					]}
				>
					<RemoteImage
						uri={photo}
						resizeMode="contain"
						style={styles.photo}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
			) : null}

			<View
				pointerEvents="none"
				style={[styles.sticker, shadow.card, { backgroundColor: colors.card }]}
				accessibilityElementsHidden
				importantForAccessibility="no"
			>
				<Text bold style={[styles.stickerText, { color: colors.foreground }]}>
					{code}
				</Text>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	stage: {
		height: 365,
		marginTop: 13,
		overflow: "visible",
	},
	slide: {
		height: 365,
		paddingHorizontal: space.xxl,
		paddingBottom: 28,
	},
	card: {
		flex: 1,
		borderRadius: radius.xl,
		overflow: "hidden",
	},
	copy: {
		flex: 1,
		justifyContent: "space-between",
		paddingTop: space.xl,
		paddingBottom: space.xl,
		paddingLeft: space.xl,
		paddingRight: space.sm,
		zIndex: 5,
		maxWidth: "56%",
	},
	copyWide: {
		maxWidth: "100%",
		paddingRight: space.xl,
	},
	headline: {
		fontSize: 56,
		lineHeight: 47,
		letterSpacing: -2,
		fontWeight: "800",
	},
	promoHeadline: {
		fontSize: 40,
		lineHeight: 40,
		letterSpacing: -1.4,
	},
	lede: {
		marginTop: space.md,
		width: 168,
		fontSize: 13,
		lineHeight: 18,
	},
	cta: {
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		minWidth: 40,
		minHeight: 40,
	},
	photoHit: {
		position: "absolute",
		right: -20,
		bottom: -18,
		zIndex: 1,
	},
	campaignPhoto: {
		right: -8,
		bottom: 28,
		zIndex: 1,
	},
	photo: {
		width: "100%",
		height: "100%",
	},
	sticker: {
		position: "absolute",
		right: space.lg,
		bottom: space.lg,
		width: 103,
		height: 72,
		borderRadius: 18,
		paddingHorizontal: 12,
		paddingVertical: 10,
		transform: [{ rotate: "-8deg" }],
		zIndex: 3,
	},
	heart: { position: "absolute", top: 8, right: 10 },
	stickerText: { fontSize: 12, lineHeight: 16 },
	pager: {
		position: "absolute",
		left: space.xxl,
		bottom: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		zIndex: 2,
	},
	pagerActive: {
		width: 24,
		height: 2,
		borderRadius: 1,
	},
	pagerDot: {
		width: 6,
		height: 2,
		borderRadius: 1,
		opacity: 0.45,
	},
});
