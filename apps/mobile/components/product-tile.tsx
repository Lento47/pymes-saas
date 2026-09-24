import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMoney, type ProductCard } from "@pymeshub/shared";
import { router } from "expo-router";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { Card } from "@/components/card";
import { Image } from "@/components/image";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { Price } from "@/components/price";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * One product, as a surface with a photograph on it.
 *
 * Promoted out of `app/featured.tsx`, where it was a local `Tile`, because the home feed's
 * offers rail draws the same object and two copies of a product surface are two surfaces
 * that drift. Rule 7's move, and the rule it is named for is the reason this file exists
 * rather than a second `Tile` next to the first.
 *
 * ## The caller owns the width, this owns everything inside it
 *
 * `style` lands on both the animated wrapper and the `Card`, and it is the *only* thing
 * that differs between the places this is drawn: `app/featured` passes `flex: 1` and gets
 * half a row, the rails pass a fixed width and get a tile that scrolls. What is fixed here
 * is the photo's 4:3 crop, the text stack's gap and the chip — the parts that would be a
 * defect if one screen drew them differently from the other.
 *
 * Putting the style on the `Card` as well as on the wrapper is not belt-and-braces: the
 * wrapper is a column, so a parent row's `alignItems: "stretch"` reaches it and stops there,
 * and a `Card` without the same `flex` keeps its content height at the top of a stretched
 * box. See the note at the call site below.
 *
 * ## The add button is opt-in, and the decision it makes is not this tile's
 *
 * By default there is none: the whole tile is the `Card`'s own target and a tap opens
 * `app/product/[id]`, which owns the quantity stepper and the option groups. That is the
 * state `./product-row` argued for when it deleted its own add circle, and the argument
 * stands — a tile that commits a purchase is a "one, no options" order on a shelf whose
 * reader has been shown neither.
 *
 * `onQuickAdd` draws one anyway, and it exists for the one shelf where the coin is not
 * being tossed: a customer's *own past orders*, where they have bought exactly these things
 * before. Even there the button is a **door, not a decision** — the handler it is handed is
 * `useQuickAdd`'s, which reads `products.byId` before writing anything and opens the
 * product instead whenever a required option group would make one unit the wrong answer.
 * Nothing in this file knows about options and nothing here may: a `ProductCard` carries
 * none, which is precisely why the earlier attempts could not be made safe.
 *
 * The target is a **sibling** of the `Card`'s, absolutely positioned over the price row's
 * own slot below — never a child of it. It reads as nested, and on the web target it *was*
 * nested when `./business-card`'s heart sat inside its card: `react-native-web` maps
 * `accessibilityRole="button"` to a real `<button>`, and `HANDOVER.md` records the
 * measurement that caught it ("23 buttons, 3 of them nested"). Same fix as there, same
 * reason.
 *
 * Its label is `product.add.named` and not `product.add`: the card's own
 * `accessibilityLabel` replaces its children for a reader, so two tiles' "Agregar" would be
 * indistinguishable from one another.
 *
 * ## Why the tile itself carries no hint
 *
 * `./card` takes an `accessibilityHint` and this tile passes none, which is a decision
 * rather than an omission. A hint is for an outcome the label cannot imply:
 * `./promo-hero` spends it on "opens the shop", which is where the name alone would
 * mislead. A tile's label already says the product, the seller and the price, and its
 * role already says `button` — so the one thing left to hint at is the thing the reader
 * has just been told. (The "+" is a different target with a different outcome, and it
 * does take a hint: `order.reorder.help`, "Se agrega a tu carrito".)
 *
 * ## Nothing here is clamped
 *
 * No `numberOfLines` on the name and none on the seller: at 200% the lines wrap and the tile
 * grows. A cap would be truncating data to save a layout, which is the one use
 * `docs/design-mobile.md` rules out.
 */

/**
 * The "+", drawn at 32 inside the 44-point target `./pressable`'s base lays the box out at.
 *
 * Its own number and not an `icon` role: `theme/tokens.ts` says why these stay a handful of
 * sizes and not a scale — this is a mark sized to the disc it fills, like the two media
 * stand-ins. It sits above `styles` because `StyleSheet.create` reads it at module scope.
 */
const QUICK_ADD_SIZE = 32;

export function ProductTile({
	product,
	index,
	onQuickAdd,
	style,
}: {
	product: ProductCard;
	/**
	 * This tile's position in whatever list is drawing it, so the entrance staggers. The
	 * list owns the count — `./animate-in` clamps what it does with a large one.
	 */
	index: number;
	/**
	 * Draw the "+", and hand the tap to `useQuickAdd`'s handler. Omitted everywhere the
	 * reader has not bought the thing before — see the docblock above for why the default is
	 * no button at all.
	 */
	onQuickAdd?: (product: ProductCard) => void;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();

	const unavailable = !product.availability.inStock;

	// A "+" on an unavailable product would promise the one thing the card has just said is
	// impossible, so the button and its slot leave together with `unavailable`.
	const canQuickAdd = onQuickAdd !== undefined && !unavailable;

	const price = formatMoney(product.priceMinor, product.currency, {
		locale: intlLocale,
	});

	// The discount is a *percentage*, and `discountPercent` is the API's own rounding of it —
	// `productCardSchema` documents it as derived, never stored, so re-deriving it here from
	// the two prices would be a second rounding of the same subtraction.
	const discount =
		product.discountPercent === null
			? null
			: t("product.discount", { percent: product.discountPercent });

	// The same words the tile draws, in the order it draws them — a `Card`'s explicit label
	// replaces its children for a screen reader, so an uncomposed label would drop the
	// seller, the price and the sold-out sentence from every tile.
	const spoken = [
		product.title,
		product.seller.name,
		price,
		discount,
		unavailable ? t("product.soldOut") : null,
	]
		.filter(
			(part): part is string => typeof part === "string" && part.length > 0,
		)
		.join(" · ");

	return (
		<AnimateIn index={index} style={[styles.wrap, style]}>
			{/* `style` on the `Card` and not only on the wrapper. The wrapper is a *column*, so
			    a parent row's `alignItems: "stretch"` gives it the row's height but stretches
			    nothing inside it — the cross axis there is horizontal. Without the same `flex`
			    on the surface itself the card keeps its content height and pins to the top of a
			    stretched wrapper, so a pair whose names wrap to different line counts (nothing
			    here is clamped) or where only one tile has the discount chip draws two
			    different bottom edges. `./card` spreads `style` last, so this grows the card
			    and leaves its half-width to the wrapper. `./skeletons`' grid already puts the
			    `Card` directly in the row and does stretch, and the wait and the content should
			    not disagree about the grid's shape. */}
			<Card
				style={style}
				onPress={() =>
					router.push({
						pathname: "/product/[id]",
						params: { id: product.id },
					})
				}
				accessibilityLabel={spoken}
			>
				<View style={styles.body}>
					{/* The detail page's own crop ratio; `./image` draws its own corner and its own
					    `muted` box, so the tile has the right shape from the first frame. The corner
					    stays `./image`'s default `sm`, deliberately: unlike `./business-card`'s cover
					    band or `./gallery`'s hero, this box is inset inside the card's padding, so
					    the corner a reader reads it against is the card's own `md` — and both of
					    `./skeletons`' tile blocks draw the wait at the same `sm` corner, so the box
					    and its placeholder change corner together or not at all. */}
					<Image
						uri={product.imageUrl}
						style={styles.photo}
						// Both props, as the stand-in below carries them: they are one
						// platform each — `accessibilityElementsHidden` is iOS's and
						// `importantForAccessibility` is Android's, both declared on RN
						// 0.86.3's `AccessibilityProps` (`ViewAccessibility.d.ts:128`,
						// `:182`) — and `./image` spreads them onto its box, which is the
						// element that renders with and without a `uri`. The tile's own label
						// names the product, so a second element here is an unlabelled image
						// announced before every tile.
						accessibilityElementsHidden
						importantForAccessibility="no"
					>
						{product.imageUrl ? null : (
							// The product's **own initial**, not a generic glyph — the treatment
							// `apps/web`'s `ProductImage` gives a product with no photograph, and
							// `HANDOVER.md` records this difference as the open inconsistency it
							// was ("a grid of identical grey rectangles is unreadable, you cannot
							// tell one product from the next or tell a missing photo from a slow
							// one"). A picture glyph is also a *guess* in the wrong direction: it
							// stands for "image", while the initial at least stands for this
							// product.
							//
							// `display` here and `body` in `./product-row` is the same per-box
							// scaling web's `FALLBACK_TEXT` map does (a 48pt tile takes a small
							// letter, a grid tile a large one) — the size follows the box, which
							// is why it is chosen at the call site rather than in one scale.
							<Text variant="display" tone="primary" bold>
								{product.title.trim().charAt(0).toUpperCase()}
							</Text>
						)}
					</Image>

					<Text variant="body" bold>
						{product.title}
					</Text>

					<Text variant="caption" tone="muted">
						{product.seller.name}
					</Text>

					{/* `variant="body"`, as every other browse surface passes it — `./product-row`,
					    the cart, checkout, the store page, the orders list. `Price`'s default is
					    `heading`, and `docs/design-mobile.md`'s Rule 1 ties the largest type on a
					    surface to the surface that *commits*: money is the loudest thing in a
					    commit and never the loudest thing on a browse screen. A tile does not
					    commit anything — the "+" below adds one unit and the commit is still a
					    screen away — so the price draws at the same `body` step the name above
					    it draws, and the tile's hierarchy is carried by order rather than by
					    size: the name is read first because it is first, not because it is
					    bigger. */}
					<View style={styles.priceRow}>
						<Price
							amountMinor={product.priceMinor}
							currency={product.currency}
							compareAtMinor={product.compareAtPriceMinor}
							variant="body"
						/>

						{/* The chip is a surface, not a hue: the words are the signal and the tone
						    is the second one. `muted` behind `discount` ink rather than a filled
						    red pill, because the palette's paired `discountForeground` is not one
						    of `./text`'s tones (`./text`'s list ends at `inverse`), so the fill
						    would put the ink back at the call site as a `style` override. This is
						    the same chip `./product-row` draws on the price's own line, geometry
						    and all, so one product does not change weight between this shelf and a
						    menu row.

						    The price and the chip share one wrapping row, which is `./product-row`'s
						    arrangement ("next to the money is also where a discount belongs"). The
						    fields a reader compares across two tiles — name, seller, money — are
						    still the same three lines in the same places, and `./card`'s stretch is
						    what keeps the two bottom edges level regardless. */}
						{discount ? (
							<View
								style={[
									styles.badge,
									{
										backgroundColor: colors.muted,
										borderColor: colors.border,
									},
								]}
							>
								<Text variant="caption" tone="discount" bold tabular>
									{discount}
								</Text>
							</View>
						) : null}

						{/* An empty square whose only job is geometry: the "+" is pinned over this
						    row's end, and a row with nothing reserved there would have the button
						    sitting on top of a number. `marginLeft` sends it to the row's end — the
						    card's bottom-right corner whether or not the row wrapped — which is
						    exactly where the pin lands at every text size. */}
						{canQuickAdd ? <View style={styles.quickAddSlot} /> : null}
					</View>

					{/* The state, as a sentence — and the tile is not dimmed for it. A sold-out
					    product is still worth browsing; it is the order that cannot happen. It is
					    also the one state in which no "+" is drawn. */}
					{unavailable ? (
						<Text variant="caption" tone="muted">
							{t("product.soldOut")}
						</Text>
					) : null}
				</View>
			</Card>

			{canQuickAdd ? (
				<Pressable
					onPress={() => onQuickAdd(product)}
					accessibilityRole="button"
					accessibilityLabel={t("product.add.named", { name: product.title })}
					accessibilityHint={t("order.reorder.help")}
					// The disc is drawn at 32; the target under it is the 44 `./pressable`'s base
					// already lays the box out at, and the slop adds nothing to that — which is
					// the answer `hitSlopFor` is asked for here. It was asked for the difference
					// between the disc and the floor instead, and 6 points on each side is 12
					// points of card that looks empty and takes the press: this button is a later
					// sibling pinned over the tile, so a near-miss of the "+" lands on it rather
					// than on the card, which is the mis-tap `./pressable`'s docblock names.
					// `app/business.tsx` asks the same question the same way.
					hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
					style={styles.quickAddPin}
				>
					<View style={[styles.quickAdd, { backgroundColor: colors.primary }]}>
						<Ionicons
							name="add"
							size={icon.action}
							color={colors.primaryForeground}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</View>
				</Pressable>
			) : null}
		</AnimateIn>
	);
}

const styles = StyleSheet.create({
	// The "+" is pinned over the card, so the entrance wrapper is what positions it. The
	// caller's `style` (a width, or `flex: 1`) rides along so the card and its button share
	// one box — see `./business-card`'s `wrap` for the same two roles.
	wrap: { position: "relative" },
	// The stack's gap is inside the `Card`, on `body`, because the `Card` is the tile's only
	// child — a gap on the outer box would be separating one thing from nothing.
	body: { gap: TEXT_STACK_GAP },
	photo: { width: "100%", aspectRatio: 4 / 3 },
	priceRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		// The chip takes a line of its own rather than squeezing the money.
		flexWrap: "wrap",
	},
	// Empty, and only there so the pinned target has somewhere to land. `MIN_TOUCH_TARGET`
	// because that is the target it stands in for.
	quickAddSlot: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		marginLeft: "auto",
	},
	// The disc centres in the 44-point target `./pressable`'s base lays out, the same
	// centring `./favorite-button`'s `button` gives the heart in the identical pinned
	// square. Uncentred, the 32pt ink sits at the box's top-left, 6 points off the centre
	// of the slot `quickAddSlot` reserved for it.
	quickAddPin: {
		position: "absolute",
		right: space.lg,
		bottom: space.lg,
		alignItems: "center",
		justifyContent: "center",
	},
	quickAdd: {
		width: QUICK_ADD_SIZE,
		height: QUICK_ADD_SIZE,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	// `radius.full` and `MIN_TOUCH_TARGET` are not involved in the *chip*: it is a label on a
	// surface, not a target. It pays `space.xs` and a hairline, so it reads as a chip at every
	// text scale.
	badge: {
		paddingHorizontal: space.xs,
		paddingVertical: space.xs / 2,
		borderRadius: radius.full,
		borderWidth: 1,
	},
});
