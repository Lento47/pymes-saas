import {
	adminActionInput,
	adminCategoryInput,
	adminCourierDecisionInput,
	adminCourierListInput,
	adminListInput,
	adminSubscriptionsInput,
	createPriceBookInput,
	recordPaymentInput,
} from "@pymeshub/shared";
import { z } from "zod";

import * as admin from "../services/admin";
import * as adminContent from "../services/admin-content";
import * as subscriptions from "../services/subscription";
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

	user: adminProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => admin.userDetail(ctx, input)),

	courierProfiles: adminProcedure
		.input(adminCourierListInput)
		.query(({ ctx, input }) => admin.courierProfiles(ctx, input)),

	reviewCourier: adminProcedure
		.input(adminCourierDecisionInput)
		.mutation(({ ctx, input }) => admin.reviewCourier(ctx, input)),

	suspendUser: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.suspendUser(ctx, input)),

	grantAdmin: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(({ ctx, input }) => admin.grantAdmin(ctx, input)),

	orders: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => admin.orders(ctx, input)),

	products: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => adminContent.products(ctx, input)),

	unpublishProduct: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.unpublishProduct(ctx, input)),

	promotions: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => adminContent.promotions(ctx, input)),

	courierInvites: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => adminContent.courierInvites(ctx, input)),

	reviews: adminProcedure
		.input(adminListInput)
		.query(({ ctx, input }) => adminContent.reviews(ctx, input)),

	/** Cancels an order the business would not. A reason is required. */
	cancelOrder: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.cancelOrder(ctx, input)),

	/**
	 * Every merchant's billing, arrears first. Replaces `payouts`.
	 *
	 * The shape of the question changed with the business: this used to list settlement
	 * runs with a gross, a fee and a net. There is no settlement now — the consumer pays
	 * the merchant and the courier, and the platform charges a flat subscription — so
	 * the question is who owes us money, for how long, and at what price.
	 */
	subscriptions: adminProcedure
		.input(adminSubscriptionsInput)
		.query(({ ctx, input }) => admin.subscriptions(ctx, input)),

	/**
	 * `reference` is the bank's or SINPE's, and it is the only thing that makes the
	 * payment reconcileable afterwards — it lives in the audit entry, not a column.
	 */
	recordPayment: adminProcedure
		.input(recordPaymentInput)
		.mutation(({ ctx, input }) => admin.recordSubscriptionPayment(ctx, input)),

	/**
	 * Staging a price rise. **This is the "raise the price as the app grows" lever.**
	 *
	 * Inserting a `price_book` row raises what new merchants pay from `effectiveFrom`
	 * and moves nobody already subscribed — their price was captured when their period
	 * began. A past `effectiveFrom` is refused, because that would reprice everyone who
	 * joined since, which is the one outcome the design exists to prevent.
	 */
	priceBooks: adminProcedure.query(({ ctx }) =>
		subscriptions.priceBooks(ctx, new Date()),
	),

	createPriceBook: adminProcedure
		.input(createPriceBookInput)
		.mutation(({ ctx, input }) =>
			subscriptions.createPriceBook(ctx, input, new Date()),
		),

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
