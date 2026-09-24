/**
 * The person's own surface: their profile, their addresses, their roles.
 *
 * Nothing here takes a `userId`. Every one of these procedures acts on the caller,
 * which is why the schemas have no place to put one — the shape of the input is the
 * authorisation check, and a schema that cannot express "read someone else's
 * address" is stronger than a service that remembers not to.
 */

import { z } from "zod";
import {
	imageUrlSchema,
	latitudeSchema,
	longitudeSchema,
	phoneSchema,
	shortText,
} from "./common";

export const MEMBERSHIP_ROLES = [
	"OWNER",
	"MANAGER",
	"STAFF",
	"COURIER",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);

/**
 * The names of the things a role can be granted.
 *
 * Spelled out as a union rather than left as `string` so that
 * `businessProcedure(capability)` takes a *name that exists*: a router that asks for
 * `"orders:write"`, a capability no role holds, is then a compile error instead of a
 * procedure nobody can ever call. The table below is typed against it, so adding a
 * capability here without granting it to a role — or granting one that is not named
 * here — is caught in the same place.
 */
export type RoleCapability =
	| "orders:read"
	| "orders:advance"
	| "products:read"
	| "products:write"
	| "business:settings"
	| "staff:manage"
	| "analytics:read"
	| "payouts:read"
	| "business:delete";

/** What each role may do, in one place, so the API and the UI agree on the menu. */
export const ROLE_CAPABILITIES: Record<
	MembershipRole,
	readonly RoleCapability[]
> = {
	STAFF: ["orders:read", "orders:advance", "products:read", "products:write"],
	/**
	 * The courier: their own deliveries and nothing else. They read the board
	 * to find their runs and advance the ones assigned to them — assignment
	 * itself is `staff:manage`, which they deliberately lack, so a courier
	 * cannot hand orders to themselves or anyone else.
	 */
	COURIER: ["orders:read", "orders:advance"],
	MANAGER: [
		"orders:read",
		"orders:advance",
		"products:read",
		"products:write",
		"business:settings",
		"staff:manage",
		"analytics:read",
	],
	OWNER: [
		"orders:read",
		"orders:advance",
		"products:read",
		"products:write",
		"business:settings",
		"staff:manage",
		"analytics:read",
		"payouts:read",
		"business:delete",
	],
};

/**
 * Whether a role may do a thing.
 *
 * `capability` is `RoleCapability` rather than `string` on purpose: a permission check
 * that accepts any word compiles fine and answers `false` for a typo, which is a menu
 * item that silently never appears — the failure nobody reports. Typed, the typo is a
 * build error.
 */
export function roleCan(
	role: MembershipRole,
	capability: RoleCapability,
): boolean {
	return ROLE_CAPABILITIES[role].includes(capability);
}

export const userProfileSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	phone: z.string().nullable(),
	isAdmin: z.boolean(),
	createdAt: z.date(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileInput = z.object({
	name: shortText(120).optional(),
	phone: phoneSchema.optional(),
	image: imageUrlSchema.nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;

/**
 * An address, with coordinates when the browser or the phone could supply them.
 *
 * Coordinates are optional on purpose: a customer typing an address in a barangay
 * with no map coverage must still be able to order, and a delivery whose address is
 * text-only is a driver phone call rather than a blocked checkout.
 */
export const addressInput = z.object({
	label: shortText(40).default("Casa"),
	line1: shortText(200),
	line2: z.string().trim().max(200).optional(),
	city: shortText(80),
	region: shortText(80),
	country: z.string().trim().length(2).default("CR"),
	postalCode: z.string().trim().max(16).optional(),
	lat: latitudeSchema.optional(),
	lng: longitudeSchema.optional(),
	phone: phoneSchema.optional(),
	instructions: z.string().trim().max(300).optional(),
	isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressInput>;

export const addressSchema = addressInput.extend({
	id: z.string(),
	createdAt: z.date(),
});
export type Address = z.infer<typeof addressSchema>;

/** A business the caller belongs to, as shown in the app's business switcher. */
export const membershipSummarySchema = z.object({
	businessId: z.string(),
	businessName: z.string(),
	businessSlug: z.string(),
	logoUrl: z.string().nullable(),
	role: membershipRoleSchema,
});
export type MembershipSummary = z.infer<typeof membershipSummarySchema>;

/**
 * The switches behind the settings screen's Avisos and Privacidad sections.
 *
 * Three booleans and deliberately no more: these are the three columns on the
 * `user` row, and a fourth would be a switch no writer reads. Promotions and
 * new-store alerts are absent on purpose — no producer writes those rows
 * (`packages/db/src/schema.ts` says so on the columns) — so a key for them
 * here would be a control for a silence.
 */
export const notificationPrefsSchema = z.object({
	notifyOrderUpdates: z.boolean(),
	notifyReviewReplies: z.boolean(),
	showReviewAvatar: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

/** Any subset of the three; an empty object changes nothing and answers true. */
export const updatePreferencesInput = notificationPrefsSchema.partial();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesInput>;
