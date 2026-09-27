import { describe, expect, test } from "bun:test";
import {
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

describe("delivery offer authorization", () => {
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

	test("revoking courier membership also revokes a pending offer", async () => {
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

		await test.db
			.delete(membershipTable)
			.where(
				and(
					eq(membershipTable.businessId, ready.businessId),
					eq(membershipTable.userId, courier.user.id),
				),
			);
		const revokedCaller = appRouter.createCaller(
			await authed(test, courier.user),
		) as Caller;
		expect(await revokedCaller.deliveries.offers()).toEqual([]);
		await expect(
			revokedCaller.deliveries.acceptOffer({ offerId: offer.id }),
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
