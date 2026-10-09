/**
 * Courier trust and invitations.
 *
 * A courier account is not a courier membership yet. The account holder fills a
 * profile, the platform reviews it, a business finds an available reviewed
 * profile, and only an accepted invitation creates the membership. Keeping those
 * states separate is what stops a business from adding an arbitrary account by
 * knowing its email.
 */

import { z } from "zod";

import { imageUrlSchema, shortText } from "./common";

export const COURIER_VERIFICATION_STATUSES = [
	"PENDING",
	"VERIFIED",
	"REJECTED",
] as const;
export type CourierVerificationStatus =
	(typeof COURIER_VERIFICATION_STATUSES)[number];

export const COURIER_INVITE_STATUSES = [
	"PENDING",
	"ACCEPTED",
	"DECLINED",
	"EXPIRED",
	"CANCELLED",
] as const;
export type CourierInviteStatus = (typeof COURIER_INVITE_STATUSES)[number];

export const courierProfileInput = z.object({
	displayName: shortText(80),
	serviceArea: shortText(100),
	zone: z
		.object({
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
			radiusKm: z.number().int().min(1).max(30),
		})
		.optional(),
	bio: z.string().trim().max(300).optional(),
	/** The vehicle: name (model or nickname), plate, and its photo's URL. */
	vehicleName: z.string().trim().max(80).optional(),
	vehiclePlate: z.string().trim().max(20).optional(),
	vehiclePhotoUrl: imageUrlSchema.optional(),
	isAvailable: z.boolean().default(true),
});
export type CourierProfileInput = z.infer<typeof courierProfileInput>;

export const courierZoneInput = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
	radiusKm: z.number().int().min(1).max(30),
	label: shortText(100),
});
export type CourierZoneInput = z.infer<typeof courierZoneInput>;

export const courierProfileSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	serviceArea: z.string(),
	zoneLat: z.number().nullable(),
	zoneLng: z.number().nullable(),
	zoneRadiusKm: z.number().nullable(),
	bio: z.string().nullable(),
	vehicleName: z.string().nullable(),
	vehiclePlate: z.string().nullable(),
	vehiclePhotoUrl: z.string().nullable(),
	isAvailable: z.boolean(),
	verificationStatus: z.enum(COURIER_VERIFICATION_STATUSES),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type CourierProfile = z.infer<typeof courierProfileSchema>;

export const courierDirectoryInput = z.object({
	businessId: z.string(),
	search: z.string().trim().min(2).max(100),
});
export type CourierDirectoryInput = z.infer<typeof courierDirectoryInput>;

/** The minimum public profile a business sees while choosing a courier. */
export const courierDirectoryEntrySchema = z.object({
	profileId: z.string(),
	displayName: z.string(),
	image: imageUrlSchema.nullable(),
	serviceArea: z.string(),
	zoneRadiusKm: z.number().nullable().optional(),
	bio: z.string().nullable(),
	isAvailable: z.boolean(),
	isVerified: z.literal(true),
	isMember: z.boolean(),
	isInvited: z.boolean(),
});
export type CourierDirectoryEntry = z.infer<typeof courierDirectoryEntrySchema>;

export const courierInviteInput = z.object({
	businessId: z.string(),
	profileId: z.string(),
});
export type CourierInviteInput = z.infer<typeof courierInviteInput>;

export const courierRespondInput = z.object({
	inviteId: z.string(),
	response: z.enum(["ACCEPTED", "DECLINED"]),
});
export type CourierRespondInput = z.infer<typeof courierRespondInput>;

export const courierInviteSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	businessLogoUrl: z.string().nullable(),
	courierUserId: z.string(),
	courierName: z.string(),
	profileId: z.string(),
	status: z.enum(COURIER_INVITE_STATUSES),
	createdAt: z.date(),
	expiresAt: z.date(),
	respondedAt: z.date().nullable(),
});
export type CourierInvite = z.infer<typeof courierInviteSchema>;

/**
 * What this courier has actually done, and what customers think of them.
 *
 * **The reputation a business ranks on, handed back to the person it is about.**
 * `candidateFor` already reads exactly these rows to order the pool — delivered runs, received
 * rating, the oldest last offer — and nothing exposed any of it to the courier. This is that read,
 * pointed the other way.
 *
 * **Every count here is a real `COUNT(*)`, and that is the point.** `deliveries.mine` would be the
 * obvious source and it is capped at `.limit(30)` (`services/deliveries.ts:411`), so a count taken
 * from it silently becomes a lie past thirty deliveries — which is roughly a courier's first month.
 */
export const courierStatsSchema = z.object({
	/** Completed runs, all time. Not a count of anything the client was handed. */
	deliveredTotal: z.number().int().nonnegative(),
	/** Completed runs in the last 30 days, for the number a courier cares about this month. */
	deliveredLast30Days: z.number().int().nonnegative(),
	/** When this courier first completed a run, or `null` if they never have. */
	firstDeliveredAt: z.date().nullable(),
	/**
	 * The mean of the ratings customers gave this courier, or `null` before the first one.
	 *
	 * `null` rather than `0`: a courier nobody has rated yet is not badly rated, and a zero here
	 * would render as "0 / 5" on a profile card.
	 */
	ratingAverage: z.number().min(1).max(5).nullable(),
	/** How many ratings the average is over, so the client can refuse to show a mean of one. */
	ratingCount: z.number().int().nonnegative(),
});
export type CourierStats = z.infer<typeof courierStatsSchema>;

export const courierBusinessInvitesInput = z.object({
	businessId: z.string(),
});
export type CourierBusinessInvitesInput = z.infer<
	typeof courierBusinessInvitesInput
>;

export const courierCancelInviteInput = z.object({
	businessId: z.string(),
	inviteId: z.string(),
});
export type CourierCancelInviteInput = z.infer<typeof courierCancelInviteInput>;
