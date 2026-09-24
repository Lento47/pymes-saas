import { type Currency, formatMoney } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { space, type } from "@/theme";

import { Price } from "./price";
import { Skeleton } from "./skeleton";
import { Text } from "./text";

/**
 * One figure and its name: "Envío" on the left, "₡1.500" on the right.
 *
 * The receipt shape, in all three places the app shows one — the cart, the checkout's
 * review step and an order's detail — so the delivery fee is the same line in the same
 * place on the screen before the order and on the screen after it. That consistency is not
 * cosmetic: a customer comparing what they agreed to with what they were charged should be
 * comparing numbers, not layouts.
 *
 * `strong` is the total's line, and it is also the only one drawn at `heading`: the sum is
 * the number the eye should land on, and the column above it exists to explain it.
 *
 * **`amountMinor` is optional, and its absence means "not yet".** The amount arrives as an
 * integer in the currency's minor unit and is passed to `Price` untouched — nothing here
 * divides anything, and no money is formatted outside `formatMoney`. A line waiting for its
 * number draws a `Skeleton` at the width and height the number will occupy, so the receipt
 * does not reflow when the quote lands.
 */
export function MoneyLine({
	label,
	amountMinor,
	currency,
	strong = false,
}: {
	label: string;
	amountMinor?: number;
	currency?: Currency;
	strong?: boolean;
}) {
	const { intlLocale } = useT();
	const waiting = amountMinor === undefined || currency === undefined;

	return (
		<View
			style={styles.line}
			// The label and the number are one fact, so a screen reader gets them together
			// rather than as a name followed by a bare figure with no idea whose it is. The
			// figure is spoken through the same `formatMoney` the printed one comes from, in
			// the reader's own locale, so the two cannot disagree about a separator.
			accessible
			accessibilityLabel={
				waiting
					? label
					: `${label}: ${formatMoney(amountMinor, currency, { locale: intlLocale })}`
			}
		>
			<Text
				variant={strong ? "heading" : "body"}
				tone={strong ? "default" : "muted"}
				bold={strong}
				// `flexShrink` so a long label wraps at 200% text instead of pushing its
				// figure past the right edge — the same yield every trailing-money row makes,
				// and the reason money never leaves the row.
				style={styles.label}
			>
				{label}
			</Text>
			{waiting ? (
				// The height the number will occupy, which is the `strong` line when this is the
				// receipt's total — a static `body` height left the grey block 3 points short of the
				// figure it stands in for, and the docblock above claims it matches exactly.
				//
				// The height alone is not enough, and `styles.amount` carries the other half. This
				// line is `alignItems: "baseline"`, and a bare `View` has no baseline of its own:
				// Yoga measures a non-text node from its bottom edge. So the grey block sat *on*
				// the label's baseline — which is below the label's visual bottom by the font's
				// descender space — and the receipt twitched when the quote landed. Matching the
				// line box while staying in the baseline calculation only moved the error.
				<Skeleton
					style={[
						styles.amount,
						{
							height: type[strong ? "heading" : "body"].lineHeight,
							// The width the figure will occupy: four of the tabular figures' em at
							// the size this line draws — symbol, thousands separator and four
							// digits at 100% text. A number's width is the type's, so it is
							// derived from the same variant the loaded `Price` draws, and the
							// `strong` total's grey block is as wide as a `heading` figure needs.
							width: type[strong ? "heading" : "body"].fontSize * 4,
						},
					]}
				/>
			) : (
				<Price
					amountMinor={amountMinor}
					currency={currency}
					variant={strong ? "heading" : "body"}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	line: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
	},
	// The label yields to the figure; the figure keeps its intrinsic width.
	label: { flexShrink: 1 },
	// The waiting block's alignment only; its width arrives in the render, derived from the
	// line's own variant, because a price's width is a property of the type it is set at and
	// not of this row.
	//
	// `alignSelf: "center"` takes the waiting `Skeleton` out of the row's baseline alignment —
	// see the render above for why a placeholder must not be in it. It is on this style and not
	// on `line`, so the loaded rows, which are two `Text`s and *should* share a baseline, are
	// untouched.
	amount: { alignSelf: "center" },
});
