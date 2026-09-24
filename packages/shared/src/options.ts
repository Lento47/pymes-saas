/**
 * How a set of chosen options is identified, and what it adds to a price.
 *
 * This module exists because **two writers mint the same fingerprint**: the API when
 * a customer adds a line to their cart, and the seed when it fabricates demo carts.
 * `cart_item` carries a unique index on `(cartId, productId, optionsHash)` so a
 * customer who taps "grande, sin cebolla" twice gets one line at quantity two rather
 * than two identical lines — which means two implementations that disagree do not
 * produce a cosmetic difference, they produce a duplicate cart line that survives all
 * the way to a doubled order.
 *
 * A subpath (`@pymeshub/shared/options`) rather than the barrel, and it imports
 * nothing: the seed is a script that wants this one function, and reaching it through
 * the barrel would evaluate every zod schema in the package to get it.
 */

/**
 * A stable fingerprint of a choice set.
 *
 * The canonical form is the option ids **sorted and joined**, so two clients that
 * pick the same options in a different order agree, and FNV-1a over that string,
 * because the fingerprint is stored in an indexed column and a 400-character join
 * is a worse index key than eight hex digits.
 *
 * Not a cryptographic hash and not trying to be: this is an identity for a set of
 * ids that are already unique, and the only property required is that two different
 * sets do not collide. A collision would merge two different configurations of one
 * product into one cart line, which is why the hash is over the *sorted* form
 * rather than over the order the customer happened to tap things in.
 */
export function optionsHash(chosen: readonly { optionId: string }[]): string {
	const canonical = chosen
		.map((option) => option.optionId)
		.sort()
		.join("|");
	let hash = 0x811c9dc5;
	for (let index = 0; index < canonical.length; index += 1) {
		hash ^= canonical.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * What the chosen options add to a product's price.
 *
 * Added to the unit price and never stored as a price of its own: the option's
 * `priceDeltaMinor` is catalog data that can change, and an order's price is a
 * snapshot. The snapshot is taken when the order is placed, from this sum plus the
 * product's price at that moment.
 */
export function optionDelta(
	chosen: readonly { priceDeltaMinor: number }[],
): number {
	return chosen.reduce((total, option) => total + option.priceDeltaMinor, 0);
}
