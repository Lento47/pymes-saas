import {
	adminActionInput,
	adminCategoryInput,
	adminListInput,
} from "@pymeshub/shared";
import { z } from "zod";

import * as admin from "../services/admin";
import { adminProcedure, router } from "../trpc";

/**
 * The platform console — every procedure behind `adminProcedure`, which is `isAdmin` on the
 * caller's own row and nothing else. `isAdmin` is a platform axis, not a business role: a
 * business's OWNER is not an admin, and an admin is not a member of anybody's business.
 *
 * Every mutation here writes an `audit_log` row with the actor and the before/after values,
 * and the actions listed in `REASON_REQUIRED_ACTIONS` refuse without a reason — the check is
 * `requireReason` in the service, so it cannot be skipped by a caller that goes straight to
 * the service.
 *
 * `AdminListInput` carries a `cursor` and these tables answer `{ rows, total }`: the cursor
 * is an offset, encoded, which is what an admin table with a page count wants. There is no
 * `nextCursor` because there is no next page to hand back — the total is what the footer
 * renders from.
 */
export const adminRouter = router({
	metrics: adminProcedure.query(({ ctx }) => admin.metrics(ctx)),

	businesses: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => admin.businesses(ctx, input)),

	business: adminProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => admin.business(ctx, input)),

	suspendBusiness: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.suspendBusiness(ctx, input)),

	reactivateBusiness: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.reactivateBusiness(ctx, input)),

	verifyBusiness: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.verifyBusiness(ctx, input)),

	users: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => admin.users(ctx, input)),

	suspendUser: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.suspendUser(ctx, input)),

	grantAdmin: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(({ ctx, input }) => admin.grantAdmin(ctx, input)),

	orders: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => admin.orders(ctx, input)),

	/** Cancels an order the business would not. A reason is required. */
	cancelOrder: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.cancelOrder(ctx, input)),

	payouts: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => admin.payouts(ctx, input)),

	/** `reference` is the bank's, and it is what makes the payout reconcileable afterwards. */
	markPayoutPaid: adminProcedure
		.input(
			z.object({
				payoutId: z.string(),
				reference: z.string().trim().min(3).max(120),
				reason: z.string().trim().max(500).optional(),
			}),
		)
		.mutation(({ ctx, input }) => admin.markPayoutPaid(ctx, input)),

	categories: adminProcedure.query(({ ctx }) => admin.categories(ctx)),

	saveCategory: adminProcedure
		.input(adminCategoryInput)
		.mutation(({ ctx, input }) => admin.saveCategory(ctx, input)),

	deleteCategory: adminProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => admin.deleteCategory(ctx, input)),

	auditLog: adminProcedure
		.input(
			adminListInput.extend({
				actorId: z.string().optional(),
				targetId: z.string().optional(),
			}),
		)
		.query(({ ctx, input }) => admin.auditLogEntries(ctx, input)),
});
