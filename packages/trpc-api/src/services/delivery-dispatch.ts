import type { Db } from "@pymeshub/db";
import {
	boundingBox,
	business as businessTable,
	delivery as deliveryTable,
	haversineKm,
	membership as membershipTable,
	notification as notificationTable,
	deliveryOffer as offerTable,
	order as orderTable,
	courierPresence as presenceTable,
	courierProfile as profileTable,
	deliveryRating as ratingTable,
	user as userTable,
} from "@pymeshub/db";
import { newId, OFFER_RADIUS_KM } from "@pymeshub/shared";
import {
	and,
	asc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	max,
	or,
	sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Env } from "../env";
import { createLogger } from "../logging";
import { batchOf } from "./helpers";
import { createOsrmRouting, type GeoPoint } from "./routing";

const PRESENCE_FRESH_MS = 2 * 60 * 1000;
const OFFER_TTL_MS = 2 * 60 * 1000;
const FAIRNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Re-exported rather than declared, so `deliveries.ts` and the tests keep importing it from
 * here.
 *
 * The declaration now lives in `@pymeshub/shared` because the merchant's location screen
 * draws this radius on a map and has to draw *this* number, not a copy of it. Both packages
 * already depend on `shared`; neither could import the other.
 */
export { OFFER_RADIUS_KM };

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
	/**
	 * The shop already asked for this person by inviting them.
	 *
	 * **A rank, not a permission.** When the candidate pool was "members of this shop"
	 * every candidate was preferred and the flag could not exist. Widening the pool makes
	 * it meaningful: a business that has worked with someone before gets them offered
	 * first, and everyone else competes on the same facts as before. Nothing about who may
	 * accept an offer reads this — see `deliveries.ts`, where the gate is the profile.
	 */
	preferred: boolean;
	/** Fresh device position only; a pinned work zone is never a courier position. */
	livePoint?: GeoPoint | null;
	pickupEtaSeconds?: number | null;
};

const MAX_AFFINITY_EXTRA_PICKUP_SECONDS = 240;

/** ETA is the primary measure; affinity only breaks a competitive ETA gap. */
export function rankByAffinityV2(
	candidates: readonly RankedCandidate[],
): RankedCandidate[] {
	const viable = candidates.filter(
		(candidate) =>
			candidate.pickupEtaSeconds != null &&
			Number.isFinite(candidate.pickupEtaSeconds),
	);
	if (viable.length === 0) {
		return [...candidates].sort(
			(left, right) =>
				(left.distanceToPickupKm ?? Infinity) -
					(right.distanceToPickupKm ?? Infinity) ||
				left.recentOffers - right.recentOffers ||
				left.userId.localeCompare(right.userId),
		);
	}
	const bestEta = Math.min(
		...viable.map((candidate) => candidate.pickupEtaSeconds as number),
	);
	const score = (candidate: RankedCandidate) => {
		if (candidate.pickupEtaSeconds == null) return -Infinity;
		const extra = candidate.pickupEtaSeconds - bestEta;
		const affinity =
			candidate.preferred && extra <= MAX_AFFINITY_EXTRA_PICKUP_SECONDS
				? 12 * (1 - extra / MAX_AFFINITY_EXTRA_PICKUP_SECONDS)
				: 0;
		return (
			-candidate.pickupEtaSeconds / 20 +
			affinity -
			Math.min(3, candidate.recentOffers * 0.15)
		);
	};
	return [...candidates].sort(
		(left, right) =>
			score(right) - score(left) || left.userId.localeCompare(right.userId),
	);
}

/**
 * The dispatch order is deterministic and uses facts the platform owns: an existing
 * relationship with the shop, then free capacity, then pickup distance, then recent offer
 * count, received rating, and the oldest last offer. The id is the final tie-break, so two
 * isolates choose the same person for the same snapshot.
 *
 * **`preferred` leads, and that is a product decision rather than a fact about the world.**
 * A shop's own courier is 15 km away and a stranger is 200 m away; this order gives the shop
 * its own courier. That is the deal the invite made — "you asked for this person" outranks
 * "this person is nearest" — and it is why the flag is a rank and not a filter. A shop that
 * wants distance to win instead has no way to ask for it, which is the right default: the
 * alternative silently starves every courier the platform has never worked with.
 */
export function rankCourierCandidates(
	candidates: readonly RankedCandidate[],
): RankedCandidate[] {
	return [...candidates].sort((left, right) => {
		if (left.preferred !== right.preferred) return left.preferred ? -1 : 1;
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

/**
 * The one courier this delivery should be offered to, or `null` for nobody.
 *
 * **The pool is every verified, available courier on the platform** — not the shop's
 * roster. That is the whole point of the change: a business no longer has to add a courier
 * before that courier can carry its deliveries. The profile must be verified and available;
 * a pinned zone covers its pickup and dropoff without device location, while a courier
 * without a zone needs fresh nearby presence. Membership is only a ranking preference.
 *
 * **A delivery with no pickup coordinates gets no offer at all**, and this is deliberate
 * rather than a fallback. `business.lat` and `merchantLocation.lat` are both nullable, so a
 * shop without coordinates produces a delivery with no origin — and with no origin there is
 * no radius to enforce, because the radius is measured *from* the pickup. Offering it to
 * whoever ranks first would mean offering a delivery with no location to couriers across the
 * country, ranked by a distance that does not exist. It stays `SEARCHING`, where a manager
 * can still assign it by hand, and it fails visibly instead of silently absurdly.
 */
async function candidateFor(
	db: Db,
	input: {
		deliveryId: string;
		businessId: string;
		pickupLat: number | null;
		pickupLng: number | null;
		dropoffLat: number | null;
		dropoffLng: number | null;
		now: Date;
	},
	env?: Env,
): Promise<RankedCandidate | null> {
	// Destructured rather than read off `input` twice: the null check below is what makes
	// these `number`s, and a property access does not carry that narrowing into the closure
	// the ranking runs in.
	const { pickupLat, pickupLng } = input;
	if (pickupLat == null || pickupLng == null) return null;
	const origin = { lat: pickupLat, lng: pickupLng };
	const box = boundingBox(pickupLat, pickupLng, OFFER_RADIUS_KM);

	// A pinned zone is the courier's declared work area. It can match without a live
	// device fix; couriers without a zone still need recent nearby presence.
	const rows = await db
		.select({
			userId: profileTable.userId,
			displayName: profileTable.displayName,
			phone: userTable.phone,
			lat: presenceTable.lat,
			lng: presenceTable.lng,
			presenceAt: presenceTable.updatedAt,
			zoneLat: profileTable.zoneLat,
			zoneLng: profileTable.zoneLng,
			zoneRadiusKm: profileTable.zoneRadiusKm,
		})
		.from(profileTable)
		.leftJoin(presenceTable, eq(presenceTable.userId, profileTable.userId))
		.innerJoin(userTable, eq(userTable.id, profileTable.userId))
		.where(
			and(
				eq(profileTable.verificationStatus, "VERIFIED"),
				eq(profileTable.isAvailable, true),
				isNull(userTable.suspendedAt),
				or(
					and(
						isNotNull(profileTable.zoneLat),
						isNotNull(profileTable.zoneLng),
						isNotNull(profileTable.zoneRadiusKm),
					),
					and(
						gte(
							presenceTable.updatedAt,
							new Date(input.now.getTime() - PRESENCE_FRESH_MS),
						),
						gte(presenceTable.lat, box.minLat),
						lte(presenceTable.lat, box.maxLat),
						gte(presenceTable.lng, box.minLng),
						lte(presenceTable.lng, box.maxLng),
					),
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
		shopCouriers,
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
				// Raw sql parameters bypass Drizzle's timestamp_ms encoder. D1 accepts
				// the stored integer milliseconds, not a JavaScript Date object.
				recentOffers: sql<number>`sum(case when ${offerTable.createdAt} >= ${input.now.getTime() - FAIRNESS_WINDOW_MS} then 1 else 0 end)`,
			})
			.from(offerTable)
			.where(inArray(offerTable.courierUserId, userIds))
			.groupBy(offerTable.courierUserId),
		// The one surviving use of the membership: who this shop has already worked with.
		// Read as a set over the candidate ids rather than joined into the pool query, so it
		// cannot narrow the pool by accident — a bug in this read degrades the ranking, and
		// the same bug in the join would silently shrink the pool.
		db
			.select({ userId: membershipTable.userId })
			.from(membershipTable)
			.where(
				and(
					inArray(membershipTable.userId, userIds),
					eq(membershipTable.businessId, input.businessId),
					eq(membershipTable.role, "COURIER"),
				),
			),
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
	const preferred = new Set(shopCouriers.map((row) => row.userId));

	const candidates: RankedCandidate[] = rows
		.filter(
			(row) =>
				!excluded.has(row.userId) &&
				(active.get(row.userId) ?? 0) === 0 &&
				(pending.get(row.userId) ?? 0) === 0,
		)
		.flatMap((row) => {
			const zone =
				row.zoneLat != null && row.zoneLng != null && row.zoneRadiusKm != null
					? {
							center: { lat: row.zoneLat, lng: row.zoneLng },
							radiusKm: row.zoneRadiusKm,
						}
					: null;
			if (zone) {
				if (input.dropoffLat == null || input.dropoffLng == null) return [];
				if (
					haversineKm(zone.center, origin) > zone.radiusKm ||
					haversineKm(zone.center, {
						lat: input.dropoffLat,
						lng: input.dropoffLng,
					}) > zone.radiusKm
				)
					return [];
			}
			const liveDistance =
				row.lat != null &&
				row.lng != null &&
				row.presenceAt != null &&
				row.presenceAt.getTime() >= input.now.getTime() - PRESENCE_FRESH_MS
					? haversineKm(origin, { lat: row.lat, lng: row.lng })
					: null;
			const distanceToPickupKm =
				liveDistance != null && liveDistance <= OFFER_RADIUS_KM
					? liveDistance
					: zone
						? null
						: liveDistance;
			// The circle, after the square. `boundingBox` above is a square and its
			// corner sits `OFFER_RADIUS_KM * 1.41` from the pickup, so without this the
			// radius is a suggestion rather than a limit. Rejecting here rather than in
			// SQL is what `businesses.ts` does, and for the same reason: D1 has no
			// spatial index, so the exact test is a function call over the handful of
			// rows the box let through.
			if (
				!zone &&
				(distanceToPickupKm == null || distanceToPickupKm > OFFER_RADIUS_KM)
			)
				return [];
			return [
				{
					userId: row.userId,
					displayName: row.displayName,
					phone: row.phone,
					distanceToPickupKm,
					activeRuns: active.get(row.userId) ?? 0,
					recentOffers: Number(fairness.get(row.userId)?.recentOffers ?? 0),
					rating: ratings.get(row.userId) ?? null,
					lastOfferedAt: fairness.get(row.userId)?.lastOfferedAt ?? null,
					preferred: preferred.has(row.userId),
					livePoint:
						liveDistance != null && liveDistance <= OFFER_RADIUS_KM
							? { lat: row.lat as number, lng: row.lng as number }
							: null,
				},
			];
		});
	if (env?.AFFINITY_V2_ENABLED === "true") {
		const routingLog = createLogger(
			{ component: "delivery-dispatch" },
			env.LOG_LEVEL,
		);
		const closest = rankByAffinityV2(candidates)
			.filter((candidate) => candidate.livePoint)
			.slice(0, 15);
		if (env.ROUTING_BASE_URL && closest.length > 0) {
			const startedAt = Date.now();
			try {
				const durations = await createOsrmRouting({
					baseUrl: env.ROUTING_BASE_URL,
				}).matrix({
					origins: closest.map((candidate) => candidate.livePoint as GeoPoint),
					destinations: [origin],
					profile: "car",
				});
				const etaByUser = new Map(
					closest.map((candidate, index) => [
						candidate.userId,
						durations[index]?.[0] ?? null,
					]),
				);
				for (const candidate of candidates)
					candidate.pickupEtaSeconds = etaByUser.get(candidate.userId) ?? null;
				routingLog.info("routing.matrix.ok", {
					latencyMs: Date.now() - startedAt,
					candidateCount: closest.length,
					reachableCount: [...etaByUser.values()].filter((eta) => eta != null)
						.length,
				});
			} catch {
				// Routing is advisory for offers: keep matching by distance without inventing an ETA.
				routingLog.warn("routing.matrix.degraded", {
					reason: "provider_failure",
					latencyMs: Date.now() - startedAt,
					candidateCount: closest.length,
				});
			}
		} else if (!env.ROUTING_BASE_URL && closest.length > 0) {
			routingLog.warn("routing.matrix.degraded", {
				reason: "unconfigured",
				candidateCount: closest.length,
			});
		} else if (closest.length === 0 && candidates.length > 0) {
			routingLog.warn("routing.matrix.degraded", {
				reason: "no_live_candidates",
				candidateCount: candidates.length,
			});
		}
		return rankByAffinityV2(candidates)[0] ?? null;
	}
	const ranked = rankCourierCandidates(candidates);

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
	env?: Env,
): Promise<{ deliveryId: string; statements: BatchItem<"sqlite">[] }> {
	const deliveryId = newId("delivery");
	const candidate = await candidateFor(
		db,
		{
			deliveryId,
			businessId: input.businessId,
			pickupLat: input.location.lat,
			pickupLng: input.location.lng,
			dropoffLat: input.dropoff.lat,
			dropoffLng: input.dropoff.lng,
			now: input.now,
		},
		env,
	);
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
export async function dispatchNext(
	db: Db,
	deliveryId: string,
	env?: Env,
): Promise<void> {
	const row = (
		await db
			.select({ delivery: deliveryTable, order: orderTable })
			.from(deliveryTable)
			.innerJoin(orderTable, eq(orderTable.id, deliveryTable.orderId))
			.where(eq(deliveryTable.id, deliveryId))
			.limit(1)
	)[0];
	if (row?.delivery.status !== "SEARCHING") return;

	const candidate = await candidateFor(
		db,
		{
			deliveryId,
			businessId: row.delivery.businessId,
			pickupLat: row.delivery.pickupLat,
			pickupLng: row.delivery.pickupLng,
			dropoffLat: row.delivery.dropoffLat,
			dropoffLng: row.delivery.dropoffLng,
			now: new Date(),
		},
		env,
	);
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
export async function sweepExpiredOffers(
	db: Db,
	limit = 50,
	near?: { lat: number; lng: number },
	env?: Env,
): Promise<void> {
	const now = new Date();
	const box = near ? boundingBox(near.lat, near.lng, OFFER_RADIUS_KM) : null;
	const rows = await db
		.select({ id: offerTable.id, deliveryId: offerTable.deliveryId })
		.from(offerTable)
		.innerJoin(deliveryTable, eq(deliveryTable.id, offerTable.deliveryId))
		.where(
			and(
				eq(offerTable.status, "PENDING"),
				lt(offerTable.expiresAt, now),
				...(box
					? [
							gte(deliveryTable.pickupLat, box.minLat),
							lte(deliveryTable.pickupLat, box.maxLat),
							gte(deliveryTable.pickupLng, box.minLng),
							lte(deliveryTable.pickupLng, box.maxLng),
						]
					: []),
			),
		)
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
		await dispatchNext(db, row.deliveryId, env);
	}
}

/**
 * Offer the oldest still-unmatched runs, once a minute, to whoever is eligible now.
 *
 * Every other dispatch trigger is a person acting — a courier pinging presence, opening
 * the board, or a shop moving the order to READY. This sweep is the one that needs none
 * of those: a run that came out `SEARCHING` because the READY push found nobody online,
 * or whose ordered candidate pool was empty at that instant, waits here for the pool to
 * refill. `dispatchNext` itself refuses anything not `SEARCHING`, so a run that moved on
 * between the read and the call is skipped rather than raced.
 *
 * Oldest first, and bounded: the cron runs every minute and each unchecked row costs a
 * full ranking pass, so the limit is what keeps a busy day from spending the tick.
 * Ten is the same bound `reportPresence`'s local sweep uses.
 *
 * A run whose pickup has no coordinates is deliberately left alone, the same rule
 * `candidateFor` enforces: there is no radius to offer it inside, so a human assignment
 * is the answer, not an offer to everywhere.
 */
export async function sweepWaitingDeliveries(
	db: Db,
	limit = 10,
	env?: Env,
): Promise<void> {
	const waiting = await db
		.select({ id: deliveryTable.id })
		.from(deliveryTable)
		.where(
			and(
				eq(deliveryTable.status, "SEARCHING"),
				isNotNull(deliveryTable.pickupLat),
				isNotNull(deliveryTable.pickupLng),
			),
		)
		// Oldest first: the run that has waited longest is the one a filling pool
		// should reach first, and it is also the one a shop owner is most likely
		// to be watching.
		.orderBy(asc(deliveryTable.createdAt))
		.limit(limit);

	for (const row of waiting) {
		await dispatchNext(db, row.id, env);
	}
}
