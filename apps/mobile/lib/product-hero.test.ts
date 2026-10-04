import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const product = readFileSync(
	join(root, "app", "(customer)", "product", "[id].tsx"),
	"utf8",
);
const gallery = readFileSync(join(root, "components", "gallery.tsx"), "utf8");

describe("product imagery", () => {
	test("photographs keep their crop while missing imagery stays compact", () => {
		expect(product).toContain('hero: { width: "100%", aspectRatio: 4 / 3 }');
		expect(product).toContain('heroEmpty: { width: "100%", height: 144 }');
		expect(product).toContain(
			"style={hasPhoto ? styles.hero : styles.heroEmpty}",
		);
	});

	test("the fallback identifies the product without inventing a photo", () => {
		expect(product).toContain("fallbackName={data.title}");
		expect(gallery).toContain("fallbackName.trim().charAt(0).toUpperCase()");
		expect(gallery).toContain("accessibilityElementsHidden");
		expect(gallery).toContain('importantForAccessibility="no"');
	});
});

test("selected shop offers remain visible without displacing the product price", () => {
	expect(product).toContain("const selectedOffer = data?.availability.inStock");
	expect(product).toContain("offerForBusiness(offerSelection, data.seller.id)");
	expect(product).toContain("<PromoReminder offer={selectedOffer} compact />");
	expect(product.indexOf("<Price\n")).toBeLessThan(
		product.indexOf("<PromoReminder offer={selectedOffer} compact />"),
	);
});
