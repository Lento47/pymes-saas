/**
 * The courier's own profile - who they are to a business before any membership exists.
 *
 * A courier account is not a courier membership. The account holder fills a profile,
 * the platform reviews it, and only an invitation accepted by a shop creates the
 * `COURIER` row that opens the board. Keeping those states separate is what stops a
 * shop from adding an arbitrary account by knowing its email - and it is why the
 * profile carries a `verificationStatus` while carrying no authority at all.
 *
 * The directory and invitation schemas that also lived here were part of the trust
 * extension (searchable directory, invite/respond flow); they are not imported yet
 * and are deliberately not carried over unimplemented.
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

export const courierProfileInput = z.object({
	displayName: shortText(80),
	serviceArea: shortText(100),
	bio: z.string().trim().max(300).optional(),
	/** The vehicle: name (model or nickname), plate, and its photo's path. */
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
