import type { MessageKey, TranslateParams } from "@pymeshub/i18n";
import type { Cadence, Plan, PlanLimits, PlanOption } from "@pymeshub/shared";
import { PLAN_ORDER } from "@pymeshub/shared";

import type { ThemeColors } from "@/theme";

/**
 * The colored header panel on each plan card.
 *
 * OpenAI's business pricing page puts a distinct fill on the top of each card. These
 * pairs are existing `ThemeColors` keys so a palette change (lime included) recolours
 * the headers without a second map of hex.
 */
export const PLAN_CARD_HEADER: Record<
	Plan,
	{ bg: keyof ThemeColors; fg: keyof ThemeColors }
> = {
	FREE: { bg: "muted", fg: "mutedForeground" },
	EMPRENDE: { bg: "statusCompleted", fg: "statusCompletedForeground" },
	STARTER: { bg: "statusAccepted", fg: "statusAcceptedForeground" },
	GROWTH: { bg: "statusPreparing", fg: "statusPreparingForeground" },
	BUSINESS: { bg: "primary", fg: "primaryForeground" },
};

const PLAN_TAGLINE: Record<Plan, MessageKey> = {
	FREE: "biz.subscription.plan.FREE.tagline",
	EMPRENDE: "biz.subscription.plan.EMPRENDE.tagline",
	STARTER: "biz.subscription.plan.STARTER.tagline",
	GROWTH: "biz.subscription.plan.GROWTH.tagline",
	BUSINESS: "biz.subscription.plan.BUSINESS.tagline",
};

export function planTaglineKey(plan: Plan): MessageKey {
	return PLAN_TAGLINE[plan];
}

/**
 * The option the card should sell for this tier at the chosen cadence.
 *
 * `FREE` has no cadence; a paid tier matches the toggle. Missing means the book has
 * no row for that pair and the card is omitted.
 */
export function optionForPlan(
	options: readonly PlanOption[],
	plan: Plan,
	cadence: Cadence,
): PlanOption | undefined {
	return options.find(
		(option) =>
			option.plan === plan && (option.isFree || option.cadence === cadence),
	);
}

/** Tiers the book actually sells, cheapest first. */
export function plansOnOffer(options: readonly PlanOption[]): Plan[] {
	const seen = new Set(options.map((option) => option.plan));
	return PLAN_ORDER.filter((plan) => seen.has(plan));
}

type Translate = (key: MessageKey, params?: TranslateParams) => string;

/**
 * Storage in the units a merchant reasons in — gigabytes once there is at least one,
 * megabytes below. `600 MB` and `10 GB`, never `614400 KB`.
 */
export function storageValue(t: Translate, bytes: number): string {
	const gigabytes = bytes / (1024 * 1024 * 1024);
	if (gigabytes >= 1) {
		return t("biz.subscription.limit.gigabytes", {
			value: Math.round(gigabytes * 10) / 10,
		});
	}
	return t("biz.subscription.limit.megabytes", {
		value: Math.round(bytes / (1024 * 1024)),
	});
}

/**
 * A history window as the coarsest unit that divides it exactly — `2 años` for 730 days
 * and `30 días` for 30, so a merchant reads a duration rather than doing the arithmetic.
 */
export function historyValue(t: Translate, days: number): string {
	if (days % 365 === 0) {
		return t("biz.subscription.limit.years", { count: days / 365 });
	}
	return t("biz.subscription.limit.days", { count: days });
}

export type PlanFeatureRow = { key: string; label: string; value: string };

export function planFeatureRows(
	t: Translate,
	limits: PlanLimits,
): PlanFeatureRow[] {
	return [
		{
			key: "products",
			label: t("biz.subscription.limit.products"),
			value: String(limits.products),
		},
		{
			key: "staffAccounts",
			label: t("biz.subscription.limit.staffAccounts"),
			value: String(limits.staffAccounts),
		},
		{
			key: "locations",
			label: t("biz.subscription.limit.locations"),
			value: String(limits.locations),
		},
		{
			key: "promotions",
			label: t("biz.subscription.limit.promotions"),
			value:
				limits.activePromotions === 0
					? t("biz.subscription.limit.notIncluded")
					: String(limits.activePromotions),
		},
		{
			key: "images",
			label: t("biz.subscription.limit.images"),
			value: String(limits.imagesPerProduct),
		},
		{
			key: "storage",
			label: t("biz.subscription.limit.storage"),
			value: storageValue(t, limits.storageBytes),
		},
		{
			key: "history",
			label: t("biz.subscription.limit.history"),
			value: historyValue(t, limits.analyticsDays),
		},
		{
			key: "inventory",
			label: t("biz.subscription.limit.inventory"),
			value: limits.inventoryTracking
				? t("biz.subscription.limit.included")
				: t("biz.subscription.limit.notIncluded"),
		},
		{
			key: "express",
			label: t("biz.subscription.limit.express"),
			value:
				limits.expressPerWeek === Infinity
					? t("biz.subscription.limit.unlimited")
					: String(limits.expressPerWeek),
		},
	];
}
