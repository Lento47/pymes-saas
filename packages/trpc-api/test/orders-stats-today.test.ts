import { describe, expect, test } from "bun:test";
import { addToCartInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * The pulse band's money is today's completed revenue, not a page summed on the
 * phone and not the all-time total.
 *
 * `revenueByCurrency` is every completed order ever — the web dashboard reads it
 * as exactly that and refuses to label it "today". This spec pins the sibling
 * field the merchant home reads: an order counts toward it only once it is
 * COMPLETED, and only on the day it was placed. A PENDING order moves `today`
 * and `active` and nothing else; completing it adds its total under the shop's
 * currency with no second entry and no cross-currency sum.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

async function placedOrder(tag: string) {
	const test = world();
	const shopId = await seedBusiness(test.db, { id: `biz_stats_${tag}` });
	await seedProduct(test.db, {
		id: `prd_stats_${tag}`,
		businessId: shopId,
		priceMinor: 1500,
	});
	const customer = await seedUser(test.db, { id: `usr_stats_${tag}` });
	const buyer = appRouter.createCaller(await authed(test, customer)) as Caller;
	await buyer.cart.addItem(
		addToCartInput.parse({ productId: `prd_stats_${tag}`, quantity: 2 }),
	);
	const order = await buyer.orders.place({
		fulfilment: "PICKUP",
		paymentMethod: "CASH",
		clientRequestId: `req_stats_${tag}`,
	});
	const owner = await seedUser(test.db, { id: `usr_stats_${tag}_owner` });
	await seedMembership(test.db, owner.id, shopId, "OWNER");
	const manager = appRouter.createCaller(await authed(test, owner)) as Caller;
	return { test, order, manager };
}

describe("orders.stats todayRevenueByCurrency", () => {
	test("a placed order counts toward today, never toward revenue", async () => {
		const { test, manager } = await placedOrder("pending");

		const stats = await manager.orders.stats({
			businessId: "biz_stats_pending",
		});

		expect(stats.today).toBe(1);
		expect(stats.active).toBe(1);
		expect(stats.todayRevenueByCurrency).toEqual([]);
		expect(stats.revenueByCurrency).toEqual([]);

		test.close();
	});

	test("completing it books its total under the shop's currency", async () => {
		const { test, order, manager } = await placedOrder("done");
		for (const to of ["ACCEPTED", "PREPARING", "READY", "COMPLETED"] as const) {
			await manager.orders.advance({ orderId: order.id, to });
		}

		const stats = await manager.orders.stats({ businessId: "biz_stats_done" });
		const detail = await manager.orders.byId({ id: order.id });

		expect(stats.today).toBe(1);
		expect(stats.active).toBe(0);
		expect(stats.todayRevenueByCurrency).toEqual([
			{ currency: "CRC", revenueMinor: detail.totalMinor, orderCount: 1 },
		]);
		expect(stats.revenueByCurrency).toEqual([
			{ currency: "CRC", revenueMinor: detail.totalMinor, orderCount: 1 },
		]);

		test.close();
	});
});
