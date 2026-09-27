import {
	promotionActiveInput,
	promotionCreateInput,
	promotionListInput,
	promotionUpdateInput,
} from "@pymeshub/shared";
import { z } from "zod";

import * as promotions from "../services/promotions";
import { businessProcedure, router } from "../trpc";

/**
 * `businessId` is on every input here and read by nothing below.
 *
 * `businessProcedure` answers it against `membership` before the body runs, and the
 * services scope by `ctx.membership.businessId` — so the field exists to be *checked*,
 * not to be used. Intersected rather than `.extend`ed onto the shared schemas because
 * those are refined, and zod 4 refuses `.extend` on a refined schema at module
 * evaluation. The same shape `products.ts` uses, for the same reason.
 */
const scoped = <T extends z.ZodTypeAny>(schema: T) =>
	z.intersection(z.object({ businessId: z.string() }), schema);

/** The same, for the two writes that address one code by id. */
const scopedWithId = <T extends z.ZodTypeAny>(schema: T) =>
	z.intersection(z.object({ businessId: z.string(), id: z.string() }), schema);

/**
 * The shop's own codes: what they are worth, when they run, and how much of them is
 * already gone.
 *
 * Reads are `orders:read` — the capability all three roles hold — because a cashier
 * answering "do you have a discount?" is a real question at the counter, and a screen
 * that refused to open for STAFF would push them to ask a manager for a code's
 * spelling. Writes are `business:settings`, because a promotion changes what the shop
 * charges: the same manager's decision `pauseLocation` is, and the same one
 * `products.archive` narrows further with `assertRole`.
 */
export const promotionsRouter = router({
	list: businessProcedure("orders:read")
		.input(promotionListInput)
		.query(({ ctx }) => promotions.list(ctx)),

	detail: businessProcedure("orders:read")
		.input(scoped(z.object({ id: z.string() })))
		.query(({ ctx, input }) => promotions.detail(ctx, input)),

	create: businessProcedure("business:settings")
		.input(scoped(promotionCreateInput))
		.mutation(({ ctx, input }) =>
			promotions.create(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),

	update: businessProcedure("business:settings")
		.input(scopedWithId(promotionUpdateInput))
		.mutation(({ ctx, input }) =>
			promotions.update(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),

	/**
	 * The only write a customer feels the moment it lands. Kept off `update` so a form
	 * saving a typo cannot pause a code people are holding — see `services/promotions.ts`.
	 */
	setActive: businessProcedure("business:settings")
		.input(scoped(promotionActiveInput))
		.mutation(({ ctx, input }) =>
			promotions.setActive(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),
});
