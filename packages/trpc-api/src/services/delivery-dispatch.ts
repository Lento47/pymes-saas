import type { Db } from "@pymeshub/db";
import {
	business as businessTable,
	delivery as deliveryTable,
	membership as membershipTable,
	notification as notificationTable,
	deliveryOffer as offerTable,
	order as orderTable,
	courierPresence as presenceTable,
	courierProfile as profileTable,
	deliveryRating as ratingTable,
	user as userTable,
} from "@pymeshub/db";
import { newId } from "@pymeshub/shared";
import { and, asc, eq, gte, inArray, isNull, lt, max, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { batchOf } from "./helpers";

const PRESENCE_FRESH_MS = 2 * 60 * 1000;
const OFFER_TTL_MS = 2 * 60 * 1000;
const FAIRNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_DELIVERY_STATUSES = [
	"ACCEPTED",
	"TO_PICKUP",
	"AT_PICKUP",
	"PICKED_UP",
] as const;

type StopInput = {
	name: string;
	line1: string;
	line2: string | null;
	city: string;
	region: string;
	postalCode: string | null;
	lat: number | null;
	lng: number | null;
	phone: string | null;
	instructions: string | null;
};

type RankedCandidate = {
	userId: string;
	displayName: string;
	phone: string | null;
	distanceToPickupKm: number | null;
	activeRuns: number;
	recentOffers: number;
	rating: number | null;
	lastOfferedAt: Date | null;
};

/**
 * The dispatch order is deterministic and uses facts the platform owns:
 * fresh foreground presence, free capacity, pickup distance, recent offer
 * count, received rating, then the oldest last offer. The id is the final
 * tie-break, so two isolates choose the same person for the same snapshot.
 */
export function rankCourierCandidates(
	candidates: readonly RankedCandidate[],
): RankedCandidate[] {
	return [...candidates].sort((left, right) => {
		if (left.activeRuns !== right.activeRuns)
			return left.activeRuns - right.activeRuns;
		const leftDistance = left.distanceToPickupKm ?? Number.POSITIVE_INFINITY;
		const rightDistance = right.distanceToPickupKm ?? Number.POSITIVE_INFINITY;
		if (leftDistance !== rightDistance) return leftDistance - rightDistance;
		if (left.recentOffers !== right.recentOffers)
			return left.recentOffers - right.recentOffers;
		const leftRating = left.rating ?? 0;
		const rightRating = right.rating ?? 0;
		if (leftRating !== rightRating) return rightRating - leftRating;
		const leftLast = left.lastOfferedAt?.getTime() ?? 0;
		const rightLast = right.lastOfferedAt?.getTime() ?? 0;
		if (leftLast !== rightLast) return leftLast - rightLast;
		return left.userId.localeCompare(right.userId);
	});
}

async function candidateFor(
	db: Db,
	input: {
		deliveryId: string;
		businessId: string;
		pickupLat: number | null;
		pickupLng: number | null;
		now: Date;
	},
): Promise<RankedCandidate | null> {
	const rows = await db
		.select({
			userId: membershipTable.userId,
			displayName: profileTable.displayName,
			phone: userTable.phone,
			lat: presenceTable.lat,
			lng: presenceTable.lng,
		})
		.from(membershipTable)
		.innerJoin(profileTable, eq(profileTable.userId, membershipTable.userId))
		.innerJoin(presenceTable, eq(presenceTable.userId, membershipTable.userId))
		.innerJoin(userTable, eq(userTable.id, membershipTable.userId))
		.where(
			and(
				eq(membershipTable.businessId, input.businessId),
				eq(membershipTable.role, "COURIER"),
				eq(profileTable.verificationStatus, "VERIFIED"),
				eq(profileTable.isAvailable, true),
				isNull(userTable.suspendedAt),
				gte(
					presenceTable.updatedAt,
					new Date(input.now.getTime() - PRESENCE_FRESH_MS),
				),
			),
		);
	if (rows.length === 0) return null;

	const userIds = rows.map((row) => row.userId);
	const [
		previousOffers,
		activeRuns,
		pendingOffers,
		receivedRatings,
		lastOffers,
	] = await Promise.all([
		db
			.select({ userId: offerTable.courierUserId })
			.from(offerTable)
			.where(eq(offerTable.deliveryId, input.deliveryId)),
		db
			.select({
				userId: deliveryTable.courierUserId,
				count: sql<number>`count(*)`,
			})
			.from(deliveryTable)
			.where(
				and(
					inArray(deliveryTable.courierUserId, userIds),
					inArray(deliveryTable.status, ACTIVE_DELIVERY_STATUSES),
				),
			)
			.groupBy(deliveryTable.courierUserId),
		db
			.select({
				userId: offerTable.courierUserId,
				count: sql<number>`count(*)`,
			})
			.from(offerTable)
			.where(
				and(
					inArray(offerTable.courierUserId, userIds),
					eq(offerTable.status, "PENDING"),
					gte(offerTable.expiresAt, input.now),
				),
			)
			.groupBy(offerTable.courierUserId),
		db
			.select({
				userId: ratingTable.toUserId,
				rating: sql<number>`avg(${ratingTable.rating})`,
			})
			.from(ratingTable)
			.where(
				and(
					inArray(ratingTable.toUserId, userIds),
					eq(ratingTable.fromRole, "CUSTOMER"),
				),
			)
			.groupBy(ratingTable.toUserId),
		db
			.select({
				userId: offerTable.courierUserId,
				lastOfferedAt: max(offerTable.createdAt),
				recentOffers: sql<number>`sum(case when ${offerTable.createdAt} >= ${new Date(
					input.now.getTime() - FAIRNESS_WINDOW_MS,
				)} then 1 else 0 end)`,
			})
			.from(offerTable)
			.where(inArray(offerTable.courierUserId, userIds))
			.groupBy(offerTable.courierUserId),
	]);

	const excluded = new Set(previousOffers.map((row) => row.userId));
	const active = new Map(
		activeRuns.map((row) => [row.userId, Number(row.count)]),
	);
	const pending = new Map(
		pendingOffers.map((row) => [row.userId, Number(row.count)]),
	);
	const ratings = new Map(
		receivedRatings.map((row) => [row.userId, Number(row.rating)]),
	);
	const fairness = new Map(lastOffers.map((row) => [row.userId, row]));

	const ranked = rankCourierCandidates(
		rows
			.filter(
				(row) =>
					!excluded.has(row.userId) &&
					(active.get(row.userId) ?? 0) === 0 &&
					(pending.get(row.userId) ?? 0) === 0,
			)
			.map((row) => ({
				userId: row.userId,
				displayName: row.displayName,
				phone: row.phone,
				distanceToPickupKm:
					input.pickupLat == null || input.pickupLng == null
						? null
						: haversineKm(input.pickupLat, input.pickupLng, row.lat, row.lng),
				activeRuns: active.get(row.userId) ?? 0,
				recentOffers: Number(fairness.get(row.userId)?.recentOffers ?? 0),
				rating: ratings.get(row.userId) ?? null,
				lastOfferedAt: fairness.get(row.userId)?.lastOfferedAt ?? null,
			})),
	);

	return ranked[0] ?? null;
}

function offerStatements(
	db: Db,
	input: {
		deliveryId: string;
		orderId: string;
		businessName: string;
		candidate: RankedCandidate;
		now: Date;
	},
): { offerId: string; statements: BatchItem<"sqlite">[] } {
	const offerId = newId("deliveryOffer");
	const expiresAt = new Date(input.now.getTime() + OFFER_TTL_MS);
	return {
		offerId,
		statements: [
			db.insert(offerTable).values({
				id: offerId,
				deliveryId: input.deliveryId,
				courierUserId: input.candidate.userId,
				status: "PENDING",
				distanceToPickupKm: input.candidate.distanceToPickupKm,
				workloadAtOffer: input.candidate.activeRuns,
				ratingAtOffer: input.candidate.rating,
				expiresAt,
				createdAt: input.now,
			}),
			db.insert(notificationTable).values({
				id: crypto.randomUUID(),
				userId: input.candidate.userId,
				kind: "DELIVERY",
				title: "Nueva entrega disponible",
				body: `${input.businessName} tiene una entrega para aceptar`,
				data: {
					type: "DELIVERY_OFFERED",
					deliveryId: input.deliveryId,
					orderId: input.orderId,
				},
				readAt: null,
				createdAt: input.now,
				dedupeKey: `delivery-offer:${offerId}`,
			}),
		],
	};
}

export async function prepareDeliveryForOrder(
	db: Db,
	input: {
		orderId: string;
		businessId: string;
		businessName: string;
		businessPhone: string | null;
		customerId: string;
		customerName: string;
		location: {
			name: string;
			line1: string | null;
			line2: string | null;
			city: string | null;
			region: string | null;
			postalCode: string | null;
			lat: number | null;
			lng: number | null;
		};
		dropoff: StopInput;
		now: Date;
	},
): Promise<{ deliveryId: string; statements: BatchItem<"sqlite">[] }> {
	const deliveryId = newId("delivery");
	const candidate = await candidateFor(db, {
		deliveryId,
		businessId: input.businessId,
		pickupLat: input.location.lat,
		pickupLng: input.location.lng,
		now: input.now,
	});
	const offer = candidate
		? offerStatements(db, {
				deliveryId,
				orderId: input.orderId,
				businessName: input.businessName,
				candidate,
				now: input.now,
			})
		: null;

	return {
		deliveryId,
		statements: [
			db.insert(deliveryTable).values({
				id: deliveryId,
				orderId: input.orderId,
				businessId: input.businessId,
				customerId: input.customerId,
				status: offer ? "OFFERED" : "SEARCHING",
				pickupName: input.location.name,
				pickupLine1: input.location.line1 ?? input.businessName,
				pickupLine2: input.location.line2,
				pickupCity: input.location.city ?? "",
				pickupRegion: input.location.region ?? "",
				pickupPostalCode: input.location.postalCode,
				pickupLat: input.location.lat,
				pickupLng: input.location.lng,
				pickupPhone: input.businessPhone,
				pickupInstructions: null,
				dropoffName: input.dropoff.name,
				dropoffLine1: input.dropoff.line1,
				dropoffLine2: input.dropoff.line2,
				dropoffCity: input.dropoff.city,
				dropoffRegion: input.dropoff.region,
				dropoffPostalCode: input.dropoff.postalCode,
				dropoffLat: input.dropoff.lat,
				dropoffLng: input.dropoff.lng,
				dropoffPhone: input.dropoff.phone,
				dropoffInstructions: input.dropoff.instructions,
				createdAt: input.now,
				updatedAt: input.now,
			}),
			...(offer?.statements ?? []),
		],
	};
}

/** Offer the next eligible courier after a decline or expiry. */
export async function dispatchNext(db: Db, deliveryId: string): Promise<void> {
	const row = (
		await db
			.select({ delivery: deliveryTable, order: orderTable })
			.from(deliveryTable)
			.innerJoin(orderTable, eq(orderTable.id, deliveryTable.orderId))
			.where(eq(deliveryTable.id, deliveryId))
			.limit(1)
	)[0];
	if (row?.delivery.status !== "SEARCHING") return;

	const candidate = await candidateFor(db, {
		deliveryId,
		businessId: row.delivery.businessId,
		pickupLat: row.delivery.pickupLat,
		pickupLng: row.delivery.pickupLng,
		now: new Date(),
	});
	if (!candidate) return;

	const businessName = (
		await db
			.select({ name: businessTable.name })
			.from(businessTable)
			.where(eq(businessTable.id, row.delivery.businessId))
			.limit(1)
	)[0]?.name;
	const now = new Date();
	const offer = offerStatements(db, {
		deliveryId,
		orderId: row.delivery.orderId,
		businessName: businessName ?? "PymesHub",
		candidate,
		now,
	});

	try {
		await db.batch(
			batchOf([
				db
					.update(deliveryTable)
					.set({ status: "OFFERED", updatedAt: now })
					.where(
						and(
							eq(deliveryTable.id, deliveryId),
							eq(deliveryTable.status, "SEARCHING"),
						),
					),
				...offer.statements,
			]),
		);
	} catch (error) {
		if (!String(error).includes("delivery_offer_pending_unique")) throw error;
	}
}

/** Expire timed-out offers and immediately try the next candidate. */
export async function sweepExpiredOffers(db: Db, limit = 50): Promise<void> {
	const now = new Date();
	const rows = await db
		.select({ id: offerTable.id, deliveryId: offerTable.deliveryId })
		.from(offerTable)
		.where(and(eq(offerTable.status, "PENDING"), lt(offerTable.expiresAt, now)))
		.orderBy(asc(offerTable.expiresAt))
		.limit(limit);

	for (const row of rows) {
		await db.batch(
			batchOf([
				db
					.update(offerTable)
					.set({ status: "EXPIRED", respondedAt: now })
					.where(
						and(eq(offerTable.id, row.id), eq(offerTable.status, "PENDING")),
					),
				db
					.update(deliveryTable)
					.set({ status: "SEARCHING", updatedAt: now })
					.where(
						and(
							eq(deliveryTable.id, row.deliveryId),
							eq(deliveryTable.status, "OFFERED"),
						),
					),
			]),
		);
		await dispatchNext(db, row.deliveryId);
	}
}

function haversineKm(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
): number {
	const radiusKm = 6371;
	const radians = (value: number) => (value * Math.PI) / 180;
	const dLat = radians(toLat - fromLat);
	const dLng = radians(toLng - fromLng);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(radians(fromLat)) *
			Math.cos(radians(toLat)) *
			Math.sin(dLng / 2) ** 2;
	return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
