/**
 * Verified profiles and organization affiliations — the shared vocabulary.
 *
 * The test from the package header applies: would the server and a client
 * disagreeing about these values be a bug? Yes, and in a way nobody would see,
 * because a badge is drawn by a phone and decided by the Worker. The rule set
 * lives **in the API** (`services/identity.ts`) and this file carries only the
 * alphabet it speaks in, so there is exactly one place that can be wrong.
 *
 * ## The two narrow unions, and what is deliberately missing
 *
 * `verificationStatus` has five states and `verificationLevel` has one real
 * value. They are separate because they answer separate questions — *how far
 * through review is this shop* and *what is it verified as* — and because a shop
 * can be `REJECTED` at `NONE` level without the level ever having been set.
 *
 * **`GOVERNMENT` and `PREMIUM` are intentionally absent**, in both the levels and
 * the badges. The platform verifies a business against a legal name, a tax id
 * and a domain; it has no process that could honestly produce a claim about a
 * government, and nothing in the plan model sells verification, so a paid badge
 * would be a state no code path can reach and every reader would have to handle.
 * They are additive when they arrive — one literal here, one in `profileBadge`,
 * one branch in `deriveDisplay` — which is the property that makes leaving them
 * out the cheaper choice today rather than a debt.
 */

import { z } from "zod";

import { membershipRoleSchema } from "./user";

/**
 * What kind of account a profile belongs to.
 *
 * `BUSINESS`, not `ORGANIZATION`: PymesHub's own word for the entity is
 * `business` throughout the schema, the routers and the Spanish dictionaries,
 * and a second word for the same row is how a client ends up branching on two
 * spellings of one concept.
 */
export const ACCOUNT_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

export const VERIFICATION_STATUSES = [
	"NONE",
	"PENDING",
	"APPROVED",
	"REJECTED",
	"REVOKED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);

export const VERIFICATION_LEVELS = ["NONE", "BUSINESS"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];
export const verificationLevelSchema = z.enum(VERIFICATION_LEVELS);

export const AFFILIATION_STATUSES = [
	"ACTIVE",
	"PENDING_USER_ACCEPTANCE",
	"REVOKED",
	"EXPIRED",
] as const;
export type AffiliationStatus = (typeof AFFILIATION_STATUSES)[number];
export const affiliationStatusSchema = z.enum(AFFILIATION_STATUSES);

/**
 * What an affiliation read reports, which is the stored states **plus `NONE`**.
 *
 * `NONE` is not a value `membership.status` can hold: it means there is no
 * membership at all, which is the normal state for a customer. It is a member of
 * this union rather than a `business: null` with a popped status because a client
 * that has to test two fields for one fact will eventually test one of them.
 */
export const PROFILE_AFFILIATION_STATUSES = [
	"NONE",
	...AFFILIATION_STATUSES,
] as const;
export type ProfileAffiliationStatus =
	(typeof PROFILE_AFFILIATION_STATUSES)[number];
export const profileAffiliationStatusSchema = z.enum(
	PROFILE_AFFILIATION_STATUSES,
);

/**
 * How a profile is drawn.
 *
 * `avatarShape` and `profileBadge` are **computed at read time and never
 * stored**, which is the whole reason a revocation is immediate: there is no
 * column to update, no cache to invalidate and no cron that can be late. A
 * stored shape would be a second copy of `verification_status` and would drift
 * from it the first time a review lapses on a day nobody deployed.
 *
 * The two are separate fields rather than one `badge` because a client wants
 * them for different things — the shape sizes a container, the badge draws a
 * mark — and a single enum would force every caller to unpack it.
 */
export const AVATAR_SHAPES = ["circle", "roundedSquare"] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];
export const avatarShapeSchema = z.enum(AVATAR_SHAPES);

export const PROFILE_BADGES = ["none", "verifiedBusiness"] as const;
export type ProfileBadge = (typeof PROFILE_BADGES)[number];
export const profileBadgeSchema = z.enum(PROFILE_BADGES);

export const identityDisplaySchema = z.object({
	avatarShape: avatarShapeSchema,
	profileBadge: profileBadgeSchema,
	/**
	 * Whether the profile is shown as working at a verified business.
	 *
	 * A boolean rather than a badge name because it is genuinely binary here:
	 * there is one affiliation badge and it either shows or it does not. When a
	 * second kind exists this widens to an enum, and every caller that reads it
	 * as a boolean is already writing `if`.
	 */
	affiliationBadge: z.boolean(),
});
export type IdentityDisplay = z.infer<typeof identityDisplaySchema>;

export const verificationStateSchema = z.object({
	level: verificationLevelSchema,
	status: verificationStatusSchema,
	/**
	 * When the approval was granted. A `Date`, not a string: the API's tRPC
	 * transformer is superjson, which carries the type across the wire, and every
	 * other timestamp this package returns is a `Date`.
	 */
	verifiedAt: z.date().nullable(),
});
export type VerificationState = z.infer<typeof verificationStateSchema>;

/** The shop a person is affiliated with, as a badge draws it. */
export const affiliatedBusinessSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	logoUrl: z.string().nullable(),
	verificationLevel: verificationLevelSchema,
});
export type AffiliatedBusiness = z.infer<typeof affiliatedBusinessSchema>;

export const profileAffiliationSchema = z.object({
	status: profileAffiliationStatusSchema,
	/**
	 * Null exactly when `status` is `NONE`, and never otherwise: an affiliation
	 * always names the business it is with. The pair is two fields because a client
	 * shows the status while the business loads, but they are written together.
	 */
	business: affiliatedBusinessSchema.nullable(),
});
export type ProfileAffiliation = z.infer<typeof profileAffiliationSchema>;

export const profileIdentitySchema = z.object({
	accountType: accountTypeSchema,
	verification: verificationStateSchema,
	affiliation: profileAffiliationSchema,
	display: identityDisplaySchema,
});
export type ProfileIdentity = z.infer<typeof profileIdentitySchema>;

/**
 * One invitation waiting for the signed-in person to accept or decline.
 *
 * It carries `id` — the `membership` row's own id — because accepting is a write
 * against a specific invitation and the pair `(businessId)` alone would let a
 * stale screen accept an invitation that was revoked and re-issued in between.
 *
 * `invitedBy` is nullable and not optional: a membership created by an owner for
 * themselves has no inviter, and `invited_by_user_id` is `on delete set null`, so
 * the person who invited you can delete their account and leave the invitation
 * standing. A client draws the row without a name rather than failing to draw it.
 */
export const pendingInvitationSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessSlug: z.string(),
	businessName: z.string(),
	businessLogoUrl: z.string().nullable(),
	role: membershipRoleSchema,
	invitedBy: z
		.object({
			id: z.string(),
			name: z.string(),
			image: z.string().nullable(),
		})
		.nullable(),
	/** The invitation's own window. Null means it does not lapse. */
	expiresAt: z.date().nullable(),
	createdAt: z.date(),
});
export type PendingInvitation = z.infer<typeof pendingInvitationSchema>;
