import { expect, test } from "bun:test";
import {
	type Db,
	orderItem as orderItemTable,
	order as orderTable,
} from "@pymeshub/db";
import { businessAnalyticsSchema } from "@pymeshub/shared";

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
	},
) {
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
		placedAt,
		acceptedAt: input.acceptedAt,
		readyAt: input.readyAt,
		createdAt: placedAt,
		updatedAt: placedAt,
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
			from: new Date("2026-09-20T00:00:00.000Z"),
			to: new Date("2026-09-20T23:59:59.999Z"),
		};
		const analytics = businessAnalyticsSchema.parse(
			await owner.business.analytics({
				...window,
				locationId: firstLocationId,
			}),
		);
		expect(analytics.orders).toEqual({
			total: 2,
			accepted: 1,
			completed: 1,
			cancelled: 0,
			active: 1,
		});
		expect(analytics.sales).toEqual({
			refunds_minor: 1900,
			discounts_minor: 150,
		});
		expect(analytics.revenue).toEqual({ grossMinor: 2850, netMinor: 950 });
		expect(analytics.operations).toEqual({
			avg_accept_seconds: 60,
			avg_preparation_seconds: 180,
		});
		expect(analytics.averageOrderMinor).toBe(1425);
		expect(analytics.customers).toEqual({ total: 1, repeat: 1 });
		expect(analytics.ordersByDay).toEqual([
			{ day: "2026-09-20", orderCount: 2, revenueMinor: 2850 },
		]);
		expect(analytics.topProducts).toEqual([
			{
				productId: firstProduct.id,
				name: `Producto ${firstProduct.id}`,
				quantity: 2,
				revenueMinor: 3000,
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
