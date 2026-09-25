import {
	auditLog as auditLogTable,
	business as businessTable,
	merchantLocation as locationTable,
} from "@pymeshub/db";
import {
	type LocationCreateInput,
	type LocationOperationalStatus,
	type LocationPauseInput,
	type MerchantLocation,
	newId,
} from "@pymeshub/shared";
import { and, asc, desc, eq } from "drizzle-orm";

import { ForbiddenError, ValidationError } from "../errors";
import type { BusinessContext } from "./helpers";
import { isOpenAt, localDayAndMinute, orNotFound } from "./helpers";

type LocationRow = typeof locationTable.$inferSelect;
type BusinessRow = typeof businessTable.$inferSelect;

export function operationalStatus(
	location: LocationRow,
	business: BusinessRow,
	now: Date,
): LocationOperationalStatus {
	if (business.status === "SUSPENDED") return "suspended";
	if (business.status !== "ACTIVE" || location.isOffline) return "offline";
	if (location.pauseReason && (!location.resumeAt || location.resumeAt > now)) {
		return `paused_${location.pauseReason}`;
	}
	return isOpenAt(location.hours ?? business.hours, now)
		? "open"
		: "closed_schedule";
}

function locationOf(
	location: LocationRow,
	business: BusinessRow,
	now: Date,
): MerchantLocation {
	const pauseIsCurrent =
		location.pauseReason !== null &&
		(location.resumeAt === null || location.resumeAt > now);
	const { day } = localDayAndMinute(now);
	const today = (location.hours ?? business.hours)?.find(
		(entry) => entry.day === day,
	);
	return {
		id: location.id,
		businessId: location.businessId,
		name: location.name,
		isDefault: location.isDefault,
		line1: location.line1,
		line2: location.line2,
		city: location.city,
		region: location.region,
		country: location.country,
		postalCode: location.postalCode,
		lat: location.lat,
		lng: location.lng,
		status: operationalStatus(location, business, now),
		todayHours:
			today && !today.isClosed
				? {
						opensMinute: today.opensMinute,
						closesMinute: today.closesMinute,
					}
				: null,
		pausedAt: pauseIsCurrent ? location.pausedAt : null,
		resumeAt: pauseIsCurrent ? location.resumeAt : null,
		createdAt: location.createdAt,
	};
}

async function scopedLocation(ctx: BusinessContext, locationId: string) {
	const businessId = ctx.membership.businessId;
	const [businessRows, locationRows] = await Promise.all([
		ctx.db
			.select()
			.from(businessTable)
			.where(eq(businessTable.id, businessId))
			.limit(1),
		ctx.db
			.select()
			.from(locationTable)
			.where(
				and(
					eq(locationTable.id, locationId),
					eq(locationTable.businessId, businessId),
				),
			)
			.limit(1),
	]);
	return {
		business: orNotFound(businessRows[0]),
		location: orNotFound(locationRows[0]),
	};
}

export async function list(ctx: BusinessContext): Promise<MerchantLocation[]> {
	const businessId = ctx.membership.businessId;
	const business = orNotFound(
		(
			await ctx.db
				.select()
				.from(businessTable)
				.where(eq(businessTable.id, businessId))
				.limit(1)
		)[0],
	);
	const rows = await ctx.db
		.select()
		.from(locationTable)
		.where(eq(locationTable.businessId, businessId))
		.orderBy(
			desc(locationTable.isDefault),
			asc(locationTable.createdAt),
			asc(locationTable.id),
		);
	const now = new Date();
	return rows.map((row) => locationOf(row, business, now));
}

export async function status(
	ctx: BusinessContext,
	locationId: string,
): Promise<MerchantLocation> {
	const { business, location } = await scopedLocation(ctx, locationId);
	return locationOf(location, business, new Date());
}

export async function create(
	ctx: BusinessContext,
	input: LocationCreateInput,
): Promise<MerchantLocation> {
	const businessId = ctx.membership.businessId;
	const business = orNotFound(
		(
			await ctx.db
				.select()
				.from(businessTable)
				.where(eq(businessTable.id, businessId))
				.limit(1)
		)[0],
	);
	if (business.status === "SUSPENDED")
		throw new ForbiddenError("Este negocio está suspendido por PymesHub");
	const now = new Date();
	const id = newId("location");
	await ctx.db.insert(locationTable).values({
		id,
		businessId,
		name: input.name,
		line1: input.line1,
		line2: input.line2 ?? null,
		city: input.city,
		region: input.region,
		country: input.country,
		postalCode: input.postalCode ?? null,
		lat: input.lat ?? null,
		lng: input.lng ?? null,
		hours: input.hours ?? null,
		isDefault: false,
		createdAt: now,
		updatedAt: now,
	});
	return status(ctx, id);
}

export async function pause(
	ctx: BusinessContext,
	input: LocationPauseInput,
): Promise<MerchantLocation> {
	const { business, location } = await scopedLocation(ctx, input.locationId);
	if (location.pauseReason === "platform")
		throw new ForbiddenError("Solo PymesHub puede cambiar esta pausa");
	if (business.status !== "ACTIVE")
		throw new ValidationError(
			"La tienda debe estar activa para pausar pedidos",
		);
	const now = new Date();
	const resumeAt = input.durationMinutes
		? new Date(now.getTime() + input.durationMinutes * 60_000)
		: null;
	await ctx.db.batch([
		ctx.db
			.update(locationTable)
			.set({
				pauseReason: input.reason,
				pausedAt: now,
				resumeAt,
				updatedAt: now,
			})
			.where(
				and(
					eq(locationTable.id, location.id),
					eq(locationTable.businessId, ctx.membership.businessId),
				),
			),
		ctx.db.insert(auditLogTable).values({
			id: newId("auditLog"),
			actorUserId: ctx.user.id,
			action: "LOCATION_PAUSED",
			targetType: "merchant_location",
			targetId: location.id,
			meta: {
				businessId: ctx.membership.businessId,
				reason: input.reason,
				resumeAt: resumeAt?.toISOString() ?? null,
			},
			createdAt: now,
		}),
	]);
	return status(ctx, location.id);
}

export async function resume(
	ctx: BusinessContext,
	locationId: string,
): Promise<MerchantLocation> {
	const { location } = await scopedLocation(ctx, locationId);
	if (location.pauseReason === "platform")
		throw new ForbiddenError("Solo PymesHub puede reanudar esta sucursal");
	const now = new Date();
	await ctx.db.batch([
		ctx.db
			.update(locationTable)
			.set({
				pauseReason: null,
				pausedAt: null,
				resumeAt: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(locationTable.id, location.id),
					eq(locationTable.businessId, ctx.membership.businessId),
				),
			),
		ctx.db.insert(auditLogTable).values({
			id: newId("auditLog"),
			actorUserId: ctx.user.id,
			action: "LOCATION_RESUMED",
			targetType: "merchant_location",
			targetId: location.id,
			meta: { businessId: ctx.membership.businessId },
			createdAt: now,
		}),
	]);
	return status(ctx, location.id);
}
