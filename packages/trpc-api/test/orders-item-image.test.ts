import { describe, expect, test } from "bun:test";
import { addToCartInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import { authed, seedBusiness, seedProduct, seedUser, world } from "./harness";

/**
 * An order line's picture, end to end through the mapper.
 *
 * `orders.place` has always written `order_item.imageUrlSnapshot`; what was missing was
 * the wire: `orderItemOf` dropped the column, so `OrderDetail.items` carried no image and
 * no receipt could draw one. Two claims, and the second is the one the column exists for:
 *
 * 1. **The line carries the picture the product had when it was bought**, equal to the
 *    product's `imageUrl` at checkout - and `null` when it had none, which is what every
 *    seeded product has while R2 is unbound, so the null case is asserted rather than
 *    assumed away.
 * 2. **A receipt does not follow the catalogue.** The product's picture (and name) are
 *    changed after the order and the line still shows the checkout values - the same rule
 *    `nameSnapshot` already obeys, and the reason the field is a snapshot rather than a
 *    join back to `product`.
 *
 * The order is *placed* rather than inserted, for the reason `orders-reorder.test.ts`
 * states: `place` is what writes the snapshot, so a fabricated `order_item` row would
 * assert a table shape instead of the rows the API actually writes.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

const CASH = "CASH" as const;

describe("an order line's image", () => {
	test("carries the checkout picture, and keeps it when the catalogue changes", async () => {
		const test = world();
		const shopId = await seedBusiness(test.db, { id: "biz_image_shop" });
		const coffee = await seedProduct(test.db, {
			id: "prd_image_coffee",
			businessId: shopId,
			name: "Café chorreado",
			priceMinor: 1500,
		});
		// A second line with no picture at all, so the null case is on the same receipt as
		// the one that has one.
		const pastry = await seedProduct(test.db, {
			id: "prd_image_pastry",
			businessId: shopId,
			name: "Pastel",
			priceMinor: 900,
		});
		const customer = await seedUser(test.db, { id: "usr_image_customer" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		// The picture the product has when it is bought. `seedProduct` leaves the column
		// null - the honest default while there is nowhere to upload to - so it is set the
		// way any writer sets it, before the order snapshots it.
		const checkoutImage = "https://cdn.example.test/cafe.png";
		test.sqlite
			.prepare("update product set image_url = ? where id = ?")
			.run(checkoutImage, coffee.id);

		await caller.cart.addItem(
			addToCartInput.parse({ productId: coffee.id, quantity: 1 }),
		);
		await caller.cart.addItem(
			addToCartInput.parse({ productId: pastry.id, quantity: 1 }),
		);
		const order = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_image_000001",
		});

		// Equal to the product's `imageUrl` at the time of the order - read back from the
		// product row rather than repeated from the string above, so the assertion is
		// about the snapshot and not about this test agreeing with itself.
		const atOrder = test.sqlite
			.prepare("select image_url from product where id = ?")
			.get(coffee.id) as { image_url: string | null };
		expect(atOrder.image_url).toBe(checkoutImage);

		expect(
			order.items.find((item) => item.name === "Café chorreado")?.imageUrl,
		).toBe(atOrder.image_url);
		expect(
			order.items.find((item) => item.name === "Pastel")?.imageUrl,
		).toBeNull();

		// The catalogue moves on; the receipt does not. The name moves with it on purpose:
		// if either snapshot followed the product, the lines below could not be found by
		// the names the customer saw at checkout.
		test.sqlite
			.prepare("update product set image_url = ?, name = ? where id = ?")
			.run(
				"https://cdn.example.test/cafe-v2.png",
				"Café chorreado v2",
				coffee.id,
			);

		const reread = await caller.orders.byId({ id: order.id });
		expect(
			reread.items.find((item) => item.name === "Café chorreado")?.imageUrl,
		).toBe(checkoutImage);
		expect(
			reread.items.find((item) => item.name === "Pastel")?.imageUrl,
		).toBeNull();

		test.close();
	});
});
