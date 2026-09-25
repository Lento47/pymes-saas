import { expect, test } from "bun:test";
import {
	type Db,
	orderItem as orderItemTable,
	order as orderTable,
} from "@pymeshub/db";
import { businessAnalyticsSchema, MARKET_TIME_ZONE } from "@pymeshub/shared";

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

const placedAt = new Date("2026-09-20T12:00:00.000Z");

async function addOrder(
	db: Db,
	input: {
		id: string;
		businessId: string;
		locationId: string;
		customerId: string;
		productId: string;
		status: typeof orderTable.$inferInsert.status;
		paymentStatus?: typeof orderTable.$inferInsert.paymentStatus;
		subtotalMinor: number;
		discountMinor?: number;
		totalMinor: number;
		acceptedAt?: Date;
		readyAt?: Date;
		placedAt?: Date;
	},
) {
	const orderPlacedAt = input.placedAt ?? placedAt;
	await db.insert(orderTable).values({
		id: input.id,
		reference: `REF-${input.id}`,
		businessId: input.businessId,
		locationId: input.locationId,
		customerId: input.customerId,
		fulfilment: "PICKUP",
		status: input.status,
		paymentMethod: "CASH",
		paymentStatus: input.paymentStatus ?? "PAID",
		currency: "CRC",
		subtotalMinor: input.subtotalMinor,
		discountMinor: input.discountMinor ?? 0,
		totalMinor: input.totalMinor,
		placedAt: orderPlacedAt,
		acceptedAt: input.acceptedAt,
		readyAt: input.readyAt,
		createdAt: orderPlacedAt,
		updatedAt: orderPlacedAt,
	});
	await db.insert(orderItemTable).values({
		id: `itm_${input.id}`,
		orderId: input.id,
		productId: input.productId,
		nameSnapshot: `Producto ${input.productId}`,
		quantity: 1,
		unitPriceMinor: input.subtotalMinor,
		lineTotalMinor: input.subtotalMinor,
	});
}

test("analytics scopes every aggregate to its location and refuses foreign locations", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_analytics",
		});
		const foreignBusinessId = await seedBusiness(testWorld.db, {
			id: "biz_analytics_foreign",
		});
		const ownerUser = await seedUser(testWorld.db, {
			id: "usr_analytics_owner",
		});
		const customer = await seedUser(testWorld.db, {
			id: "usr_analytics_buyer",
		});
		await seedMembership(testWorld.db, ownerUser.id, businessId, "OWNER");
		const owner = appRouter.createCaller(await authed(testWorld, ownerUser));
		const secondLocation = await owner.business.createLocation({
			businessId,
			name: "Sucursal Dos",
			line1: "Calle de Prueba 2",
			city: "Ciudad de Prueba",
			region: "Provincia de Prueba",
		});
		const firstLocationId = `loc_${businessId}`;
		const firstProduct = await seedProduct(testWorld.db, {
			id: "prd_analytics_first",
			businessId,
		});
		const secondProduct = await seedProduct(testWorld.db, {
			id: "prd_analytics_second",
			businessId,
		});

		await addOrder(testWorld.db, {
			id: "ord_analytics_refund",
			businessId,
			locationId: firstLocationId,
			customerId: customer.id,
			productId: firstProduct.id,
			status: "COMPLETED",
			paymentStatus: "REFUNDED",
			subtotalMinor: 2000,
			discountMinor: 100,
			totalMinor: 1900,
			acceptedAt: new Date(placedAt.getTime() + 60_000),
			readyAt: new Date(placedAt.getTime() + 240_000),
		});
		await addOrder(testWorld.db, {
			id: "ord_analytics_active",
			businessId,
			locationId: firstLocationId,
			customerId: customer.id,
			productId: firstProduct.id,
			status: "PENDING",
			subtotalMinor: 1000,
			discountMinor: 50,
			totalMinor: 950,
		});
		// This is still September 20 at 23:30 in Costa Rica.
		await addOrder(testWorld.db, {
			id: "ord_analytics_late",
			businessId,
			locationId: firstLocationId,
			customerId: customer.id,
			productId: firstProduct.id,
			status: "COMPLETED",
			subtotalMinor: 700,
			totalMinor: 700,
			placedAt: new Date("2026-09-21T05:30:00.000Z"),
		});
		await addOrder(testWorld.db, {
			id: "ord_analytics_second",
			businessId,
			locationId: secondLocation.id,
			customerId: customer.id,
			productId: secondProduct.id,
			status: "COMPLETED",
			subtotalMinor: 9000,
			totalMinor: 9000,
			acceptedAt: new Date(placedAt.getTime() + 10_000),
			readyAt: new Date(placedAt.getTime() + 30_000),
		});
		await addOrder(testWorld.db, {
			id: "ord_analytics_rejected",
			businessId,
			locationId: secondLocation.id,
			customerId: customer.id,
			productId: secondProduct.id,
			status: "REJECTED",
			subtotalMinor: 5000,
			totalMinor: 5000,
		});

		const window = {
			businessId,
			from: new Date("2026-09-20T06:00:00.000Z"),
			to: new Date("2026-09-21T05:59:59.999Z"),
			timezone: MARKET_TIME_ZONE,
		} as const;
		const analytics = businessAnalyticsSchema.parse(
			await owner.business.analytics({
				...window,
				locationId: firstLocationId,
			}),
		);
		expect(analytics.orders).toEqual({
			total: 3,
			accepted: 1,
			completed: 2,
			cancelled: 0,
			active: 1,
		});
		expect(analytics.sales).toEqual({
			refunds_minor: 1900,
			discounts_minor: 100,
		});
		expect(analytics.revenue).toEqual({ grossMinor: 2600, netMinor: 700 });
		expect(analytics.operations).toEqual({
			avg_accept_seconds: 60,
			avg_preparation_seconds: 180,
		});
		expect(analytics.averageOrderMinor).toBe(1300);
		expect(analytics.customers).toEqual({ total: 1, repeat: 1 });
		expect(analytics.ordersByDay).toEqual([
			{ day: "2026-09-20", orderCount: 3, revenueMinor: 2600 },
		]);
		// The same window at the other two granularities: hourly splits the three orders
		// by their Costa Rica wall hour (06:00 for two, 23:30 for the late one — still
		// September 20), and monthly folds them into the month's single bucket.
		const hourly = businessAnalyticsSchema.parse(
			await owner.business.analytics({
				...window,
				locationId: firstLocationId,
				granularity: "hour",
			}),
		);
		expect(hourly.ordersByDay).toEqual([
			{ day: "2026-09-20 06:00", orderCount: 2, revenueMinor: 1900 },
			// The bucket truncates to the hour — the order itself placed at 23:30.
			{ day: "2026-09-20 23:00", orderCount: 1, revenueMinor: 700 },
		]);
		const monthly = businessAnalyticsSchema.parse(
			await owner.business.analytics({
				...window,
				locationId: firstLocationId,
				granularity: "month",
			}),
		);
		expect(monthly.ordersByDay).toEqual([
			{ day: "2026-09", orderCount: 3, revenueMinor: 2600 },
		]);
		expect(analytics.topProducts).toEqual([
			{
				productId: firstProduct.id,
				name: `Producto ${firstProduct.id}`,
				quantity: 2,
				revenueMinor: 2700,
			},
		]);
		const second = businessAnalyticsSchema.parse(
			await owner.business.analytics({
				...window,
				locationId: secondLocation.id,
			}),
		);
		expect(second.orders).toMatchObject({ total: 2, cancelled: 1, active: 0 });
		expect(second.revenue).toEqual({ grossMinor: 9000, netMinor: 9000 });
		expect(second.topProducts.map((product) => product.productId)).toEqual([
			secondProduct.id,
		]);

		const foreignLocation = await refused(
			owner.business.analytics({
				...window,
				locationId: `loc_${foreignBusinessId}`,
			}),
		);
		expect(foreignLocation.code).toBe("NOT_FOUND");
		const foreignTenant = await refused(
			owner.business.analytics({
				...window,
				businessId: foreignBusinessId,
				locationId: `loc_${foreignBusinessId}`,
			}),
		);
		expect(foreignTenant.code).toBe("FORBIDDEN");
	} finally {
		testWorld.close();
	}
});
