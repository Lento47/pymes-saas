import {
	business as businessTable,
	delivery as deliveryTable,
	membership as membershipTable,
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
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";

import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { dispatchNext } from "./delivery-dispatch";
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

export async function reportPresence(
	ctx: UserContext,
	input: CourierPresenceInput,
): Promise<{ updatedAt: Date }> {
	const allowed = (
		await ctx.db
			.select({ id: profileTable.id })
			.from(profileTable)
			.innerJoin(
				membershipTable,
				eq(membershipTable.userId, profileTable.userId),
			)
			.where(
				and(
					eq(profileTable.userId, ctx.user.id),
					eq(profileTable.verificationStatus, "VERIFIED"),
					eq(profileTable.isAvailable, true),
					eq(membershipTable.role, "COURIER"),
				),
			)
			.limit(1)
	)[0];
	if (!allowed) {
		throw new ValidationError(
			"Tu perfil debe estar verificado, disponible y unido a un negocio",
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

	const courierBusinessIds = ctx.memberships
		.filter((membership) => membership.role === "COURIER")
		.map((membership) => membership.businessId);
	if (courierBusinessIds.length > 0) {
		const waiting = await ctx.db
			.select({ id: deliveryTable.id })
			.from(deliveryTable)
			.where(
				and(
					inArray(deliveryTable.businessId, courierBusinessIds),
					eq(deliveryTable.status, "SEARCHING"),
				),
			)
			.orderBy(deliveryTable.createdAt)
			.limit(10);
		for (const delivery of waiting) {
			await dispatchNext(ctx.db, delivery.id);
		}
	}
	return { updatedAt };
}

export async function offers(ctx: UserContext): Promise<DeliveryOffer[]> {
	const courierBusinessIds = ctx.memberships
		.filter((membership) => membership.role === "COURIER")
		.map((membership) => membership.businessId);
	if (courierBusinessIds.length === 0) return [];
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
				inArray(deliveryTable.businessId, courierBusinessIds),
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
			.select({
				orderId: deliveryTable.orderId,
				businessId: deliveryTable.businessId,
			})
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
	const mayAccept = ctx.memberships.some(
		(membership) =>
			membership.businessId === deliveryRow.businessId &&
			membership.role === "COURIER",
	);
	if (
		!mayAccept ||
		!profile?.isAvailable ||
		profile.verificationStatus !== "VERIFIED"
	) {
		throw new NotFoundError();
	}
	const now = new Date();
	const validOffer = sql`exists (
		select 1 from ${offerTable}
		where ${offerTable.id} = ${input.offerId}
		and ${offerTable.deliveryId} = ${offer.deliveryId}
		and ${offerTable.courierUserId} = ${ctx.user.id}
		and ${offerTable.status} = 'PENDING'
		and ${offerTable.expiresAt} > ${now}
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
		if (!String(error).includes("delivery_offer_accepted_unique")) throw error;
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
	const row = (
		await ctx.db
			.select({
				delivery: deliveryTable,
				order: orderTable,
				business: businessTable,
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

function pickupOf(row: typeof deliveryTable.$inferSelect) {
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

function dropoffOf(row: typeof deliveryTable.$inferSelect) {
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
