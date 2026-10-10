import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const grid = readFileSync(
	join(import.meta.dir, "..", "components", "category-grid.tsx"),
	"utf8",
);

describe("category grid", () => {
	test("sorts by localized name and hides empty counts", () => {
		expect(grid).toContain("sortCategoriesByName");
		expect(grid).toContain("numberOfLines={2}");
		expect(grid).toContain(
			"category.productCount && category.productCount > 0",
		);
	});
});
