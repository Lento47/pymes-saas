import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pulse = readFileSync(
	join(import.meta.dir, "..", "components", "merchant-pulse.tsx"),
	"utf8",
);
const row = readFileSync(
	join(import.meta.dir, "..", "components", "business-product-row.tsx"),
	"utf8",
);
const home = readFileSync(
	join(import.meta.dir, "..", "app", "(business)", "index.tsx"),
	"utf8",
);
const rail = readFileSync(
	join(import.meta.dir, "..", "components", "merchant-shortcut-rail.tsx"),
	"utf8",
);

describe("merchant home figures and names", () => {
	test("pulse money shrinks instead of clipping digits", () => {
		expect(pulse).toContain("adjustsFontSizeToFit");
		expect(pulse).toContain("minimumFontScale={0.6}");
		expect(pulse).toContain("column: { flexShrink: 1, minWidth: 0 }");
		expect(pulse).toContain('currencyDisplay: "narrowSymbol"');
	});

	test("menu product titles wrap fully and the row can grow", () => {
		expect(row).not.toContain("numberOfLines");
		expect(row).not.toContain("height: 78");
		expect(row).not.toContain("maxHeight: 170");
		expect(row).toContain("rowCopy: { flex: 1, minWidth: 0");
		expect(row).toContain('alignItems: "flex-start"');
	});

	test("insight values wrap inside equal columns", () => {
		expect(home).toContain("insightItem: { flex: 1, minWidth: 0");
		expect(home).toContain('<Text variant="body" bold numberOfLines={2}>');
	});

	test("analytics failure does not replace the board", () => {
		expect(home).toContain("shops.error ?? locations.error ?? home.error");
		expect(home).not.toContain("?? analytics.error");
		expect(home).toContain("analytics.error");
		expect(home).toContain("analytics.refetch()");
	});

	test("shortcut carousel includes the remaining More doors", () => {
		for (const key of [
			"orders",
			"catalog",
			"promotions",
			"analytics",
			"team",
			"payouts",
			"hours",
			"locations",
			"reviews",
		]) {
			expect(home).toContain(`key: "${key}"`);
		}
		expect(home).toContain("stats-chart-outline");
		expect(rail).toContain("colors.muted");
		expect(rail).toContain("colors.foreground");
		expect(rail).not.toContain("colors.accent");
	});
});
