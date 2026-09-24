import { useCallback, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, shadow, space, type, useTheme } from "@/theme";

import { BUTTON_BORDER_WIDTH, Button, type ButtonVariant } from "./button";

/**
 * What a bar covers, measured off this file's own styles rather than off a screenshot.
 *
 * A screen whose content scrolls under a bar has to reserve this much room, or the last row
 * of its list sits permanently behind the button. That reservation is a number about *this*
 * component, so it is derived here and imported by the two screens that need it — it used to
 * be a `const = 88` written out twice, and a bar that grows by four points would have left
 * both of them four points short with nothing to catch it.
 *
 * The sum, from the styles at the bottom of this file and `./button`'s own:
 *
 * - `floating.marginBottom` — `space.sm`, 8. The lift's gap above the screen's floor.
 * - `bar.paddingTop` — `space.md`, 12.
 * - the `lg` button's border box — `space.lg * 2 + type.heading.lineHeight + 2` = 32 + 24 + 2
 *   = 58, which is `./button`'s `lg` padding plus the heading line every label is drawn at,
 *   plus the two hairlines its `borderWidth: 1` adds to the box. The border counts because
 *   `onLayout` measures border boxes, and `./skeletons`' `buttonHeight` counts the same two
 *   for the same reason; leaving them out is how the seed came up two points short of the
 *   bar it was reserving room for.
 * - `{ paddingBottom: space.md + insets.bottom }` at the call site — `space.md`, 12, and the
 *   inset on top of it, which is the caller's to add because only the caller has the insets.
 *
 * 8 + 12 + 58 + 12 = 90. The two local copies this replaced had arrived at 88 by leaving the
 * button's hairlines out of the sum. Only the home-indicator inset is left for those screens
 * to add, which is what both already do.
 *
 * `docked` bars are the same height minus `floating.marginBottom`, and no screen reserves
 * room for one: a docked bar is the footer of a form that is sized to its content, so there
 * is nothing scrolling under it to be covered.
 *
 * ## 90 is right at 100% text and only at 100% text
 *
 * Every term in that sum but the line is a token that does not move; the line does. At 200%
 * text the button's label is twice as tall — the arithmetic `./skeletons`'s `line()` and
 * `./status-badge`'s `statusBadgeHeight` already do, scaling a line height by `fontScale` and
 * the padding by nothing — and, past a certain label width, the row **wraps** and the button
 * takes a line of its own (see the component's own note below), which makes the bar roughly
 * twice this number.
 *
 * The first half is arithmetic and the second is a measurement of a *string* at the reader's
 * own text size, which no constant can predict. So the constant is the **seed** — what a screen
 * reserves before the bar has reported anything — and `useActionBarClearance` is how a screen
 * gets the real number instead.
 */
export const ACTION_BAR_CLEARANCE =
	space.sm +
	space.md * 2 +
	space.lg * 2 +
	type.heading.lineHeight +
	BUTTON_BORDER_WIDTH * 2;

/**
 * The room a screen must leave for the bar, measured off the bar rather than predicted.
 *
 * Two branches, because there are two ways for a screen to get this wrong and they pull in
 * opposite directions:
 *
 * - **The first frame.** Before anything has been laid out there is nothing to measure, so the
 *   seed is `ACTION_BAR_CLEARANCE` **plus the bottom inset**. Those are the two terms a caller
 *   used to add by hand at the call site, and getting either wrong is a visible defect: too
 *   small and the last row of the list sits under the button, too large and there is a band of
 *   dead space above it that reads as a mistake.
 * - **Every frame after it.** `onLayout`'s `height` is the bar's border box, so it already
 *   contains the bar's own `paddingBottom` — which is `space.md + insets.bottom`, because the
 *   bar pays the home indicator itself (`./action-bar`'s docblock, and the reason a screen with
 *   a bar must not pass `bottomInset` to `./screen`). What it does not contain is the lift's
 *   `marginBottom`, which is outside the border box and is added back here.
 *
 * **The returned number is complete.** A caller sets it as the scroll's `paddingBottom` and
 * adds nothing — in particular *not* the bottom inset, which both call sites used to add and
 * which the measured path already includes. Adding it again reserves 34 dead points above the
 * bar on every phone with a home indicator, and only on those phones, which is the shape of bug
 * that survives a review on a simulator with a home button.
 *
 * `docked` bars need none of this: it is the footer of a form, and nothing scrolls under it.
 */
export function useActionBarClearance(): {
	clearance: number;
	onHeightChange: (height: number) => void;
} {
	const insets = useSafeAreaInsets();
	// `null` rather than 0 for "not measured yet": 0 is a real height a degenerate layout can
	// report, and it would take the room away on the frame it arrived.
	const [measured, setMeasured] = useState<number | null>(null);

	const onHeightChange = useCallback((height: number) => {
		// Zero is refused for the same reason: a bar mid-layout, or a bar in a tree that is
		// hidden, reports 0 and would otherwise collapse the reservation underneath it.
		if (height <= 0) return;
		setMeasured((current) => (current === height ? current : height));
	}, []);

	return {
		clearance:
			measured === null
				? ACTION_BAR_CLEARANCE + insets.bottom
				: measured + space.sm,
		onHeightChange,
	};
}

/**
 * The thing at the bottom of the screen that says what happens next.
 *
 * A cart, a checkout and a product all end the same way: a summary on the left and the one
 * action the screen exists for on the right. Written once here so that the total and the
 * button cannot drift apart between three screens, and so the *bottom inset* is paid in
 * exactly one place.
 *
 * ## The inset, and the double-payment it prevents
 *
 * The bar owns its own bottom inset. A screen that renders an `ActionBar`
 * must therefore **not** pass `bottomInset`
 * to `Screen`: `Screen`'s bottom inset is for a screen whose content runs to the floor, and
 * a screen with a bar over the home indicator is not that screen. Paying it in both places
 * is the version that leaves a 34pt gap above the bar on an iPhone and looks deliberate.
 *
 * ## Floating against docked
 *
 * `floating` is the default because the bar sits *over* a scroll the reader can still see
 * moving behind it — a card that has been lifted off the page. `docked` is for a screen
 * whose content is a form and where a floating card would cover the field being typed in:
 * it is the full width of the screen, square-shouldered, with a hairline instead of a lift.
 * The two are one component because the *contents* are identical and the summary must not
 * reflow differently between them.
 *
 * ## Two things on one line, at any text size
 *
 * The bar is one row of two items, and until this was read the row could not wrap. That is
 * invisible at 100% and wrong at 200%: `./button`'s label has no `numberOfLines`, so it grows
 * with the text scale, and the button's main-axis size is its label's width with `flexShrink: 0`
 * — it cannot give way. The summary beside it has `flexBasis: 0` and grows into whatever is
 * left, so when the label is wider than the bar there is nothing left: **the total collapses to
 * zero width and vanishes.** Not truncated, not ellipsized — gone, in the one configuration
 * where the reader needs it most, on the one element Rule 1 calls the loudest thing on the
 * surface. A bar whose total cannot be read at 200% text is not a layout preference.
 *
 * Two properties, each answering one half of that:
 *
 * - `flexWrap: "wrap"` on the bar, so the two items are allowed to be two lines. Where the row
 *   cannot hold both, the button takes a second line and the summary keeps the first, where it
 *   has the whole width to itself and grows into it. The bar gets taller and still says
 *   everything, which is the same trade `./button` makes for its own label.
 * - `maxWidth: "100%"` on the button, so the line it lands on bounds it. `flexShrink: 0` is
 *   still what keeps a long "Continuar al pago" from squeezing the total *at 100%*, where both
 *   do fit; the cap is what stops the item's own content width from being an unbounded floor
 *   once it is alone on its line, so a label wider than the screen wraps inside the pill
 *   instead of running off the edge of it.
 *
 * Neither changes anything at the default text size, and that is arithmetic rather than a
 * claim: the button's hypothetical width is one line of its label, the summary's is `flexBasis:
 * 0`, and one line plus `space.lg` of gap is narrower than this bar's content width for every
 * label in the app — so the row never breaks, the button never hits the cap, and the free space
 * is distributed between them exactly as before.
 *
 * `summary`'s own `flex: 1, minWidth: 0` is unchanged and is the other half of the pair: the
 * column has to be allowed to be narrower than its longest word, or a long total would push the
 * button off the row at 100% instead.
 *
 * **A taller bar is the screen's problem, and the screen is told about it.** The wrap above is
 * the thing `ACTION_BAR_CLEARANCE` cannot predict, so the bar reports its own height through
 * `onHeightChange` and a screen reserves room with `useActionBarClearance` — the last menu row
 * has to be able to come out from under the button at every text size, not only at the default
 * one. See that hook for why the number it returns is complete.
 *
 * ## What it deliberately cannot do
 *
 * There is no `hidden` or `collapsed` prop. A bar that slides away on scroll is a bar that
 * is absent at the moment someone decides to buy, and the reason to build one is almost
 * always to make room for something being sold. If a screen needs the space, it needs a
 * shorter screen.
 */

type ActionBarProps = {
	/**
	 * The one action. Pill-shaped at `lg`, in the colour `variant` names — `primary` unless a
	 * screen says otherwise. The name of this field is now slightly at odds with a bar drawn
	 * `destructive`; it is kept because renaming it would touch all eight call sites to say
	 * the same thing, and `ActionBarProps["primary"]` still reads as "the action".
	 */
	primary: {
		label: string;
		onPress: () => void;
		loading?: boolean;
		disabled?: boolean;
		accessibilityHint?: string;
	};
	/**
	 * The left side: a total, a count, a short summary. Omitted, the button takes the width.
	 *
	 * A node rather than a `label`/`value` pair because the three screens that use this put
	 * different things here — `MoneyLine` on the cart, a step counter on checkout, a price
	 * on a product — and a shape narrow enough for all three would be a shape that fits none.
	 */
	summary?: React.ReactNode;
	/** Full width and flat instead of a lifted card. See the note above. */
	docked?: boolean;
	/**
	 * Which of `./button`'s four variants the action is drawn in. Defaults to `primary`.
	 *
	 * It is top-level rather than a field of `primary` because the prop names a *variant of
	 * the button*, not a property of the action: spelling it `primary: { variant:
	 * "destructive" }` would read as an action that is simultaneously primary and
	 * destructive, which is the confusion this prop exists to prevent.
	 *
	 * Three of the four are legal here and one is not, for a reason that is about this
	 * component and not about taste:
	 *
	 * - `primary` (the default) is the screen's one forward action — buy, checkout, place the
	 *   order, add to cart, apply. `docs/design.md` gives a filled surface to exactly one
	 *   control per screen, and this bar is built to hold that control.
	 * - `secondary` is a bar whose action is safe but not the reason the screen exists.
	 * - `destructive` is for an action that *removes* something, and it is the case this prop
	 *   was added for: cancelling an order is the one thing this bar draws that must not look
	 *   like the happy path. Before the prop existed it rendered in the same filled fill as
	 *   "Pagar", which is the design system's own language for "this is what you came to do".
	 * - `ghost` is deliberately *not* reachable. A ghost button in this bar would be a bar
	 *   with no visual weight at all under a summary, and there is no action in the app that
	 *   is both the screen's floor and something to be played down to a hairline border. If
	 *   one appears, the bar is the wrong component for it, not this prop.
	 */
	variant?: Exclude<ButtonVariant, "ghost">;
	accessibilityLabel?: string;
	/**
	 * The bar's own height, once it has one. `useActionBarClearance` is the only producer.
	 *
	 * A plain number rather than the layout event: the only thing a caller does with it is
	 * reserve room, and the event's `x`/`y` are about a parent this component does not know.
	 */
	onHeightChange?: (height: number) => void;
};

export function ActionBar({
	primary,
	summary,
	docked = false,
	variant = "primary",
	accessibilityLabel,
	onHeightChange,
}: ActionBarProps) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			// The bar's height, for the screen whose content scrolls under it. A `docked` bar is
			// laid out too, and reporting its height costs nothing — the hook's caller is the one
			// that knows whether anything scrolls beneath.
			onLayout={
				onHeightChange
					? (event: LayoutChangeEvent) =>
							onHeightChange(event.nativeEvent.layout.height)
					: undefined
			}
			style={[
				styles.bar,
				// The inset is added to the padding rather than set as a height, so a phone
				// without a home indicator gets `space.md` and nothing else — the same rule the
				// tab bar follows.
				{ paddingBottom: space.md + insets.bottom },
				docked
					? {
							backgroundColor: colors.card,
							borderTopWidth: 1,
							borderTopColor: colors.border,
						}
					: [
							styles.floating,
							{
								backgroundColor: colors.card,
								borderColor: colors.border,
							},
							shadow.raised,
						],
			]}
			accessibilityLabel={accessibilityLabel}
		>
			{summary ? <View style={styles.summary}>{summary}</View> : null}
			<Button
				label={primary.label}
				onPress={primary.onPress}
				loading={primary.loading}
				disabled={primary.disabled}
				accessibilityHint={primary.accessibilityHint}
				variant={variant}
				// `lg` and `pill` are what make this the Uber-shaped CTA rather than a form
				// button: the control is the screen's one decision, and `radius.full` is the
				// token the palette already reserves for a pill. A fourth radius is still
				// illegal; this is the sanctioned `full` step, not a new one.
				size="lg"
				shape="pill"
				style={summary ? styles.buttonBeside : styles.buttonAlone}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	bar: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.lg,
		// The two items may be two lines. See the docblock: without this a 200%-scale label
		// takes the row's whole width and the summary beside it is left with zero, so the total
		// is not truncated but absent.
		flexWrap: "wrap",
		paddingTop: space.md,
		paddingHorizontal: space.lg,
	},
	floating: {
		marginHorizontal: space.lg,
		marginBottom: space.sm,
		// `md`: the scale's step for surfaces — this is a card-shaped bar, the same corner
		// `./card`, `./active-order-bar` and `./toast` take. `lg` belongs to sheets and
		// heroes, and a card lifted off the foot of a screen is neither; the pill button
		// inside it is the loud shape, and it keeps `radius.full`.
		borderRadius: radius.md,
		borderWidth: 1,
		paddingHorizontal: space.lg,
	},
	// `flex: 1` and a shrinkable minimum: a long total ("₡128.500 con envío") wraps or
	// truncates rather than pushing the button off the screen, because the button is the
	// part that must not move.
	summary: { flex: 1, minWidth: 0 },
	// `flexShrink: 0` keeps the button's width at 100% text; `maxWidth` bounds it on a line of
	// its own at 200%, where the label wraps inside the pill rather than leaving the screen.
	buttonBeside: { flexShrink: 0, maxWidth: "100%" },
	buttonAlone: { flex: 1 },
});
