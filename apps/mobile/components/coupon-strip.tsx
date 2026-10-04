import Ionicons from "@expo/vector-icons/Ionicons";
import { type Currency, formatMoney } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { icon, radius, space, TEXT_STACK_GAP, useTheme } from "@/theme";

import { Card } from "./card";
import { Text } from "./text";

/**
 * The strip above the cart bar: the next useful action toward the shop's minimum order.
 *
 * It is the shape the design for this screen gives the slot — a ticket, one loud line, a
 * way forward — and the *fact* is deliberately different from the one in that design's
 * example. "Ahorra ₡2 500 en tu próximo pedido de ₡10 000 o más" is a promotion carrying a
 * code-specific threshold, which `./promo-hero` now states on the feed. This strip instead
 * describes the shop's separate minimum order for the customer's current basket.
 *
 * What this strip can state truthfully about a threshold is about **this basket**, and it
 * comes with the number already computed: `cart.totals.missingForMinOrderMinor`, the gap to
 * the shop's own minimum. The sentence names the shop whose products can close that gap,
 * rather than sending the customer back to a cart they already know is short. Codes live
 * where they belong: `./promo-hero` at the top of the feed, and the cart's own code field.
 *
 * Two consequences of that choice, both deliberate:
 *
 * - **It is drawn only when the gap exists.** `missingForMinOrderMinor > 0` is the condition,
 *   so a basket that clears the minimum — or an empty one — gets no strip. A "you're almost
 *   there" that is not true is the pressure `docs/design-mobile.md` rules out.
 * - **It opens that shop.** The cart summary beside it already opens the cart. The shortfall
 *   needs products from the same business, so this chevron leads to its menu.
 *
 * The disc is filled `accent`, the glyph in `accentForeground` — the palette's *light*
 * brand pair, the fill a category tile (`./category-rail`) wears at rest — because
 * `./promo-hero` reserves the stronger `primary` fill for the promotion code chip.
 * The glyph is `cash-outline`,
 * the same mark `app/store/[slug]` draws for a shop's `store.minOrder.short`: one fact,
 * one mark, on both surfaces.
 */
export function CouponStrip({
	amountMinor,
	currency,
	businessName,
	onPress,
}: {
	/** The gap to the minimum, in the currency's minor unit. Never divided at a call site. */
	amountMinor: number;
	currency: Currency;
	businessName: string;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();

	const amount = formatMoney(amountMinor, currency, { locale: intlLocale });
	const sentence = t("home.minOrder.next", { amount, business: businessName });

	return (
		<Card
			onPress={onPress}
			accessibilityLabel={sentence}
			accessibilityHint={t("home.minOrder.help")}
			// Flat: no `shadow.card` lift. The strip sits one screen above the
			// floating `ActionBar`, and two lifted cards 8pt apart read as one
			// surface split in two — the bar keeps the lift, this keeps the border.
			style={{ elevation: 0, shadowOpacity: 0, boxShadow: "none" }}
		>
			<View style={styles.row}>
				<View style={[styles.disc, { backgroundColor: colors.accent }]}>
					<Ionicons
						name="cash-outline"
						size={icon.action}
						color={colors.accentForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</View>

				<View style={styles.body}>
					{/* No `numberOfLines`, as everywhere else: at 200% the sentence wraps and
					    the strip grows rather than losing the number, which is the figure the
					    whole row exists for. */}
					<Text variant="body" bold>
						{sentence}
					</Text>
				</View>

				<Ionicons
					name="chevron-forward"
					size={icon.control}
					color={colors.mutedForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
		</Card>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	// 40 and its own number rather than a token: it is a mark sized to the disc it fills,
	// which is the case `theme/tokens.ts` says is sized where it is used (the media stand-ins
	// are three such sizes and are not a scale). The row's target is the `./card` around it.
	// The `accent` fill is not here because a StyleSheet cannot read `useTheme()` — it rides
	// the render, the way `./product-tile`'s quick-add disc takes its `primary`.
	disc: {
		width: 40,
		height: 40,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	body: { flex: 1, gap: TEXT_STACK_GAP, alignItems: "flex-start" },
});
