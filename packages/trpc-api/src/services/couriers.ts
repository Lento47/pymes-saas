import { courierProfile as profileTable } from "@pymeshub/db";
import type { CourierProfile, CourierProfileInput } from "@pymeshub/shared";
import { newId } from "@pymeshub/shared";
import { eq } from "drizzle-orm";

import type { UserContext } from "./helpers";

type ProfileRow = typeof profileTable.$inferSelect;

function profileOf(row: ProfileRow): CourierProfile {
	return {
		id: row.id,
		userId: row.userId,
		displayName: row.displayName,
		serviceArea: row.serviceArea,
		bio: row.bio,
		vehicleName: row.vehicleName,
		vehiclePlate: row.vehiclePlate,
		vehiclePhotoUrl: row.vehiclePhotoUrl,
		isAvailable: row.isAvailable,
		verificationStatus: row.verificationStatus,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/** The caller's own opt-in courier profile, or null before they create one. */
export async function myProfile(
	ctx: UserContext,
): Promise<CourierProfile | null> {
	const rows = await ctx.db
		.select()
		.from(profileTable)
		.where(eq(profileTable.userId, ctx.user.id))
		.limit(1);
	return rows[0] ? profileOf(rows[0]) : null;
}

/**
 * Create or edit the caller's public courier profile.
 *
 * A meaningful edit returns a reviewed profile to PENDING. Availability is the
 * exception: a courier turning off for the day must not have to wait for a
 * platform review before turning back on. The vehicle counts as meaningful -
 * a plate and a picture are facts a review checks, not preferences - while a
 * photo that merely *changed* (same profile, new bytes) is not distinguishable
 * from a new plate here, and does not need to be: both send it back to the
 * queue the reviewer is already reading.
 *
 * There is no membership written by this function, on purpose: the profile is
 * an identity, and only an invitation accepted by a shop creates the
 * `COURIER` row that opens the board.
 */
export async function saveProfile(
	ctx: UserContext,
	input: CourierProfileInput,
): Promise<CourierProfile> {
	const rows = await ctx.db
		.select()
		.from(profileTable)
		.where(eq(profileTable.userId, ctx.user.id))
		.limit(1);
	const current = rows[0];
	const now = new Date();
	const bio = input.bio?.trim() || null;
	const vehicleName = input.vehicleName?.trim() || null;
	const vehiclePlate = input.vehiclePlate?.trim() || null;
	const vehiclePhotoUrl = input.vehiclePhotoUrl?.trim() || null;
	const meaningfulChange =
		!current ||
		current.displayName !== input.displayName ||
		current.serviceArea !== input.serviceArea ||
		current.bio !== bio ||
		current.vehicleName !== vehicleName ||
		current.vehiclePlate !== vehiclePlate ||
		current.vehiclePhotoUrl !== vehiclePhotoUrl;

	if (current) {
		const status = meaningfulChange ? "PENDING" : current.verificationStatus;
		await ctx.db
			.update(profileTable)
			.set({
				displayName: input.displayName,
				serviceArea: input.serviceArea,
				bio,
				vehicleName,
				vehiclePlate,
				vehiclePhotoUrl,
				isAvailable: input.isAvailable,
				verificationStatus: status,
				updatedAt: now,
			})
			.where(eq(profileTable.id, current.id));
		return profileOf({
			...current,
			displayName: input.displayName,
			serviceArea: input.serviceArea,
			bio,
			vehicleName,
			vehiclePlate,
			vehiclePhotoUrl,
			isAvailable: input.isAvailable,
			verificationStatus: status,
			updatedAt: now,
		});
	}

	const id = newId("courierProfile");
	await ctx.db.insert(profileTable).values({
		id,
		userId: ctx.user.id,
		displayName: input.displayName,
		serviceArea: input.serviceArea,
		bio,
		vehicleName,
		vehiclePlate,
		vehiclePhotoUrl,
		isAvailable: input.isAvailable,
		verificationStatus: "PENDING",
		createdAt: now,
		updatedAt: now,
	});

	return {
		id,
		userId: ctx.user.id,
		displayName: input.displayName,
		serviceArea: input.serviceArea,
		bio,
		vehicleName,
		vehiclePlate,
		vehiclePhotoUrl,
		isAvailable: input.isAvailable,
		verificationStatus: "PENDING",
		createdAt: now,
		updatedAt: now,
	};
}
