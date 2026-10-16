import { describe, expect, test } from "bun:test";
import {
	DEFAULT_DASHBOARD_PREFERENCES,
	SIMPLE_DASHBOARD_PREFERENCES,
} from "@pymeshub/shared";
import {
	isMerchantOrderNotification,
	isSimpleMerchantHome,
	merchantHomeWidgets,
	showMerchantHomeCommand,
} from "./merchant-home-layout";
import { labelledCapsuleExtraHeight } from "./tab-capsule-metrics";

describe("merchant home presentation", () => {
	test("order events refresh the current shop without reacting to another shop's notifications", () => {
		expect(
			isMerchantOrderNotification({ orderId: "ord_new" }, "biz_mine"),
		).toBe(true);
		expect(
			isMerchantOrderNotification(
				{ orderId: "ord_new", businessId: "biz_other" },
				"biz_mine",
			),
		).toBe(false);
		expect(
			isMerchantOrderNotification({ deliveryId: "del_new" }, "biz_mine"),
		).toBe(false);
	});
	test("large text adds matching navigation and scroll clearance", () => {
		expect(labelledCapsuleExtraHeight(1)).toBe(0);
		expect(labelledCapsuleExtraHeight(2)).toBe(28);
		expect(labelledCapsuleExtraHeight(0.8)).toBe(0);
	});
	test("Simple puts urgent work before metrics without changing saved preferences", () => {
		const saved = structuredClone(SIMPLE_DASHBOARD_PREFERENCES);
		const before = structuredClone(saved);
		expect(merchantHomeWidgets(saved)).toEqual([
			"attention",
			"queue",
			"pulse",
			"shortcuts",
			"commands",
		]);
		expect(saved).toEqual(before);
	});
	test("personal widget arrangements and full dashboards keep their order", () => {
		const custom = structuredClone(SIMPLE_DASHBOARD_PREFERENCES);
		[custom.widgets[0], custom.widgets[1]] = ["pulse", "shortcuts"];
		expect(merchantHomeWidgets(custom)).toEqual(
			custom.widgets.filter((id) => !custom.hidden.includes(id)),
		);
		expect(merchantHomeWidgets(DEFAULT_DASHBOARD_PREFERENCES)).toEqual(
			DEFAULT_DASHBOARD_PREFERENCES.widgets,
		);
	});
	test("minimal dashboards keep their theme and density choices", () => {
		const saved = structuredClone(SIMPLE_DASHBOARD_PREFERENCES);
		saved.themeId = "ocean";
		saved.layouts.commands = "stack";
		saved.widgetThemes.pulse = "amber";
		expect(isSimpleMerchantHome(saved)).toBe(true);
		expect(saved.themeId).toBe("ocean");
		expect(saved.widgetThemes.pulse).toBe("amber");
	});
	test("commands keep one route to each task and restore it when shortcuts are hidden", () => {
		expect(
			showMerchantHomeCommand(
				"add-product",
				SIMPLE_DASHBOARD_PREFERENCES,
				true,
			),
		).toBe(true);
		expect(
			showMerchantHomeCommand("promo", SIMPLE_DASHBOARD_PREFERENCES, true),
		).toBe(false);
		for (const key of ["stock", "hours", "pause"])
			expect(
				showMerchantHomeCommand(key, SIMPLE_DASHBOARD_PREFERENCES, true),
			).toBe(false);
		const withoutShortcuts = {
			...SIMPLE_DASHBOARD_PREFERENCES,
			hidden: [...SIMPLE_DASHBOARD_PREFERENCES.hidden, "shortcuts" as const],
		};
		expect(showMerchantHomeCommand("stock", withoutShortcuts, true)).toBe(true);
		expect(showMerchantHomeCommand("hours", withoutShortcuts, true)).toBe(true);
		expect(showMerchantHomeCommand("pause", withoutShortcuts, false)).toBe(
			true,
		);
	});
});
