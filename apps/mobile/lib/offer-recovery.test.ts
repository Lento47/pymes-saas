import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const cart = readFileSync(
	join(root, "apps", "mobile", "app", "(customer)", "cart.tsx"),
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

describe("offer recovery in the cart", () => {
	test("sends a customer below the code minimum back to the same shop", () => {
		expect(cart).toContain(
			'promotionError === "cart.promotion.error.belowMinimum"',
		);
		expect(cart).toContain('"cart.promotion.addProducts"');
		expect(cart).toContain('"cart.moreFromShop"');
		expect(cart).toContain('pathname: "/store/[slug]"');
		expect(cart).toContain("params: { slug: basket.businessSlug }");
		expect(cart).toContain("suggestedOffer={suggestedOffer}");
	});

	test("labels the recovery action in both languages", () => {
		expect(en).toContain(
			'"cart.promotion.addProducts": "Add items to use this code"',
		);
		expect(es).toContain(
			'"cart.promotion.addProducts": "Agrega productos para usar este código"',
		);
	});
});
