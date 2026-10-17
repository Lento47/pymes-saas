import { describe, expect, test } from "bun:test";
import {
	activeMobileContent,
	DEFAULT_MOBILE_CONFIGURATION as defaults,
	MOBILE_CONTROLS,
	MOBILE_HOME_CATEGORY_CONTROLS,
	mobileCategoryVisible,
	mobileConfigurationSchema,
	mobileControlEnabled,
	mobileDraftInput,
} from "./mobile-controls";

describe("shared mobile control policy", () => {
	test("home rollout choices survive draft validation and can be released one at a time", () => {
		const visibility = Object.fromEntries(MOBILE_HOME_CATEGORY_CONTROLS.map((item) => [item.id, false]));
		const phase = { ...defaults, visibility: { ...visibility, "customer.homeCategory.comida": true } };
		const saved = mobileDraftInput.parse({ expectedVersion: 0, configuration: phase }).configuration;
		const visible = (configuration: typeof defaults) => MOBILE_HOME_CATEGORY_CONTROLS
			.filter((item) => mobileControlEnabled(configuration, item.id)).map((item) => item.label.es);
		expect(visible(saved)).toEqual(["Comida"]);
		expect(visible({ ...phase, visibility: { ...phase.visibility, "customer.homeCategory.supermercado": true } })).toEqual(["Comida", "Supermercado"]);
		expect(visible({ ...phase, visibility: { ...phase.visibility, categories: false } })).toEqual([]);
		expect(saved.hiddenCategoryIds).toEqual(defaults.hiddenCategoryIds);
	});
	test("registered controls are unique, default on, and cannot name mandatory completion routes", () => {
		expect(new Set(MOBILE_CONTROLS.map((item) => item.id)).size).toBe(
			MOBILE_CONTROLS.length,
		);
		for (const control of MOBILE_CONTROLS) {
			expect(mobileControlEnabled(defaults, control.id)).toBe(true);
			if (control.parent)
				expect(MOBILE_CONTROLS.some((one) => one.id === control.parent)).toBe(
					true,
				);
			for (const path of control.routes)
				expect([
					"orders",
					"order/[id]",
					"merchant-order/[id]",
					"delivery/[id]",
					"order-payments",
					"help",
					"support",
					"sign-in",
					"sign-out",
					"courier-profile",
				]).not.toContain(path);
		}
	});
	test("global category hiding preserves individual choices and hierarchy for restoration", () => {
		const categories = [
			{ id: "food", parentId: null },
			{ id: "pizza", parentId: "food" },
			{ id: "shops", parentId: null },
		] as const;
		const selection = { ...defaults, hiddenCategoryIds: ["food"] };
		expect(mobileCategoryVisible(selection, categories[1], categories)).toBe(
			false,
		);
		expect(mobileCategoryVisible(selection, categories[2], categories)).toBe(
			true,
		);
		const hidden = { ...selection, visibility: { categories: false } };
		expect(
			categories.every(
				(one) => !mobileCategoryVisible(hidden, one, categories),
			),
		).toBe(true);
		expect(hidden.hiddenCategoryIds).toEqual(["food"]);
		expect(categories).toHaveLength(3);
	});
	test("parent controls override individual visibility; unknown future controls remain compatible", () => {
		const next = mobileConfigurationSchema.parse({
			...defaults,
			visibility: {
				promotions: false,
				"merchant.promotions": true,
				"future.control": false,
			},
		});
		expect(mobileControlEnabled(next, "merchant.promotions")).toBe(false);
		expect(mobileControlEnabled(next, "future.control")).toBe(true);
		expect(
			mobileDraftInput.safeParse({ expectedVersion: 0, configuration: next })
				.success,
		).toBe(false);
	});
	test("content uses bounded bilingual text, uploaded images, supported destinations and valid schedules", () => {
		const content = {
			id: "notice",
			kind: "announcement",
			roles: ["customer"],
			title: { es: "Aviso", en: "Notice" },
			body: { es: "Ayuda disponible", en: "Help available" },
			button: { es: "Ver ayuda", en: "Get help" },
			imagePath: null,
			destination: { kind: "help" },
			startsAt: "2026-01-01T00:00:00Z",
			endsAt: "2026-02-01T00:00:00Z",
		};
		const config = mobileConfigurationSchema.parse({
			...defaults,
			content: [content],
		});
		expect(
			activeMobileContent(
				config,
				"customer",
				Date.parse("2026-01-15T00:00:00Z"),
			),
		).toHaveLength(1);
		expect(
			activeMobileContent(
				config,
				"courier",
				Date.parse("2026-01-15T00:00:00Z"),
			),
		).toHaveLength(0);
		expect(
			activeMobileContent(
				config,
				"customer",
				Date.parse("2026-02-01T00:00:00Z"),
			),
		).toHaveLength(0);
		for (const invalid of [
			{ imagePath: "https://arbitrary.test/photo.jpg" },
			{ kind: "campaign" },
			{ endsAt: "2025-01-01T00:00:00Z" },
			{ destination: { kind: "javascript:alert(1)" } },
		]) {
			expect(
				mobileConfigurationSchema.safeParse({
					...defaults,
					content: [{ ...content, ...invalid }],
				}).success,
			).toBe(false);
		}
	});
});
