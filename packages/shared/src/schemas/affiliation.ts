/**
 * Affiliations and verification requests — the wire vocabulary for Phase 2.
 *
 * `schemas/identity.ts` carries the *alphabet* a badge is drawn from; this file
 * carries the questions a client asks to change one. They are separate because the
 * two have different audiences and different lifetimes: the identity unions are read
 * by every profile screen on the platform, and these inputs are read by four screens
 * a shop opens twice a year.
 *
 * ## The one rule that shapes everything here
 *
 * **A verification request carries private evidence, and a verification read never
 * returns it.** `legalName`, `taxId`, `supportEmail` and `documents` travel *in* on
 * `verificationRequestInput` and are stored on `business_verification_request`; the
 * owner's own read of the same row comes back through `businessVerificationSchema`,
 * which has no field for any of them. That is not an oversight to be corrected later
 * — an owner already knows their own tax id, and a shape that carried it would be one
 * careless `select *` away from putting it on a public profile.
 *
 * `reviewNote` is the stricter case: it is written *for a colleague* ("the tax id
 * does not match the legal name") and appears in no schema in this file at all. The
 * applicant is told `decisionReason`, which is a separate column written for them.
 */

import { z } from "zod";
import { membershipRoleSchema } from "./user";
import { slugSchema } from "./common";
import {
	affiliationStatusSchema,
	pendingInvitationSchema,
	profileIdentitySchema,
	verificationStatusSchema,
} from "./identity";

/**
 * How long an invitation stays acceptable, in days.
 *
 * A constant rather than a parameter, and shared rather than kept in the service:
 * the client renders "expira el 12 de marzo" from `expiresAt`, which the server
 * computed from this number, and a screen that computed its own would disagree with
 * the server the first time somebody changed one of them.
 *
 * Fourteen days is long enough to survive a holiday and short enough that a shop's
 * team list is not full of addresses nobody answered. It is deliberately not
 * configurable per plan: an invitation is not a resource the platform sells.
 */
export const AFFILIATION_INVITE_TTL_DAYS = 14;

/**
 * The roles a shop may invite somebody as.
 *
 * `COURIER` is absent and that is a contract, not a permission check: couriers are
 * invited through `couriers.invite`, which searches reviewed, opted-in rider profiles
 * and waits for the rider's own acceptance. Two procedures that both grant the same
 * role is how one of them ends up skipping the review the other performs — the same
 * reason `business.inviteStaff` refuses `COURIER` today.
 *
 * Derived from `membershipRoleSchema` rather than restated, so a role added to the
 * union cannot silently become invitable here.
 */
export const INVITABLE_ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
export const invitableRoleSchema = membershipRoleSchema.extract(INVITABLE_ROLES);

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const affiliationInviteInput = z.object({
	businessId: z.string(),
	email: z.string().email().max(200),
	role: invitableRoleSchema,
});

/**
 * One row of the shop's own affiliation list.
 *
 * Everything a membership can be, in one shape, because the screen that shows it is
 * a single table with a status column: a pending invitation, a person who works here,
 * and somebody who was removed three months ago are three rows of the same list.
 * Splitting them into three procedures would make "how many people have we invited"
 * a question no single call answers.
 *
 * `expired` is **computed at read time and never stored** — the same rule the badge
 * follows, for the same reason. `status` is what the row says; `expired` is what the
 * clock says, and a stored `EXPIRED` that a cron has not written yet would show an
 * Accept button that the server refuses. A client reads `status` to choose the words
 * and `expired` to choose the buttons.
 */
export const affiliationRowSchema = z.object({
	membershipId: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	role: membershipRoleSchema,
	status: affiliationStatusSchema,
	/** True when the row is a pending invitation past its own window. */
	expired: z.boolean(),
	invitedBy: z
		.object({ id: z.string(), name: z.string() })
		.nullable(),
	acceptedAt: z.date().nullable(),
	revokedAt: z.date().nullable(),
	expiresAt: z.date().nullable(),
	createdAt: z.date(),
});
export type AffiliationRow = z.infer<typeof affiliationRowSchema>;

export const affiliationListInput = z.object({
	businessId: z.string(),
	/** Filter the table to one state, or every state when omitted. */
	status: affiliationStatusSchema.optional(),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(50).default(25),
});

/**
 * What `business.inviteAffiliate` answers with.
 *
 * `token` is the **only** place the raw invitation token ever appears, and the
 * docblock on the column in `schema.ts` says why that has to be true: the stored
 * value is a digest, so a response is the one moment the link exists in a form
 * anything can use. A client shows it once — a "copy link" button — or hands it to
 * the mailer, and no later read can recover it.
 */
export const affiliationInvitationSchema = z.object({
	membershipId: z.string(),
	businessId: z.string(),
	role: membershipRoleSchema,
	email: z.string(),
	/** The raw link token. Returned once, by this call and by nothing else. */
	token: z.string(),
	expiresAt: z.date(),
	createdAt: z.date(),
});
export type AffiliationInvitation = z.infer<typeof affiliationInvitationSchema>;

export const affiliationAcceptInput = z.object({
	invitationId: z.string().min(5).max(64),
});

export const affiliationDeclineInput = affiliationAcceptInput;

export const affiliationLeaveInput = z.object({
	businessId: z.string(),
});

/**
 * The reason gate for removing somebody, on the wire.
 *
 * `reason` is required here **and** checked in the service through
 * `requireReason("affiliation.revoke", …)`, for the reason `services/audit.ts` gives:
 * the schema guards the wire and the service guards the service, which is reachable
 * directly by anything holding a `UserContext`.
 */
export const affiliationRevokeInput = z.object({
	businessId: z.string(),
	userId: z.string(),
	reason: z.string().trim().min(1).max(500),
});

// ---------------------------------------------------------------------------
// The invitation link, resolved before there is a session
// ---------------------------------------------------------------------------

/**
 * What a signed-out visitor is told about an invitation link.
 *
 * **No private field of any kind.** The token proves the visitor holds a link that was
 * emailed to somebody; it proves nothing about who they are, so this response is
 * written for a stranger and carries only what the sign-in screen has to say out loud:
 * which shop, as what role, invited by whom, and whether the window is still open.
 *
 * The email address is deliberately absent. It is the one field that would turn a
 * leaked token into "which account is this for", and the person holding the link
 * already knows their own address.
 */
export const invitationPreviewSchema = z.object({
	businessName: z.string(),
	businessSlug: z.string(),
	businessLogoUrl: z.string().nullable(),
	role: membershipRoleSchema,
	invitedBy: z
		.object({ id: z.string(), name: z.string(), image: z.string().nullable() })
		.nullable(),
	expiresAt: z.date().nullable(),
	/** Whether the link still leads anywhere. A client shows the page either way. */
	acceptable: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const invitationPreviewInput = z.object({
	token: z.string().min(20).max(200),
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * A shop's application for verification.
 *
 * Every field is optional except nothing — an applicant fills in what they have, and
 * the reviewer decides with what arrived. A schema that made `taxId` mandatory would
 * refuse a shop whose registration is still being processed, and the refusal would be
 * a validation error rather than a sentence about documents.
 *
 * `domain` is normalised to a bare host by the service, not here: a transform in a
 * shared schema runs on every client that parses it, and the two clients would then
 * have to agree on `www.` in two places.
 */
export const verificationRequestInput = z.object({
	businessId: z.string(),
	legalName: z.string().trim().min(2).max(200).optional(),
	country: z.string().trim().min(2).max(2).optional(),
	taxId: z.string().trim().min(4).max(60).optional(),
	supportEmail: z.string().email().max(200).optional(),
	domain: z.string().trim().min(3).max(200).optional(),
	domainEvidenceUrl: z.string().trim().max(500).optional(),
	/** Upload ids from `uploads.create`, at most eight. */
	documents: z.array(z.string().min(5).max(64)).max(8).optional(),
});
export type VerificationRequestInput = z.infer<typeof verificationRequestInput>;

/**
 * One entry in the shop's own review history.
 *
 * Built from `business_verification_request` and **not** from the audit log, because
 * the question is "what happened to my application" and the answer has to include the
 * reason a reviewer gave, which lives on the request row. The audit log answers a
 * different question — who did it — and the console reads that one.
 *
 * There is no `reviewNote` field and there will not be one: see this file's header.
 */
export const verificationTimelineEntrySchema = z.object({
	id: z.string(),
	status: verificationStatusSchema,
	submittedAt: z.date(),
	reviewedAt: z.date().nullable(),
	/** What the applicant was told, when the reviewer wrote something down. */
	decisionReason: z.string().nullable(),
});
export type VerificationTimelineEntry = z.infer<
	typeof verificationTimelineEntrySchema
>;

/**
 * The shop's own view of its verification.
 *
 * `status` is the **effective** one, with expiry applied, and it is deliberately the
 * same projection `identity.profile` uses. A shop whose approval lapsed reads
 * `NONE` here and shows no badge on its own storefront, which is the only answer that
 * cannot disagree with what customers see.
 *
 * The stored values survive in `timeline`, which is where history belongs.
 */
export const businessVerificationSchema = z.object({
	status: verificationStatusSchema,
	verifiedAt: z.date().nullable(),
	expiresAt: z.date().nullable(),
	/** Whether an application is open right now, so the screen can hide the button. */
	openRequestId: z.string().nullable(),
	timeline: z.array(verificationTimelineEntrySchema),
});
export type BusinessVerification = z.infer<typeof businessVerificationSchema>;

export const verificationScopeInput = z.object({ businessId: z.string() });

// ---------------------------------------------------------------------------
// The admin's decisions
// ---------------------------------------------------------------------------

/**
 * Approving, rejecting or revoking a shop's verification.
 *
 * `targetId` names the **business**, not the request. The console works from the
 * business list and from the queue, and a request id would make the same action take
 * two different inputs depending on which screen opened it — and would break the
 * moment a shop applied a second time.
 *
 * `reviewNote` is optional and internal; `reason` is the audited justification, and
 * it is required for the two actions that remove something.
 */
export const adminVerificationDecisionInput = z.object({
	targetId: z.string().min(5).max(64),
	reason: z.string().trim().max(500).optional(),
	/** Written for colleagues. Never returned to the applicant or to a public read. */
	reviewNote: z.string().trim().max(2000).optional(),
	/** What the applicant is told. Defaults to nothing, which reads as "no comment". */
	decisionReason: z.string().trim().max(500).optional(),
});
export type AdminVerificationDecisionInput = z.infer<
	typeof adminVerificationDecisionInput
>;

export const adminVerificationQueueInput = z.object({
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(100).default(25),
});
export type AdminVerificationQueueInput = z.infer<
	typeof adminVerificationQueueInput
>;

/**
 * One row of the review queue.
 *
 * The queue is where a reviewer *reads evidence*, so this row is the one shape in
 * this file that legitimately carries the private fields — it is adminProcedure-only
 * and cross-tenant, and a reviewer who cannot see the tax id cannot check it against
 * the legal name. It is named separately from every other shape here so that it
 * cannot be confused with one that travels to a client.
 */
export const adminVerificationQueueRowSchema = z.object({
	requestId: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	businessSlug: z.string(),
	submittedAt: z.date(),
	submittedBy: z
		.object({ id: z.string(), name: z.string(), email: z.string() })
		.nullable(),
	legalName: z.string().nullable(),
	country: z.string().nullable(),
	taxId: z.string().nullable(),
	supportEmail: z.string().nullable(),
	domain: z.string().nullable(),
	domainEvidenceUrl: z.string().nullable(),
	documents: z.array(z.string()).nullable(),
});
export type AdminVerificationQueueRow = z.infer<
	typeof adminVerificationQueueRowSchema
>;

// ---------------------------------------------------------------------------
// `identity.mine()`
// ---------------------------------------------------------------------------

/**
 * One shop the caller may act for, with the badge that follows from it.
 *
 * `affiliationBadge` is the same boolean `identityDisplaySchema` carries, from the
 * same function, computed at read time. It is a bare field here rather than a whole
 * `IdentityDisplay` because the subject of *this* row is a person — whose avatar is
 * always a circle and whose own badge is always `none` — so two thirds of that shape
 * would be constants a client had to ignore.
 */
export const myAffiliationSchema = z.object({
	businessId: z.string(),
	businessSlug: z.string(),
	businessName: z.string(),
	businessLogoUrl: z.string().nullable(),
	role: membershipRoleSchema,
	affiliationBadge: z.boolean(),
});
export type MyAffiliation = z.infer<typeof myAffiliationSchema>;

/**
 * Who the caller is, and everything hanging off that.
 *
 * `identity` is scoped by `scopeBusinessId` when one is given and unscoped otherwise,
 * and the difference matters: with no scope the resolver hands `deriveDisplay` a null
 * affiliation, so `affiliationBadge` is `false` rather than "true for whichever shop
 * happened to come back first". A client that wants the badge asks for the scope it
 * is drawing.
 *
 * `pendingInvitations` is the same list `business.pendingInvitations` returns, from
 * the same service. It is here as well because this procedure answers "who am I and
 * what is waiting for me", and a client that had to make two calls to draw one screen
 * would eventually make one.
 */
export const myIdentitySchema = z.object({
	identity: profileIdentitySchema,
	affiliations: z.array(myAffiliationSchema),
	pendingInvitations: z.array(pendingInvitationSchema),
});
export type MyIdentity = z.infer<typeof myIdentitySchema>;

export const myIdentityInput = z
	.object({
		/**
		 * The shop the caller has selected in the switcher, if any. Honoured only when
		 * it names an `ACTIVE` membership — see `services/identity.ts`.
		 */
		scopeBusinessId: z.string().optional(),
	})
	.optional();

export const publicProfileInput = z.object({ slug: slugSchema });
