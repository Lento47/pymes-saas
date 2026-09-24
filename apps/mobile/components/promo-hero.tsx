import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMoney, type PromotionCard as Promotion } from "@pymeshub/shared";
import { router } from "expo-router";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { PROMOTION_LABELS } from "@/lib/promotion";
import { icon, radius, space, TEXT_STACK_GAP, useTheme } from "@/theme";
import { AnimateIn } from "./animate-in";
import { Card } from "./card";
import { Text } from "./text";

/**
 * A shop's offer, at the size of the thing it is advertising.
 *
 * A promotion draws on exactly one surface now, and it is this one: the feed's own
 * banner, the one promotion a reader sees before they have decided to browse anything,
 * and the only surface in the app that wears the brand fill (`./card`'s `tone="brand"`).
 * The shelf-size coupon rail it used to share the fact with (`./promotion-card`) was
 * deleted when the feed's rail became this banner — `lib/promotion.ts` records the
 * retirement — and the rail tile the feed's other shelves draw is `./product-tile`, a
 * product surface, not a second promotion surface.
 *
 * ## Rule 1, and how a banner stays the second loudest thing on a browse screen
 *
 * `docs/design-mobile.md` Rule 1 gives the fold to one element and the feed's is the search
 * field and the first shop card. A banner that competed with it would make two loud things
 * and therefore none — so this surface defers where it can and states its fact where it
 * must: the benefit is `title`, not `display`; the shop is a caption; the code is a chip.
 * What is loud here is the *fill*, and a fill is one mark rather than four competing
 * numbers — which is the failure Rule 1 actually names ("price, promo, rating and a badge
 * all shout, so the customer reads none of them").
 *
 * ## No photograph, and that is the rule rather than a gap
 *
 * There is no `image` on `PromotionCard` and none is invented here. Rule 3: draw the
 * photograph the data has, and never one it does not — no stock image, no gradient standing
 * in for one. What the data has is a *kind*, a *value*, a *code* and a *shop*, so the
 * banner is composed of type on the brand fill, which is what a promotion with a photograph
 * will simply replace at `./image`'s size when one exists. The demo catalogue carries no
 * imagery at all (`packages/db/src/seed.ts`), so this composed surface is what ships.
 *
 * ## The whole banner is the target, and the code is drawn *and* spoken
 *
 * Its tap opens the shop the code belongs to — `home.promotion.help` says so, and it is the
 * half of the press a banner with no chevron cannot draw. `home.promotion.code` is composed
 * into the `accessibilityLabel` as well as drawn in the chip, so the code a reader hears is
 * the code a reader sees.
 *
 * `minOrderMinor`, `redemptions`, `startsAt` and `endsAt` are not on the payload
 * (`packages/shared/src/schemas/catalog.ts` says why, at length) so no threshold, no
 * countdown and no "ends in 2 days" is drawn here. `docs/design-mobile.md` outlaws an
 * invented hurry in any case; what arrives is already live, because the feed filtered on
 * all four before answering.
 */
export function PromoHero({
	promotion,
	index,
	style,
}: {
	promotion: Promotion;
	/** This banner's position in the rail, so the entrance staggers. */
	index: number;
	/** The caller owns the width — the same contract `./product-tile` has. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();

	// `FIXED` is money and needs the currency that travelled beside it; the other two kinds
	// carry none, so their sentences have no `{amount}` slot to fill. The one branch of its
	// kind in the app now that the coupon rail is gone — deliberately the only copy of this
	// arithmetic, so there is no second one to drift.
	const money =
		promotion.kind === "FIXED"
			? formatMoney(promotion.value, promotion.currency, { locale: intlLocale })
			: "";

	const benefit = t(PROMOTION_LABELS[promotion.kind], {
		percent: String(promotion.value),
		amount: money,
	});

	const code = t("home.promotion.code", { code: promotion.code });

	const spoken = `${promotion.business.name} · ${benefit} · ${code}`;

	return (
		<AnimateIn index={index} style={style}>
			<Card
				tone="brand"
				style={style}
				onPress={() =>
					router.push({
						pathname: "/store/[slug]",
						params: { slug: promotion.business.slug },
					})
				}
				accessibilityLabel={spoken}
				accessibilityHint={t("home.promotion.help")}
			>
				<View style={styles.body}>
					{/* The shop is the caption: whose offer this is comes before what it is
					    worth, because that is the order a reader decides to care in. */}
					<Text variant="caption" tone="inverse">
						{promotion.business.name}
					</Text>

					<Text variant="title" bold tone="inverse">
						{benefit}
					</Text>

					<View style={styles.codeRow}>
						{/* The chip is `card` on the brand fill — the one surface in this app
						    where white is the *quiet* colour. `tabular` because a code is read
						    off one character at a time. */}
						<View style={[styles.chip, { backgroundColor: colors.card }]}>
							<Text variant="label" tone="primary" bold tabular>
								{code}
							</Text>
						</View>
						<Ionicons
							name="arrow-forward"
							size={icon.control}
							color={colors.primaryForeground}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</View>
				</View>
			</Card>
		</AnimateIn>
	);
}

const styles = StyleSheet.create({
	// The banner is a hero: `lg` inside as well as out, which is the step
	// `docs/design-mobile.md` gives "sheets and heroes". The gap is `TEXT_STACK_GAP` because
	// the three lines are one text stack — the same number `./product-tile` stacks its body
	// at, and the one `theme/tokens.ts` names for `./business-card` and `./product-row`. The
	// vertical padding is `./card`'s own, so none is added here.
	body: { gap: TEXT_STACK_GAP },
	// The code's row is the stack's third line, so it carries no margin of its own: the
	// stack's gap is its spacing, and a `marginTop` here stacked on top of the gap and gave
	// the step between the benefit and the code 6 points while the other pairs sat at 2.
	codeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	chip: {
		alignSelf: "flex-start",
		paddingHorizontal: space.md,
		paddingVertical: space.xs,
		borderRadius: radius.full,
	},
});
