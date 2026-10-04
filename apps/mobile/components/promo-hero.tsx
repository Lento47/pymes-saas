import Ionicons from "@expo/vector-icons/Ionicons";
import type { PromotionCard as Promotion } from "@pymeshub/shared";
import { router } from "expo-router";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import {
	type OfferSelection,
	rememberOfferSelection,
} from "@/lib/offer-intent";
import { promotionCopy } from "@/lib/promotion";
import { icon, radius, space, TEXT_STACK_GAP, useTheme } from "@/theme";
import { AnimateIn } from "./animate-in";
import { Card } from "./card";
import { Text } from "./text";

/**
 * A shop's offer, at the size of the thing it is advertising.
 *
 * A promotion draws on exactly one surface now, and it is this one: the feed's own
 * banner, the one promotion a reader sees before they have decided to browse anything.
 * Its dark spotlight separates the offer from the Home gradient while the code chip
 * carries the brand fill (`./card`'s `tone="spotlight"`).
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
 * What is loud here is the code chip, one mark rather than four competing
 * numbers — which is the failure Rule 1 actually names ("price, promo, rating and a badge
 * all shout, so the customer reads none of them").
 *
 * ## No photograph, and that is the rule rather than a gap
 *
 * There is no `image` on `PromotionCard` and none is invented here. Rule 3: draw the
 * photograph the data has, and never one it does not — no stock image, no gradient standing
 * in for one. What the data has is a *kind*, a *value*, a *code* and a *shop*, so the
 * banner is composed of type on a dark neutral surface, which a promotion photograph
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
 * The code's minimum is stated when it has one. `redemptions`, `startsAt` and `endsAt`
 * stay off the payload, so no countdown or invented hurry is drawn here. The feed has
 * already filtered those three before answering.
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
	const { colors, scheme } = useTheme();
	const spotlightInk =
		scheme === "dark" ? colors.accentForeground : colors.background;
	const { t, intlLocale } = useT();

	const { benefit, minimum, eligibility } = promotionCopy(
		promotion,
		t,
		intlLocale,
	);
	const condition = minimum ?? eligibility;
	const code = t("home.promotion.code", { code: promotion.code });

	const spoken = [promotion.business.name, benefit, code, condition]
		.filter(Boolean)
		.join(" · ");

	return (
		<AnimateIn index={index} style={style}>
			<Card
				tone="spotlight"
				style={style}
				onPress={() => {
					rememberOfferSelection(promotion.business.id, promotion);
					router.push({
						pathname: "/store/[slug]",
						params: { slug: promotion.business.slug },
					});
				}}
				accessibilityLabel={spoken}
				accessibilityHint={t("home.promotion.help")}
			>
				<View style={styles.body}>
					{/* The shop is the caption: whose offer this is comes before what it is
					    worth, because that is the order a reader decides to care in. */}
					<Text variant="caption" style={{ color: spotlightInk }}>
						{promotion.business.name}
					</Text>

					<Text variant="heading" bold style={{ color: spotlightInk }}>
						{benefit}
					</Text>

					<View style={styles.codeRow}>
						{/* `tabular` because a code is read off one character at a time. */}
						<View style={[styles.chip, { backgroundColor: colors.primary }]}>
							<Text variant="label" tone="inverse" bold tabular>
								{code}
							</Text>
						</View>
						<View style={styles.browseCue}>
							<Text variant="label" style={{ color: spotlightInk }}>
								{t("home.promotion.browse")}
							</Text>
							<Ionicons
								name="arrow-forward"
								size={icon.control}
								color={spotlightInk}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</View>
					</View>
					{condition ? (
						<Text variant="label" style={{ color: spotlightInk }}>
							{condition}
						</Text>
					) : null}
				</View>
			</Card>
		</AnimateIn>
	);
}

export function PromoReminder({
	offer,
	compact = false,
}: {
	offer: OfferSelection;
	compact?: boolean;
}) {
	const { colors, scheme } = useTheme();
	const { t, intlLocale } = useT();
	const spotlightInk =
		scheme === "dark" ? colors.accentForeground : colors.background;
	const { benefit, minimum, eligibility } = promotionCopy(offer, t, intlLocale);
	const condition = minimum ?? eligibility;
	const codeLabel = t("home.promotion.code", { code: offer.code });
	const readyLabel = t("store.promotion.ready");

	if (compact)
		return (
			<View
				style={styles.cue}
				accessible
				accessibilityLabel={[benefit, codeLabel, readyLabel, condition]
					.filter(Boolean)
					.join(". ")}
			>
				<View
					style={[
						styles.chip,
						styles.cueChip,
						{ backgroundColor: colors.primary },
					]}
				>
					<Text variant="label" tone="inverse" bold tabular>
						{codeLabel}
					</Text>
				</View>
				<View style={styles.cueDetail}>
					<Text variant="label" bold>
						{benefit}
					</Text>
					<Text variant="caption" tone="muted">
						{readyLabel}
					</Text>
					{condition ? (
						<Text variant="caption" tone="muted">
							{condition}
						</Text>
					) : null}
				</View>
			</View>
		);

	return (
		<Card tone="spotlight">
			<View style={styles.body}>
				<Text variant="heading" bold style={{ color: spotlightInk }}>
					{benefit}
				</Text>
				<View style={[styles.chip, { backgroundColor: colors.primary }]}>
					<Text variant="label" tone="inverse" bold tabular>
						{codeLabel}
					</Text>
				</View>
				<Text variant="caption" style={{ color: spotlightInk }}>
					{readyLabel}
				</Text>
				{condition ? (
					<Text variant="caption" style={{ color: spotlightInk }}>
						{condition}
					</Text>
				) : null}
			</View>
		</Card>
	);
}

const styles = StyleSheet.create({
	// The banner is a hero: `lg` inside as well as out, which is the step
	// `docs/design-mobile.md` gives "sheets and heroes". The gap is `TEXT_STACK_GAP` because
	// the lines are one text stack — the same number `./product-tile` stacks its body
	// at, and the one `theme/tokens.ts` names for `./business-card` and `./product-row`. The
	// vertical padding is `./card`'s own, so none is added here.
	body: { gap: TEXT_STACK_GAP },
	// The code's row is part of the stack, so it carries no margin of its own: the
	// stack's gap is its spacing, and a `marginTop` here stacked on top of the gap and gave
	// the step between the benefit and the code 6 points while the other pairs sat at 2.
	codeRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: space.sm,
	},
	browseCue: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		flexShrink: 1,
	},
	cue: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		flexWrap: "wrap",
	},
	cueChip: { maxWidth: "100%" },
	cueDetail: {
		flexGrow: 1,
		flexShrink: 1,
		minWidth: 120,
		gap: TEXT_STACK_GAP,
	},
	chip: {
		alignSelf: "flex-start",
		paddingHorizontal: space.md,
		paddingVertical: space.xs,
		borderRadius: radius.full,
	},
});
