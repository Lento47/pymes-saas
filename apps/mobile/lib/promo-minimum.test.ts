import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BUSINESS_THEME_IDS } from "../theme/business-theme-ids";

const root = join(import.meta.dir, "..", "..", "..");
const hero = readFileSync(
	join(root, "apps", "mobile", "components", "promo-hero.tsx"),
	"utf8",
);
const promotion = readFileSync(
	join(root, "apps", "mobile", "lib", "promotion.ts"),
	"utf8",
);
const card = readFileSync(
	join(root, "apps", "mobile", "components", "card.tsx"),
	"utf8",
);
const tokens = readFileSync(
	join(root, "apps", "mobile", "theme", "tokens.ts"),
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

describe("promotion minimum on Home", () => {
	test("keeps lime as a high-contrast accent on a dark neutral offer card", () => {
		expect(hero).toContain('tone="spotlight"');
		expect(hero).toContain("backgroundColor: colors.primary");
		expect(hero).toContain('t("home.promotion.browse")');
		expect(hero).toContain('tone="inverse" bold tabular');
		expect(hero).toContain("colors.accentForeground : colors.background");
		expect(card).toContain("spotlight");
		expect(card).toContain("? colors.foreground");
		expect(card).toContain(": colors.accent");
		expect(paletteColor("dark", "accent")).not.toBe(
			paletteColor("dark", "card"),
		);

		for (const scheme of ["light", "dark"] as const) {
			const surface = paletteColor(
				scheme,
				scheme === "light" ? "foreground" : "accent",
			);
			const ink = paletteColor(
				scheme,
				scheme === "light" ? "background" : "accentForeground",
			);
			expect(contrastRatio(surface, ink)).toBeGreaterThan(7);
			expect(
				contrastRatio(
					paletteColor(scheme, "primary"),
					paletteColor(scheme, "primaryForeground"),
				),
			).toBeGreaterThan(7);
		}
	});

	test("keeps dark spotlight text legible across brand palettes", () => {
		for (const theme of BUSINESS_THEME_IDS) {
			expect(
				contrastRatio(
					paletteColor("dark", "accent", theme),
					paletteColor("dark", "accentForeground", theme),
				),
			).toBeGreaterThan(4.5);
		}
	});

	test("states the code's threshold only when positive, including to screen readers", () => {
		expect(promotion).toContain("promotion.minOrderMinor > 0");
		expect(promotion).toContain('t("home.promotion.minimum"');
		expect(promotion).toContain(
			"formatMoney(promotion.minOrderMinor, promotion.currency",
		);
		expect(hero).toContain("benefit, code, condition");
		expect(hero).toContain("{condition ? (");
	});

	test("uses distinct, localized copy for the coupon minimum", () => {
		expect(en).toContain('"home.promotion.browse": "Browse products"');
		expect(es).toContain('"home.promotion.browse": "Ver productos"');
		expect(en).toContain(
			'"home.promotion.minimum": "Spend at least {amount} on products"',
		);
		expect(es).toContain(
			'"home.promotion.minimum": "Compra al menos {amount} en productos"',
		);
	});
});

function paletteColor(
	scheme: "light" | "dark",
	key: string,
	theme: string = "lime",
): string {
	const brand = tokens.split(`\t${theme}: {`)[1];
	const palette = brand?.split(`\t\t${scheme}: {`)[1]?.split("\n\t\t},")[0];
	const color = palette?.match(
		new RegExp(`\\b${key}: "(#[0-9A-Fa-f]{6})"`),
	)?.[1];
	if (!color) throw new Error(`Missing ${theme} ${scheme} ${key} color`);
	return color;
}

function contrastRatio(first: string, second: string): number {
	const luminance = (hex: string) => {
		const channels = [1, 3, 5].map((offset) => {
			const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
			return value <= 0.04045
				? value / 12.92
				: ((value + 0.055) / 1.055) ** 2.4;
		});
		const [red = 0, green = 0, blue = 0] = channels;
		return red * 0.2126 + green * 0.7152 + blue * 0.0722;
	};
	const lighter = Math.max(luminance(first), luminance(second));
	const darker = Math.min(luminance(first), luminance(second));
	return (lighter + 0.05) / (darker + 0.05);
}
