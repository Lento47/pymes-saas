import {
	adminActionInput,
	adminCategoryInput,
	adminCourierDecisionInput,
	adminCourierListInput,
	adminDeleteCategoryInput,
	adminListInput,
	adminSubscriptionsInput,
	adminSupportTicketListInput,
	adminSupportTicketReplyInput,
	adminSupportTicketResolveInput,
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

	/**
	 * Queue depth for the console's badge, in one read.
	 *
	 * Deliberately not read out of `metrics`: that refetches every 30 seconds and returns
	 * ~30 rows of KPIs, and the courier half of the badge used to come from a separate
	 * `courierProfiles({ limit: 1 })` page read for its `.total`. Two requests for two
	 * integers, on the first thing the console has to get right.
	 */
	approvalCounts: adminProcedure.query(({ ctx }) => admin.approvalCounts(ctx)),

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

	/**
	 * Both take `adminActionInput` rather than `grantAdmin`'s bare `{ userId }`.
	 *
	 * `revokeAdmin` genuinely needs the reason — `REASON_REQUIRED_ACTIONS` names it — and
	 * `reactivateUser` takes the same schema so the console can send one without a second
	 * input type for a field only one of the pair requires. `grantAdmin` keeps its narrow
	 * input because it never wanted one.
	 */
	reactivateUser: adminProcedure
		.input(adminActionInput)
		.mutation(({ ctx, input }) => admin.reactivateUser(ctx, input)),

	grantAdmin: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(({ ctx, input }) => admin.grantAdmin(ctx, input)),

	revokeAdmin: adminProcedure
		.input(adminActionInput.extend({ userId: z.string() }))
		.mutation(({ ctx, input }) => admin.revokeAdmin(ctx, input)),

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
		.input(adminDeleteCategoryInput)
		.mutation(({ ctx, input }) => admin.deleteCategory(ctx, input)),

	auditLog: adminProcedure
		.input(
			adminListInput.extend({
				actorId: z.string().optional(),
				targetId: z.string().optional(),
			}),
		)
		.query(({ ctx, input }) => admin.auditLogEntries(ctx, input)),

	/**
	 * The support queue. This is the resolution path — without it the merchant side in
	 * `routers/support.ts` can only ever raise questions nobody closes, which is exactly
	 * the write-only sink `apps/api`'s `AgentEscalation` has been since it was written.
	 *
	 * Note the default: this list shows *every* status, where the merchant's shows only the
	 * live ones. `adminSupportTicketListInput` explains why the two differ, and the short
	 * version is that an operator who cannot see yesterday's tickets cannot tell a quiet
	 * weekend from an ignored one.
	 */
	supportTickets: adminProcedure
		.input(adminSupportTicketListInput)
		.query(({ ctx, input }) => adminContent.supportTickets(ctx, input)),

	/** One ticket and its thread, with the shop's name — no `businessId`; this is the console. */
	supportTicket: adminProcedure
		.input(z.object({ ticketId: z.string() }))
		.query(({ ctx, input }) => adminContent.supportTicket(ctx, input.ticketId)),

	/** PymesHub answering, without moving the ticket. See `replyOnTicket` for why. */
	replyOnSupportTicket: adminProcedure
		.input(adminSupportTicketReplyInput)
		.mutation(({ ctx, input }) => adminContent.replyOnTicket(ctx, input)),

	/**
	 * Closing a ticket. The note is required and is posted as the closing message, so a
	 * resolution always carries the words that resolved it — there is no input here that
	 * closes a ticket silently.
	 */
	resolveSupportTicket: adminProcedure
		.input(adminSupportTicketResolveInput)
		.mutation(({ ctx, input }) => adminContent.resolveTicket(ctx, input)),
});
