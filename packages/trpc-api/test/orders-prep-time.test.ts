import { describe, expect, test } from "bun:test";
import { addToCartInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import { effectivePrepTimeMinutes } from "../src/services/orders";
import { authed, seedBusiness, seedProduct, seedUser, world } from "./harness";

/**
 * Preparation time is per product, with the shop as the fallback.
 *
 * The kitchen works in parallel, so the longest line sets the wait — and a
 * line whose product carries no value inherits the shop default, which means
 * explicit values can only raise an estimate above what the shop promises.
 * Both estimate paths (`orders.track` and the summaries behind every list)
 * read through this one rule rather than each owning an average.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const CASH = "CASH" as const;

describe("effectivePrepTimeMinutes", () => {
	test("no lines is the shop default", () => {
		expect(effectivePrepTimeMinutes([], 25)).toBe(25);
	});

	test("a line without a value inherits the shop default", () => {
		expect(effectivePrepTimeMinutes([null, null], 25)).toBe(25);
	});

	test("the longest line wins, never the average", () => {
		expect(effectivePrepTimeMinutes([10, 60, 20], 25)).toBe(60);
	});

	test("explicit values can only raise, never lower", () => {
		expect(effectivePrepTimeMinutes([null, 10], 25)).toBe(25);
	});

	test("nothing anywhere is nothing", () => {
		expect(effectivePrepTimeMinutes([], null)).toBe(null);
		expect(effectivePrepTimeMinutes([null], null)).toBe(null);
	});
});

describe("an order's estimate", () => {
	async function readyInMinutes(
		test: Test,
		productPrep: number | null,
	): Promise<number | null> {
		const shopId = await seedBusiness(test.db);
		const product = await seedProduct(test.db, {
			businessId: shopId,
			prepTimeMinutes: productPrep,
		});
		const customer = await seedUser(test.db, { id: "usr_test_customer" });
		const customerCaller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		await customerCaller.cart.addItem(
			addToCartInput.parse({ productId: product.id, quantity: 1 }),
		);
		const order = await customerCaller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: `req_prep_${productPrep ?? "none"}_000001`,
		});
		const [detail, track] = await Promise.all([
			customerCaller.orders.byId({ id: order.id }),
			customerCaller.orders.track({ id: order.id }),
		]);
		if (track.estimatedReadyAt === null) return null;
		// Freshly placed, nothing accepted yet: the anchor is the placement.
		expect(detail.placedAt).toBeInstanceOf(Date);
		return (
			(track.estimatedReadyAt.getTime() - detail.placedAt.getTime()) / 60_000
		);
	}

	test("a product's own time raises the estimate above the shop default", async () => {
		// The shop promises 25 (`seedBusiness`); the gallo pinto needs 60.
		await expect(readyInMinutes(world(), 60)).resolves.toBe(60);
	});

	test("a product without a time inherits the shop default", async () => {
		await expect(readyInMinutes(world(), null)).resolves.toBe(25);
	});
});
