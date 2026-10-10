import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const home = readFileSync(
	join(import.meta.dir, "..", "app", "(customer)", "index.tsx"),
	"utf8",
);
const productRow = readFileSync(
	join(import.meta.dir, "..", "components", "product-row.tsx"),
	"utf8",
);

describe("home product discovery", () => {
	test("uses the fold for commerce instead of a redundant map band", () => {
		expect(home).not.toContain("<MapView");
		expect(home).not.toContain("heroMap");
		expect(home).toContain("<HomeHeader");
		expect(home).toContain("<HeroSearch");
	});

	test("gives Home products a rail of tappable tiles", () => {
		expect(home).toContain("backgroundColor: colors.card");
		expect(home).toContain(
			"<ProductRail products={data.featured.slice(0, FEATURED_PREVIEW)} />",
		);
		expect(home).toContain(
			"<ProductRail products={discover.slice(0, DISCOVER_PREVIEW)} />",
		);
		expect(home).not.toContain("productRowSurface");
		expect(home).not.toContain("showDisclosure");
		expect(productRow).toContain('name="chevron-forward"');
		expect(productRow).toContain("accessibilityElementsHidden");
		expect(productRow).toContain("formatMoney(product.priceMinor");
		expect(productRow).toContain('t("product.compareAt"');
		expect(productRow).toContain("accessibilityLabel={spoken}");
	});

	test("puts purchasable products ahead of shop cards when featured offers are unavailable", () => {
		expect(home).toContain("data.discover ?? fallbackDiscover");
		expect(home).toContain("discover.length > 0");
		expect(home).toContain("product.availability.inStock");
		expect(home).toContain('t("home.discover")');
		expect(home.indexOf("{showDiscover || discoveryLoading ? (")).toBeLessThan(
			home.indexOf("{data.nearby.length > 0 ? ("),
		);
		expect(home.indexOf("{data.featured.length > 0 ? (")).toBeLessThan(
			home.indexOf("{data.nearby.length > 0 ? ("),
		);
		expect(home.indexOf("{data.offers.length > 0 ? (")).toBeLessThan(
			home.indexOf("{data.nearby.length > 0 ? ("),
		);
		expect(home).toContain("data.nearby.length === 0 && !hasCommerce");
	});

	test("keeps older feed responses usable while the API rolls forward", () => {
		expect(home).toContain("feed.data?.discover === undefined");
		expect(home).toContain("enabled: needsLegacyDiscover");
		expect(home).toContain("data.discover ?? fallbackDiscover");
		expect(home).toContain("<ProductRowsSkeleton />");
		expect(home).toContain(
			".filter((product) => product.availability.inStock)",
		);
	});

	test("does not pressure an empty cart with a minimum-order gap", () => {
		expect(home).toMatch(
			/const shortfall =\s*units > 0 \? \(cart\.data\?\.totals\.missingForMinOrderMinor \?\? 0\) : 0;/,
		);
		expect(home).toContain(
			"{shortfall > 0 && cartBusinessName && cartBusinessSlug ? (",
		);
	});

	test("turns a started cart's shortfall into a same-shop shopping path", () => {
		expect(home).toContain(
			"shortfall > 0 && cartBusinessName && cartBusinessSlug",
		);
		expect(home).toContain("businessName={cartBusinessName}");
		expect(home).toContain("params: { slug: cartBusinessSlug }");
	});

	test("keeps the cart bar honest and never sends a short cart to checkout", () => {
		expect(home).toContain("const itemsTotal = ");
		expect(home).toContain('t("cart.itemsTotal")');
		expect(home).toContain(
			'needsMoreItems ? "cart.bar.addItems" : "cart.bar.checkout"',
		);
		expect(home).toContain(
			'if (!needsMoreItems) return router.push("/checkout")',
		);
		expect(home).toContain(
			'if (!cartBusinessSlug) return router.push("/cart")',
		);
		expect(home).toContain("params: { slug: cartBusinessSlug }");
		expect(home).toContain("accessibilityHint: shortfallHint");
	});
});
