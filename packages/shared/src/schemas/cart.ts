/**
 * The cart, and the rule that shapes all of it: **one cart belongs to one business.**
 *
 * Two businesses in one cart is not a merge problem, it is a fulfilment problem —
 * two delivery fees, two prep times, two payouts, and a customer who cannot say
 * which half of their order is late. So adding an item from a different business is
 * never a merge; it either starts a fresh cart or asks the customer to clear the
 * old one, and the API says which by returning `replacedCart: true`.
 *
 * There is no `userId` field anywhere in this file: a cart is the caller's, and the
 * cart id in an input says *which* cart, never *whose*. A `cartId` from another
 * session resolves to nothing rather than to somebody else's basket.
 */

import { z } from "zod";
import { productCardSchema } from "./catalog";
import { currencySchema } from "./common";
import { promotionCodeSchema } from "./promotions";

export const CART_STATUSES = ["OPEN", "CHECKED_OUT", "ABANDONED"] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export const MAX_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 40;

export const addToCartInput = z.object({
	productId: z.string().startsWith("prd_"),
	quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY).default(1),
	/** Option ids, not option names: a rename must not silently repoint an order. */
	optionIds: z.array(z.string()).max(20).default([]),
	notes: z.string().trim().max(300).optional(),
	/**
	 * What to do when the cart already holds another business's items. The default is
	 * to refuse, because replacing a basket the customer spent five minutes on is not
	 * a decision to make on their behalf.
	 */
	onBusinessConflict: z.enum(["reject", "replace"]).default("reject"),
});
export type AddToCartInput = z.infer<typeof addToCartInput>;

export const updateCartItemInput = z.object({
	cartItemId: z.string().startsWith("cit_"),
	quantity: z.number().int().min(0).max(MAX_LINE_QUANTITY),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemInput>;

/**
 * The code a customer types. One shape, defined in `./promotions` beside the rule
 * that writes the code, so a shop cannot open a code this would refuse to read.
 */
export const applyPromotionInput = z.object({
	code: promotionCodeSchema,
});
export type ApplyPromotionInput = z.infer<typeof applyPromotionInput>;

/**
 * Why a code is not being applied — as **message keys**, never as sentences.
 *
 * A refused code is a field on a live cart, so the API answers with the cart and the reason
 * beside it; and the reason is one of these six. It is a key rather than the Spanish sentence
 * it used to be because the API has no dictionary: it is read by a browser, a phone in
 * Spanish and a phone in English, and a sentence written in the service reached the English
 * reader verbatim. The words live in `@pymeshub/i18n` (`basket.ts`), the *decision* lives
 * here, and every client resolves the key through its own translator.
 *
 * A closed set rather than `z.string()`, because both ends need it closed. The API cannot
 * return a seventh reason nobody wrote words for, and a client holding an unrecognised value
 * — an older cache, a newer server — gets a parse failure rather than a raw key on a screen.
 *
 * The `.error.` segment is not decoration: `cart.promotion.expired` and `cart.promotion.invalid`
 * already exist in the dictionary as *labels*, and a key that meant one thing as a label and
 * another as a reason would be two strings under one name.
 */
export const PROMOTION_ERROR_KEYS = [
	"cart.promotion.error.notFound",
	"cart.promotion.error.inactive",
	"cart.promotion.error.notYetValid",
	"cart.promotion.error.expired",
	"cart.promotion.error.exhausted",
	"cart.promotion.error.belowMinimum",
] as const;
export type PromotionErrorKey = (typeof PROMOTION_ERROR_KEYS)[number];

/**
 * Whether a value that arrived over the wire is one of the keys above.
 *
 * For the one place a key travels as a *message* rather than as a field: `orders.place`
 * throws a `DomainError` whose text is the key, because the checkout refusal is a failed
 * request and not a cart field. A client holding a sentence from a `DomainError` — or the
 * name of a failure that never was one — needs to tell the two apart without printing a key
 * at a customer, and this is that question asked once.
 */
export function isPromotionErrorKey(
	value: unknown,
): value is PromotionErrorKey {
	return (
		typeof value === "string" &&
		(PROMOTION_ERROR_KEYS as readonly string[]).includes(value)
	);
}

/**
 * Why `orders.place` refused - as **message keys**, never as sentences.
 *
 * The same decision `PROMOTION_ERROR_KEYS` records, for the same reason, and it exists because
 * a refusal the customer earned was being reported as a fault of ours. Placing an order against
 * a shop whose hours have ended is a `ValidationError`: nothing broke, the answer is "not right
 * now", and `apps/mobile`'s `DEFAULT_KEYS` sent `BAD_REQUEST` to `state.error.rejected` - honest,
 * but it cannot say *which* thing to check.
 *
 * **The status code structurally cannot carry the reason.** `code` and `domainCode` are both the
 * generic `BAD_REQUEST` for every refusal on this list and for a malformed request alike, so a
 * client reading the code cannot tell a closed shop from a broken payload - only the message can.
 * `apps/mobile/components/reorder-outcome.tsx` already says this of its own case; this is the
 * same argument for checkout.
 *
 * A closed set, for `PROMOTION_ERROR_KEYS`' reason: the API cannot return an eighth reason nobody
 * wrote words for, and a client holding an unrecognised value gets a parse failure rather than a
 * raw key printed at a customer.
 *
 * `checkout.businessClosed` is the one that already existed in both dictionaries and was
 * referenced by nothing. It is listed here rather than renamed because its words were always
 * right; only the wiring was missing.
 */
export const CHECKOUT_REFUSAL_KEYS = [
	// The one refusal that covers "not now": past hours, a pause, or a branch offline. All three
	// are `operationalStatus(...) !== "open"` and all three are the same sentence to a customer —
	// come back later. Splitting them would mean three keys with identical copy, and a key whose
	// copy never differs is a distinction nobody can act on.
	"checkout.businessClosed",
	// A shop suspended outright, which is a different fact from being closed for the evening: it
	// may never reopen, and it is not about the hour.
	"checkout.refusal.shopInactive",
	// No branch this shop can take the order at, and no `locationId` that names one.
	"checkout.refusal.locationNotFound",
	"checkout.refusal.addressNotFound",
	"checkout.refusal.deliveryQuoteUnavailable",
	"checkout.refusal.emptyCart",
	"checkout.refusal.minOrder",
	"checkout.refusal.totalChanged",
	"checkout.refusal.paymentUnavailable",
] as const;
export type CheckoutRefusalKey = (typeof CHECKOUT_REFUSAL_KEYS)[number];

/**
 * Whether a value that arrived over the wire is one of the keys above.
 *
 * The checkout twin of `isPromotionErrorKey`, asked once for the same reason: a client holding
 * either a sentence from an older `DomainError` or the name of a refusal that never was one needs
 * to tell them apart without printing a key at a customer.
 */
export function isCheckoutRefusalKey(
	value: unknown,
): value is CheckoutRefusalKey {
	return (
		typeof value === "string" &&
		(CHECKOUT_REFUSAL_KEYS as readonly string[]).includes(value)
	);
}

export const cartItemSchema = z.object({
	id: z.string(),
	productId: z.string(),
	name: z.string(),
	imageUrl: z.string().nullable(),
	quantity: z.number().int().min(0),
	unitPriceMinor: z.number().int(),
	/** Price plus every chosen option's delta, so the line total is one multiplication. */
	effectiveUnitPriceMinor: z.number().int(),
	lineTotalMinor: z.number().int(),
	options: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			priceDeltaMinor: z.number().int(),
		}),
	),
	notes: z.string().nullable(),
	/** Set when the product went out of stock while it sat in the cart. */
	unavailableReason: z.string().nullable(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

/**
 * Totals are returned, not computed by the client, and they are the same numbers
 * checkout will store. A client that adds up its own subtotal is a client that can
 * show a total the order does not have.
 */
export const cartTotalsSchema = z.object({
	subtotalMinor: z.number().int(),
	discountMinor: z.number().int(),
	deliveryFeeMinor: z.number().int(),
	/** The customer fee may be zero while the shop still owes the courier. */
	merchantCoversDelivery: z.boolean().optional(),
	taxMinor: z.number().int(),
	tipMinor: z.number().int(),
	totalMinor: z.number().int(),
	currency: currencySchema,
	/** What the customer still needs to add to reach the business's minimum. */
	missingForMinOrderMinor: z.number().int().min(0),
	roadQuote: z
		.object({
			quoteId: z.string(),
			expiresAt: z.date(),
			distanceMeters: z.number().nonnegative(),
			durationSeconds: z.number().nonnegative(),
			baseFeeMinor: z.number().int().nonnegative(),
			geometry: z.object({
				type: z.literal("LineString"),
				coordinates: z.array(z.tuple([z.number(), z.number()])),
			}),
		})
		.optional(),
});
export type CartTotals = z.infer<typeof cartTotalsSchema>;

/** The exact stops selected at checkout; older clients may omit either while choosing. */
export const cartQuoteInput = z
	.object({
		fulfilment: z.enum(["PICKUP", "DELIVERY"]),
		locationId: z.string().optional(),
		addressId: z.string().optional(),
	})
	.refine((input) => input.fulfilment !== "PICKUP" || !input.addressId, {
		path: ["addressId"],
		message: "A pickup quote does not have a delivery address",
	});
export type CartQuoteInput = z.infer<typeof cartQuoteInput>;

export const cartSchema = z.object({
	id: z.string(),
	businessId: z.string().nullable(),
	businessName: z.string().nullable(),
	businessSlug: z.string().nullable(),
	currency: currencySchema,
	status: z.enum(CART_STATUSES),
	items: z.array(cartItemSchema),
	totals: cartTotalsSchema,
	promotionCode: z.string().nullable(),
	/**
	 * Why the code on the cart is not being applied, as a key for the client's translator —
	 * or `null` when there is nothing to say. See {@link PROMOTION_ERROR_KEYS}.
	 *
	 * Not a sentence, and not a thrown error: the read succeeded and the cart is the
	 * customer's, so a code that is not currently valid is a field on a live cart rather than
	 * a failed request. `promotionCode` is the code the cart is *holding*, which is not
	 * necessarily the code this is about — a refused code that was never stored leaves the
	 * working one in place.
	 */
	promotionError: z.enum(PROMOTION_ERROR_KEYS).nullable(),
	/** True when the last add replaced a cart from another business. */
	replacedCart: z.boolean(),
	updatedAt: z.date(),
});
export type Cart = z.infer<typeof cartSchema>;

/**
 * The empty cart. A client renders this before the customer has added anything, and
 * returning `null` instead would push a null check into every screen that shows a
 * cart badge.
 */
export const EMPTY_CART_TOTALS: CartTotals = {
	subtotalMinor: 0,
	discountMinor: 0,
	deliveryFeeMinor: 0,
	taxMinor: 0,
	tipMinor: 0,
	totalMinor: 0,
	currency: "CRC",
	missingForMinOrderMinor: 0,
};

/** Suggestions on the cart screen — "add something else from the same business". */
export const cartSuggestionsSchema = z.object({
	products: z.array(productCardSchema),
});
export type CartSuggestions = z.infer<typeof cartSuggestionsSchema>;
