import { describe, expect, test } from "bun:test";
import { addToCartInput, MAX_CART_LINES } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * Reordering: yesterday's order, into today's basket, priced by today's rows.
 *
 * Five claims, and the last two are the ones worth the setup:
 *
 * 1. **It is the caller's own order or nothing.** A member of the fulfilling business and a
 *    platform admin both get the `NOT_FOUND` a fabricated id gets, because `customerId` is
 *    part of the lookup rather than a comparison after it. A shop's staff member being able
 *    to fill a stranger's basket is the bug this is written to prevent.
 * 2. **It prices from the catalogue, not from the receipt.** `order_item` is a snapshot taken
 *    at checkout; the line that comes back must carry the product's price today. This is the
 *    concrete answer to "why can a client not do this itself".
 * 3. **A line that cannot come back is skipped and named, never fatal.** A product taken down
 *    since the order, an option that no longer exists, or a basket with no room for the line is
 *    reported with its own reason on the line it affects while every other line still arrives —
 *    one renamed option must not make an old order permanently unbuyable.
 * 4. **A shop the platform has closed leaves no basket behind.** The refusal happens before
 *    any write, so there is no open cart pointing at a shop nobody can buy from.
 * 5. **`onBusinessConflict` decides, and only it does.** A basket already at another shop is a
 *    `CONFLICT` under the default `reject` — nothing written — and the same call under
 *    `replace` returns the rebuilt basket. The claim is worth its case because the two branches
 *    are one line apart in the service and the wrong default silently discards a basket the
 *    customer spent five minutes building.
 *
 * Five claims, seven cases — claim 3 needs one per reason (`REORDER_SKIP_REASONS`), because a
 * reason nobody can reach is a reason the screen was written to draw and never gets handed, and
 * claim 1 is carried by two cases that assert the *same* refusal from two different callers.
 * This header has been wrong twice: it said "four claims" beside seven `test(` calls, and when
 * that was corrected to "the last two" claim 5 still had no line here at all — a reader trusts
 * a count instead of counting, which is exactly why the mapping is now spelled out.
 *
 * **What no case here covers.** `cart.addItem` merges into an existing line and caps the sum at
 * `MAX_LINE_QUANTITY` (`cart.ts:158-161`), so a reorder can return a *short* line: ask for ten,
 * hold fifteen, get five, with `addedCount: 1` and `skipped: []`. Claim 3 is about lines and is
 * silent about quantities, and the case above named "a full basket skips what does not fit" is
 * the `MAX_CART_LINES` cap on *lines*, not this one. The shortfall is recorded on
 * `reorderResultSchema` and tracked as an open product decision; until it is decided there is
 * nothing to assert, and this note is here so the absence is not mistaken for coverage.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const CASH = "CASH" as const;

function count(sqlite: Test["sqlite"], table: string, where = ""): number {
	const row = sqlite
		.prepare(`select count(*) as n from "${table}" ${where}`)
		.get() as { n: number };
	return row.n;
}

/**
 * The lines of the customer's *open* cart.
 *
 * Not `count(cart_item)`: `place` marks the checkout cart `CHECKED_OUT` and leaves its rows
 * where they are, so an unscoped count includes the order's own lines and every assertion
 * about "the reorder wrote nothing" would be one too high.
 */
function openLines(sqlite: Test["sqlite"]): number {
	return count(
		sqlite,
		"cart_item",
		"where cart_id in (select id from cart where status = 'OPEN')",
	);
}

/**
 * A shop with one priced product, a customer, and one placed order for `quantity` of it.
 *
 * The order is *placed* rather than inserted: `place` is what snapshots the options and
 * marks the cart `CHECKED_OUT`, so a reorder spec that fabricated an `order_item` row would
 * be testing a table shape instead of the rows the API actually writes.
 */
async function placed(test: Test, quantity = 1) {
	const shopId = await seedBusiness(test.db, { id: "biz_reorder_shop" });
	const product = await seedProduct(test.db, {
		id: "prd_reorder_coffee",
		businessId: shopId,
		name: "Café chorreado",
		priceMinor: 1500,
		optionDeltaMinor: 250,
	});
	const customer = await seedUser(test.db, { id: "usr_reorder_customer" });
	const caller = appRouter.createCaller(await authed(test, customer)) as Caller;

	await caller.cart.addItem(
		addToCartInput.parse({
			productId: product.id,
			quantity,
			optionIds: product.optionId ? [product.optionId] : [],
		}),
	);

	const order = await caller.orders.place({
		fulfilment: "PICKUP",
		paymentMethod: CASH,
		clientRequestId: "req_reorder_000001",
	});

	return { shopId, product, customer, caller, order };
}

describe("reordering an order", () => {
	test("the order's own customer gets the basket back, priced by today's rows", async () => {
		const test = world();
		const { product, caller, order } = await placed(test, 2);

		// The receipt's numbers, and then a price rise the order must not carry.
		expect(order.items[0]?.unitPriceMinor).toBe(1750);
		test.sqlite
			.prepare("update product set price_minor = 1900 where id = ?")
			.run(product.id);

		const result = await caller.orders.reorder({ orderId: order.id });

		expect(result.addedCount).toBe(1);
		expect(result.skipped).toEqual([]);
		expect(result.cart.items).toHaveLength(1);
		expect(result.cart.items[0]?.quantity).toBe(2);
		// 1900 + 250, times two. The reorder is a *new* purchase: `cart_item` is priced from
		// the product row, so this is the number the customer would be charged today.
		// `unitPriceMinor` is the product's and `effectiveUnitPriceMinor` adds the option
		// delta — the split is `cartItemOf`'s, and the receipt's 1750 is neither number now.
		expect(result.cart.items[0]?.unitPriceMinor).toBe(1900);
		expect(result.cart.items[0]?.effectiveUnitPriceMinor).toBe(2150);
		expect(result.cart.totals.subtotalMinor).toBe(4300);
		// `place` marked the checkout cart CHECKED_OUT, so this is a fresh basket, not an
		// edit to the one that produced the order.
		expect(result.cart.replacedCart).toBe(false);
		expect(count(test.sqlite, "cart", "where status = 'OPEN'")).toBe(1);

		test.close();
	});

	test("another customer, the shop's own staff, and an admin are all refused alike", async () => {
		const test = world();
		const { shopId, customer, order } = await placed(test);

		const stranger = await seedUser(test.db, { id: "usr_reorder_stranger" });
		const staff = await seedUser(test.db, { id: "usr_reorder_staff" });
		await seedMembership(test.db, staff.id, shopId, "OWNER");
		const admin = await seedUser(test.db, {
			id: "usr_reorder_admin",
			isAdmin: true,
		});

		for (const user of [stranger, staff, admin]) {
			const caller = appRouter.createCaller(await authed(test, user)) as Caller;
			const error = await refused(caller.orders.reorder({ orderId: order.id }));
			// Not FORBIDDEN: the same answer a fabricated id gets, so the endpoint cannot be
			// used to learn which order ids are real. `byId` is where a member and an admin
			// are entitled; this is the customer's own action and nobody else's.
			expect(error.code).toBe("NOT_FOUND");
		}

		// And nothing was written for any of them.
		expect(count(test.sqlite, "cart", "where status = 'OPEN'")).toBe(0);
		// The customer's own call still works, so the refusals above are about the caller and
		// not about the order being unusable.
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		expect(
			(await caller.orders.reorder({ orderId: order.id })).addedCount,
		).toBe(1);

		test.close();
	});

	test("a product taken down since the order is skipped and named, not fatal", async () => {
		const test = world();
		const shopId = await seedBusiness(test.db, { id: "biz_reorder_shop" });
		const coffee = await seedProduct(test.db, {
			id: "prd_reorder_coffee",
			businessId: shopId,
			name: "Café chorreado",
			priceMinor: 1500,
			optionDeltaMinor: 250,
		});
		const pastry = await seedProduct(test.db, {
			id: "prd_reorder_pastry",
			businessId: shopId,
			name: "Pastel",
			priceMinor: 900,
		});
		const customer = await seedUser(test.db, { id: "usr_reorder_customer" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		// Both lines in one order, so "skipped and reported" can be told apart from "the whole
		// call failed": the good line has to arrive while the dead one is named.
		await caller.cart.addItem(
			addToCartInput.parse({
				productId: coffee.id,
				quantity: 1,
				optionIds: coffee.optionId ? [coffee.optionId] : [],
			}),
		);
		await caller.cart.addItem(
			addToCartInput.parse({ productId: pastry.id, quantity: 1 }),
		);
		const order = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_reorder_000002",
		});

		// Taken off sale the way the API does it: archived, which `readBuyableProduct`
		// filters on. The row stays, because `order_item.product_id` references it with
		// `onDelete: restrict` — an order is not allowed to lose the product it names.
		test.sqlite
			.prepare("update product set status = 'ARCHIVED' where id = ?")
			.run(pastry.id);

		const result = await caller.orders.reorder({ orderId: order.id });

		expect(result.addedCount).toBe(1);
		expect(result.cart.items.map((item) => item.productId)).toEqual([
			"prd_reorder_coffee",
		]);
		expect(result.skipped).toEqual([
			{
				productId: pastry.id,
				// The order's snapshot, because the product row is the thing that may be gone
				// or renamed — the reason this field cannot be read from the catalogue.
				name: "Pastel",
				quantity: 1,
				reason: "order.reorder.skipped.productUnavailable",
			},
		]);
		// One line came back, one was named, and the arithmetic closes: nothing was dropped
		// silently and nothing was double-counted.
		expect(result.addedCount + result.skipped.length).toBe(2);

		test.close();
	});

	test("an option that no longer exists skips its line with its own reason", async () => {
		const test = world();
		const { product, caller, order } = await placed(test);

		// The product stays on sale; only the chosen option is gone. `chosenOptionsOf`
		// answers this with a `ValidationError` and the archived product above answers with
		// a `NotFoundError` — two different reasons, which is why the classifier reads the
		// error *class* and not the sentence.
		test.sqlite
			.prepare("update product_option set is_available = 0 where id = ?")
			.run(product.optionId ?? "");

		const result = await caller.orders.reorder({ orderId: order.id });

		expect(result.addedCount).toBe(0);
		expect(result.skipped).toEqual([
			{
				productId: product.id,
				name: "Café chorreado",
				quantity: 1,
				reason: "order.reorder.skipped.optionsUnavailable",
			},
		]);
		// Never `null`: a cart with nothing in it is still a cart, which is what lets the
		// screen render one shape whether or not the reorder brought anything back.
		expect(result.cart.items).toEqual([]);
		expect(result.cart.id).toBe("");
		expect(openLines(test.sqlite)).toBe(0);

		test.close();
	});

	test("a shop the platform has closed is refused, and leaves no basket behind", async () => {
		const test = world();
		const { shopId, caller, order } = await placed(test);

		// SUSPENDED is the platform closing a shop; DRAFT is one that never opened. Both are
		// invisible to the marketplace, and `isPublicBusiness` is the one list that decides.
		test.sqlite
			.prepare("update business set status = 'SUSPENDED' where id = ?")
			.run(shopId);

		const error = await refused(caller.orders.reorder({ orderId: order.id }));

		expect(error.code).toBe("BAD_REQUEST");
		// A message key, not a sentence: the Worker has no dictionary, so the words are the
		// client's to choose. `isReorderErrorKey` in `@pymeshub/shared` is how a client tells
		// this apart from tRPC's own text before showing it to a customer.
		expect(error.userMessage).toBe("order.reorder.error.businessUnavailable");
		// The cart is the assertion that matters: this refusal happens *before* the first
		// `cart.addItem`, so no open cart was created pointing at a shop nobody can order
		// from — the orphan this ordering exists to prevent.
		expect(count(test.sqlite, "cart")).toBe(1);
		expect(count(test.sqlite, "cart", "where status = 'OPEN'")).toBe(0);
		expect(openLines(test.sqlite)).toBe(0);

		test.close();
	});

	test("a full basket skips what does not fit instead of failing the whole reorder", async () => {
		const test = world();
		const { shopId, customer, order } = await placed(test);

		// The basket is filled to the cap first, with products the order does not name, so
		// the order's own line has no slot and no merge to fall back on. Without the count
		// taken before the loop, `cart.addItem` would throw "Tu carrito está lleno" and the
		// classifier would report it as a broken option — the wrong reason on the wrong line.
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		for (let index = 0; index < MAX_CART_LINES; index += 1) {
			const filler = await seedProduct(test.db, {
				id: `prd_reorder_filler_${index}`,
				businessId: shopId,
				priceMinor: 100,
			});
			await caller.cart.addItem(
				addToCartInput.parse({ productId: filler.id, quantity: 1 }),
			);
		}

		const result = await caller.orders.reorder({ orderId: order.id });

		expect(result.addedCount).toBe(0);
		expect(result.skipped.map((line) => line.reason)).toEqual([
			"order.reorder.skipped.cartFull",
		]);
		// The basket the customer built is exactly what it was — a reorder that made room by
		// dropping somebody's lines would be a basket emptied without being asked.
		expect(result.cart.items).toHaveLength(MAX_CART_LINES);
		expect(openLines(test.sqlite)).toBe(MAX_CART_LINES);

		test.close();
	});

	test("a basket at another shop refuses, and replaces when told to", async () => {
		const test = world();
		const { customer, order } = await placed(test);

		const otherShop = await seedBusiness(test.db, {
			id: "biz_reorder_other",
			slug: "tienda-otra",
		});
		const bread = await seedProduct(test.db, {
			id: "prd_reorder_bread",
			businessId: otherShop,
			priceMinor: 800,
		});
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		await caller.cart.addItem(
			addToCartInput.parse({ productId: bread.id, quantity: 1 }),
		);

		// `reject` is the schema's default, and the refusal is the same `CONFLICT` with the
		// same `details` an `addItem` produces — one implementation of "one cart, one
		// business", reached through the reorder instead of a tap on "add".
		const error = await refused(caller.orders.reorder({ orderId: order.id }));
		expect(error.code).toBe("CONFLICT");
		expect(error.details).toMatchObject({
			cartBusinessId: otherShop,
			productBusinessId: "biz_reorder_shop",
		});

		const replaced = await caller.orders.reorder({
			orderId: order.id,
			onBusinessConflict: "replace",
		});
		expect(replaced.cart.businessId).toBe("biz_reorder_shop");
		expect(replaced.cart.items.map((item) => item.productId)).toEqual([
			"prd_reorder_coffee",
		]);
		// Carried out of the loop and laid over the returned cart: only the *first* call can
		// replace, and the cart that comes back is the last one, so a flag read off the last
		// cart alone would never reach the notice the client shows.
		expect(replaced.cart.replacedCart).toBe(true);

		test.close();
	});
});
