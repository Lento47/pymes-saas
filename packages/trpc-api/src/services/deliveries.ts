import {
	boundingBox,
	business as businessTable,
	delivery as deliveryTable,
	haversineKm,
	deliveryOffer as offerTable,
	order as orderTable,
	courierPresence as presenceTable,
	courierProfile as profileTable,
	deliveryRating as ratingTable,
	user as userTable,
} from "@pymeshub/db";
import type {
	CourierPresenceInput,
	DeliveryDetail,
	DeliveryOffer,
	DeliveryRating,
	RateDeliveryInput,
} from "@pymeshub/shared";
import { newId } from "@pymeshub/shared";
import {
	and,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	lte,
	ne,
	sql,
} from "drizzle-orm";

import { ConflictError, NotFoundError, ValidationError } from "../errors";
import {
	dispatchNext,
	OFFER_RADIUS_KM,
	sweepExpiredOffers,
} from "./delivery-dispatch";
import type { UserContext } from "./helpers";
import { batchOf } from "./helpers";
import * as orders from "./orders";

const VISIBLE_MINE_STATUSES = [
	"ACCEPTED",
	"TO_PICKUP",
	"AT_PICKUP",
	"PICKED_UP",
	"DELIVERED",
] as const;

/**
 * Post where the courier is, which is also what puts them in the dispatch pool.
 *
 * **The gate is the profile and nothing else.** It used to be the profile *and* a COURIER
 * membership of some business, which meant a verified courier who no shop had added could
 * not say where they were — and since fresh presence is what `candidateFor` requires, they
 * could not be offered work either. The membership is gone from this check because it no
 * longer decides anything: the pool is every verified available courier, so the only
 * questions worth asking here are "are you really a courier" and "are you taking work".
 */
export async function reportPresence(
	ctx: UserContext,
	input: CourierPresenceInput,
): Promise<{ updatedAt: Date }> {
	const allowed = (
		await ctx.db
			.select({ id: profileTable.id })
			.from(profileTable)
			.where(
				and(
					eq(profileTable.userId, ctx.user.id),
					eq(profileTable.verificationStatus, "VERIFIED"),
					eq(profileTable.isAvailable, true),
				),
			)
			.limit(1)
	)[0];
	if (!allowed) {
		throw new ValidationError(
			"Tu perfil debe estar verificado y disponible para recibir entregas",
		);
	}

	const updatedAt = new Date();
	await ctx.db
		.insert(presenceTable)
		.values({
			id: newId("courierPresence"),
			userId: ctx.user.id,
			lat: input.lat,
			lng: input.lng,
			accuracyMeters: input.accuracyMeters ?? null,
			updatedAt,
		})
		.onConflictDoUpdate({
			target: presenceTable.userId,
			set: {
				lat: input.lat,
				lng: input.lng,
				accuracyMeters: input.accuracyMeters ?? null,
				updatedAt,
			},
		});

	const active = (
		await ctx.db
			.select({ orderId: deliveryTable.orderId })
			.from(deliveryTable)
			.where(
				and(
					eq(deliveryTable.courierUserId, ctx.user.id),
					eq(deliveryTable.status, "PICKED_UP"),
				),
			)
			.limit(1)
	)[0];
	if (active) {
		await ctx.db
			.update(orderTable)
			.set({
				courierLat: input.lat,
				courierLng: input.lng,
				courierAt: updatedAt,
				updatedAt,
			})
			.where(eq(orderTable.id, active.orderId));
	}

	// Coming online is the moment a waiting delivery can be filled, and this is the only
	// place it can be noticed without waiting for the sweep.
	//
	// **It asks "what is near me" rather than "what belongs to my shops"**, which is the
	// same widening the pool got: with the membership gone, "my shops" is an empty list for
	// most couriers and this loop would do nothing at all. The radius is the courier's own
	// position — the coordinates just posted above — and the pickups are the deliveries that
	// could plausibly be theirs, so a courier who comes online in San José offers themselves
	// to San José's waiting deliveries and to nobody else's.
	const nearby = boundingBox(input.lat, input.lng, OFFER_RADIUS_KM);
	// Local development has no automatic scheduled tick. A bounded nearby sweep
	// lets a fresh courier ping recover offers that expired while nobody was online.
	await sweepExpiredOffers(ctx.db, 10, { lat: input.lat, lng: input.lng });
	const waiting = await ctx.db
		.select({ id: deliveryTable.id })
		.from(deliveryTable)
		.where(
			and(
				eq(deliveryTable.status, "SEARCHING"),
				// A pickup with no coordinates has no radius to be near, so it is not in this
				// box and not in the pool either — `candidateFor` refuses it for the same
				// reason. It waits for a manager to assign it.
				isNotNull(deliveryTable.pickupLat),
				gte(deliveryTable.pickupLat, nearby.minLat),
				lte(deliveryTable.pickupLat, nearby.maxLat),
				gte(deliveryTable.pickupLng, nearby.minLng),
				lte(deliveryTable.pickupLng, nearby.maxLng),
			),
		)
		.orderBy(deliveryTable.createdAt)
		.limit(10);
	for (const delivery of waiting) {
		// `dispatchNext` re-reads the delivery and re-ranks, so this costs a query per row
		// and the limit is what bounds it. Ten is the same bound the old version used.
		await dispatchNext(ctx.db, delivery.id);
	}
	return { updatedAt };
}

/** Search the pinned work area when a courier opens the board or comes available. */
export async function requestOffers(
	ctx: UserContext,
): Promise<{ checked: number }> {
	const [profile] = await ctx.db
		.select({
			zoneLat: profileTable.zoneLat,
			zoneLng: profileTable.zoneLng,
			zoneRadiusKm: profileTable.zoneRadiusKm,
		})
		.from(profileTable)
		.where(
			and(
				eq(profileTable.userId, ctx.user.id),
				eq(profileTable.verificationStatus, "VERIFIED"),
				eq(profileTable.isAvailable, true),
			),
		)
		.limit(1);
	if (
		profile?.zoneLat == null ||
		profile.zoneLng == null ||
		profile.zoneRadiusKm == null
	) {
		throw new ValidationError("Activa tu perfil y marca una zona de reparto");
	}
	const center = { lat: profile.zoneLat, lng: profile.zoneLng };
	const box = boundingBox(center.lat, center.lng, profile.zoneRadiusKm);
	await sweepExpiredOffers(ctx.db, 10, center);
	const waiting = await ctx.db
		.select({
			id: deliveryTable.id,
			pickupLat: deliveryTable.pickupLat,
			pickupLng: deliveryTable.pickupLng,
			dropoffLat: deliveryTable.dropoffLat,
			dropoffLng: deliveryTable.dropoffLng,
		})
		.from(deliveryTable)
		.where(
			and(
				eq(deliveryTable.status, "SEARCHING"),
				gte(deliveryTable.pickupLat, box.minLat),
				lte(deliveryTable.pickupLat, box.maxLat),
				gte(deliveryTable.pickupLng, box.minLng),
				lte(deliveryTable.pickupLng, box.maxLng),
				gte(deliveryTable.dropoffLat, box.minLat),
				lte(deliveryTable.dropoffLat, box.maxLat),
				gte(deliveryTable.dropoffLng, box.minLng),
				lte(deliveryTable.dropoffLng, box.maxLng),
			),
		)
		.orderBy(deliveryTable.createdAt)
		.limit(50);
	let checked = 0;
	for (const delivery of waiting) {
		if (
			delivery.pickupLat == null ||
			delivery.pickupLng == null ||
			delivery.dropoffLat == null ||
			delivery.dropoffLng == null ||
			haversineKm(center, {
				lat: delivery.pickupLat,
				lng: delivery.pickupLng,
			}) > profile.zoneRadiusKm ||
			haversineKm(center, {
				lat: delivery.dropoffLat,
				lng: delivery.dropoffLng,
			}) > profile.zoneRadiusKm
		)
			continue;
		await dispatchNext(ctx.db, delivery.id);
		checked += 1;
		if (checked === 10) break;
	}
	return { checked };
}

/**
 * The offers addressed to this courier and still open.
 *
 * **No business filter, and the offer row is the whole authorization.** An offer exists
 * only because `candidateFor` chose this person — verified, available, standing nearby,
 * not already carrying something — so `courierUserId = me` is a stronger statement than
 * "courierUserId = me AND I work for this shop". The old filter also made the read return
 * an empty array for anyone the pool had stopped considering, which is the same answer as
 * "you have no offers" and hides a real problem.
 */
export async function offers(ctx: UserContext): Promise<DeliveryOffer[]> {
	const eligible = (
		await ctx.db
			.select({ id: profileTable.id })
			.from(profileTable)
			.where(
				and(
					eq(profileTable.userId, ctx.user.id),
					eq(profileTable.verificationStatus, "VERIFIED"),
					eq(profileTable.isAvailable, true),
				),
			)
			.limit(1)
	)[0];
	if (!eligible) return [];

	const now = new Date();
	const rows = await ctx.db
		.select({
			offer: offerTable,
			delivery: deliveryTable,
			orderReference: orderTable.reference,
			businessName: businessTable.name,
		})
		.from(offerTable)
		.innerJoin(deliveryTable, eq(deliveryTable.id, offerTable.deliveryId))
		.innerJoin(orderTable, eq(orderTable.id, deliveryTable.orderId))
		.innerJoin(businessTable, eq(businessTable.id, deliveryTable.businessId))
		.where(
			and(
				eq(offerTable.courierUserId, ctx.user.id),
				eq(offerTable.status, "PENDING"),
				gt(offerTable.expiresAt, now),
				eq(deliveryTable.status, "OFFERED"),
			),
		)
		.orderBy(desc(offerTable.createdAt));

	return rows.map(({ offer, delivery, orderReference, businessName }) => ({
		id: offer.id,
		deliveryId: delivery.id,
		orderId: delivery.orderId,
		orderReference,
		businessName,
		status: offer.status,
		pickup: pickupOf(delivery),
		dropoffArea: [delivery.dropoffCity, delivery.dropoffRegion]
			.filter(Boolean)
			.join(", "),
		distanceToPickupKm: offer.distanceToPickupKm,
		expiresAt: offer.expiresAt,
		createdAt: offer.createdAt,
	}));
}

export async function acceptOffer(
	ctx: UserContext,
	input: { offerId: string },
): Promise<DeliveryDetail> {
	const offer = (
		await ctx.db
			.select()
			.from(offerTable)
			.where(
				and(
					eq(offerTable.id, input.offerId),
					eq(offerTable.courierUserId, ctx.user.id),
				),
			)
			.limit(1)
	)[0];
	if (!offer) throw new NotFoundError();
	const deliveryRow = (
		await ctx.db
			.select({ orderId: deliveryTable.orderId })
			.from(deliveryTable)
			.where(eq(deliveryTable.id, offer.deliveryId))
			.limit(1)
	)[0];
	if (!deliveryRow) throw new NotFoundError();

	const profile = (
		await ctx.db
			.select({
				displayName: profileTable.displayName,
				isAvailable: profileTable.isAvailable,
				verificationStatus: profileTable.verificationStatus,
			})
			.from(profileTable)
			.where(eq(profileTable.userId, ctx.user.id))
			.limit(1)
	)[0];
	// The gate is the offer and the profile. The offer was created by `candidateFor`, which
	// already decided this person is verified, available, nearby and free; the two conditions
	// re-checked here are the ones that can have changed in the minutes since — the courier
	// went offline, or an admin revoked the profile while the offer sat open.
	//
	// `NotFoundError` rather than `ValidationError` on purpose, and it is the pre-existing
	// choice: a courier probing an offer they were not given must not learn whether it
	// exists, which is the same reason a fabricated id is a 404 elsewhere in this file.
	if (!profile?.isAvailable || profile.verificationStatus !== "VERIFIED") {
		throw new NotFoundError();
	}
	const now = new Date();
	// `now.getTime()` below rather than `now`: `expires_at` is `integer(…, { mode:
	// "timestamp_ms" })` and D1's `bind()` takes a number, not a `Date`. Same bug as the one
	// that made `admin.subscriptions` answer 500 — see `periodsSqlFor` in `admin.ts`.
	const validOffer = sql`exists (
		select 1 from ${offerTable}
		where ${offerTable.id} = ${input.offerId}
		and ${offerTable.deliveryId} = ${offer.deliveryId}
		and ${offerTable.courierUserId} = ${ctx.user.id}
		and ${offerTable.status} = 'PENDING'
		and ${offerTable.expiresAt} > ${now.getTime()}
	)`;
	const acceptedDelivery = sql`exists (
		select 1 from ${deliveryTable}
		where ${deliveryTable.id} = ${offer.deliveryId}
		and ${deliveryTable.status} = 'ACCEPTED'
		and ${deliveryTable.courierUserId} = ${ctx.user.id}
	)`;

	try {
		await ctx.db.batch(
			batchOf([
				ctx.db
					.update(deliveryTable)
					.set({
						status: "ACCEPTED",
						courierUserId: ctx.user.id,
						acceptedAt: now,
						updatedAt: now,
					})
					.where(
						and(
							eq(deliveryTable.id, offer.deliveryId),
							eq(deliveryTable.status, "OFFERED"),
							validOffer,
						),
					),
				ctx.db
					.update(offerTable)
					.set({ status: "ACCEPTED", respondedAt: now })
					.where(
						and(
							eq(offerTable.id, input.offerId),
							eq(offerTable.status, "PENDING"),
							gt(offerTable.expiresAt, now),
							acceptedDelivery,
						),
					),
				ctx.db
					.update(offerTable)
					.set({ status: "CANCELLED", respondedAt: now })
					.where(
						and(
							eq(offerTable.deliveryId, offer.deliveryId),
							ne(offerTable.id, input.offerId),
							eq(offerTable.status, "PENDING"),
							acceptedDelivery,
						),
					),
				ctx.db
					.update(orderTable)
					.set({
						courierUserId: ctx.user.id,
						courierName: profile?.displayName ?? ctx.user.name,
						courierPhone: ctx.user.phone,
						updatedAt: now,
					})
					.where(and(eq(orderTable.id, deliveryRow.orderId), acceptedDelivery)),
			]),
		);
	} catch (error) {
		const failure = String(error);
		if (
			failure.includes("delivery_courier_active_unique") ||
			failure.includes("UNIQUE constraint failed: delivery.courier_user_id")
		) {
			throw new ConflictError("Ya tienes una entrega activa");
		}
		if (!failure.includes("delivery_offer_accepted_unique")) throw error;
	}

	const accepted = await readDetail(ctx, offer.deliveryId);
	if (accepted.courier?.id !== ctx.user.id) {
		throw new ConflictError("Esta entrega ya fue aceptada por otra persona");
	}
	return accepted;
}

export async function declineOffer(
	ctx: UserContext,
	input: { offerId: string },
): Promise<{ ok: true }> {
	const offer = (
		await ctx.db
			.select()
			.from(offerTable)
			.where(
				and(
					eq(offerTable.id, input.offerId),
					eq(offerTable.courierUserId, ctx.user.id),
				),
			)
			.limit(1)
	)[0];
	if (!offer) throw new NotFoundError();
	if (offer.status !== "PENDING") {
		throw new ConflictError("Esta oferta ya no está disponible");
	}
	const now = new Date();
	await ctx.db.batch(
		batchOf([
			ctx.db
				.update(offerTable)
				.set({ status: "DECLINED", respondedAt: now })
				.where(
					and(
						eq(offerTable.id, input.offerId),
						eq(offerTable.status, "PENDING"),
					),
				),
			ctx.db
				.update(deliveryTable)
				.set({ status: "SEARCHING", updatedAt: now })
				.where(
					and(
						eq(deliveryTable.id, offer.deliveryId),
						eq(deliveryTable.status, "OFFERED"),
					),
				),
		]),
	);
	await dispatchNext(ctx.db, offer.deliveryId);
	return { ok: true };
}

export async function mine(ctx: UserContext): Promise<DeliveryDetail[]> {
	const rows = await ctx.db
		.select({ id: deliveryTable.id })
		.from(deliveryTable)
		.where(
			and(
				eq(deliveryTable.courierUserId, ctx.user.id),
				inArray(deliveryTable.status, VISIBLE_MINE_STATUSES),
			),
		)
		.orderBy(desc(deliveryTable.updatedAt))
		.limit(30);
	return Promise.all(rows.map((row) => readDetail(ctx, row.id)));
}

export async function byId(
	ctx: UserContext,
	input: { deliveryId: string },
): Promise<DeliveryDetail> {
	return readDetail(ctx, input.deliveryId);
}

export async function byOrder(
	ctx: UserContext,
	input: { orderId: string },
): Promise<DeliveryDetail | null> {
	const row = (
		await ctx.db
			.select({ id: deliveryTable.id })
			.from(deliveryTable)
			.where(eq(deliveryTable.orderId, input.orderId))
			.limit(1)
	)[0];
	return row ? readDetail(ctx, row.id) : null;
}

export async function advance(
	ctx: UserContext,
	input: {
		deliveryId: string;
		action: "START_TO_PICKUP" | "ARRIVE_PICKUP" | "CONFIRM_PICKUP" | "COMPLETE";
	},
): Promise<DeliveryDetail> {
	const current = await readDetail(ctx, input.deliveryId);
	if (current.courier?.id !== ctx.user.id) throw new NotFoundError();
	const now = new Date();

	if (input.action === "START_TO_PICKUP") {
		await transition(ctx, current.id, "ACCEPTED", "TO_PICKUP", {
			startedToPickupAt: now,
		});
	} else if (input.action === "ARRIVE_PICKUP") {
		await transition(ctx, current.id, "TO_PICKUP", "AT_PICKUP", {
			arrivedPickupAt: now,
		});
	} else if (input.action === "CONFIRM_PICKUP") {
		if (current.status !== "AT_PICKUP") {
			throw new ConflictError(
				"Esta entrega todavía no está lista para recoger",
			);
		}
		if (current.orderStatus === "READY") {
			await orders.advance(ctx, {
				orderId: current.orderId,
				to: "OUT_FOR_DELIVERY",
				expectedStatus: "READY",
			});
		} else if (current.orderStatus === "OUT_FOR_DELIVERY") {
			await transition(ctx, current.id, "AT_PICKUP", "PICKED_UP", {
				pickedUpAt: now,
			});
		} else {
			throw new ConflictError(
				"El negocio todavía no marcó el pedido como listo",
			);
		}
	} else {
		if (current.status !== "PICKED_UP") {
			throw new ConflictError("Confirma la recogida antes de entregar");
		}
		if (current.orderStatus === "OUT_FOR_DELIVERY") {
			await orders.advance(ctx, {
				orderId: current.orderId,
				to: "COMPLETED",
				expectedStatus: "OUT_FOR_DELIVERY",
			});
		} else if (current.orderStatus === "COMPLETED") {
			await transition(ctx, current.id, "PICKED_UP", "DELIVERED", {
				deliveredAt: now,
			});
		} else {
			throw new ConflictError("Este pedido no está en camino");
		}
	}

	return readDetail(ctx, current.id);
}

export async function rate(
	ctx: UserContext,
	input: RateDeliveryInput,
): Promise<DeliveryRating> {
	const delivery = await readDetail(ctx, input.deliveryId);
	if (delivery.status !== "DELIVERED") {
		throw new ValidationError("Solo puedes calificar una entrega terminada");
	}
	const fromRole: "CUSTOMER" | "COURIER" | null =
		delivery.customer.id === ctx.user.id
			? "CUSTOMER"
			: delivery.courier?.id === ctx.user.id
				? "COURIER"
				: null;
	if (!fromRole || !delivery.courier) throw new NotFoundError();
	const toUserId =
		fromRole === "CUSTOMER" ? delivery.courier.id : delivery.customer.id;
	const row = {
		id: newId("deliveryRating"),
		deliveryId: delivery.id,
		fromUserId: ctx.user.id,
		toUserId,
		fromRole,
		rating: input.rating,
		comment: input.comment?.trim() || null,
		createdAt: new Date(),
	};
	try {
		await ctx.db.insert(ratingTable).values(row);
	} catch (error) {
		if (String(error).includes("delivery_rating_direction_unique")) {
			throw new ConflictError("Ya calificaste esta entrega");
		}
		throw error;
	}
	return ratingOf(row);
}

async function transition(
	ctx: UserContext,
	deliveryId: string,
	from: "ACCEPTED" | "TO_PICKUP" | "AT_PICKUP" | "PICKED_UP",
	to: "TO_PICKUP" | "AT_PICKUP" | "PICKED_UP" | "DELIVERED",
	stamp: Record<string, Date>,
): Promise<void> {
	const changed = await ctx.db
		.update(deliveryTable)
		.set({ status: to, updatedAt: new Date(), ...stamp })
		.where(
			and(
				eq(deliveryTable.id, deliveryId),
				eq(deliveryTable.courierUserId, ctx.user.id),
				eq(deliveryTable.status, from),
			),
		)
		.returning({ id: deliveryTable.id });
	if (!changed[0])
		throw new ConflictError("La entrega cambió en otro dispositivo");
}

async function readDetail(
	ctx: UserContext,
	deliveryId: string,
): Promise<DeliveryDetail> {
	// Whole-table selections across three joins used to sit here, and D1 answers that
	// with "too many columns in result set": the delivery, order and business rows
	// together exceed the engine's bound on result-set columns (127), so every
	// `readDetail` answering a courier's board 500'd (dlv_9f2a57a0, the whole
	// post-accept outage of 2026-10-09). Only the fields `DeliveryDetail` reads are
	// named now — a smaller result that also names nothing a caller cannot see.
	const row = (
		await ctx.db
			.select({
				delivery: {
					id: deliveryTable.id,
					orderId: deliveryTable.orderId,
					businessId: deliveryTable.businessId,
					customerId: deliveryTable.customerId,
					courierUserId: deliveryTable.courierUserId,
					status: deliveryTable.status,
					// Drizzle's own column objects, so `pickupOf`/`dropoffOf` receive the
					// inferred shape they were written against.
					pickupName: deliveryTable.pickupName,
					pickupLine1: deliveryTable.pickupLine1,
					pickupLine2: deliveryTable.pickupLine2,
					pickupCity: deliveryTable.pickupCity,
					pickupRegion: deliveryTable.pickupRegion,
					pickupPostalCode: deliveryTable.pickupPostalCode,
					pickupLat: deliveryTable.pickupLat,
					pickupLng: deliveryTable.pickupLng,
					pickupPhone: deliveryTable.pickupPhone,
					pickupInstructions: deliveryTable.pickupInstructions,
					dropoffName: deliveryTable.dropoffName,
					dropoffLine1: deliveryTable.dropoffLine1,
					dropoffLine2: deliveryTable.dropoffLine2,
					dropoffCity: deliveryTable.dropoffCity,
					dropoffRegion: deliveryTable.dropoffRegion,
					dropoffPostalCode: deliveryTable.dropoffPostalCode,
					dropoffLat: deliveryTable.dropoffLat,
					dropoffLng: deliveryTable.dropoffLng,
					dropoffPhone: deliveryTable.dropoffPhone,
					dropoffInstructions: deliveryTable.dropoffInstructions,
					acceptedAt: deliveryTable.acceptedAt,
					arrivedPickupAt: deliveryTable.arrivedPickupAt,
					pickedUpAt: deliveryTable.pickedUpAt,
					deliveredAt: deliveryTable.deliveredAt,
					createdAt: deliveryTable.createdAt,
				},
				order: {
					reference: orderTable.reference,
					status: orderTable.status,
					totalMinor: orderTable.totalMinor,
					currency: orderTable.currency,
				},
				business: {
					id: businessTable.id,
					name: businessTable.name,
					phone: businessTable.phone,
				},
			})
			.from(deliveryTable)
			.innerJoin(orderTable, eq(orderTable.id, deliveryTable.orderId))
			.innerJoin(businessTable, eq(businessTable.id, deliveryTable.businessId))
			.where(eq(deliveryTable.id, deliveryId))
			.limit(1)
	)[0];
	if (!row) throw new NotFoundError();

	const mayRead =
		row.delivery.customerId === ctx.user.id ||
		row.delivery.courierUserId === ctx.user.id ||
		ctx.user.isAdmin ||
		ctx.memberships.some(
			(member) => member.businessId === row.delivery.businessId,
		);
	if (!mayRead) throw new NotFoundError();

	const [customer, courier, ratings] = await Promise.all([
		ctx.db
			.select({
				id: userTable.id,
				name: userTable.name,
				phone: userTable.phone,
			})
			.from(userTable)
			.where(eq(userTable.id, row.delivery.customerId))
			.limit(1),
		row.delivery.courierUserId
			? ctx.db
					.select({
						id: userTable.id,
						name: userTable.name,
						phone: userTable.phone,
					})
					.from(userTable)
					.where(eq(userTable.id, row.delivery.courierUserId))
					.limit(1)
			: Promise.resolve([]),
		ctx.db
			.select()
			.from(ratingTable)
			.where(eq(ratingTable.deliveryId, deliveryId)),
	]);
	const customerRow = customer[0];
	if (!customerRow) throw new NotFoundError();
	const ratingMap = new Map(ratings.map((rating) => [rating.fromRole, rating]));
	const customerRating = ratingMap.get("CUSTOMER");
	const courierRating = ratingMap.get("COURIER");

	return {
		id: row.delivery.id,
		orderId: row.delivery.orderId,
		orderReference: row.order.reference,
		status: row.delivery.status,
		business: {
			id: row.business.id,
			name: row.business.name,
			phone: row.business.phone,
		},
		customer: customerRow,
		courier: courier[0] ?? null,
		pickup: pickupOf(row.delivery),
		dropoff: dropoffOf(row.delivery),
		orderStatus: row.order.status,
		totalMinor: row.order.totalMinor,
		currency: row.order.currency,
		acceptedAt: row.delivery.acceptedAt,
		arrivedPickupAt: row.delivery.arrivedPickupAt,
		pickedUpAt: row.delivery.pickedUpAt,
		deliveredAt: row.delivery.deliveredAt,
		createdAt: row.delivery.createdAt,
		ratings: {
			customerToCourier: customerRating ? ratingOf(customerRating) : null,
			courierToCustomer: courierRating ? ratingOf(courierRating) : null,
		},
	};
}

function pickupOf(row: {
	pickupName: string;
	pickupLine1: string;
	pickupLine2: string | null;
	pickupCity: string;
	pickupRegion: string;
	pickupPostalCode: string | null;
	pickupLat: number | null;
	pickupLng: number | null;
	pickupPhone: string | null;
	pickupInstructions: string | null;
}) {
	return {
		name: row.pickupName,
		line1: row.pickupLine1,
		line2: row.pickupLine2,
		city: row.pickupCity,
		region: row.pickupRegion,
		postalCode: row.pickupPostalCode,
		lat: row.pickupLat,
		lng: row.pickupLng,
		phone: row.pickupPhone,
		instructions: row.pickupInstructions,
	};
}

function dropoffOf(row: {
	dropoffName: string;
	dropoffLine1: string;
	dropoffLine2: string | null;
	dropoffCity: string;
	dropoffRegion: string;
	dropoffPostalCode: string | null;
	dropoffLat: number | null;
	dropoffLng: number | null;
	dropoffPhone: string | null;
	dropoffInstructions: string | null;
}) {
	return {
		name: row.dropoffName,
		line1: row.dropoffLine1,
		line2: row.dropoffLine2,
		city: row.dropoffCity,
		region: row.dropoffRegion,
		postalCode: row.dropoffPostalCode,
		lat: row.dropoffLat,
		lng: row.dropoffLng,
		phone: row.dropoffPhone,
		instructions: row.dropoffInstructions,
	};
}

function ratingOf(row: typeof ratingTable.$inferSelect): DeliveryRating {
	return {
		id: row.id,
		deliveryId: row.deliveryId,
		fromRole: row.fromRole,
		rating: row.rating,
		comment: row.comment,
		createdAt: row.createdAt,
	};
}
