import {
	business as businessTable,
	type Db,
	membership as membershipTable,
} from "@pymeshub/db";
import type {
	IdentityDisplay,
	MyAffiliation,
	MyIdentity,
	ProfileIdentity,
	VerificationLevel,
	VerificationStatus,
} from "@pymeshub/shared";
import { and, eq } from "drizzle-orm";

import { pendingInvitations } from "./businesses";
import type { UserContext } from "./helpers";
import { isPublicBusiness, orNotFound, publicBusiness } from "./helpers";

/**
 * Who somebody is, as a badge draws them.
 *
 * **Read-only, and deliberately so.** Nothing in this file writes a column, and
 * nothing caches a result. The two rules that matter — "a revoked business stops
 * being verified" and "a lapsed review stops being verified" — are guarantees
 * about *the reader's clock* rather than about the database, and the only way to
 * keep that promise without a cron, an invalidation or a deploy is to evaluate
 * them every time a profile is read. Expiry is a comparison, not a job.
 *
 * The file splits in three:
 *
 * - `deriveDisplay` — the entire rule set, pure. Every branch a badge can take is
 *   reachable from a unit test with no database and no router, which is what
 *   makes the state matrix in `test/identity.test.ts` a table rather than a
 *   fixture farm.
 * - `resolveBusinessIdentity` — the same rules, applied to a row somebody already
 *   read. Pure for the same reason.
 * - `resolveProfileIdentity` — the one function that touches the database, and it
 *   reads at most one membership and one business.
 *
 * ## Why the scope is a parameter and not a column
 *
 * A person may work at several shops, and which one the badge names is **the
 * shop they have selected in the switcher** — client state, not something the
 * server stores. `activeAffiliationId` on `user` was the obvious alternative and
 * is worse in both directions: it is a write on every switch, and it makes the
 * badge say "the shop you last switched to" on a screen where the switcher is
 * showing something else. Passing `scopeBusinessId` makes the caller state which
 * context it is drawing, and the answer cannot go stale.
 *
 * **The scope is not trusted.** It is honoured only when it names an `ACTIVE`
 * membership owned by the subject, and that condition is inside the `where`
 * clause rather than a check after the read — per the house rule in `helpers.ts`,
 * a row that is loaded and then judged is the bug the design exists to prevent.
 * A `PENDING_USER_ACCEPTANCE` or `REVOKED` membership passed as scope yields
 * `NONE`, not an affiliation with a status attached.
 */

/** The facts a display decision is made from. Never read from the database here. */
export type ProfileSubject = {
	kind: "person" | "business";
	verification: {
		status: VerificationStatus;
		level: VerificationLevel;
		expiresAt: Date | null;
	};
	/**
	 * The business's own `status` — `DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED`.
	 *
	 * Present only for a business subject, and consulted through
	 * `isPublicBusiness()` rather than re-derived: a suspended shop is not a
	 * public identity, which is the same rule `catalog.ts` and `businesses.ts`
	 * apply to every other public read.
	 */
	status?: string;
};

/** The one affiliation a scoped read is allowed to consider. */
export type ScopedAffiliation = {
	membershipStatus: string;
	businessId: string;
	businessStatus: string;
	businessVerificationStatus: VerificationStatus;
	businessVerificationExpiresAt: Date | null;
};

/**
 * Whether a verification claim is live at `now`.
 *
 * A null `expiresAt` means "does not lapse", which is where every approval
 * starts. Liveness is `expiresAt > now`, so a verification whose expiry is
 * exactly this millisecond is **already expired** — the alternative is a window
 * of one millisecond in which two readers can disagree about the same row, and
 * the tie goes to the reading that grants nothing.
 *
 * **Exported** because the shop's own read of its verification
 * (`services/business-verification.ts`) has to reach the same answer as the public
 * one, and a second copy of this comparison is how a shop shows itself a badge that
 * its customers cannot see. There is one place that decides whether a claim is live
 * and this is it.
 */
export function verificationIsLive(
	verification: { status: VerificationStatus; expiresAt: Date | null },
	now: Date,
): boolean {
	if (verification.status !== "APPROVED") return false;
	if (verification.expiresAt === null) return true;
	return verification.expiresAt.getTime() > now.getTime();
}

/**
 * The rule set, and the only place a badge is decided.
 *
 * Three conditions, and the shape of each is the point:
 *
 * 1. **`roundedSquare` and `verifiedBusiness` are the same predicate.** Not two
 *    predicates that agree today — literally one boolean, read twice. There is no
 *    state in which the shape says "business" while the badge says "unverified",
 *    which is the drift a stored `avatarShape` column would have produced the
 *    first time a review lapsed.
 * 2. **A person's avatar is always `circle`.** A verified *business* gets the
 *    rounded square; a person who works at one does not, because the mark is a
 *    claim about the account and not about its employer.
 * 3. **The affiliation badge needs four things at once** — an `ACTIVE`
 *    membership, a business that is publicly visible, a business whose own
 *    verification is live, and (when a scope is supplied) that business being the
 *    one in scope. Dropping any one of them is how a former employee keeps a
 *    badge, or a suspended shop keeps one on behalf of everybody who worked
 *    there.
 *
 * The scope is a **filter, not a key**: omitting it means "the affiliation in hand
 * needs no further narrowing", not "grant the badge". A caller with no affiliation
 * to hand over passes `affiliation: null` and gets `false` either way — which is
 * what `resolveProfileIdentity` does whenever no shop is selected, so the product
 * never reaches the permissive reading.
 */
export function deriveDisplay(
	input: {
		subject: ProfileSubject;
		affiliation: ScopedAffiliation | null;
		scopeBusinessId?: string;
	},
	now: Date,
): IdentityDisplay {
	const { subject, affiliation, scopeBusinessId } = input;

	const subjectVerified =
		subject.kind === "business" &&
		isPublicBusiness(subject.status ?? "") &&
		verificationIsLive(subject.verification, now);

	const affiliationBadge =
		affiliation !== null &&
		affiliation.membershipStatus === "ACTIVE" &&
		isPublicBusiness(affiliation.businessStatus) &&
		verificationIsLive(
			{
				status: affiliation.businessVerificationStatus,
				expiresAt: affiliation.businessVerificationExpiresAt,
			},
			now,
		) &&
		(scopeBusinessId === undefined ||
			affiliation.businessId === scopeBusinessId);

	return {
		avatarShape: subjectVerified ? "roundedSquare" : "circle",
		profileBadge: subjectVerified ? "verifiedBusiness" : "none",
		affiliationBadge,
	};
}

/**
 * The verification as this read is allowed to report it.
 *
 * Expiry is applied **here, once**, rather than inside the badge predicate, for
 * the same reason the shape and the badge share a boolean: any field in this
 * response that disagrees with `display` is a client drawing a badge the server
 * says is not there. So an expired approval reads as `NONE`, `NONE`, `null` — the
 * same as a business nobody has ever reviewed.
 *
 * What is *not* lost is the record: `business.verification_status` keeps saying
 * `APPROVED` with a past `verification_expires_at`, and the owner's and the
 * admin's reads of it (`business.verification`, `admin.verificationQueue`) report
 * the history. This projection is the public claim, and a public claim about the
 * present cannot include a lapsed review.
 *
 * A stored status that is neither `APPROVED` nor expired is reported as stored —
 * `PENDING` and `REJECTED` are answers, and flattening them to `NONE` would make
 * "you are under review" indistinguishable from "you never applied".
 *
 * ## `verifiedAt` is reported only beside a live `APPROVED`, and Phase 2 tightened this
 *
 * `verifiedAt` answers "when was this account verified", so it is only a true
 * sentence while the account *is* verified. Phase 1 could afford to pass it
 * through for every status because the only writer of `verification_status` was
 * `admin.verifyBusiness`, which always wrote `APPROVED` and the date together —
 * so no other status could carry one. Phase 2 adds the writers that can: a
 * `REJECTED` or `REVOKED` row is now reachable, and a shop that was once approved
 * and has since had the mark taken away would report the old approval date beside
 * a status that says it is gone. A client rendering "verificado el 3 de marzo"
 * next to `REJECTED` is reading a claim that stopped being true.
 *
 * So the date travels with the status, exactly as it does in the expiry collapse
 * above. The history is not destroyed — `business_verification_request` and
 * `audit_log` both hold it, and `business.verified_at` keeps the stored date for
 * whoever needs to know when the shop was last approved.
 *
 * **Exported** for `services/business-verification.ts`, which reports the same
 * projection to the shop itself. Two projections of one row is how a shop shows
 * itself a badge its customers cannot see.
 */
export function effectiveVerification(
	verification: {
		status: VerificationStatus;
		level: VerificationLevel;
		verifiedAt: Date | null;
		expiresAt: Date | null;
	},
	now: Date,
): ProfileIdentity["verification"] {
	if (!verificationIsLive(verification, now)) {
		// Two ways to land here, and both report the floor: a lapsed `APPROVED` is
		// the same claim as never having been approved, and every other status is
		// reported as itself but without a date that belongs to an approval.
		return {
			status: verification.status === "APPROVED" ? "NONE" : verification.status,
			level: verification.status === "APPROVED" ? "NONE" : verification.level,
			verifiedAt: null,
		};
	}
	return {
		status: verification.status,
		level: verification.level,
		verifiedAt: verification.verifiedAt,
	};
}

/** The affiliation a profile reports when there is none. Not a shared constant — it is cheap. */
function noAffiliation(): ProfileIdentity["affiliation"] {
	return { status: "NONE", business: null };
}

/**
 * The identity of one shop, from a row that has already been read.
 *
 * Pure, so a spec can put a business in any state without inserting it. The
 * affiliation is always `NONE`: a business is not affiliated with a business,
 * and a shop's badge says what the platform verified about *it*.
 */
export function resolveBusinessIdentity(
	business: {
		id: string;
		slug: string;
		name: string;
		logoUrl: string | null;
		status: string;
		verificationStatus: VerificationStatus;
		verificationLevel: VerificationLevel;
		verifiedAt: Date | null;
		verificationExpiresAt: Date | null;
	},
	now: Date,
): ProfileIdentity {
	const verification = effectiveVerification(
		{
			status: business.verificationStatus,
			level: business.verificationLevel,
			verifiedAt: business.verifiedAt,
			expiresAt: business.verificationExpiresAt,
		},
		now,
	);

	return {
		accountType: "BUSINESS",
		verification,
		affiliation: noAffiliation(),
		display: deriveDisplay(
			{
				subject: {
					kind: "business",
					verification: {
						status: business.verificationStatus,
						level: business.verificationLevel,
						expiresAt: business.verificationExpiresAt,
					},
					status: business.status,
				},
				affiliation: null,
			},
			now,
		),
	};
}

/** Which profile is being resolved. Two shapes, because a person and a shop are two kinds of account. */
export type IdentitySubject =
	| { kind: "person"; userId: string }
	| { kind: "business"; businessId: string };

/**
 * The identity of one person or one shop, at this instant.
 *
 * One or two reads, never more: a business is a single row, and a person is a
 * single scoped join. There is no cache, and adding one would need the expiry
 * rule re-implemented as an invalidation — which is the thing this design
 * removed.
 *
 * `now` is a parameter with a default rather than a call to `new Date()` inside,
 * so a spec can assert that an expiry is *approaching* as well as past. The
 * default is what makes it invisible to every production caller.
 */
export async function resolveProfileIdentity(
	db: Db,
	subject: IdentitySubject,
	options: { scopeBusinessId?: string } = {},
	now: Date = new Date(),
): Promise<ProfileIdentity> {
	if (subject.kind === "business") {
		const rows = await db
			.select({
				id: businessTable.id,
				slug: businessTable.slug,
				name: businessTable.name,
				logoUrl: businessTable.logoUrl,
				status: businessTable.status,
				verificationStatus: businessTable.verificationStatus,
				verificationLevel: businessTable.verificationLevel,
				verifiedAt: businessTable.verifiedAt,
				verificationExpiresAt: businessTable.verificationExpiresAt,
			})
			.from(businessTable)
			.where(eq(businessTable.id, subject.businessId))
			.limit(1);

		return resolveBusinessIdentity(
			orNotFound(rows[0]),
			now,
		);
	}

	const { scopeBusinessId } = options;

	// No scope is not the same as a scope that matches nothing: without one there
	// is no question to ask, so no read is spent. `identity.mine()` with no
	// selected shop is the common case for a customer who has no memberships at
	// all.
	const scoped = scopeBusinessId
		? await db
				.select({
					membershipStatus: membershipTable.status,
					businessId: membershipTable.businessId,
					businessSlug: businessTable.slug,
					businessName: businessTable.name,
					businessLogoUrl: businessTable.logoUrl,
					businessStatus: businessTable.status,
					businessVerificationStatus: businessTable.verificationStatus,
					businessVerificationLevel: businessTable.verificationLevel,
					businessVerificationExpiresAt:
						businessTable.verificationExpiresAt,
				})
				.from(membershipTable)
				.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
				.where(
					and(
						eq(membershipTable.userId, subject.userId),
						eq(membershipTable.businessId, scopeBusinessId),
						// The authorization boundary, inside the `where`. A pending
						// invitation is not a membership *here*, so a caller cannot turn
						// one into an affiliation by naming it — the row is never read
						// and there is nothing to check afterwards.
						eq(membershipTable.status, "ACTIVE"),
					),
				)
				.limit(1)
		: [];

	const affiliationRow = scoped[0];

	/**
	 * Only an `ACTIVE` row reaches this point, so the reported status is always
	 * `ACTIVE` — and the wider `ProfileAffiliationStatus` union exists anyway, so
	 * that it is the *stored* alphabet and a reader never has to translate. If a
	 * later rule wants to report a pending invitation on a profile, the value
	 * already exists; today it would put an invitation where a claim belongs,
	 * which is why the scope rule refuses it.
	 */
	const affiliation: ProfileIdentity["affiliation"] = affiliationRow
		? {
				status: "ACTIVE",
				business: {
					id: affiliationRow.businessId,
					slug: affiliationRow.businessSlug,
					name: affiliationRow.businessName,
					logoUrl: affiliationRow.businessLogoUrl,
					verificationLevel: affiliationRow.businessVerificationLevel,
				},
			}
		: noAffiliation();

	return {
		accountType: "INDIVIDUAL",
		// A person is never themselves verified. The union has one real level and
		// it belongs to businesses; an account with no business behind it reports
		// the floor rather than borrowing its employer's mark.
		verification: { status: "NONE", level: "NONE", verifiedAt: null },
		affiliation,
		display: deriveDisplay(
			{
				subject: {
					kind: "person",
					verification: { status: "NONE", level: "NONE", expiresAt: null },
				},
				affiliation: affiliationRow
					? {
							membershipStatus: affiliationRow.membershipStatus,
							businessId: affiliationRow.businessId,
							businessStatus: affiliationRow.businessStatus,
							businessVerificationStatus:
								affiliationRow.businessVerificationStatus,
							businessVerificationExpiresAt:
								affiliationRow.businessVerificationExpiresAt,
						}
					: null,
				scopeBusinessId,
			},
			now,
		),
	};
}

/**
 * A public profile, by the handle a URL carries.
 *
 * `identity.profile({ slug })` is the only procedure on the platform that answers
 * "who is this" for a caller with no session, so the two things it must get right
 * are **who may be looked up** and **what comes back**.
 *
 * The first is the `where`: `publicBusiness()` is the same predicate every other
 * public read applies, and a `DRAFT` or `SUSPENDED` shop answers `NOT_FOUND`
 * exactly as a slug nobody registered does. That is deliberate rather than
 * convenient — a 404 that distinguished "suspended" from "no such shop" would make
 * this endpoint a way to enumerate shops the platform has taken down, and the
 * marketplace already hides those from the catalog for the same reason.
 *
 * The second is `resolveBusinessIdentity`, unchanged: a business subject, no
 * affiliation, and the verification collapsed through `effectiveVerification`. So
 * this function adds a lookup and nothing else, which is the point — every rule
 * about what a badge may say is in one place, and a new caller cannot loosen one by
 * forgetting to apply it.
 *
 * ## Why there is no `affiliation` on the response, and no parameter that could add one
 *
 * A person's profile carries an affiliation because the affiliation is a claim
 * about *them*: they work at a verified shop. A shop's profile carrying one would
 * be a claim about the shop's owner, and nothing in the product asks that question
 * — a customer looking at Café Central wants to know whether Café Central is
 * verified, not whether the person who runs it also works somewhere else. If a
 * public affiliation rule is ever defined, it belongs in `deriveDisplay` as a
 * subject kind of its own, not as a parameter on this read.
 */
export async function resolveProfileBySlug(
	db: Db,
	slug: string,
	now: Date = new Date(),
): Promise<ProfileIdentity> {
	const rows = await db
		.select({
			id: businessTable.id,
			slug: businessTable.slug,
			name: businessTable.name,
			logoUrl: businessTable.logoUrl,
			status: businessTable.status,
			verificationStatus: businessTable.verificationStatus,
			verificationLevel: businessTable.verificationLevel,
			verifiedAt: businessTable.verifiedAt,
			verificationExpiresAt: businessTable.verificationExpiresAt,
		})
		.from(businessTable)
		.where(and(eq(businessTable.slug, slug), publicBusiness()))
		.limit(1);

	return resolveBusinessIdentity(orNotFound(rows[0]), now);
}

/**
 * Who the caller is, the shops they may act for, and what is waiting for them.
 *
 * One procedure for one screen, because a client that had to make three calls to
 * draw "your profile" would eventually make two and draw a stale third. The three
 * reads it performs are the three questions that screen asks:
 *
 * 1. **`resolveProfileIdentity`** — the same function `identity.profile` uses, so
 *    the caller's own profile and the profile a stranger sees cannot disagree. The
 *    scope is passed through untouched, which means the one rule that matters is
 *    enforced in one place: naming a shop the caller has no `ACTIVE` membership in
 *    yields no affiliation, not an affiliation with a status attached.
 * 2. **The affiliations list** — the caller's `ACTIVE` memberships, with the badge
 *    each one would grant. Read here rather than through `business.myBusinesses`
 *    because the question is different: that one answers "which shops may I use"
 *    for the switcher, and this one answers "which of them draw a badge" for the
 *    profile. They are the same rows today and would not be the moment a shop can
 *    be usable while unverified — which is every shop on the platform.
 * 3. **The pending invitations** — `businesses.pendingInvitations`, called rather
 *    than copied. It is the same list `business.pendingInvitations` returns, from
 *    the same function, because two shapes for one inbox is how a client ends up
 *    drawing it twice and disagreeing with itself.
 *
 * ## The per-row badge, and why the scope is deliberately *not* passed to it
 *
 * `deriveDisplay` treats `scopeBusinessId` as a filter: supplying one narrows the
 * badge to a single affiliation, which is what the *profile* needs (one person,
 * one badge, the shop they have selected). The list below asks a different
 * question — "does this affiliation qualify" — and each row is its own answer, so
 * the filter would be wrong: passing the scope would mark one row `true` and every
 * other `false` regardless of merit, which is exactly the switcher's rendering
 * bug this list exists to prevent.
 *
 * That is not the permissive reading the header warns about. There, the danger was
 * a profile granting a badge to whichever affiliation came back first; here there
 * is no "first" — every row is named, `ACTIVE` by construction, and judged on its
 * own business's stored verification and public status.
 */
export async function myIdentity(
	ctx: UserContext,
	options: { scopeBusinessId?: string } = {},
	now: Date = new Date(),
): Promise<MyIdentity> {
	const identity = await resolveProfileIdentity(
		ctx.db,
		{ kind: "person", userId: ctx.user.id },
		options,
		now,
	);

	const rows = await ctx.db
		.select({
			businessId: membershipTable.businessId,
			businessSlug: businessTable.slug,
			businessName: businessTable.name,
			businessLogoUrl: businessTable.logoUrl,
			role: membershipTable.role,
			businessStatus: businessTable.status,
			businessVerificationStatus: businessTable.verificationStatus,
			businessVerificationExpiresAt: businessTable.verificationExpiresAt,
		})
		.from(membershipTable)
		.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
		.where(
			and(
				eq(membershipTable.userId, ctx.user.id),
				eq(membershipTable.status, "ACTIVE"),
			),
		);

	const affiliations: MyAffiliation[] = rows
		// Sorted here rather than in SQL for `myBusinesses`' reason: a switcher lists
		// three rows, and SQLite's collation on the name is not the clients'.
		.sort((a, b) => a.businessName.localeCompare(b.businessName))
		.map((row) => ({
			businessId: row.businessId,
			businessSlug: row.businessSlug,
			businessName: row.businessName,
			businessLogoUrl: row.businessLogoUrl,
			role: row.role,
			affiliationBadge: deriveDisplay(
				{
					subject: {
						kind: "person",
						verification: { status: "NONE", level: "NONE", expiresAt: null },
					},
					affiliation: {
						membershipStatus: "ACTIVE",
						businessId: row.businessId,
						businessStatus: row.businessStatus,
						businessVerificationStatus: row.businessVerificationStatus,
						businessVerificationExpiresAt: row.businessVerificationExpiresAt,
					},
					// No scope, on purpose. See the docblock.
				},
				now,
			).affiliationBadge,
		}));

	return {
		identity,
		affiliations,
		pendingInvitations: await pendingInvitations(ctx),
	};
}
