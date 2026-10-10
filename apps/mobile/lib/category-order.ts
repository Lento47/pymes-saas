import { type Locale, localizedName } from "@pymeshub/i18n";

/**
 * A–Z by the name the reader sees.
 *
 * Catalog `sortOrder` numbers a sector 100 and its children 101, 102… so a client can
 * rebuild the tree from a flat list. That is not an order a person scans: Food & Beverage
 * lands Groceries, then Delicatessen, then Food Service. Both the sector index and a
 * sector's own children sort here so English and Spanish each read as a list.
 */
export function sortCategoriesByName<
	T extends { name: string; nameEn?: string | null },
>(items: readonly T[], locale: Locale): T[] {
	return [...items].sort((left, right) =>
		localizedName(left, locale).localeCompare(
			localizedName(right, locale),
			locale,
			{
				sensitivity: "base",
			},
		),
	);
}
