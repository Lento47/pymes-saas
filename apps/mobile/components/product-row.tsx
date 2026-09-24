import { MAX_LINE_QUANTITY, type ProductCard } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { PRESS_SCALE_ROW } from "@/lib/motion";
import {
	MIN_TOUCH_TARGET,
	media,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Image } from "./image";
import { Pressable } from "./pressable";
import { Price } from "./price";
import { Rating } from "./rating";
import { Text } from "./text";

/**
 * A product in a menu — a row, not a tile.
 *
 * The web grid renders squares; a phone in one hand wants a list, because the alternative
 * is two columns of truncated names and a price that wraps.
 *
 * Sold out is a **state the row keeps** rather than a row that disappears. The customer
 * came for this item — hiding it makes them wonder whether they imagined it, while a row
 * that says "Agotado" answers the question.
 *
 * The picture is `./image`, so the thumbnail is a `muted` box of the right size from the
 * first frame and the photograph fades in over it. A product row is a list of dozens of
 * these; a spinner in each one would be dozens of small spinning things on a screen whose
 * shape was never in question.
 *
 * The rating is the product's own — `rating` and `reviewCount` from the API, and nothing at
 * all when the review count is zero, because a dish nobody has reviewed is not a dish
 * rated zero. The count is off here and on on the detail page: on a menu the number is a
 * hint that moves the eye down the list, and four numbers in four rows is a column of
 * statistics the customer did not ask for.
 *
 * ## The row has no corner of its own
 *
 * The row is drawn square, and it is square for a reason on each of the two containers that
 * place it. Where the rows are a *group*, the radius and the clip belong to the box around
 * them: `app/search.tsx`, `app/favorites.tsx` and the home feed all wrap a run of rows
 * in the same `marginHorizontal: space.lg` + `radius.md` + `overflow: hidden` surface, which
 * is what makes a stack of full-width rows read as one object instead of as strips of the
 * page — and a row that rounded its own corner would draw a second, smaller one inside the
 * first. Where the rows reach the screen's edges with no box at all, there is no corner to
 * round: `app/cart.tsx`'s suggestions cancel the scroll's gutter to draw the menu
 * edge-to-edge, and a radius there would cut the row away from the two edges it is meant to
 * touch.
 *
 * That is the line `./list-row` now draws from the other side: its row keeps `radius.md` as
 * the surface's own corner, and squares only the two bottom corners while its divider is on,
 * because the hairline follows the corner it is on and an arc at each end bent it off the
 * line. Here nothing above owns the shape in the edge-to-edge case, and there is no corner to
 * round; in the group case the box above owns it, and a second, smaller one inside it would
 * be a mistake. The `radius.full` in this file is the discount chip, which is not the row's
 * shape at all: it is a pill inside it.
 *
 * ## Availability is the card's own field, and it carries no reason
 *
 * `productCardSchema.availability` is `{ inStock, quantity, maxOrderQuantity }` and nothing
 * else. There is **no** `unavailableReason` on a card — the only field of that name in
 * `packages/shared` is on `cartItemSchema`, where it explains a line that has already been
 * added and has since gone (`app/cart.tsx` renders it there). So the row draws the state it
 * has and invents no reason for it: "Agotado" is a fact about this card, and a reason would
 * be a sentence the API cannot answer.
 *
 * The one availability fact beyond the flag is the count, and it is only worth saying when it
 * is a *constraint*. `availabilityOf` sets `maxOrderQuantity` to `min(20, stockQuantity)` when
 * a shop tracks inventory (`packages/shared/src/schemas/catalog.ts`), and 20 is
 * `MAX_LINE_QUANTITY` — the most a single line may hold (`cart.addToCartInput.quantity`). A
 * stock at or above that ceiling can satisfy any line a customer can build, so printing
 * "Quedan 25" says nothing the stepper will not. Below it the ceiling *is* the stock, the
 * last unit is one tap away, and `product.lowStock` says how many are left.
 *
 * Neither state is decoration, so neither is only ink: each is drawn as a sentence in the
 * same slot, and the row's spoken `accessibilityLabel` carries the state too. It used to be
 * `product.title` and nothing else, which meant an explicit label swallowed the drawn
 * "Agotado" on the one row where the word is the point — a reader who cannot see the row got
 * a product with no availability at all.
 *
 * ## One target, and it is the row
 *
 * The row is a `./pressable` and nothing else: a tap anywhere on it opens the product,
 * which is the screen that owns the quantity stepper and the option groups. A 44-point
 * "add" circle used to be drawn at the end of it, floored by `MIN_TOUCH_TARGET` and given
 * extra `hitSlop` reach — and it rendered on no screen in the app, because the optional
 * callback that drew it was never passed by any of the three screens that place a row. It
 * read as a feature of every menu while being dead weight in all of them. Deleting it is
 * the honest end of that: a row that committed the purchase outright would be the "one, no
 * options" order, on menus, search results and the feed, where the customer has not been
 * shown a quantity or an option group yet.
 *
 * The `product.add` key is not orphaned by this — `app/product/[id].tsx` is its caller, on
 * the one screen where the quantity and the options are in front of the reader.
 */
export function ProductRow({
	product,
	onPress,
	/** Suppressed on a storefront, where the shop's name is the screen's title. */
	showSeller = false,
}: {
	product: ProductCard;
	onPress: () => void;
	showSeller?: boolean;
}) {
	const { colors } = useTheme();
	const { t, tp } = useT();

	// Availability is the API's word (`availabilityOf`), not a stock number: a row that
	// computed `soldOut` locally from a count would disagree with the detail screen the
	// moment a shop used the "unavailable today" flag.
	const unavailable = !product.availability.inStock;

	/**
	 * The remaining count, and only when it is the ceiling on what can be ordered.
	 *
	 * `null` for a product whose shop does not track inventory (`availabilityOf` sends
	 * `quantity: null` there) and for one with stock at or above `MAX_LINE_QUANTITY`; see the
	 * docblock. Read from the field rather than remembered, because it moves as other
	 * customers order and the query that drew this row is the only thing that knows.
	 */
	const remaining =
		product.availability.quantity !== null &&
		product.availability.quantity < MAX_LINE_QUANTITY
			? product.availability.quantity
			: null;

	/**
	 * What the row says about itself, and the same words it says out loud.
	 *
	 * One string, used twice, so the drawn line and the spoken one cannot drift — the row is a
	 * single `Pressable` whose explicit label *replaces* its children for a screen reader
	 * (`./status-badge` pays the same price and answers it the same way, by composing the
	 * sentence it draws). Sold out wins over the count when both are true, because a count of
	 * zero is not "Quedan 0".
	 */
	const availability = unavailable
		? t("product.soldOut")
		: remaining !== null
			? // `tp`, not `t`: *quedar* agrees with what is left, so the last unit is "Queda 1"
				// and every count above it is "Quedan 3" — one key with a `_plural` sibling rather
				// than one form bent over both. See the Spanish file's note on the pair.
				tp("product.lowStock", remaining)
			: null;

	return (
		<Pressable
			onPress={onPress}
			scaleTo={PRESS_SCALE_ROW}
			accessibilityRole="button"
			accessibilityLabel={
				availability ? `${product.title} · ${availability}` : product.title
			}
			style={({ pressed }) => [
				styles.row,
				{ borderBottomColor: colors.border },
				pressed && { backgroundColor: colors.muted },
			]}
		>
			<Image
				uri={product.imageUrl}
				style={[styles.thumb, { borderColor: colors.border }]}
				// The row's own label already names the product; a thumbnail announced beside
				// it would be an unlabelled image on every line of the menu. Both props,
				// because they are one platform each — `accessibilityElementsHidden` is iOS's
				// and `importantForAccessibility` is Android's, both declared on RN 0.86.3's
				// `AccessibilityProps` (`ViewAccessibility.d.ts:128`, `:182`).
				accessibilityElementsHidden
				importantForAccessibility="no"
			>
				{/* Only drawn when there is no photograph, so a transparent one never shows the
				    fallback `./image` draws through it. What is drawn is the product's own
				    initial, and no glyph: the reasoning is the render's below, and it is the
				    same one `./product-tile`'s photo box gives. */}
				{product.imageUrl ? null : (
					// The product's **own initial**, for the reason `./product-tile`'s stand-in
					// gives: this row and `app/cart` used to draw `fast-food-outline` here, and
					// that was a claim rather than a stand-in — a burger glyph over a bag of
					// coffee says something about what the product *is* that the row has no
					// field to know. A generic picture glyph says nothing at all, and a menu of
					// them is a menu of identical grey squares. `apps/web` draws the initial
					// (`HANDOVER.md` calls this difference open), so this closes it.
					//
					// `body` against `./product-tile`'s `display` is web's per-box scaling: the
					// letter is sized to the box it fills, and this one fills a 60pt thumb.
					// `tone="primary"` is the accent every sibling stand-in draws
					// (`./product-tile`, `./business-card`) — the letter is the one ink inside
					// a grey box, and `action` is a pressed control's colour, which this is not.
					<Text variant="body" tone="primary" bold>
						{product.title.trim().charAt(0).toUpperCase()}
					</Text>
				)}
			</Image>

			<View style={styles.body}>
				{/* No `numberOfLines`: the row's `minHeight` is a floor and not a height, so a
				    name that needs three lines at 200% text gets them rather than an ellipsis.
				    The seller line below carries the same rule. */}
				<Text variant="body" bold>
					{product.title}
				</Text>
				{showSeller || product.reviewCount > 0 ? (
					<View style={styles.metaRow}>
						{showSeller ? (
							// No `numberOfLines`: `./business-card`'s rule for its own fact line is
							// that a row wrapping is the answer and a truncated name is not, and the
							// name of the shop is what a customer scanning a cross-shop list is
							// reading for. `metaRow` already wraps, so a long name moves the rating
							// to the next line instead of cutting either.
							<Text variant="caption" tone="muted">
								{product.seller.name}
							</Text>
						) : null}
						<Rating
							rating={product.rating}
							count={product.reviewCount}
							showCount={false}
							variant="caption"
						/>
					</View>
				) : null}

				<View style={styles.priceRow}>
					<Price
						amountMinor={product.priceMinor}
						currency={product.currency}
						compareAtMinor={product.compareAtPriceMinor}
						variant="body"
					/>
					{product.discountPercent ? (
						<View
							style={[
								styles.discount,
								{ backgroundColor: colors.muted, borderColor: colors.border },
							]}
						>
							<Text variant="caption" tone="discount" bold tabular>
								{t("product.discount", { percent: product.discountPercent })}
							</Text>
						</View>
					) : null}
				</View>

				{/* One slot for the two availability states, so a row can never draw both and a
				    row with neither draws nothing. The string is `availability` above, which is
				    also what the row says out loud — `product.soldOut` for the flag,
				    `product.lowStock` for the count that caps what can be ordered. It is not
				    the ternary that stood here, which tested the same expression `unavailable`
				    already held. `product.unavailable` keeps its caller — `./option-card` uses
				    it for the option-level case, which is a per-option fact this row never has. */}
				{availability ? (
					<Text variant="caption" tone="muted">
						{availability}
					</Text>
				) : null}
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		// The touch floor plus one step: a row is a 60pt thumbnail beside up to three lines
		// of text, and a product whose name is one short line must not draw a row shorter
		// than the picture in it. `./skeletons` reads the same sum, or the swap jumps.
		minHeight: MIN_TOUCH_TARGET + space.xl,
		paddingVertical: space.md,
		paddingHorizontal: space.lg,
		borderBottomWidth: StyleSheet.hairlineWidth,
		// Square, and named so because `./pressable`'s base would otherwise hand the row
		// `radius.sm` — the one corner this row must not take. The group box above it owns the
		// shape (`radius.md` with `overflow: hidden`, where the row's own corners never showed),
		// and where the rows reach the screen's edges there is no corner to round; without
		// this the pressed fill drew 6pt corners inside the group's 12pt ones. `docs/design.md`'s
		// rounded-none-with-a-comment, for the argument in full: "The row has no corner of its
		// own", above.
		borderRadius: 0,
	},
	thumb: {
		width: media.row,
		height: media.row,
		borderWidth: 1,
	},
	body: { flex: 1, gap: TEXT_STACK_GAP },
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		// The seller's name and the rating share one line; at 200% text the rating moves to
		// the next one rather than being squeezed to nothing.
		flexWrap: "wrap",
	},
	priceRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		flexWrap: "wrap",
	},
	// The discount chip, and it is the same chip `app/featured.tsx` draws — `muted` behind the
	// `discount` tone with a hairline rather than a filled red pill, so one product does not
	// change weight between a menu row and the grid the feed's "Ver todo" leads to. The fill is
	// the other reading and it costs the tone: `discountForeground` is a palette pair with no
	// `TextTone` behind it (`./text`'s list ends at `inverse`), so a filled pill puts the ink
	// back at the call site as a `style` override. `./skeletons`' `badgeHeight` reads this same
	// box off the featured badge — `space.xs` of inset around a `caption` line — so the two
	// files moving together is what keeps the skeleton the right size.
	discount: {
		paddingHorizontal: space.xs,
		paddingVertical: space.xs / 2,
		borderRadius: radius.full,
		borderWidth: 1,
	},
});
