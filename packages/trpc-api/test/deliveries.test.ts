import { describe, expect, test } from "bun:test";
import {
	address as addressTable,
	delivery as deliveryTable,
	merchantLocation as locationTable,
	membership as membershipTable,
	deliveryOffer as offerTable,
	order as orderTable,
	courierPresence as presenceTable,
	courierProfile as profileTable,
	deliveryRating as ratingTable,
} from "@pymeshub/db";
import { addToCartInput } from "@pymeshub/shared";
import { and, eq } from "drizzle-orm";

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

type Caller = ReturnType<typeof appRouter.createCaller>;
type TestWorld = ReturnType<typeof world>;

async function orderReadyToPlace(test: TestWorld, tag: string) {
	const businessId = await seedBusiness(test.db, {
		id: `biz_delivery_${tag}`,
		name: `Tienda ${tag}`,
	});
	const locationId = `loc_${businessId}`;
	await test.db
		.update(locationTable)
		.set({
			line1: "Avenida Central 100",
			city: "San José",
			region: "San José",
			country: "CR",
			lat: 9.93,
			lng: -84.08,
			updatedAt: new Date(),
		})
		.where(eq(locationTable.id, locationId));

	const product = await seedProduct(test.db, {
		id: `prd_delivery_${tag}`,
		businessId,
		priceMinor: 2_500,
	});
	const customer = await seedUser(test.db, {
		id: `usr_delivery_${tag}_customer`,
		name: `Cliente ${tag}`,
		phone: "+506 6000 0001",
	});
	const buyer = appRouter.createCaller(await authed(test, customer)) as Caller;
	await buyer.cart.addItem(
		addToCartInput.parse({ productId: product.id, quantity: 1 }),
	);
	const address = await buyer.users.saveAddress({
		label: "Casa",
		line1: "Calle 5, casa 12",
		city: "San José",
		region: "San José",
		lat: 9.94,
		lng: -84.09,
		phone: "+506 6000 0001",
		instructions: "Portón azul",
	});

	return { businessId, locationId, customer, buyer, address };
}

async function placeDelivery(
	ready: Awaited<ReturnType<typeof orderReadyToPlace>>,
	tag: string,
) {
	return ready.buyer.orders.place({
		fulfilment: "DELIVERY",
		locationId: ready.locationId,
		addressId: ready.address.id,
		paymentMethod: "CASH",
		clientRequestId: `request_delivery_${tag}`,
	});
}

async function seedCourier(
	test: TestWorld,
	input: {
		businessId: string;
		id: string;
		lat: number;
		lng: number;
		verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
		isAvailable?: boolean;
		presenceAt?: Date;
	},
) {
	const user = await seedUser(test.db, {
		id: input.id,
		name: `Courier ${input.id}`,
		phone: "+506 7000 0001",
	});
	await seedMembership(test.db, user.id, input.businessId, "COURIER");
	const now = new Date();
	await test.db.insert(profileTable).values({
		id: `cpr_${input.id}`,
		userId: user.id,
		displayName: user.name,
		serviceArea: "San José",
		isAvailable: input.isAvailable ?? true,
		verificationStatus: input.verificationStatus ?? "VERIFIED",
		createdAt: now,
		updatedAt: now,
	});
	await test.db.insert(presenceTable).values({
		id: `cps_${input.id}`,
		userId: user.id,
		lat: input.lat,
		lng: input.lng,
		accuracyMeters: 8,
		updatedAt: input.presenceAt ?? now,
	});

	return {
		user,
		caller: appRouter.createCaller(await authed(test, user)) as Caller,
	};
}

async function seedOwner(test: TestWorld, businessId: string, tag: string) {
	const user = await seedUser(test.db, {
		id: `usr_delivery_${tag}_owner`,
		name: `Owner ${tag}`,
	});
	await seedMembership(test.db, user.id, businessId, "OWNER");
	return appRouter.createCaller(await authed(test, user)) as Caller;
}

describe("delivery creation and dispatch", () => {
	test("creates the delivery in the order batch and rolls both rows back together", async () => {
		const success = world();
		const ready = await orderReadyToPlace(success, "atomic_success");
		const order = await placeDelivery(ready, "atomic_success");
		const rows = await success.db
			.select()
			.from(deliveryTable)
			.where(eq(deliveryTable.orderId, order.id));

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			orderId: order.id,
			businessId: ready.businessId,
			customerId: ready.customer.id,
			status: "SEARCHING",
			pickupLine1: "Avenida Central 100",
			dropoffLine1: "Calle 5, casa 12",
		});
		success.close();

		const failed = world();
		const failedReady = await orderReadyToPlace(failed, "atomic_failure");
		failed.sqlite.exec(`
			create trigger reject_test_delivery
			before insert on delivery
			begin
				select raise(abort, 'forced delivery failure');
			end;
		`);

		await expect(placeDelivery(failedReady, "atomic_failure")).rejects.toThrow(
			"forced delivery failure",
		);
		const orderCount = failed.sqlite
			.prepare('select count(*) as count from "order"')
			.get() as { count: number };
		const deliveryCount = failed.sqlite
			.prepare("select count(*) as count from delivery")
			.get() as { count: number };
		expect(orderCount.count).toBe(0);
		expect(deliveryCount.count).toBe(0);
		failed.close();
	});

	test("offers deterministically to the nearest eligible courier", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "dispatch");
		const winner = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_dispatch_near",
			lat: 9.9301,
			lng: -84.0801,
		});
		await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_dispatch_far",
			lat: 9.98,
			lng: -84.13,
		});
		await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_dispatch_unverified",
			lat: 9.93,
			lng: -84.08,
			verificationStatus: "PENDING",
		});
		await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_dispatch_unavailable",
			lat: 9.93,
			lng: -84.08,
			isAvailable: false,
		});
		await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_dispatch_stale",
			lat: 9.93,
			lng: -84.08,
			presenceAt: new Date(Date.now() - 5 * 60_000),
		});

		const order = await placeDelivery(ready, "dispatch");
		const delivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, order.id))
		)[0];
		if (!delivery) throw new Error("Delivery was not created");
		const offers = await test.db
			.select()
			.from(offerTable)
			.where(eq(offerTable.deliveryId, delivery.id));
		const firstOffer = offers[0];
		if (!firstOffer) throw new Error("Delivery offer was not created");

		expect(delivery.status).toBe("OFFERED");
		expect(offers).toHaveLength(1);
		expect(firstOffer).toMatchObject({
			courierUserId: winner.user.id,
			status: "PENDING",
			workloadAtOffer: 0,
		});
		expect(firstOffer.distanceToPickupKm).toBeLessThan(0.1);
		expect(
			(await winner.caller.deliveries.offers()).map((offer) => offer.id),
		).toEqual([firstOffer.id]);
		test.close();
	});

	/**
	 * The shop's own courier outranks a stranger who is standing closer.
	 *
	 * This is the `preferred` rank, and it is a decision rather than an obvious good: the
	 * pool is now everyone, so without a first-place "this shop already asked for you" the
	 * nearest body on the street would win every time and a shop could never have a
	 * relationship with its own drivers. The regular courier here is ~7.6 km out and the
	 * stranger is metres away, and the membership still wins — that inversion is the whole
	 * assertion.
	 */
	test("a courier the shop invited outranks a nearer stranger", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "preferred");
		// A second shop, so "a member of some other shop" is a real membership row rather
		// than a fabricated business id — `membership.business_id` is a foreign key and a
		// made-up id is a constraint failure, not a test.
		const otherShop = await seedBusiness(test.db, {
			id: "biz_delivery_unrelated_shop",
			name: "Otra Tienda",
		});
		// Metres from the pickup, and a member of that other shop.
		const stranger = await seedCourier(test, {
			businessId: otherShop,
			id: "usr_delivery_preferred_stranger",
			lat: 9.9301,
			lng: -84.0801,
		});
		// ~7.6 km away, and a member of this shop.
		const regular = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_preferred_regular",
			lat: 9.98,
			lng: -84.13,
		});

		const order = await placeDelivery(ready, "preferred");
		const delivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, order.id))
		)[0];
		if (!delivery) throw new Error("Delivery was not created");
		const offer = (
			await test.db
				.select()
				.from(offerTable)
				.where(eq(offerTable.deliveryId, delivery.id))
		)[0];
		if (!offer) throw new Error("Delivery offer was not created");

		expect(offer.courierUserId).toBe(regular.user.id);
		expect(stranger.user.id).not.toBe(offer.courierUserId);
		// Both halves of the premise, asserted rather than assumed: the winner really is
		// further away, and the loser really was eligible enough to have won on distance.
		expect(offer.distanceToPickupKm ?? 0).toBeGreaterThan(5);
		expect(await stranger.caller.deliveries.offers()).toEqual([]);
		test.close();
	});

	/**
	 * The radius is the gate the membership used to provide for free.
	 *
	 * A courier 40 km away is verified, available and freshly online — every fact the pool
	 * asks for — and must still never be a candidate. The old pool made that true by
	 * accident, because they did not belong to this shop; now it is true because of
	 * `OFFER_RADIUS_KM`, which is the only thing between a widened pool and a courier in
	 * one city being offered a delivery in another. The delivery staying `SEARCHING` is
	 * what proves no offer was created at all.
	 */
	test("a courier outside the radius is never offered the delivery", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "faraway");
		await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_faraway",
			// ~40 km north-west of the San José pickup.
			lat: 10.28,
			lng: -84.42,
		});

		const order = await placeDelivery(ready, "faraway");
		const delivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, order.id))
		)[0];
		if (!delivery) throw new Error("Delivery was not created");
		expect(delivery.status).toBe("SEARCHING");
		const offers = await test.db
			.select()
			.from(offerTable)
			.where(eq(offerTable.deliveryId, delivery.id));
		expect(offers).toEqual([]);
		test.close();
	});

	/**
	 * A pickup with no coordinates gets no automatic offer and stays assignable by hand.
	 *
	 * `business.lat` and `merchantLocation.lat` are both nullable, so a delivery can have a
	 * pickup with no origin. The radius is measured *from* the pickup, so there is nothing
	 * to measure against, and offering it would mean offering a location-less delivery to
	 * whoever happened to rank first. It waits in `SEARCHING`, where a manager can still
	 * assign it — the difference between failing visibly and failing absurdly.
	 */
	test("a pickup with no coordinates waits for a human instead of being offered", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "nocoords");
		await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_nocoords",
			lat: 9.9301,
			lng: -84.0801,
		});
		// The shop's location loses its coordinates, as a shop that never set an address
		// would have.
		await test.db
			.update(locationTable)
			.set({ lat: null, lng: null })
			.where(eq(locationTable.id, ready.locationId));

		const order = await placeDelivery(ready, "nocoords");
		const delivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, order.id))
		)[0];
		if (!delivery) throw new Error("Delivery was not created");
		expect(delivery.pickupLat).toBeNull();
		expect(delivery.status).toBe("SEARCHING");
		const offers = await test.db
			.select()
			.from(offerTable)
			.where(eq(offerTable.deliveryId, delivery.id));
		expect(offers).toEqual([]);
		test.close();
	});

	test("dispatches a waiting delivery when an eligible courier comes online", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "presence_retry");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_presence_retry",
			lat: 9.9301,
			lng: -84.0801,
		});
		await test.db
			.delete(presenceTable)
			.where(eq(presenceTable.userId, courier.user.id));

		const order = await placeDelivery(ready, "presence_retry");
		const delivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, order.id))
		)[0];
		if (!delivery) throw new Error("Delivery was not created");
		expect(delivery.status).toBe("SEARCHING");
		expect(await courier.caller.deliveries.offers()).toEqual([]);

		await courier.caller.deliveries.reportPresence({
			lat: 9.9302,
			lng: -84.0802,
		});
		const offers = await courier.caller.deliveries.offers();
		expect(offers).toHaveLength(1);
		expect(offers[0]?.deliveryId).toBe(delivery.id);
		expect(offers[0]?.dropoffArea).toBe("San José, San José");
		expect(offers[0]).not.toHaveProperty("dropoff");
		test.close();
	});
});

describe("a courier the shop never added", () => {
	test("a pinned zone receives an offer without device location or shop membership", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "zone_without_gps");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_zone_without_gps",
			lat: 9.935,
			lng: -84.085,
		});
		await test.db
			.delete(presenceTable)
			.where(eq(presenceTable.userId, courier.user.id));
		await test.db
			.delete(membershipTable)
			.where(eq(membershipTable.userId, courier.user.id));
		await courier.caller.couriers.saveZone({
			lat: 9.935,
			lng: -84.085,
			radiusKm: 2,
			label: "San José",
		});
		await placeDelivery(ready, "zone_without_gps");
		expect(await courier.caller.deliveries.offers()).toHaveLength(1);
		test.close();
	});

	test("opening the board offers a waiting run after pinning a zone", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "zone_waiting");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_zone_waiting",
			lat: 9.935,
			lng: -84.085,
		});
		await test.db
			.delete(presenceTable)
			.where(eq(presenceTable.userId, courier.user.id));
		const order = await placeDelivery(ready, "zone_waiting");
		const [run] = await test.db
			.select()
			.from(deliveryTable)
			.where(eq(deliveryTable.orderId, order.id));
		expect(run?.status).toBe("SEARCHING");
		await courier.caller.couriers.saveZone({
			lat: 9.935,
			lng: -84.085,
			radiusKm: 2,
			label: "San José",
		});
		expect(await courier.caller.deliveries.requestOffers()).toEqual({
			checked: 1,
		});
		expect(await courier.caller.deliveries.offers()).toHaveLength(1);
		test.close();
	});

	test("a pinned zone does not offer a destination without coordinates", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "zone_no_destination");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_zone_no_destination",
			lat: 9.9301,
			lng: -84.0801,
		});
		await courier.caller.couriers.saveZone({
			lat: 9.935,
			lng: -84.085,
			radiusKm: 5,
			label: "San José",
		});
		await test.db
			.update(addressTable)
			.set({ lat: null, lng: null })
			.where(eq(addressTable.id, ready.address.id));
		await placeDelivery(ready, "zone_no_destination");
		expect(await courier.caller.deliveries.offers()).toHaveLength(0);
		test.close();
	});
	test("a saved zone requires both pickup and destination inside its radius", async () => {
		for (const [tag, lat, lng, radiusKm, expectedOffers] of [
			["zone_both", 9.935, -84.085, 5, 1],
			["zone_pickup_only", 9.93, -84.08, 1, 0],
			["zone_dropoff_only", 9.94, -84.09, 1, 0],
		] as const) {
			const test = world();
			const ready = await orderReadyToPlace(test, tag);
			const courier = await seedCourier(test, {
				businessId: ready.businessId,
				id: `usr_delivery_${tag}`,
				lat: 9.9301,
				lng: -84.0801,
			});
			await courier.caller.couriers.saveZone({
				lat,
				lng,
				radiusKm,
				label: "San José",
			});
			await placeDelivery(ready, tag);
			expect(await courier.caller.deliveries.offers()).toHaveLength(
				expectedOffers,
			);
			test.close();
		}
	});
	/**
	 * The whole feature, in one test: a verified courier with no membership of the business
	 * is offered its deliveries and can accept one.
	 *
	 * `seedCourier` always writes a `COURIER` membership because that is what the other
	 * tests need, so the row is deleted here *after* the profile and presence exist — which
	 * is the honest way to build the fixture: a courier who was verified by the platform,
	 * set themselves available, and was never added to anybody's team.
	 */
	test("receives an offer and can accept it with no membership of the shop", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "open_pool");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_open_pool",
			lat: 9.9301,
			lng: -84.0801,
		});
		await test.db
			.delete(membershipTable)
			.where(eq(membershipTable.userId, courier.user.id));
		const caller = appRouter.createCaller(
			await authed(test, courier.user),
		) as Caller;

		const order = await placeDelivery(ready, "open_pool");
		const delivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, order.id))
		)[0];
		if (!delivery) throw new Error("Delivery was not created");
		expect(delivery.status).toBe("OFFERED");

		const offers = await caller.deliveries.offers();
		expect(offers).toHaveLength(1);
		if (!offers[0]) throw new Error("The unadded courier received no offer");

		const accepted = await caller.deliveries.acceptOffer({
			offerId: offers[0].id,
		});
		expect(accepted.courier?.id).toBe(courier.user.id);
		// The customer's order carries the courier, which is what makes them a courier for
		// every other read on this run — see `actorFor`.
		const carried = (
			await test.db.select().from(orderTable).where(eq(orderTable.id, order.id))
		)[0];
		expect(carried?.courierUserId).toBe(courier.user.id);
		test.close();
	});

	/**
	 * The security property, and the reason the membership could not simply be deleted from
	 * `actorFor` instead of replaced.
	 *
	 * Carrying a run makes someone a courier **on that run and nowhere else**. Before the
	 * open pool, `actorFor` read a membership's role and fell through to `BUSINESS`, which
	 * was safe because only roster members could ever carry anything. With the pool open, a
	 * fall-through would have given a courier with no membership at all the shop's order
	 * machine — reject, cancel, advance any order of the business. This asserts the negative
	 * directly: the carrier can move their own delivery's order and is refused every other
	 * order of the same shop, including one that is not even a delivery.
	 */
	test("carries one run and gains no shop powers on any other order", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "escalation");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_escalation",
			lat: 9.9301,
			lng: -84.0801,
		});
		await test.db
			.delete(membershipTable)
			.where(eq(membershipTable.userId, courier.user.id));
		const caller = appRouter.createCaller(
			await authed(test, courier.user),
		) as Caller;

		// A second order of the same shop that the courier does not carry.
		//
		// **Pickup, not delivery, and the reason is the pool itself.** A second delivery
		// order at this location would be offered to this courier too — they are verified,
		// available and standing on the corner — so they would legitimately become its
		// carrier and the test would prove nothing. A pickup order creates no delivery, so
		// there is nothing to offer and `courierUserId` stays null, which is the state a
		// courier with no membership and no run is actually in.
		const strangerProduct = await seedProduct(test.db, {
			id: "prd_delivery_escalation_other",
			businessId: ready.businessId,
			priceMinor: 1_500,
		});
		const otherBuyer = await seedUser(test.db, {
			id: "usr_delivery_escalation_buyer",
			name: "Otro cliente",
		});
		const buyer = appRouter.createCaller(
			await authed(test, otherBuyer),
		) as Caller;
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: strangerProduct.id, quantity: 1 }),
		);
		const otherOrder = await buyer.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: "CASH",
			clientRequestId: "request_delivery_escalation_other",
		});
		// The premise, stated rather than assumed: nobody is carrying this one.
		const untouched = (
			await test.db
				.select()
				.from(orderTable)
				.where(eq(orderTable.id, otherOrder.id))
		)[0];
		expect(untouched?.courierUserId).toBeNull();

		await placeDelivery(ready, "escalation");
		const offer = (await caller.deliveries.offers())[0];
		if (!offer) throw new Error("The unadded courier received no offer");
		const accepted = await caller.deliveries.acceptOffer({
			offerId: offer.id,
		});

		// The shop's own machine on someone else's order: every one of these is a BUSINESS
		// move, and all of them must be a 404 rather than a success.
		for (const to of ["ACCEPTED", "REJECTED", "CANCELLED"] as const) {
			const error = await refused(
				caller.orders.advance({ orderId: otherOrder.id, to }),
			);
			expect(error.code).toBe("NOT_FOUND");
		}

		// And the courier cannot read it either, which is the `reachableOrder` half. Without
		// the carrier branch there, `advance` above would be refused by the state machine
		// instead — a 400 that looks like a correct answer and is really the wrong door.
		await expect(caller.orders.byId({ id: otherOrder.id })).rejects.toThrow();
		// The run they do carry is fully theirs, and readable through both doors.
		expect(accepted.status).toBe("ACCEPTED");
		expect((await caller.deliveries.byId({ deliveryId: accepted.id })).id).toBe(
			accepted.id,
		);
		test.close();
	});
});

describe("delivery offer authorization", () => {
	test("two outstanding offers for one courier leave exactly one active run", async () => {
		const test = world();
		const first = await orderReadyToPlace(test, "capacity_first");
		const second = await orderReadyToPlace(test, "capacity_second");
		const courier = await seedCourier(test, {
			businessId: first.businessId,
			id: "usr_delivery_capacity_courier",
			lat: 9.9301,
			lng: -84.0801,
		});
		const firstOrder = await placeDelivery(first, "capacity_first");
		const firstOffer = (await courier.caller.deliveries.offers())[0];
		if (!firstOffer) throw new Error("First offer was not created");

		const secondOrder = await placeDelivery(second, "capacity_second");
		const secondDelivery = (
			await test.db
				.select()
				.from(deliveryTable)
				.where(eq(deliveryTable.orderId, secondOrder.id))
		)[0];
		if (!secondDelivery) throw new Error("Second delivery was not created");
		const now = new Date();
		const secondOfferId = "dof_delivery_capacity_second";
		// Two dispatch workers can have read capacity before either offer commits.
		// Recreate that persisted race; acceptance must enforce capacity atomically.
		await test.db
			.update(deliveryTable)
			.set({ status: "OFFERED", updatedAt: now })
			.where(eq(deliveryTable.id, secondDelivery.id));
		await test.db.insert(offerTable).values({
			id: secondOfferId,
			deliveryId: secondDelivery.id,
			courierUserId: courier.user.id,
			status: "PENDING",
			expiresAt: new Date(now.getTime() + 120_000),
			createdAt: now,
		});

		await courier.caller.deliveries.acceptOffer({ offerId: firstOffer.id });
		const conflict = await refused(
			courier.caller.deliveries.acceptOffer({ offerId: secondOfferId }),
		);
		expect(conflict.code).toBe("CONFLICT");
		const active = await test.db
			.select({ orderId: deliveryTable.orderId })
			.from(deliveryTable)
			.where(eq(deliveryTable.status, "ACCEPTED"));
		expect(active).toHaveLength(1);
		if (!active[0]) throw new Error("Accepted run was not stored");
		const assignedOrders = await test.db
			.select({ id: orderTable.id })
			.from(orderTable)
			.where(eq(orderTable.courierUserId, courier.user.id));
		expect(assignedOrders).toHaveLength(1);
		expect([firstOrder.id, secondOrder.id]).toContain(active[0].orderId);
		const untouchedOffer = (
			await test.db
				.select({ status: offerTable.status })
				.from(offerTable)
				.where(eq(offerTable.id, secondOfferId))
		)[0];
		expect(untouchedOffer?.status).toBe("PENDING");
		test.close();
	});

	test("only the addressed courier can decline or accept an offer", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "offers");
		const first = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_offers_first",
			lat: 9.9301,
			lng: -84.0801,
		});
		const second = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_offers_second",
			lat: 9.95,
			lng: -84.1,
		});
		const stranger = await seedUser(test.db, {
			id: "usr_delivery_offers_stranger",
		});
		const strangerCaller = appRouter.createCaller(
			await authed(test, stranger),
		) as Caller;

		const order = await placeDelivery(ready, "offers");
		const firstOffer = (await first.caller.deliveries.offers())[0];
		if (!firstOffer) throw new Error("First courier did not receive an offer");

		const acceptError = await refused(
			strangerCaller.deliveries.acceptOffer({ offerId: firstOffer.id }),
		);
		const declineError = await refused(
			strangerCaller.deliveries.declineOffer({ offerId: firstOffer.id }),
		);
		expect(acceptError.code).toBe("NOT_FOUND");
		expect(declineError.code).toBe("NOT_FOUND");

		await first.caller.deliveries.declineOffer({ offerId: firstOffer.id });
		const secondOffer = (await second.caller.deliveries.offers())[0];
		if (!secondOffer)
			throw new Error("Second courier did not receive an offer");

		const wrongCourier = await refused(
			first.caller.deliveries.acceptOffer({ offerId: secondOffer.id }),
		);
		expect(wrongCourier.code).toBe("NOT_FOUND");

		const accepted = await second.caller.deliveries.acceptOffer({
			offerId: secondOffer.id,
		});
		expect(accepted).toMatchObject({
			orderId: order.id,
			status: "ACCEPTED",
			courier: { id: second.user.id },
		});
		const storedOrder = (
			await test.db
				.select({ courierUserId: orderTable.courierUserId })
				.from(orderTable)
				.where(eq(orderTable.id, order.id))
		)[0];
		expect(storedOrder?.courierUserId).toBe(second.user.id);
		test.close();
	});

	test("cancelling the order withdraws its pending offer", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "cancel_offer");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_cancel_offer",
			lat: 9.9301,
			lng: -84.0801,
		});
		const order = await placeDelivery(ready, "cancel_offer");
		const offer = (await courier.caller.deliveries.offers())[0];
		if (!offer) throw new Error("Courier did not receive an offer");

		await ready.buyer.orders.cancel({ orderId: order.id });
		expect(await courier.caller.deliveries.offers()).toEqual([]);
		await expect(
			courier.caller.deliveries.acceptOffer({ offerId: offer.id }),
		).rejects.toThrow();
		test.close();
	});

	/**
	 * The offer is revoked by the courier's *availability*, not by their membership.
	 *
	 * This test used to delete the `COURIER` membership and assert the offer died with it.
	 * That was the old contract — the membership was the gate — and the open pool replaces
	 * it: a courier is offered work because their profile is verified and available, so
	 * those are the two facts that still withdraw an offer. Deleting a membership now
	 * changes only whether the shop's own courier is *preferred* in the ranking, which is
	 * deliberately not a permission, and asserting the offer survives is what pins that
	 * distinction down rather than leaving it to a comment.
	 *
	 * The revocation that matters is a profile going unavailable or unverified while an
	 * offer is open, because that is the window where `candidateFor` has already decided and
	 * the courier has not yet answered.
	 */
	test("going unavailable revokes a pending offer, leaving the membership does not", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "revoke_offer");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_revoke_offer",
			lat: 9.9301,
			lng: -84.0801,
		});
		await placeDelivery(ready, "revoke_offer");
		const offer = (await courier.caller.deliveries.offers())[0];
		if (!offer) throw new Error("Courier did not receive an offer");

		// Leaving the shop's roster is no longer a withdrawal: the offer was made to a
		// verified, available courier standing next to the pickup, and none of that changed.
		await test.db
			.delete(membershipTable)
			.where(
				and(
					eq(membershipTable.businessId, ready.businessId),
					eq(membershipTable.userId, courier.user.id),
				),
			);
		const stillACourier = appRouter.createCaller(
			await authed(test, courier.user),
		) as Caller;
		expect(
			(await stillACourier.deliveries.offers()).map((row) => row.id),
		).toEqual([offer.id]);

		// Going unavailable is.
		await test.db
			.update(profileTable)
			.set({ isAvailable: false })
			.where(eq(profileTable.userId, courier.user.id));
		const unavailableCaller = appRouter.createCaller(
			await authed(test, courier.user),
		) as Caller;
		expect(await unavailableCaller.deliveries.offers()).toEqual([]);
		await expect(
			unavailableCaller.deliveries.acceptOffer({ offerId: offer.id }),
		).rejects.toThrow();
		test.close();
	});
});

describe("accepted delivery lifecycle and ratings", () => {
	test("the courier collects and delivers, then both people rate once", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "lifecycle");
		const owner = await seedOwner(test, ready.businessId, "lifecycle");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_lifecycle_courier",
			lat: 9.9301,
			lng: -84.0801,
		});
		const order = await placeDelivery(ready, "lifecycle");
		const offer = (await courier.caller.deliveries.offers())[0];
		if (!offer) throw new Error("Courier did not receive an offer");
		const accepted = await courier.caller.deliveries.acceptOffer({
			offerId: offer.id,
		});

		const travelling = await courier.caller.deliveries.advance({
			deliveryId: accepted.id,
			action: "START_TO_PICKUP",
		});
		expect(travelling.status).toBe("TO_PICKUP");
		const atPickup = await courier.caller.deliveries.advance({
			deliveryId: accepted.id,
			action: "ARRIVE_PICKUP",
		});
		expect(atPickup.status).toBe("AT_PICKUP");
		expect(atPickup.arrivedPickupAt).not.toBeNull();

		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}

		const pickedUp = await courier.caller.deliveries.advance({
			deliveryId: accepted.id,
			action: "CONFIRM_PICKUP",
		});
		expect(pickedUp.status).toBe("PICKED_UP");
		expect(pickedUp.orderStatus).toBe("OUT_FOR_DELIVERY");
		expect(pickedUp.pickedUpAt).not.toBeNull();
		await courier.caller.deliveries.reportPresence({
			lat: 9.941,
			lng: -84.091,
			accuracyMeters: 6,
		});
		const tracking = await ready.buyer.orders.track({ id: order.id });
		expect(tracking.courier).toMatchObject({
			lat: 9.941,
			lng: -84.091,
		});

		const delivered = await courier.caller.deliveries.advance({
			deliveryId: accepted.id,
			action: "COMPLETE",
		});
		expect(delivered.status).toBe("DELIVERED");
		expect(delivered.orderStatus).toBe("COMPLETED");
		expect(delivered.deliveredAt).not.toBeNull();

		const customerRating = await ready.buyer.deliveries.rate({
			deliveryId: accepted.id,
			rating: 5,
			comment: "Entrega cuidadosa",
		});
		const courierRating = await courier.caller.deliveries.rate({
			deliveryId: accepted.id,
			rating: 4,
			comment: "Cliente puntual",
		});
		expect(customerRating.fromRole).toBe("CUSTOMER");
		expect(courierRating.fromRole).toBe("COURIER");

		await expect(
			ready.buyer.deliveries.rate({ deliveryId: accepted.id, rating: 3 }),
		).rejects.toThrow();
		await expect(
			courier.caller.deliveries.rate({ deliveryId: accepted.id, rating: 3 }),
		).rejects.toThrow();

		const ratings = await test.db
			.select()
			.from(ratingTable)
			.where(eq(ratingTable.deliveryId, accepted.id));
		expect(ratings).toHaveLength(2);
		expect(
			ratings.map((rating) => ({
				fromRole: rating.fromRole,
				fromUserId: rating.fromUserId,
				toUserId: rating.toUserId,
			})),
		).toEqual(
			expect.arrayContaining([
				{
					fromRole: "CUSTOMER",
					fromUserId: ready.customer.id,
					toUserId: courier.user.id,
				},
				{
					fromRole: "COURIER",
					fromUserId: courier.user.id,
					toUserId: ready.customer.id,
				},
			]),
		);
		test.close();
	});
});

/**
 * Who releases an order onto the road.
 *
 * `advance` gated the `OUT_FOR_DELIVERY` step on a delivery row merely *existing*, so a shop
 * whose run was still `SEARCHING` — nobody assigned yet — could never send a prepared order
 * out: the only person who could confirm the step was a courier who did not exist. That is
 * where `PYM-7SVRGR` sat. The gate is now about a courier in hand, and these three hold both
 * halves of that: the shop is unblocked while the run is unassigned, and the courier's rules
 * come back whole the moment somebody is carrying it.
 */
describe("releasing an order onto the road", () => {
	/**
	 * The state under test, read rather than assumed.
	 *
	 * Without this the first test could pass for the wrong reason: had no delivery row
	 * existed, `linkedDelivery` would be null and the shop's advance would sail straight
	 * through the branch this change is about. Asserting the row is there **and unassigned**
	 * is what makes the success mean anything.
	 */
	async function runFor(test: TestWorld, orderId: string) {
		const rows = await test.db
			.select({
				status: deliveryTable.status,
				courierUserId: deliveryTable.courierUserId,
			})
			.from(deliveryTable)
			.where(eq(deliveryTable.orderId, orderId));
		return rows[0];
	}

	test("an unassigned run can be delivered by the business", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "self_delivery");
		const owner = await seedOwner(test, ready.businessId, "self_delivery");
		const order = await placeDelivery(ready, "self_delivery");
		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}
		const started = await owner.orders.startSelfDelivery({
			orderId: order.id,
			expectedStatus: "READY",
		});
		expect(started.status).toBe("OUT_FOR_DELIVERY");
		expect(started.nextStatuses).not.toContain("COMPLETED");
		expect(await runFor(test, order.id)).toMatchObject({
			status: "PICKED_UP",
			courierUserId: null,
		});
		const completed = await owner.orders.completeSelfDelivery({
			orderId: order.id,
			expectedStatus: "OUT_FOR_DELIVERY",
		});
		expect(completed.status).toBe("COMPLETED");
		expect((await runFor(test, order.id))?.status).toBe("DELIVERED");
		test.close();
	});

	test("taking over an open offer cancels it before a courier can accept", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "takeover");
		const owner = await seedOwner(test, ready.businessId, "takeover");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_takeover_courier",
			lat: 9.9301,
			lng: -84.0801,
		});
		const order = await placeDelivery(ready, "takeover");
		const offer = (await courier.caller.deliveries.offers())[0];
		if (!offer) throw new Error("Courier did not receive an offer");
		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}
		await owner.orders.startSelfDelivery({
			orderId: order.id,
			expectedStatus: "READY",
		});
		expect(await courier.caller.deliveries.offers()).toEqual([]);
		expect(
			(
				await refused(
					courier.caller.deliveries.acceptOffer({ offerId: offer.id }),
				)
			).code,
		).toBe("CONFLICT");
		test.close();
	});

	test("a business can take over after sending an unassigned order out", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "late_takeover");
		const owner = await seedOwner(test, ready.businessId, "late_takeover");
		const order = await placeDelivery(ready, "late_takeover");
		for (const to of [
			"ACCEPTED",
			"PREPARING",
			"READY",
			"OUT_FOR_DELIVERY",
		] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}
		await owner.orders.startSelfDelivery({
			orderId: order.id,
			expectedStatus: "OUT_FOR_DELIVERY",
		});
		expect((await runFor(test, order.id))?.status).toBe("PICKED_UP");
		const completed = await owner.orders.completeSelfDelivery({
			orderId: order.id,
			expectedStatus: "OUT_FOR_DELIVERY",
		});
		expect(completed.status).toBe("COMPLETED");
		test.close();
	});

	test("the shop can send it out while the run is still searching for a courier", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "unassigned");
		const owner = await seedOwner(test, ready.businessId, "unassigned");
		const order = await placeDelivery(ready, "unassigned");

		const before = await runFor(test, order.id);
		expect(before).toBeDefined();
		expect(before?.courierUserId ?? null).toBeNull();

		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}

		const released = await owner.orders.advance({
			orderId: order.id,
			to: "OUT_FOR_DELIVERY",
		});
		expect(released.status).toBe("OUT_FOR_DELIVERY");

		// The run is left to the pool rather than consumed: `advance` reads the delivery
		// table and never writes it, so a courier can still accept this one.
		const after = await runFor(test, order.id);
		expect(after?.status).toBe(before?.status);
		expect(after?.courierUserId ?? null).toBeNull();

		test.close();
	});

	test("closing a delivery stays the courier's, never the shop's", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "noclose");
		const owner = await seedOwner(test, ready.businessId, "noclose");
		const order = await placeDelivery(ready, "noclose");

		for (const to of [
			"ACCEPTED",
			"PREPARING",
			"READY",
			"OUT_FOR_DELIVERY",
		] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}

		// The shop got the order onto the road and still cannot declare that it arrived.
		await expect(
			owner.orders.advance({ orderId: order.id, to: "COMPLETED" }),
		).rejects.toThrow(/repartidor/i);

		test.close();
	});

	test("once a courier is carrying it, the shop is refused again", async () => {
		const test = world();
		const ready = await orderReadyToPlace(test, "carried");
		const owner = await seedOwner(test, ready.businessId, "carried");
		const courier = await seedCourier(test, {
			businessId: ready.businessId,
			id: "usr_delivery_carried_courier",
			lat: 9.9301,
			lng: -84.0801,
		});
		const order = await placeDelivery(ready, "carried");
		const offer = (await courier.caller.deliveries.offers())[0];
		if (!offer) throw new Error("Courier did not receive an offer");
		await courier.caller.deliveries.acceptOffer({ offerId: offer.id });

		expect((await runFor(test, order.id))?.courierUserId).toBe(courier.user.id);

		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await owner.orders.advance({ orderId: order.id, to });
		}

		await expect(
			owner.orders.advance({ orderId: order.id, to: "OUT_FOR_DELIVERY" }),
		).rejects.toThrow(/repartidor/i);
		expect(
			(
				await refused(
					owner.orders.startSelfDelivery({
						orderId: order.id,
						expectedStatus: "READY",
					}),
				)
			).code,
		).toBe("CONFLICT");

		test.close();
	});
});
