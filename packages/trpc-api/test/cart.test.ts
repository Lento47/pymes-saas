import { describe, expect, test } from "bun:test";
import { addToCartInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * One cart, one business.
 *
 * Two businesses in one basket is not a merge problem, it is a fulfilment problem — two
 * delivery fees, two prep times, two payouts — so the API never merges. It refuses, or it
 * replaces, and the customer is told which by `replacedCart`.
 *
 * The claim the second test makes is the one worth the effort: a refusal must leave the
 * cart **exactly** as it was. A service that abandoned the old cart and then threw would
 * pass a test that only checked the error code while quietly emptying a basket.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

/** Two shops, each with a product, and a customer with no basket yet. */
async function twoShops(test: Test) {
	const first = await seedBusiness(test.db, { id: "biz_cart_one" });
	const second = await seedBusiness(test.db, {
		id: "biz_cart_two",
		slug: "tienda-dos",
	});
	const coffee = await seedProduct(test.db, {
		id: "prd_cart_coffee",
		businessId: first,
		name: "Café",
		priceMinor: 1500,
	});
	const bread = await seedProduct(test.db, {
		id: "prd_cart_bread",
		businessId: second,
		name: "Pan",
		priceMinor: 900,
	});
	const customer = await seedUser(test.db, { id: "usr_cart_customer" });
	const caller = appRouter.createCaller(await authed(test, customer)) as Caller;

	return { first, second, coffee, bread, customer, caller };
}

describe("the cart's one-business rule", () => {
	test("a second business is refused by default, and the cart is untouched", async () => {
		const test = world();
		const { first, caller, coffee, bread } = await twoShops(test);

		const started = await caller.cart.addItem(
			addToCartInput.parse({ productId: coffee.id, quantity: 2 }),
		);
		expect(started.businessId).toBe(first);
		expect(started.items).toHaveLength(1);
		expect(started.totals.subtotalMinor).toBe(3000);

		// `reject` is the default the schema carries, and the error is a `CONFLICT` rather
		// than a `BAD_REQUEST`: the caller can resolve it by answering a question, which is
		// what makes it the "start a new cart?" sheet instead of an inline field error.
		const error = await refused(
			caller.cart.addItem(
				addToCartInput.parse({
					productId: bread.id,
					quantity: 1,
					onBusinessConflict: "reject",
				}),
			),
		);
		expect(error.code).toBe("CONFLICT");
		// Both sides of the conflict travel in `details`, so the sheet can name the shop the
		// basket belongs to without a second read.
		expect(error.details).toMatchObject({
			cartBusinessId: first,
			productBusinessId: "biz_cart_two",
		});

		// And the basket is exactly what it was: same shop, same single line, same total.
		const after = await caller.cart.get();
		expect(after.businessId).toBe(first);
		expect(after.items).toHaveLength(1);
		expect(after.items[0]?.productId).toBe(coffee.id);
		expect(after.items[0]?.quantity).toBe(2);
		expect(after.totals.subtotalMinor).toBe(3000);
		expect(after.replacedCart).toBe(false);

		test.close();
	});

	test("replace abandons the old basket rather than deleting it", async () => {
		const test = world();
		const { second, caller, customer, coffee, bread } = await twoShops(test);

		const started = await caller.cart.addItem(
			addToCartInput.parse({ productId: coffee.id, quantity: 1 }),
		);

		const replaced = await caller.cart.addItem(
			addToCartInput.parse({
				productId: bread.id,
				quantity: 1,
				onBusinessConflict: "replace",
			}),
		);
		expect(replaced.businessId).toBe(second);
		expect(replaced.items.map((item) => item.productId)).toEqual([bread.id]);
		// The flag is what tells the client a basket was dropped, so it can say so.
		expect(replaced.replacedCart).toBe(true);

		// The previous cart still exists — it is history, which is what makes "why did my
		// basket empty?" answerable — and the customer has exactly one open cart.
		const carts = test.sqlite
			.prepare("select status from cart where user_id = ? order by created_at")
			.all(customer.id) as { status: string }[];
		expect(carts.map((row) => row.status).sort()).toEqual([
			"ABANDONED",
			"OPEN",
		]);
		expect(started.businessId).toBe("biz_cart_one");

		test.close();
	});

	test("a line survives a quantity edit and a removal", async () => {
		const test = world();
		const { caller, coffee } = await twoShops(test);

		const cart = await caller.cart.addItem(
			addToCartInput.parse({ productId: coffee.id, quantity: 1 }),
		);
		const lineId = cart.items[0]?.id ?? "";

		const updated = await caller.cart.updateItem({
			cartItemId: lineId,
			quantity: 3,
		});
		expect(updated.totals.subtotalMinor).toBe(4500);

		// Quantity 0 is the schema's way of saying "remove it" without a second procedure.
		const emptied = await caller.cart.updateItem({
			cartItemId: lineId,
			quantity: 0,
		});
		expect(emptied.items).toHaveLength(0);
		expect(emptied.totals.subtotalMinor).toBe(0);
		// The business stays on the cart: an empty basket at a shop is still that shop's.
		expect(emptied.currency).toBe("CRC");

		test.close();
	});
});
