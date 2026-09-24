/**
 * Basket — the cart and the checkout: totals, steps, promo codes, placing the order.
 *
 * Every string here is read by somebody who has already decided to buy and is now being
 * asked for something. That is why they are kept apart from the browsing words: a change to
 * a total's label is a change to the part of the app where a mistake costs money.
 *
 * ## Why so few keys, and why these ones
 *
 * The cart, the checkout and the peak were rebuilt against the words that already exist.
 * `customer.ts` carries the whole `cart.*`, `checkout.*` and `order.*` vocabulary — the
 * totals' labels, the two fulfilment kinds, the two payment methods, the empty cart, the
 * minimum-order sentence, the promo code's four states — and a rebuilt screen that invented
 * a second name for "Total" would be a screen that shows two words for one number the first
 * time somebody translates one of them. So the rule was: reuse a key or do without the
 * string, and only add a key where there is genuinely no word yet.
 *
 * There was exactly one gap. `cart.promotion.*` names applying, being applied and being
 * refused, but the promo sheet's button has to say what it does when a code is *already* on
 * the cart — "Cambiar" — and `cart.promotion.apply` ("Aplicar") would be describing a
 * different situation. One key, beside the four it belongs with, is cheaper than a screen
 * that lies about what its button does.
 *
 * ## Why the refusal sentences are here and not in the API
 *
 * `cart.promotion.error.*` is the second group, and it is not a second vocabulary: it is the
 * same six facts that used to travel from `apps/api/src/services/cart.ts` as Spanish
 * sentences ("El código no existe", "Tu pedido no alcanza el mínimo del código"…) and reached
 * an English reader verbatim, because a Worker has no dictionary and no translator. The API
 * now answers with the **key** — `PROMOTION_ERROR_KEYS` in `@pymeshub/shared` is the closed
 * set, and neither locale may drift from it — and each client renders it through its own
 * translator. So these six strings are the only copy of those sentences in the repository,
 * and they say *which* of the six happened: `cart.promotion.invalid` ("Ese código no sirve")
 * collapses all of them into one, and a customer whose order is ₡500 short of a code's
 * minimum needs to be told that.
 *
 * `cart.promotion.remove` is here for the other half of the same coin: the API could always
 * clear the code (`cart.removePromotion`), and until these keys existed the promo sheet had
 * nothing to label that button with.
 *
 * Nothing here renames a figure: `cart.subtotal`, `cart.discount`, `cart.delivery`,
 * `cart.tax`, `cart.tip` and `cart.total` are the API's own row names and are used as they
 * are, in both places a receipt is drawn (`components/summary-card.tsx`).
 */
export const basket = {
	/** The promo sheet's button when a code is already on the cart. See the note above. */
	"cart.promotion.change": "Cambiar",
	/** The promo sheet's button that takes the code off the cart. */
	"cart.promotion.remove": "Quitar el código",
	/**
	 * The six refusals, in the API's own order of checks. `PROMOTION_ERROR_KEYS` is the
	 * closed set and `packages/shared` is where it is declared; a key added there and not
	 * here is a compile error at the call site that renders it.
	 */
	"cart.promotion.error.notFound": "El código no existe",
	"cart.promotion.error.inactive": "El código ya no está activo",
	"cart.promotion.error.notYetValid": "El código todavía no está vigente",
	"cart.promotion.error.expired": "El código venció",
	"cart.promotion.error.exhausted": "El código ya se agotó",
	"cart.promotion.error.belowMinimum":
		"Tu pedido no alcanza el mínimo del código",
} as const;
