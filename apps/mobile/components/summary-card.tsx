import { type CartTotals, type Currency, formatMoney } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { space, TEXT_STACK_GAP, type } from "@/theme";

import { Card } from "./card";
import { MoneyLine } from "./money-line";
import { Skeleton } from "./skeleton";
import { Text } from "./text";

/**
 * The receipt, drawn once and used in both places the app shows one before an order
 * exists: the cart and the checkout's review step.
 *
 * Two screens showing the same figures is two screens that can disagree, and the way they
 * disagree is never the arithmetic — it is a row that was added to one of them. A
 * `delivery` line that only the checkout draws, a discount that the cart forgets to hide
 * when it is zero, a tip row that appears in one place and not the other; each is a small
 * edit made in good faith on one screen, and the effect is a customer comparing two
 * receipts for one basket and finding them different. So both call sites draw *this*, and
 * a row that belongs on a receipt is added here or nowhere.
 *
 * ## The rows are in the order the arithmetic happens
 *
 * Subtotal, then what is taken off, then what is added, then the total: the column reads
 * downward as one calculation, so a customer checking the sum does it in the order the
 * API did. A discount is only drawn when there is one — a `-₡0` line is a row that says
 * "we considered giving you money and did not", and it makes the receipt longer than the
 * arithmetic is. The total is the one `strong` line, at `heading`, because it is the
 * number the eye should land on and the rows above it exist to explain it.
 *
 * ## The delivery fee
 *
 * The fee is not a property of the basket; it depends on the mode. The cart's totals always
 * carry `deliveryFeeMinor: 0` — the API zeroes it on purpose, because it cannot know yet
 * whether the customer will collect or have it brought — so the cart draws no delivery row
 * and the checkout draws one. That is the *only* difference the two are allowed, and the
 * cart's silence is honest rather than convenient: a fee shown there would be a fee for a
 * choice nobody has made.
 *
 * `showDelivery` therefore only ever *adds* a row. It adds one at zero as well, which is a
 * delivery order under a free-delivery promotion — a zero the customer should see, because
 * "Envío: ₡0" answers the question "what am I paying to have this brought?" and a missing
 * row answers it with silence. A non-zero fee is never hidden: there is no prop that does
 * that, and `docs/design-mobile.md` puts hiding the fee behind a tap in its out-list.
 *
 * ## Waiting
 *
 * Every amount is optional, and an absent one draws `MoneyLine`'s skeleton at the size of
 * the number that is coming, so the receipt does not reflow when the quote lands. That is
 * why there is no loading branch at either call site — an unknown figure is the same
 * receipt with one line still blank, not a different screen.
 */
export function SummaryCard({
	totals,
	showDelivery = false,
}: {
	/**
	 * The cart's totals or the checkout's quote — the API's own `CartTotals`, imported rather
	 * than copied.
	 *
	 * It used to be spelled out here, field by field, and by the time this was read it was
	 * already wrong: the copy was missing `missingForMinOrderMinor`, which `cartTotalsSchema`
	 * has carried since the minimum-order work, so this component's idea of a receipt was one
	 * field behind the type it claimed to be. A structural copy of a schema is a schema that
	 * drifts one field per feature, silently, because a missing field is not a type error when
	 * the consumer only reads the fields that are there. `null` is still allowed: the call sites
	 * pass a quote they do not have yet.
	 */
	totals?: CartTotals | null;
	/** Draw the delivery row even at zero. See the note above. */
	showDelivery?: boolean;
}) {
	const { t } = useT();
	const currency = totals?.currency;

	return (
		<Card>
			<View style={styles.rows}>
				<MoneyLine
					label={t("cart.subtotal")}
					amountMinor={totals?.subtotalMinor}
					currency={currency}
				/>

				{totals && totals.discountMinor > 0 ? (
					// Negated here, positive from the API: `discountAmountOf` stores the magnitude
					// (`packages/shared/src/money.ts`) and `formatMoney` prints the minus itself, so
					// the sign is the caller's to choose — and every web receipt chooses it
					// (`apps/web/app/(shop)/cart/page.tsx`). Unnegated, the same cart read as an
					// addition on the phone and a subtraction on the web, in a column whose own
					// docblock says it "reads downward as one calculation".
					<MoneyLine
						label={t("cart.discount")}
						amountMinor={-totals.discountMinor}
						currency={currency}
					/>
				) : null}

				{showDelivery ? (
					<MoneyLine
						label={t("cart.delivery")}
						amountMinor={totals?.deliveryFeeMinor}
						currency={currency}
					/>
				) : null}

				{totals && totals.taxMinor > 0 ? (
					<MoneyLine
						label={t("cart.tax")}
						amountMinor={totals.taxMinor}
						currency={currency}
					/>
				) : null}

				{totals && totals.tipMinor > 0 ? (
					<MoneyLine
						label={t("cart.tip")}
						amountMinor={totals.tipMinor}
						currency={currency}
					/>
				) : null}

				<MoneyLine
					label={t("cart.total")}
					amountMinor={totals?.totalMinor}
					currency={currency}
					strong
				/>
			</View>
		</Card>
	);
}

/**
 * The total, for a bar that has one line of width to say it in.
 *
 * `./action-bar`'s summary slot is a strip beside a pill button, which is not enough room
 * for a receipt — so this is the same figure `SummaryCard`'s last row draws, in the shape a
 * bar can hold: the label above the amount rather than beside it, because a name and a
 * number side by side in a narrow column truncate the number, and the number is the half
 * that matters.
 *
 * It exists here, beside the receipt, for the same reason the receipt exists: the cart's bar
 * and the checkout's bar show one number, and a customer walking from one screen to the
 * other must see the same figure drawn the same way. Two call sites, one component.
 *
 * The a11y contract is `MoneyLine`'s, deliberately: label and amount are one accessible
 * node whose spoken text comes from the same `formatMoney` the printed one does, and an
 * amount that has not arrived is a skeleton rather than a dash — "₡0" is a price and a blank
 * is a bug, and neither is what "not yet" means.
 *
 * ## The amount is in `colors.price`
 *
 * Rule 1 asks for three things of the loud money on a surface, and the bar's figure is the
 * loudest thing on the cart and the checkout: `colors.price`, `tabular-nums` (the `tabular`
 * prop, so the digits do not jitter while the quote polls under them) and the largest type on
 * the surface. It had the second and the third and not the first — the amount was drawn in the
 * default ink, which is the same colour as the label above it. That is a reading error rather
 * than a taste one: two lines in one colour, one of them 12/16 and one 17/24, are a label and a
 * number *only* while the size difference survives, and at 200% text on a narrow bar the pair
 * is two lines of similar weight where the eye has nothing else to sort them by. `colors.price`
 * is a token with its own contrast pair (`#006533` on `card` in light, `#76e1a7` in dark),
 * which is the ink the whole app uses for a figure it wants read as money.
 *
 * ## The skeleton is the height of the node it stands in for
 *
 * The placeholder was `type.heading.lineHeight` — 24 — and the thing it replaces is the caption
 * (16) plus the amount (24), i.e. 40. Sixteen points of jump, in the one place a bar has no room
 * to absorb one: the bar is at the foot of the screen, so the difference is the receipt behind it
 * moving up or down as the quote lands. A skeleton is a promise about the shape of the thing that
 * is coming, and a promise that is a step short is the reflow it exists to prevent.
 */
export function BarTotal({
	label,
	amountMinor,
	currency,
}: {
	label: string;
	amountMinor?: number;
	currency?: Currency;
}) {
	const { intlLocale } = useT();
	const waiting = amountMinor === undefined || currency === undefined;

	if (waiting) {
		return (
			<View style={styles.total}>
				<Skeleton style={styles.totalSkeleton} label={label} />
			</View>
		);
	}

	return (
		<View
			style={styles.total}
			accessible
			accessibilityLabel={`${label}: ${formatMoney(amountMinor, currency, {
				locale: intlLocale,
			})}`}
		>
			<Text variant="caption" tone="muted">
				{label}
			</Text>
			{/* `tabular` so the digits do not jitter as the quote polls underneath it, `heading`
			    so it is the largest thing in the bar — the number a person checks before spending
			    is not a caption — and `price` so it is the ink this app draws money in. See the
			    docblock: it had size and digits and not the colour, which left the number the same
			    colour as its own label. */}
			<Text variant="heading" tone="price" bold tabular>
				{formatMoney(amountMinor, currency, { locale: intlLocale })}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	rows: { gap: space.sm },
	// `flexShrink` so it gives way to the bar's button rather than pushing it off the row;
	// a total that cannot shrink would take the CTA's width instead of wrapping. See
	// `./action-bar`'s summary slot, which is the layout this is written for. The gap is
	// `TEXT_STACK_GAP`: the label and the amount are one fact about the cart, one text
	// stack — the same gap the store and home summary stacks now pay.
	total: { flexShrink: 1, minWidth: 0, gap: TEXT_STACK_GAP },
	// The caption's 16 plus the amount's 24, which is the two-line node above. It was the amount
	// alone, and the 16 that was missing is the reflow the skeleton exists to prevent — the bar
	// is at the floor of the screen, so the whole receipt above it moves when this changes height.
	totalSkeleton: {
		width: "70%",
		height: type.caption.lineHeight + type.heading.lineHeight,
	},
});
