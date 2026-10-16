import { describe, expect, test } from "bun:test";
import {
	brandAccentCheck,
	DEFAULT_DASHBOARD_PREFERENCES,
	DEFAULT_STOREFRONT_APPEARANCE,
	DETAILED_DASHBOARD_PREFERENCES,
	dashboardPreferencesSchema,
	REQUIRED_DASHBOARD_WIDGETS,
	resolveDashboardPreferences,
	resolveStorefrontAppearance,
	SIMPLE_DASHBOARD_PREFERENCES,
	SIMPLE_STOREFRONT_APPEARANCE,
	storefrontAppearanceSchema,
} from "./customization";

describe("saved customization compatibility", () => {
	test("new dashboards start simple while saved detailed dashboards stay configurable", () => {
		const fresh = resolveDashboardPreferences(undefined);
		expect(fresh.hidden).toEqual(["insights", "catalog"]);
		expect(fresh.metrics).toEqual(["orders"]);
		expect(fresh.shortcutIds).toEqual([
			"orders",
			"catalog",
			"hours",
			"promotions",
		]);
		expect(resolveDashboardPreferences(DETAILED_DASHBOARD_PREFERENCES)).toEqual(
			DETAILED_DASHBOARD_PREFERENCES,
		);
	});
	test("operational slots stay fixed when any optional widget order is saved", () => {
		const permutations = <T>(items: T[]): T[][] =>
			items.length === 0
				? [[]]
				: items.flatMap((item, i) =>
						permutations(items.filter((_, j) => i !== j)).map((rest) => [
							item,
							...rest,
						]),
					);
		const optional = DEFAULT_DASHBOARD_PREFERENCES.widgets.filter(
			(id) => !REQUIRED_DASHBOARD_WIDGETS.includes(id),
		);
		for (const order of permutations(optional)) {
			const configuration = dashboardPreferencesSchema.parse({
				...DEFAULT_DASHBOARD_PREFERENCES,
				widgets: [...REQUIRED_DASHBOARD_WIDGETS].reverse().concat(order),
			});
			for (const id of REQUIRED_DASHBOARD_WIDGETS) {
				expect(configuration.widgets.indexOf(id)).toBe(
					DEFAULT_DASHBOARD_PREFERENCES.widgets.indexOf(id),
				);
			}
			expect(
				configuration.widgets.filter(
					(id) => !REQUIRED_DASHBOARD_WIDGETS.includes(id),
				),
			).toEqual(order);
			expect(resolveDashboardPreferences(configuration)).toEqual(configuration);
		}
	});
	test("simple presets validate and keep the operational dashboard visible", () => {
		expect(
			dashboardPreferencesSchema.safeParse(SIMPLE_DASHBOARD_PREFERENCES)
				.success,
		).toBe(true);
		expect(
			storefrontAppearanceSchema.safeParse(SIMPLE_STOREFRONT_APPEARANCE)
				.success,
		).toBe(true);
		expect(SIMPLE_DASHBOARD_PREFERENCES.hidden).not.toContain("queue");
		expect(SIMPLE_DASHBOARD_PREFERENCES.hidden).not.toContain("attention");
		expect(SIMPLE_DASHBOARD_PREFERENCES.hidden).not.toContain("commands");
	});

	test("older hidden operational blocks reappear without losing other preferences", () => {
		const resolved = resolveDashboardPreferences({
			...DEFAULT_DASHBOARD_PREFERENCES,
			hidden: ["queue", "attention", "commands", "catalog"],
			themeId: "coral",
		});
		expect(resolved.hidden).toEqual(["catalog"]);
		expect(resolved.themeId).toBe("coral");
	});

	test("unknown dashboard widgets are dropped and the required layout is completed", () => {
		expect(
			resolveDashboardPreferences({
				...DEFAULT_DASHBOARD_PREFERENCES,
				widgets: ["shortcuts", "pulse", "retired", "catalog"],
				metrics: ["orders"],
				productPreviewCount: 9,
			}),
		).toEqual({
			...DEFAULT_DASHBOARD_PREFERENCES,
			widgets: [
				"shortcuts",
				"pulse",
				"insights",
				"attention",
				"queue",
				"commands",
				"catalog",
			],
			metrics: ["orders"],
			productPreviewCount: 9,
		});
	});

	test("a saved board without layouts still has shortcuts after resolve", () => {
		const resolved = resolveDashboardPreferences({
			version: 1,
			widgets: ["shortcuts", "pulse", "insights", "catalog"],
			hidden: [],
			metrics: ["net_sales", "orders", "average_order"],
			productPreviewCount: 3,
			themeId: null,
		});
		expect(resolved.layouts.shortcuts).toBe("rail");
		expect(resolved.shortcutIds[0]).toBe("orders");
	});

	test("a four-widget board from an older app keeps order and gains the new blocks", () => {
		expect(
			resolveDashboardPreferences({
				version: 1,
				widgets: ["catalog", "pulse", "shortcuts", "insights"],
				hidden: ["insights"],
				metrics: ["net_sales", "active_orders"],
				productPreviewCount: 6,
				themeId: "coral",
			}),
		).toEqual({
			...DEFAULT_DASHBOARD_PREFERENCES,
			widgets: [
				"catalog",
				"pulse",
				"shortcuts",
				"attention",
				"queue",
				"commands",
				"insights",
			],
			hidden: ["insights"],
			metrics: ["net_sales", "active_orders"],
			productPreviewCount: 6,
			themeId: "coral",
			layouts: DETAILED_DASHBOARD_PREFERENCES.layouts,
		});
	});

	test("extra layout designs survive and an unknown one falls back", () => {
		const resolved = resolveDashboardPreferences({
			...DEFAULT_DASHBOARD_PREFERENCES,
			layouts: {
				shortcuts: "list",
				insights: "band",
				attention: "cards",
				queue: "cards",
				commands: "stack",
				catalog: "rail",
				pulse: "nope",
			},
		});
		expect(resolved.layouts.shortcuts).toBe("list");
		expect(resolved.layouts.insights).toBe("band");
		expect(resolved.layouts.attention).toBe("cards");
		expect(resolved.layouts.queue).toBe("cards");
		expect(resolved.layouts.commands).toBe("stack");
		expect(resolved.layouts.catalog).toBe("rail");
		expect(resolved.layouts.pulse).toBe("band");
	});

	test("partial layouts and shortcut lists fill in the missing keys", () => {
		const resolved = resolveDashboardPreferences({
			...DEFAULT_DASHBOARD_PREFERENCES,
			layouts: { pulse: "cards", catalog: "tiles" },
			shortcutIds: ["orders", "reviews"],
		});
		expect(resolved.layouts).toEqual({
			...DETAILED_DASHBOARD_PREFERENCES.layouts,
			pulse: "cards",
			catalog: "tiles",
		});
		expect(resolved.shortcutIds).toEqual(["orders", "reviews"]);
	});

	test("pulse hero and stack layouts survive resolve", () => {
		expect(
			resolveDashboardPreferences({
				...DEFAULT_DASHBOARD_PREFERENCES,
				layouts: { pulse: "hero" },
			}).layouts.pulse,
		).toBe("hero");
		expect(
			resolveDashboardPreferences({
				...DEFAULT_DASHBOARD_PREFERENCES,
				layouts: { pulse: "stack" },
			}).layouts.pulse,
		).toBe("stack");
	});

	test("an invalid layout value keeps the default for that widget", () => {
		expect(
			resolveDashboardPreferences({
				...DEFAULT_DASHBOARD_PREFERENCES,
				layouts: { pulse: "neon", shortcuts: "grid" },
			}).layouts,
		).toEqual({
			...DETAILED_DASHBOARD_PREFERENCES.layouts,
			shortcuts: "grid",
		});
	});

	test("a saved board without widgetThemes or commandColors still resolves", () => {
		const resolved = resolveDashboardPreferences({
			version: 1,
			widgets: ["shortcuts", "pulse", "insights", "catalog"],
			hidden: [],
			metrics: ["net_sales", "orders", "average_order"],
			productPreviewCount: 3,
			themeId: "coral",
		});
		expect(resolved.widgetThemes).toEqual(
			DEFAULT_DASHBOARD_PREFERENCES.widgetThemes,
		);
		expect(resolved.commandColors).toEqual(
			DEFAULT_DASHBOARD_PREFERENCES.commandColors,
		);
		expect(resolved.themeId).toBe("coral");
	});

	test("painting one widget keeps the others inheriting the panel", () => {
		const resolved = resolveDashboardPreferences({
			...DEFAULT_DASHBOARD_PREFERENCES,
			widgetThemes: { pulse: "coral" },
			commandColors: { "add-product": "amber" },
		});
		expect(resolved.widgetThemes.pulse).toBe("coral");
		expect(resolved.widgetThemes.shortcuts).toBeNull();
		expect(resolved.widgetThemes.catalog).toBeNull();
		expect(resolved.commandColors["add-product"]).toBe("amber");
		expect(resolved.commandColors.promo).toBeNull();
	});

	test("an unknown palette id on a widget is dropped", () => {
		expect(
			resolveDashboardPreferences({
				...DEFAULT_DASHBOARD_PREFERENCES,
				widgetThemes: { pulse: "neon", shortcuts: "sky" },
				commandColors: { promo: "hotpink" },
			}).widgetThemes,
		).toEqual({
			...DEFAULT_DASHBOARD_PREFERENCES.widgetThemes,
			shortcuts: "sky",
		});
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
		for (const color of ["#FFFFFF", "#111111", "#00FF00", "#949494"]) {
			const result = brandAccentCheck(color);
			expect(result.valid).toBe(false);
			expect(result.suggested).not.toBeNull();
			expect(brandAccentCheck(result.suggested ?? "").valid).toBe(true);
		}
	});
});
