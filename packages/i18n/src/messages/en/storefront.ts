/**
 * Storefront — one shop and one product: the cover, the options, the reviews.
 *
 * `business.ts` already covers the *owner's* board, and `customer.ts` covers the customer's
 * own account and orders. This is the third thing, the shop as a customer sees it, which is
 * why the strings about choosing a variant and reading a review live here.
 *
 * Mirrors `es/storefront.ts` key for key — one key, and `keys.test.ts` is what keeps the
 * two files from drifting the next time one of them grows.
 */
export const storefront = {
	"storefront.option.required": "Choose an option in {groups}",
} as const;
