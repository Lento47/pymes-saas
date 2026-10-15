import {
	business as businessTable,
	businessVerificationRequest as requestTable,
	type Db,
	user as userTable,
} from "@pymeshub/db";
import {
	type AdminVerificationDecisionInput,
	type AdminVerificationQueueInput,
	type AdminVerificationQueueRow,
	type BusinessVerification,
	decodeCursor,
	encodeCursor,
	newId,
	type VerificationRequestInput,
	type VerificationStatus,
	type VerificationTimelineEntry,
} from "@pymeshub/shared";
import { and, desc, eq, gt, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { ConflictError } from "../errors";
import { auditStatement, requireReason } from "./audit";
import type { BusinessContext, UserContext } from "./helpers";
import { batchOf, orNotFound } from "./helpers";
import { effectiveVerification, verificationIsLive } from "./identity";

/**
 * A shop asking to be verified, and an operator answering.
 *
 * ## The three rows one decision touches, and why they are three
 *
 * `business` carries the **current claim**: what the platform says about this shop right
 * now, in the columns every profile read consults. `business_verification_request` carries
 * the **episodes**: what was submitted, when, by whom, with what evidence, and what a
 * reviewer said. `audit_log` carries the **acts**: who pressed the button.
 *
 * Collapsing the first two is the tempting mistake and the reason the table exists —
 * columns on `business` would overwrite the first rejection on the second application, and
 * the evidence attached to the rejection is exactly what a reviewer needs on the retry.
 * Collapsing the third is a smaller mistake with a longer shadow: an approval with no audit
 * row cannot be told apart from a badge somebody set by hand.
 *
 * Every write below therefore batches: the current claim, the episode, and the act, as one
 * atomic unit. D1 offers no transaction to open from here, so `db.batch` is the only
 * atomicity available and a partial write is a shop whose profile says `APPROVED` with no
 * request that explains it.
 *
 * ## What may leave this file, and what may not
 *
 * `business.verification` is the **applicant's** read of their own application, and it
 * carries the timeline without `reviewNote` — the reviewer's private sentence to a
 * colleague. `admin.verificationQueue` is the **reviewer's** read and carries the evidence
 * (`legalName`, `taxId`, `supportEmail`, `domain`, `documents`) because a reviewer who
 * cannot see the tax id cannot check it against the legal name. Nothing here is reachable
 * from a public procedure, and `identity.profile` reads none of this table.
 *
 * `decisionReason` is the one field written for the applicant, and it is deliberately
 * separate from `reviewNote` rather than a filtered view of it. "El RUC no coincide con la
 * razón social" is a sentence a reviewer writes to be understood by whoever picks the
 * application up next, and it is not always a sentence to send to a merchant — the two
 * audiences want different words, and one column would force the reviewer to choose.
 *
 * ## `EXPIRED` does not exist here
 *
 * `verification_status` has no expiry state, unlike `membership.status`. A lapsed approval
 * keeps saying `APPROVED` with a past `verification_expires_at`, and every read collapses
 * it through `effectiveVerification` — so there is no stored value to sweep and nothing to
 * keep in step. The union is five states and `NONE` is what a lapsed claim reads as.
 */

/** How many episodes `business.verification` returns. A shop applies a handful of times, not hundreds. */
const TIMELINE_LIMIT = 20;

/**
 * A domain as the reviewer will compare it.
 *
 * A merchant types `https://www.CaféCentral.cr/menu`, and the reviewer compares it against
 * a registration document that says `cafecentral.cr`. Storing what was typed would make
 * that comparison a manual edit every time, and the field exists precisely so the
 * comparison can be made.
 *
 * Stripping the scheme, the `www.`, the path and the case is the whole normalisation, and
 * it is deliberately not a validation: a value that is not a domain at all — `cafecentral`,
 * `mi tienda` — is passed through unchanged rather than refused. The reviewer is going to
 * look at it either way, and a validation error here would be the platform refusing an
 * application over a formatting opinion.
 *
 * Lower-cased rather than punycoded, so an internationalised domain keeps its accents and
 * stays readable to the person who typed it. That is a deliberate choice against
 * correctness-by-machine: this column is read by a human doing a comparison, not by a
 * resolver.
 */
function normalizeDomain(value: string): string {
	const host = value
		.trim()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
		.replace(/^www\./i, "")
		.split(/[/?#]/, 1)[0];
	// `split` always returns at least one element, so `host` is never absent — but the
	// compiler cannot know that from an index access, and a `?? ""` here would be a silent
	// empty domain if it ever were. The guard is explicit for that reason.
	if (host === undefined) return "";
	return host.replace(/\.+$/, "").toLowerCase();
}

/**
 * The verification columns, read once.
 *
 * A named-column read rather than `select()` for the reason the table's docblock gives:
 * `business` has grown a column per feature and a `select *` here would put every one of
 * them in a function whose subject is four of them.
 */
async function readVerificationColumns(db: Db, businessId: string) {
	const rows = await db
		.select({
			id: businessTable.id,
			status: businessTable.status,
			isVerified: businessTable.isVerified,
			verificationStatus: businessTable.verificationStatus,
			verificationLevel: businessTable.verificationLevel,
			verifiedAt: businessTable.verifiedAt,
			verificationExpiresAt: businessTable.verificationExpiresAt,
		})
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);
	return orNotFound(rows[0]);
}

/**
 * The open application for a shop, if there is one.
 *
 * At most one row can match: `business_verification_request_open_unique` is a partial
 * unique index on `business_id where status = 'PENDING'`, so the database refuses a second
 * open application. The read exists so the refusal is a **sentence** rather than a
 * constraint error — the index is the guarantee, this is the explanation.
 */
async function openRequestOf(db: Db, businessId: string) {
	const rows = await db
		.select({ id: requestTable.id, createdAt: requestTable.createdAt })
		.from(requestTable)
		.where(
			and(
				eq(requestTable.businessId, businessId),
				eq(requestTable.status, "PENDING"),
			),
		)
		.limit(1);
	// `undefined` rather than `null` on purpose: every caller passes this straight to
	// `orNotFound`, which is the house helper for "a row that must exist" and takes
	// `undefined`. Returning `null` here would make `orNotFound`'s generic infer a nullable
	// type and hand back a value the compiler still calls possibly-null.
	return rows[0];
}

/**
 * A shop applies to be verified. OWNER or MANAGER, which is `business:settings`.
 *
 * ## Three refusals, and each one is a real state
 *
 * - **Already verified, and the claim is live.** Nothing to apply for. Refused rather than
 *   allowed to start a redundant review, because a second approval of an already-approved
 *   shop is a reviewer spending an afternoon on a question that has been answered.
 * - **An application is already open.** Refused by the read, guaranteed by the index. The
 *   message names the state rather than the constraint.
 * - **A *lapsed* approval is not a refusal.** This is the case worth spelling out: a shop
 *   verified in 2024 whose review window closed can apply again, and it must be able to,
 *   because otherwise a platform that sets expiry dates has no path back for the shops it
 *   expires. `verificationIsLive` is the test, and it is the same one every read uses.
 *
 * ## What the application writes, and the three fields it deliberately clears
 *
 * The request row takes the evidence as submitted. The business row moves to `PENDING`,
 * and `verification_level` goes to `NONE` while `verified_at` is cleared — because both of
 * them describe an **approval**, and this shop does not currently have one. Leaving them
 * would make `business.verification` report `{status: "PENDING", level: "BUSINESS"}` to the
 * applicant and, worse, would leave a stale `verifiedAt` for a reader that had not yet
 * learned to collapse it. The history is not lost: the episode it came from is in the
 * request rows and the audit log, which is where history belongs.
 *
 * `isVerified` is written explicitly alongside `verificationStatus`, in the same batch, as
 * every verification write must: it is the compatibility projection and the two disagreeing
 * is the bug `admin.verifyBusiness`'s docblock describes.
 */
export async function requestVerification(
	ctx: BusinessContext,
	input: VerificationRequestInput,
): Promise<{ requestId: string; status: VerificationStatus; submittedAt: Date }> {
	const businessId = ctx.membership.businessId;
	const now = new Date();
	const business = await readVerificationColumns(ctx.db, businessId);

	if (
		verificationIsLive(
			{
				status: business.verificationStatus,
				expiresAt: business.verificationExpiresAt,
			},
			now,
		)
	) {
		throw new ConflictError("Tu negocio ya está verificado");
	}

	if (await openRequestOf(ctx.db, businessId)) {
		throw new ConflictError("Ya hay una solicitud en revisión");
	}

	const requestId = newId("businessVerificationRequest");
	const documents =
		input.documents && input.documents.length > 0 ? input.documents : null;

	await ctx.db.batch(
		batchOf([
			ctx.db.insert(requestTable).values({
				id: requestId,
				businessId,
				submittedByUserId: ctx.user.id,
				status: "PENDING",
				legalName: input.legalName ?? null,
				country: input.country ?? null,
				taxId: input.taxId ?? null,
				supportEmail: input.supportEmail ?? null,
				domain: input.domain ? normalizeDomain(input.domain) : null,
				domainEvidenceUrl: input.domainEvidenceUrl ?? null,
				documents,
				createdAt: now,
				updatedAt: now,
			}),
			ctx.db
				.update(businessTable)
				.set({
					isVerified: false,
					verificationStatus: "PENDING",
					verificationLevel: "NONE",
					verifiedAt: null,
					updatedAt: now,
				})
				.where(eq(businessTable.id, businessId)),
			auditStatement(ctx, {
				action: "business.verification_request",
				targetType: "business",
				targetId: businessId,
				before: {
					isVerified: business.isVerified,
					verificationStatus: business.verificationStatus,
				},
				after: {
					isVerified: false,
					verificationStatus: "PENDING",
					requestId,
				},
				// No reason: this is the merchant asking, not the platform deciding. The
				// evidence on the request row is the explanation, and it is a better one.
				reason: null,
				now,
			}),
		]),
	);

	return { requestId, status: "PENDING", submittedAt: now };
}

/**
 * The shop's own view of its verification.
 *
 * ## It reports the *effective* status, and it is the only read that reports the expiry beside it
 *
 * `status` and `verifiedAt` come from `effectiveVerification` — the same projection
 * `identity.profile` uses — so a shop whose approval lapsed reads `NONE` here, exactly as
 * its customers read it. A screen that showed `APPROVED` to the owner and `NONE` to
 * everybody else would be showing the owner a badge they cannot see, which is the one
 * disagreement this whole design exists to prevent.
 *
 * `expiresAt` is the exception: it is the **stored** value, past or future. The public read
 * collapses it away with the rest of a lapsed claim, and that is right for a stranger —
 * "this shop's verification lapsed in March" is not a public fact. For the shop it is the
 * single most useful field on the screen, because it is the difference between "we were
 * never verified" and "we were, and it ran out". So the field is reported as stored and the
 * *status* carries the collapse, which is the one arrangement where both readers get a true
 * sentence.
 *
 * ## The timeline is the request rows, not the audit log
 *
 * The question is "what happened to my application", and the answers are on the request
 * rows: when each was submitted, when it was decided, and what the applicant was told.
 * `reviewNote` is not among them and no field of this shape could carry it — see the file
 * header. The audit log answers "who did it" and is read by the console; a shop asking
 * about its own application is not asking for the reviewer's name, and `reviewedByUserId`
 * is not returned either.
 */
export async function verification(
	ctx: BusinessContext,
): Promise<BusinessVerification> {
	const businessId = ctx.membership.businessId;
	const now = new Date();
	const business = await readVerificationColumns(ctx.db, businessId);

	const rows = await ctx.db
		.select({
			id: requestTable.id,
			status: requestTable.status,
			createdAt: requestTable.createdAt,
			reviewedAt: requestTable.reviewedAt,
			decisionReason: requestTable.decisionReason,
		})
		.from(requestTable)
		.where(eq(requestTable.businessId, businessId))
		// Newest first: the episode being read about is the one that just happened.
		.orderBy(desc(requestTable.createdAt), desc(requestTable.id))
		.limit(TIMELINE_LIMIT);

	const effective = effectiveVerification(
		{
			status: business.verificationStatus,
			level: business.verificationLevel,
			verifiedAt: business.verifiedAt,
			expiresAt: business.verificationExpiresAt,
		},
		now,
	);

	const timeline: VerificationTimelineEntry[] = rows.map((row) => ({
		id: row.id,
		status: row.status,
		submittedAt: row.createdAt,
		reviewedAt: row.reviewedAt,
		decisionReason: row.decisionReason,
	}));

	return {
		status: effective.status,
		verifiedAt: effective.verifiedAt,
		expiresAt: business.verificationExpiresAt,
		openRequestId: timeline.find((entry) => entry.status === "PENDING")?.id ?? null,
		timeline,
	};
}

/**
 * The review queue: every open application, oldest first.
 *
 * Oldest first, unlike almost every other list on the platform, and the reason is the queue
 * it is: a reviewer works from the top, and the application that has been waiting longest is
 * the one whose applicant is most likely to have given up. Newest first would be a queue
 * where a busy week starves whoever arrived first.
 *
 * ## This is the one shape that carries the evidence
 *
 * `legalName`, `country`, `taxId`, `supportEmail`, `domain`, `domainEvidenceUrl` and
 * `documents` are all here, because this is where a human checks them — against a
 * registration document, against a legal name, against a page that proves the domain. It is
 * `adminProcedure`-only and cross-tenant, and the shape is named `adminVerificationQueueRow`
 * rather than sharing a name with anything an applicant or a stranger can reach, so that a
 * careless import cannot put a tax id on a public profile.
 *
 * `reviewNote` is **not** here. A queue row is what a reviewer reads *before* deciding;
 * `reviewNote` is what a previous reviewer wrote *after* deciding, and it belongs on the
 * detail read the console opens next to the decision dialog — not in a page of fifty rows
 * where it would be visible to whoever is scanning for something else to do.
 *
 * The submitter is left-joined and nullable: `submitted_by_user_id` is `on delete set null`,
 * and an application does not stop being reviewable because the manager who filed it left
 * the company. A row with no submitter says so rather than disappearing.
 */
export async function verificationQueue(
	ctx: UserContext,
	input: AdminVerificationQueueInput,
): Promise<{ rows: AdminVerificationQueueRow[]; nextCursor: string | null }> {
	const after = decodeCursor<{ createdAt: number; id: string }>(input.cursor);

	const conditions = [eq(requestTable.status, "PENDING")];
	if (after) {
		// **`gt`, because this list runs oldest first** — the cursor names the last row of the
		// page just served, and "after" it means later than it. Every other keyset list on the
		// platform is descending and compares with `lt`, which is exactly why this one is
		// worth a comment: the copied comparison would look right and page *backwards*, and
		// the symptom is a second page that repeats the first rather than an error.
		conditions.push(
			or(
				gt(requestTable.createdAt, new Date(after.createdAt)),
				and(
					eq(requestTable.createdAt, new Date(after.createdAt)),
					gt(requestTable.id, after.id),
				),
			)!,
		);
	}

	// Ascending, so a reviewer works the back of the queue and the oldest application is the
	// one that cannot be buried by a busy week — see the docblock.
	const rows = await ctx.db
		.select({ request: requestTable, business: businessTable, user: userTable })
		.from(requestTable)
		.innerJoin(businessTable, eq(requestTable.businessId, businessTable.id))
		.leftJoin(userTable, eq(requestTable.submittedByUserId, userTable.id))
		.where(and(...conditions))
		.orderBy(requestTable.createdAt, requestTable.id)
		.limit(input.limit + 1);

	const page = rows.slice(0, input.limit);
	const last = page[page.length - 1];

	return {
		rows: page.map((row) => ({
			requestId: row.request.id,
			businessId: row.business.id,
			businessName: row.business.name,
			businessSlug: row.business.slug,
			submittedAt: row.request.createdAt,
			submittedBy: row.user
				? { id: row.user.id, name: row.user.name, email: row.user.email }
				: null,
			legalName: row.request.legalName,
			country: row.request.country,
			taxId: row.request.taxId,
			supportEmail: row.request.supportEmail,
			domain: row.request.domain,
			domainEvidenceUrl: row.request.domainEvidenceUrl,
			documents: row.request.documents,
		})),
		nextCursor:
			rows.length > input.limit && last
				? encodeCursor({
						createdAt: last.request.createdAt.getTime(),
						id: last.request.id,
					})
				: null,
	};
}

/**
 * Close the application a decision answers, as one statement.
 *
 * ## Why this is shared rather than written four times
 *
 * Four acts end an application — approve, reject, revoke, and a **manual** verification
 * through `admin.verifyBusiness` — and each of them also moves the shop's own columns. The
 * temptation is to treat the request row as bookkeeping that only the queue paths touch, and
 * that is the bug this helper exists to prevent: `verifyBusiness` grants the mark without
 * consulting an application, so before this it left one **open** — the shop read `APPROVED`,
 * the queue still held a row, and `approvalCounts` (which counts the shop's status) disagreed
 * with `verificationQueue` (which pages the request) by exactly one. That is the
 * badge-versus-list disagreement the counts endpoint exists to prevent, arriving through the
 * one path that did not think of itself as a queue decision.
 *
 * The rule is therefore stated once and applied by every path: **a shop's
 * `verification_status` and the open application for it move together, or neither moves.**
 *
 * ## `requestId` is optional because two callers address the row differently
 *
 * The queue paths have already read the application they are deciding and address it by id,
 * which is also how they write a reviewer's `reviewNote` to *that* row and no other. The
 * manual path has read nothing, and addresses whatever is open for the shop — a `where` that
 * matches zero rows when there is no application, which is exactly the intended no-op.
 *
 * Both restate `status = 'PENDING'` in the `where`, so a decision cannot land on a row
 * another reviewer has already decided — the same conditional-update discipline
 * `services/affiliations.ts` applies to memberships, for the same reason: D1 offers no
 * transaction to open around the read.
 */
export function decideRequestStatement(
	ctx: UserContext,
	input: {
		businessId: string;
		/** The application the caller read, when it read one. */
		requestId?: string;
		status: Extract<VerificationStatus, "APPROVED" | "REJECTED" | "REVOKED">;
		reviewNote?: string | null;
		decisionReason?: string | null;
		now: Date;
	},
): BatchItem<"sqlite"> {
	return ctx.db
		.update(requestTable)
		.set({
			status: input.status,
			reviewedByUserId: ctx.user.id,
			reviewedAt: input.now,
			reviewNote: input.reviewNote ?? null,
			decisionReason: input.decisionReason ?? null,
			updatedAt: input.now,
		})
		.where(
			and(
				eq(requestTable.businessId, input.businessId),
				input.requestId === undefined
					? eq(requestTable.status, "PENDING")
					: and(
							eq(requestTable.id, input.requestId),
							eq(requestTable.status, "PENDING"),
						)!,
			),
		);
}

/**
 * An operator approves an application. The queue's "yes".
 *
 * ## It requires an open application, which is what separates it from `admin.verifyBusiness`
 *
 * Both grant the same mark and both write the same five columns — that write is deliberately
 * not duplicated, see below. What differs is the precondition: `verifyBusiness` is the
 * **manual** path an operator uses to correct a record or verify a shop off their own bat,
 * and it needs no application because there may not be one. This is the **queue** path, and
 * a queue decision about an application that does not exist is a decision about nothing —
 * so an absent or already-decided application is `NOT_FOUND`, which is also what stops two
 * reviewers approving the same row twice from a stale page.
 *
 * ## The write is shared with `verifyBusiness`, and that is the point
 *
 * `admin.verifyBusiness`'s docblock used to say it was "the one place `isVerified` is
 * written" and to instruct any other path that granted a verification to copy it. Phase 2
 * added exactly such a path, at which point "copy these five columns correctly" stopped being
 * an instruction and became `grantVerificationStatements` — one function, two callers, and
 * `decideRequestStatement` for the application half. The alternative, a second hand-written
 * update, is exactly how one of the two paths ends up forgetting `verificationLevel`.
 *
 * A `PENDING` application is closed by the grant **even when the queue was not the caller**:
 * see `decideRequestStatement` for the disagreement that made that necessary.
 */
export async function approveBusinessVerification(
	ctx: UserContext,
	input: AdminVerificationDecisionInput,
): Promise<{ businessId: string; requestId: string; status: VerificationStatus }> {
	const current = await readVerificationColumns(ctx.db, input.targetId);
	const open = await openRequestOf(ctx.db, input.targetId);
	const request = orNotFound(open);

	const now = new Date();

	await ctx.db.batch(
		batchOf(
			grantVerificationStatements(ctx, {
				businessId: input.targetId,
				// The application this decision answers, so the grant closes *that* row and
				// carries the reviewer's words onto it.
				requestId: request.id,
				reviewNote: input.reviewNote ?? null,
				decisionReason: input.decisionReason ?? null,
				before: {
					isVerified: current.isVerified,
					verificationStatus: current.verificationStatus,
				},
				reason: input.reason ?? null,
				now,
			}),
		),
	);

	return {
		businessId: input.targetId,
		requestId: request.id,
		status: "APPROVED",
	};
}

/**
 * Everything an approval writes: the application it answers, the shop's own five columns, and
 * the audit row that says who did it.
 *
 * ## Three statements, because an approval has three consequences
 *
 * 1. **The application is closed.** `decideRequestStatement`, addressed by id when the caller
 *    read one and by the shop when it did not — see that helper for the badge-versus-queue
 *    disagreement that makes this half mandatory rather than tidy. `admin.verifyBusiness` is
 *    the caller that read nothing: it grants the mark without consulting an application, and
 *    before Phase 2 it left one open.
 * 2. **The shop's columns move**, including `isVerified`, the compatibility projection.
 * 3. **The audit row is written**, with both spellings of the verification state.
 *
 * All three ride in one `db.batch` at the call site, which is the only atomicity D1 offers
 * from here: two of them run separately is a shop verified in one column and unverified in
 * the other, or a badge with no record of who granted it.
 *
 * ## Why it lives here rather than in `admin.ts`
 *
 * Extracted from `admin.verifyBusiness` so the manual path and the queue path cannot drift,
 * and it lives in this file so the dependency runs one way: `business-verification.ts` already
 * imports `identity.ts` for the projection, and `admin.ts` is the larger, more connected
 * module. Putting it in `admin.ts` would make the admin service a dependency of the
 * merchant-facing one, while `admin.ts` importing this file is the direction that already
 * exists (`admin.ts` imports `subscription.ts` for the same reason).
 *
 * ## `verification_expires_at` is cleared, and that is a fix rather than a detail
 *
 * The manual path grants an open-ended approval, and before Phase 2 it left a stored expiry
 * untouched — so an operator verifying a shop whose previous review had lapsed wrote
 * `APPROVED` beside a date in the past, `isVerified` said `true`, and `deriveDisplay` refused
 * the badge. The column said verified and the badge said otherwise. Clearing it is what makes
 * a re-approval actually take effect, and it is the same reasoning `requestVerification`
 * applies when it clears the stale `verifiedAt`.
 */
export function grantVerificationStatements(
	ctx: UserContext,
	input: {
		businessId: string;
		/** The application the caller read, when it read one. See `decideRequestStatement`. */
		requestId?: string;
		reviewNote?: string | null;
		decisionReason?: string | null;
		before: { isVerified: boolean; verificationStatus: VerificationStatus };
		reason: string | null;
		now: Date;
	},
): BatchItem<"sqlite">[] {
	return [
		decideRequestStatement(ctx, {
			businessId: input.businessId,
			requestId: input.requestId,
			status: "APPROVED",
			reviewNote: input.reviewNote ?? null,
			decisionReason: input.decisionReason ?? null,
			now: input.now,
		}),
		ctx.db
			.update(businessTable)
			.set({
				isVerified: true,
				verificationStatus: "APPROVED",
				verificationLevel: "BUSINESS",
				verifiedAt: input.now,
				verificationExpiresAt: null,
				updatedAt: input.now,
			})
			.where(eq(businessTable.id, input.businessId)),
		auditStatement(ctx, {
			// Reused from the manual path on purpose: the consequence is identical, it is
			// one outcome, and two action names for one outcome is how a report counts half
			// of it. The `after` payload names the request, which is what tells a reader
			// that this one came through the queue.
			action: "business.verify",
			targetType: "business",
			targetId: input.businessId,
			before: input.before,
			after: {
				isVerified: true,
				verificationStatus: "APPROVED",
				verificationLevel: "BUSINESS",
			},
			reason: input.reason,
			now: input.now,
		}),
	];
}

/**
 * An operator refuses an application. **A reason is required.**
 *
 * `business.verification_reject` is in `REASON_REQUIRED_ACTIONS` and the gate is
 * `requireReason`, which both refuses an empty reason and returns the trimmed one — so the
 * audit row and the applicant's `decisionReason` cannot end up carrying different text, and
 * neither can be missing.
 *
 * ## Rejection is not a dead end, and the three writes say so
 *
 * The request becomes `REJECTED` with the decision recorded. The **business** becomes
 * `REJECTED` too, rather than falling back to `NONE`, because the two are different
 * sentences to a merchant: `NONE` is "you never applied", `REJECTED` is "you applied and we
 * said no" — and the second one is the one that explains why the Apply button is not the
 * whole story. `isVerified` is written `false` in the same batch, `verificationLevel` goes
 * to `NONE` and `verifiedAt` is cleared, for `requestVerification`'s reason: those three
 * describe an approval and this shop does not have one.
 *
 * The shop **may apply again**, immediately. That is deliberate and it is the whole reason
 * the evidence lives on the request row rather than on the business: a rejection is a
 * statement about one application, not a ban. The partial unique index only refuses a
 * second *open* application, so the retry is one call away.
 *
 * `reviewNote` is stored and returned to nobody. It is a reviewer's note to a colleague —
 * "the tax id does not match the legal name, asked for the registration page" — and the
 * applicant is told `decisionReason` instead, which defaults to nothing rather than to the
 * internal note. Defaulting one to the other would be the leak this shape exists to prevent,
 * and it would happen on the first rejection where a reviewer wrote a note and no reason.
 */
export async function rejectBusinessVerification(
	ctx: UserContext,
	input: AdminVerificationDecisionInput,
): Promise<{ businessId: string; requestId: string; status: VerificationStatus }> {
	const current = await readVerificationColumns(ctx.db, input.targetId);
	const open = await openRequestOf(ctx.db, input.targetId);
	const request = orNotFound(open);

	const now = new Date();
	const reason = requireReason("business.verification_reject", input.reason);

	await ctx.db.batch(
		batchOf([
			decideRequestStatement(ctx, {
				businessId: input.targetId,
				requestId: request.id,
				status: "REJECTED",
				reviewNote: input.reviewNote ?? null,
				// Defaults to the audited reason rather than to nothing, because the two
				// fields are for two audiences and the applicant is owed an answer: a
				// reviewer who wrote a justification for the platform has said something a
				// merchant can read, and a rejection that told them nothing would be a
				// refusal with no next step.
				decisionReason: input.decisionReason ?? reason,
				now,
			}),
			ctx.db
				.update(businessTable)
				.set({
					isVerified: false,
					verificationStatus: "REJECTED",
					verificationLevel: "NONE",
					verifiedAt: null,
					updatedAt: now,
				})
				.where(eq(businessTable.id, input.targetId)),
			auditStatement(ctx, {
				action: "business.verification_reject",
				targetType: "business",
				targetId: input.targetId,
				before: {
					isVerified: current.isVerified,
					verificationStatus: current.verificationStatus,
				},
				after: { isVerified: false, verificationStatus: "REJECTED", requestId: request.id },
				reason,
				now,
			}),
		]),
	);

	return {
		businessId: input.targetId,
		requestId: request.id,
		status: "REJECTED",
	};
}

/**
 * An operator takes a verification back. **A reason is required.**
 *
 * ## The difference from a rejection, and why both exist
 *
 * A rejection answers an application: the shop asked, and the answer was no. A revocation
 * ends an approval that is already in force — the shop is verified *right now*, its profile
 * is drawing the badge, and the platform has learned something that makes the claim false
 * (the registration lapsed, the tax id turned out to belong to another company, the domain
 * was sold). The two have different preconditions — one needs an open application, the other
 * needs an approval — and a merchant reading `REJECTED` where `REVOKED` is true would be told
 * the wrong story about their own account.
 *
 * It therefore does **not** require an open application, and it refuses when the stored
 * status is not `APPROVED`: revoking a claim that does not exist is not a decision, and
 * answering `{ ok: true }` for it would make "did the badge actually come down" unanswerable.
 *
 * A **lapsed** approval can still be revoked, and that is not pedantry: the stored status is
 * `APPROVED`, the record says the shop was verified, and an operator withdrawing that record
 * is a real act with a real reason. What it changes is the stored status, which is what every
 * read collapses from.
 *
 * ## Revocation clears the badge and keeps the team
 *
 * The badge comes down **at read time**, for the shop and for every profile affiliated with
 * it, because `deriveDisplay` asks `verificationIsLive` about the business's stored status
 * on every read. Nothing has to be written for that to happen, which is why this function
 * touches one `membership` row: none.
 *
 * **Memberships are deliberately not revoked.** The temptation is to read "revocation
 * deactivates active memberships" as this function's job, and doing it would be a serious
 * product error: revoking a shop's *verification* would lock its staff out of their own
 * dashboard, and — because a shop's owner is a member too — it would create exactly the
 * ownerless business `assertNotLastOwner` exists to prevent, with no way back from the UI.
 * A mark is a claim about a shop; a membership is a job. The procedure that ends a
 * membership is `business.revokeAffiliation`, and the two are separate on purpose.
 *
 * An open application, if one exists, is moved to `REVOKED` in the same batch. That state is
 * reachable when a shop was verified manually while an application was open: without this,
 * the queue would hold a row nobody can ever decide, because `approve` would find the
 * business already approved and `reject` would find a decision already made.
 */
export async function revokeBusinessVerification(
	ctx: UserContext,
	input: AdminVerificationDecisionInput,
): Promise<{ businessId: string; status: VerificationStatus }> {
	const current = await readVerificationColumns(ctx.db, input.targetId);
	if (current.verificationStatus !== "APPROVED") {
		throw new ConflictError("Este negocio no tiene una verificación que revocar");
	}

	const now = new Date();
	const reason = requireReason("business.verification_revoke", input.reason);
	const open = await openRequestOf(ctx.db, input.targetId);

	const statements: BatchItem<"sqlite">[] = [
		ctx.db
			.update(businessTable)
			.set({
				isVerified: false,
				verificationStatus: "REVOKED",
				verificationLevel: "NONE",
				verifiedAt: null,
				// The expiry goes with the claim. Leaving a future `verification_expires_at`
				// on a `REVOKED` row would be a date that describes nothing — and if the
				// shop were later re-approved through `verifyBusiness`, the stale date would
				// silently start mattering again.
				verificationExpiresAt: null,
				updatedAt: now,
			})
			.where(eq(businessTable.id, input.targetId)),
	];

	if (open) {
		statements.push(
			decideRequestStatement(ctx, {
				businessId: input.targetId,
				requestId: open.id,
				status: "REVOKED",
				reviewNote: input.reviewNote ?? null,
				decisionReason: input.decisionReason ?? reason,
				now,
			}),
		);
	}

	statements.push(
		auditStatement(ctx, {
			action: "business.verification_revoke",
			targetType: "business",
			targetId: input.targetId,
			before: {
				isVerified: current.isVerified,
				verificationStatus: current.verificationStatus,
			},
			after: {
				isVerified: false,
				verificationStatus: "REVOKED",
				requestId: open?.id ?? null,
			},
			reason,
			now,
		}),
	);

	await ctx.db.batch(batchOf(statements));

	return { businessId: input.targetId, status: "REVOKED" };
}
