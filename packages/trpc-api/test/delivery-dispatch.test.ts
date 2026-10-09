import { describe, expect, test } from "bun:test";
import {
	delivery as deliveryTable,
	merchantLocation as locationTable,
	deliveryOffer as offerTable,
	courierPresence as presenceTable,
	courierProfile as profileTable,
} from "@pymeshub/db";
import { addToCartInput } from "@pymeshub/shared";
import { eq } from "drizzle-orm";
import { appRouter } from "../src/routers";
import { sweepExpiredOffers } from "../src/services/delivery-dispatch";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;
type TestWorld = ReturnType<typeof world>;

/**
 * `sweepExpiredOffers`: the offer nobody answered.
 *
 * ## Why this file exists and is narrow
 *
 * `test/deliveries.test.ts` covers the pool in depth - nearest-courier determinism, the
 * `preferred` rank, out-of-radius refusal, a courier with no coordinates, dispatch on coming
 * online, offer authorization, availability revoking a pending offer. It never mentions
 * expiry, and `sweepExpiredOffers` is the only thing that expires an offer.
 *
 * That function runs from the Worker's `scheduled` handler (`src/index.ts`), so it is not on
 * any request path and no test reaches it by calling a procedure. Every claim about it is a
 * claim about time passing, which is why these tests move `expiresAt` rather than wait: the
 * clock in a test is the only honest way to say "two minutes went by" without two minutes
 * going by.
 *
 * ## The three things that must not happen
 *
 * - **An answered offer is swept.** The query filters `status = PENDING`, so an offer the
 *   courier accepted a second ago and whose `expiresAt` has since passed must survive. Its
 *   delivery is `ACCEPTED`, and the reset is guarded by `status = 'OFFERED'`, so neither row
 *   moves. This is the one that would steal a run from a courier who had it.
 * - **The same courier is offered the same delivery twice.** `candidateFor` excludes every
 *   courier who already has *any* offer row for this delivery, not just a pending one, so a
 *   sweep that re-dispatches cannot hand the run straight back to whoever let it lapse.
 * - **A delivery with no eligible candidate is marked `OFFERED`.** `dispatchNext` returns
 *   without a candidate and the delivery stays `SEARCHING`, which is the honest state: it is
 *   still looking.
 *
 * ## Two rules of the pool that shape every fixture here
 *
 * - **A courier holds one live offer at a time.** `candidateFor`'s `pendingOffers` counts
 *   every unexpired `PENDING` offer a courier has, across all deliveries, so two orders need
 *   two couriers. A fixture with one courier and two orders dispatches the second to nobody
 *   and then fails on something that is not the sweep.
 * - **A courier who has ever been offered a delivery is not offered it again**, expired
 *   offers included. That is what stops a sweep from handing the same run straight back to
 *   whoever let it lapse, and it is why the re-dispatch below always names somebody else.
 */

const MINUTE = 60 * 1000;

/** A shop with a stocked product, a located customer, and a cart ready to place. */
async function shopWithBasket(test: TestWorld, tag: string) {
	const businessId = await seedBusiness(test.db, {
		id: `biz_sweep_${tag}`,
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
		id: `prd_sweep_${tag}`,
		businessId,
		priceMinor: 2_500,
	});
	const customer = await seedUser(test.db, {
		id: `usr_sweep_${tag}_customer`,
		name: `Cliente ${tag}`,
		phone: "+506 6000 0001",
	});
	const buyer = appRouter.createCaller(await authed(test, customer)) as Caller;
	const address = await buyer.users.saveAddress({
		label: "Casa",
		line1: "Calle 5, casa 12",
		city: "San José",
		region: "San José",
		lat: 9.94,
		lng: -84.09,
		phone: "+506 6000 0001",
	});
	return { businessId, locationId, product, buyer, address };
}

/**
 * A courier standing somewhere, with a fresh ping.
 *
 * `lat`/`lng` are the only things a test changes between two eligible couriers: presence is
 * what makes somebody a candidate at all, and the profile and membership rows are what make
 * them a *particular* candidate.
 */
async function courierAt(
	test: TestWorld,
	input: {
		businessId: string;
		id: string;
		lat: number;
		lng: number;
		presenceAt?: Date;
		isAvailable?: boolean;
	},
) {
	const user = await seedUser(test.db, {
		id: input.id,
		phone: "+506 7000 0001",
	});
	await seedMembership(test.db, user.id, input.businessId, "COURIER");
	const now = new Date();
	await test.db.insert(profileTable).values({
		id: `cpr_${input.id}`,
		userId: user.id,
		displayName: `Courier ${input.id}`,
		serviceArea: "San José",
		isAvailable: input.isAvailable ?? true,
		verificationStatus: "VERIFIED",
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

/**
 * Place one delivery order, which creates the `delivery` row and dispatches it in the same
 * batch.
 *
 * **The basket is filled here rather than in the fixture**, because `orders.place` empties
 * it: a fixture that stocked the cart once could place exactly one order, and a test that
 * wants two deliveries - which is what the sweep's `limit` is about - would fail on
 * `emptyCart` instead of on anything to do with expiry.
 */
async function placeAndRead(
	test: TestWorld,
	ready: Awaited<ReturnType<typeof shopWithBasket>>,
	orderTag: string,
) {
	await ready.buyer.cart.addItem(
		addToCartInput.parse({ productId: ready.product.id, quantity: 1 }),
	);
	const order = await ready.buyer.orders.place({
		fulfilment: "DELIVERY",
		locationId: ready.locationId,
		addressId: ready.address.id,
		paymentMethod: "CASH",
		clientRequestId: `request_sweep_${orderTag}`,
	});
	const delivery = (
		await test.db
			.select()
			.from(deliveryTable)
			.where(eq(deliveryTable.orderId, order.id))
	)[0];
	if (!delivery) throw new Error("Delivery was not created");
	return { order, delivery };
}

const offersFor = (test: TestWorld, deliveryId: string) =>
	test.db
		.select()
		.from(offerTable)
		.where(eq(offerTable.deliveryId, deliveryId));

/**
 * The first offer for a delivery, or a thrown error rather than an optional.
 *
 * Every assertion below is about a row the dispatch just wrote, so a missing one is a broken
 * fixture rather than a thing to assert about — and `expect(offer).toBeUndefined()` reads as
 * a finding when it is really a mistake three lines earlier.
 */
async function firstOffer(test: TestWorld, deliveryId: string) {
	const [offer] = await offersFor(test, deliveryId);
	if (!offer) throw new Error(`No offer was created for ${deliveryId}`);
	return offer;
}

const statusOf = async (test: TestWorld, deliveryId: string) =>
	(
		await test.db
			.select({ status: deliveryTable.status })
			.from(deliveryTable)
			.where(eq(deliveryTable.id, deliveryId))
	)[0]?.status;

/** The offer is now older than its TTL. The clock is the only thing a test can move. */
async function ageOffer(test: TestWorld, offerId: string) {
	await test.db
		.update(offerTable)
		.set({ expiresAt: new Date(Date.now() - MINUTE) })
		.where(eq(offerTable.id, offerId));
}

describe("sweepExpiredOffers", () => {
	test("a nearby presence ping recovers an expired offer without a scheduled tick", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "presence_recovery");
		await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_presence_first",
			lat: 9.9301,
			lng: -84.0801,
		});
		const next = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_presence_next",
			lat: 9.9302,
			lng: -84.0802,
		});
		const { delivery } = await placeAndRead(test, ready, "presence_recovery");
		const first = await firstOffer(test, delivery.id);
		await ageOffer(test, first.id);
		await next.caller.deliveries.reportPresence({ lat: 9.9302, lng: -84.0802 });
		const offers = await next.caller.deliveries.offers();
		expect(offers).toHaveLength(1);
		expect(offers[0]?.deliveryId).toBe(delivery.id);
		expect((await firstOffer(test, delivery.id)).status).toBe("EXPIRED");
		test.close();
	});
	test("a timed-out offer expires and its delivery goes back to looking", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "expiry");
		await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_expiry_near",
			lat: 9.9301,
			lng: -84.0801,
		});
		const { delivery } = await placeAndRead(test, ready, "expiry");

		expect(await statusOf(test, delivery.id)).toBe("OFFERED");
		const first = await firstOffer(test, delivery.id);

		await ageOffer(test, first.id);
		await sweepExpiredOffers(test.db);

		const swept = await firstOffer(test, delivery.id);
		// **`respondedAt` and not just the status**, because a sweeper that wrote the status
		// and forgot the timestamp would leave an offer that expired at some moment nobody
		// could name - and this column is how a shop answers "when did they see it".
		expect(swept).toMatchObject({ status: "EXPIRED" });
		expect(swept.respondedAt).toBeInstanceOf(Date);
		// No candidate is left, so the run is `SEARCHING` again rather than left `OFFERED`
		// to an offer nobody holds.
		expect(await statusOf(test, delivery.id)).toBe("SEARCHING");

		test.close();
	});

	test("the re-dispatch reaches the next courier and never the one who let it lapse", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "next");
		const near = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_next_near",
			lat: 9.9301,
			lng: -84.0801,
		});
		const second = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_next_second",
			lat: 9.9302,
			lng: -84.0802,
		});
		const { delivery } = await placeAndRead(test, ready, "next");

		const first = await firstOffer(test, delivery.id);
		expect(first.courierUserId).toBe(near.user.id);

		await ageOffer(test, first.id);
		await sweepExpiredOffers(test.db);

		// **`candidateFor` excludes every courier who already has an offer row for this
		// delivery**, expired or not, so the sweep cannot hand the run straight back to
		// whoever let it lapse. Without that exclusion this loop would never end: one courier,
		// one delivery, one offer at a time, forever.
		const after = await offersFor(test, delivery.id);
		expect(after).toHaveLength(2);
		const [, fresh] = after;
		if (!fresh) throw new Error("The second offer was not created");
		expect(after[0]).toMatchObject({ status: "EXPIRED" });
		expect(fresh).toMatchObject({
			status: "PENDING",
			courierUserId: second.user.id,
		});
		expect(fresh.id).not.toBe(first.id);
		expect(await statusOf(test, delivery.id)).toBe("OFFERED");

		// And the second courier really is looking at it, which is what makes it an offer
		// rather than a row: the bell row and the courier's own read both name it.
		expect(
			(await second.caller.deliveries.offers()).map((offer) => offer.id),
		).toEqual([fresh.id]);

		test.close();
	});

	test("a delivery whose only candidate has gone stale is left looking, not quietly offered", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "stale");
		const only = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_stale_only",
			lat: 9.9301,
			lng: -84.0801,
		});
		const { delivery } = await placeAndRead(test, ready, "stale");
		const first = await firstOffer(test, delivery.id);

		// The courier walks away: their ping ages past `PRESENCE_FRESH_MS`, which is two
		// minutes and the same window `candidateFor` reads.
		await test.db
			.update(presenceTable)
			.set({ updatedAt: new Date(Date.now() - 5 * MINUTE) })
			.where(eq(presenceTable.userId, only.user.id));

		await ageOffer(test, first.id);
		await sweepExpiredOffers(test.db);

		// **`SEARCHING` is the honest state**, and `OFFERED` would be a lie: no courier holds
		// an offer, the courier's own `offers()` read is empty, and the run is still waiting
		// for somebody who is actually standing there.
		expect(await statusOf(test, delivery.id)).toBe("SEARCHING");
		expect(await offersFor(test, delivery.id)).toHaveLength(1);
		expect(await only.caller.deliveries.offers()).toHaveLength(0);

		test.close();
	});

	test("an offer inside its window is not touched", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "live");
		await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_live_near",
			lat: 9.9301,
			lng: -84.0801,
		});
		const { delivery } = await placeAndRead(test, ready, "live");
		const offer = await firstOffer(test, delivery.id);

		await sweepExpiredOffers(test.db);

		// The query is `expiresAt < now`, so a live offer is invisible to the sweep. This is
		// the assertion that `OFFER_TTL_MS` is a real promise and not a formality: a sweep
		// that ran on a schedule shorter than the TTL would take offers nobody had seen.
		expect(await statusOf(test, delivery.id)).toBe("OFFERED");
		expect((await offersFor(test, delivery.id))[0]).toMatchObject({
			status: "PENDING",
			id: offer.id,
		});

		test.close();
	});

	test("an offer already answered is never swept, and its delivery is left alone", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "answered");
		const winner = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_answered_winner",
			lat: 9.9301,
			lng: -84.0801,
		});
		const { delivery } = await placeAndRead(test, ready, "answered");
		const offer = await firstOffer(test, delivery.id);

		await winner.caller.deliveries.acceptOffer({ offerId: offer.id });
		expect(await statusOf(test, delivery.id)).toBe("ACCEPTED");

		// The accepted offer's `expiresAt` sails past - nobody cancels it, so it is still
		// there two minutes later sitting on a TTL it no longer needs.
		await ageOffer(test, offer.id);
		await sweepExpiredOffers(test.db);

		// **The one that would steal a run.** `status = PENDING` keeps it out of the sweep,
		// and the delivery reset is guarded by `status = 'OFFERED'`, so an `ACCEPTED` run is
		// not thrown back into the pool to be offered to the next courier standing nearby.
		expect((await offersFor(test, delivery.id))[0]).toMatchObject({
			status: "ACCEPTED",
			id: offer.id,
		});
		expect(await statusOf(test, delivery.id)).toBe("ACCEPTED");

		test.close();
	});

	test("the sweep is bounded, and takes the oldest expiry first", async () => {
		const test = world();
		const ready = await shopWithBasket(test, "bounded");
		// **Two couriers for two deliveries, and that is the rule rather than a convenience.**
		// `candidateFor` counts every *live* pending offer a courier holds across all
		// deliveries, so one courier cannot be offered a second run while the first offer is
		// still open. With a single courier the second order would have been dispatched to
		// nobody, and this test would be asserting `emptyCart`-shaped fixture breakage rather
		// than anything about expiry.
		const first = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_bounded_first",
			lat: 9.9301,
			lng: -84.0801,
		});
		const second = await courierAt(test, {
			businessId: ready.businessId,
			id: "usr_sweep_bounded_second",
			lat: 9.9302,
			lng: -84.0802,
		});

		// Two orders, two deliveries, two offers, expiring at different times. The oldest is
		// first on purpose: `orderBy(asc(expiresAt))` means the limit is spent on the runs
		// that have been waiting longest, which is the whole reason the sweep has a limit.
		const older = await placeAndRead(test, ready, "bounded_older");
		const newer = await placeAndRead(test, ready, "bounded_newer");
		const olderOffer = await firstOffer(test, older.delivery.id);
		const newerOffer = await firstOffer(test, newer.delivery.id);
		expect(olderOffer.courierUserId).toBe(first.user.id);
		expect(newerOffer.courierUserId).toBe(second.user.id);

		await ageOffer(test, newerOffer.id);
		await test.db
			.update(offerTable)
			.set({ expiresAt: new Date(Date.now() - 5 * MINUTE) })
			.where(eq(offerTable.id, olderOffer.id));

		await sweepExpiredOffers(test.db, 1);

		// Only the older one went, and it is the older one: the delivery whose offer expired
		// five minutes ago rather than one.
		expect(
			(await offersFor(test, older.delivery.id)).find(
				(offer) => offer.id === olderOffer.id,
			),
		).toMatchObject({
			status: "EXPIRED",
		});
		expect(
			(await offersFor(test, newer.delivery.id)).find(
				(offer) => offer.id === newerOffer.id,
			),
		).toMatchObject({
			status: "PENDING",
		});
		expect(await statusOf(test, newer.delivery.id)).toBe("OFFERED");

		// **The older run is re-offered, and to the other courier.** Its own courier is excluded
		// for having an offer row on this delivery - expired or not - while the second is now
		// free, because ageing its offer for the limit assertion took it out of
		// `pendingOffers`' window as well. The "nobody eligible, leave it `SEARCHING`" case is
		// its own test above; here the point is that the re-dispatch reaches somebody new.
		const reofferedOlder = await offersFor(test, older.delivery.id);
		expect(reofferedOlder).toHaveLength(2);
		expect(
			reofferedOlder.find((offer) => offer.id !== olderOffer.id),
		).toMatchObject({
			status: "PENDING",
			courierUserId: second.user.id,
		});
		expect(await statusOf(test, older.delivery.id)).toBe("OFFERED");

		// The next run takes the second one, so the limit is a per-invocation budget and not
		// a queue that has to be drained by hand. Nothing is left pending anywhere by now, so
		// the newer run goes back to the first courier - not to the one who just let this
		// lapse.
		await sweepExpiredOffers(test.db);
		expect(
			(await offersFor(test, newer.delivery.id)).find(
				(offer) => offer.id === newerOffer.id,
			),
		).toMatchObject({
			status: "EXPIRED",
		});
		const reoffered = await offersFor(test, newer.delivery.id);
		expect(reoffered).toHaveLength(2);
		expect(reoffered.find((offer) => offer.id !== newerOffer.id)).toMatchObject(
			{
				status: "PENDING",
				courierUserId: first.user.id,
			},
		);
		expect(await statusOf(test, newer.delivery.id)).toBe("OFFERED");

		test.close();
	});
});
