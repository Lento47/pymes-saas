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
			if (!membership) return { options: [] };

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
			});
			return { options };
		}),

	/**
	 * Moving between plans.
	 *
	 * The limits apply **immediately**; the new price is captured at the next period. A
	 * merchant who upgrades on day 29 of a month gets the bigger catalogue today and is
	 * not charged a second time four weeks early.
	 */
	changePlan: businessProcedure("business:settings")
		.input(
			z.object({ businessId: z.string(), plan: z.enum(["WEEKLY", "MONTHLY"]) }),
		)
		.mutation(({ ctx, input }) =>
			subscriptions.changePlan(ctx, input.plan, new Date()),
		),
});
