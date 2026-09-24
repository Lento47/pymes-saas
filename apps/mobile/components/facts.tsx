import Ionicons from "@expo/vector-icons/Ionicons";
import { Children, type ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { icon, radius, space, type ThemeColors, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * The fact row: several short, comparable facts, each a chip.
 *
 * `docs/design-mobile.md`'s Rule 2 draws the line this file exists to hold: *a fact is a
 * chip, a state is a sentence*. `25 min`, `₡1 500`, `4.6 (128)`, `1.2 km`, `Mín ₡5 000` are
 * scanned rather than read, so they go in one wrapped row where the eye can compare them
 * without a line break between each. Anything that needs a *reason* — closed, suspended,
 * sold out, delivery out of radius, a refusal — is a sentence with the fact that explains
 * it, and it stays on the screen that owns it. `./business-card` already draws that
 * distinction: its closed state is `t("store.closed")` in words beside the shop, not a grey
 * chip nobody can act on. This row must not undo it, which is why there is no `state`
 * variant here and no key in this file that could become one.
 *
 * ## Values arrive formatted, and this file holds no keys
 *
 * Every `value` is a finished string. The vocabulary already exists and already lives in the
 * dictionary, and the two shop-card surfaces compose most of it: `./business-card` and
 * `app/store/[slug]` both build `unit.km`, `unit.minutes`, `store.delivery.fee` /
 * `store.delivery.free`, `store.pickup.short` and `store.minOrder.short`. The other call sites
 * bring their own — `app/checkout` composes `store.delivery`, `store.pickup.short`,
 * `store.prepTime` and `checkout.estimate`; `app/product/[id]` composes `product.sold` and
 * `product.lowStock` — and the remaining chips are strings no key describes: a phone number, an
 * address label, a payment word, a badge label, a tag. Money goes through `formatMoney` /
 * `<Price>` and nothing else, because a second formatter is a second place that can divide a
 * colón by 100. A `Facts` that took numbers and a unit would be a third place that decides how
 * a distance is spelled, and it would have to hold the keys to do it.
 *
 * This list used to read `unit.km`, `store.prepTime`, `store.delivery.fee` /
 * `store.delivery.free`, `store.pickup`, `store.minOrder`, described as composed by
 * `./business-card` and by the storefront, and it named the wrong half of two pairs. In
 * `apps/mobile` the bare `store.pickup` and `store.minOrder` have no call site at all — both
 * files compose the `.short` siblings, which is what `./business-card`'s comment at :150 argues
 * for — and they are not dead keys: they are the *sentences* `apps/web`'s storefront composes
 * — `store.pickup` at `components/catalog/store-info.tsx:59` and `store.minOrder` at `:61` —
 * which is the fact-versus-sentence line this file
 * draws elsewhere. `store.prepTime` is composed by neither mobile file; its only mobile call
 * site is `app/checkout`, and `unit.minutes` — the key both of them *do* compose for prep time
 * — was missing entirely. A grep over `apps/mobile` is what tells those siblings apart and
 * nothing else can: both keys exist, both read plausibly, and no type error reaches a comment.
 *
 * ## Nothing here truncates and nothing here is a target
 *
 * No `numberOfLines` anywhere: at 200% text the row wraps and a chip grows, because the
 * number a customer is scanning for must never be the one that got cut — `./business-card`
 * states the same rule for its own fact line. And a fact is a *statement*, not a control: it
 * has no `onPress`, so the 44-point floor does not apply to it and it is sized by the air
 * around its own text. A chip that needs to be tapped is a control, and a control belongs in
 * `./pressable` with a 44-point target rather than in this row with a 26-point one.
 */

/**
 * The two roles an icon can have on a fact, and deliberately no more.
 *
 * `rating` is here because the star beside a score is `colors.rating` — a token of its own
 * so that recolouring a caution never recolours a rating (`theme/tokens.ts` says so beside
 * the value) — and a screen that shows a score as a fact must not lose the ink `./rating`
 * draws it in. Everything else a fact wants a glyph for (a clock, a bicycle, a pin) is
 * decoration on `mutedForeground`, which is the ink `./business-card`'s meta line and
 * `./rating`'s count already use.
 *
 * A colour *argument* would be shorter and is the wrong trade: it puts a palette decision at
 * a screen's call site, which is the thing `theme/tokens.ts` exists to prevent. Two named
 * roles keep the decision here and keep it closed.
 */
const FACT_ICON_TONES = {
	muted: "mutedForeground",
	rating: "rating",
} as const satisfies Record<string, keyof ThemeColors>;

export type FactIconTone = keyof typeof FACT_ICON_TONES;

/**
 * The row. Wraps, and disappears when there is nothing in it.
 *
 * `null` for an empty row rather than an empty `View`, for the reason `./category-rail`
 * gives about a rail of nothing: a heading with a shrug under it is worse than no heading.
 * A caller that computed its facts and filtered them all out gets no gap left behind.
 *
 * Children rather than a `facts` array, because a `Fact` is the unit and composing them is
 * the caller's job — an array prop would need a second type describing a `Fact` that is not
 * a `Fact`, and the two would drift.
 */
export function Facts({
	children,
	style,
}: {
	children: ReactNode;
	/** Layout, and only layout: the caller's margins, never a colour or a radius. */
	style?: StyleProp<ViewStyle>;
}) {
	if (Children.count(children) === 0) return null;

	return <View style={[styles.facts, style]}>{children}</View>;
}

/**
 * One fact: a finished string, an optional glyph, and one sentence for a screen reader.
 *
 * The glyph is `./category-rail`'s problem in miniature and takes the same answer. `iconName`
 * is a name in *our* icon set arriving from code rather than from an admin's free-text field,
 * so an unknown one is a developer's typo and a compile error here (`Ionicons`' own prop
 * type), not the tofu box the rail had to defend against with a `glyphMap` lookup.
 *
 * `accessible` wraps the glyph and the word into **one** node, which is what `./status-badge`
 * does for the same shape. Without it a screen reader announces an unlabelled image and then
 * a bare number, and "4.6" arrives with nothing saying what 4.6 is. The glyph itself is
 * hidden in both of the ways the platform reads it.
 *
 * `accessibilityLabel` is the caller's and it is optional, because the value is often the
 * whole sentence: `"25 min"` is already what should be spoken. It exists for the case where
 * the ink is not the words — a chip reading `4.6` needs `store.rating.label.count`, which is
 * a key, and keys live in the dictionary and at the call site, never here.
 *
 * ## The value is drawn `tabular`
 *
 * `docs/design-mobile.md`'s review bar asks it of money and quantities, and this is where a fact
 * is drawn, so the value is `tabular`. It is a rendering hint on a finished string and not a
 * reformat, which is how it keeps the promise the section at the top of this file makes: the
 * caller still formats, and this file still touches nothing.
 *
 * There is deliberately **no `tabular` prop**, and the two reasons are worth writing down because
 * the prop is the obvious alternative. This file cannot decide per value — it holds no keys and
 * reads no numbers, so telling a count from an address would mean inspecting the string, which is
 * the formatting it exists not to do. And a prop the caller opts into would change nothing until
 * the five screens that draw a `Fact` — `./business-card`, `app/account`, `app/checkout`,
 * `app/store/[slug]`, `app/product/[id]` — were each edited to pass it, and a prop no call site
 * sets is the same defect as a key no screen composes, which is the story the file docblock
 * above tells about four of its own entries. Applying it
 * unconditionally costs nothing where a value has no digits: `tabular-nums` is a digit-width
 * change and only that, so an address label, a payment word or a tag draws exactly as it would
 * without it, while a phone number or a `-25%` badge — both of which are chips in this app —
 * gets the alignment it wants. The claim about what the style does is what `tabular-nums` *is*
 * rather than something observed here: no device was rendered to write it, and `./text` already
 * records that it fails silently on a platform that does not implement it. `apps/web`'s
 * storefront makes the identical call for the identical reason — its
 * `components/catalog/store-info.tsx:87` puts `tabular-nums` on the whole list because every
 * line is one finished `t()` string with no element around the figure to hang a class on.
 */
export function Fact({
	value,
	iconName,
	iconTone = "muted",
	accessibilityLabel,
}: {
	/** Already formatted. This file does not touch it. Drawn `tabular` — see the docblock. */
	value: string;
	iconName?: React.ComponentProps<typeof Ionicons>["name"];
	iconTone?: FactIconTone;
	/** What a screen reader hears instead of, or as well as, the value. */
	accessibilityLabel?: string;
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[styles.fact, { backgroundColor: colors.muted }]}
			accessible
			accessibilityLabel={accessibilityLabel}
		>
			{iconName ? (
				<Ionicons
					name={iconName}
					size={icon.inline}
					color={colors[FACT_ICON_TONES[iconTone]]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : null}
			<Text variant="label" tabular>
				{value}
			</Text>
		</View>
	);
}

/**
 * `space.sm / 2` — 4 above and below the label's 18-point line box (`type.label`), so a chip is
 * 26 tall.
 *
 * The first number here used to be written as "2 points", which is half of what the expression
 * evaluates to: `space.sm` is 8 (`theme/tokens.ts:157`, `sm: 8`), so the inset is 4, and 4 + 18 + 4 is
 * exactly the 26 the rest of that sentence already claimed. The expression is the fact and the
 * figure is derived from it, which is why this now states both rather than one of them wrongly.
 *
 * Derived from the scale rather than typed, the way `./status-badge` derives its two insets, and
 * one step *in* from that badge: its pill is `space.md / 2` (6, a 30-tall badge) and its compact
 * size `space.xs / 2` (2, a 22-tall one), so this sits between the two at `space.sm / 2`. A badge
 * stands alone at the end of a row and can afford the air of a pill; a fact is one of three or
 * four a reader compares at a glance, and at the pill's 6 each the row starts to read as a band
 * across the card rather than as facts. `space.xs` itself is not the answer: the spacing scale is
 * the air *between* elements, and `./status-badge` already settles that this is a value derived
 * from it.
 */
const FACT_INSET_Y = space.sm / 2;

const styles = StyleSheet.create({
	facts: {
		flexDirection: "row",
		alignItems: "center",
		// The wrap is the whole point: at 200% text three facts do not fit on one line of a
		// phone, and the answer is a second line rather than a truncated third chip.
		flexWrap: "wrap",
		gap: space.sm,
	},
	fact: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		borderRadius: radius.full,
		paddingHorizontal: space.sm,
		paddingVertical: FACT_INSET_Y,
	},
});
