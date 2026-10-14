/**
 * Swap a list item with the next *visible* neighbour in `direction`.
 *
 * Hidden slots are skipped, so a drag on the board changes the order the
 * reader sees instead of swapping with a tucked-away neighbour. An out-of-range
 * move, or a move that finds no visible neighbour, leaves the list unchanged.
 */
export function moveItem<T>(
	items: readonly T[],
	index: number,
	direction: -1 | 1,
	hidden: readonly T[] = [],
): T[] {
	const next = [...items];
	const current = next[index];
	if (current === undefined) return next;
	let target = index + direction;
	while (target >= 0 && target < next.length) {
		const neighbor = next[target];
		if (neighbor !== undefined && !hidden.includes(neighbor)) {
			next[index] = neighbor;
			next[target] = current;
			return next;
		}
		target += direction;
	}
	return next;
}
