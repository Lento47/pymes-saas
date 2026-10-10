import { describe, expect, test } from "bun:test";

import { sortCategoriesByName } from "./category-order";

describe("sortCategoriesByName", () => {
	test("orders by the localized name a reader sees", () => {
		const rows = [
			{ name: "Snacks & Convenience", nameEn: "Snacks & Convenience" },
			{ name: "Panadería", nameEn: "Bakery" },
			{ name: "Bebidas", nameEn: "Beverages" },
		];
		expect(sortCategoriesByName(rows, "en").map((row) => row.nameEn)).toEqual([
			"Bakery",
			"Beverages",
			"Snacks & Convenience",
		]);
		expect(sortCategoriesByName(rows, "es").map((row) => row.name)).toEqual([
			"Bebidas",
			"Panadería",
			"Snacks & Convenience",
		]);
	});
});
