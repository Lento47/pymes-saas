import {
	addToCartInput,
	applyPromotionInput,
	updateCartItemInput,
} from "@pymeshub/shared";
import { z } from "zod";

import * as cart from "../services/cart";
import { protectedProcedure, router } from "../trpc";

/**
 * The cart, which belongs to whoever is holding the phone.
 *
 * Every procedure returns the whole `Cart`: the item list, the totals and the promotion
 * state are one object because they change together, and a client that had to recompute the
 * subtotal after each line would be a second implementation of `discountAmountOf` that
 * disagrees with the first. `get` never returns `null` — an empty cart is a cart with no
 * items, so the cart screen has one shape to render.
 *
 * `addItem` is the only one that can throw a `CONFLICT`, and only for `onBusinessConflict:
 * "reject"`, which is the app's "your cart is from another shop" sheet. Nothing here trusts
 * a price: the line's price is read from the product row, never from the input.
 */
export const cartRouter = router({
	quote: protectedProcedure
		.input(z.object({ fulfilment: z.enum(["PICKUP", "DELIVERY"]) }))
		.query(({ ctx, input }) => cart.quote(ctx, input.fulfilment)),
	get: protectedProcedure.query(({ ctx }) => cart.get(ctx)),

	addItem: protectedProcedure
		.input(addToCartInput)
		.mutation(({ ctx, input }) => cart.addItem(ctx, input)),

	// `quantity: 0` removes the line, which is why there is no separate "set quantity to
	// zero" case in the client.
	updateItem: protectedProcedure
		.input(updateCartItemInput)
		.mutation(({ ctx, input }) => cart.updateItem(ctx, input)),

	removeItem: protectedProcedure
		.input(z.object({ cartItemId: z.string() }))
		.mutation(({ ctx, input }) => cart.removeItem(ctx, input)),

	// A bad code lands in `promotionError` rather than throwing: the customer is still
	// typing it. See `services/cart.ts`.
	applyPromotion: protectedProcedure
		.input(applyPromotionInput)
		.mutation(({ ctx, input }) => cart.applyPromotion(ctx, input)),

	// Removing the code is its own write, and not a side effect of `clear`: emptying the
	// basket to stop using a coupon throws away every line the customer chose.
	removePromotion: protectedProcedure.mutation(({ ctx }) =>
		cart.removePromotion(ctx),
	),

	clear: protectedProcedure.mutation(({ ctx }) => cart.clear(ctx)),
});
