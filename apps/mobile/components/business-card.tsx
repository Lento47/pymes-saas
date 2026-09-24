import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import {
	type BusinessCard as BusinessCardData,
	formatMoney,
} from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { formatOneDecimal } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	radius,
	STATUS_DOT_SIZE,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Card } from "./card";
import { Fact, Facts } from "./facts";
import { FavoriteButton } from "./favorite-button";
import { Image } from "./image";
import { Text } from "./text";

/**
 * A shop in a list.
 *
 * Everything on it comes from `BusinessCard` in `@pymeshub/shared`, which is the same
 * shape the web app's grid renders — there is no "mobile card" schema and there should not
 * be one: the API decides what a card contains, and a client that asks for more is a
 * client that will one day ask for a field the list query does not join.
 *
 * The **closed** state is a word, not a greyed-out card. Dimming is the reflex and it is
 * wrong here: a shop that is closed is a shop you can still look at and plan for, and the
 * one thing the customer needs to know is that an order placed now will not be accepted —
 * so that fact is a sentence with the opening time in it.
 *
 * The picture is `./image`, so the logo's box is the right size from the first frame and
 * the logo fades in over it — and the heart is `./favorite-button`, which owns the write.
 *
 * ## A fact is a chip, a state is a sentence (`./facts`' rule, applied)
 *
 * The three things a customer compares between two shops at a glance — the score, how long
 * it takes, and what the delivery costs or that there is none — are one wrapped `Facts` row,
 * so the eye can run down a column of cards and read the same number in the same place. It
 * is **three and not five**: this row held distance and the minimum order as well, and the
 * design for the browse card cut them. Two rows of chips is a card that shouts five numbers
 * at once (`docs/design-mobile.md` Rule 1's failure mode — "price, promo, rating and a badge
 * all shout, so the customer reads none of them"), and neither dropped one earns its place
 * here: the distance is what the list is *sorted* by, so it is the order the cards arrive in
 * rather than a figure to re-read per card, and a minimum order only matters at the moment
 * it binds — which is the cart, and the store page that carries `store.minOrder` in words.
 *
 * None of them is truncated: `Facts` takes no `numberOfLines`, and at 200% text the row wraps
 * and the chip grows, because the number being scanned for must never be the one that got
 * cut.
 *
 * Open and closed stays where it was — a dot, a word, and a tone — because it is the one
 * item on the card that is a *state* rather than a fact, and a state needs a reason before
 * it needs to be comparable. The card's own docblock has argued since it was written that
 * this is a sentence and not a greyed-out surface; putting it in the chip row would have
 * undone that, and putting the rating in the chip row while leaving the *count* behind
 * would have made "4.8" a claim with no depth.
 *
 * ## The score, the count, and the words for both
 *
 * The rating chip reads `4.8 (212)`: the average at the one decimal `ratingAvg` is stored
 * at (a rounded-up "4.8" over a real 4.75 is the small lie `./rating` refuses to tell),
 * and the number of rows behind it, because two shops at 4.8 are not the same claim when
 * one has three reviews. Nothing here draws the score when `ratingCount` is zero — the
 * API's own contract, `rating: number | null`, reads as "we have nothing to say here", and
 * a new shop should look new rather than badly reviewed.
 *
 * The sentence for the pair is `store.rating.label.count`, which the storefront already
 * speaks and which has a `_plural` sibling — so it is read with `tp` and never `t`, which
 * cannot see the sibling even once one exists. It is the chip's `accessibilityLabel` and
 * part of the card's, which is the half of this card that a reader who cannot see the chips
 * still gets.
 *
 * ## The cover photograph, and what is drawn when there is none
 *
 * `businessCardSchema` carries **two** photographs — `logoUrl` and `coverUrl` — and this
 * card draws whichever the payload has, in `./hero`'s split: the cover as a band across the
 * top when there is one, and the logo in the 56pt box when there is not. They are
 * alternatives rather than a stack, so a shop with a cover never shows two pictures of
 * itself on one card.
 *
 * This is the seam `docs/imagery.md` is about: the demo catalogue carries no imagery at all
 * (`packages/db/src/seed.ts` leaves every `logoUrl`/`coverUrl`/`imageUrl` null), so today
 * every card in the app draws its stand-in and the branch above is never taken. Nothing has
 * to change here when images arrive — bind R2, upload, and the band appears.
 *
 * What is forbidden while waiting is unchanged (Rule 3): **never an invented photograph** —
 * no stock image, no gradient standing in for one, and no grey rectangle pretending to be a
 * photograph that failed to load. The stand-in is `./image`'s `muted` box with a glyph in it,
 * which says "no picture" rather than implying one is coming.
 *
 *
 * The whole card is one target — `Card`'s `Pressable` carries the label — so the children
 * are not focusable one by one, and a label of the shop's name alone would leave the score,
 * the distance and the fee unannounced on every card in a feed. The label is therefore the
 * name *and* the facts, joined by the same `·` the card already uses between its chips: the
 * separator is punctuation, not a translation, and the two halves are dictionary keys.
 *
 * ## The padding is the card's
 *
 * This card used to hand `Card` a `style` of `padding: space.md`, one step tighter than the
 * primitive's own `space.lg`, so a feed of shops sat denser than a column of anything else.
 * `docs/design-mobile.md` is explicit that the inside padding of a primitive belongs to the
 * primitive, and this was the override it names: the card and the block standing in for it in
 * `./skeletons` then had to agree about a number neither of them owned, which is a coupling
 * that holds until one of them is edited. A card that genuinely needs a different inside is a
 * variant on `./card`, where the number and every other card's number move together; this one
 * does not need one.
 *
 * ## The heart is a sibling of the card's target, not a child of it
 *
 * It reads as nested — the heart sits inside the card, and on a phone the inner target does
 * take the tap — and it shipped that way. On the web target that was an **invalid document**.
 * `react-native-web` maps `accessibilityRole="button"` to a real `<button>` element
 * (`modules/AccessibilityUtil/propsToAccessibilityComponent`), so the card's own target and
 * the heart's were both `<button>`, one inside the other. Measured on the home screen: 23
 * buttons, **3 of them nested**. React logged the nesting error, and Expo's dev LogBox turned
 * that log into a toast that floated over the tab bar and swallowed the tab press — which is
 * how it was found: by `mobile-web.spec.ts`'s navigation test going red, not by reading markup.
 *
 * So the heart is a sibling of `Card` inside a wrapper, pinned to `./card`'s padding in from
 * the top-right corner. On a card with no cover that is the space it used to occupy inside
 * the row; with a cover the same offset puts it on the band, and the pill it sits on keeps
 * the control on a themed surface — `./hero`'s answer to the same pin over a photograph. The
 * same pixels and the same tap, as two sibling targets instead of a nested pair. The wrapper
 * is `position: relative` and is what makes that pin possible; the `space.lg` in the slot and
 * the pin is `./card`'s own padding, read from the primitive rather than restated — the
 * coupling the section above forbids.
 *
 * ## Nothing here is truncated to save the layout
 *
 * The name and the category both carried `numberOfLines={1}`. They do not now, and the reason
 * is the rule rather than a preference: `docs/design-mobile.md` allows a cap only where the
 * cap is not saving a layout, and these two were — one line each kept the card's height fixed
 * against a 56pt logo and a 44pt heart column. Nothing breaks without it. The text column is
 * `flex: 1`, so a name that wraps at 200% makes the card taller and pushes the list down, and
 * the shield beside it stays centred on the first line's row; the shop's name is the one thing
 * on this card a customer is reading it to find, and a name cut at the first line is a wrong
 * answer, not a tidier one. `./facts` already argues the same for the numbers ("the number
 * being scanned for must never be the one that got cut"), and `app/featured.tsx`'s tile draws
 * its title the same way.
 */
export function BusinessCard({
	business,
	onPress,
}: {
	business: BusinessCardData;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	const { t, tp, locale, intlLocale } = useT();

	const status = business.isOpen ? t("store.open") : t("store.closed");

	// The category, in the reader's language. `categoryNameEn` is nullable — the six demo
	// categories `packages/db/src/seed.ts` writes carry Spanish only — so the fallback is
	// `@pymeshub/i18n`'s `localizedName` and not a second reading of `nameEn` here. `null`
	// when the shop has no category at all, which is what both readers below filter on.
	const categoryName = business.categoryName
		? localizedName(
				{ name: business.categoryName, nameEn: business.categoryNameEn },
				locale,
			)
		: null;

	// One decimal, because that is the precision `ratingAvg` is stored at — the same format
	// `./rating` applies to the same number, which is why the two cannot disagree. The
	// formatters are `lib/format`'s and are shared with `./rating`, `./review-summary` and
	// `app/store/[slug]`: four copies of the same options were four chances to drift.
	const score = formatOneDecimal(business.ratingAvg, intlLocale);

	// The fulfilment chip, and it is a claim about the shop rather than a summary of the
	// payload. `deliveryEnabled === false` does not mean pickup — it means delivery is off —
	// and this branch used to read the two as one, so a shop with *both* kinds off drew a
	// "Retiro" chip promising a service the API refuses (`apps/api/src/services/cart.ts`
	// rejects `PICKUP` when `!pickupEnabled`). That state is reachable: `businessUpdateInput`
	// takes the pair as independent optionals with no refine, and the web settings form posts
	// the checkbox state as it stands. The web's own line has always guarded it
	// (`apps/web/components/catalog/store-info.tsx`), which is why this is a bug here and
	// not a decision anybody made.
	//
	// Three cases, and `null` is one of them: a shop that offers neither draws no fulfilment
	// chip, because there is no true fact to put in one.
	//
	// The fee line is composed here rather than in the dictionary because the cases are
	// different keys and choosing between them is a branch, not a translation. The
	// pickup chip takes `store.pickup.short` and not `store.pickup`: the latter is the
	// storefront's *sentence* — "Retiro en el local" — and a sentence in a chip row is
	// four chips where three would fit.
	const delivery = business.deliveryEnabled
		? business.deliveryFeeMinor === 0
			? t("store.delivery.free")
			: t("store.delivery.fee", {
					amount: formatMoney(business.deliveryFeeMinor, business.currency, {
						locale: intlLocale,
					}),
				})
		: business.pickupEnabled
			? t("store.pickup.short")
			: null;

	type CardFact = {
		value: string;
		/** The same fact in words, for the card's own label. See the docblock. */
		label: string;
		iconName: React.ComponentProps<typeof Ionicons>["name"];
		iconTone?: React.ComponentProps<typeof Fact>["iconTone"];
	};

	const facts: CardFact[] = [];

	if (business.ratingCount >= 1) {
		const value = `${score} (${business.ratingCount})`;
		facts.push({
			value,
			// The plural sentence, with `value` supplied and `count` positional — see the
			// docblock for why this is `tp`.
			label: tp("store.rating.label.count", business.ratingCount, {
				value: score,
			}),
			iconName: "star",
			iconTone: "rating",
		});
	}

	if (business.prepTimeMinutes) {
		const value = t("unit.minutes", { count: business.prepTimeMinutes });
		facts.push({ value, label: value, iconName: "time-outline" });
	}

	// The `null` check is what narrows `delivery` to `string` for `CardFact` — and it is also
	// the guard itself, so the chip and the claim cannot drift apart. See the branch above.
	if (delivery !== null) {
		facts.push({
			value: delivery,
			label: delivery,
			iconName: business.deliveryEnabled
				? "bicycle-outline"
				: "bag-handle-outline",
		});
	}

	// The name, then the facts. `categoryName` is nullable in the schema and a card for a
	// shop with no category would otherwise read "Tienda ·  · Abierto".
	//
	// The verified word is in this sentence rather than left on the shield's own
	// `accessibilityLabel` (`:278`, `accessibilityLabel={t("store.verified")}`), because that
	// label can never be read: this card is a
	// `Pressable` with an explicit label, and RN replaces an accessible container's children
	// with it. A verified shop and an unverified one announced identically, so the one mark on
	// the card that is a claim about the shop rather than a number in it was the one nobody
	// could hear.
	const spoken = [
		business.name,
		business.isVerified ? t("store.verified") : null,
		categoryName,
		status,
		...facts.map((fact) => fact.label),
	]
		.filter(
			(part): part is string => typeof part === "string" && part.length > 0,
		)
		.join(" · ");

	return (
		<View style={styles.wrap}>
			{/* The cover, when the payload has one — `./hero`'s split. It is `./image`, so the
			    band is the right size from the first frame and the photograph fades in over it;
			    with no `uri` it is not rendered at all, and the card is exactly the composed
			    row below. */}
			{business.coverUrl ? (
				<Image
					uri={business.coverUrl}
					radiusToken="md"
					style={styles.cover}
					// Decorative: the shop's name is on the row below, and the card's own
					// label announces it.
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : null}
			<Card onPress={onPress} accessibilityLabel={spoken}>
				<View style={styles.row}>
					{/* The logo is the cover's stand-in, so a shop that has a cover draws one
					    picture of itself on this card and not two. See the docblock's split. */}
					{business.coverUrl ? null : (
						<Image
							uri={business.logoUrl}
							style={[styles.logo, { borderColor: colors.border }]}
							// Decorative: the shop's name is right beside it, and announcing the
							// image would read the name twice.
							accessibilityElementsHidden
						>
							{/* Drawn only when there is no logo, so a transparent one never shows the
						    fallback icon through it. */}
							{business.logoUrl ? null : (
								// The shop's **own initial** — the treatment `apps/web` gives a
								// business with no logo, and the difference `HANDOVER.md` records
								// as an open inconsistency: a picture glyph is the same mark on
								// every card, so a feed of shops is a grid of identical grey
								// rectangles and you cannot tell one from the next. A letter at
								// least stands for *this* shop. `body` against the 56pt box is
								// web's per-box scaling (see `./product-tile`).
								<Text variant="body" tone="primary" bold>
									{business.name.trim().charAt(0).toUpperCase()}
								</Text>
							)}
						</Image>
					)}

					<View style={styles.body}>
						{/* The name, its caption line and the state row are one text stack, so the gap
						    inside it is `TEXT_STACK_GAP` and not a `space` step (`theme/tokens.ts`). The
						    chips are a separate block of the card, and pay the step between blocks below
						    — the same anatomy `./hero` draws for the same facts on one shop. */}
						<View style={styles.identityStack}>
							<View style={styles.titleRow}>
								<Text variant="heading" bold style={styles.flex}>
									{business.name}
								</Text>
								{business.isVerified ? (
									<Ionicons
										name="shield-checkmark"
										size={icon.inline}
										color={colors.primary}
										accessibilityLabel={t("store.verified")}
									/>
								) : null}
							</View>

							{/* The shop's own words beside its category — "Panadería · Recién
							    horneado cada día" is one caption line and it is the line the design
							    for this card gives it. Both halves are the payload's (`categoryName`,
							    `description`) and neither is invented: a shop with no description
							    draws its category alone, which is what this drew before.

							    **One line, and this is the one place on the card that truncates.**
							    `docs/design-mobile.md` allows `numberOfLines` "for truncating data,
							    never for saving a layout", and this is data: `business.description`
							    is a *sentence* the shop wrote ("Pan de leña desde las cuatro de la
							    mañana. Si no está en el mostrador, no está."), and unclamped it grew
							    the card to three lines of prose — measured on the device, and the
							    exact "too much words" this card was cut from five chips to three
							    for. The full sentence is on `app/store/[slug]`, which is where a
							    reader goes to read it. The name above is deliberately *not* clamped
							    the same way: a name is what the customer is scanning for. */}
							<Text variant="label" tone="muted" numberOfLines={1}>
								{[categoryName, business.description]
									.filter(
										(part): part is string =>
											typeof part === "string" && part.length > 0,
									)
									.join(" · ")}
							</Text>

							{/* The state, and it is a sentence: a dot, a word and a tone. It is the one
							    thing on this card with a reason rather than a number in it, which is why
							    it is not in the chip row below — see `./facts`. */}
							<View style={styles.statusRow}>
								<View
									style={[
										styles.statusDot,
										{
											backgroundColor: business.isOpen
												? colors.success
												: colors.mutedForeground,
										},
									]}
								/>
								<Text
									variant="label"
									tone={business.isOpen ? "success" : "muted"}
								>
									{status}
								</Text>
							</View>
						</View>

						{/* The chips are their own block of the card, so they pay the step between
						    blocks (`space.md`) and not the stack's `TEXT_STACK_GAP` — the rule the
						    identity stack above states, and the same gap `./hero` keeps between its
						    identity and its chips. */}
						<Facts>
							{facts.map((fact) => (
								<Fact
									key={fact.iconName}
									value={fact.value}
									iconName={fact.iconName}
									iconTone={fact.iconTone}
									accessibilityLabel={fact.label}
								/>
							))}
						</Facts>
					</View>

					{/* The heart's square, kept in the row so the text column ends where it always
					    did. The target itself is the sibling below — see the file docblock. */}
					<View style={styles.favoriteSlot} />
				</View>
			</Card>

			{/* The pill under the heart is `./hero`'s documented answer to a pin over a
			    photograph: a `card` surface the theme reasoned about, under a control whose
			    inks come from the theme. Without a cover it is `card` on `card` and invisible;
			    with one it is what makes the heart legible on the band. */}
			<View
				style={[
					styles.favoritePin,
					styles.favoritePill,
					{ backgroundColor: colors.card },
				]}
			>
				<FavoriteButton target={{ kind: "business", card: business }} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	/**
	 * What makes the heart's pin possible: an absolutely positioned sibling needs a
	 * positioned ancestor, and this is the only one that is the card's own box.
	 */
	wrap: { position: "relative" },
	// The cover band, above the card's own surface rather than inside its padding: it is the
	// picture of the shop, and `./image` owns its corner and its clip.
	cover: {
		width: "100%",
		aspectRatio: 16 / 9,
		marginBottom: space.md,
	},
	row: { flexDirection: "row", gap: space.md },
	/**
	 * The heart's square, empty. The row is laid out as if the heart were still in it, so the
	 * text column breaks at the same character it did when it was — the geometry, without the
	 * nested target. The pin's `space.lg` is `./card`'s padding from the wrapper's corner; on
	 * a card with no cover that is this square, and with a cover the pin rides the band above
	 * on the pill `favoritePin` documents.
	 */
	favoriteSlot: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET },
	/**
	 * The heart, the card's padding in from the top and the right edge. Absolute, so it is a
	 * sibling of the card's pressable rather than a child of it, and last in the tree, so it
	 * takes the tap before the card does.
	 *
	 * With a cover, that offset puts the heart *on the band* — the band is drawn above the
	 * card's padding, full width — so the pill it sits on is what keeps the control on a
	 * surface the theme reasoned about, exactly as `./hero` does for the same heart over its
	 * own photograph. Without a cover the pill is `card` on `card` and disappears, and the
	 * heart sits where `favoriteSlot` reserved it.
	 */
	favoritePin: {
		position: "absolute",
		top: space.lg,
		right: space.lg,
	},
	// The pill under the heart: round like `./hero`'s action pill, filled from the theme in
	// the render, because a pin over a photograph needs its own surface to be read on.
	favoritePill: { borderRadius: radius.full },
	logo: {
		width: media.card,
		height: media.card,
		borderWidth: 1,
	},
	// The text column: the identity stack inside it at the stack's own gap, the `Facts` row
	// after it at the step between blocks.
	body: { flex: 1, gap: space.md },
	// The name, the caption line and the state row are one text stack — see the render.
	identityStack: { gap: TEXT_STACK_GAP },
	titleRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
	flex: { flex: 1 },
	/**
	 * The dot and the word. It keeps the wrap the old mixed line needed, because at 200% text
	 * "Cerrado" and its dot are already a line of their own on a narrow card and the text
	 * beside the logo is the narrowest column in the app.
	 */
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		flexWrap: "wrap",
	},
	statusDot: {
		width: STATUS_DOT_SIZE,
		height: STATUS_DOT_SIZE,
		borderRadius: radius.full,
	},
});
