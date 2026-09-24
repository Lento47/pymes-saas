import { replyToReviewInput, reviewListInput } from "@pymeshub/shared";
import { z } from "zod";
import { assertRole } from "../services/helpers";
import * as reviews from "../services/reviews";
import { businessProcedure, publicProcedure, router } from "../trpc";

/**
 * A shop's reviews, from both sides of the counter: the page any customer reads, and the
 * page its staff reads.
 *
 * `reviews.list` is public for the same reason `businesses.bySlug` is — a storefront's
 * rating is a number with nothing behind it if a stranger cannot read the rows it was
 * averaged from — and it takes the same `reviewListInput` its business-side sibling does,
 * so one client component pages both. It is `docs/design-mobile.md`'s contract name, and
 * `docs/api-surface.md` used to record its absence as a missing procedure.
 *
 * The business's side is `businessProcedure("orders:read")`. `RoleCapability` has no review
 * entry, and adding one would be a fifth name for a set that already says the right thing:
 * reading reviews is STAFF+ and answering one is MANAGER+, which is exactly `orders:read`
 * plus an `assertRole`. A review comes from an order, and whoever may see the shop's orders
 * may see what customers said about them.
 *
 * `reply`'s input carries `businessId` even though `ReplyToReviewInput` does not: the
 * middleware is what turns an input `businessId` into a checked membership, and without one
 * there it would have nothing to check. The contract's own rule is that every procedure in
 * the business section says which business it is acting on.
 */
export const reviewsRouter = router({
	/**
	 * The public page. No session: the `businessId` in the input decides which shop is read,
	 * and what makes it safe is the shop's own `status` — the same `publicBusiness()` filter
	 * `products.list` applies to its catalogue — rather than a membership row this caller
	 * does not have.
	 */
	list: publicProcedure
		.input(reviewListInput)
		.query(({ ctx, input }) => reviews.listPublic(ctx, input)),

	listForBusiness: businessProcedure("orders:read")
		.input(reviewListInput)
		.query(({ ctx, input }) =>
			reviews.listForBusiness(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),

	/** One reply per review, editable — the service upserts rather than appending. */
	reply: businessProcedure("orders:read")
		.input(replyToReviewInput.extend({ businessId: z.string() }))
		.mutation(({ ctx, input }) => {
			assertRole(ctx, "MANAGER", "OWNER");
			return reviews.reply(ctx, input);
		}),
});
