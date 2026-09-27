import { z } from "zod";
import { businessHoursEntrySchema, businessHoursSchema } from "./business";
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
	pausedAt: z.date().nullable(),
	resumeAt: z.date().nullable(),
	/**
	 * The one opening window that matters right now: today's `businessHoursEntrySchema`
	 * for this location, resolved on the server against the shop's timezone.
	 *
	 * Derived rather than stored — a location's `hours` is a week's entries and the
	 * question a caller actually asks is "is it open this minute" — which is why it is
	 * **optional** here and not a column. Absent means the read has nothing to say about
	 * today (no hours recorded, or the timezone has not rolled over yet); `null` means
	 * today's entry exists and says `isClosed`. `app/(business)/index.tsx` draws the
	 * dashboard's today line only when one is there, and its guard treats both the same
	 * way, so the distinction costs a reader nothing and keeps the writer honest.
	 *
	 * One day's entry rather than a bare `{opensMinute, closesMinute}` pair: it is the
	 * same object `hours` holds, so the minute range and the closes-after-opens rule
	 * live in one place instead of a second copy of both.
	 */
	todayHours: businessHoursEntrySchema.nullable().optional(),
	createdAt: z.date(),
});
export type MerchantLocation = z.infer<typeof merchantLocationSchema>;
