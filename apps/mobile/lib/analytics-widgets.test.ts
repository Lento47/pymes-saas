import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const analytics = readFileSync(
	join(import.meta.dir, "..", "app", "(business)", "analytics.tsx"),
	"utf8",
);
const home = readFileSync(
	join(import.meta.dir, "..", "app", "(business)", "index.tsx"),
	"utf8",
);
const en = readFileSync(
	join(
		import.meta.dir,
		"..",
		"..",
		"..",
		"packages",
		"i18n",
		"src",
		"messages",
		"en",
		"business.ts",
	),
	"utf8",
);

describe("merchant analytics widgets", () => {
	test("sold copy uses tp's {count}, not a leftover {quantity}", () => {
		expect(analytics).toContain('tp("biz.analytics.sold", product.quantity)');
		expect(en).toContain('"biz.analytics.sold": "{count} sold"');
		expect(en).not.toContain("{quantity} sold");
	});

	test("the page draws mix, peak, and share widgets from the existing payload", () => {
		expect(analytics).toContain("data.orders.completed");
		expect(analytics).toContain("data.orders.cancelled");
		expect(analytics).toContain("data.orders.active");
		expect(analytics).toContain("peakBucketOf");
		expect(analytics).toContain("styles.shareFill");
		expect(analytics).toContain('tp("biz.analytics.chartOrders"');
		expect(analytics).toContain("biz.analytics.repeatShare");
	});

	test("home insight prints units sold next to the top product name", () => {
		expect(home).toContain("biz.analytics.sold");
		expect(home).toContain("topProducts[0].quantity");
	});
});
