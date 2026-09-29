import { describe, expect, test } from "bun:test";
import {
	courierProfile as courierProfileTable,
	delivery as deliveryTable,
	merchantLocation as locationTable,
	membership as membershipTable,
} from "@pymeshub/db";
import { addToCartInput } from "@pymeshub/shared";
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

/**
 * The third profile: a courier is a member with the COURIER role, handed runs
 * by a manager and visible on the customer's tracker while riding.
 *
 * Three rules, each with the test that pins the abuse it prevents:
 *
 * 1. **Assignment is staffing.** Only MANAGER/OWNER hand out runs, only to
 *    COURIER members, only at READY on a DELIVERY order. A courier cannot
 *    self-assign, and staff cannot assign at all.
 * 2. **A courier moves only their own run.** The membership check says they
 *    belong to the shop; the assignee check says this run is theirs. Without
 *    the second, any courier could advance any order of the shop.
 * 3. **Pings are foreground news, not history.** `reportLocation` overwrites
 *    one row of position and refuses outside OUT_FOR_DELIVERY, so a stale
 *    point reads as "last seen" rather than as a trail.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

/** A READY delivery order, a shop owner, and a courier member waiting for runs. */
async function readyRun(test: Test, orderTag = "courier_000001") {
	const shopId = await seedBusiness(test.db, { id: `biz_${orderTag}` });
	await test.db
		.update(locationTable)
		.set({
			line1: "Avenida Central",
			city: "San José",
			lat: 9.9325,
			lng: -84.0796,
		})
		.where(eq(locationTable.id, `loc_${shopId}`));
	await seedProduct(test.db, {
		id: `prd_${orderTag}`,
		businessId: shopId,
		priceMinor: 1500,
	});

	const customer = await seedUser(test.db, { id: `usr_${orderTag}_customer` });
	const buyer = appRouter.createCaller(await authed(test, customer)) as Caller;
	await buyer.cart.addItem(
		addToCartInput.parse({ productId: `prd_${orderTag}`, quantity: 1 }),
	);
	const address = await buyer.users.saveAddress({
		line1: "Calle 1, casa 2",
		city: "San José",
		region: "San José",
		lat: 9.9281,
		lng: -84.0907,
	});
	const order = await buyer.orders.place({
		fulfilment: "DELIVERY",
		addressId: address.id,
		paymentMethod: "CASH",
		clientRequestId: `req_${orderTag}`,
	});

	const owner = await seedUser(test.db, { id: `usr_${orderTag}_owner` });
	await seedMembership(test.db, owner.id, shopId, "OWNER");
	const manager = appRouter.createCaller(await authed(test, owner)) as Caller;
	for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
		await manager.orders.advance({ orderId: order.id, to });
	}

	const rider = await seedUser(test.db, { id: `usr_${orderTag}_rider` });
	await seedMembership(test.db, rider.id, shopId, "COURIER");
	const courier = appRouter.createCaller(await authed(test, rider)) as Caller;

	return { shopId, customer, buyer, order, manager, rider, courier };
}

describe("orders.assign", () => {
	test("a manager hands a READY delivery to a courier of the shop", async () => {
		const test = world();
		const { buyer, courier, manager, order, rider } = await readyRun(test);

		const assigned = await manager.orders.assign({
			orderId: order.id,
			courierUserId: rider.id,
		});

		// The row's name and phone come from the member's profile, not from a
		// typed string: a name typed at dispatch is a different person every
		// time it is spelled differently.
		expect(assigned.courier?.name).toBe("Cliente de Prueba");
		expect(assigned.courier?.phone).toBeNull();

		// And the assignment resolves on the track the customer polls: the id
		// itself never leaves the server, the name is what the screen shows.
		const tracking = await buyer.orders.track({ id: order.id });
		expect(tracking.courier?.name).toBe("Cliente de Prueba");

		const detail = await buyer.orders.byId({ id: order.id });
		expect(detail.pickupLocation).toMatchObject({
			id: `loc_${detail.business.id}`,
			line1: "Avenida Central",
			lat: 9.9325,
			lng: -84.0796,
		});
		expect(detail.deliveryAddress).toMatchObject({
			line1: "Calle 1, casa 2",
			lat: 9.9281,
			lng: -84.0907,
		});

		const courierDetail = await courier.orders.byId({ id: order.id });
		expect(courierDetail.pickupLocation?.lat).toBe(9.9325);
		expect(courierDetail.deliveryAddress?.lat).toBe(9.9281);

		test.close();
	});

	test("assignment is refused before the food is READY", async () => {
		const test = world();
		const shopId = await seedBusiness(test.db);
		await seedProduct(test.db, { businessId: shopId, priceMinor: 1500 });
		const customer = await seedUser(test.db, { id: "usr_courier_early" });
		const buyer = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: "prd_test_item", quantity: 1 }),
		);
		const address = await buyer.users.saveAddress({
			line1: "Calle 1, casa 2",
			city: "San José",
			region: "San José",
		});
		const order = await buyer.orders.place({
			fulfilment: "DELIVERY",
			addressId: address.id,
			paymentMethod: "CASH",
			clientRequestId: "req_courier_early",
		});
		const owner = await seedUser(test.db, { id: "usr_courier_early_owner" });
		await seedMembership(test.db, owner.id, shopId, "OWNER");
		const manager = appRouter.createCaller(await authed(test, owner)) as Caller;
		await manager.orders.advance({ orderId: order.id, to: "ACCEPTED" });
		const rider = await seedUser(test.db, { id: "usr_courier_early_rider" });
		await seedMembership(test.db, rider.id, shopId, "COURIER");

		// The run does not exist until the food is ready: assigning at ACCEPTED
		// would hand a courier an order the kitchen has not finished.
		const error = await refused(
			manager.orders.assign({ orderId: order.id, courierUserId: rider.id }),
		);
		expect(error.code).toBe("BAD_REQUEST");

		test.close();
	});

	test("a pickup order never takes a courier", async () => {
		const test = world();
		const shopId = await seedBusiness(test.db);
		await seedProduct(test.db, { businessId: shopId, priceMinor: 1500 });
		const customer = await seedUser(test.db, { id: "usr_courier_pickup" });
		const buyer = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: "prd_test_item", quantity: 1 }),
		);
		const order = await buyer.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: "CASH",
			clientRequestId: "req_courier_pickup",
		});
		const owner = await seedUser(test.db, { id: "usr_courier_pickup_owner" });
		await seedMembership(test.db, owner.id, shopId, "OWNER");
		const manager = appRouter.createCaller(await authed(test, owner)) as Caller;
		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await manager.orders.advance({ orderId: order.id, to });
		}
		const rider = await seedUser(test.db, { id: "usr_courier_pickup_rider" });
		await seedMembership(test.db, rider.id, shopId, "COURIER");

		const error = await refused(
			manager.orders.assign({ orderId: order.id, courierUserId: rider.id }),
		);
		expect(error.code).toBe("BAD_REQUEST");

		test.close();
	});

	test("staff cannot assign, and strangers learn nothing", async () => {
		const test = world();
		const { manager, order, rider, shopId } = await readyRun(
			test,
			"courier_scope",
		);
		// A second run, because the assertion below re-assigns after the first one landed and
		// `assign` refuses to overwrite once the run has left READY.
		const second = await readyRun(test, "courier_scope_second");

		const staff = await seedUser(test.db, { id: "usr_courier_staff" });
		await seedMembership(test.db, staff.id, shopId, "STAFF");
		const staffCaller = appRouter.createCaller(
			await authed(test, staff),
		) as Caller;
		const staffError = await refused(
			staffCaller.orders.assign({ orderId: order.id, courierUserId: rider.id }),
		);
		expect(staffError.code).toBe("FORBIDDEN");

		// A courier of another shop: the order resolves, the membership does
		// not, so the answer is the same as for a fabricated id.
		const outsider = await seedUser(test.db, { id: "usr_courier_outsider" });
		const outsiderCaller = appRouter.createCaller(
			await authed(test, outsider),
		) as Caller;
		const outsiderError = await refused(
			outsiderCaller.orders.assign({
				orderId: order.id,
				courierUserId: rider.id,
			}),
		);
		expect(outsiderError.code).toBe("NOT_FOUND");

		// A STAFF member of the right shop **with no courier profile** is still assignable,
		// because `assign` now reads the profile rather than the roster and tolerates its
		// absence (the shape an unaccepted invitation leaves behind). Staffing a run is not a
		// reward for having filled in a form.
		//
		// This assertion changed with the feature and the change is deliberate: the old
		// contract refused anyone without a `COURIER` membership, and under an open pool
		// that would have refused the courier the platform just offered a run to. What still
		// refuses is a profile that says no.
		const staffIsAssignable = await manager.orders.assign({
			orderId: order.id,
			courierUserId: staff.id,
		});
		// The id is read from the delivery row rather than off the return value, and
		// that is not a workaround. `orders.assign` answers with an `OrderDetail`, and
		// that shape carries the courier's *displayed* name and phone — not their id —
		// because it is the shape a customer sees on a tracker, and a customer has no
		// business holding a user id. The id lives on `delivery.courier_user_id`, which
		// is also the only place a change of assignee is recorded.
		//
		// Reading it from the database is what makes this assertion stronger than the
		// one it replaces: it checks the row that a courier's whole run hangs off, not
		// a field the response happens to echo back. The staff member has no courier
		// profile, so `courier.name` could not stand in for it.
		const [assigned] = await test.db
			.select({ courierUserId: deliveryTable.courierUserId })
			.from(deliveryTable)
			.where(eq(deliveryTable.orderId, order.id));
		expect(staffIsAssignable).toBeDefined();
		expect(assigned?.courierUserId).toBe(staff.id);

		// A profile that exists and is not verified refuses, whoever holds the membership.
		await test.db.insert(courierProfileTable).values({
			id: "cpr_courier_scope_staff",
			userId: staff.id,
			displayName: "Staff",
			serviceArea: "San José",
			isAvailable: true,
			verificationStatus: "PENDING",
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		// `second.manager`, not `manager`, and the difference is the whole assertion.
		// `readyRun` seeds a shop per tag, so `second.order` belongs to
		// `biz_courier_scope_second` while `manager` owns `biz_courier_scope`. Asking
		// `manager` about `second.order` therefore never reaches the profile check at
		// all: `reachableOrder` answers `NOT_FOUND` for a shop the caller is not in, and
		// the test was asserting on a refusal raised for the wrong reason. The two shops
		// are the reason a *second* run is needed here in the first place — the one
		// above has already left `READY`.
		const unverified = await refused(
			second.manager.orders.assign({
				orderId: second.order.id,
				courierUserId: staff.id,
			}),
		);
		expect(unverified.code).toBe("BAD_REQUEST");

		test.close();
	});
});

describe("courier moves and pings", () => {
	test("the assigned courier rides READY to the door", async () => {
		const test = world();
		const { manager, order, courier, buyer } = await readyRun(
			test,
			"courier_ride",
		);
		const riderId = "usr_courier_ride_rider";
		await manager.orders.assign({ orderId: order.id, courierUserId: riderId });

		await courier.orders.advance({ orderId: order.id, to: "OUT_FOR_DELIVERY" });

		await courier.orders.reportLocation({
			orderId: order.id,
			lat: 9.93,
			lng: -84.09,
		});
		await courier.orders.reportLocation({
			orderId: order.id,
			lat: 9.931,
			lng: -84.091,
		});

		const tracking = await buyer.orders.track({ id: order.id });
		expect(tracking.status).toBe("OUT_FOR_DELIVERY");
		expect(tracking.courier?.lat).toBe(9.931);
		expect(tracking.courier?.lng).toBe(-84.091);
		expect(tracking.courier?.updatedAt).not.toBeNull();

		await courier.orders.advance({ orderId: order.id, to: "COMPLETED" });
		const done = await buyer.orders.track({ id: order.id });
		expect(done.status).toBe("COMPLETED");

		test.close();
	});

	test("a courier moves only the run they carry", async () => {
		const test = world();
		const first = await readyRun(test, "courier_mine");
		const second = await readyRun(test, "courier_theirs");

		await first.manager.orders.assign({
			orderId: first.order.id,
			courierUserId: first.rider.id,
		});
		await second.manager.orders.assign({
			orderId: second.order.id,
			courierUserId: second.rider.id,
		});

		// First courier eyeing the second courier's run: the membership says
		// they belong to a shop (their own), and the assignee check says this
		// run is not theirs.
		const error = await refused(
			first.courier.orders.advance({
				orderId: second.order.id,
				to: "OUT_FOR_DELIVERY",
			}),
		);
		expect(error.code).toBe("NOT_FOUND");

		test.close();
	});

	test("pings land only on the way, and strangers are refused", async () => {
		const test = world();
		const { manager, order, courier, rider } = await readyRun(
			test,
			"courier_ping",
		);
		await manager.orders.assign({
			orderId: order.id,
			courierUserId: rider.id,
		});

		// Still READY: the food is at the counter, and a position now would be
		// the shop's address drawn as the courier.
		const early = await refused(
			courier.orders.reportLocation({
				orderId: order.id,
				lat: 9.93,
				lng: -84.09,
			}),
		);
		expect(early.code).toBe("BAD_REQUEST");

		// A stranger's ping learns nothing, not even which check failed.
		const stranger = await seedUser(test.db, { id: "usr_courier_stranger" });
		const strangerCaller = appRouter.createCaller(
			await authed(test, stranger),
		) as Caller;
		const strangerError = await refused(
			strangerCaller.orders.reportLocation({
				orderId: order.id,
				lat: 9.93,
				lng: -84.09,
			}),
		);
		expect(strangerError.code).toBe("NOT_FOUND");

		test.close();
	});

	/**
	 * A courier's board is every run carrying their name, across every shop.
	 *
	 * The interesting shape here is that **one courier carries runs from two different
	 * shops and belongs to neither by membership** — `readyRun` gives each shop its own
	 * rider, so this reassigns both orders to `first.rider` directly and deletes their
	 * membership rows. That is the situation the open pool creates and the old board could
	 * not express at all: it was handed one `businessId` and could only ever show that
	 * shop's queue.
	 */
	test("a courier's board is their runs across shops, with no membership", async () => {
		const test = world();
		const first = await readyRun(test, "courier_board_a");
		const second = await readyRun(test, "courier_board_b");

		// Assign first, membership second: `orders.assign` is the one write that still
		// requires a `COURIER` membership of the shop (a manager handing a run to someone
		// on their own roster), so the courier has to be a member at the moment of the
		// assignment and not after it.
		await first.manager.orders.assign({
			orderId: first.order.id,
			courierUserId: first.rider.id,
		});
		// The second shop has never heard of this courier, which is the whole point — a
		// manager is assigning a run to a verified courier the platform matched, and
		// `assign` reads them off the profile rather than a roster.
		await second.manager.orders.assign({
			orderId: second.order.id,
			courierUserId: first.rider.id,
		});
		// Belongs to nothing. The assignments are the whole relationship now.
		await test.db
			.delete(membershipTable)
			.where(eq(membershipTable.userId, first.rider.id));

		// A caller minted *here*, after the delete — not the one `readyRun` handed back.
		// `authed` resolves a `Context` whose `memberships` are loaded once, at
		// construction, and `first.courier` was built back at line 88 with the membership
		// still present. `businessProcedure` checks `ctx.memberships` and nothing else, so
		// the stale context would have answered as though the delete had never happened and
		// this whole test would have asserted nothing. Every call below goes through
		// `rider`.
		const rider = appRouter.createCaller(await authed(test, first.rider)) as Caller;

		const board = await rider.orders.list({
			role: "BUSINESS",
			assignedToMe: true,
		});
		expect(board.items.map((item) => item.id).sort()).toEqual(
			[first.order.id, second.order.id].sort(),
		);

		// A `businessId` is not merely unnecessary on this read, it is refused by the shop
		// door: `orders.queue` is a `businessProcedure`, and a membership-less caller cannot
		// get through it. That is why the board reads `orders.list` — and the assertion
		// documents that the two doors are genuinely different rather than aliases.
		const viaQueue = await refused(
			rider.orders.queue({
				role: "BUSINESS",
				businessId: first.shopId,
				assignedToMe: true,
			}),
		);
		expect(viaQueue.code).toBe("FORBIDDEN");

		// A plain customer setting the same flag reads an empty board, not somebody else's
		// runs. `queue` gates on `courierUserId = me` rather than on being a courier, so
		// there is no row this can return that is not already the caller's own — which is
		// also why no profile check sits in front of it.
		const notACourier = await seedUser(test.db, {
			id: "usr_courier_board_plain_customer",
		});
		const plainCustomer = appRouter.createCaller(
			await authed(test, notACourier),
		) as Caller;
		const strangerBoard = await plainCustomer.orders.list({
			role: "BUSINESS",
			assignedToMe: true,
		});
		expect(strangerBoard.items).toEqual([]);

		test.close();
	});

	/** The shop board is unchanged by all of the above: still one shop, still membership-checked. */
	test("a shop's board still lists its own queue", async () => {
		const test = world();
		const { manager, order, shopId } = await readyRun(test, "shop_board");
		const board = await manager.orders.list({
			role: "BUSINESS",
			businessId: shopId,
		});
		expect(board.items.map((item) => item.id)).toContain(order.id);
		test.close();
	});
});
