import { describe, expect, test } from "bun:test";
import {
	brandAccentCheck,
	DEFAULT_DASHBOARD_PREFERENCES,
	DEFAULT_STOREFRONT_APPEARANCE,
	resolveDashboardPreferences,
	resolveStorefrontAppearance,
} from "./customization";

describe("saved customization compatibility", () => {
	test("unknown dashboard widgets fall back to the required layout", () => {
		expect(
			resolveDashboardPreferences({
				...DEFAULT_DASHBOARD_PREFERENCES,
				widgets: ["shortcuts", "pulse", "retired", "catalog"],
			}),
		).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
	});

	test("unknown shop sections and versions fall back to the current layout", () => {
		expect(
			resolveStorefrontAppearance({
				...DEFAULT_STOREFRONT_APPEARANCE,
				sections: ["information", "retired", "featured"],
			}),
		).toEqual(DEFAULT_STOREFRONT_APPEARANCE);
		expect(
			resolveStorefrontAppearance({
				...DEFAULT_STOREFRONT_APPEARANCE,
				version: 2,
			}),
		).toEqual(DEFAULT_STOREFRONT_APPEARANCE);
	});

	test("unreadable accents include a usable suggested shade", () => {
		for (const color of ["#FFFFFF", "#111111", "#00FF00"]) {
			const result = brandAccentCheck(color);
			expect(result.valid).toBe(false);
			expect(result.suggested).not.toBeNull();
			expect(brandAccentCheck(result.suggested ?? "").valid).toBe(true);
		}
	});
});
