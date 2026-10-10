import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	MAX_UPLOAD_BYTES,
	PROMOTION_DESCRIPTION_MAX_WORDS,
	promotionDescriptionWordCount,
} from "@pymeshub/shared";

const root = join(import.meta.dir, "..");
const form = readFileSync(
	join(root, "app", "(business)", "promotion-form.tsx"),
	"utf8",
);
const picker = readFileSync(join(root, "components", "photo-picker.tsx"), "utf8");
const product = readFileSync(
	join(root, "app", "(business)", "product-form.tsx"),
	"utf8",
);
const shop = readFileSync(
	join(root, "app", "(business)", "shop-settings.tsx"),
	"utf8",
);

describe("merchant asset uploads", () => {
	test("the marketplace ceiling is 5 MiB of JPEG, PNG or WebP", () => {
		expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
		expect(picker).toContain("aspect = [1, 1]");
		expect(picker).toContain("aspect,");
	});

	test("the promotion form uploads a 16:9 banner and a 40-word blurb", () => {
		expect(form).toContain("PhotoPicker");
		expect(form).toContain("aspect={[16, 9]}");
		expect(form).toContain("PROMOTION_DESCRIPTION_MAX_WORDS");
		expect(form).toContain("imageUrl: draft.photo");
		expect(form).toContain("description:");
		expect(PROMOTION_DESCRIPTION_MAX_WORDS).toBe(40);
		expect(promotionDescriptionWordCount("one two three")).toBe(3);
		expect(
			promotionDescriptionWordCount(
				Array.from({ length: 40 }, () => "word").join(" "),
			),
		).toBe(40);
	});

	test("product photos crop square and shop covers crop 16:9", () => {
		expect(product).toContain("aspect={[1, 1]}");
		expect(shop).toContain("aspect={[1, 1]}");
		expect(shop).toContain("aspect={[16, 9]}");
	});
});
