/**
 * A list, chunked into rows of two.
 *
 * The app has two 2-up grids — `app/featured`'s shelf of products and `app/categories`' grid of
 * categories — and both are built the same way, because a `FlatList`'s own `numColumns={2}`
 * stretches the *lone* trailing tile of an odd page across the full width. That is the defect
 * this exists to prevent, and it is one rule rather than two: the pair is a row of two `flex: 1`
 * cells with an empty sibling standing in for the missing second one, so a tile that is alone on
 * its row keeps the half-width it would have had.
 *
 * A screen *could* get a wrapped container instead, and that is what `/featured`'s docblock
 * rejects: `flexWrap` needs a percentage width, and two of them plus the gap have to still fit
 * the column — a sum that holds at one device width and silently becomes one tile per line at a
 * narrower one. Chunking has no arithmetic in it, and it needs none at any text scale.
 *
 * ## Why the row is a non-empty tuple
 *
 * It is load-bearing rather than decorative: a row's React key is its first element's id, and
 * under `noUncheckedIndexedAccess` a `T[][]` makes `pair[0]` possibly `undefined`, so that key
 * would need an assertion. Reading the two slots out by hand rather than slicing is what proves
 * the first one is there — `index` is below `items.length` by the loop guard — so the type
 * carries the proof once and neither call site needs a `!`.
 *
 * A plain loop rather than a reduce or a slice per index: the row count is `Math.ceil(n / 2)`
 * and the last row may hold one, which is the case both grids' empty sibling exists for.
 *
 * `readonly T[]` in, because both callers pass an array they built in a memo and neither should
 * have to hand over a mutable copy to have it chunked.
 */
export function chunkPairs<T>(items: readonly T[]): [T, ...T[]][] {
	const rows: [T, ...T[]][] = [];

	for (let index = 0; index < items.length; index += 2) {
		const first = items[index];
		// Unreachable — the guard above is the proof — but it is what narrows the slot.
		if (first === undefined) break;
		const second = items[index + 1];

		rows.push(second === undefined ? [first] : [first, second]);
	}

	return rows;
}
