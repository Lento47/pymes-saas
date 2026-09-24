import {
	productCreateInput,
	productListInput,
	productUpdateInput,
} from "@pymeshub/shared";
import { z } from "zod";
import { assertRole } from "../services/helpers";
import * as products from "../services/products";
import { businessProcedure, publicProcedure, router } from "../trpc";

/**
 * The catalogue, from both ends.
 *
 * Reads are public; writes are `businessProcedure`, so the `businessId` in the input is
 * answered against `membership` before the body runs and every write in the service is
 * scoped by the membership the middleware injected rather than by the argument.
 *
 * `businessId` is part of each input here — every write names the shop it is editing —
 * and is merged into the service input with an explicit spread so it is visible at the call
 * site that the two are not the same value: one arrives from the caller, the other from the
 * verified membership.
 *
 * The product half is combined with `z.intersection` rather than `.extend()`, because
 * `productCreateInput` is a refined schema and a refinement is not an object: zod 4 refuses
 * `.extend` on one, and it refuses it while the module is being evaluated, so the failure
 * would be a Worker that does not boot rather than a request that fails. The intersection
 * keeps both halves — the field shapes and the compare-at rule — exactly as the clients
 * already hold them.
 */
const scopedProduct = <T extends z.ZodTypeAny>(schema: T) =>
	z.intersection(z.object({ businessId: z.string() }), schema);
export const productsRouter = router({
	byId: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => products.byId(ctx, input)),

	/**
	 * The member's read of one product: drafts and archives included.
	 *
	 * A separate procedure from `byId` rather than a flag on it, for the reason
	 * `detailForMember` states where it lives: the public read's filter is the
	 * security property, and a parameter that switches it off is one a public
	 * caller eventually passes. `businessProcedure` answers the `businessId`
	 * against membership before the body runs, so a stranger asking for another
	 * shop's draft is refused before any row is read. This is what the product
	 * form reads when it opens an existing product for editing.
	 */
	detail: businessProcedure("products:read")
		.input(z.object({ businessId: z.string(), id: z.string() }))
		.query(({ ctx, input }) =>
			products.detailForMember(ctx, {
				businessId: ctx.membership.businessId,
				id: input.id,
			}),
		),

	list: publicProcedure
		.input(productListInput)
		.query(({ ctx, input }) => products.list(ctx, input)),

	create: businessProcedure("products:write")
		.input(scopedProduct(productCreateInput))
		.mutation(({ ctx, input }) =>
			products.create(ctx, { ...input, businessId: ctx.membership.businessId }),
		),

	update: businessProcedure("products:write")
		.input(
			z.intersection(
				z.object({ businessId: z.string(), id: z.string() }),
				productUpdateInput,
			),
		)
		.mutation(({ ctx, input }) =>
			products.update(ctx, { ...input, businessId: ctx.membership.businessId }),
		),

	archive: businessProcedure("products:write")
		.input(z.object({ businessId: z.string(), id: z.string() }))
		.mutation(({ ctx, input }) => {
			// Archiving is a manager's decision, not a line cook's: `products:write` is held by
			// STAFF and OWNER alike, and taking a product off the shelf is not the same act as
			// editing its description. `assertRole` is the narrow gate; the capability above is
			// the coarse one. See `helpers.assertRole`.
			assertRole(ctx, "MANAGER", "OWNER");
			return products.archive(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	setStock: businessProcedure("products:write")
		.input(
			z.object({
				businessId: z.string(),
				id: z.string(),
				quantity: z.number().int().min(0).max(100_000),
			}),
		)
		.mutation(({ ctx, input }) =>
			products.setStock(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),
});
