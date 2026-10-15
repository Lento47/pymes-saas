import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import type {
	ProfileSubject,
	ScopedAffiliation,
} from "../src/services/identity";
import { deriveDisplay, resolveProfileIdentity } from "../src/services/identity";
import { authed, seedBusiness, seedMembership, seedUser, world } from "./harness";

/**
 * The whole rule set, as a table.
 *
 * Every badge decision in the product is `deriveDisplay`, and `deriveDisplay` is pure —
 * so the state matrix is written here as data rather than as a fixture farm, and there
 * is no possibility of a case passing because a database was seeded slightly wrong. The
 * database half of this file exists to prove the *resolver* hands `deriveDisplay` the
 * facts the table assumes, and to prove the columns it reads exist in a migrated
 * database. Those are different claims, and keeping them in one file is how they get
 * conflated.
 *
 * The clock is fixed. Every case that involves an expiry says which side of `NOW` it
 * falls on, because "expired" is the one rule in this feature that cannot be
 * demonstrated with a boolean.
 */

/** The instant every case is judged at. */
const NOW = new Date("2026-10-15T12:00:00.000Z");
/** An approval that lapsed yesterday, and one that lapses tomorrow. */
const YESTERDAY = new Date("2026-10-14T12:00:00.000Z");
const TOMORROW = new Date("2026-10-16T12:00:00.000Z");

const CIRCLE_NONE = {
	avatarShape: "circle" as const,
	profileBadge: "none" as const,
	affiliationBadge: false,
};

const VERIFIED_SHOP = {
	avatarShape: "roundedSquare" as const,
	profileBadge: "verifiedBusiness" as const,
	affiliationBadge: false,
};

/** A person: no business behind the account, so nothing of their own to verify. */
const PERSON: ProfileSubject = {
	kind: "person",
	verification: { status: "NONE", level: "NONE", expiresAt: null },
};

/** A shop, in whatever verification state a case needs. */
function shop(input: {
	status?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
	expiresAt?: Date | null;
	businessStatus?: "DRAFT" | "ACTIVE" | "SUSPENDED" | "CLOSED";
}): ProfileSubject {
	const status = input.status ?? "NONE";
	return {
		kind: "business",
		verification: {
			status,
			// An approval is always at `BUSINESS` level; nothing else has ever been
			// granted. Setting it here rather than in each case keeps the table about
			// the badge rather than about the level.
			level: status === "APPROVED" ? "BUSINESS" : "NONE",
			expiresAt: input.expiresAt ?? null,
		},
		status: input.businessStatus ?? "ACTIVE",
	};
}

/** One affiliation row, exactly as `resolveProfileIdentity` would hand it over. */
function affiliation(input: {
	membershipStatus?:
		| "ACTIVE"
		| "PENDING_USER_ACCEPTANCE"
		| "REVOKED"
		| "EXPIRED";
	businessId?: string;
	businessStatus?: "DRAFT" | "ACTIVE" | "SUSPENDED" | "CLOSED";
	businessVerificationStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
	businessVerificationExpiresAt?: Date | null;
}): ScopedAffiliation {
	return {
		membershipStatus: input.membershipStatus ?? "ACTIVE",
		businessId: input.businessId ?? "biz_identity_scope",
		businessStatus: input.businessStatus ?? "ACTIVE",
		businessVerificationStatus: input.businessVerificationStatus ?? "APPROVED",
		businessVerificationExpiresAt:
			input.businessVerificationExpiresAt ?? null,
	};
}

describe("how a profile is drawn", () => {
	const cases: Array<{
		name: string;
		input: Parameters<typeof deriveDisplay>[0];
		expected: typeof CIRCLE_NONE | typeof VERIFIED_SHOP;
	}> = [
		{
			name: "a person with no membership at all is a plain circle",
			input: { subject: PERSON, affiliation: null },
			expected: CIRCLE_NONE,
		},
		{
			name: "a shop under review is still a circle — pending is not verified",
			input: { subject: shop({ status: "PENDING" }), affiliation: null },
			expected: CIRCLE_NONE,
		},
		{
			name: "an approved shop is the rounded square with the business badge",
			input: { subject: shop({ status: "APPROVED" }), affiliation: null },
			expected: VERIFIED_SHOP,
		},
		{
			name: "an approval with no expiry does not lapse on its own",
			input: {
				subject: shop({ status: "APPROVED", expiresAt: null }),
				affiliation: null,
			},
			expected: VERIFIED_SHOP,
		},
		{
			name: "a revoked shop is a circle again",
			input: { subject: shop({ status: "REVOKED" }), affiliation: null },
			expected: CIRCLE_NONE,
		},
		{
			name: "a rejected application is a circle",
			input: { subject: shop({ status: "REJECTED" }), affiliation: null },
			expected: CIRCLE_NONE,
		},
		{
			name: "an approval that lapsed yesterday is a circle today",
			input: {
				subject: shop({ status: "APPROVED", expiresAt: YESTERDAY }),
				affiliation: null,
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "an approval that lapses tomorrow is still verified today",
			input: {
				subject: shop({ status: "APPROVED", expiresAt: TOMORROW }),
				affiliation: null,
			},
			expected: VERIFIED_SHOP,
		},
		{
			name: "an approval expiring at exactly this instant has already lapsed",
			input: {
				subject: shop({ status: "APPROVED", expiresAt: NOW }),
				affiliation: null,
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "a suspended shop keeps no badge, whatever its verification says",
			input: {
				subject: shop({ status: "APPROVED", businessStatus: "SUSPENDED" }),
				affiliation: null,
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "an unopened draft shop is not a public identity either",
			input: {
				subject: shop({ status: "APPROVED", businessStatus: "DRAFT" }),
				affiliation: null,
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "a person keeps a circle even while affiliated with a verified shop",
			input: {
				subject: PERSON,
				affiliation: affiliation({}),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: {
				avatarShape: "circle",
				profileBadge: "none",
				affiliationBadge: true,
			},
		},
		{
			name: "an active member of a shop whose verification was revoked loses the badge",
			input: {
				subject: PERSON,
				affiliation: affiliation({
					businessVerificationStatus: "REVOKED",
				}),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "an active member of a shop whose approval lapsed loses the badge",
			input: {
				subject: PERSON,
				affiliation: affiliation({
					businessVerificationExpiresAt: YESTERDAY,
				}),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "an active member of a suspended shop loses the badge",
			input: {
				subject: PERSON,
				affiliation: affiliation({ businessStatus: "SUSPENDED" }),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "a pending invitation produces no badge",
			input: {
				subject: PERSON,
				affiliation: affiliation({
					membershipStatus: "PENDING_USER_ACCEPTANCE",
				}),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "a revoked membership produces no badge",
			input: {
				subject: PERSON,
				affiliation: affiliation({ membershipStatus: "REVOKED" }),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "an expired membership produces no badge",
			input: {
				subject: PERSON,
				affiliation: affiliation({ membershipStatus: "EXPIRED" }),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			name: "a scope naming another shop shows no badge for this one",
			input: {
				subject: PERSON,
				affiliation: affiliation({ businessId: "biz_identity_other" }),
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
		{
			// **No scope means "no constraint", not "no affiliation".** `deriveDisplay`
			// is handed the affiliation that is in play; which one that is belongs to
			// the caller. The resolver passes none unless a scope named one, which is
			// what makes "no scope selected ⇒ no badge" true in the product — and the
			// database test below is where that is proven, because it is a claim about
			// the query rather than about this rule.
			name: "an affiliation handed over with no scope is badged — the scope is a filter, not a key",
			input: { subject: PERSON, affiliation: affiliation({}) },
			expected: {
				avatarShape: "circle",
				profileBadge: "none",
				affiliationBadge: true,
			},
		},
		{
			name: "a refused scope hands over no affiliation at all, and no badge",
			input: {
				subject: PERSON,
				affiliation: null,
				scopeBusinessId: "biz_identity_scope",
			},
			expected: CIRCLE_NONE,
		},
	];

	for (const one of cases) {
		test(one.name, () => {
			expect(deriveDisplay(one.input, NOW)).toEqual(one.expected);
		});
	}
});

describe("resolving an identity against the database", () => {
	test("a verified shop answers as a business, with the badge and the record", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_verified",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: YESTERDAY,
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "business", businessId },
			{},
			NOW,
		);

		expect(identity.accountType).toBe("BUSINESS");
		expect(identity.verification).toEqual({
			status: "APPROVED",
			level: "BUSINESS",
			verifiedAt: YESTERDAY,
		});
		expect(identity.display).toEqual(VERIFIED_SHOP);
		// A business is not affiliated with a business, and this is asserted rather
		// than assumed: an affiliation here would be a badge about somebody else.
		expect(identity.affiliation).toEqual({ status: "NONE", business: null });

		test.close();
	});

	test("a lapsed approval reads as NONE in the record as well as the badge", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_lapsed",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: YESTERDAY,
			verificationExpiresAt: YESTERDAY,
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "business", businessId },
			{},
			NOW,
		);

		// The point of collapsing both: a client that reads `verification.status`
		// instead of `display.profileBadge` cannot draw a badge the display denies.
		expect(identity.verification).toEqual({
			status: "NONE",
			level: "NONE",
			verifiedAt: null,
		});
		expect(identity.display).toEqual(CIRCLE_NONE);

		// The stored row is untouched — expiry is a read-time judgement, never a write.
		expect(
			test.sqlite
				.prepare(
					"select verification_status, verification_expires_at from business where id = ?",
				)
				.get(businessId),
		).toMatchObject({ verification_status: "APPROVED" });

		test.close();
	});

	test("an active member of a verified shop is badged, and the shop is named", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_member",
			name: "Café Central",
			slug: "cafe-central",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: YESTERDAY,
		});
		const person = await seedUser(test.db, { id: "usr_identity_member" });
		await seedMembership(test.db, person.id, businessId, "STAFF");

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "person", userId: person.id },
			{ scopeBusinessId: businessId },
			NOW,
		);

		expect(identity.accountType).toBe("INDIVIDUAL");
		expect(identity.affiliation).toEqual({
			status: "ACTIVE",
			business: {
				id: businessId,
				slug: "cafe-central",
				name: "Café Central",
				logoUrl: null,
				verificationLevel: "BUSINESS",
			},
		});
		expect(identity.display).toEqual({
			avatarShape: "circle",
			profileBadge: "none",
			affiliationBadge: true,
		});

		test.close();
	});

	test("a pending invitation cannot be used as the scope", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_pending",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: YESTERDAY,
		});
		const invited = await seedUser(test.db, { id: "usr_identity_pending" });
		await seedMembership(test.db, invited.id, businessId, "MANAGER", {
			status: "PENDING_USER_ACCEPTANCE",
			expiresAt: TOMORROW,
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "person", userId: invited.id },
			{ scopeBusinessId: businessId },
			NOW,
		);

		// The row was never read: the `ACTIVE` filter is inside the `where`, so a
		// pending membership is not a member the resolver then declines to badge —
		// there is no affiliation to decline.
		expect(identity.affiliation).toEqual({ status: "NONE", business: null });
		expect(identity.display).toEqual(CIRCLE_NONE);

		test.close();
	});

	test("a revoked membership cannot be used as the scope either", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_revoked",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: YESTERDAY,
		});
		const former = await seedUser(test.db, { id: "usr_identity_revoked" });
		await seedMembership(test.db, former.id, businessId, "OWNER", {
			status: "REVOKED",
			revokedAt: YESTERDAY,
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "person", userId: former.id },
			{ scopeBusinessId: businessId },
			NOW,
		);

		expect(identity.affiliation).toEqual({ status: "NONE", business: null });
		expect(identity.display).toEqual(CIRCLE_NONE);

		test.close();
	});

	test("a person with no scope selected has no affiliation to report", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_unscoped",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
		});
		const person = await seedUser(test.db, { id: "usr_identity_unscoped" });
		await seedMembership(test.db, person.id, businessId, "OWNER");

		const identity = await resolveProfileIdentity(test.db, {
			kind: "person",
			userId: person.id,
		});

		// Which shop the badge names is the switcher's selection, so with nothing
		// selected there is no primary affiliation — deliberately, and not "the
		// first one", which would make the badge depend on row order.
		expect(identity.affiliation).toEqual({ status: "NONE", business: null });
		expect(identity.display.affiliationBadge).toBe(false);

		test.close();
	});
});

/**
 * The compatibility promise, executed rather than asserted in a comment.
 *
 * `is_verified` is the column `apps/web`, the admin filters and the mobile cards read
 * today; `verification_status` is the record everything new reads. They are written in
 * one `db.batch`, and this is the test that fails if somebody later writes one of them
 * alone — the failure mode being a shop that shows verified on one screen and not on
 * another, for as long as the divergence lasts.
 */
describe("approving a shop keeps the projection and the record in step", () => {
	test("`admin.verifyBusiness` writes both, and the identity reads the record", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, { id: "biz_projection" });
		const operator = await seedUser(test.db, {
			id: "usr_projection_admin",
			isAdmin: true,
		});

		const adminCaller = appRouter.createCaller(await authed(test, operator));
		await adminCaller.admin.verifyBusiness({ targetId: businessId });

		// Read through the connection rather than through the mutation's response: the
		// claim is about the row, and a response shape is a thing that can be changed
		// without the row changing.
		expect(
			test.sqlite
				.prepare(
					"select is_verified, verification_status, verification_level, verification_expires_at from business where id = ?",
				)
				.get(businessId),
		).toMatchObject({
			is_verified: 1,
			verification_status: "APPROVED",
			verification_level: "BUSINESS",
			// An approval granted here does not lapse. `null` is what "open-ended"
			// means, and inventing a duration at this path would be a policy nobody
			// agreed to being written as a side effect of a button.
			verification_expires_at: null,
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "business", businessId },
			{},
			NOW,
		);

		expect(identity.verification).toEqual({
			status: "APPROVED",
			level: "BUSINESS",
			verifiedAt: expect.any(Date),
		});
		expect(identity.display).toEqual(VERIFIED_SHOP);

		test.close();
	});
});

/**
 * What a public identity must never carry.
 *
 * §5.7 of the plan asks for this as `identity.profile({ slug })` returning no
 * `review_note`, `tax_id`, `legal_name`, `support_email`, reviewer identity, and no
 * primary affiliation. That procedure is Phase 2 — `routers/identity.ts` does not exist
 * yet — so what is testable in Phase 1 is the thing the procedure will serialise: the
 * resolver's own answer. **The field list is checked against the keys of the payload
 * rather than against a fixed shape**, which is what makes it a guard rather than a
 * snapshot: a later change that threads a review field into `ProfileIdentity` fails
 * here even if nobody remembers to extend this test, because the walk visits whatever
 * is actually there.
 *
 * The literal `{ slug }` version belongs in Phase 2 with the procedure, and it should
 * be written then — a public read is where a leak is reachable from the internet, and
 * this only proves the payload is clean of the fields that exist today.
 */
describe("what a public identity must never carry", () => {
	/** Every `business_verification_request` field, in both spellings, plus the reviewer's. */
	const INTERNAL_FIELDS = [
		"reviewNote",
		"review_note",
		"taxId",
		"tax_id",
		"legalName",
		"legal_name",
		"supportEmail",
		"support_email",
		"domainEvidenceUrl",
		"domain_evidence_url",
		"documents",
		"reviewedBy",
		"reviewedByUserId",
		"reviewed_by_user_id",
		"reviewedAt",
		"reviewed_at",
		"decisionReason",
		"decision_reason",
		"submittedByUserId",
		"submitted_by_user_id",
	];

	/** Every key anywhere in the payload, at any depth. */
	function keysOf(value: unknown, into = new Set<string>()): Set<string> {
		if (Array.isArray(value)) {
			for (const item of value) keysOf(item, into);
			return into;
		}
		if (value !== null && typeof value === "object") {
			for (const [key, nested] of Object.entries(value)) {
				into.add(key);
				keysOf(nested, into);
			}
		}
		return into;
	}

	test("a verified shop's payload carries no review internals", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_exposure_shop",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
		});
		// A rejected application on the record, with the reviewer's note and the tax id
		// on it. The resolver must not be able to see any of it — the difference
		// between the business's *claim* and the *evidence* is the whole reason the
		// request lives in its own table.
		test.sqlite
			.prepare(
				"insert into business_verification_request (id, business_id, status, legal_name, tax_id, support_email, review_note, decision_reason, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.run(
				"bvr_exposure_1",
				businessId,
				"APPROVED",
				"Central Sociedad de Responsabilidad Limitada",
				"3-101-123456",
				"facturacion@cafecentral.test",
				"El id fiscal no coincide con la razón social — nota interna.",
				"Aprobada tras revisión manual.",
				Date.now(),
				Date.now(),
			);

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "business", businessId },
			{},
			NOW,
		);

		const leaked = [...keysOf(identity)].filter((key) =>
			INTERNAL_FIELDS.includes(key),
		);
		expect(leaked).toEqual([]);
		// A business has no affiliation to report, so there is no shop for a badge to
		// name. Asserted here rather than with the display cases because it is the
		// exposure claim: a public read must not nominate anybody.
		expect(identity.affiliation).toEqual({ status: "NONE", business: null });

		test.close();
	});

	test("a person's payload carries no review internals", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_exposure_person",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
		});
		const person = await seedUser(test.db, { id: "usr_exposure_person" });
		await seedMembership(test.db, person.id, businessId, "STAFF");

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "person", userId: person.id },
			{ scopeBusinessId: businessId },
			NOW,
		);

		const leaked = [...keysOf(identity)].filter((key) =>
			INTERNAL_FIELDS.includes(key),
		);
		expect(leaked).toEqual([]);
		// The affiliation names the shop and its level — the two facts a badge draws —
		// and nothing about how that level was established.
		expect(keysOf(identity.affiliation.business)).toEqual(
			new Set(["id", "slug", "name", "logoUrl", "verificationLevel"]),
		);

		test.close();
	});

	test("a suspended shop is not a public identity, however it was verified", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_exposure_suspended",
			status: "SUSPENDED",
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
		});

		const identity = await resolveProfileIdentity(
			test.db,
			{ kind: "business", businessId },
			{},
			NOW,
		);

		// The record still says what it was approved as — that is the stored truth and
		// an operator needs it — while the display says nothing. The badge is a claim
		// about a shop the platform currently shows, and a suspended one is not shown.
		expect(identity.verification.status).toBe("APPROVED");
		expect(identity.display).toEqual({
			avatarShape: "circle",
			profileBadge: "none",
			affiliationBadge: false,
		});

		test.close();
	});
});

/**
 * The executable half of "schema and migration land together".
 *
 * `migration-drift.test.ts` is a *static* check and its column reader does not match
 * this repository's schema spelling, so it currently proves less than its docblock
 * claims — see the Phase 1 gate report. This is not that check fixed; it is the
 * narrower claim this feature needs, made the only way that cannot be fooled: the
 * harness applies every committed `.sql` file to a real SQLite database and this reads
 * the resulting schema back. If `0032` were missing from the migration set, or named a
 * column differently from `schema.ts`, these assertions fail on the columns themselves
 * rather than as an opaque SQL error inside some other spec.
 */
describe("the migrated database has the columns this feature reads", () => {
	function columnsOf(table: string): string[] {
		const test = world();
		const columns = (
			test.sqlite.prepare(`pragma table_info(${table})`).all() as {
				name: string;
			}[]
		).map((column) => column.name);
		test.close();
		return columns;
	}

	test("business carries the verification record beside the projection", () => {
		const columns = columnsOf("business");
		expect(columns).toContain("is_verified");
		expect(columns).toContain("verification_status");
		expect(columns).toContain("verification_level");
		expect(columns).toContain("verified_at");
		expect(columns).toContain("verification_expires_at");
	});

	test("membership carries the affiliation lifecycle", () => {
		const columns = columnsOf("membership");
		expect(columns).toContain("status");
		expect(columns).toContain("invited_by_user_id");
		expect(columns).toContain("accepted_at");
		expect(columns).toContain("revoked_at");
		expect(columns).toContain("expires_at");
	});

	test("the verification request table exists, with its internal note", () => {
		const columns = columnsOf("business_verification_request");
		expect(columns).toContain("business_id");
		expect(columns).toContain("submitted_by_user_id");
		expect(columns).toContain("status");
		expect(columns).toContain("legal_name");
		expect(columns).toContain("tax_id");
		expect(columns).toContain("domain_evidence_url");
		expect(columns).toContain("documents");
		// The column that must never reach a public read. Asserted here so its
		// existence is not discovered by a serializer.
		expect(columns).toContain("review_note");
		expect(columns).toContain("reviewed_by_user_id");
		expect(columns).toContain("decision_reason");
	});

	test("an existing membership defaults to ACTIVE, so the migration backfills nothing", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_identity_default",
		});
		const user = await seedUser(test.db, { id: "usr_identity_default" });

		// Inserted the way the pre-0032 code inserted: no `status` column named at all.
		// This is the whole reason `0032` needs no backfill, so it is asserted rather
		// than reasoned about.
		test.sqlite
			.prepare(
				"insert into membership (id, business_id, user_id, role, created_at) values (?, ?, ?, ?, ?)",
			)
			.run("mem_identity_default", businessId, user.id, "STAFF", Date.now());

		expect(
			test.sqlite
				.prepare("select status from membership where id = ?")
				.get("mem_identity_default"),
		).toMatchObject({ status: "ACTIVE" });

		test.close();
	});

	/**
	 * Phase 2's addition, checked the same way and for the same reason.
	 *
	 * The digest column and the unique index are one decision: the column stores a digest so
	 * a database dump hands over no invitation links, and the index is what makes the lookup
	 * by digest a single hit rather than a scan of every outstanding invitation. A migration
	 * that added the column without the index would still work — slowly, and invisibly, which
	 * is why the index is asserted rather than assumed.
	 */
	test("membership carries the invitation digest, and an index that finds it", () => {
		const test = world();

		const columns = (
			test.sqlite.prepare("pragma table_info(membership)").all() as {
				name: string;
			}[]
		).map((column) => column.name);
		expect(columns).toContain("invite_token_hash");

		const indexes = (
			test.sqlite.prepare("pragma index_list(membership)").all() as {
				name: string;
				unique: number;
			}[]
		).filter((index) => index.name === "membership_invite_token_unique");
		expect(indexes).toHaveLength(1);
		expect(indexes[0]?.unique).toBe(1);

		// SQLite treats NULLs as distinct, which is what lets the column be unique while
		// every membership that is not an outstanding invitation has no value in it.
		const indexed = (
			test.sqlite
				.prepare("pragma index_info(membership_invite_token_unique)")
				.all() as { name: string }[]
		).map((column) => column.name);
		expect(indexed).toEqual(["invite_token_hash"]);

		test.close();
	});
});
