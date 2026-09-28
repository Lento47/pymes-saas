import { describe, expect, test } from "bun:test";
import {
	type Db,
	merchantLocation as locationTable,
	order as orderTable,
} from "@pymeshub/db";
import { addToCartInput, startOfMarketDay } from "@pymeshub/shared";

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

type SeededOrderInput = {
	id: string;
	reference: string;
	customerId: string;
	businessId: string;
	locationId: string;
	status: "COMPLETED" | "PENDING" | "CANCELLED";
	currency: "CRC" | "USD";
	totalMinor: number;
	placedAt: Date;
};

async function insertOrder(db: Db, input: SeededOrderInput) {
	const now = new Date();
	await db.insert(orderTable).values({
		id: input.id,
		reference: input.reference,
		customerId: input.customerId,
		businessId: input.businessId,
		locationId: input.locationId,
		fulfilment: "PICKUP",
		status: input.status,
		paymentMethod: "CASH",
		currency: input.currency,
		subtotalMinor: input.totalMinor,
		discountMinor: 0,
		totalMinor: input.totalMinor,
		placedAt: input.placedAt,
		createdAt: now,
		updatedAt: now,
	});
}

async function comparisonFixture() {
	const test = world();
	const businessId = await seedBusiness(test.db, {
		id: "biz_stats_comparison",
	});
	const primaryLocationId = `loc_${businessId}`;
	const secondaryLocationId = "loc_stats_comparison_secondary";
	await test.db.insert(locationTable).values({
		id: secondaryLocationId,
		businessId,
		name: "Sucursal secundaria",
		isDefault: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	const owner = await seedUser(test.db, { id: "usr_stats_comparison_owner" });
	await seedMembership(test.db, owner.id, businessId, "OWNER");
	const customer = await seedUser(test.db, {
		id: "usr_stats_comparison_customer",
	});
	const manager = appRouter.createCaller(await authed(test, owner)) as Caller;

	const foreignBusinessId = await seedBusiness(test.db, {
		id: "biz_stats_comparison_foreign",
	});

	const todayStart = startOfMarketDay(new Date());
	const previousStart = new Date(todayStart.getTime() - 86_400_000);
	const previousAt = new Date(previousStart.getTime() + 3_600_000);
	const todayAt = new Date(todayStart.getTime() + 3_600_000);

	for (const input of [
		{
			id: "ord_stats_comparison_prev_crc_1",
			reference: "ref_stats_comparison_prev_crc_1",
			customerId: customer.id,
			businessId,
			locationId: primaryLocationId,
			status: "COMPLETED",
			currency: "CRC",
			totalMinor: 1000,
			placedAt: previousAt,
		},
		{
			id: "ord_stats_comparison_prev_crc_2",
			reference: "ref_stats_comparison_prev_crc_2",
			customerId: customer.id,
			businessId,
			locationId: primaryLocationId,
			status: "COMPLETED",
			currency: "CRC",
			totalMinor: 1000,
			placedAt: previousAt,
		},
		{
			id: "ord_stats_comparison_prev_crc_cancelled",
			reference: "ref_stats_comparison_prev_crc_cancelled",
			customerId: customer.id,
			businessId,
			locationId: primaryLocationId,
			status: "CANCELLED",
			currency: "CRC",
			totalMinor: 9000,
			placedAt: previousAt,
		},
		{
			id: "ord_stats_comparison_prev_usd",
			reference: "ref_stats_comparison_prev_usd",
			customerId: customer.id,
			businessId,
			locationId: primaryLocationId,
			status: "COMPLETED",
			currency: "USD",
			totalMinor: 500,
			placedAt: previousAt,
		},
		{
			id: "ord_stats_comparison_today_crc",
			reference: "ref_stats_comparison_today_crc",
			customerId: customer.id,
			businessId,
			locationId: primaryLocationId,
			status: "COMPLETED",
			currency: "CRC",
			totalMinor: 4000,
			placedAt: todayAt,
		},
		{
			id: "ord_stats_comparison_today_crc_pending",
			reference: "ref_stats_comparison_today_crc_pending",
			customerId: customer.id,
			businessId,
			locationId: primaryLocationId,
			status: "PENDING",
			currency: "CRC",
			totalMinor: 8000,
			placedAt: todayAt,
		},
		{
			id: "ord_stats_comparison_today_secondary",
			reference: "ref_stats_comparison_today_secondary",
			customerId: customer.id,
			businessId,
			locationId: secondaryLocationId,
			status: "COMPLETED",
			currency: "CRC",
			totalMinor: 7000,
			placedAt: todayAt,
		},
		{
			id: "ord_stats_comparison_today_foreign",
			reference: "ref_stats_comparison_today_foreign",
			customerId: customer.id,
			businessId: foreignBusinessId,
			locationId: `loc_${foreignBusinessId}`,
			status: "COMPLETED",
			currency: "CRC",
			totalMinor: 100000,
			placedAt: todayAt,
		},
	] satisfies SeededOrderInput[]) {
		await insertOrder(test.db, input);
	}

	return { test, businessId, primaryLocationId, manager };
}

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

describe("orders.stats todayComparisonByCurrency", () => {
	test("compares completed revenue and orders across marketplace days", async () => {
		const { test, businessId, primaryLocationId, manager } =
			await comparisonFixture();

		const stats = await manager.orders.stats({
			businessId,
			locationId: primaryLocationId,
		});

		expect(stats.today).toBe(2);
		expect(stats.todayRevenueByCurrency).toEqual([
			{ currency: "CRC", revenueMinor: 4000, orderCount: 1 },
		]);
		expect(stats.todayComparisonByCurrency).toEqual([
			{
				currency: "CRC",
				salesDeltaPct: 100,
				ordersDelta: -1,
				ticketDeltaPct: 300,
			},
			{
				currency: "USD",
				salesDeltaPct: -100,
				ordersDelta: -1,
				ticketDeltaPct: null,
			},
		]);

		test.close();
	});

	test("uses null when yesterday had no completed baseline", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_stats_comparison_zero",
		});
		const locationId = `loc_${businessId}`;
		const owner = await seedUser(test.db, {
			id: "usr_stats_comparison_zero_owner",
		});
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		const customer = await seedUser(test.db, {
			id: "usr_stats_comparison_zero_customer",
		});
		const manager = appRouter.createCaller(await authed(test, owner)) as Caller;
		const todayStart = startOfMarketDay(new Date());
		const previousAt = new Date(todayStart.getTime() - 82_800_000);
		const todayAt = new Date(todayStart.getTime() + 3_600_000);

		await insertOrder(test.db, {
			id: "ord_stats_comparison_zero_previous",
			reference: "ref_stats_comparison_zero_previous",
			customerId: customer.id,
			businessId,
			locationId,
			status: "CANCELLED",
			currency: "CRC",
			totalMinor: 9000,
			placedAt: previousAt,
		});
		await insertOrder(test.db, {
			id: "ord_stats_comparison_zero_today",
			reference: "ref_stats_comparison_zero_today",
			customerId: customer.id,
			businessId,
			locationId,
			status: "COMPLETED",
			currency: "CRC",
			totalMinor: 4000,
			placedAt: todayAt,
		});

		const stats = await manager.orders.stats({ businessId, locationId });

		expect(stats.todayComparisonByCurrency).toEqual([
			{
				currency: "CRC",
				salesDeltaPct: null,
				ordersDelta: 1,
				ticketDeltaPct: null,
			},
		]);

		test.close();
	});
});
