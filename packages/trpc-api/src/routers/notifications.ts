import { z } from "zod";

import * as users from "../services/users";
import { protectedProcedure, router } from "../trpc";

/**
 * The customer's own notification feed — one namespace, one read.
 *
 * The list is scoped to `ctx.user.id` and filtered to the kinds a customer is meant to see:
 * the same table carries the internal rows this API writes for itself (the idempotency
 * ledger for `orders.place`, the reply ledger for `reviews.reply`), and those are excluded
 * by kind in the service rather than by a column a future writer could forget to set.
 *
 * `limit` is defaulted here: the screen asks for a page and never names a size.
 */
export const notificationsRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				cursor: z.string().max(200).optional(),
				limit: z.number().int().min(1).max(50).default(20),
			}),
		)
		.query(({ ctx, input }) => users.listNotifications(ctx, input)),
});
