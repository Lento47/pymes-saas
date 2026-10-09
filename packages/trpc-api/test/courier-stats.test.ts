import { describe, expect, test } from "bun:test";
import {
	courierProfile,
	delivery as deliveryTable,
	deliveryRating as ratingTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";

import type { MirrorUser } from "../src/context";
import { appRouter } from "../src/routers";
import {
	authed,
	daysAgo,
	seedBusiness,
	seedOrder,
	seedUser,
	world,
} from "./harness";

/** A caller for one user, the way `test/deliveries.test.ts`'s fixtures build one. */
async function callerFor(test: Parameters<typeof authed>[0], user: MirrorUser) {
	return appRouter.createCaller(await authed(test, user));
}

/**
 * `couriers.stats`: the pool's own ranking numbers, read back for the courier they rank.
 *
 * `candidateFor` (`src/services/delivery-dispatch.ts`) orders the delivery pool by how many runs
 * a courier is already carrying, the rating customers have given them, and how long since they
 * were last offered anything. A business chooses on those numbers. Nothing showed any of them to
 * the person they are about — so a courier could be passed over for a ranking they had no way to
 * see, and this is the read that closes that.
 *
 * ## The thirty-one test is the one that matters
 *
 * `deliveries.mine` is capped at `.limit(30)` (`src/services/deliveries.ts:411`), so any count
 * taken from it reads "30" forever after a courier's thirtieth run — roughly their first month.
 * `deliveredTotal` is therefore a real `COUNT(*)` over the delivery table, and the test that pins
 * it seeds *thirty-one* delivered rows and asks for the number. Reverting the aggregate to a
 * length-of-`mine` fails exactly this test.
 *
 * ## Rows are inserted, not driven through the lifecycle
 *
 * Thirty-one full order lifecycles would make the slowest test in the suite thirty-one times
 * slower to test one aggregate. The lifecycle that produces a `DELIVERED` row is
 * `test/deliveries.test.ts`'s; what is under test here is the aggregate over one, and those are
 * separate claims about separate code. The `business`, `order` and `user` rows they point at are
 * still real ones — `delivery` has foreign keys to all three, and a fake id is refused by SQLite
 * rather than quietly accepted.
 */
describe("couriers.stats", () => {
	/** A shop, a buyer and a courier, all real rows, because the deliveries need them. */
	async function worldWithCourier(tag: string, courierProfileRow = true) {
		const test = world();
		const courier = await seedUser(test.db, {
			id: `usr_stats_${tag}_courier`,
			email: `courier-${tag}@example.test`,
			name: "Stats Courier",
		});
		// `seedBusiness` returns the id, not an object — `seedCategory` and `seedProduct` are the
		// same shape, and reaching for `.id` here is how the first run of this file seeded
		// deliveries against a null business.
		const shopId = await seedBusiness(test.db, {
			id: `biz_stats_${tag}`,
			slug: `stats-${tag}`,
			name: "Stats Shop",
		});
		const buyer = await seedUser(test.db, {
			id: `usr_stats_${tag}_buyer`,
			email: `buyer-${tag}@example.test`,
			name: "Stats Buyer",
		});
		if (courierProfileRow) {
			await test.db.insert(courierProfile).values({
				id: `cpr_stats_${tag}`,
				userId: courier.id,
				displayName: "Stats Courier",
				serviceArea: "San José",
				verificationStatus: "VERIFIED",
				// `notNull()` with no default: the service writes these, and so must a raw insert.
				createdAt: daysAgo(120),
				updatedAt: daysAgo(120),
			});
		}
		return { test, courier, shopId, buyerId: buyer.id };
	}

	/**
	 * One finished run, `daysAgoOld` in the past.
	 *
	 * The `order` row exists because `delivery.order_id` is a foreign key — the run is attached
	 * to a real order even though this test never reads the order.
	 */
	async function deliveredRun(
		test: { db: Parameters<typeof seedOrder>[0] },
		ids: {
			courierId: string;
			shopId: string;
			buyerId: string;
			orderPrefix: string;
		},
		index: number,
		daysAgoOld: number,
		status: "DELIVERED" | "CANCELLED" = "DELIVERED",
	) {
		const at = daysAgo(daysAgoOld);
		const orderId = `${ids.orderPrefix}_${index}`;
		await seedOrder(test.db, {
			id: orderId,
			businessId: ids.shopId,
			customerId: ids.buyerId,
			status: "COMPLETED",
		});
		await test.db.insert(deliveryTable).values({
			id: `dlv_${orderId}`,
			orderId,
			businessId: ids.shopId,
			customerId: ids.buyerId,
			courierUserId: ids.courierId,
			status,
			pickupName: "Shop",
			pickupLine1: "Main street",
			pickupCity: "San José",
			pickupRegion: "San José",
			dropoffName: "Someone",
			dropoffLine1: "Side street",
			dropoffCity: "Heredia",
			dropoffRegion: "Heredia",
			acceptedAt: at,
			// A cancelled run has no delivery time, which is what makes the status filter and a
			// `deliveredAt IS NOT NULL` filter two different queries.
			deliveredAt: status === "DELIVERED" ? at : null,
			cancelledAt: status === "CANCELLED" ? at : null,
			createdAt: at,
			updatedAt: at,
		});
	}

	test("a courier with no history gets zeros and no rating, not a refusal", async () => {
		const w = await worldWithCourier("empty");

		// The numbers are about deliveries, not about a profile existing: an empty card is the
		// honest answer for somebody who has not worked yet, where a `NOT_FOUND` would be a
		// claim that this courier does not exist.
		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats).toEqual({
			deliveredTotal: 0,
			deliveredLast30Days: 0,
			firstDeliveredAt: null,
			ratingAverage: null,
			ratingCount: 0,
		});
	});

	test("thirty-one delivered runs read as thirty-one, not thirty", async () => {
		const w = await worldWithCourier("many");
		const ids = {
			courierId: w.courier.id,
			shopId: w.shopId,
			buyerId: w.buyerId,
			orderPrefix: "ord_stats_many",
		};

		// 29 inside the thirty-day window and 2 outside it, so `deliveredTotal` and
		// `deliveredLast30Days` differ and the window filter is visibly doing something.
		for (let index = 0; index < 31; index++) {
			await deliveredRun(w.test, ids, index, index < 29 ? index : 45 + index);
		}

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats.deliveredTotal).toBe(31);
		expect(stats.deliveredLast30Days).toBe(29);
		expect(stats.firstDeliveredAt).not.toBeNull();
	});

	test("only the caller's own runs are counted", async () => {
		const w = await worldWithCourier("scoped");
		const other = await seedUser(w.test.db, {
			id: "usr_stats_scoped_other",
			email: "other@example.test",
			name: "Other Courier",
		});

		await deliveredRun(
			w.test,
			{
				courierId: w.courier.id,
				shopId: w.shopId,
				buyerId: w.buyerId,
				orderPrefix: "ord_stats_scoped",
			},
			1,
			2,
		);
		// Somebody else's finished run, on the same shop and the same buyer.
		await deliveredRun(
			w.test,
			{
				courierId: other.id,
				shopId: w.shopId,
				buyerId: w.buyerId,
				orderPrefix: "ord_stats_scoped",
			},
			2,
			2,
		);

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats.deliveredTotal).toBe(1);
	});

	test("a cancelled run is not a delivered run", async () => {
		const w = await worldWithCourier("cancelled");
		const ids = {
			courierId: w.courier.id,
			shopId: w.shopId,
			buyerId: w.buyerId,
			orderPrefix: "ord_stats_cancelled",
		};

		await deliveredRun(w.test, ids, 1, 3);
		await deliveredRun(w.test, ids, 2, 3, "CANCELLED");

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats.deliveredTotal).toBe(1);
	});

	test("the rating is the mean of what customers gave, never their own ratings back", async () => {
		const w = await worldWithCourier("rating");
		const ids = {
			courierId: w.courier.id,
			shopId: w.shopId,
			buyerId: w.buyerId,
			orderPrefix: "ord_stats_rating",
		};

		await deliveredRun(w.test, ids, 1, 4);
		await deliveredRun(w.test, ids, 2, 5);
		await w.test.db.insert(ratingTable).values([
			{
				id: "rat_stats_1",
				deliveryId: "dlv_ord_stats_rating_1",
				fromUserId: w.buyerId,
				toUserId: w.courier.id,
				fromRole: "CUSTOMER",
				rating: 5,
				createdAt: daysAgo(4),
			},
			{
				id: "rat_stats_2",
				deliveryId: "dlv_ord_stats_rating_2",
				fromUserId: w.buyerId,
				toUserId: w.courier.id,
				fromRole: "CUSTOMER",
				rating: 4,
				createdAt: daysAgo(5),
			},
			{
				// The courier rating the customer they delivered to — the same `toUserId`
				// column in reverse. Without the `fromRole` filter this row averages a courier's
				// own generosity back at them: (5 + 4 + 1) / 3 instead of 4.5.
				id: "rat_stats_3",
				deliveryId: "dlv_ord_stats_rating_1",
				fromUserId: w.courier.id,
				toUserId: w.buyerId,
				fromRole: "COURIER",
				rating: 1,
				createdAt: daysAgo(4),
			},
		]);

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats.ratingCount).toBe(2);
		expect(stats.ratingAverage).toBeCloseTo(4.5, 5);
	});

	test("one rating is one rating, and `ratingCount` is what says so", async () => {
		const w = await worldWithCourier("single");
		await deliveredRun(
			w.test,
			{
				courierId: w.courier.id,
				shopId: w.shopId,
				buyerId: w.buyerId,
				orderPrefix: "ord_stats_single",
			},
			1,
			6,
		);
		await w.test.db.insert(ratingTable).values({
			id: "rat_stats_single",
			deliveryId: "dlv_ord_stats_single_1",
			fromUserId: w.buyerId,
			toUserId: w.courier.id,
			fromRole: "CUSTOMER",
			rating: 5,
			createdAt: daysAgo(6),
		});

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		// The number the client needs in order to refuse to print "5.0 / 5" off one tap.
		expect(stats.ratingCount).toBe(1);
		expect(stats.ratingAverage).toBe(5);
	});

	test("ratings can outlive the runs they were left for", async () => {
		// A `delivery` row is re-pointable — a dispatch operator can move a run to another
		// courier — so a courier can hold ratings and no runs at all. The two aggregates are
		// separate queries for that reason, and this is the shape that proves it: a client that
		// gated its card on `deliveredTotal` alone would draw "0 entregas completadas" under a
		// 5.0.
		const w = await worldWithCourier("orphanrating");
		const ids = {
			courierId: w.courier.id,
			shopId: w.shopId,
			buyerId: w.buyerId,
			orderPrefix: "ord_stats_orphanrating",
		};
		await deliveredRun(w.test, ids, 1, 6);
		await deliveredRun(w.test, ids, 2, 7);
		// Two runs, because the unique index is on `(delivery_id, from_role)` — one rating per
		// run per role, so two ratings means two deliveries and not one rated twice.
		await w.test.db.insert(ratingTable).values([
			{
				id: "rat_stats_orphan_1",
				deliveryId: "dlv_ord_stats_orphanrating_1",
				fromUserId: w.buyerId,
				toUserId: w.courier.id,
				fromRole: "CUSTOMER",
				rating: 5,
				createdAt: daysAgo(6),
			},
			{
				id: "rat_stats_orphan_2",
				deliveryId: "dlv_ord_stats_orphanrating_2",
				fromUserId: w.buyerId,
				toUserId: w.courier.id,
				fromRole: "CUSTOMER",
				rating: 5,
				createdAt: daysAgo(7),
			},
		]);
		// Both runs move to somebody else, leaving both ratings behind. The new courier is a real
		// user because `delivery.courier_user_id` is a foreign key — SQLite refuses the
		// re-point otherwise, which is the constraint making this scenario awkward and therefore
		// rare.
		const successor = await seedUser(w.test.db, {
			id: "usr_stats_orphanrating_newcourier",
			email: "successor@example.test",
			name: "Successor Courier",
		});
		await w.test.db
			.update(deliveryTable)
			.set({ courierUserId: successor.id })
			.where(eq(deliveryTable.courierUserId, w.courier.id));

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats.deliveredTotal).toBe(0);
		expect(stats.deliveredLast30Days).toBe(0);
		expect(stats.ratingCount).toBe(2);
		expect(stats.ratingAverage).toBe(5);
	});

	test("a rating left for somebody else is not this courier's", async () => {
		const w = await worldWithCourier("stranger");
		await deliveredRun(
			w.test,
			{
				courierId: w.courier.id,
				shopId: w.shopId,
				buyerId: w.buyerId,
				orderPrefix: "ord_stats_stranger",
			},
			1,
			6,
		);
		const stranger = await seedUser(w.test.db, {
			id: "usr_stats_stranger_somebody",
			email: "stranger@example.test",
			name: "Somebody Else",
		});
		await w.test.db.insert(ratingTable).values({
			id: "rat_stats_stranger",
			deliveryId: "dlv_ord_stats_stranger_1",
			fromUserId: w.buyerId,
			toUserId: stranger.id,
			fromRole: "CUSTOMER",
			rating: 1,
			createdAt: daysAgo(6),
		});

		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();
		expect(stats.ratingCount).toBe(0);
		expect(stats.ratingAverage).toBeNull();
	});

	test("the profile row is not the gate — runs and no profile still read", async () => {
		// `protectedProcedure` rather than a role gate, for the same reason `profile` is: a
		// courier's first run is possible before any profile row exists.
		const w = await worldWithCourier("noprofile", false);
		await deliveredRun(
			w.test,
			{
				courierId: w.courier.id,
				shopId: w.shopId,
				buyerId: w.buyerId,
				orderPrefix: "ord_stats_noprofile",
			},
			1,
			7,
		);

		const caller = await callerFor(w.test, w.courier);
		expect(await caller.couriers.profile()).toBeNull();
		expect((await caller.couriers.stats()).deliveredTotal).toBe(1);
	});

	test("`sum` over nothing is null in SQL and must not reach the client as one", async () => {
		const w = await worldWithCourier("sumnull");
		const stats = await (await callerFor(w.test, w.courier)).couriers.stats();

		// `count(*)` is `0` over no rows and `sum(...)` is `null`. Both are read through `?? 0`
		// in the service, and this is the test that says so — without it a `null` here would
		// render as a blank line on a card that is supposed to say "0".
		expect(stats.deliveredTotal).toBe(0);
		expect(stats.deliveredLast30Days).toBe(0);
		expect(stats.firstDeliveredAt).toBeNull();
		expect(
			await w.test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.courierUserId, w.courier.id)),
		).toHaveLength(0);
	});
});
