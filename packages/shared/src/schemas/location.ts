import { z } from "zod";
import { businessHoursSchema } from "./business";
import { latitudeSchema, longitudeSchema, shortText } from "./common";

export const LOCATION_OPERATIONAL_STATUSES = [
	"open",
	"closed_schedule",
	"paused_manual",
	"paused_capacity",
	"paused_platform",
	"offline",
	"suspended",
] as const;
export type LocationOperationalStatus =
	(typeof LOCATION_OPERATIONAL_STATUSES)[number];

export const LOCATION_PAUSE_REASONS = [
	"manual",
	"capacity",
	"platform",
] as const;
export type LocationPauseReason = (typeof LOCATION_PAUSE_REASONS)[number];

export const locationCreateInput = z.object({
	businessId: z.string().min(1),
	name: shortText(120),
	line1: shortText(200),
	line2: z.string().trim().max(200).optional(),
	city: shortText(80),
	region: shortText(80),
	country: z.string().trim().length(2).default("CR"),
	postalCode: z.string().trim().max(16).optional(),
	lat: latitudeSchema.optional(),
	lng: longitudeSchema.optional(),
	hours: businessHoursSchema.optional(),
});
export type LocationCreateInput = z.infer<typeof locationCreateInput>;

export const locationScopeInput = z.object({
	businessId: z.string().min(1),
	locationId: z.string().min(1),
});

export const locationPauseInput = locationScopeInput.extend({
	reason: z.enum(["manual", "capacity"]),
	/** Missing duration means the merchant must resume orders explicitly. */
	durationMinutes: z
		.union([z.literal(15), z.literal(30), z.literal(60)])
		.optional(),
});
export type LocationPauseInput = z.infer<typeof locationPauseInput>;

export const merchantLocationSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	name: z.string(),
	isDefault: z.boolean(),
	line1: z.string().nullable(),
	line2: z.string().nullable(),
	city: z.string().nullable(),
	region: z.string().nullable(),
	country: z.string().nullable(),
	postalCode: z.string().nullable(),
	lat: z.number().nullable(),
	lng: z.number().nullable(),
	status: z.enum(LOCATION_OPERATIONAL_STATUSES),
	todayHours: z
		.object({
			opensMinute: z.number().int().min(0).max(1440),
			closesMinute: z.number().int().min(0).max(1440),
		})
		.nullable(),
	pausedAt: z.date().nullable(),
	resumeAt: z.date().nullable(),
	createdAt: z.date(),
});
export type MerchantLocation = z.infer<typeof merchantLocationSchema>;
