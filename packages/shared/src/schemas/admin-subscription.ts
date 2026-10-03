import { z } from "zod";

import { adminListInput, REASON_MIN_LENGTH } from "./admin";
import { planSchema, subscriptionStatusSchema } from "./common";

/**
 * The platform's view of a subscription, which is not the merchant's.
 *
 * Split from `subscriptionSchema` rather than extending it with optional fields,
 * because the difference is not "sometimes present" — it is a different audience
 * reading a different question. A merchant asks "when am I next charged"; an operator
 * asks "who owes us money, for how long, and under which price book". Overlaying the
 * second onto the first would make every operator field nullable at the type level,
 * which is how an operator screen ends up rendering `undefined` as a column.
 *
 * `arrearsMinor` is the number that matters on the admin table and it is derived, not
 * stored: it is what is owed from `periodEnd` to now, at the price captured when the
 * period began. A shop that joined in March and stops paying in September owes the
 * **March** price, not today's — which is what `priceMinor` being a copy rather than a
 * join is for.
 */
export const adminSubscriptionSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	ownerEmail: z.string().nullable(),
	plan: planSchema,
	status: subscriptionStatusSchema,
	priceMinor: z.number().int().nullable(),
	currency: z.string(),
	/** Colones owed and unpaid. Zero for a current subscription. */
	arrearsMinor: z.number().int(),
	/** Whole periods unpaid. Two means a shop has been gone over a month. */
	periodsOwed: z.number().int(),
	periodStart: z.date().nullable(),
	periodEnd: z.date().nullable(),
	gracedUntil: z.date().nullable(),
	lastPaidAt: z.date().nullable(),
	/** Which price book priced it, so a rise can be traced to a specific row. */
	priceBookLabel: z.string().nullable(),
	/** True once the shop is unlisted — the state an operator has to act on. */
	suspended: z.boolean(),
});
export type AdminSubscription = z.infer<typeof adminSubscriptionSchema>;

/**
 * Recording that money arrived.
 *
 * `amountMinor` is the figure the operator was given, and it is **not** compared to
 * `priceMinor` here. A merchant paying ₡11,000 against a ₡10,000 invoice has
 * overpaid and that is a conversation, not a validation error to refuse; the operator
 * decides. What *is* refused is a zero or negative amount, and a reference that is not
 * a bank reference — the second because without it the payment cannot be reconciled
 * afterwards, and the first because it would mark a debt paid without one.
 */
export const recordPaymentInput = z.object({
	subscriptionId: z.string(),
	/** Colones actually received, IVA-inclusive. */
	amountMinor: z.number().int().positive(),
	/** The bank's or SINPE's reference. Required — this is the reconciliation key. */
	reference: z.string().trim().min(4).max(80),
	/** Mandatory when the amount does not match the invoice, per the audit policy. */
	reason: z.string().trim().min(REASON_MIN_LENGTH).max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentInput>;

/** Moving a shop onto a plan, or changing what it pays. */
export const changePlanInput = z.object({
	plan: planSchema,
});

/**
 * The operator's subscription table.
 *
 * **Cursor-paged like every other admin table**, not page-numbered: `adminListInput`
 * already encodes an offset into a `cursor`, and two pagination schemes in one console
 * is how a table ends up showing page 3 of an empty second page. `status` is a single
 * subscription status rather than the array `adminListInput` carries for business
 * statuses, because the filter is applied after shaping — see `admin.subscriptions`.
 */
export const adminSubscriptionsInput = adminListInput
	.omit({ status: true, sort: true })
	.extend({
		status: subscriptionStatusSchema.optional(),
		sort: z.enum(["arrears", "periodEnd", "businessName"]).default("arrears"),
	});

/**
 * Setting a new price.
 *
 * **This is the "raise the price as the app grows" lever, and the reason it is a row
 * and not a setting.** Inserting a `price_book` raises what new merchants pay from
 * `effectiveFrom` and moves nobody already subscribed — their `priceMinor` was
 * captured when their period began. A merchant is never charged a price they were not
 * shown.
 *
 * `effectiveFrom` is required and is not allowed to be silently now: a book dated in
 * the past retroactively repriced everyone who joined between that date and today,
 * which is the one outcome this design exists to prevent.
 */
export const createPriceBookInput = z.object({
	label: z.string().trim().min(2).max(60),
	weeklyMinor: z.number().int().min(100).max(10_000_000),
	monthlyMinor: z.number().int().min(100).max(100_000_000),
	effectiveFrom: z.date(),

	/**
	 * Required, and it was not here at all until now.
	 *
	 * `subscription.create_price_book` has been in `REASON_REQUIRED_ACTIONS` from the
	 * start — the policy says a price rise carries a reason "the same way removing a
	 * storefront does" — and this input had no field to send one in. The service never
	 * asked either, so staging a rise wrote a `price_book` row and **no `audit_log` row at
	 * all**: the one operator action that repriced every future merchant was the one
	 * nobody could name a performer for afterwards.
	 *
	 * So the field is added, `createPriceBook` writes the audit row in the same batch as
	 * the insert, and the reason is mandatory because a price rise is the single most
	 * consequential thing on this console — see `services/audit.ts`.
	 */
	reason: z.string().trim().min(REASON_MIN_LENGTH).max(500),
});
export type CreatePriceBookInput = z.infer<typeof createPriceBookInput>;
