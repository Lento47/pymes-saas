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
 * Placing an order: one order per intent, and every price read from the rows.
 *
 * Two claims, both of which are money:
 *
 * 1. **Idempotent on `clientRequestId`.** A double-tapped "pay", or a retry after a dropped
 *    connection, must produce one order. The mechanism is a unique index on the ledger row
 *    and `onConflictDoNothing().returning()` — the loser of the race gets an empty result
 *    and reads back the winner's order — so what this spec checks is that the second call
 *    returns the *first* order rather than a second one.
 *
 * 2. **The client does not price anything.** `placeOrderInput` has no price field, and the
 *    stored `order_item.unit_price_minor` is the product row's price plus the option rows'
 *    deltas. A test that only checked the total would pass against a service that echoed a
 *    number from the request, so this one reads the rows back and compares them to the
 *    product — and sends a price in the payload to prove it is discarded.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const CASH = "CASH" as const;

/** A shop, a customer, and a basket priced at 1500 with a 250 option. */
async function basket(test: Test, quantity = 1) {
	const shopId = await seedBusiness(test.db);
	const product = await seedProduct(test.db, {
		businessId: shopId,
		priceMinor: 1500,
		optionDeltaMinor: 250,
	});
	const customer = await seedUser(test.db, { id: "usr_place_customer" });
	const caller = appRouter.createCaller(await authed(test, customer)) as Caller;

	await caller.cart.addItem(
		addToCartInput.parse({
			productId: product.id,
			quantity,
			optionIds: product.optionId ? [product.optionId] : [],
		}),
	);

	return { shopId, product, customer, caller };
}

function count(sqlite: Test["sqlite"], table: string, where = ""): number {
	const row = sqlite
		.prepare(`select count(*) as n from "${table}" ${where}`)
		.get() as { n: number };
	return row.n;
}

describe("placing an order", () => {
	test("the same clientRequestId twice produces one order, not two", async () => {
		const test = world();
		const { caller } = await basket(test, 2);

		const first = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_place_000001",
		});
		expect(first.status).toBe("PENDING");
		expect(count(test.sqlite, "order")).toBe(1);

		// The retry. Not a `ConflictError` and not a second order: the ledger row is the
		// same row, the claim on it fails, and the winner's order is what comes back.
		const second = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_place_000001",
		});
		expect(second.id).toBe(first.id);
		expect(second.pickupCode).toBe(first.pickupCode ?? second.pickupCode);

		// One order, one line, one event, one announcement.
		expect(count(test.sqlite, "order")).toBe(1);
		expect(count(test.sqlite, "order_item")).toBe(1);
		expect(test.sent.map((event) => event.type)).toEqual(["ORDER_PLACED"]);
		expect(test.published).toHaveLength(1);

		test.close();
	});

	test("the request's own price is discarded; the stored price is the rows'", async () => {
		const test = world();
		const { caller, product } = await basket(test, 2);

		const order = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_place_000002",
			// A payload a hostile client would send. `placeOrderInput` has no price field, so
			// zod drops these before the service sees them — which is the point: the field
			// cannot reach the pricing code, and the rows below prove it did not.
			priceMinor: 1,
			totalMinor: 1,
			items: [{ productId: product.id, unitPriceMinor: 1, quantity: 2 }],
		} as never);

		// 1500 from the product row plus 250 from the option row, times two.
		const line = test.sqlite
			.prepare(
				"select unit_price_minor, quantity, line_total_minor from order_item where order_id = ?",
			)
			.get(order.id) as {
			unit_price_minor: number;
			quantity: number;
			line_total_minor: number;
		};
		expect(line.unit_price_minor).toBe(1750);
		expect(line.quantity).toBe(2);
		expect(line.line_total_minor).toBe(3500);

		// And the order's own row agrees, in CRC, with no division anywhere: ₡3 500 is
		// `3500`, not `350000` and not `35`.
		const row = test.sqlite
			.prepare(
				'select subtotal_minor, total_minor, currency from "order" where id = ?',
			)
			.get(order.id) as {
			subtotal_minor: number;
			total_minor: number;
			currency: string;
		};
		expect(row.subtotal_minor).toBe(3500);
		expect(row.total_minor).toBe(3500);
		expect(row.currency).toBe("CRC");

		// The detail the customer reads carries the same numbers, from the same rows.
		expect(order.items[0]?.unitPriceMinor).toBe(1750);
		expect(order.items[0]?.lineTotalMinor).toBe(3500);
		expect(order.totals.totalMinor).toBe(3500);

		test.close();
	});

	test("a tip is added server-side, and the total is the sum of the parts", async () => {
		const test = world();
		const { caller } = await basket(test, 1);

		const order = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_place_000003",
			tipMinor: 500,
		});

		expect(order.totals).toMatchObject({
			subtotalMinor: 1750,
			tipMinor: 500,
			totalMinor: 2250,
			currency: "CRC",
		});

		test.close();
	});

	test("an option belonging to another product is refused, not silently dropped", async () => {
		const test = world();
		const shopId = await seedBusiness(test.db, { id: "biz_option_shop" });
		const other = await seedProduct(test.db, {
			id: "prd_option_other",
			businessId: shopId,
			optionDeltaMinor: 900,
		});
		const plain = await seedProduct(test.db, {
			id: "prd_option_plain",
			businessId: shopId,
		});
		const customer = await seedUser(test.db, { id: "usr_option_customer" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		// Dropping the unknown id would price the line as a plain item — the customer would
		// be charged for something they did not order and shown a total they did not agree
		// to. The refusal names the whole class: "one of the options is no longer available".
		const error = await refused(
			caller.cart.addItem(
				addToCartInput.parse({
					productId: plain.id,
					quantity: 1,
					optionIds: [other.optionId ?? ""],
				}),
			),
		);
		expect(error.code).toBe("BAD_REQUEST");
		expect(count(test.sqlite, "cart_item")).toBe(0);

		test.close();
	});

	test("an order below the shop's minimum is refused before anything is written", async () => {
		const test = world();
		const shopId = await seedBusiness(test.db, { id: "biz_min_shop" });
		await seedProduct(test.db, {
			id: "prd_min_item",
			businessId: shopId,
			priceMinor: 900,
		});
		// The minimum lives on the business, not in the input: a client cannot lower it.
		test.sqlite
			.prepare("update business set min_order_minor = 5000 where id = ?")
			.run(shopId);

		const customer = await seedUser(test.db, { id: "usr_min_customer" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		await caller.cart.addItem(
			addToCartInput.parse({ productId: "prd_min_item", quantity: 1 }),
		);

		const error = await refused(
			caller.orders.place({
				fulfilment: "PICKUP",
				paymentMethod: CASH,
				clientRequestId: "req_place_000004",
			}),
		);
		expect(error.code).toBe("BAD_REQUEST");
		expect(error.details).toMatchObject({ minimumMinor: 5000 });
		expect(count(test.sqlite, "order")).toBe(0);

		// And the id is still usable. A refusal that consumed the `clientRequestId` would
		// leave the customer permanently unable to retry the order they were told to fix:
		// the ledger row would exist with no order behind it, and every later attempt would
		// answer "your previous order did not finish" — the retry the error asks for could
		// never succeed. So the same id, after the basket is topped up, must place.
		expect(count(test.sqlite, "notification")).toBe(0);

		const cart = await caller.cart.get();
		await caller.cart.updateItem({
			cartItemId: cart.items[0]?.id ?? "",
			quantity: 6,
		});
		const placed = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_place_000004",
		});
		expect(placed.status).toBe("PENDING");
		expect(placed.totals.subtotalMinor).toBe(5400);
		expect(count(test.sqlite, "order")).toBe(1);

		test.close();
	});
});
