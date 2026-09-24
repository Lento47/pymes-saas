/**
 * Storefront — one shop and one product: the cover, the options, the reviews.
 *
 * `business.ts` already covers the *owner's* board, and `customer.ts` covers the customer's
 * own account and orders. This is the third thing, the shop as a customer sees it, which is
 * why the strings about choosing a variant and reading a review live here.
 *
 * ## One key, and a lot of reading elsewhere
 *
 * The storefront and the product page were rebuilt against this dictionary, and the pair
 * came out with **one** new sentence: the cover hero, the option cards, the sticky action
 * bars and the review block all read keys that already existed (`store.reviews`,
 * `store.reviews.empty`, `biz.reviews.average`, `biz.reviews.breakdown`, `order.itemCount`,
 * `product.optionPrice`, `product.unavailable`, `nav.cart`). That is the rule working —
 * a new key is a decision, and most of these decisions had already been made.
 *
 * The one that had not is `storefront.option.required`. The product page now *blocks* the
 * add when a required group has nothing chosen in it, and a disabled button with no
 * sentence beside it is a dead end: the "Obligatorio" marker is on the group's heading,
 * which is above the fold once the reader is at the bar. The hint names the groups instead.
 */
export const storefront = {
	/*
	 * Read as the disabled add button's `accessibilityHint`, with the names of the required
	 * groups that are still empty joined by commas — "Falta elegir en Tamaño, Salsa". A
	 * group is named, not counted, because "falta elegir en 2 grupos" leaves the reader to
	 * go and find which two.
	 */
	"storefront.option.required": "Falta elegir en {groups}",
} as const;
