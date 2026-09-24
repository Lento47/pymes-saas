import { type Currency, formatMoney } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { Text, type TextVariant } from "./text";

/**
 * Money, rendered the one way money is rendered.
 *
 * The amount arrives as an **integer in the currency's minor unit** and is not touched
 * before it reaches `formatMoney`. Not divided by 100 here, not multiplied anywhere: CRC
 * has no minor unit and is not divided at all, USD is, and the only code that knows which
 * is which is `currencyExponent` in `@pymeshub/shared`. Arithmetic at a call site is how
 * a colón price ends up off by two decimal places on one screen and right on another.
 *
 * `compareAtPriceMinor` is the "was" price — struck through, muted, and never the loudest
 * number in the row. `discountPercent` already comes computed from the API for the same
 * reason: the percentage is `discountPercentOf`, which rounds, and two roundings of the
 * same figure are two figures.
 *
 * The old price is struck **and** labelled by the discount badge beside it, so the saving
 * is legible without reading a colour — a strikethrough is a shape, and a red number on a
 * grey one is a difference somebody with a colour vision deficiency cannot see.
 */
export function Price({
	amountMinor,
	currency,
	variant = "heading",
	compareAtMinor,
	signed = false,
	style,
}: {
	amountMinor: number;
	currency: Currency;
	variant?: TextVariant;
	compareAtMinor?: number | null;
	signed?: boolean;
	/** Passed through to the row, not the amount. */
	style?: React.ComponentProps<typeof View>["style"];
}) {
	const { t, intlLocale } = useT();

	const compare =
		typeof compareAtMinor === "number" && compareAtMinor > amountMinor
			? compareAtMinor
			: null;

	return (
		<View style={[styles.row, style]}>
			<Text variant={variant} tone="price" tabular bold>
				{formatMoney(amountMinor, currency, { locale: intlLocale, signed })}
			</Text>
			{compare === null ? null : (
				<Text
					variant="label"
					tone="compare"
					tabular
					style={styles.compare}
					accessibilityLabel={t("product.compareAt", {
						amount: formatMoney(compare, currency, { locale: intlLocale }),
					})}
				>
					{formatMoney(compare, currency, { locale: intlLocale })}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.sm,
		flexWrap: "wrap",
	},
	compare: { textDecorationLine: "line-through" },
});
