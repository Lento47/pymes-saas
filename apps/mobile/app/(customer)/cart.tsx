import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMoney } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Image } from "@/components/image";
import { Price } from "@/components/price";
import { ProductRow } from "@/components/product-row";
import { PromoInput, PromoSheet, usePromoCode } from "@/components/promo-input";
import { useRefreshControl } from "@/components/pull-refresh";
import { QuantityStepper } from "@/components/quantity-stepper";
import { RollbackNotice } from "@/components/rollback-notice";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { useSkeletonHold } from "@/components/skeleton";
import { CartSkeleton } from "@/components/skeletons";
import { BarTotal, SummaryCard } from "@/components/summary-card";
import { Text } from "@/components/text";
import { useCartLineQuantity } from "@/lib/cart-mutations";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, media, radius, space, TEXT_STACK_GAP, useTheme } from "@/theme";

/**
 * The basket.
 *
 * Every number on this screen is the API's. The subtotal, the discount and the total come
 * back with the cart and are never added up here, because a client that computes its own
 * total is a client that can show a total the order will not have — and the checkout
 * compares the quote against exactly this figure before it places anything.
 *
 * ## The total and the button do not scroll
 *
 * A cart used to end the way a receipt ends: the lines, then the totals, then the button,
 * one after another down the page. That was this screen's defect. `docs/design-mobile.md`
 * puts "hiding the total, the fee or the delivery price behind a tap, an animation, or a
 * scroll" in its out-list, and the end of a long cart is exactly where that happens by
 * accident — six lines down, the number the customer is deciding about is off the screen and
 * the button that spends it is further. So the total and the one action sit in
 * `./action-bar`, pinned to the floor, and what scrolls is the basket itself: the lines, the
 * promo row, and the receipt they add up to.
 *
 * The bar carries the *total*, not the count. A count is what a tab badge is for; the figure
 * a customer checks before buying is the one that has to be on screen when the thumb is over
 * the button.
 *
 * ## A line carries the line
 *
 * A cart line is not a receipt row with a name on it: it is the thing the customer chose, and
 * they are looking at it to check it is the right one. So each line draws the product's own
 * picture (`cartItemSchema.imageUrl`), its name, the options that were chosen and any note
 * they left, and it keeps the line total beside the stepper that changes it — `./price` and
 * `./quantity-stepper` on one row, so the number and the control that moves it are the same
 * object on the screen. The picture is `media.row`, the same box `./product-row` draws, at
 * the same default corner: it is the same photograph of the same product in a second list.
 *
 * The line's total is drawn at the size of the text beside it rather than at `heading`,
 * because the cart's loud number is the one in the bar (Rule 1) and a second heading-sized
 * figure two lines above it is the second shout. `./price` keeps it in `colors.price` with
 * tabular digits either way, which is what separates money from prose.
 *
 * ## The minimum order, as progress and as a sentence
 *
 * Below the business's minimum the CTA is disabled *and* the reason is printed — in the
 * strip directly above the button, which is where a sentence about a control belongs. A
 * disabled button with no sentence is a screen that has quietly decided something on the
 * customer's behalf, and the sentence is the business's own number.
 *
 * Beside that sentence the same fact is drawn as the distance to it: the strip's track is
 * filled by the share of the minimum the basket already holds. That share needs no second
 * read and no copy of the shop's minimum, because `cartTotalsSchema` carries both halves of
 * it: `apps/api/src/services/cart.ts` computes
 * `missingForMinOrderMinor = max(0, minOrderMinor - subtotalMinor)`, so while the strip is
 * drawn `subtotalMinor + missingForMinOrderMinor` **is** the business's minimum, exactly, and
 * `subtotalMinor` over that sum is the filled share. It is the goal gradient of
 * `docs/design-mobile.md` in the one place a cart can honestly have one: how much more until
 * the order can be placed, from the business's own figure. The track is hidden from the
 * accessibility tree — it is the same fact as the sentence, and a bar is not a statement.
 *
 * ## The receipt, drawn once
 *
 * `./summary-card` draws the receipt and is the *same component* the checkout's review step
 * draws, so the two cannot drift: the cart and the confirmation of the order are the same
 * numbers in the same order, or one of them is wrong.
 *
 * The cart's totals carry no delivery fee — the API zeroes it until a fulfilment mode is
 * chosen, because it cannot know yet whether this order is collected or brought. So this
 * screen draws no delivery row and the checkout draws one; that is the only difference
 * either is allowed, and it is reported rather than worked around here.
 *
 * ## What else you might add
 *
 * Above the receipt, and above the promo row and the way back to the shops: a section of this
 * shop's other products, minus the ones already in the basket, drawn as `./product-row` — the
 * `cartSuggestionsSchema` row. It is where it is because the receipt has to stay attached to
 * the lines it totals and the bar repeats the total anyway, so the last thing read before the
 * button is the figure the button spends. It is *not* drawn when the cart is empty: the empty
 * screen is a way back to the shops, and a suggestion there would be a second, quieter one.
 *
 * `cartSuggestionsSchema` is in `@pymeshub/shared` and nothing produces it — see the note on
 * the query below, which composes the row from the public catalogue read instead.
 *
 * ## The promo row
 *
 * `./promo-input`: a line in the receipt block that opens a sheet with the field in it. It
 * is here because the API takes a code — `cart.applyPromotion` stores it and the discount
 * that comes back is a real amount. The sheet is a *sibling* of the scroll below, not a
 * child of it, and that file says why. Its two writes are confirmed by a toast, fired from
 * the hook that performs them rather than by either component: what changed is this screen —
 * the row and the receipt under it — and the refusal path keeps its own sentence in the row
 * instead, so a code the server rejected is explained rather than merely announced.
 *
 * ## The quantity controls are optimistic
 *
 * See `lib/cart-mutations.ts`. The stepper moves under the finger and the request follows; a
 * refusal rolls the line back and prints the API's own sentence under the list, which is the
 * only place a customer can see it next to the thing that changed. Placing the order is not
 * optimistic and is not here at all — see `app/checkout.tsx`.
 *
 * ## The poll runs while the cart has lines, and stops when it has none
 *
 * The rule `app/orders.tsx` applies to its list, applied here: the interval keeps the
 * loaded data current *while something in it can still change*, and is `false` once nothing
 * can. Every number on this screen is read off its lines — a subtotal, a discount on it, the
 * price beside a stepper — and those move because the **shop** moved: a price edited, a
 * product sold out while it sat in the basket. With no lines there is no such number and the
 * screen is `./empty-state`: a fixed sentence and a way back to the shops, whose only fact
 * ("you have nothing in your cart") a re-read cannot change. Polling it anyway is a request
 * every fifteen seconds whose answer cannot differ, which is the same reason the terminal half
 * of the orders list does not poll.
 *
 * What an empty cart still needs is covered by the two backstops every query here has —
 * `lib/trpc/provider.tsx` sets a 30-second `staleTime` and feeds app-foreground into React
 * Query's focus manager, so arriving at this screen, or bringing the app back to it, re-reads
 * it once the answer is older than that. The poll is for the cart that is *already on screen*,
 * and a cart with nothing in it has nothing to keep current.
 *
 * ## A pull refreshes it
 *
 * Rule 6: a cart is a list whose data can change while it is on screen — it belongs to the
 * *account*, not the phone — so it answers a pull, wired to this query's own `refetch`. The
 * control itself is `./pull-refresh`'s, and this screen is the clearest case for the rule that
 * file states: the flag belongs to the pull and not to the query, because this cart also polls
 * and `isRefetching` is true during a poll, which would raise the spinner under a finger that
 * never pulled. Checkout is Rule 6's exception and stays one.
 *
 * ## The one screen whose length changes
 *
 * A cart is the only surface in the app where the customer removes the thing they are
 * looking at, so it is the one that needs the reorder half of `./animate-in`: the lines enter
 * as a group, and when one leaves the rows below it close the gap on the layout spring
 * instead of jumping. The sections below them carry the line count as their index so they
 * enter with the last line and never behind it — a total that faded in after the thing it
 * totals would be a total the customer read too late.
 */
export default function Cart() {
	const { t } = useT();
	return (
		// `contentStyle` strips the body's horizontal padding rather than adding to it: the
		// scroll and the bar pad themselves, and a bar has to reach the screen's edges to be a
		// bar. The title strip is drawn by `Screen` and keeps its own padding, so nothing in the
		// header moves. The screen pays no bottom inset — the bar owns that, and paying it twice
		// would leave the button floating above the home indicator.
		<Screen title={t("nav.cart")} contentStyle={styles.frame}>
			<SignedIn>
				<Basket />
			</SignedIn>
		</Screen>
	);
}

/**
 * How many of the shop's products to read when looking for something to complete the order,
 * and how many of them to draw.
 *
 * Two numbers rather than one because the filter runs on the answer: the read has to be wider
 * than the row, or a customer holding three of the shop's six products gets a section with
 * nothing in it and no reason. Six is a slice of a menu rather than a menu — `productListInput`
 * caps at 50 and this row is a footnote to the basket, not a second storefront — and three is
 * what fits above the receipt without pushing it off the screen it shares with the bar.
 */
const SUGGESTION_READ = 6;
const SUGGESTION_SHOWN = 3;

/** How often a cart with lines in it is re-read. See the poll's section in the docblock. */
const POLL_MS = 15_000;

function Basket() {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const { colors } = useTheme();
	const cart = useQuery(
		trpc.cart.get.queryOptions(undefined, {
			// Read off the answer rather than decided once, so the interval follows the cart
			// the screen is showing: lines to keep current, or none. See the docblock.
			refetchInterval: (q) =>
				(q.state.data?.items.length ?? 0) > 0 ? POLL_MS : false,
		}),
	);
	const { setQuantity, error } = useCartLineQuantity();
	const waiting = useSkeletonHold(cart.isPending);
	const [promoOpen, setPromoOpen] = useState(false);
	/**
	 * Which *opening* of the promo sheet this is — the sheet's React key, and the whole
	 * mechanism behind its draft.
	 *
	 * `./promo-input`'s field is a draft of the code on the cart, and it has to be re-seeded
	 * when the customer opens the sheet and left alone while they are typing. It re-seeds from
	 * a fresh mount (`useState(code ?? "")` runs once, at mount), so the only question is when
	 * to mount. Keying on the open state — `key={promoOpen ? "open" : "closed"}`, the obvious
	 * spelling — answers that with "on both edges", and the closing edge is the problem: React
	 * unmounts the old element and mounts a new one, so `./sheet`'s own `mounted`/`open` split
	 * never runs and the panel disappears between two frames instead of paying the 224ms exit
	 * it documents. A counter that only ever moves on *open* changes the key on the edge that
	 * matters and leaves the closing edge to the primitive.
	 *
	 * It is deliberately not `key={promotionCode}`: the cart query polls every 15 seconds and a
	 * code set on another device arrives on that poll, so keying on the value would remount the
	 * sheet — dropping the keyboard and wiping the field — mid-keystroke.
	 */
	const [promoSession, setPromoSession] = useState(0);
	const promo = usePromoCode();

	/**
	 * Something else from the same shop, read from the public catalogue.
	 *
	 * There is no `cart.suggestions` procedure: `cartSuggestionsSchema` is defined in
	 * `packages/shared/src/schemas/cart.ts` and a search for it across `apps/` and `packages/`
	 * finds the schema file and no producer and no consumer. The honest choices were to draw
	 * no such row or to compose it from a read that already exists, and the second one is
	 * possible because the row is one list of `ProductCard`s: `products.list` is public, it
	 * takes the `businessId` the cart itself carries, and it filters to the shop's live
	 * catalogue server-side. What is *not* done here is a second pricing or availability
	 * implementation — every field the row draws, including `availability`, comes off the API's
	 * own card. When a suggestions procedure lands, this query is the one line that changes.
	 *
	 * Enabled on the cart's business rather than on the screen, so the first frame of a cart
	 * that has not answered yet does not fire a catalogue read for an unknown shop.
	 */
	const businessId = cart.data?.businessId ?? undefined;
	const suggestions = useQuery(
		trpc.products.list.queryOptions(
			// `popular` rather than the input's default `relevance`, which is a sort with nothing
			// to rank by when there is no search term — the storefront's own list passes this same
			// value for the same reason. What "you might add" means is what other people order.
			{ businessId, limit: SUGGESTION_READ, sort: "popular" },
			{ enabled: Boolean(businessId) },
		),
	);

	/** Open the sheet, and start a new session so the field is seeded from the cart afresh. */
	const openPromo = () => {
		setPromoSession((session) => session + 1);
		setPromoOpen(true);
	};

	// The pull. The section at the top of this file says why the cart has one and
	// `./pull-refresh` holds the control; the failure the read can answer with is drawn by the
	// `ErrorState` below, which is what makes the pull a gesture and not a second report.
	const refreshControl = useRefreshControl(cart.refetch);

	// The early return guards on the data itself rather than on `isPending`: the skeleton's
	// minimum hold means this screen can still be showing placeholders for a moment *after*
	// the answer landed, and a guard on the flag alone lets the render below read an
	// undefined cart in that window.
	if (cart.isError)
		return (
			<View style={styles.pad}>
				<ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
			</View>
		);

	const basket = cart.data;
	if (waiting || !basket) return <CartSkeleton />;
	if (!basket.items.length)
		return (
			<View style={styles.pad}>
				<EmptyState
					title={t("cart.empty.title")}
					actionLabel={t("cart.empty.action")}
					onAction={() => router.replace("/")}
				/>
			</View>
		);

	const { currency, totals, promotionCode, promotionError } = basket;
	const short = totals.missingForMinOrderMinor > 0;
	// Formatting the shortfall needs the currency the cart is in, which is in hand by here —
	// the sentence is the API's number, formatted once and used in both places it appears (the
	// strip and the disabled button's hint).
	const shortfall = short
		? t("cart.minOrderMissing", {
				amount: formatMoney(totals.missingForMinOrderMinor, currency, {
					locale: intlLocale,
				}),
			})
		: undefined;
	// The distance to the minimum, from the two integers the API sent: the business's own
	// minimum is `subtotal + missing` while the strip is drawn, so this is its exact inverse
	// and not a second copy of the shop's figure. `> 0` cannot be false here — the sum of two
	// non-negative integers one of which is positive — and it is written anyway so the
	// division is guarded where it happens rather than by the caller's context.
	const minimum = totals.subtotalMinor + totals.missingForMinOrderMinor;
	const reached =
		minimum > 0 ? Math.round((totals.subtotalMinor / minimum) * 100) : 0;

	// The cart's own lines as a set, so the row below cannot suggest what the customer has
	// already put in. Keyed on `productId`: two lines of the same product with different
	// options are still that product, and a suggestion of it would be a tap that lands on the
	// product screen they have already chosen from.
	const inCart = new Set(basket.items.map((item) => item.productId));
	const suggested = (suggestions.data?.items ?? [])
		// Sold out is a state the *menu* keeps (`./product-row` draws "Agotado" rather than
		// hiding the row), and this is not a menu: a suggestion that cannot be bought is not a
		// suggestion. The row that would draw it is the one place in the app where a product
		// the customer did not ask for appears, so nothing unavailable appears there.
		.filter(
			(product) => !inCart.has(product.id) && product.availability.inStock,
		)
		.slice(0, SUGGESTION_SHOWN);

	return (
		<>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
				// The scroll sits above the bar rather than under it — the two are siblings in the
				// layout, so the last row can never be hidden behind the button — and the indicator
				// still stops at the scroll's own edge rather than running into the bar.
				scrollIndicatorInsets={{ bottom: 0 }}
				refreshControl={refreshControl}
			>
				<AnimateIn index={0}>
					<Text variant="heading" bold>
						{basket.businessName}
					</Text>
				</AnimateIn>

				{basket.items.map((item, index) => (
					<AnimateIn key={item.id} index={index + 1} reorder>
						<Card style={styles.lineCard}>
							<View style={styles.line}>
								<Image
									uri={item.imageUrl}
									style={[styles.thumb, { borderColor: colors.border }]}
									// Decoration: the line's own name is right beside it, and an
									// unlabelled image announced on every line of a basket is what a
									// reader hears instead of the name.
									accessibilityElementsHidden
								>
									{/* Only drawn when there is no photograph, so a transparent one never
									    shows the fallback icon through it — the same pairing
									    `./product-row` draws, at the same size.

									    `image-outline`, the app's one mark for this absence:
									    `./gallery`'s hero and `./product-tile`'s photo box draw the
									    same name for the same missing `imageUrl`. This line and the
									    menu row used to draw `fast-food-outline`, which is a claim
									    about what the product is rather than a stand-in for the
									    picture it does not have — see `./product-row`. */}
									{item.imageUrl ? null : (
										<Ionicons
											name="image-outline"
											size={icon.action}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									)}
								</Image>

								<View style={styles.lineBody}>
									{/* No `numberOfLines`, which is the rule this app already holds itself to:
									    `./product-row` and `./list-row` both let a name wrap and the row grow,
									    because the name is what the customer is checking this line against
									    and a name cut in half is the one thing they cannot verify. At 200%
									    text the line gets taller, which is the correct failure. */}
									<Text variant="body" bold>
										{item.name}
									</Text>
									{item.options.length ? (
										<Text variant="caption" tone="muted">
											{item.options.map((option) => option.name).join(", ")}
										</Text>
									) : null}
									{item.notes ? (
										<Text variant="caption" tone="muted">
											{item.notes}
										</Text>
									) : null}
									{/* The state, and it is a sentence rather than a chip: the API sends a
									    reason ("agotado hoy"), and a reason belongs where it can be read in
									    full. It keeps the alert role it had — a line that became
									    unbuyable while it sat in the basket is the one thing here that
									    needs to interrupt. */}
									{item.unavailableReason ? (
										<Text
											variant="caption"
											tone="destructive"
											accessibilityRole="alert"
										>
											{item.unavailableReason}
										</Text>
									) : null}
								</View>
							</View>

							{/* The figure and the control that moves it, on one line: `space-between`
							    puts the total at the start of the row and the stepper at the end of
							    it, and the wrap is for 200% text, where the stepper takes its own
							    line rather than being squeezed into the price's. */}
							<View style={styles.lineFoot}>
								<Price
									amountMinor={item.lineTotalMinor}
									currency={currency}
									variant="body"
								/>

								<QuantityStepper
									value={item.quantity}
									onChange={(next) => setQuantity(item.id, next)}
									// Zero is a legal value here: the API removes a line at `quantity: 0`,
									// which is why the minus can go all the way down to it.
									min={0}
									label={t("product.quantity")}
									// The label names what the tap *does at this value*, which is the only
									// reading that stays true: at one it removes the line, and at every
									// value above it it takes one off. A fixed `cart.item.remove` ("Quitar")
									// announced a removal at three that yields two — a reader was told the
									// wrong thing about the control they were on. `product.quantity.decrease`
									// ("Quitar uno") is the general word; `cart.item.remove` is the true one
									// at the floor.
									decreaseLabel={
										item.quantity === 1
											? t("cart.item.remove")
											: t("product.quantity.decrease")
									}
									increaseLabel={t("product.add")}
								/>
							</View>
						</Card>
					</AnimateIn>
				))}

				<RollbackNotice error={error} />

				{/* The suggestions, above the receipt: what else this shop has, without the lines
				    already in the basket. The rows pad themselves — `./product-row` pays its own
				    `space.lg`, because a menu is a list of rows that reach the screen's edges — so
				    the block cancels the scroll's gutter instead of paying it twice, which is what
				    keeps a thumbnail aligned with the pictures in the cards above it. */}
				{suggested.length ? (
					<AnimateIn index={basket.items.length + 1} reorder>
						<View style={styles.suggestions}>
							<ScreenSection title={t("cart.suggestions.title")}>
								{suggested.map((product) => (
									<ProductRow
										key={product.id}
										product={product}
										onPress={() =>
											router.push({
												pathname: "/product/[id]",
												params: { id: product.id },
											})
										}
									/>
								))}
							</ScreenSection>
						</View>
					</AnimateIn>
				) : null}

				{/* The promo row, the receipt and the way back to the shops are one block because
				    they move as one: a line removed above them closes its gap and the whole block
				    rises, and a discount row appearing inside the receipt grows the block and moves
				    the ghost button under it down. The lines and this block carry `reorder` so those
				    two movements are animated rather than a jump — see `./animate-in` for what that
				    prop decides.

				    The tail is also the one block that must never be *staggered* behind the lines.
				    The total is the number the customer is deciding about, and
				    `docs/design-mobile.md` puts hiding it behind a tap, an animation or a scroll in
				    its out-list. Its index is the line count plus the one section above it, so it
				    enters with the last line and never after it — and at seven lines and beyond,
				    where the stagger has already flattened, it enters with all of them.

				    "Ver negocios cerca" stays at the end of this block rather than in the bar: the
				    bar holds the action the screen is for, and a second button beside it would be two
				    primaries in one place. It is the way back, not the way forward. */}
				<AnimateIn index={basket.items.length + 2} reorder>
					<View style={styles.tail}>
						<PromoInput
							code={promotionCode}
							error={promotionError}
							onPress={openPromo}
						/>
						<SummaryCard totals={totals} />
						<Button
							label={t("cart.empty.action")}
							variant="ghost"
							onPress={() => router.replace("/")}
						/>
					</View>
				</AnimateIn>
			</ScrollView>

			{short && shortfall ? (
				// The goal gradient, in the one place a cart can honestly have one: how much more
				// until the order can be placed. It is a fact about the basket, not a nudge — the
				// business's own minimum, and the checkout refuses below it as well. It sits in its
				// own strip above the bar rather than inside it, because the bar's summary slot
				// holds the total and a sentence about the *button* belongs next to the button.
				<View style={styles.why}>
					{/* The distance, drawn. Hidden from the tree: it is the same fact as the sentence
					    under it, and a reader is owed the words rather than the width of a bar. */}
					<View
						style={[styles.track, { backgroundColor: colors.muted }]}
						accessibilityElementsHidden
						importantForAccessibility="no"
					>
						<View
							style={[
								styles.fill,
								{
									width: `${reached}%`,
									backgroundColor: colors.primary,
								},
							]}
						/>
					</View>
					<Text variant="label" tone="muted">
						{shortfall}
					</Text>
				</View>
			) : null}

			<ActionBar
				summary={
					<BarTotal
						label={t("cart.total")}
						amountMinor={totals.totalMinor}
						currency={currency}
					/>
				}
				primary={{
					label: t("cart.checkout"),
					onPress: () => router.push("/checkout"),
					disabled: short,
					// The disabled button is not left to explain itself: the sentence in the strip
					// above says why in words, and the hint is the same sentence for a reader who
					// reached the button without passing the strip.
					accessibilityHint: shortfall,
				}}
			/>

			{/* Outside the scroll, because `./sheet` fills its nearest parent: a sheet inside a
			    `ScrollView` is laid out in the scrolled content and leaves the screen with it.

			    The `key` is the draft's mechanism rather than React's bookkeeping, and the poll
			    above does not retire it: the counter is what makes the mount *fresh* per opening,
			    and `./promo-input`'s field seeds itself at mount and never again — so without it
			    the sheet would hold whatever the cart said the first time the sheet mounted, for
			    the rest of this screen's life. Typing is safe either way, because it is the same
			    mount-once read from the other side; re-seeding on open is the half only the key
			    delivers. See the state above, and that file's docblock for both halves. */}
			<PromoSheet
				key={promoSession}
				open={promoOpen}
				onClose={() => setPromoOpen(false)}
				code={promotionCode}
				error={promotionError}
				pending={promo.pending}
				// Both writes fail the same way from the sheet's point of view — a request that did
				// not arrive — so the last of the two wins the slot under the field. Without the
				// second term a removal that failed would un-disable its button and say nothing,
				// which is the one thing a customer cannot tell from success here.
				failure={promo.failure ?? promo.removeFailure}
				removing={promo.removing}
				onApply={promo.apply}
				onRemove={promo.remove}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	// The frame the scroll and the bar divide between them: the body's full height, and none of
	// its padding. See the note at the call site.
	frame: { flex: 1, paddingHorizontal: 0 },
	// What the body's padding was, for the two branches that are a single centred block
	// rather than a screen: the error and the empty cart. The skeleton is not one of them —
	// it is a column with the scroll's own gutter, and it pays that itself, the way every
	// block in `./skeletons` does.
	pad: { paddingHorizontal: space.lg },
	scroll: {
		paddingHorizontal: space.lg,
		paddingBottom: space.lg,
		gap: space.lg,
	},
	// The card's two rows: the picture with what the line *is*, then the figure with the
	// control that changes it.
	lineCard: { gap: space.md },
	line: { flexDirection: "row", alignItems: "center", gap: space.md },
	// The same 60pt picture `./product-row` draws, at the same corner and border: it is the
	// same photograph of the same product, and a different box on the cart would read as a
	// different kind of thing.
	thumb: { width: media.row, height: media.row, borderWidth: 1 },
	lineBody: { flex: 1, gap: TEXT_STACK_GAP },
	lineFoot: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		// At 200% text the stepper is wider than the space left beside the amount, and a
		// second line is the honest answer — the same one `./product-row` gives its price row.
		flexWrap: "wrap",
	},
	// The rows inside this block pad themselves, so the block gives back the scroll's gutter.
	// A negative margin is what that is: the alternative is a second, narrower gutter on every
	// row and a thumbnail that does not line up with the pictures in the cards above it.
	suggestions: { marginHorizontal: -space.lg },
	// The block's own rhythm is the body's own `space.lg`, because these three were children of
	// the body before they were children of a block: grouping them for the reorder animation must
	// not change the distance between them.
	tail: { gap: space.lg },
	// The strip above the bar: the track, then the sentence it is about.
	why: {
		paddingHorizontal: space.lg,
		paddingBottom: space.sm,
		gap: space.sm,
	},
	// `space.xs` tall at `radius.full`, which rounds its ends: a hairline would read as a rule
	// rather than as a measure, and anything thicker starts to compete with the button under it
	// — this strip exists to explain that button, not to be the screen's second loud thing.
	track: {
		height: space.xs,
		borderRadius: radius.full,
		overflow: "hidden",
	},
	fill: { height: "100%", borderRadius: radius.full },
});
