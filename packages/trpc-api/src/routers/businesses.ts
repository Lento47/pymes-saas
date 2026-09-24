import { businessListInput } from "@pymeshub/shared";
import { z } from "zod";

import * as businesses from "../services/businesses";
import { publicProcedure, router } from "../trpc";

/**
 * The public side of a shop: its storefront and the list a customer browses.
 *
 * Both are public for the same reason `catalog` is — a marketplace that hides its shops
 * behind a sign-in is a marketplace nobody can evaluate. Neither takes a `businessId` that
 * decides *whose* data comes back: `bySlug` reads a public storefront, and `list` reads a
 * set the customer is allowed to see by definition.
 *
 * The business's own settings, staff and analytics live in the `business` router, and every
 * procedure there goes through `businessProcedure`.
 */
export const businessesRouter = router({
	bySlug: publicProcedure
		.input(z.object({ slug: z.string().trim().min(2).max(80) }))
		.query(({ ctx, input }) => businesses.bySlug(ctx, input)),

	list: publicProcedure
		.input(businessListInput)
		.query(({ ctx, input }) => businesses.list(ctx, input)),
});
