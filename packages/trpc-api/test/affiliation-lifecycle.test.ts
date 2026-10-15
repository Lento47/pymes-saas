import { describe, expect, test } from "bun:test";
import {
	auditLog as auditLogTable,
	business as businessTable,
	membership as membershipTable,
	notification as notificationTable,
} from "@pymeshub/db";
import { REASON_REQUIRED_ACTIONS } from "@pymeshub/shared";
import { and, eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { mintInviteToken } from "../src/services/invite-token";
import {
	authed,
	contextFor,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

/**
 * The affiliation lifecycle: invite → accept → leave, and the four ways it ends.
 *
 * `affiliations.test.ts` proves the *shape* of a pending row — that it grants nothing — against
 * the reads that existed in Phase 1. This file proves the **transitions**: that the writes
 * which move a membership between states are the only ones that can, that each of them is
 * authorized by the right party, and that each leaves an audit row saying who did it.
 *
 * ## The four gates, one per actor
 *
 * The interesting thing about this lifecycle is that **four different parties** can end it, and
 * none of them can do the others' job:
 *
 * - the invited person accepts (`affiliations.accept`), and nobody else can — the row is read
 *   by the caller's own user id;
 * - the invited person declines (`affiliations.decline`), which is the same row and a different
 *   word in the log;
 * - the shop withdraws the offer or removes an employee (`business.revokeAffiliation`),
 *   OWNER-only and with a reason;
 * - the member resigns (`affiliations.leave`), which no role may refuse except the last-owner
 *   guard.
 *
 * Four audit actions, one terminal status. The tests below assert the *action name* rather than
 * only the resulting status, because the status is deliberately the same in all four cases and
 * the log is the only place the distinction survives.
 *
 * ## The clock, which is a participant too
 *
 * An invitation has a window, and `EXPIRED` is written **lazily** — by `acceptInvitation` when
 * it refuses a lapsed row, and by `revokeAffiliation` when a shop withdraws one that had
 * already run out. Nothing sweeps, and correctness never depends on the stored value, so the
 * tests below prove both halves: that a lapsed row is refused *and* that it is marked on the
 * way past.
 */

/** A shop with an owner, and an account to invite. Everything a case in this file needs. */
async function shop() {
	const test = world();
	const businessId = await seedBusiness(test.db, {
		id: "biz_lifecycle_shop",
		name: "Café Central",
		slug: "cafe-central",
	});
	const owner = await seedUser(test.db, { id: "usr_lifecycle_owner" });
	const invitee = await seedUser(test.db, {
		id: "usr_lifecycle_invitee",
		name: "Persona Invitada",
		email: "invitada@example.test",
	});
	const other = await seedUser(test.db, {
		id: "usr_lifecycle_other",
		email: "otra@example.test",
	});
	await seedMembership(test.db, owner.id, businessId, "OWNER");

	const callerFor = async (user: typeof owner) =>
		appRouter.createCaller(await authed(test, user)) as Caller;

	return { test, businessId, owner, invitee, other, callerFor };
}

/** The membership row for a user, read raw, so a spec can assert on columns. */
async function membershipRow(
	test: ReturnType<typeof world>,
	userId: string,
	businessId: string,
) {
	const rows = await test.db
		.select()
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.userId, userId),
				eq(membershipTable.businessId, businessId),
			),
		)
		.limit(1);
	return rows[0];
}

/** Every audit action recorded against a membership, oldest first. */
async function auditActions(
	test: ReturnType<typeof world>,
	membershipId: string,
): Promise<string[]> {
	const rows = await test.db
		.select({ action: auditLogTable.action })
		.from(auditLogTable)
		.where(eq(auditLogTable.targetId, membershipId));
	return rows.map((row) => row.action);
}

describe("inviting somebody", () => {
	test("creates a pending membership and returns the only copy of the token", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "MANAGER",
		});

		expect(invitation.role).toBe("MANAGER");
		expect(invitation.businessId).toBe(businessId);
		// The window is the shared constant, computed server-side: a client that
		// rendered its own would disagree the first time the constant changed.
		expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now());

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("PENDING_USER_ACCEPTANCE");
		expect(row?.role).toBe("MANAGER");
		expect(row?.invitedByUserId).toBe(owner.id);
		expect(row?.acceptedAt).toBeNull();

		test.close();
	});

	test("stores the digest and never the token, so a database dump yields no links", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.inviteTokenHash).toMatch(/^sha256:[0-9a-f]{64}$/);
		expect(row?.inviteTokenHash).not.toBe(invitation.token);

		// The strongest form of the claim: the raw token appears in no column of the row.
		// A spec that only compared the two fields would pass for a hash of something
		// else entirely.
		expect(JSON.stringify(row)).not.toContain(invitation.token);

		test.close();
	});

	test("writes the invitation, its audit row and its notification in one batch", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		expect(
			await auditActions(test, invitation.membershipId),
		).toEqual(["affiliation.invite"]);

		// The notification is what tells the person there is something to accept, and it
		// rides in the same batch as the membership: an invitation that exists and never
		// announced itself is a person who is never told, and there is no retry that would
		// find it.
		const notices = await test.db
			.select()
			.from(notificationTable)
			.where(eq(notificationTable.userId, invitee.id));
		expect(notices).toHaveLength(1);
		expect(notices[0]?.body).toContain("Café Central");
		expect(notices[0]?.body).toContain("Colaborador");

		test.close();
	});

	test("refuses an address with no account, and says so", async () => {
		const { test, businessId, owner, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const failure = await refused(
			ownerCaller.business.inviteAffiliate({
				businessId,
				email: "nadie@example.test",
				role: "STAFF",
			}),
		);

		expect(failure.code).toBe("BAD_REQUEST");
		expect(failure.message).toContain("todavía no tiene cuenta");

		test.close();
	});

	test("refuses somebody who already works here", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF");

		const ownerCaller = await callerFor(owner);
		const failure = await refused(
			ownerCaller.business.inviteAffiliate({
				businessId,
				email: invitee.email,
				role: "MANAGER",
			}),
		);

		expect(failure.code).toBe("CONFLICT");
		expect(failure.message).toContain("ya forma parte del equipo");

		test.close();
	});

	test("re-issues an unanswered invitation rather than refusing it", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const first = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});
		const second = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "MANAGER",
		});

		// The same row - the pair is the pair - with a new token, a new window and the new
		// role. A shop whose invitation went to somebody on holiday has no other way to get
		// it in front of them again.
		expect(second.membershipId).toBe(first.membershipId);
		expect(second.token).not.toBe(first.token);

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.role).toBe("MANAGER");
		expect(row?.status).toBe("PENDING_USER_ACCEPTANCE");

		// And the person is told again, because the first link is now dead: only the newest
		// digest is on the row, so `second.token` is the only token that resolves and the
		// notification announcing the first one is a notification pointing nowhere.
		const notices = await test.db
			.select()
			.from(notificationTable)
			.where(eq(notificationTable.userId, invitee.id));
		expect(notices).toHaveLength(2);
		expect(new Set(notices.map((notice) => notice.dedupeKey)).size).toBe(2);

		// **The key names the mint, not the moment.** This is the assertion that pins it:
		// the newest notification is keyed by the digest the row now stores, which is fresh
		// on every issue. The first spelling of the key ended in the expiry's milliseconds,
		// and two re-issues in the same millisecond then produced one key — the unique index
		// failed the whole batch and the second invitation was never written, so the
		// merchant saw an error and the invitee kept a link that no longer resolved. That
		// failure is invisible in most runs, which is why it is asserted structurally rather
		// than left to whichever run happens to land in one millisecond.
		expect(notices.map((notice) => notice.dedupeKey)).toContain(
			`affiliation-invite:${first.membershipId}:${row?.inviteTokenHash}`,
		);

		test.close();
	});

	test("asks somebody back after they were removed, clearing the previous episode's dates", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF", {
			status: "REVOKED",
			revokedAt: new Date("2025-01-01T00:00:00Z"),
			acceptedAt: new Date("2024-01-01T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.id).toBe(invitation.membershipId);
		expect(row?.status).toBe("PENDING_USER_ACCEPTANCE");
		// The dates describe *episodes*, and this is a new one. A row that kept the old
		// `acceptedAt` would report somebody as having accepted a job they were removed
		// from, on a date that belongs to the previous relationship.
		expect(row?.acceptedAt).toBeNull();
		expect(row?.revokedAt).toBeNull();

		test.close();
	});

	test("only an owner may invite somebody as an owner", async () => {
		const { test, businessId, invitee } = await shop();
		const manager = await seedUser(test.db, { id: "usr_lifecycle_manager" });
		await seedMembership(test.db, manager.id, businessId, "MANAGER");

		const managerCaller = appRouter.createCaller(
			await authed(test, manager),
		) as Caller;

		// `staff:manage` belongs to MANAGER, so the capability is not the gate — the role
		// being granted is. Handing the business over is not a manager's decision.
		const failure = await refused(
			managerCaller.business.inviteAffiliate({
				businessId,
				email: invitee.email,
				role: "OWNER",
			}),
		);
		expect(failure.code).toBe("FORBIDDEN");

		// The same manager inviting a STAFF member is fine, which is what makes the test
		// about the role rather than about the caller.
		const allowed = await managerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});
		expect(allowed.role).toBe("STAFF");

		test.close();
	});

	test("is refused to somebody who is not a member of the shop", async () => {
		const { test, businessId, other, invitee, callerFor } = await shop();

		const otherCaller = await callerFor(other);
		const failure = await refused(
			otherCaller.business.inviteAffiliate({
				businessId,
				email: invitee.email,
				role: "STAFF",
			}),
		);

		expect(failure.code).toBe("FORBIDDEN");

		test.close();
	});
});

describe("resolving the link before there is a session", () => {
	test("answers the shop, the role and the inviter, and no email address", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "MANAGER",
		});

		// No session: this is the read the landing page makes before it can ask anybody to
		// sign in.
		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		const preview = await anonymous.identity.invitationPreview({
			token: invitation.token,
		});

		expect(preview.businessName).toBe("Café Central");
		expect(preview.businessSlug).toBe("cafe-central");
		expect(preview.role).toBe("MANAGER");
		expect(preview.invitedBy?.name).toBe(owner.name);
		expect(preview.acceptable).toBe(true);
		// The one field that would turn a leaked link into "which account is this for".
		expect(JSON.stringify(preview)).not.toContain(invitee.email);

		test.close();
	});

	test("answers NOT_FOUND for a token that names nothing", async () => {
		const { test } = await shop();
		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;

		const failure = await refused(
			anonymous.identity.invitationPreview({
				token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			}),
		);

		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});

	test("answers NOT_FOUND for a revoked invitation, so a prober learns nothing", async () => {
		const { test, businessId, invitee } = await shop();
		const { token, hash } = await mintInviteToken();
		await seedMembership(test.db, invitee.id, businessId, "STAFF", {
			status: "REVOKED",
			inviteTokenHash: hash,
		});

		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		const failure = await refused(
			anonymous.identity.invitationPreview({ token }),
		);

		// The alternative — "esta invitación fue revocada" for a real token and "no existe"
		// for a guessed one — is an oracle that tells a prober which of their guesses was a
		// real link.
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});

	test("says a lapsed invitation is not acceptable, without pretending it does not exist", async () => {
		const { test, businessId, invitee } = await shop();
		const { token, hash } = await mintInviteToken();
		await seedMembership(test.db, invitee.id, businessId, "STAFF", {
			status: "PENDING_USER_ACCEPTANCE",
			expiresAt: new Date(Date.now() - 1000),
			inviteTokenHash: hash,
		});

		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		const preview = await anonymous.identity.invitationPreview({ token });

		// `acceptable: false` is only ever reported for a row the token *does* name, which
		// is not a secret from the person holding the link — they are looking at a page that
		// tells them their invitation ran out.
		expect(preview.acceptable).toBe(false);
		expect(preview.businessName).toBe("Café Central");

		test.close();
	});

	test("stops working once the invitation is accepted, because the digest is cleared", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});
		const inviteeCaller = await callerFor(invitee);
		await inviteeCaller.affiliations.accept({
			invitationId: invitation.membershipId,
		});

		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		const failure = await refused(
			anonymous.identity.invitationPreview({ token: invitation.token }),
		);

		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});
});

describe("accepting", () => {
	test("activates the membership, clears the window, and records the act", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "MANAGER",
		});

		const inviteeCaller = await callerFor(invitee);
		const accepted = await inviteeCaller.affiliations.accept({
			invitationId: invitation.membershipId,
		});

		expect(accepted).toEqual({
			businessId,
			membershipId: invitation.membershipId,
		});

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("ACTIVE");
		expect(row?.acceptedAt).toBeInstanceOf(Date);
		// The window is over because the question was answered, and the digest is gone
		// because a live credential on a membership that is no longer an invitation is a
		// secret kept past its purpose.
		expect(row?.expiresAt).toBeNull();
		expect(row?.inviteTokenHash).toBeNull();

		expect(await auditActions(test, invitation.membershipId)).toEqual([
			"affiliation.invite",
			"affiliation.accept",
		]);

		test.close();
	});

	test("makes the shop appear in the switcher and disappear from the invitation list", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "MANAGER",
		});

		const inviteeCaller = await callerFor(invitee);
		await inviteeCaller.affiliations.accept({
			invitationId: invitation.membershipId,
		});

		// The caller was built *before* the acceptance, which is the point: `memberships`
		// is read per request, so the next request sees the new row. A test that built the
		// caller afterwards would not prove that.
		const nextCaller = await callerFor(invitee);
		const [switcher, pending] = await Promise.all([
			nextCaller.business.myBusinesses(),
			nextCaller.business.pendingInvitations(),
		]);

		expect(switcher.map((row) => row.businessId)).toEqual([businessId]);
		expect(pending).toEqual([]);

		test.close();
	});

	test("is refused to anybody but the person the invitation names", async () => {
		const { test, businessId, owner, invitee, other, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "MANAGER",
		});

		// The owner, who sent it, cannot accept it on the invitee's behalf. The row is read
		// by `user_id = ctx.user.id`, so holding the id is not holding the invitation.
		const ownerFailure = await refused(
			ownerCaller.affiliations.accept({ invitationId: invitation.membershipId }),
		);
		expect(ownerFailure.code).toBe("NOT_FOUND");

		// Nor can an unrelated account that guesses the id.
		const otherCaller = await callerFor(other);
		const otherFailure = await refused(
			otherCaller.affiliations.accept({ invitationId: invitation.membershipId }),
		);
		expect(otherFailure.code).toBe("NOT_FOUND");

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("PENDING_USER_ACCEPTANCE");

		test.close();
	});

	test("refuses a lapsed invitation and marks it expired on the way past", async () => {
		const { test, businessId, invitee, callerFor } = await shop();
		const membershipId = await seedMembership(
			test.db,
			invitee.id,
			businessId,
			"STAFF",
			{
				status: "PENDING_USER_ACCEPTANCE",
				expiresAt: new Date(Date.now() - 1000),
			},
		);

		const inviteeCaller = await callerFor(invitee);
		const failure = await refused(
			inviteeCaller.affiliations.accept({ invitationId: membershipId }),
		);

		expect(failure.code).toBe("CONFLICT");
		expect(failure.message).toContain("expiró");

		// The write that happens on a refusal. The caller has just tried to take up an
		// invitation that is over, and leaving the row saying `PENDING_USER_ACCEPTANCE`
		// would make every later reader recompute the same conclusion from the clock.
		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("EXPIRED");
		// No audit row: no capability moved, and "an invitation expired" would be attributed
		// to whoever happened to tap a button first.
		expect(await auditActions(test, membershipId)).toEqual([]);

		test.close();
	});

	test("cannot be done twice", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		const inviteeCaller = await callerFor(invitee);
		await inviteeCaller.affiliations.accept({
			invitationId: invitation.membershipId,
		});

		const failure = await refused(
			inviteeCaller.affiliations.accept({
				invitationId: invitation.membershipId,
			}),
		);
		// `NOT_FOUND` rather than a conflict, matching the read's shape: an invitation that
		// is not pending is not an invitation, and the second accept is not a second
		// activation.
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});

	test("cannot be done to an invitation the shop already withdrew", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});
		await ownerCaller.business.revokeAffiliation({
			businessId,
			userId: invitee.id,
			reason: "Ya no necesitamos el puesto",
		});

		const inviteeCaller = await callerFor(invitee);
		const failure = await refused(
			inviteeCaller.affiliations.accept({ invitationId: invitation.membershipId }),
		);
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});
});

describe("declining and leaving", () => {
	test("declining ends the invitation and needs no justification", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		const inviteeCaller = await callerFor(invitee);
		expect(await inviteeCaller.affiliations.decline({
			invitationId: invitation.membershipId,
		})).toEqual({ ok: true });

		const row = await membershipRow(test, invitee.id, businessId);
		// `REVOKED`, the single terminal state — the actor distinction lives in the audit
		// action, not in a status of its own.
		expect(row?.status).toBe("REVOKED");
		expect(row?.revokedAt).toBeInstanceOf(Date);
		expect(row?.inviteTokenHash).toBeNull();

		expect(await auditActions(test, invitation.membershipId)).toEqual([
			"affiliation.invite",
			"affiliation.decline",
		]);

		test.close();
	});

	test("leaving ends the membership, and the shop stays open", async () => {
		const { test, businessId, invitee } = await shop();
		const membershipId = await seedMembership(
			test.db,
			invitee.id,
			businessId,
			"MANAGER",
			{ acceptedAt: new Date("2025-06-01T00:00:00Z") },
		);

		const inviteeCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		expect(await inviteeCaller.affiliations.leave({ businessId })).toEqual({
			ok: true,
		});

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("REVOKED");
		expect(await auditActions(test, membershipId)).toEqual(["affiliation.leave"]);

		// Gone from the switcher, because the switcher reads `ACTIVE`.
		const nextCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		expect(await nextCaller.business.myBusinesses()).toEqual([]);

		test.close();
	});

	test("the last owner cannot leave, and a second owner makes it possible", async () => {
		const { test, businessId, owner, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const failure = await refused(
			ownerCaller.affiliations.leave({ businessId }),
		);

		// A shop nobody can administer is a state with no way out of it from the UI.
		expect(failure.code).toBe("CONFLICT");

		const secondOwner = await seedUser(test.db, { id: "usr_lifecycle_owner2" });
		await seedMembership(test.db, secondOwner.id, businessId, "OWNER");

		expect(await ownerCaller.affiliations.leave({ businessId })).toEqual({
			ok: true,
		});

		test.close();
	});

	test("the least powerful member can still leave, because leaving is not a capability", async () => {
		const { test, businessId, invitee } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "COURIER", {
			acceptedAt: new Date("2025-06-01T00:00:00Z"),
		});

		const caller = appRouter.createCaller(await authed(test, invitee)) as Caller;

		// The contrast is what gives this test its meaning: a rider holds none of the
		// capabilities the shop's operations are gated on, so a capability-gated procedure
		// refuses them outright.
		const failure = await refused(caller.business.staff({ businessId }));
		expect(failure.code).toBe("FORBIDDEN");

		// And they can still end their own membership. The gate is the membership itself, not a
		// permission borrowed from another part of the product - `orders:read` stood in for "any
		// member of this shop" until Phase 2's review, and a rider is the member that makes the
		// difference visible.
		expect(await caller.affiliations.leave({ businessId })).toEqual({ ok: true });
		expect((await membershipRow(test, invitee.id, businessId))?.status).toBe(
			"REVOKED",
		);

		test.close();
	});

	test("refuses a stranger and a membership that already ended, with one answer", async () => {
		const { test, businessId, invitee, other } = await shop();
		const membershipId = await seedMembership(
			test.db,
			invitee.id,
			businessId,
			"STAFF",
			{
				status: "REVOKED",
				revokedAt: new Date("2025-03-01T00:00:00Z"),
			},
		);

		const removedCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		const strangerCaller = appRouter.createCaller(
			await authed(test, other),
		) as Caller;

		// Three ways to have no membership of this shop, one answer: the read is by
		// `(businessId, user_id, status = ACTIVE)`, so `orNotFound` cannot tell "removed last
		// month" from "never asked" from "that id is somebody else's shop" apart - which is what
		// keeps a resignation from being a probe for which businesses exist.
		const removed = await refused(removedCaller.affiliations.leave({ businessId }));
		const stranger = await refused(strangerCaller.affiliations.leave({ businessId }));
		const absent = await refused(
			strangerCaller.affiliations.leave({ businessId: "biz_lifecycle_absent" }),
		);

		expect(removed.code).toBe("NOT_FOUND");
		expect(stranger.code).toBe("NOT_FOUND");
		expect(absent.code).toBe("NOT_FOUND");

		// And a refusal wrote nothing: a stale client's button is not a resignation, and the
		// date on the row is still the one the shop's own revocation put there.
		expect(
			(await membershipRow(test, invitee.id, businessId))?.revokedAt?.getTime(),
		).toBe(new Date("2025-03-01T00:00:00Z").getTime());
		expect(await auditActions(test, membershipId)).toEqual([]);

		test.close();
	});
});

describe("the shop removing somebody", () => {
	test("revokes the membership, records the reason, and takes the capability with it", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		const membershipId = await seedMembership(
			test.db,
			invitee.id,
			businessId,
			"STAFF",
			{ acceptedAt: new Date("2025-06-01T00:00:00Z") },
		);

		const ownerCaller = await callerFor(owner);
		await ownerCaller.business.revokeAffiliation({
			businessId,
			userId: invitee.id,
			reason: "Se llevó producto sin registrar",
		});

		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("REVOKED");
		expect(row?.revokedAt).toBeInstanceOf(Date);

		const entries = await test.db
			.select()
			.from(auditLogTable)
			.where(eq(auditLogTable.targetId, membershipId));
		expect(entries.map((entry) => entry.action)).toEqual(["affiliation.revoke"]);
		// The reason lives in `meta`, which is the column's own shape: the audit row is
		// `(actor, action, target)` plus one JSON payload holding the before/after pair and
		// the justification, so the record of *why* travels with the record of *what*.
		expect(
			(entries[0]?.meta as { reason: string | null } | null)?.reason,
		).toBe("Se llevó producto sin registrar");

		// And the capability is gone, which is the whole point of the act.
		const nextCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		const forbidden = await refused(nextCaller.business.staff({ businessId }));
		expect(forbidden.code).toBe("FORBIDDEN");

		test.close();
	});

	test("requires a reason, because a person loses something", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF");

		const ownerCaller = await callerFor(owner);

		// Two gates, and this action is guarded by the *wire* one rather than by
		// `requireReason`: `affiliationRevokeInput.reason` is `z.string().trim().min(1)`, so a
		// blank never reaches the service. That is the right place for it here — the console
		// must not be able to send one — and it is asserted rather than assumed, because the
		// failure mode of a relaxed schema is silence.
		await expect(
			ownerCaller.business.revokeAffiliation({
				businessId,
				userId: invitee.id,
				reason: "   ",
			}),
		).rejects.toThrow();

		// And the contract that makes the schema's strictness meaningful: this action is in
		// the platform's list of acts that require a justification, which is also what the
		// console reads to decide whether to ask for one. Removing it from the list while
		// leaving the schema in place would be a silent policy change.
		expect(REASON_REQUIRED_ACTIONS).toContain("affiliation.revoke");

		// Nothing moved, which is the point of a refusal.
		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("ACTIVE");

		test.close();
	});

	test("is refused to a manager, and to the person being removed", async () => {
		const { test, businessId, owner, invitee } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF");
		const manager = await seedUser(test.db, { id: "usr_lifecycle_mgr2" });
		await seedMembership(test.db, manager.id, businessId, "MANAGER");

		const managerCaller = appRouter.createCaller(
			await authed(test, manager),
		) as Caller;
		// `staff:manage` is MANAGER's, so the capability is not the gate: deciding who no
		// longer works here is not a call a manager may be on the receiving end of.
		const managerFailure = await refused(
			managerCaller.business.revokeAffiliation({
				businessId,
				userId: invitee.id,
				reason: "Motivo",
			}),
		);
		expect(managerFailure.code).toBe("FORBIDDEN");

		// And the person cannot revoke themselves through this door — `affiliations.leave`
		// is theirs, which is a different act with a different audit action.
		const inviteeCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		const selfFailure = await refused(
			inviteeCaller.business.revokeAffiliation({
				businessId,
				userId: owner.id,
				reason: "Motivo",
			}),
		);
		expect(selfFailure.code).toBe("FORBIDDEN");

		test.close();
	});

	test("withdrawing a lapsed invitation writes EXPIRED, not REVOKED", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		const membershipId = await seedMembership(
			test.db,
			invitee.id,
			businessId,
			"STAFF",
			{
				status: "PENDING_USER_ACCEPTANCE",
				expiresAt: new Date(Date.now() - 86_400_000),
			},
		);

		const ownerCaller = await callerFor(owner);
		await ownerCaller.business.revokeAffiliation({
			businessId,
			userId: invitee.id,
			reason: "La vacante se cerró",
		});

		// Withdrawing an offer that had already run out is not a decision the shop made about
		// a person; it is the shop tidying up after a window that closed on its own, and
		// recording it as a revocation would put the shop's own name on an ending it did not
		// cause. `revoked_at` is still written, because somebody did close the row.
		const row = await membershipRow(test, invitee.id, businessId);
		expect(row?.status).toBe("EXPIRED");
		expect(row?.revokedAt).toBeInstanceOf(Date);
		expect(await auditActions(test, membershipId)).toEqual([
			"affiliation.revoke",
		]);

		test.close();
	});

	test("cannot remove the last owner", async () => {
		const { test, businessId, owner } = await shop();
		const manager = await seedUser(test.db, { id: "usr_lifecycle_mgr3" });
		await seedMembership(test.db, manager.id, businessId, "MANAGER");

		const managerCaller = appRouter.createCaller(
			await authed(test, manager),
		) as Caller;
		// A manager cannot even reach the call, so this is asserted with the owner's own
		// caller against their own row — the guard, not the permission.
		expect(manager).toBeTruthy();
		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const failure = await refused(
			ownerCaller.business.revokeAffiliation({
				businessId,
				userId: owner.id,
				reason: "Motivo",
			}),
		);
		expect(failure.code).toBe("CONFLICT");

		test.close();
	});

	test("already-over memberships answer NOT_FOUND rather than succeeding twice", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF", {
			status: "REVOKED",
			revokedAt: new Date(),
		});

		const ownerCaller = await callerFor(owner);
		const failure = await refused(
			ownerCaller.business.revokeAffiliation({
				businessId,
				userId: invitee.id,
				reason: "Motivo",
			}),
		);

		// A response that said it succeeded would make "did this work" unanswerable.
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});
});

describe("the shop's affiliation ledger", () => {
	test("lists every state, newest first, with expiry computed at read time", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		const pending = await seedUser(test.db, { id: "usr_lifecycle_pending" });
		const lapsed = await seedUser(test.db, { id: "usr_lifecycle_lapsed" });

		await seedMembership(test.db, invitee.id, businessId, "STAFF", {
			status: "REVOKED",
			revokedAt: new Date("2025-03-01T00:00:00Z"),
			createdAt: new Date("2025-02-01T00:00:00Z"),
		});
		// The fixture's owner joined "now", and a list ordered by `created_at` would put them
		// at the top. Four distinguishable dates are what this test is about, so the owner is
		// backdated rather than left to sort by wall clock.
		await test.db
			.update(membershipTable)
			.set({ createdAt: new Date("2025-01-01T00:00:00Z") })
			.where(
				and(
					eq(membershipTable.userId, owner.id),
					eq(membershipTable.businessId, businessId),
				),
			);
		await seedMembership(test.db, pending.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: owner.id,
			expiresAt: new Date(Date.now() + 86_400_000),
			createdAt: new Date("2025-04-01T00:00:00Z"),
		});
		await seedMembership(test.db, lapsed.id, businessId, "STAFF", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: owner.id,
			expiresAt: new Date(Date.now() - 86_400_000),
			createdAt: new Date("2025-05-01T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		const { rows } = await ownerCaller.business.affiliations({ businessId });

		expect(rows.map((row) => row.userId)).toEqual([
			lapsed.id,
			pending.id,
			invitee.id,
			owner.id,
		]);
		expect(rows.map((row) => row.status)).toEqual([
			"PENDING_USER_ACCEPTANCE",
			"PENDING_USER_ACCEPTANCE",
			"REVOKED",
			"ACTIVE",
		]);
		// The clock's answer, and only about pending rows: an `ACTIVE` membership has a null
		// window because acceptance clears it, so asking `acceptableAt` about one would
		// answer `false` and every employee would read as expired.
		expect(rows.map((row) => row.expired)).toEqual([true, false, false, false]);
		expect(rows[1]?.invitedBy?.name).toBe(owner.name);

		test.close();
	});

	test("filters by status when asked", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF", {
			status: "REVOKED",
			revokedAt: new Date(),
		});

		const ownerCaller = await callerFor(owner);
		const { rows } = await ownerCaller.business.affiliations({
			businessId,
			status: "PENDING_USER_ACCEPTANCE",
		});

		expect(rows).toEqual([]);

		test.close();
	});

	test("is refused to a staff member, because it names every removed employee", async () => {
		const { test, businessId, invitee } = await shop();
		await seedMembership(test.db, invitee.id, businessId, "STAFF");

		const inviteeCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		const failure = await refused(
			inviteeCaller.business.affiliations({ businessId }),
		);

		expect(failure.code).toBe("FORBIDDEN");

		test.close();
	});

	test("never leaks the invitation digest", async () => {
		const { test, businessId, owner, invitee, callerFor } = await shop();

		const ownerCaller = await callerFor(owner);
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});
		const { rows } = await ownerCaller.business.affiliations({ businessId });

		// The row carries the membership id, which the shop already knows, and nothing that
		// would let a reader reconstruct the link. `invite_token_hash` is not a wire field
		// and this is the assertion that keeps it that way.
		expect(JSON.stringify(rows)).not.toContain(invitation.token);
		expect(JSON.stringify(rows)).not.toContain("sha256");

		test.close();
	});
});

describe("what an invitation costs the shop", () => {
	test("an invitation spends no seat, and acceptance is where the cap binds", async () => {
		// `EMPRENDE` allows two staff accounts, and the owner holds one. Two invitations are
		// sent, and **both are allowed** — a pending row counts against no limit, which is
		// the rule and not an oversight. The cap binds when the second person accepts, and
		// that is the moment the seat is actually spent.
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_lifecycle_seats",
			plan: "EMPRENDE",
		});
		const owner = await seedUser(test.db, { id: "usr_lifecycle_seat_owner" });
		await seedMembership(test.db, owner.id, businessId, "OWNER");

		const first = await seedUser(test.db, {
			id: "usr_lifecycle_seat_one",
			email: "uno@example.test",
		});
		const second = await seedUser(test.db, {
			id: "usr_lifecycle_seat_two",
			email: "dos@example.test",
		});

		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const one = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: first.email,
			role: "STAFF",
		});
		const two = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: second.email,
			role: "STAFF",
		});

		const firstCaller = appRouter.createCaller(
			await authed(test, first),
		) as Caller;
		await firstCaller.affiliations.accept({ invitationId: one.membershipId });

		const secondCaller = appRouter.createCaller(
			await authed(test, second),
		) as Caller;
		const full = await refused(
			secondCaller.affiliations.accept({ invitationId: two.membershipId }),
		);

		// A quota refusal is a `ForbiddenError` carrying `QUOTA_EXCEEDED` in its details
		// rather than a code of its own: the request was well-formed and the answer is "not
		// on this plan".
		expect(full.code).toBe("FORBIDDEN");
		expect((full.details as { error: string }).error).toBe("QUOTA_EXCEEDED");

		// The invitation is **untouched**. Unlike a lapsed one, a full shop is a fact the
		// merchant can change, so the invitation must survive the refusal and become
		// acceptable the moment the plan does.
		const stillPending = await membershipRow(test, second.id, businessId);
		expect(stillPending?.status).toBe("PENDING_USER_ACCEPTANCE");
		expect(stillPending?.inviteTokenHash).not.toBeNull();

		test.close();
	});

	test("the refused invitation becomes acceptable once the shop moves up a plan", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_lifecycle_upgrade",
			plan: "EMPRENDE",
		});
		const owner = await seedUser(test.db, { id: "usr_lifecycle_up_owner" });
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		const invitee = await seedUser(test.db, {
			id: "usr_lifecycle_up_invitee",
			email: "sube@example.test",
		});
		const colleague = await seedUser(test.db, {
			id: "usr_lifecycle_up_colleague",
			email: "colega@example.test",
		});

		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const colleagueInvite = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: colleague.email,
			role: "STAFF",
		});
		const inviteeInvite = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		const colleagueCaller = appRouter.createCaller(
			await authed(test, colleague),
		) as Caller;
		await colleagueCaller.affiliations.accept({
			invitationId: colleagueInvite.membershipId,
		});

		const inviteeCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		const refusedOnce = await refused(
			inviteeCaller.affiliations.accept({
				invitationId: inviteeInvite.membershipId,
			}),
		);
		expect(refusedOnce.code).toBe("FORBIDDEN");

		// The upgrade, written directly because `subscription.change` is a different
		// subsystem's path and this test is about what the invitation does afterwards.
		await test.db
			.update(businessTable)
			.set({ plan: "BUSINESS" })
			.where(eq(businessTable.id, businessId));

		expect(
			await inviteeCaller.affiliations.accept({
				invitationId: inviteeInvite.membershipId,
			}),
		).toEqual({ businessId, membershipId: inviteeInvite.membershipId });

		test.close();
	});

	test("a rider holds no seat, so an invitation fits beside one", async () => {
		// `staffAccounts` counts **employees**. A courier is a membership of the shop and
		// not one of its staff, which is the population `inviteStaff` counts and the one this
		// check must measure — two counts that disagree would make the cap depend on which
		// path asked.
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_lifecycle_rider",
			plan: "EMPRENDE",
		});
		const owner = await seedUser(test.db, { id: "usr_lifecycle_rider_owner" });
		const rider = await seedUser(test.db, { id: "usr_lifecycle_rider" });
		const invitee = await seedUser(test.db, {
			id: "usr_lifecycle_rider_invitee",
			email: "junto_a_rider@example.test",
		});
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		await seedMembership(test.db, rider.id, businessId, "COURIER");

		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const invitation = await ownerCaller.business.inviteAffiliate({
			businessId,
			email: invitee.email,
			role: "STAFF",
		});

		// One seat is held (the owner), the cap is two, and the rider does not change that.
		const inviteeCaller = appRouter.createCaller(
			await authed(test, invitee),
		) as Caller;
		expect(
			await inviteeCaller.affiliations.accept({
				invitationId: invitation.membershipId,
			}),
		).toEqual({ businessId, membershipId: invitation.membershipId });

		test.close();
	});
});
