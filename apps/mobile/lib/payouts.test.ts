import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_LIMITS, type PlanOption } from "@pymeshub/shared";

import {
	optionForPlan,
	PLAN_CARD_HEADER,
	planFeatureRows,
	plansOnOffer,
} from "./payouts";

const screen = readFileSync(
	join(import.meta.dir, "..", "app", "(business)", "payouts.tsx"),
	"utf8",
);

const t = (key: string, params?: { count?: number; value?: number }) => {
	if (params?.count !== undefined) return `${params.count}`;
	if (params?.value !== undefined) return `${params.value}`;
	return key;
};

describe("merchant subscription payment", () => {
	test("a paid plan opens a SINPE dialog instead of mutating on the row", () => {
		expect(screen).toContain('variant="dialog"');
		expect(screen).toContain("biz.subscription.pay.reference");
		expect(screen).toContain("biz.subscription.pay.sinpe");
		expect(screen).toContain("reference: trimmed");
		expect(screen).toContain("ConfirmSheet");
		expect(screen).toContain("plan: picked.plan");
		expect(screen).not.toContain("plan: option.plan");
	});
});

describe("plan cards", () => {
	test("each tier has its own header pair from the palette", () => {
		expect(PLAN_CARD_HEADER.FREE.bg).toBe("muted");
		expect(PLAN_CARD_HEADER.EMPRENDE.bg).toBe("statusCompleted");
		expect(PLAN_CARD_HEADER.STARTER.bg).toBe("statusAccepted");
		expect(PLAN_CARD_HEADER.GROWTH.bg).toBe("statusPreparing");
		expect(PLAN_CARD_HEADER.BUSINESS.bg).toBe("primary");
	});

	test("FREE promotions are a refusal and BUSINESS express is unlimited", () => {
		const free = planFeatureRows(t, PLAN_LIMITS.FREE);
		const business = planFeatureRows(t, PLAN_LIMITS.BUSINESS);
		expect(free.find((row) => row.key === "promotions")?.value).toBe(
			"biz.subscription.limit.notIncluded",
		);
		expect(business.find((row) => row.key === "express")?.value).toBe(
			"biz.subscription.limit.unlimited",
		);
	});

	test("the cadence toggle picks the paid pair and leaves FREE unmatched by month", () => {
		const options = [
			{
				plan: "FREE",
				cadence: null,
				isFree: true,
				isCurrent: true,
			},
			{
				plan: "EMPRENDE",
				cadence: "MONTHLY",
				isFree: false,
				isCurrent: false,
			},
			{
				plan: "EMPRENDE",
				cadence: "YEARLY",
				isFree: false,
				isCurrent: false,
			},
		] as PlanOption[];
		expect(optionForPlan(options, "FREE", "MONTHLY")?.plan).toBe("FREE");
		expect(optionForPlan(options, "EMPRENDE", "YEARLY")?.cadence).toBe(
			"YEARLY",
		);
		expect(plansOnOffer(options)).toEqual(["FREE", "EMPRENDE"]);
	});
});
