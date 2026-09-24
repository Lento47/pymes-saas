/**
 * A business: the tenant, the storefront, and the thing a customer actually chooses
 * between on the home screen.
 *
 * Two views of the same row, and the difference is the point:
 *
 * - `businessCardSchema` is what a stranger sees — no phone number, no email, no
 *   street address, because a marketplace that publishes every business's contact
 *   details is a scraper's directory and loses the order to a phone call.
 * - `businessSettingsSchema` is what a member sees, which is everything.
 *
 * Keeping them as two named schemas rather than one with optional fields means the
 * compiler catches the leak: a card that starts rendering `email` has to be given a
 * schema that has one.
 */

import { z } from "zod";
import {
	currencySchema,
	imageUrlSchema,
	latitudeSchema,
	longitudeSchema,
	phoneSchema,
	shortText,
	slugSchema,
} from "./common";
import { membershipRoleSchema } from "./user";

export const BUSINESS_STATUSES = [
	"DRAFT",
	"ACTIVE",
	"SUSPENDED",
	"CLOSED",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/**
 * Opening hours, as local wall-clock minutes since midnight (0–1440), one entry per
 * weekday. Stored as JSON on the business because it is read as a whole, written as
 * a whole, and never queried by hour — a table would buy a join and nothing else.
 *
 * Minutes rather than a time string because "18:00" has to be parsed by every
 * consumer and one of them will do it in the wrong timezone.
 */
export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

export const businessHoursEntrySchema = z
	.object({
		day: z.number().int().min(0).max(6),
		opensMinute: z.number().int().min(0).max(1440),
		closesMinute: z.number().int().min(0).max(1440),
		isClosed: z.boolean().default(false),
	})
	.refine((entry) => entry.isClosed || entry.closesMinute > entry.opensMinute, {
		message: "La hora de cierre debe ser posterior a la de apertura",
	});
export type BusinessHoursEntry = z.infer<typeof businessHoursEntrySchema>;

export const businessHoursSchema = z
	.array(businessHoursEntrySchema)
	.max(7)
	.refine(
		(entries) =>
			new Set(entries.map((entry) => entry.day)).size === entries.length,
		{ message: "Hay días repetidos en el horario" },
	);

export const businessCreateInput = z.object({
	name: shortText(120),
	slug: slugSchema.optional(),
	description: z.string().trim().max(600).optional(),
	/**
	 * The category this shop is filed under. Required, and a **leaf**.
	 *
	 * A leaf of the platform taxonomy and never a sector: `0006_category_taxonomy.sql` made the
	 * categories two levels, and a shop filed on a sector would answer for every child under it
	 * — `businesses.list` already reads a sector filter as "this sector and the categories it
	 * holds" (`services/helpers.ts`, `inCategory`). `services/businesses.ts`'s
	 * `assertLeafCategory` is what refuses a sector, an inactive row and an id that does not
	 * exist, because zod cannot read a table.
	 *
	 * Required since the taxonomy became real. The six flat seed rows made this a label a shop
	 * could take or leave, and a shop with none appears under no category anywhere: this column
	 * is what `businesses.list` filters on and what the storefront draws.
	 */
	categoryId: z.string().min(1),
	phone: phoneSchema.optional(),
	email: z.string().email().max(200).optional(),
	line1: shortText(200),
	line2: z.string().trim().max(200).optional(),
	city: shortText(80),
	region: shortText(80),
	country: z.string().trim().length(2).default("CR"),
	postalCode: z.string().trim().max(16).optional(),
	lat: latitudeSchema.optional(),
	lng: longitudeSchema.optional(),
	/**
	 * Fixed at creation and never editable. A business that switches currency has to
	 * re-price every product, and interpreting yesterday's orders in today's currency
	 * is a way to charge somebody the wrong amount with no error anywhere.
	 */
	currency: currencySchema.default("CRC"),
	deliveryEnabled: z.boolean().default(true),
	pickupEnabled: z.boolean().default(true),
	deliveryFeeMinor: z.number().int().min(0).max(10_000_000).default(0),
	deliveryRadiusKm: z.number().min(0).max(80).default(6),
	prepTimeMinutes: z.number().int().min(0).max(600).default(25),
	minOrderMinor: z.number().int().min(0).max(100_000_000).default(0),
});
export type BusinessCreateInput = z.infer<typeof businessCreateInput>;

export const businessUpdateInput = businessCreateInput
	.omit({ currency: true, slug: true })
	.partial()
	.extend({
		logoUrl: imageUrlSchema.nullable().optional(),
		coverUrl: imageUrlSchema.nullable().optional(),
		hours: businessHoursSchema.optional(),
		pickupEnabled: z.boolean().optional(),
	});
export type BusinessUpdateInput = z.infer<typeof businessUpdateInput>;

export const businessListInput = z.object({
	search: z.string().trim().max(120).optional(),
	categoryId: z.string().optional(),
	lat: latitudeSchema.optional(),
	lng: longitudeSchema.optional(),
	radiusKm: z.number().min(0.5).max(80).default(10),
	openNow: z.boolean().default(false),
	deliveryOnly: z.boolean().default(false),
	/**
	 * `best` is additive on this side: the four sorts a client already pages on keep their
	 * behaviour and their meaning, because a shipped mobile build sends one of them by name and
	 * a reordering of the others would be a silent change to a screen nobody re-tested.
	 * `distance` stays the *default* for that same reason — a caller that names no sort keeps
	 * the order it has always had, and a client that wants the ranking asks for it by name.
	 * Both do: `apps/mobile/app/nearby.tsx` defaults to it, `apps/web`'s category page sends it.
	 */
	sort: z
		.enum(["distance", "rating", "popular", "newest", "best"])
		.default("distance"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(50).default(20),
});
export type BusinessListInput = z.infer<typeof businessListInput>;

/**
 * The storefront view. `isOpen` and `distanceKm` are computed server-side: the
 * client would need the business's timezone, its hours and the current time to work
 * `isOpen` out for itself, and the first two of those are exactly what a phone in a
 * different timezone gets wrong.
 */
export const businessCardSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	logoUrl: z.string().nullable(),
	coverUrl: z.string().nullable(),
	city: z.string(),
	categoryId: z.string().nullable(),
	categoryName: z.string().nullable(),
	/**
	 * The category's English name, flattened onto the card beside the Spanish one.
	 *
	 * `null` where the row has none — the six demo categories `packages/db/src/seed.ts`
	 * writes carry Spanish only — so a client showing `en` falls back to `categoryName`,
	 * which is never null when a category is set at all.
	 */
	categoryNameEn: z.string().nullable(),
	currency: currencySchema,
	ratingAvg: z.number().min(0).max(5),
	ratingCount: z.number().int().min(0),
	deliveryEnabled: z.boolean(),
	pickupEnabled: z.boolean(),
	deliveryFeeMinor: z.number().int(),
	prepTimeMinutes: z.number().int(),
	minOrderMinor: z.number().int(),
	isVerified: z.boolean(),
	isOpen: z.boolean(),
	distanceKm: z.number().nullable(),
});
export type BusinessCard = z.infer<typeof businessCardSchema>;

export const businessSettingsSchema = businessCardSchema.extend({
	status: z.enum(BUSINESS_STATUSES),
	phone: z.string().nullable(),
	email: z.string().nullable(),
	line1: z.string(),
	line2: z.string().nullable(),
	region: z.string(),
	country: z.string(),
	postalCode: z.string().nullable(),
	lat: z.number().nullable(),
	lng: z.number().nullable(),
	deliveryRadiusKm: z.number(),
	hours: businessHoursSchema,
	createdAt: z.date(),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

/**
 * One person on the team, as the staff screen lists them.
 *
 * It carries `userId` and not a membership id, because every procedure that acts on
 * a member — changing a role, removing them — takes a `userId`, and a screen that
 * renders a membership id is a screen whose row cannot be used for anything.
 *
 * `email` is here and would not be on `businessCardSchema`: a colleague's address is
 * something a manager already has, and hiding it would only mean the invite flow and
 * the list disagreed about who is who.
 */
export const staffMemberSchema = z.object({
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	role: membershipRoleSchema,
	joinedAt: z.date(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;
