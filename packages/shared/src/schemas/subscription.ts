import { z } from "zod";

import {
	cadenceSchema,
	currencySchema,
	planSchema,
	subscriptionStatusSchema,
} from "./common";

/**
 * What a merchant is told about their own billing.
 *
 * **The platform charges a flat fee and no share of any sale.** The consumer pays the
 * merchant for products and the courier for delivery, so there is no gross, no
 * commission and no settlement to reconcile — which is why this shape has no `gross`
 * and no `platformFee`, and why the `payout` schema that did have them is gone.
 *
 * Every money figure here is **IVA-inclusive**, because that is what the merchant is
 * invoiced. `netMinor` and `ivaMinor` are what the platform keeps and what it remits,
 * and they are carried on the wire because a merchant asking "what am I actually
 * paying" deserves both numbers rather than one plus a division they have to trust.
 */
export const subscriptionSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	plan: planSchema,
	/**
	 * How this subscription is invoiced, or `null` for `FREE`.
	 *
	 * **Separate from `plan` on purpose.** Limits follow the tier alone, so an annual
	 * merchant holds the same numbers as a monthly one on the same tier — this field says
	 * when the money moves and nothing else. It is nullable rather than defaulted because
	 * a free subscription is never charged, and a cadence on it would be a period that
	 * never begins (see `PLAN_PERIOD_DAYS`).
	 */
	cadence: cadenceSchema.nullable(),
	status: subscriptionStatusSchema,
	/** Colones, IVA-inclusive, captured when the current period began. */
	priceMinor: z.number().int().nullable(),
	/** `priceMinor` less the IVA — what the platform keeps. */
	netMinor: z.number().int().nullable(),
	/** The IVA on `priceMinor`, remitted to the state. */
	ivaMinor: z.number().int().nullable(),
	currency: currencySchema,
	periodStart: z.date().nullable(),
	periodEnd: z.date().nullable(),
	/** Present only while overdue: the last day full access continues. */
	gracedUntil: z.date().nullable(),
	/** Days until the next charge, for the dashboard's countdown. */
	daysUntilDue: z.number().int().nullable(),
	lastPaidAt: z.date().nullable(),
	/**
	 * Whether the shop is still in the customer-facing feed. Distinct from `status`:
	 * `PAST_DUE` has lost its tools but keeps its customers, and a client that
	 * conflated the two would hide a shop that is still trading.
	 */
	listed: z.boolean(),
	/** The label of the price book this was priced under, for an invoice. */
	priceBookLabel: z.string().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** The admin's view: the same row plus who it belongs to. */
// The operator's richer view — arrears, periods owed, the price book — lives in
// `admin-subscription.ts`. It is a separate file rather than an extension of this one
// because the two answer different questions, and a merge would make every operator
// field optional in the type a merchant's dashboard reads.

/**
 * The plans as a picker renders them — one entry per **(tier, cadence)** pair.
 *
 * **`plan` alone is not addressable any more.** With two axes there are eight paid pairs
 * and a free one, and a picker keyed only by tier cannot say which invoice it is quoting.
 * That is why `cadence` is on the option rather than on the page: the pair is the unit a
 * merchant actually chooses, and it is what a change request has to name.
 */
export const planOptionSchema = z.object({
	plan: planSchema,
	/** `null` on the free entry, which has no invoice. */
	cadence: cadenceSchema.nullable(),
	/**
	 * True only for the `FREE` entry, so a client renders a subscribe button instead of a
	 * price with a checkout — and so it cannot mistake a zero price for a pricing bug.
	 */
	isFree: z.boolean(),
	priceMinor: z.number().int(),
	netMinor: z.number().int(),
	ivaMinor: z.number().int(),
	/** `null` on the free entry: a plan that is never charged has no period. */
	periodDays: z.number().int().nullable(),
	limits: z.object({
		locations: z.number(),
		staffAccounts: z.number(),
		products: z.number(),
		optionGroupsPerProduct: z.number(),
		optionsPerGroup: z.number(),
		imagesPerProduct: z.number(),
		storageBytes: z.number(),
		activePromotions: z.number(),
		analyticsDays: z.number(),
		inventoryTracking: z.boolean(),
	}),
	/** False when this exact (tier, cadence) is the merchant's current one. */
	isCurrent: z.boolean(),
	/** Set when no plan reaches whatever they need; the reason to talk to us. */
	isCeiling: z.boolean(),
});
export type PlanOption = z.infer<typeof planOptionSchema>;

export const planOptionsInput = z.object({
	businessId: z.string(),
});
