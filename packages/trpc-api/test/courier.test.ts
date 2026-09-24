import { describe, expect, test } from "bun:test";
import { addToCartInput } from "@pymeshub/shared";

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
		const { buyer, manager, order, rider } = await readyRun(test);

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

		// A STAFF member is not a courier, even of the right shop.
		const staffError2 = await refused(
			manager.orders.assign({ orderId: order.id, courierUserId: staff.id }),
		);
		expect(staffError2.code).toBe("BAD_REQUEST");

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

		const tracking = await buyer.orders.track({ id: order.id });
		expect(tracking.status).toBe("OUT_FOR_DELIVERY");
		expect(tracking.courier?.lat).toBe(9.93);
		expect(tracking.courier?.lng).toBe(-84.09);
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

	test("the courier's board is their own runs", async () => {
		const test = world();
		const first = await readyRun(test, "courier_board_a");
		const second = await readyRun(test, "courier_board_b");

		await first.manager.orders.assign({
			orderId: first.order.id,
			courierUserId: first.rider.id,
		});
		await second.manager.orders.assign({
			orderId: second.order.id,
			courierUserId: second.rider.id,
		});

		const board = await first.courier.orders.list({
			role: "BUSINESS",
			businessId: first.shopId,
			assignedToMe: true,
		});
		expect(board.items.map((item) => item.id)).toEqual([first.order.id]);

		test.close();
	});
});
