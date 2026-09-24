/**
 * The cart, written before the server has answered.
 *
 * `docs/design-mobile.md` allows optimism in exactly one place: where the outcome is
 * certain. A quantity is that case — the customer is holding the phone, the number they
 * asked for is the number they mean, and the round trip is a second of their life spent
 * watching a stepper that has already decided. So the cart is edited in the cache first,
 * and the request follows.
 *
 * Two rules ride along with that, and both are in the spec:
 *
 * 1. **A rollback says so.** `onError` restores the snapshot it took and fires `warning()`;
 *    the screen renders the API's own sentence through `RollbackNotice`. A change that
 *    silently un-does itself is worse than one that never happened.
 * 2. **Placing an order is not optimistic.** `orders.place` can be refused — the shop
 *    closed, the price moved, the quote changed — and an order that appears and is then
 *    taken back is the one thing this file must never do. See `app/checkout.tsx`, which
 *    waits for the API and shows the peak in `components/order-placed.tsx` afterwards.
 *
 * ## Absolute quantities, and one request per line
 *
 * `cart.updateItem` takes the quantity, not a delta, which is what makes a queue
 * possible: `+ + +` on a slow connection is three taps that must end at the same number
 * whichever order the answers arrive in. Two guards follow from that. Only one request
 * per line is in flight, and the taps that land while it is running rewrite the *intent*
 * rather than starting a second request. The request that finally settles is always the
 * newest one, so its response — the whole cart, as every cart procedure returns it — is
 * safe to write straight into the cache.
 *
 * That also fixes the rollback's base. Because a new request only starts once the last
 * one has settled, the snapshot taken in `onMutate` is always a state the server
 * confirmed, never one an earlier tap invented.
 *
 * ## The totals mirror, and why it errs high
 *
 * The line totals are arithmetic: `effectiveUnitPriceMinor` comes from the server and
 * multiplying by a quantity cannot invent a price. The discount is the one figure this
 * file cannot recompute — the *kind* of discount is not on the wire, only the amount it
 * came to — so the server's amount is kept and clamped to the new subtotal. Everything
 * else (`delivery`, `tax`, `tip`) is carried over untouched.
 *
 * The response replaces all of it within one round trip. Where the mirror is a guess, it
 * is a guess in the safe direction: a discount that is too small rather than too large,
 * so the number the customer sees mid-write is never lower than the number they are
 * about to be charged. Money stays an integer in the minor unit throughout, and nothing
 * here ever divides a colón by a hundred.
 */

import {
	type AddToCartInput,
	type Cart,
	type CartItem,
	type CartTotals,
	MAX_LINE_QUANTITY,
	type ProductCard,
} from "@pymeshub/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";

/**
 * The id a line has until the server names it.
 *
 * Deliberately not shaped like a real one (`cit_…`): nothing should ever be able to send
 * this back to the API, and a key that looks temporary is the cheapest way to make that
 * obvious at a glance. The response that lands moments later replaces the whole cart, so
 * nothing holds this id for longer than a round trip.
 */
const PENDING_LINE_ID = "cit_pending";

/** The same arithmetic the API does, on a list this client just changed. */
function totalsOf(totals: CartTotals, items: CartItem[]): CartTotals {
	const subtotalMinor = items.reduce(
		(sum, item) => sum + item.lineTotalMinor,
		0,
	);
	const discountMinor = Math.min(totals.discountMinor, subtotalMinor);
	const totalMinor = Math.max(
		0,
		subtotalMinor -
			discountMinor +
			totals.deliveryFeeMinor +
			totals.taxMinor +
			totals.tipMinor,
	);

	return { ...totals, subtotalMinor, discountMinor, totalMinor };
}

function withItems(cart: Cart, items: CartItem[]): Cart {
	return { ...cart, items, totals: totalsOf(cart.totals, items) };
}

/** A line at a new quantity, or gone at zero — which is how the API takes a removal too. */
function withQuantity(cart: Cart, cartItemId: string, quantity: number): Cart {
	const items =
		quantity <= 0
			? cart.items.filter((item) => item.id !== cartItemId)
			: cart.items.map((item) =>
					item.id === cartItemId
						? {
								...item,
								quantity,
								lineTotalMinor: item.effectiveUnitPriceMinor * quantity,
							}
						: item,
				);

	return withItems(cart, items);
}

/** How many units the basket holds — the figure the announcement reads out. */
function unitsIn(cart: Cart): number {
	return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * One line's quantity, and the removal that `quantity: 0` performs.
 *
 * The API has no "decrease" and no separate removal for a line: `quantity: 0` deletes it.
 * That is why this hook covers the minus button down to zero rather than switching to a
 * different procedure at the bottom of the range — one call, one snapshot, one rollback.
 */
export function useCartLineQuantity(): {
	setQuantity: (cartItemId: string, quantity: number) => void;
	/** The failed write, for the screen's rollback notice. Cleared by the next tap. */
	error: unknown;
	isPending: boolean;
} {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { tp } = useT();
	const key = trpc.cart.get.queryKey(undefined);

	// Per line: whether a request is on the wire, and the number the customer last asked
	// for. A tap while `running` holds the line rewrites `wanted` and sends nothing.
	const running = useRef(new Set<string>());
	const wanted = useRef(new Map<string, number>());

	const mutation = useMutation(
		trpc.cart.updateItem.mutationOptions({
			onMutate: async ({ cartItemId, quantity }) => {
				// A poll that started before this tap would otherwise land on top of the
				// optimistic write and put the old quantity back for a moment.
				await cache.cancelQueries({ queryKey: key });
				const previous = cache.getQueryData<Cart>(key);
				if (previous) {
					cache.setQueryData<Cart>(
						key,
						withQuantity(previous, cartItemId, quantity),
					);
				}
				return { previous };
			},
			onError: (_error, _input, context) => {
				if (context?.previous) cache.setQueryData(key, context.previous);
				// The failed optimistic write, which is one of the four reasons the vocabulary
				// in `lib/haptics.ts` has a word for.
				warning();
			},
			onSuccess: (cart) => {
				// Every cart procedure answers with the whole cart, so there is nothing to
				// invalidate: the response *is* the fresh state, including the totals this
				// file could only mirror.
				cache.setQueryData(key, cart);
				AccessibilityInfo.announceForAccessibility(
					tp("order.itemCount", unitsIn(cart)),
				);
			},
		}),
	);

	const setQuantity = useCallback(
		(cartItemId: string, quantity: number) => {
			if (quantity < 0 || quantity > MAX_LINE_QUANTITY) return;

			wanted.current.set(cartItemId, quantity);
			if (running.current.has(cartItemId)) return;

			running.current.add(cartItemId);
			// Fired here rather than in `onSuccess` because the change the customer is being
			// told about has already happened on screen: the stepper moved the moment they
			// tapped. A buzz a round trip later would be reporting the network, not the tap.
			light();

			void (async () => {
				try {
					for (;;) {
						const next = wanted.current.get(cartItemId);
						if (next === undefined) break;
						await mutation.mutateAsync({ cartItemId, quantity: next });
						// Only stop when nothing newer arrived while this was on the wire;
						// otherwise send the newest intent on top of the confirmed cart.
						if (wanted.current.get(cartItemId) === next) break;
					}
				} catch {
					// `onError` has already rolled the cache back and buzzed. The loop stops
					// here rather than re-sending a write the API just refused — a refusal is
					// a fact about the cart, and repeating it changes nothing.
				} finally {
					running.current.delete(cartItemId);
					wanted.current.delete(cartItemId);
				}
			})();
		},
		[mutation],
	);

	return { setQuantity, error: mutation.error, isPending: mutation.isPending };
}

/**
 * What a caller knows about a line before the server has built one.
 *
 * The product screen is holding the name, the price and the chosen options already — it
 * rendered them — so it can describe the line it is asking for. This is what makes an
 * optimistic add possible at all: without it the client would be drawing a blank row and
 * waiting to find out what it was.
 */
export type ProvisionalLine = {
	name: string;
	/** The price before options, as the product row shows it. */
	unitPriceMinor: number;
	/** Price plus every chosen option's delta — the figure the line total multiplies. */
	effectiveUnitPriceMinor: number;
	options?: CartItem["options"];
	imageUrl?: string | null;
	notes?: string | null;
};

/**
 * Add to cart, optimistically.
 *
 * The one case where this file is guessing: `cart.addItem` has four ways to refuse — the
 * basket belongs to another shop, the cart is full, an option disappeared, the shop is
 * closed — and the customer finds out by watching their line arrive and then leave, with
 * the API's sentence in its place.
 *
 * That is a deliberate trade, not an oversight. The alternative is a tap that does nothing
 * visible for as long as the network takes, on the one screen in the app that is used the
 * most. A retraction is a poor experience; a second of dead thumb is a worse one, and the
 * rollback is loud in all three ways the spec asks for — the sentence, the `warning`
 * haptic, and the line's own disappearance.
 *
 * A `CONFLICT` also lands in `error`, and it is the caller's to act on: `product/[id].tsx`
 * — the hook's call site — is the screen that knows the cart belongs to another shop and
 * can offer to start a new one.
 *
 * Rapid taps are not deduplicated the way a quantity step is — two adds are two adds, and
 * the API's up-sert makes that the quantity the customer asked for. What that costs is a
 * snapshot taken on top of an earlier optimistic write, so a refusal here can restore a
 * cart that is one round trip stale. It resolves itself the moment the other request
 * settles.
 *
 * ## What the screen does with the answer arrives as an argument
 *
 * The write, the rollback and the announcement are this hook's; what the answer *means* is
 * the screen's, and it cannot be inferred here — that screen goes to the cart once the line
 * landed, and puts the cross-shop question to the customer when the API refused. So
 * `add(input, line)` is unchanged and those two arrive as one optional argument. They are
 * called from this hook's own handlers rather than handed to `mutate` per call, so the cache
 * write (or the rollback and its `warning()` haptic) and the screen's callback run in that
 * order, in one place.
 */
export function useAddToCart(callbacks?: {
	/** The line landed. `product/[id].tsx` opens the cart it landed in. */
	onSuccess?: () => void;
	/** The API refused. The rollback has already happened; `error` carries the refusal. */
	onError?: (error: unknown) => void;
}): {
	add: (input: AddToCartInput, line: ProvisionalLine) => void;
	error: unknown;
	isPending: boolean;
} {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { tp } = useT();
	const key = trpc.cart.get.queryKey(undefined);
	// What the caller knows about each product it is adding. Keyed by product rather than
	// kept as one value, because `onMutate` is only handed the API's input and a second tap
	// in the same tick would otherwise have replaced the first one's description.
	const lines = useRef(new Map<string, ProvisionalLine>());

	const mutation = useMutation(
		trpc.cart.addItem.mutationOptions({
			onMutate: async (input) => {
				await cache.cancelQueries({ queryKey: key });
				const previous = cache.getQueryData<Cart>(key);
				const line = lines.current.get(input.productId);
				if (previous && line) {
					cache.setQueryData<Cart>(
						key,
						withItems(previous, [...previous.items, pendingLine(input, line)]),
					);
				}
				return { previous };
			},
			onError: (error, _input, context) => {
				if (context?.previous) cache.setQueryData(key, context.previous);
				warning();
				callbacks?.onError?.(error);
			},
			onSuccess: (cart) => {
				cache.setQueryData(key, cart);
				AccessibilityInfo.announceForAccessibility(
					tp("order.itemCount", unitsIn(cart)),
				);
				callbacks?.onSuccess?.();
			},
		}),
	);

	const add = useCallback(
		(input: AddToCartInput, line: ProvisionalLine) => {
			lines.current.set(input.productId, line);
			light();
			mutation.mutate(input);
		},
		[mutation],
	);

	return {
		add,
		error: mutation.error,
		isPending: mutation.isPending,
	};
}

/**
 * The line the optimist draws, from the input the API is about to receive.
 *
 * The fields the server would default are defaulted here the same way, so the drawn line and
 * the returned one agree on its quantity: `cart.addItem` treats a missing `quantity` as one,
 * and a provisional line that said otherwise would move the moment the answer landed.
 */
function pendingLine(
	input: { productId: string; quantity?: number },
	line: ProvisionalLine,
): CartItem {
	const quantity = input.quantity ?? 1;

	return {
		id: PENDING_LINE_ID,
		productId: input.productId,
		name: line.name,
		imageUrl: line.imageUrl ?? null,
		quantity,
		unitPriceMinor: line.unitPriceMinor,
		effectiveUnitPriceMinor: line.effectiveUnitPriceMinor,
		lineTotalMinor: line.effectiveUnitPriceMinor * quantity,
		options: line.options ?? [],
		notes: line.notes ?? null,
		unavailableReason: null,
	};
}

/**
 * The shelf's "+": one tap, one unit — and only where one unit is the whole answer.
 *
 * This is the third attempt at a quick-add in this app, and the first two were deleted for
 * reasons that are still true. `./product-row`'s docblock records the deletion: a target
 * that committed the purchase outright produced "the 'one, no options' order, on menus,
 * search results and the feed, where the customer has not been shown a quantity or an
 * option group yet", and `./product-tile` carries the same sentence as its reason for
 * having no add button at all. Both were right against the data they had, because a
 * `ProductCard` says nothing about options — there was no way to tell a croissant (nothing
 * to choose) from an iced latte (size and milk), so every "+" was a coin toss on the
 * order's correctness.
 *
 * **The card still says nothing about options; the detail does.** So the tap reads
 * `products.byId` first and branches on `optionGroups`: any group that is `isRequired` or
 * `minSelect >= 1` means one unit is *not* the whole answer, and the caller is handed the
 * product to open (`onNeedsOptions`) instead of a line being written. The read is a real
 * round trip and it is the honest price of the button — `cache.fetchQuery` rather than the
 * cache alone, because option groups change when a shop edits its menu and a stale answer
 * here writes an order missing a choice the shop requires.
 *
 * Everything else is `useAddToCart`'s, unchanged: the optimistic line, the rollback and its
 * `warning()` haptic, the announcement. What the *answer* means stays the screen's, which is
 * that hook's own contract — so the confirmation (`./toast`, `product.added`) is `onAdded`
 * and not a toast fired from here. `lib/` does not import a primitive.
 *
 * `quantity: 1` is what the "+" means on every delivery surface this vocabulary is borrowed
 * from, and it is defensible here for the same reason the branch above is: the shelf is the
 * customer's *own* finished orders, so these are items they have bought in a quantity
 * before. Anything else — a stepper, options, notes — is `app/product/[id]`, one tap away
 * behind the same tile.
 */
export function useQuickAdd(callbacks?: {
	/** The line landed. The caller confirms in `./toast` with `product.added`. */
	onAdded?: (name: string) => void;
	/** The product requires choices. The caller opens `app/product/[id]`, which owns them. */
	onNeedsOptions?: (product: ProductCard) => void;
	/** The API refused. The rollback has already happened; `error` carries the refusal. */
	onError?: (error: unknown) => void;
}): {
	quickAdd: (product: ProductCard) => void;
	isPending: boolean;
} {
	const trpc = useTRPC();
	const cache = useQueryClient();
	// One tap is one product, and `show()` replaces a toast rather than queueing it — so the
	// last tap's name is the only one that can be on screen anyway.
	const last = useRef<ProductCard | null>(null);
	const [checking, setChecking] = useState(false);

	const { add, isPending } = useAddToCart({
		onSuccess: () => {
			if (last.current) callbacks?.onAdded?.(last.current.title);
		},
		onError: (error) => callbacks?.onError?.(error),
	});

	const quickAdd = useCallback(
		(product: ProductCard) => {
			last.current = product;
			setChecking(true);
			void (async () => {
				try {
					const detail = await cache.fetchQuery(
						trpc.products.byId.queryOptions({ id: product.id }),
					);
					const needsOptions = detail.optionGroups.some(
						(group) => group.isRequired || group.minSelect > 0,
					);
					if (needsOptions) {
						callbacks?.onNeedsOptions?.(product);
						return;
					}
					add(
						{
							productId: product.id,
							quantity: 1,
							// No options, by the branch above: the product has no *required*
							// group, and a line with no choices is the whole answer here.
							optionIds: [],
							// Never `replace`. `cart.ts`'s own rule — "replacing a basket the
							// customer spent five minutes on is not a decision to take" — and a
							// "+" that silently emptied the cart would be the worst version of
							// it. The API's `CONFLICT` lands in `onError` and the caller opens
							// the product, which is where the cross-shop question is asked.
							onBusinessConflict: "reject",
						},
						{
							name: product.title,
							unitPriceMinor: product.priceMinor,
							// No options, so the effective unit price *is* the price — the same
							// figure twice, which is what `cart.addItem` will answer with.
							effectiveUnitPriceMinor: product.priceMinor,
							imageUrl: product.imageUrl,
						},
					);
				} catch (error) {
					callbacks?.onError?.(error);
				} finally {
					setChecking(false);
				}
			})();
		},
		[add, cache, callbacks, trpc],
	);

	return { quickAdd, isPending: checking || isPending };
}
