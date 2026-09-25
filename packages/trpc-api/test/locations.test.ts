import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	business as businessTable,
	merchantLocation as locationTable,
} from "@pymeshub/db";
import { addToCartInput, merchantLocationSchema } from "@pymeshub/shared";
import { eq } from "drizzle-orm";

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

test("location migration backfills existing businesses and orders", () => {
	const sqlite = new Database(":memory:");
	try {
		sqlite.exec(
			"create table business (id text primary key, name text not null, line1 text, line2 text, city text, region text, country text, postal_code text, lat real, lng real, created_at integer not null, updated_at integer not null)",
		);
		sqlite.exec(
			'create table "order" (id text primary key, business_id text not null, status text not null, placed_at integer not null)',
		);
		sqlite.exec(
			"insert into business (id, name, city, created_at, updated_at) values ('biz_legacy', 'Tienda de Prueba', 'San José', 1000, 1000)",
		);
		sqlite.exec(
			"insert into \"order\" (id, business_id, status, placed_at) values ('ord_legacy', 'biz_legacy', 'PENDING', 1000)",
		);
		const migration = readFileSync(
			join(
				import.meta.dir,
				"../../../packages/db/migrations/0009_merchant_locations.sql",
			),
			"utf8",
		);
		for (const statement of migration.split("--> statement-breakpoint")) {
			if (statement.trim()) sqlite.exec(statement);
		}
		const location = sqlite
			.prepare("select id, business_id, is_default from merchant_location")
			.get() as { id: string; business_id: string; is_default: number };
		const order = sqlite
			.prepare("select location_id from \"order\" where id = 'ord_legacy'")
			.get() as { location_id: string };
		expect(location).toEqual({
			id: "loc_biz_legacy",
			business_id: "biz_legacy",
			is_default: 1,
		});
		expect(order.location_id).toBe(location.id);
	} finally {
		sqlite.close();
	}
});

test("merchant locations return effective hours for the Costa Rica day", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_location_today_hours",
		});
		const ownerUser = await seedUser(testWorld.db, {
			id: "usr_location_today_hours",
		});
		await seedMembership(testWorld.db, ownerUser.id, businessId, "OWNER");
		const owner = appRouter.createCaller(await authed(testWorld, ownerUser));
		const businessHours = Array.from({ length: 7 }, (_, day) => ({
			day,
			opensMinute: 600,
			closesMinute: 1200,
			isClosed: false,
		}));
		const branchHours = Array.from({ length: 7 }, (_, day) => ({
			day,
			opensMinute: 480,
			closesMinute: 1080,
			isClosed: false,
		}));
		await testWorld.db
			.update(businessTable)
			.set({ hours: businessHours })
			.where(eq(businessTable.id, businessId));
		const branch = merchantLocationSchema.parse(
			await owner.business.createLocation({
				businessId,
				name: "Sucursal de Prueba",
				line1: "Calle de prueba 2",
				city: "San José",
				region: "San José",
				hours: branchHours,
			}),
		);
		expect(branch.todayHours).toEqual({
			opensMinute: 480,
			closesMinute: 1080,
		});
		const locations = await owner.business.locations({ businessId });
		expect(locations.find((row) => row.isDefault)?.todayHours).toEqual({
			opensMinute: 600,
			closesMinute: 1200,
		});
		expect(locations.find((row) => row.id === branch.id)?.todayHours).toEqual(
			branch.todayHours,
		);
		const paused = await owner.business.pauseLocation({
			businessId,
			locationId: branch.id,
			reason: "manual",
		});
		expect(paused.todayHours).toEqual(branch.todayHours);
		const resumed = await owner.business.resumeLocation({
			businessId,
			locationId: branch.id,
		});
		expect(resumed.todayHours).toEqual(branch.todayHours);

		await testWorld.db
			.update(locationTable)
			.set({
				hours: branchHours.map((entry) => ({
					...entry,
					isClosed: true,
				})),
			})
			.where(eq(locationTable.id, branch.id));
		expect(
			(
				await owner.business.locationStatus({
					businessId,
					locationId: branch.id,
				})
			).todayHours,
		).toBeNull();
		await testWorld.db
			.update(businessTable)
			.set({ hours: null })
			.where(eq(businessTable.id, businessId));
		expect(
			(
				await owner.business.locationStatus({
					businessId,
					locationId: `loc_${businessId}`,
				})
			).todayHours,
		).toBeNull();
	} finally {
		testWorld.close();
	}
});

test("a pause committed after checkout's read still aborts its atomic order batch", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_pause_race",
		});
		const locationId = `loc_${businessId}`;
		const ownerUser = await seedUser(testWorld.db, {
			id: "usr_pause_race_owner",
		});
		await seedMembership(testWorld.db, ownerUser.id, businessId, "OWNER");
		const owner = appRouter.createCaller(await authed(testWorld, ownerUser));
		const product = await seedProduct(testWorld.db, {
			businessId,
			id: "prd_pause_race",
		});
		const customer = await seedUser(testWorld.db, {
			id: "usr_pause_race_buyer",
		});
		const buyer = appRouter.createCaller(await authed(testWorld, customer));
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: product.id, quantity: 1 }),
		);

		const originalBatch = testWorld.env.DB.batch.bind(testWorld.env.DB);
		let pausedBetweenReadAndWrite = false;
		testWorld.env.DB.batch = async (statements) => {
			if (!pausedBetweenReadAndWrite) {
				pausedBetweenReadAndWrite = true;
				await owner.business.pauseLocation({
					businessId,
					locationId,
					reason: "capacity",
				});
			}
			return originalBatch(statements);
		};

		const request = {
			fulfilment: "PICKUP" as const,
			paymentMethod: "CASH" as const,
			clientRequestId: "req_pause_race_0001",
		};
		expect((await refused(buyer.orders.place(request))).code).toBe(
			"BAD_REQUEST",
		);
		expect(pausedBetweenReadAndWrite).toBe(true);
		expect(
			(
				testWorld.sqlite.prepare('select count(*) as n from "order"').get() as {
					n: number;
				}
			).n,
		).toBe(0);
		expect(
			(
				testWorld.sqlite
					.prepare(
						"select count(*) as n from notification where kind = 'ORDER_REQUEST'",
					)
					.get() as { n: number }
			).n,
		).toBe(0);
		expect((await buyer.cart.get()).items).toHaveLength(1);

		testWorld.env.DB.batch = originalBatch;
		await owner.business.resumeLocation({ businessId, locationId });
		const placed = await buyer.orders.place(request);
		expect(placed.locationId).toBe(locationId);
	} finally {
		testWorld.close();
	}
});

test("a merchant can pause one owned location; the server computes resume and checkout respects it", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_location_one",
		});
		const otherBusinessId = await seedBusiness(testWorld.db, {
			id: "biz_location_other",
		});
		const ownerUser = await seedUser(testWorld.db, {
			id: "usr_location_owner",
		});
		await seedMembership(testWorld.db, ownerUser.id, businessId, "OWNER");
		const owner = appRouter.createCaller(await authed(testWorld, ownerUser));
		const locationId = `loc_${businessId}`;
		const otherLocationId = `loc_${otherBusinessId}`;

		const newLocation = merchantLocationSchema.parse(
			await owner.business.createLocation({
				businessId,
				name: "Sucursal Norte",
				line1: "Calle de prueba 2",
				city: "San José",
				region: "San José",
			}),
		);
		expect(newLocation.businessId).toBe(businessId);
		expect(newLocation.isDefault).toBe(false);
		await owner.business.update({ businessId, line1: "Calle de prueba 1" });
		expect(
			(await owner.business.locationStatus({ businessId, locationId })).line1,
		).toBe("Calle de prueba 1");
		expect(
			(
				await owner.business.locationStatus({
					businessId,
					locationId: newLocation.id,
				})
			).line1,
		).toBe("Calle de prueba 2");
		expect(
			(await owner.business.locations({ businessId })).map((row) => row.id),
		).toEqual([locationId, newLocation.id]);
		expect(
			(
				await refused(
					owner.business.locationStatus({
						businessId,
						locationId: otherLocationId,
					}),
				)
			).code,
		).toBe("NOT_FOUND");
		expect(
			(
				await refused(
					owner.business.pauseLocation({
						businessId: otherBusinessId,
						locationId,
						reason: "manual",
					}),
				)
			).code,
		).toBe("FORBIDDEN");

		const before = Date.now();
		const paused = merchantLocationSchema.parse(
			await owner.business.pauseLocation({
				businessId,
				locationId,
				reason: "capacity",
				durationMinutes: 30,
			}),
		);
		const after = Date.now();
		expect(paused.status).toBe("paused_capacity");
		expect(paused.pausedAt?.getTime()).toBeGreaterThanOrEqual(before);
		expect(paused.pausedAt?.getTime()).toBeLessThanOrEqual(after);
		expect(paused.resumeAt?.getTime()).toBe(
			(paused.pausedAt?.getTime() ?? 0) + 30 * 60_000,
		);
		expect(
			(
				await owner.business.locationStatus({
					businessId,
					locationId: newLocation.id,
				})
			).status,
		).toBe("open");

		const product = await seedProduct(testWorld.db, {
			businessId,
			id: "prd_location",
		});
		const customer = await seedUser(testWorld.db, { id: "usr_location_buyer" });
		const buyer = appRouter.createCaller(await authed(testWorld, customer));
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: product.id, quantity: 1 }),
		);
		const orderInput = {
			fulfilment: "PICKUP" as const,
			paymentMethod: "CASH" as const,
			clientRequestId: "req_location_0001",
		};
		expect((await refused(buyer.orders.place(orderInput))).code).toBe(
			"BAD_REQUEST",
		);
		expect(
			(await refused(buyer.orders.place({ ...orderInput, locationId }))).code,
		).toBe("BAD_REQUEST");
		expect(
			(
				await refused(
					buyer.orders.place({ ...orderInput, locationId: otherLocationId }),
				)
			).code,
		).toBe("BAD_REQUEST");

		const placed = await buyer.orders.place({
			...orderInput,
			locationId: newLocation.id,
		});
		expect(placed.locationId).toBe(newLocation.id);
		const stored = testWorld.sqlite
			.prepare('select location_id from "order" where id = ?')
			.get(placed.id) as { location_id: string };
		expect(stored.location_id).toBe(newLocation.id);
		const branchOrders = await owner.orders.queue({
			role: "BUSINESS",
			businessId,
			locationId: newLocation.id,
		});
		expect(branchOrders.items.map((order) => order.id)).toEqual([placed.id]);
		expect(
			(await owner.orders.stats({ businessId, locationId: newLocation.id }))
				.active,
		).toBe(1);
		expect((await owner.orders.stats({ businessId, locationId })).active).toBe(
			0,
		);
		expect(
			(
				await owner.orders.queue({
					role: "BUSINESS",
					businessId,
					locationId,
				})
			).items,
		).toEqual([]);
		expect(
			(
				await refused(
					owner.orders.queue({
						role: "BUSINESS",
						businessId,
						locationId: otherLocationId,
					}),
				)
			).code,
		).toBe("NOT_FOUND");
		expect(
			(
				await refused(
					owner.orders.stats({
						businessId,
						locationId: otherLocationId,
					}),
				)
			).code,
		).toBe("NOT_FOUND");

		const resumed = await owner.business.resumeLocation({
			businessId,
			locationId,
		});
		expect(resumed.status).toBe("open");
		expect(resumed.resumeAt).toBeNull();
		const actions = testWorld.sqlite
			.prepare(
				"select action from audit_log where target_id = ? order by created_at",
			)
			.all(locationId) as { action: string }[];
		expect(actions.map((row) => row.action)).toEqual([
			"LOCATION_PAUSED",
			"LOCATION_RESUMED",
		]);
	} finally {
		testWorld.close();
	}
});

test("expired pauses resume by server time; staff cannot pause and suspended shops stay suspended", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_location_state",
		});
		const locationId = `loc_${businessId}`;
		const managerUser = await seedUser(testWorld.db, {
			id: "usr_location_manager",
		});
		const staffUser = await seedUser(testWorld.db, {
			id: "usr_location_staff",
		});
		await seedMembership(testWorld.db, managerUser.id, businessId, "MANAGER");
		await seedMembership(testWorld.db, staffUser.id, businessId, "STAFF");
		const manager = appRouter.createCaller(
			await authed(testWorld, managerUser),
		);
		const staff = appRouter.createCaller(await authed(testWorld, staffUser));
		expect(
			(
				await refused(
					staff.business.pauseLocation({
						businessId,
						locationId,
						reason: "manual",
					}),
				)
			).code,
		).toBe("FORBIDDEN");
		const paused = await manager.business.pauseLocation({
			businessId,
			locationId,
			reason: "manual",
		});
		expect(paused.status).toBe("paused_manual");
		expect(paused.resumeAt).toBeNull();
		await testWorld.db
			.update(locationTable)
			.set({ resumeAt: new Date(Date.now() - 1) })
			.where(eq(locationTable.id, locationId));
		const expired = await manager.business.locationStatus({
			businessId,
			locationId,
		});
		expect(expired.status).toBe("open");
		expect(expired.pausedAt).toBeNull();

		await testWorld.db
			.update(locationTable)
			.set({ pauseReason: "platform", pausedAt: new Date(), resumeAt: null })
			.where(eq(locationTable.id, locationId));
		expect(
			(await manager.business.locationStatus({ businessId, locationId }))
				.status,
		).toBe("paused_platform");
		expect(
			(
				await refused(
					manager.business.resumeLocation({ businessId, locationId }),
				)
			).code,
		).toBe("FORBIDDEN");
		expect(
			(
				await refused(
					manager.business.pauseLocation({
						businessId,
						locationId,
						reason: "manual",
					}),
				)
			).code,
		).toBe("FORBIDDEN");

		await testWorld.db
			.update(locationTable)
			.set({ pauseReason: null, pausedAt: null, isOffline: true })
			.where(eq(locationTable.id, locationId));
		expect(
			(await manager.business.locationStatus({ businessId, locationId }))
				.status,
		).toBe("offline");
		await testWorld.db
			.update(locationTable)
			.set({
				isOffline: false,
				hours: Array.from({ length: 7 }, (_, day) => ({
					day,
					opensMinute: 0,
					closesMinute: 0,
					isClosed: true,
				})),
			})
			.where(eq(locationTable.id, locationId));
		expect(
			(await manager.business.locationStatus({ businessId, locationId }))
				.status,
		).toBe("closed_schedule");

		testWorld.sqlite
			.prepare("update business set status = 'SUSPENDED' where id = ?")
			.run(businessId);
		expect(
			(await manager.business.locationStatus({ businessId, locationId }))
				.status,
		).toBe("suspended");
	} finally {
		testWorld.close();
	}
});
