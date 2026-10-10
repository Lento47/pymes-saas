import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const screen = readFileSync(
	join(root, "apps", "mobile", "app", "(customer)", "category", "[slug].tsx"),
	"utf8",
);
const products = readFileSync(
	join(
		root,
		"apps",
		"mobile",
		"app",
		"(customer)",
		"category-products",
		"[slug].tsx",
	),
	"utf8",
);
const en = readFileSync(
	join(root, "packages", "i18n", "src", "messages", "en", "customer.ts"),
	"utf8",
);
const es = readFileSync(
	join(root, "packages", "i18n", "src", "messages", "es", "customer.ts"),
	"utf8",
);

describe("category discovery", () => {
	test("shows what can be bought before offering a route to other sectors", () => {
		expect(screen).not.toContain("<CategoryRail");
		expect(screen).toContain("showDisclosure");
		expect(screen).toContain("backgroundColor: colors.card");
		expect(screen.indexOf("{productPreview.length > 0 ? (")).toBeLessThan(
			screen.indexOf("{children.length > 0 ? ("),
		);
		expect(screen.indexOf("{children.length > 0 ? (")).toBeLessThan(
			screen.indexOf('label={t("category.browseAll")}'),
		);
		expect(screen).toContain('router.push("/categories")');
		expect(en).toContain('"category.browseAll": "Explore other categories"');
		expect(es).toContain('"category.browseAll": "Explorar otras categorías"');
		expect(en).toContain('"category.showAll": "Show more subcategories"');
		expect(es).toContain('"category.showAll": "Ver más subcategorías"');
	});

	test("children scan A-Z and keep a way to the rest", () => {
		expect(screen).toContain("sortCategoriesByName");
		expect(screen).not.toContain("stockedChildren");
		expect(screen).toContain("expanded ? children : children.slice(0, 4)");
		expect(screen).toContain(
			"children.length > shownChildren.length || expanded",
		);
		expect(screen).toContain('"category.showAll"');
		expect(screen).toContain('"category.showLess"');
	});

	test("empty parent lists do not compete with their child browse path", () => {
		expect(screen).toContain("items.length > 0 || active > 0");
		expect(screen).toContain("!categoryProducts.isPending");
		expect(screen.replace(/\s+/g, " ")).toContain(
			"(active > 0 || (children.length === 0 && productPreview.length === 0))",
		);
	});

	test("product counts have a direct path to available products", () => {
		expect(screen).toMatch(
			/categoryId: category\?\.id,\s+sort: "popular",\s+inStockOnly: true,\s+limit: 3/,
		);
		expect(screen).toContain("product.availability.inStock");
		expect(screen).toContain('title={t("search.products")}');
		expect(screen).toContain('pathname: "/product/[id]"');
	});

	test("a longer category shelf leads to a paginated available-products list", () => {
		expect(screen).toContain("categoryProducts.data?.nextCursor");
		expect(screen).toContain('pathname: "/category-products/[slug]"');
		expect(products).toContain("trpc.products.list.infiniteQueryOptions(");
		expect(products).toContain("categoryId: category?.id");
		expect(products).toContain("inStockOnly: true");
		expect(products).toContain("enabled: !!category");
		expect(products).toContain("last.nextCursor ?? undefined");
		expect(products).toContain('t("category.products.empty.title")');
	});
});
