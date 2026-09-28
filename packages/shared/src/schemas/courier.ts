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
	bio: z.string().trim().max(300).optional(),
	/** The vehicle: name (model or nickname), plate, and its photo's URL. */
	vehicleName: z.string().trim().max(80).optional(),
	vehiclePlate: z.string().trim().max(20).optional(),
	vehiclePhotoUrl: imageUrlSchema.optional(),
	isAvailable: z.boolean().default(true),
});
export type CourierProfileInput = z.infer<typeof courierProfileInput>;

export const courierProfileSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	serviceArea: z.string(),
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
