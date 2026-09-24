import type { Category } from "@pymeshub/shared";

/**
 * Which categories one shop's products can sit in, and the vertical those categories name.
 *
 * The taxonomy is two levels — 18 sectors and their 224 children — and `catalog.categories`
 * returns all of both. A shop is filed on a **leaf**: `assertLeafCategory`
 * (`apps/api/src/services/businesses.ts`) refuses a sector, an inactive row and an id that
 * does not exist, because a shop filed on a sector would answer for every child under it.
 * So a shop's vertical is the leaf's own parent — a bakery is "Food & Beverage", a phone
 * shop is "Electronics & Technology" — and "if the business is food, then all food
 * categories appear" is this file.
 *
 * ## What a picker draws, and why no accordion
 *
 * The sector's children, flat. Not the 242-row tree, and not the accordion the tree needs:
 * one vertical holds about ten categories, and an accordion over a single open branch is a
 * control answering a question the list no longer asks. The sector itself is deliberately
 * **not** a row — a product filed under "Food & Beverage" is the vagueness this scoping
 * exists to remove — and no other vertical's children appear at all.
 *
 * Two exceptions keep a picker honest rather than pretty:
 *
 * - **The draft's own category is never dropped.** It may sit outside the shop's vertical —
 *   filed before the shop moved, or by a hand that picked a neighbour — and a picker that
 *   omitted it would silently clear the value on the next save. That one row is prepended
 *   when it is not already in the list.
 * - **A shop with no readable vertical gets the whole taxonomy**, accordion-shaped: every
 *   sector, with `openSectorId`'s children after their parent. A picker that drew nothing
 *   would be a control that cannot be used, and one that drew ten arbitrary rows would be a
 *   lie about which shop it was scoping for.
 *
 * `indentFor` is the one rule that makes both shapes read at the right level: a row is
 * indented exactly when its parent is also on the list. Scoped, the sector is absent so its
 * children sit flush and read as peers; unscoped, the sector is present and its children
 * step in under it. The screen never has to know which shape it was handed.
 */
export function categoryPickerRows(
	categories: Category[],
	options: {
		/** The shop's own `categoryId` — a leaf, straight off `business.settings`. */
		businessCategoryId: string | null;
		/** The category already on the draft, kept even when it is out of scope. */
		chosenId?: string | null;
		/** Branch to expand — used only when the shop has no vertical to scope to. */
		openSectorId?: string;
	},
): Category[] {
	const own = categories.find((one) => one.id === options.businessCategoryId);

	if (own === undefined) {
		return categories
			.filter((one) => one.parentId === null)
			.flatMap((sector) =>
				sector.id === options.openSectorId
					? [sector, ...categories.filter((one) => one.parentId === sector.id)]
					: [sector],
			);
	}

	const sectorId = own.parentId ?? own.id;
	const children = categories.filter((one) => one.parentId === sectorId);
	// A leaf with no siblings — the seed's flat roots — has nothing under its sector, and
	// the honest short list is the shop's own category and nothing more.
	const rows = children.length > 0 ? children : [own];

	const chosen =
		options.chosenId === null || options.chosenId === undefined
			? undefined
			: categories.find((one) => one.id === options.chosenId);
	if (chosen !== undefined && !rows.some((one) => one.id === chosen.id)) {
		return [chosen, ...rows];
	}
	return rows;
}

/** Whether a picker row steps in under a parent that is also on the list. */
export function indentFor(rows: Category[], row: Category): boolean {
	return rows.some((one) => one.id === row.parentId);
}

/**
 * The vertical a shop sells in — the sector above its own category — or `null` when the
 * shop has none to read. This is the name `biz.products.category.help` interpolates, so a
 * short list arrives with its reason attached rather than looking like a list with rows
 * missing.
 */
export function shopSector(
	categories: Category[],
	businessCategoryId: string | null,
): Category | null {
	const own = categories.find((one) => one.id === businessCategoryId);
	if (own === undefined) return null;
	const sectorId = own.parentId ?? own.id;
	return categories.find((one) => one.id === sectorId) ?? own;
}
