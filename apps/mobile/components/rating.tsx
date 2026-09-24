import Ionicons from "@expo/vector-icons/Ionicons";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { formatOneDecimal } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { icon, space, useTheme } from "@/theme";

import { Text, type TextVariant } from "./text";

/**
 * What other people made of this shop or this dish.
 *
 * Two rules from `docs/design-mobile.md`'s table meet here. **Social proof is a real
 * number from a real row** — `rating` and `count` arrive from the API and nothing on this
 * component computes, rounds up or invents either; the average is printed at one decimal
 * because that is the precision `ratingAvg` is stored at, and a "4.5" that was really a
 * 4.47 is the kind of small lie the whole table is about. And **colour is never the only
 * signal**: the star is decoration beside the number and the word, so the row still reads
 * with the amber gone.
 *
 * ## No rating is drawn as no rating
 *
 * A shop nobody has rated renders nothing — not "0.0", not an empty star, not a grey
 * "Sin reseñas" on every card in a feed. The API says the same thing by sending `rating:
 * null` rather than `rating: 0`, and reading that as "we have nothing to say here" is the
 * honest use of it: a new shop looks new rather than badly reviewed.
 *
 * ## The words
 *
 * The count is `store.rating.count` — "1 reseña" / "N reseñas" — on a product as well as on a
 * shop, because a review is the same fact in both places. The key's `store.` prefix is the
 * only thing wrong with it and the dictionary is the file that owns that; a second key holding
 * the identical sentence would be the worse fix.
 *
 * It is read with `tp`, not `t`. This line used to be `t("store.rating.count", { count })` on
 * a key with no `_plural` sibling, so a shop with exactly one review read **"1 reseñas"** —
 * and `t` is structurally the wrong call for anything carrying a count, because it cannot see
 * the sibling even once one exists. `tp` takes `PluralKey`, which admits only keys that have
 * one, so the mistake is a compile error now rather than a sentence on a screen.
 */

export function Rating({
	rating,
	count,
	/** Off for a dense row, where the number alone is the whole message. */
	showCount = true,
	variant = "label",
	style,
}: {
	/** `ratingAvg` / `rating` from the API. `null` means nobody has rated this yet. */
	rating: number | null;
	/** `ratingCount` / `reviewCount` — the row behind the average. */
	count: number;
	showCount?: boolean;
	variant?: TextVariant;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { tp, intlLocale } = useT();

	if (rating === null || count < 1) return null;

	const value = formatOneDecimal(rating, intlLocale);

	return (
		<View style={[styles.row, style]}>
			<Ionicons
				name="star"
				// Every variant takes `icon.inline`, which is what this line now says. It used
				// to read `variant === "label" ? 13 : icon.inline` — two sizes, the common one
				// a bare pixel value — with a comment admitting the file could not say why they
				// differed. The answer is in `theme/tokens.ts`, which names *this mark* under
				// `inline`, in the list of glyphs that are "all drawn at the same size, which
				// is what the name is for": the star on the default variant, which is every
				// storefront, dish and search result, was the file making the token's own
				// docblock untrue.
				//
				// 15 rather than 13 is a deliberate 2-point change. There is no 13 step on the
				// icon scale for a glyph to take, and a bare pixel value where a token exists is
				// the first line of the review bar in `docs/design-mobile.md`. The star on a card
				// is now the size the shield-check on that same card is drawn at.
				size={icon.inline}
				color={colors.rating}
				// Decoration around a number and a word. Announced, it would read as an
				// unlabelled image before "4.5" on every row of a menu.
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant={variant} tabular bold>
				{value}
			</Text>
			{showCount ? (
				<Text variant="caption" tone="muted">
					{tp("store.rating.count", count)}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		// At 200% text the three pieces stop fitting on one line of a card, and a wrap is
		// the answer — the number stays whole, which is the part that must not clip.
		flexWrap: "wrap",
	},
});
