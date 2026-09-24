import {
	advanceOrderInput,
	assignCourierInput,
	cancelOrderInput,
	createReviewInput,
	orderListInput,
	placeOrderInput,
	purchasedProductsInput,
	reorderOrderInput,
	reportLocationInput,
} from "@pymeshub/shared";
import { z } from "zod";

import * as orders from "../services/orders";
import * as reviews from "../services/reviews";
import { businessProcedure, protectedProcedure, router } from "../trpc";

/**
 * Orders, from both ends of the same row.
 *
 * The split between `protectedProcedure` and `businessProcedure` here is not a style
 * choice, it follows the contract's inputs: `orders.advance` takes an `orderId` and no
 * `businessId`, so there is nothing for the business middleware to check and the scope is
 * resolved in the service from the order row — the caller's own order, their admin flag, or
 * a membership on the business the order belongs to, and anything else is the same
 * `NotFoundError` a missing order gets. `queue` and `stats` take a `businessId` and are
 * `businessProcedure`, which is the stronger check of the two.
 *
 * `place` is idempotent on `clientRequestId` and rate-limited in the service: the retry
 * that follows a phone losing signal is the exact case the id exists for, and a customer
 * tapping twice must not be charged twice.
 */
export const ordersRouter = router({
	place: protectedProcedure
		.input(placeOrderInput)
		.mutation(({ ctx, input }) => orders.place(ctx, input)),

	// One procedure for both apps: `role` decides whose orders come back, and the service
	// branches on it rather than on the caller's memberships.
	list: protectedProcedure
		.input(orderListInput)
		.query(({ ctx, input }) => orders.list(ctx, input)),

	/**
	 * The home screen's "Order again" shelf: the products the caller has bought before,
	 * as ordinary product cards - live prices, not the order's snapshots.
	 *
	 * `protectedProcedure` like `reorder`, and scoped the same way: the service puts
	 * `customerId` in the `where` clause, so a shop's staff member and an admin see their
	 * own purchases and nobody else's. There is no cross-customer shelf at any privilege,
	 * which is why the input carries no `userId`.
	 */
	purchasedProducts: protectedProcedure
		.input(purchasedProductsInput)
		.query(({ ctx, input }) => orders.purchasedProducts(ctx, input)),

	// Customer sees their own, a member of the business sees the business's, an admin sees
	// any. Everything else is a 404, not a 403 — the caller does not learn that the order
	// exists.
	byId: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => orders.byId(ctx, input)),

	track: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => orders.track(ctx, input)),

	cancel: protectedProcedure
		.input(cancelOrderInput)
		.mutation(({ ctx, input }) => orders.cancel(ctx, input)),

	/** A review is the customer's line about their own finished order, so it lives here. */
	review: protectedProcedure
		.input(createReviewInput)
		.mutation(({ ctx, input }) => reviews.create(ctx, input)),

	/**
	 * Buy the same things again, into the caller's own cart.
	 *
	 * `protectedProcedure` and not `businessProcedure`, for the reason `advance` is: the
	 * input carries an `orderId` and no `businessId`, so there is nothing for the business
	 * middleware to check. The scope is resolved in the service from the order row, where
	 * "the caller is this order's customer" is part of the lookup itself — a shop's staff
	 * member and an admin are both refused, because `customerId` is in the `where` clause.
	 */
	reorder: protectedProcedure
		.input(reorderOrderInput)
		.mutation(({ ctx, input }) => orders.reorder(ctx, input)),

	/**
	 * Staff move an order. The legality of the move is `canTransition`'s decision, not this
	 * router's: an illegal one is refused with the reason, and `expectedStatus` loses the
	 * race between two phones tapping the same button.
	 */
	advance: protectedProcedure
		.input(advanceOrderInput)
		.mutation(({ ctx, input }) => orders.advance(ctx, input)),

	/**
	 * Hand a READY delivery to a courier. `protectedProcedure` like `advance`:
	 * the input carries an `orderId` and no `businessId`, so the MANAGER-or-OWNER
	 * check runs in the service against the order's own shop.
	 */
	assign: protectedProcedure
		.input(assignCourierInput)
		.mutation(({ ctx, input }) => orders.assign(ctx, input)),

	/**
	 * One foreground ping from the courier carrying the order. The caller must
	 * be the assignee and the run must be out for delivery; twelve a minute
	 * for a phone that reports every fifteen seconds.
	 */
	reportLocation: protectedProcedure
		.input(reportLocationInput)
		.mutation(({ ctx, input }) => orders.reportLocation(ctx, input)),

	/** The live board. `businessId` is required here, and checked against `membership`. */
	queue: businessProcedure("orders:read")
		.input(orderListInput.extend({ businessId: z.string() }))
		.query(({ ctx, input }) =>
			orders.queue(ctx, { ...input, businessId: ctx.membership.businessId }),
		),

	stats: businessProcedure("orders:read")
		.input(
			z.object({ businessId: z.string(), locationId: z.string().optional() }),
		)
		.query(({ ctx, input }) => orders.stats(ctx, input)),
});
