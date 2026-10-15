import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import { resolveProfileIdentity } from "../src/services/identity";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

/**
 * A `PENDING_USER_ACCEPTANCE` membership is an invitation, and an invitation grants
 * nothing.
 *
 * That sentence is the whole feature, and every clause of it is a separate way to get
 * it wrong: shown in the switcher (a shop you are not in), accepted by
 * `businessProcedure` (a capability you did not accept), counted against the plan's
 * seats (a paid resource spent on nobody), drawn as a badge (a claim about a
 * relationship that does not exist), or usable as an identity scope (an affiliation
 * minted from an unanswered message). Each of the six is a test below, and they are
 * asserted against the **router** rather than the service wherever a permission is
 * involved, because the middleware is where the capability boundary actually lives.
 *
 * The mirror is worth stating: the same setup with `ACTIVE` in place of
 * `PENDING_USER_ACCEPTANCE` must make every one of these do the opposite. Two of the
 * tests below check that, so a filter that simply dropped every membership — the
 * cheapest way to make the first six pass — would fail here instead.
 */

/**
 * Everything one case needs, seeded once.
 *
 * The shop is seeded here rather than patched afterwards, because `seedBusiness`
 * inserts and a second call for the same id is a primary-key failure. The verification
 * state is a parameter so a case that needs a *verified* shop gets one that was written
 * verified, rather than one that was written plain and then updated — a fixture that
 * could reach a state the product cannot produce is a fixture that proves nothing about
 * the product.
 */
async function invitation(
	overrides: {
		verificationStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
		verificationLevel?: "NONE" | "BUSINESS";
		plan?: "FREE" | "EMPRENDE" | "STARTER" | "GROWTH" | "BUSINESS";
	} = {},
) {
	const test = world();
	const businessId = await seedBusiness(test.db, {
		id: "biz_affiliation_shop",
		name: "Café Central",
		slug: "cafe-central",
		verificationStatus: overrides.verificationStatus,
		verificationLevel: overrides.verificationLevel,
		verifiedAt: overrides.verificationStatus === "APPROVED" ? new Date() : null,
		plan: overrides.plan,
	});
	const owner = await seedUser(test.db, { id: "usr_affiliation_owner" });
	const invited = await seedUser(test.db, {
		id: "usr_affiliation_invited",
		name: "Persona Invitada",
	});
	await seedMembership(test.db, owner.id, businessId, "OWNER");

	const callerFor = async (user: typeof owner) =>
		appRouter.createCaller(await authed(test, user)) as Caller;

	return { test, businessId, owner, invited, callerFor };
}

describe("a pending invitation grants nothing", () => {
	test("it is absent from the business switcher", async () => {
		const { test, businessId, invited, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: "usr_affiliation_owner",
			expiresAt: new Date(Date.now() + 86_400_000),
		});

		const invitedCaller = await callerFor(invited);
		expect(await invitedCaller.business.myBusinesses()).toEqual([]);

		test.close();
	});

	test("it appears in `pendingInvitations`, and nowhere else", async () => {
		const { test, businessId, invited, callerFor } = await invitation();
		const expiresAt = new Date(Date.now() + 86_400_000);
		const membershipId = await seedMembership(
			test.db,
			invited.id,
			businessId,
			"MANAGER",
			{
				status: "PENDING_USER_ACCEPTANCE",
				invitedByUserId: "usr_affiliation_owner",
				expiresAt,
			},
		);

		const invitedCaller = await callerFor(invited);
		const [switcher, pending] = await Promise.all([
			invitedCaller.business.myBusinesses(),
			invitedCaller.business.pendingInvitations(),
		]);

		expect(switcher).toEqual([]);
		expect(pending).toEqual([
			{
				id: membershipId,
				businessId,
				businessSlug: "cafe-central",
				businessName: "Café Central",
				businessLogoUrl: null,
				role: "MANAGER",
				invitedBy: {
					id: "usr_affiliation_owner",
					name: "Cliente de Prueba",
					image: null,
				},
				expiresAt,
				createdAt: expect.any(Date),
			},
		]);

		test.close();
	});

	test("`pendingInvitations` is empty for somebody whose memberships are all active", async () => {
		const { test, businessId, invited, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "STAFF");

		const invitedCaller = await callerFor(invited);
		expect(await invitedCaller.business.pendingInvitations()).toEqual([]);

		test.close();
	});

	test("it confers no capability — `businessProcedure` refuses it", async () => {
		const { test, businessId, invited, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "OWNER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: "usr_affiliation_owner",
		});

		const invitedCaller = await callerFor(invited);

		// The role is `OWNER` on purpose: the row is as powerful as a membership can
		// be, and the *status* is the only thing standing between this caller and the
		// shop. A test that used `STAFF` could pass on `roleCan` alone.
		const forbidden = await refused(
			invitedCaller.business.staff({ businessId }),
		);
		expect(forbidden.code).toBe("FORBIDDEN");

		test.close();
	});

	test("it is not an identity scope, so it produces no affiliation badge", async () => {
		const { test, businessId, invited } = await invitation({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
		});
		await seedMembership(test.db, invited.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: "usr_affiliation_owner",
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "person", userId: invited.id },
			{ scopeBusinessId: businessId },
		);

		expect(identity.affiliation).toEqual({ status: "NONE", business: null });
		expect(identity.display.affiliationBadge).toBe(false);
		expect(identity.display.avatarShape).toBe("circle");

		test.close();
	});

	test("it is invisible to the staff list it would be part of", async () => {
		const { test, businessId, invited, owner, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "STAFF", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: owner.id,
		});

		const ownerCaller = await callerFor(owner);
		const staff = await ownerCaller.business.staff({ businessId });

		expect(staff.map((member) => member.userId)).toEqual([owner.id]);

		test.close();
	});

	test("a pending row is not counted against the plan's seats", async () => {
		// `EMPRENDE` allows two staff accounts. The owner holds one, so a second
		// invitation fits — *unless* the pending row is counted, in which case the
		// shop is at its cap and this is a `QUOTA_EXCEEDED`. That difference is the
		// whole assertion.
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_affiliation_seats",
			plan: "EMPRENDE",
		});
		const owner = await seedUser(test.db, { id: "usr_affiliation_seat_owner" });
		const invited = await seedUser(test.db, {
			id: "usr_affiliation_seat_invited",
		});
		const candidate = await seedUser(test.db, {
			id: "usr_affiliation_seat_candidate",
			email: "candidata@example.test",
		});
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		await seedMembership(test.db, invited.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: owner.id,
		});

		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const added = await ownerCaller.business.inviteStaff({
			businessId,
			email: candidate.email,
			role: "STAFF",
		});

		expect(added.userId).toBe(candidate.id);
		expect(added.role).toBe("STAFF");

		test.close();
	});

	test("an invitation outlives the person who sent it", async () => {
		const { test, businessId, invited, owner, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: owner.id,
		});

		// `invited_by_user_id` is `on delete set null`, so the invitation stands and
		// simply loses its attribution. A client draws the row without a name rather
		// than failing to draw it — which is why the field is nullable rather than
		// optional in the shared schema.
		test.sqlite.prepare("delete from user where id = ?").run(owner.id);

		const invitedCaller = await callerFor(invited);
		const pending = await invitedCaller.business.pendingInvitations();

		expect(pending).toHaveLength(1);
		expect(pending[0]?.invitedBy).toBeNull();
		expect(pending[0]?.businessName).toBe("Café Central");

		test.close();
	});
});

describe("the same setup, accepted", () => {
	test("an active membership is in the switcher and out of the invitation list", async () => {
		const { test, businessId, invited, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "MANAGER");

		const invitedCaller = await callerFor(invited);
		const [switcher, pending] = await Promise.all([
			invitedCaller.business.myBusinesses(),
			invitedCaller.business.pendingInvitations(),
		]);

		expect(switcher).toEqual([
			{
				businessId,
				businessName: "Café Central",
				businessSlug: "cafe-central",
				logoUrl: null,
				role: "MANAGER",
			},
		]);
		expect(pending).toEqual([]);

		test.close();
	});

	test("an active membership in a verified shop is badged", async () => {
		const { test, businessId, invited } = await invitation({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
		});
		await seedMembership(test.db, invited.id, businessId, "MANAGER");

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "person", userId: invited.id },
			{ scopeBusinessId: businessId },
		);

		expect(identity.affiliation.status).toBe("ACTIVE");
		expect(identity.display.affiliationBadge).toBe(true);

		test.close();
	});

	test("an active membership is a capability", async () => {
		const { test, businessId, invited, callerFor } = await invitation();
		await seedMembership(test.db, invited.id, businessId, "MANAGER");

		const invitedCaller = await callerFor(invited);
		const staff = await invitedCaller.business.staff({ businessId });

		expect(staff.map((member) => member.userId)).toContain(invited.id);

		test.close();
	});
});
