import {
	business as businessTable,
	type Db,
	membership as membershipTable,
	notification as notificationTable,
	user as userTable,
} from "@pymeshub/db";
import {
	AFFILIATION_INVITE_TTL_DAYS,
	type AffiliationInvitation,
	type AffiliationRow,
	type AffiliationStatus,
	decodeCursor,
	encodeCursor,
	type InvitationPreview,
	type MembershipRole,
	newId,
} from "@pymeshub/shared";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { loadBilling } from "../context";
import { auditStatement, requireReason } from "./audit";
import { assertNotLastOwner } from "./businesses";
import type { BillingPlan, BusinessContext, UserContext } from "./helpers";
import { assertRole, batchOf, orNotFound } from "./helpers";
import { hashInviteToken, mintInviteToken, newInvitationId } from "./invite-token";
import { checkCount } from "./plan-limits";

/**
 * Who works at a shop: asking somebody to join, and everything that follows.
 *
 * ## What an invitation *is*, and why it is a `membership` row
 *
 * The obvious model is an `invitation` table addressed to an email, with the membership
 * written when it is accepted. This is not that, and the difference is the whole design:
 * an invitation here is a `membership` row in `PENDING_USER_ACCEPTANCE`, addressed to a
 * **user id**, with a token that resolves the emailed link.
 *
 * That is not a shortcut. `membership` carries a unique index on `(business_id, user_id)`
 * — one relationship per pair, which is what stops a shop's team list from containing the
 * same person twice — and a parallel table would have to reproduce that constraint across
 * two tables, where SQLite cannot enforce it. It would also mean every read that asks
 * "does this person work here" has to consult both, and the one that forgets is the bug.
 *
 * The cost is that the invitee must already have an account, which is where the product
 * already was: `business.inviteStaff` has always taken an email and answered "esa persona
 * todavía no tiene cuenta en PymesHub" for one it cannot find. An address with no account
 * is a sign-up, and a sign-up is a different flow with its own verification.
 *
 * ## What a pending row may not do
 *
 * Nothing. `PENDING_USER_ACCEPTANCE` confers no capability, appears in no switcher,
 * counts against no plan's seat cap, draws no badge, and cannot be used as a
 * `scopeBusinessId` — each of those is enforced at its own read, and `context.ts`'s
 * `loadMemberships` is the one that covers them all transitively. This file's job is to
 * move rows between states without ever widening that.
 *
 * ## The lifecycle, and the one place it is decided
 *
 * ```
 *            inviteAffiliate              acceptInvitation
 *   (none) ──────────────────▶ PENDING ─────────────────────▶ ACTIVE
 *                               │  │                            │
 *            declineInvitation  │  │  revokeAffiliation         │  revokeAffiliation
 *                 ┌─────────────┘  └──────────┐                 │  leaveBusiness
 *                 ▼                           ▼                 ▼
 *              REVOKED ◀──────────────────────┴─────────────────┘
 *                 ▲
 *                 │ (the clock, written lazily)
 *              EXPIRED
 * ```
 *
 * **`REVOKED` is the single terminal state, reached from either side**, and that is a
 * deliberate narrowing rather than an omission. The four ways a relationship ends — the
 * invitee said no, the shop withdrew the offer, the shop removed an employee, the employee
 * resigned — are four *audit actions* and one *status*, because a union with `DECLINED`,
 * `CANCELLED` and `REMOVED` in it would make every reader handle four spellings of "not
 * here any more", and the audit log already says which one happened, with a name and a
 * timestamp attached. If a screen ever needs to distinguish them on the row itself, the
 * distinction is in `audit_log` and belongs there.
 *
 * ## `EXPIRED` is written lazily, and correctness does not depend on it
 *
 * Nothing sweeps. Every path that would act on a pending row compares `expires_at` to the
 * clock first — `acceptableAt` below is that comparison and it is the only one — so an
 * invitation that lapsed five minutes ago is refused whether or not a row says so.
 *
 * The stored `EXPIRED` is written by `acceptInvitation` when it refuses a lapsed row, and
 * by `revokeAffiliation` when a shop withdraws an offer that had already lapsed. That is
 * "fix the row on the way past", and it means the stored status converges on the truth the
 * moment anybody looks. A row nobody ever looks at keeps saying
 * `PENDING_USER_ACCEPTANCE` about a window that closed, and that is a **deliberate
 * deferral rather than a gap**: a scheduled sweep is a cron whose only output is tidiness,
 * and no screen can display the stale value anyway — `business.affiliations` recomputes
 * `expired` from the clock and `business.pendingInvitations` is the inbox the invitee is
 * about to act on, which is exactly where the write happens.
 */

/** How long an invitation is good for, as a duration. See `AFFILIATION_INVITE_TTL_DAYS`. */
const INVITE_TTL_MS = AFFILIATION_INVITE_TTL_DAYS * 86_400_000;

/**
 * Whether a pending row is still acceptable at `now`.
 *
 * The comparison is `>` and not `>=`, matching `verificationIsLive` in
 * `services/identity.ts`: an invitation that expires at exactly this millisecond is
 * expired, because the alternative is a window of one millisecond in which two readers
 * disagree about the same row.
 *
 * A null `expiresAt` means "does not lapse", which no invitation is created with — the
 * column is nullable because a membership that was never an invitation has no window, and
 * treating null as "already expired" would make a hand-written row permanently acceptable
 * to nothing.
 */
export function acceptableAt(
	row: { status: string; expiresAt: Date | null },
	now: Date,
): boolean {
	if (row.status !== "PENDING_USER_ACCEPTANCE") return false;
	if (row.expiresAt === null) return true;
	return row.expiresAt.getTime() > now.getTime();
}

/**
 * The audit vocabulary this file writes, gathered so a reader sees it at once.
 *
 * They are in `ADMIN_ACTIONS` and not in a union of their own — the docblock on that list
 * says why — and `affiliation.revoke` is additionally in `REASON_REQUIRED_ACTIONS`.
 */
const AFFILIATION_AUDIT = {
	invite: "affiliation.invite",
	accept: "affiliation.accept",
	decline: "affiliation.decline",
	leave: "affiliation.leave",
	revoke: "affiliation.revoke",
} as const;

/**
 * Ask an existing PymesHub user to join the team.
 *
 * `OWNER` and `MANAGER` may invite, which is `staff:manage`'s own set — and inviting
 * somebody **as** an owner is narrowed to an owner, exactly as `inviteStaff` narrows it:
 * `staff:manage` belongs to MANAGER too, and handing the business over is not a manager's
 * decision.
 *
 * ## The duplicate check, and the reactivation path it now has
 *
 * `membership_business_user_unique` is on `(business_id, user_id)` with no status in it,
 * so a second insert for the same pair is a constraint failure rather than a second
 * invitation — and the failure would arrive as a 500 where a sentence belongs. The read
 * below is therefore deliberately unfiltered, as it is in `inviteStaff`.
 *
 * What changed in Phase 2 is what happens *after* it finds a row. Phase 1 left the check
 * refusing outright and recorded the consequence: a shop that removed somebody could never
 * ask them back, and the refusal said "esa persona ya forma parte del equipo" about a person
 * who demonstrably did not. That is the sentence that turns a refusal into a constraint 500
 * on the *next* attempt, and it is why re-inviting now **updates** the existing row.
 *
 * Which states may be revived is the careful part:
 *
 * - `REVOKED` and `EXPIRED` — yes. The relationship ended; this is a new one, and it is the
 *   same row because the pair is the same pair. `accepted_at` and `revoked_at` are cleared
 *   so the row does not carry the previous episode's dates into the new one.
 * - `PENDING_USER_ACCEPTANCE` — yes, and it is a *re-issue* rather than a duplicate: a new
 *   token, a new window, a new notification. A shop whose invitation went to somebody who
 *   is on holiday, or whose window is nearly out, needs this and has no other way to get it.
 * - `ACTIVE` — **no.** That is the person who already works here, and it is the one case
 *   where "ya forma parte del equipo" is the true sentence.
 *
 * The role is overwritten in the revived cases: a shop re-inviting somebody as a MANAGER
 * means it, and refusing because the old row said STAFF would be the same class of bug as
 * refusing outright.
 */
export async function inviteAffiliate(
	ctx: BusinessContext,
	input: {
		businessId: string;
		email: string;
		role: Extract<MembershipRole, "OWNER" | "MANAGER" | "STAFF">;
	},
): Promise<AffiliationInvitation> {
	const businessId = ctx.membership.businessId;
	if (input.role === "OWNER") assertRole(ctx, "OWNER");

	const invitee = await ctx.db
		.select()
		.from(userTable)
		.where(eq(userTable.email, input.email))
		.limit(1);

	const user = invitee[0];
	if (!user) {
		// The same sentence `inviteStaff` gives, and for the same reason: the manager typed an
		// address and needs to be told it has no account, which is actionable. The rate limit
		// at the router is what keeps this from being an enumeration oracle.
		throw new ValidationError("Esa persona todavía no tiene cuenta en PymesHub", {
			email: input.email,
		});
	}

	const existing = await ctx.db
		.select({
			id: membershipTable.id,
			status: membershipTable.status,
			role: membershipTable.role,
		})
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, user.id),
			),
		)
		.limit(1);

	const row = existing[0];
	if (row?.status === "ACTIVE")
		throw new ConflictError("Esa persona ya forma parte del equipo");

	const now = new Date();
	const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
	const { token, hash } = await mintInviteToken();
	const membershipId = row?.id ?? newInvitationId();

	/**
	 * No seat is checked here, and that is the rule rather than an omission.
	 *
	 * A `PENDING_USER_ACCEPTANCE` row **counts against nothing** — not the switcher, not the
	 * badge, and not the plan's `staffAccounts`. The seat is spent when the row becomes
	 * `ACTIVE`, which is where `acceptInvitation` checks it, and checking here instead would
	 * break the rule in two directions at once: the pending row would be consuming a paid
	 * resource while conferring nothing, and a manager could exhaust a plan's seats by typing
	 * addresses at people who never answer.
	 *
	 * The rate limit at the router is what bounds this path, which is the right instrument:
	 * an invitation costs an email, and emails are what a limiter is for.
	 */
	const businessRows = await ctx.db
		.select({ name: businessTable.name })
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);
	const business = orNotFound(businessRows[0]);

	/**
	 * The write, the audit row and the notification, as one atomic unit.
	 *
	 * A batch rather than three awaits, for the reason `services/audit.ts` states: D1 has no
	 * transaction to open from here, so a batch is the only atomic write this database
	 * offers, and a failure between the membership and its audit row is exactly the state
	 * that makes "who invited this person" unanswerable later.
	 *
	 * The notification rides in the same batch as well, which `couriers.invite` does not do.
	 * That is a deliberate improvement rather than an inconsistency: an invitation that
	 * exists and never announced itself is a person who is never told, and there is no
	 * retry that would find it.
	 */
	const values = {
		role: input.role,
		status: "PENDING_USER_ACCEPTANCE" as const,
		invitedByUserId: ctx.user.id,
		acceptedAt: null,
		revokedAt: null,
		expiresAt,
		inviteTokenHash: hash,
	};

	const write: BatchItem<"sqlite"> = row
		? // Addressed by id, which was read under both `businessId` and `userId`: the update
			// cannot reach a row in another tenant even if the two inputs disagreed.
			ctx.db
				.update(membershipTable)
				.set(values)
				.where(eq(membershipTable.id, row.id))
		: ctx.db.insert(membershipTable).values({
				id: membershipId,
				businessId,
				userId: user.id,
				...values,
				createdAt: now,
			});

	await ctx.db.batch(
		batchOf([
			write,
			auditStatement(ctx, {
				action: AFFILIATION_AUDIT.invite,
				targetType: "membership",
				targetId: membershipId,
				before: row ? { status: row.status, role: row.role } : null,
				after: {
					status: "PENDING_USER_ACCEPTANCE",
					role: input.role,
					userId: user.id,
					businessId,
				},
				reason: null,
				now,
			}),
			ctx.db.insert(notificationTable).values({
				id: newId("notification"),
				userId: user.id,
				// `DELIVERY` reaches the bell; `INTERNAL_NOTIFICATION_KINDS` holds only
				// `ORDER_REQUEST`, which is the one kind a person must not be shown.
				kind: "DELIVERY",
				title: "Nueva invitación de equipo",
				body: `${business.name} te invitó a unirte como ${roleWord(input.role)}`,
				data: {
					type: "AFFILIATION_INVITED",
					membershipId,
					businessId,
				},
				readAt: null,
				createdAt: now,
				/**
				 * Built from what identifies the *invitation*, per the column's own rule.
				 *
				 * Unlike `couriers.invite`, which mints a new invite id per invitation and can
				 * therefore key on the id alone, this path **reuses the membership id** — a
				 * re-issue updates the row it already has. So the id is not the event: the
				 * event is the *mint*, and the digest is its identity. It is fresh on every
				 * issue, it is stored on the row beside it, and no two invitations can share
				 * it.
				 *
				 * The first spelling of this was `...:${expiresAt.getTime()}`, and it was
				 * wrong twice over. The column's docblock says the key is never built from a
				 * timestamp, and the reason is not stylistic: two re-issues in the same
				 * millisecond produce the same key, and the unique index then fails the whole
				 * batch — so the second invitation is not merely unannounced, it is never
				 * written. A manager who double-clicks "resend" is enough to reach it, and
				 * `affiliation-lifecycle.test.ts` reaches it in roughly one run in four.
				 *
				 * Keying on the digest also keeps the two rows in step: the notification and
				 * the token it announces are derived from one mint, so a link that is
				 * superseded is a notification that is superseded with it.
				 */
				dedupeKey: `affiliation-invite:${membershipId}:${hash}`,
			}),
		]),
	);

	return {
		membershipId,
		businessId,
		role: input.role,
		email: input.email,
		token,
		expiresAt,
		createdAt: now,
	};
}

/**
 * Refuse when the shop has no seat left for another employee.
 *
 * ## It is called at *acceptance*, not at invitation, and that is the whole design
 *
 * `staffAccounts` counts **employees** — the `ACTIVE` rows — and a `PENDING_USER_ACCEPTANCE`
 * row is deliberately not one of them, because a pending row counts against no limit. So the
 * seat is spent at the moment the row becomes `ACTIVE`, and this is that moment.
 *
 * The alternative, checking at the invitation, fails in both directions: the pending row
 * would hold a paid resource while conferring nothing, and a manager could exhaust a plan's
 * seats by typing addresses at people who never answer. `inviteStaff` checks the same cap at
 * the same *conceptual* moment — when the row becomes a seat — which for that procedure is
 * the insert, because it writes `ACTIVE` directly.
 *
 * ## Riders hold no seat
 *
 * `role === "COURIER"` returns early, matching `inviteStaff`'s count and the plan table's own
 * meaning: a delivery rider is not an employee of the shop. `inviteAffiliate` cannot produce a
 * rider invitation — couriers arrive through `couriers.invite`, which has its own review — so
 * this is a guard rather than a live path, and it is here because the count below is the one
 * `inviteStaff` uses and the two must measure the same population.
 *
 * ## Nothing is written on the refusal
 *
 * Unlike a lapsed invitation, which is marked `EXPIRED` on the way past because the row's own
 * window is a fact about the row, a full shop is a fact about the *shop* — and it is one the
 * merchant can change by upgrading. Marking the invitation would destroy an invitation that
 * becomes acceptable the moment the plan does.
 */
async function assertSeatAvailable(input: {
	db: Db;
	billing: BillingPlan;
	businessId: string;
	role: MembershipRole;
}): Promise<void> {
	if (input.role === "COURIER") return;

	const rows = await input.db
		.select({ role: membershipTable.role })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, input.businessId),
				// Only people who can act hold a seat. Counting pending rows would make the
				// cap bind on invitations, which is the rule this function exists to keep.
				eq(membershipTable.status, "ACTIVE"),
			),
		);

	const employees = rows.filter((row) => row.role !== "COURIER");
	checkCount({
		ctx: input.billing,
		limitName: "staffAccounts",
		resourceType: "cuentas de equipo",
		current: employees.length,
	});
}

/** The role as the sentence a person reads. The notification body is written here, so it is written here. */
function roleWord(role: string): string {
	if (role === "OWNER") return "Propietario";
	if (role === "MANAGER") return "Encargado";
	if (role === "STAFF") return "Colaborador";
	return "Repartidor";
}

/**
 * The shop's own list of who is here, who was asked, and who left.
 *
 * Cursor-paginated on `(createdAt, id)` rather than by offset, because this list is a
 * ledger: a row added while somebody is paging an offset list shifts every row after it,
 * and the page they scroll to next shows somebody twice. The cursor is the pair because two
 * memberships created in the same millisecond — which is what an owner onboarding a team in
 * one sitting produces — would otherwise page by a random uuid. The expansion into two
 * clauses is the same one `users.listNotifications` uses, and for the same reason.
 *
 * Ordered newest first, which is what a ledger wants: the invitation sent this morning is
 * the row being looked for.
 */
export async function affiliations(
	ctx: BusinessContext,
	input: {
		businessId: string;
		status?: AffiliationStatus;
		cursor?: string;
		limit: number;
	},
): Promise<{ rows: AffiliationRow[]; nextCursor: string | null }> {
	const businessId = ctx.membership.businessId;
	const now = new Date();
	const after = decodeCursor<{ createdAt: number; id: string }>(input.cursor);

	const conditions = [eq(membershipTable.businessId, businessId)];
	if (input.status) {
		conditions.push(eq(membershipTable.status, input.status));
	}
	if (after) {
		conditions.push(
			or(
				lt(membershipTable.createdAt, new Date(after.createdAt)),
				and(
					eq(membershipTable.createdAt, new Date(after.createdAt)),
					lt(membershipTable.id, after.id),
				),
			)!,
		);
	}

	const rows = await ctx.db
		.select({ membership: membershipTable, user: userTable })
		.from(membershipTable)
		.innerJoin(userTable, eq(membershipTable.userId, userTable.id))
		.where(and(...conditions))
		.orderBy(desc(membershipTable.createdAt), desc(membershipTable.id))
		.limit(input.limit + 1);

	const page = rows.slice(0, input.limit);
	const last = page[page.length - 1];

	// The inviter's name is a second read rather than a second join: `invited_by_user_id` is
	// `on delete set null`, so the same `user` table is joined twice and would have to be
	// aliased to say which side each one means. Twenty-five rows of names is not a round trip
	// worth that.
	const inviterIds = [
		...new Set(
			page
				.map((row) => row.membership.invitedByUserId)
				.filter((id): id is string => id !== null),
		),
	];
	const inviters =
		inviterIds.length === 0
			? []
			: await ctx.db
					.select({ id: userTable.id, name: userTable.name })
					.from(userTable)
					.where(inArray(userTable.id, inviterIds));
	const inviterById = new Map(inviters.map((row) => [row.id, row.name]));

	return {
		rows: page.map((row) => ({
			membershipId: row.membership.id,
			userId: row.user.id,
			name: row.user.name,
			email: row.user.email,
			image: row.user.image,
			role: row.membership.role,
			status: row.membership.status,
			/**
			 * The clock's answer, and only about pending rows.
			 *
			 * An `ACTIVE` membership has an `expiresAt` of null because acceptance clears it,
			 * so asking `acceptableAt` about one would answer `false` — the function's subject
			 * is an *invitation*. The status check is what keeps "expired" from meaning "not
			 * currently an invitation", which every employee row would be.
			 */
			expired:
				row.membership.status === "PENDING_USER_ACCEPTANCE" &&
				!acceptableAt(row.membership, now),
			invitedBy: row.membership.invitedByUserId
				? {
						id: row.membership.invitedByUserId,
						name: inviterById.get(row.membership.invitedByUserId) ?? "",
					}
				: null,
			acceptedAt: row.membership.acceptedAt,
			revokedAt: row.membership.revokedAt,
			expiresAt: row.membership.expiresAt,
			createdAt: row.membership.createdAt,
		})),
		nextCursor:
			rows.length > input.limit && last
				? encodeCursor({
						createdAt: last.membership.createdAt.getTime(),
						id: last.membership.id,
					})
				: null,
	};
}

/**
 * The invited person accepts. The only path from `PENDING_USER_ACCEPTANCE` to `ACTIVE`.
 *
 * ## The gates, all of them inside the `where`
 *
 * The row is read **by id, by the caller's own user id, and by `PENDING_USER_ACCEPTANCE`**.
 * That is the whole boundary and it is deliberately not a check afterwards: a `NOT_FOUND`
 * for somebody else's invitation and a `NOT_FOUND` for an invitation that does not exist are
 * the same answer, so a caller cannot use the difference to learn which membership ids are
 * real. An already-accepted invitation answers `NOT_FOUND` for the same reason — the second
 * accept is not a second activation.
 *
 * **The token is not consulted here.** Holding a link is not being the invitee, and the
 * person who can accept is the person the row names. That is why a leaked token is worth so
 * little: it buys a shop's name and a role, and nothing else.
 *
 * ## The clock, and the one write that happens on a refusal
 *
 * A lapsed row is refused, and the refusal **writes `EXPIRED`** on the way past. A mutation
 * that throws after writing is unusual enough to justify: the caller has just tried to take
 * up an invitation that is over, and leaving the row saying `PENDING_USER_ACCEPTANCE` would
 * make every later reader recompute the same conclusion from the clock. This is the only
 * place the stored `EXPIRED` is reachable from the invitee's side.
 *
 * The write is a bare `update` and not a batch, because there is nothing to record: no
 * capability moved, nobody gained or lost anything, and an audit row saying "an invitation
 * expired" would be written by whoever happened to tap a button first.
 *
 * ## What acceptance writes
 *
 * Four fields and an audit row, in one batch. `status: ACTIVE`, `accepted_at: now`,
 * `expires_at: null` — the window is over because the question was answered — and
 * `invite_token_hash: null`, because a live digest on a membership that is no longer an
 * invitation is a credential kept past its purpose.
 *
 * ## The seat cap is checked *here*, and the ordering of the two refusals is deliberate
 *
 * A `PENDING_USER_ACCEPTANCE` row counts against no limit, so the plan's `staffAccounts` is
 * checked at the moment the row becomes a seat — this one. A shop on a one-seat plan can be
 * sent fifty invitations and the fifty-first person to accept is refused, which is the
 * difference between a limit and a limit that does not limit.
 *
 * The expiry check comes **first**, because the two refusals are about different things and
 * only one of them is a dead end: an expired invitation is over and is marked as such, while
 * a full shop is a fact the merchant can change by upgrading — so the invitation is left
 * untouched and becomes acceptable the moment the plan does. A person told "no seats" about an
 * invitation that also expired would have been told the fixable half of the truth.
 *
 * ## The token is not consulted here. Holding a link is not being the invitee, and the
 * person who can accept is the person the row names — which is why a leaked token is worth so
 * little: it buys a shop's name and a role, and nothing else.
 */
export async function acceptInvitation(
	ctx: UserContext,
	input: { invitationId: string },
): Promise<{ businessId: string; membershipId: string }> {
	const rows = await ctx.db
		.select({
			id: membershipTable.id,
			businessId: membershipTable.businessId,
			role: membershipTable.role,
			status: membershipTable.status,
			expiresAt: membershipTable.expiresAt,
		})
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.id, input.invitationId),
				eq(membershipTable.userId, ctx.user.id),
				eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);
	const now = new Date();

	if (!acceptableAt(row, now)) {
		await ctx.db
			.update(membershipTable)
			.set({ status: "EXPIRED" })
			.where(eq(membershipTable.id, row.id));
		throw new ConflictError("Esta invitación ya expiró");
	}

	// The seat, at the moment it is spent. `loadBilling` is the same read
	// `businessProcedure` performs for every merchant route, called directly because this
	// procedure is a `protectedProcedure`: there is no membership to resolve a plan from —
	// the membership is what this call is creating.
	const billing = await loadBilling(ctx.db, row.businessId, now);
	await assertSeatAvailable({
		db: ctx.db,
		billing: { businessPlan: billing.plan, subscriptionStatus: billing.status },
		businessId: row.businessId,
		role: row.role,
	});

	await ctx.db.batch(
		batchOf([
			ctx.db
				.update(membershipTable)
				.set({
					status: "ACTIVE",
					acceptedAt: now,
					expiresAt: null,
					inviteTokenHash: null,
				})
				// Addressed by id **and** by the status the read established. The read above
				// already proved the row is pending, and the condition is restated for the reason
				// `updateStaffRole` restates its own: D1 offers no transaction to open around the
				// pair, so without this a membership revoked between the read and the write would
				// be activated, and the caller would be told it worked.
				.where(
					and(
						eq(membershipTable.id, row.id),
						eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
					),
				),
			auditStatement(ctx, {
				action: AFFILIATION_AUDIT.accept,
				targetType: "membership",
				targetId: row.id,
				before: { status: "PENDING_USER_ACCEPTANCE" },
				after: { status: "ACTIVE", businessId: row.businessId },
				reason: null,
				now,
			}),
		]),
	);

	return { businessId: row.businessId, membershipId: row.id };
}

/**
 * The invited person declines.
 *
 * `REVOKED`, not a status of its own — see the header for why the four ways a relationship
 * ends share one terminal state. The row is kept rather than deleted so the shop's ledger
 * can say that somebody was asked and said no, which is a different fact from "we never asked
 * them" and is exactly what a manager wants to know before asking again.
 *
 * No reason is required. `affiliation.decline` is not in `REASON_REQUIRED_ACTIONS`, for the
 * reason `user.reactivate` is not: it is the person's own decision about their own access,
 * and demanding a justification for saying no to a job is the pattern that list exists to
 * avoid.
 */
export async function declineInvitation(
	ctx: UserContext,
	input: { invitationId: string },
): Promise<{ ok: true }> {
	const rows = await ctx.db
		.select({ id: membershipTable.id, businessId: membershipTable.businessId })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.id, input.invitationId),
				eq(membershipTable.userId, ctx.user.id),
				eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);
	const now = new Date();

	await ctx.db.batch(
		batchOf([
			ctx.db
				.update(membershipTable)
				.set({ status: "REVOKED", revokedAt: now, inviteTokenHash: null })
				.where(
					and(
						eq(membershipTable.id, row.id),
						eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
					),
				),
			auditStatement(ctx, {
				action: AFFILIATION_AUDIT.decline,
				targetType: "membership",
				targetId: row.id,
				before: { status: "PENDING_USER_ACCEPTANCE" },
				after: { status: "REVOKED", businessId: row.businessId },
				reason: null,
				now,
			}),
		]),
	);

	return { ok: true };
}

/**
 * Somebody leaves the team themselves.
 *
 * A `businessProcedure("orders:read")` — the capability every role holds — because this is
 * the one membership mutation whose actor is the member. There is no role to check: a STAFF
 * member may quit and so may an owner, and the only refusal is the last-owner guard, which is
 * about the shop rather than about the person.
 *
 * **The last owner cannot leave**, and the guard is `assertNotLastOwner` — the same function
 * `removeStaff` uses, imported rather than reimplemented, because two copies of "how many
 * people can still administer this shop" is how one of them keeps counting a revoked owner.
 * Leaving is a resignation, and a shop nobody can administer is a state with no way out of it
 * from the UI.
 *
 * The row is kept, like every other ending here, so the shop's history survives the person's
 * departure — which is the whole difference between this and `removeStaff`'s delete.
 */
export async function leaveBusiness(
	ctx: BusinessContext,
	_input: { businessId: string },
): Promise<{ ok: true }> {
	const businessId = ctx.membership.businessId;

	if (ctx.membership.role === "OWNER") {
		await assertNotLastOwner(ctx, businessId, ctx.user.id);
	}

	const now = new Date();
	const rows = await ctx.db
		.select({ id: membershipTable.id })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, ctx.user.id),
				eq(membershipTable.status, "ACTIVE"),
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);

	await ctx.db.batch(
		batchOf([
			ctx.db
				.update(membershipTable)
				.set({ status: "REVOKED", revokedAt: now, inviteTokenHash: null })
				.where(
					and(
						eq(membershipTable.id, row.id),
						eq(membershipTable.status, "ACTIVE"),
					),
				),
			auditStatement(ctx, {
				action: AFFILIATION_AUDIT.leave,
				targetType: "membership",
				targetId: row.id,
				before: { status: "ACTIVE", role: ctx.membership.role },
				after: { status: "REVOKED", businessId },
				reason: null,
				now,
			}),
		]),
	);

	return { ok: true };
}

/**
 * A shop removes somebody, or withdraws an invitation. OWNER only.
 *
 * ## One procedure for two acts, because the write is the same write
 *
 * "Revoke the membership of somebody who works here" and "cancel the invitation we sent" are
 * the same statement — `status = REVOKED`, `revoked_at = now` — addressed to the same row. Two
 * procedures would be two copies of the last-owner guard and two chances to forget it, and the
 * only thing that differs is the audit action, which the read below already knows: the row's
 * status *before* the write says which act this was.
 *
 * The audit action is `affiliation.revoke` in both cases rather than a separate
 * `affiliation.cancel`, and the `before` payload carries the status the row was in. A shop
 * reading its own history wants "we withdrew this" and "we removed them" as one column it can
 * sort, with the state it ended from beside it — not two actions whose meanings a reader has
 * to look up.
 *
 * ## Why the reason is required
 *
 * `affiliation.revoke` is in `REASON_REQUIRED_ACTIONS`, so `requireReason` refuses without one
 * and the console asks before sending. Removing somebody's access to a till is the same family
 * as suspending an account: a real person loses something, and the sentence explaining why is
 * read by an owner who was not in the room. A cancelled invitation is a lighter act that passes
 * through the same gate, which is a small tax on the lighter act rather than a hole in the
 * heavier one.
 *
 * ## What it does not do
 *
 * It does not delete the row — that is `removeStaff`, which exists for the case where the
 * relationship should leave no trace beyond the audit log. It does not touch the plan's seat
 * count, because the count reads `ACTIVE` and a revoked row is not. And it does not touch
 * `business.verification_*`: **revoking a shop's verification keeps its team**, because the
 * badge is a claim about the shop and the team is the shop's own business. A verification
 * revocation clears the *badge* — at read time, in `deriveDisplay`, for every affiliated
 * profile — and nothing else, which is the difference between losing a mark and losing a job.
 */
export async function revokeAffiliation(
	ctx: BusinessContext,
	input: { businessId: string; userId: string; reason: string },
): Promise<{ ok: true }> {
	assertRole(ctx, "OWNER");
	const businessId = ctx.membership.businessId;
	const reason = requireReason(AFFILIATION_AUDIT.revoke, input.reason);

	const rows = await ctx.db
		.select({
			id: membershipTable.id,
			role: membershipTable.role,
			status: membershipTable.status,
			expiresAt: membershipTable.expiresAt,
		})
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, input.userId),
				// Both live states, and no others. A row already `REVOKED` or `EXPIRED` answers
				// `NOT_FOUND`, matching `removeStaff`: revoking something that is already over is
				// not a second revocation, and a response that said it succeeded would make "did
				// this work" unanswerable.
				or(
					eq(membershipTable.status, "ACTIVE"),
					eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
				)!,
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);
	const now = new Date();

	// The last-owner guard applies only to somebody who can currently administer the shop. A
	// pending invitation to be an OWNER is not an owner — nobody can sign in as them — so
	// cancelling one cannot strand the business.
	if (row.status === "ACTIVE" && row.role === "OWNER") {
		await assertNotLastOwner(ctx, businessId, input.userId);
	}

	/**
	 * A lapsed invitation is `EXPIRED` rather than `REVOKED`, and the distinction is the
	 * clock's. Withdrawing an offer that had already run out is not a decision the shop made
	 * about a person; it is the shop tidying up after a window that closed on its own, and
	 * recording it as a revocation would put the shop's own name on an ending it did not cause.
	 * `revoked_at` is still written, because *somebody* closed the row.
	 */
	const lapsed = row.status === "PENDING_USER_ACCEPTANCE" && !acceptableAt(row, now);
	const nextStatus: AffiliationStatus = lapsed ? "EXPIRED" : "REVOKED";

	await ctx.db.batch(
		batchOf([
			ctx.db
				.update(membershipTable)
				.set({ status: nextStatus, revokedAt: now })
				.where(
					and(
						eq(membershipTable.id, row.id),
						or(
							eq(membershipTable.status, "ACTIVE"),
							eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
						)!,
					),
				),
			auditStatement(ctx, {
				action: AFFILIATION_AUDIT.revoke,
				targetType: "membership",
				targetId: row.id,
				before: { status: row.status, role: row.role },
				after: { status: nextStatus, businessId, userId: input.userId },
				reason,
				now,
			}),
		]),
	);

	return { ok: true };
}

/**
 * Resolve an invitation link, for somebody who is not signed in yet.
 *
 * ## What this returns, and what it very deliberately does not
 *
 * A shop name, its slug and logo, the role, who invited them, and whether the window is still
 * open. **No email address** — the one field that would turn a leaked link into "which account
 * is this for" — and no membership id, no capability, no tax id, nothing from
 * `business_verification_request`. The visitor holds a link that was emailed to somebody; that
 * proves the link, not the person, and this response is written for a stranger.
 *
 * ## Why it is a read and not an accept
 *
 * Accepting requires being signed in as the invited user, which is the whole authorization
 * (`acceptInvitation` reads the row by `user_id`). A link cannot sign anybody in, and a public
 * procedure that moved a membership to `ACTIVE` would be a procedure where holding an email
 * makes you a member. So this resolves the *question* — "what is this link" — and the accept
 * path answers it once the visitor has a session.
 *
 * ## It refuses to distinguish "wrong token" from "over"
 *
 * A token that matches no row and a token whose row is `REVOKED` or `EXPIRED` both answer
 * `NOT_FOUND`. The alternative — "esta invitación fue revocada" for a real token and "no
 * existe" for a guessed one — is an oracle that tells a prober which of their guesses was a
 * real link. `acceptable: false` is only ever reported for a row the token *does* name and
 * whose window has closed, which is not a secret from the person holding the link.
 *
 * ## It is the only reader of `invite_token_hash`, and it is why the digest exists
 *
 * A public read addressed by a bearer credential is exactly the shape that makes hashing at
 * rest worth its cost: a dump of this database yields no working links. See
 * `services/invite-token.ts`.
 */
export async function invitationPreview(
	db: Db,
	input: { token: string },
	now: Date = new Date(),
): Promise<InvitationPreview> {
	const hash = await hashInviteToken(input.token);

	const rows = await db
		.select({
			status: membershipTable.status,
			role: membershipTable.role,
			expiresAt: membershipTable.expiresAt,
			invitedByUserId: membershipTable.invitedByUserId,
			businessName: businessTable.name,
			businessSlug: businessTable.slug,
			businessLogoUrl: businessTable.logoUrl,
		})
		.from(membershipTable)
		.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
		.where(eq(membershipTable.inviteTokenHash, hash))
		.limit(1);

	const row = rows[0];
	// `NOT_FOUND` for a token that names nothing **and** for a relationship that is over. See
	// the docblock: the difference is an oracle.
	if (!row || row.status === "REVOKED" || row.status === "EXPIRED") {
		throw new NotFoundError();
	}

	const inviter = row.invitedByUserId
		? await db
				.select({
					id: userTable.id,
					name: userTable.name,
					image: userTable.image,
				})
				.from(userTable)
				.where(eq(userTable.id, row.invitedByUserId))
				.limit(1)
		: [];

	return {
		businessName: row.businessName,
		businessSlug: row.businessSlug,
		businessLogoUrl: row.businessLogoUrl,
		role: row.role,
		invitedBy: inviter[0] ?? null,
		expiresAt: row.expiresAt,
		acceptable: acceptableAt(row, now),
	};
}

/** Exported for the specs, which assert that no write path leaves an audit row behind. */
export const AFFILIATION_ACTIONS = AFFILIATION_AUDIT;
