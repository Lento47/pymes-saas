import { cadenceSchema } from "@pymeshub/shared";
import { PLANS } from "@pymeshub/shared/plans";
import { z } from "zod";

import { loadBilling } from "../context";
import * as businesses from "../services/businesses";
import * as subscriptions from "../services/subscription";
import { businessProcedure, protectedProcedure, router } from "../trpc";

/**
 * A merchant's own billing. OWNER, via `payouts:read` — the one capability a MANAGER
 * does not hold, and the permission did not change when the shape did.
 *
 * The capability is still called `payouts:read` because it answers the same question it
 * always answered: may this person see what the business owes the platform. Renaming it
 * would orphan every `ROLE_CAPABILITIES` entry and every client's menu for no gain.
 *
 * `payouts.list` returned a **list** of settlement runs and this returns **one
 * subscription**, because the business changed rather than the API: the consumer pays
 * the merchant for products and the courier for delivery, so there is no money in the
 * platform to settle. A merchant's whole financial relationship with PymesHub is the
 * flat fee on this screen.
 *
 * The three read procedures are deliberately separate rather than one endpoint with a
 * query parameter. A dashboard mounting this needs all three, and one round trip would
 * mean one failure loses all of it — a merchant unable to see their plan must still be
 * able to see the price.
 */
export const subscriptionRouter = router({
	/**
	 * What they are on and what they owe. `null` for a business created but never
	 * billed, which is a real answer rather than a failure.
	 */
	current: businessProcedure("payouts:read")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) =>
			businesses.currentSubscription(ctx, {
				businessId: ctx.membership.businessId,
			}),
		),

	/**
	 * The two plans, priced from the book in force right now.
	 *
	 * Read through `protectedProcedure` and a `businessId` rather than
	 * `businessProcedure`, because a merchant deciding between plans must be able to do
	 * it before they have one — and the answer is a public price list, not tenant data.
	 * The `businessId` is still required so a client has a place to send the choice.
	 */
	options: protectedProcedure
		.input(z.object({ businessId: z.string() }))
		.query(async ({ ctx, input }) => {
			const membership = ctx.memberships.find(
				(entry) => entry.businessId === input.businessId,
			);
			// A stranger gets an empty list rather than a 403: the price list is public
			// information, and refusing to show it to somebody who has not signed up yet is
			// a worse answer than showing it to everybody.
			if (!membership)
				return {
					options: [],
					sinpePhone: subscriptions.platformSinpePhone(ctx.env),
				};

			// Resolved through `loadBilling` rather than assembled by hand, so the picker
			// cannot disagree with the rest of the product about which plan a merchant is
			// actually on — a shop past due is on the floor plan, and offering it an
			// upgrade from the plan it no longer has is nonsense.
			const billing = await loadBilling(ctx.db, input.businessId, new Date());
			const options = await subscriptions.planOptions({
				...ctx,
				membership,
				businessPlan: billing.plan,
				subscriptionStatus: billing.status,
				subscriptionCadence: billing.cadence,
			});
			return {
				options,
				sinpePhone: subscriptions.platformSinpePhone(ctx.env),
			};
		}),

	/**
	 * Moving between tiers, or between cadences on one tier.
	 *
	 * A paid pair starts a **new period now**: the limits apply immediately, `priceMinor`
	 * is captured from the book in force, and `lastPaidAt` is this instant. The merchant
	 * proves the transfer with a SINPE reference (4–80 characters), the same key an
	 * operator already uses to reconcile. There is no gateway; the honour system is the
	 * product, and the audit row is what finance reads later.
	 *
	 * `FREE` is the one move that involves no money: `cadence` is `null` and there is no
	 * `reference`.
	 *
	 * **Both axes are in the input, and `cadence` is required — nullable, not optional.**
	 * The distinction is the whole contract: `null` is "this shop is on `FREE`, the one tier
	 * with no period", and a paid tier without a cadence is not a state that can be priced.
	 *
	 * It is required rather than defaulted so a client that forgets the key is refused
	 * instead of silently inheriting whatever cadence the shop happens to hold. A merchant
	 * with no subscription row holds `null`, and defaulting that to `MONTHLY` would be the
	 * server choosing how somebody pays — the one decision a picker exists to collect.
	 *
	 * The pair is checked here rather than in the service because this is the only place
	 * that has both the tier list and the cadence list in hand.
	 */
	changePlan: businessProcedure("business:settings")
		.input(
			z
				.object({
					businessId: z.string(),
					plan: z.enum(PLANS),
					cadence: cadenceSchema.nullable(),
					/** Required on a paid pair; refused on `FREE`. */
					reference: z.string().trim().min(4).max(80).optional(),
				})
				.refine(
					(data) =>
						data.plan === "FREE"
							? data.cadence === null
							: data.cadence !== null,
					{
						message:
							"El plan gratis no tiene periodicidad, y un plan pagado necesita una.",
						path: ["cadence"],
					},
				)
				.refine(
					(data) =>
						data.plan === "FREE"
							? data.reference === undefined
							: data.reference !== undefined,
					{
						message:
							"Un plan pagado necesita la referencia SINPE, y el plan gratis no se paga.",
						path: ["reference"],
					},
				),
		)
		.mutation(({ ctx, input }) =>
			subscriptions.changePlan(ctx, input.plan, input.cadence, new Date(), {
				reference: input.reference,
			}),
		),
});
