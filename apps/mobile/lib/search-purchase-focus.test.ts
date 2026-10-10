import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const search = readFileSync(
	join(root, "app", "(customer)", "search.tsx"),
	"utf8",
);
const skeletons = readFileSync(
	join(root, "components", "skeletons.tsx"),
	"utf8",
);
const resultsSkeleton = skeletons
	.split("export function SearchResultsSkeleton()")[1]
	?.split("/**")[0];

describe("search purchase focus", () => {
	test("opens ready to type and leads with matching products", () => {
		expect(search).toContain("<SearchInput\n\t\t\t\tautoFocus");
		expect(search.indexOf('value: "products"')).toBeLessThan(
			search.indexOf('value: "businesses"'),
		);
		expect(
			search.indexOf('{mode !== "businesses" && products.length > 0'),
		).toBeLessThan(
			search.indexOf('{mode !== "products" && businesses.length > 0'),
		);
	});

	test("does not offer an unrelated list as more matches", () => {
		expect(search).not.toContain("shopsAction");
	});

	test("idle search fills with the sector grid, not a one-row rail", () => {
		expect(search).toContain("<CategoryGrid items={rail}");
		expect(search).toContain("<CategoryRail categories={categories}");
		expect(search).not.toContain("<CategoryRail categories={rail}");
		expect(search).not.toContain('router.push("/categories")');
	});

	test("the loading state begins with product rows too", () => {
		expect(resultsSkeleton).toContain("<RowBlock key={index} />");
		expect(resultsSkeleton).not.toContain("<CardBlock key={index} />");
	});
});
