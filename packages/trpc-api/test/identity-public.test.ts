import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import {
	authed,
	contextFor,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	seedVerificationRequest,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

/**
 * The two identity procedures, at the surface a client actually calls.
 *
 * `identity.test.ts` proves the *rules* — `deriveDisplay`, `effectiveVerification`, the scope
 * condition — by calling the resolver directly. This file proves the **procedures**: that
 * `identity.profile` is reachable without a session and answers only about shops the
 * marketplace already shows, that `identity.mine` is reachable only with one, and that what
 * comes back over the wire carries nothing that belongs to a reviewer.
 *
 * ## Why the wire is checked again, after the service was
 *
 * A resolver that returns a safe object proves the resolver is safe. It does not prove that
 * the *router* returns it: a procedure that spread its input into the output, or a serializer
 * that added a field, would pass every service-level test in the suite. So the assertions
 * here are made on `JSON.stringify` of what the caller received, which is the only artefact
 * that cannot be fooled by a type.
 *
 * ## The one rule `identity.profile` deliberately does not have
 *
 * A shop's public profile carries **no primary affiliation**. The subject of the read is the
 * shop, and "which of its members is the face of it" is a question the product has not
 * answered — a shop is not a person, and picking the owner would be inventing an answer. The
 * affiliation half of the shape is therefore always the null one, and it is asserted rather
 * than left to the resolver's default.
 */

/** A shop in a given state, with an owner, and a caller factory. */
async function shop(overrides: {
	id: string;
	slug: string;
	status?: "ACTIVE" | "CLOSED" | "DRAFT" | "SUSPENDED";
	verificationStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
	verificationLevel?: "NONE" | "BUSINESS";
	verifiedAt?: Date | null;
	verificationExpiresAt?: Date | null;
}) {
	const test = world();
	const businessId = await seedBusiness(test.db, {
		id: overrides.id,
		slug: overrides.slug,
		name: "Comercial El Roble",
		status: overrides.status ?? "ACTIVE",
		verificationStatus: overrides.verificationStatus ?? "NONE",
		verificationLevel: overrides.verificationLevel ?? "NONE",
		verifiedAt: overrides.verifiedAt ?? null,
		verificationExpiresAt: overrides.verificationExpiresAt ?? null,
	});
	const owner = await seedUser(test.db, { id: `usr_${overrides.id}` });
	await seedMembership(test.db, owner.id, businessId, "OWNER");

	return {
		test,
		businessId,
		owner,
		anonymous: appRouter.createCaller(await contextFor(test, null)) as Caller,
		callerFor: async (user: typeof owner) =>
			appRouter.createCaller(await authed(test, user)) as Caller,
	};
}

describe("a shop's public profile", () => {
	test("answers without a session, because a badge deep-links to it", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_open",
			slug: "comercial-el-roble",
		});

		// The landing page a storefront badge links to has no session to offer. A profile
		// read that demanded one would be a badge nobody could click.
		const profile = await anonymous.identity.profile({
			slug: "comercial-el-roble",
		});

		expect(profile.accountType).toBe("BUSINESS");
		expect(profile.verification).toEqual({
			status: "NONE",
			level: "NONE",
			verifiedAt: null,
		});
		expect(profile.display).toEqual({
			avatarShape: "circle",
			profileBadge: "none",
			affiliationBadge: false,
		});

		test.close();
	});

	test("draws the badge and the shape only for a live approval", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_verified",
			slug: "roble-verificado",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});

		const profile = await anonymous.identity.profile({ slug: "roble-verificado" });

		// The two read-time derivations, together: the record says APPROVED and the drawing
		// follows from it, with nothing stored about either.
		expect(profile.verification.status).toBe("APPROVED");
		expect(profile.verification.level).toBe("BUSINESS");
		expect(profile.display.profileBadge).toBe("verifiedBusiness");
		expect(profile.display.avatarShape).toBe("roundedSquare");

		test.close();
	});

	test("collapses a lapsed approval, so the storefront and the profile agree", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_lapsed",
			slug: "roble-vencido",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2024-01-01T00:00:00Z"),
			verificationExpiresAt: new Date("2025-01-01T00:00:00Z"),
		});

		const profile = await anonymous.identity.profile({ slug: "roble-vencido" });

		// `verifiedAt` is null beside a status that is not a live APPROVED — the Phase 2
		// tightening: a date describing an approval that no longer holds is the one field a
		// reader would quote back as proof.
		expect(profile.verification).toEqual({
			status: "NONE",
			level: "NONE",
			verifiedAt: null,
		});
		expect(profile.display.profileBadge).toBe("none");
		expect(profile.display.avatarShape).toBe("circle");

		test.close();
	});

	test("carries no affiliation, because a shop is not a person", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_affil",
			slug: "roble-sin-filiacion",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});

		const profile = await anonymous.identity.profile({ slug: "roble-sin-filiacion" });

		// "Which of this shop's members is the face of it" is a question the product has not
		// answered. The scope-aware reading is reachable only through `identity.mine`, where
		// the person asking is a member of the shop they are asking about.
		//
		// The null *affiliation* is `{status: "NONE", business: null}` on the wire rather than
		// a JSON `null`: the field is not absent, it is the shape's own way of saying there is
		// nothing to report — which is why the resolver hands `deriveDisplay` a separate,
		// internal `null` and the permissive reading is unreachable from outside.
		expect(profile.affiliation).toEqual({ status: "NONE", business: null });

		test.close();
	});

	test("is NOT_FOUND for a shop the marketplace does not show", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_draft",
			slug: "roble-borrador",
			status: "DRAFT",
		});
		await seedBusiness(test.db, {
			id: "biz_pub_suspended",
			slug: "roble-suspendido",
			status: "SUSPENDED",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});

		const draft = await refused(
			anonymous.identity.profile({ slug: "roble-borrador" }),
		);
		expect(draft.code).toBe("NOT_FOUND");

		// The interesting half: this shop has a **live approval** and is still invisible. A
		// read that resolved the identity first and filtered afterwards would answer — and
		// would leak the existence of a suspended shop along with its badge.
		const suspended = await refused(
			anonymous.identity.profile({ slug: "roble-suspendido" }),
		);
		expect(suspended.code).toBe("NOT_FOUND");

		test.close();
	});

	test("is NOT_FOUND for a slug that names nothing, rather than an empty shape", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_unknown",
			slug: "roble-conocido",
		});

		const failure = await refused(
			anonymous.identity.profile({ slug: "no-existe-esta-tienda" }),
		);
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});

	test("rejects a slug that is not a slug, before the database is consulted", async () => {
		const { test, anonymous } = await shop({
			id: "biz_pub_badslug",
			slug: "roble-slug-malo",
		});

		// The wire schema's pattern is the first gate; a slug with spaces never becomes a
		// query. Asserted because the failure mode of a relaxed pattern is a scan.
		await expect(
			anonymous.identity.profile({ slug: "no es un slug" }),
		).rejects.toThrow();

		test.close();
	});

	test("carries none of the evidence the application was reviewed on", async () => {
		const { test, anonymous, businessId, owner } = await shop({
			id: "biz_pub_private",
			slug: "roble-privado",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		await seedVerificationRequest(test.db, {
			id: "bvr_pub_private",
			businessId,
			submittedByUserId: owner.id,
			status: "APPROVED",
			legalName: "Comercial El Roble Sociedad Anónima",
			country: "CR",
			taxId: "3-101-987654",
			supportEmail: "facturacion@elroble.cr",
			domain: "elroble.cr",
			domainEvidenceUrl: "https://elroble.cr/registro",
			documents: ["upl_pub_patente"],
			reviewNote: "Cotejado con el registro nacional",
			decisionReason: "Todo en orden",
			reviewedAt: new Date("2026-01-02T00:00:00Z"),
		});

		const profile = await anonymous.identity.profile({ slug: "roble-privado" });
		const wire = JSON.stringify(profile);

		// Each of these is a real column on a real row, and each would be a different kind of
		// harm on a public profile: the tax id is an identity-theft ingredient, the legal
		// name is not the trading name the shop chose to publish, the support address is an
		// internal contact, the documents are the applicant's own uploads, and the reviewer's
		// note is a private opinion about a merchant.
		expect(wire).not.toContain("3-101-987654");
		expect(wire).not.toContain("Comercial El Roble Sociedad Anónima");
		expect(wire).not.toContain("facturacion@elroble.cr");
		expect(wire).not.toContain("elroble.cr");
		expect(wire).not.toContain("upl_pub_patente");
		expect(wire).not.toContain("Cotejado con el registro");
		expect(wire).not.toContain("usr_biz_pub_private");

		// And the shape has no field that could hold any of them, which is the stronger
		// claim: the leak is prevented by the shape rather than by the serializer.
		expect(Object.keys(profile).sort()).toEqual([
			"accountType",
			"affiliation",
			"display",
			"verification",
		]);

		test.close();
	});
});

describe("who the caller is", () => {
	test("needs a session, unlike the shop read beside it", async () => {
		const { test, anonymous } = await shop({
			id: "biz_mine_anon",
			slug: "roble-anonimo",
		});

		// The two procedures sit in one router and differ in exactly this: a stranger may ask
		// about a shop and may not ask about a person.
		await expect(anonymous.identity.mine()).rejects.toThrow();

		test.close();
	});

	test("answers a person with no shop as an individual, and nothing attached", async () => {
		const { test, callerFor } = await shop({
			id: "biz_mine_empty",
			slug: "roble-vacio",
		});
		const customer = await seedUser(test.db, { id: "usr_mine_customer" });

		const caller = await callerFor(customer);
		const mine = await caller.identity.mine();

		expect(mine.identity.accountType).toBe("INDIVIDUAL");
		expect(mine.identity.verification).toEqual({
			status: "NONE",
			level: "NONE",
			verifiedAt: null,
		});
		// A person's avatar is always a circle and their own badge is always `none`: the
		// badge belongs to the shop, and the person carries it as an affiliation.
		expect(mine.identity.display).toEqual({
			avatarShape: "circle",
			profileBadge: "none",
			affiliationBadge: false,
		});
		expect(mine.affiliations).toEqual([]);
		expect(mine.pendingInvitations).toEqual([]);

		test.close();
	});

	test("lists every shop the caller may act for, with the badge each one grants", async () => {
		const { test, callerFor, businessId: verifiedId } = await shop({
			id: "biz_mine_verified",
			slug: "roble-verificado-dos",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const plainId = await seedBusiness(test.db, {
			id: "biz_mine_plain",
			slug: "roble-simple",
			name: "Ferretería La Unión",
		});
		const member = await seedUser(test.db, { id: "usr_mine_multi" });
		await seedMembership(test.db, member.id, verifiedId, "MANAGER");
		await seedMembership(test.db, member.id, plainId, "STAFF");

		const caller = await callerFor(member);
		const mine = await caller.identity.mine();

		// Both shops are usable — the switcher's list — and the badge is a per-row fact,
		// because a person working at one verified and one unverified shop is exactly the
		// case a single boolean on the person could not express.
		expect(mine.affiliations.map((row) => row.businessSlug).sort()).toEqual([
			"roble-simple",
			"roble-verificado-dos",
		]);
		const bySlug = new Map(
			mine.affiliations.map((row) => [row.businessSlug, row.affiliationBadge]),
		);
		expect(bySlug.get("roble-verificado-dos")).toBe(true);
		expect(bySlug.get("roble-simple")).toBe(false);

		test.close();
	});

	test("does not badge an affiliation with a lapsed shop", async () => {
		const { test, callerFor, businessId } = await shop({
			id: "biz_mine_lapsed",
			slug: "roble-vencido-dos",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2024-01-01T00:00:00Z"),
			verificationExpiresAt: new Date("2025-01-01T00:00:00Z"),
		});
		const member = await seedUser(test.db, { id: "usr_mine_lapsed" });
		await seedMembership(test.db, member.id, businessId, "STAFF");

		const caller = await callerFor(member);
		const mine = await caller.identity.mine({ scopeBusinessId: businessId });

		// The affiliation is real and the badge is not: the window closed, and `deriveDisplay`
		// asks about it on every read rather than trusting a stored boolean.
		expect(mine.affiliations[0]?.affiliationBadge).toBe(false);
		expect(mine.identity.display.affiliationBadge).toBe(false);

		test.close();
	});

	test("badges only the scope, because the switcher's selection is the one being drawn", async () => {
		const { test, callerFor, businessId: first } = await shop({
			id: "biz_mine_first",
			slug: "roble-uno",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const second = await seedBusiness(test.db, {
			id: "biz_mine_second",
			slug: "roble-dos",
			name: "Librería Central",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const member = await seedUser(test.db, { id: "usr_mine_scope" });
		await seedMembership(test.db, member.id, first, "OWNER");
		await seedMembership(test.db, member.id, second, "OWNER");

		const caller = await callerFor(member);

		// The scope is a **filter, not a key**: a person affiliated with two verified shops
		// gets one badge, for the shop the profile screen is currently showing. Both scopes
		// are asserted, because a rule that only ever said `true` would pass a one-sided test.
		const scopedFirst = await caller.identity.mine({ scopeBusinessId: first });
		expect(scopedFirst.identity.display.affiliationBadge).toBe(true);
		expect(scopedFirst.affiliations.every((row) => row.affiliationBadge)).toBe(true);

		const scopedSecond = await caller.identity.mine({ scopeBusinessId: second });
		expect(scopedSecond.identity.display.affiliationBadge).toBe(true);

		// And with no scope there is no badge at all: the resolver hands `deriveDisplay` a
		// null affiliation rather than "whichever shop came back first", which is the
		// permissive reading this design removes.
		const unscoped = await caller.identity.mine();
		expect(unscoped.identity.display.affiliationBadge).toBe(false);
		expect(unscoped.affiliations).toHaveLength(2);

		test.close();
	});

	test("ignores a scope the caller has no active membership in", async () => {
		const { test, callerFor, businessId } = await shop({
			id: "biz_mine_revoked",
			slug: "roble-revocado",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const removed = await seedUser(test.db, { id: "usr_mine_removed" });
		await seedMembership(test.db, removed.id, businessId, "STAFF", {
			status: "REVOKED",
			revokedAt: new Date("2026-02-01T00:00:00Z"),
		});

		const caller = await callerFor(removed);
		const mine = await caller.identity.mine({ scopeBusinessId: businessId });

		// The scope is honoured only when it names an `ACTIVE` membership owned by the caller,
		// and the condition is inside the `where` — so naming a shop they were removed from
		// yields *no affiliation*, not an affiliation with a status attached. A client cannot
		// draw a badge from a relationship that has ended.
		expect(mine.identity.display.affiliationBadge).toBe(false);
		expect(mine.identity.affiliation).toEqual({
			status: "NONE",
			business: null,
		});
		expect(mine.affiliations).toEqual([]);

		test.close();
	});

	test("cannot be scoped to somebody else's shop", async () => {
		const { test, callerFor, businessId } = await shop({
			id: "biz_mine_theirs",
			slug: "roble-ajeno",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const stranger = await seedUser(test.db, { id: "usr_mine_stranger" });

		const caller = await callerFor(stranger);
		const mine = await caller.identity.mine({ scopeBusinessId: businessId });

		// A verified shop the caller has nothing to do with is not a badge, however its id
		// arrived — a stale switcher, a hand-edited URL, or a client that reused a value.
		expect(mine.identity.display.affiliationBadge).toBe(false);
		expect(mine.identity.affiliation).toEqual({
			status: "NONE",
			business: null,
		});
		expect(mine.affiliations).toEqual([]);

		test.close();
	});

	test("shows an invitation as waiting, and not as a shop", async () => {
		const { test, callerFor, businessId, owner } = await shop({
			id: "biz_mine_invited",
			slug: "roble-invitacion",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const invitee = await seedUser(test.db, { id: "usr_mine_invited" });
		await seedMembership(test.db, invitee.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			invitedByUserId: owner.id,
			expiresAt: new Date(Date.now() + 86_400_000),
		});

		const caller = await callerFor(invitee);
		const mine = await caller.identity.mine({ scopeBusinessId: businessId });

		// The invitation is visible, with the shop's name, so the screen can ask — and the
		// shop is not in `affiliations`, which is the list a switcher draws from. An
		// invitation is a message, not a job.
		expect(mine.pendingInvitations).toHaveLength(1);
		expect(mine.pendingInvitations[0]?.businessSlug).toBe("roble-invitacion");
		expect(mine.affiliations).toEqual([]);
		expect(mine.identity.display.affiliationBadge).toBe(false);
		expect(mine.identity.affiliation).toEqual({
			status: "NONE",
			business: null,
		});

		test.close();
	});

	test("says nothing about a shop the caller has nothing to do with", async () => {
		const { test, callerFor } = await shop({
			id: "biz_mine_private",
			slug: "roble-ajeno-privado",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const customer = await seedUser(test.db, { id: "usr_mine_nothing" });

		const caller = await callerFor(customer);
		const mine = await caller.identity.mine();
		const wire = JSON.stringify(mine);

		// This is the caller's own read, so the interesting assertion is the absence of
		// anything else: no shop they are not in, and none of the evidence either.
		expect(wire).not.toContain("roble-ajeno-privado");
		expect(Object.keys(mine).sort()).toEqual([
			"affiliations",
			"identity",
			"pendingInvitations",
		]);

		test.close();
	});
});
