import { describe, expect, test } from "bun:test";
import {
	auditLog as auditLogTable,
	business as businessTable,
	businessVerificationRequest as businessVerificationRequestTable,
	membership as membershipTable,
} from "@pymeshub/db";
import { and, eq } from "drizzle-orm";
import type { VerificationRequestInput } from "@pymeshub/shared";

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
 * The verification lifecycle: apply → decide, and the two ways a decision can be taken back.
 *
 * `identity.test.ts` proves how a badge is *drawn* and `affiliations.test.ts` proves what a
 * pending membership grants. This file proves the **write paths**: who may apply, what an
 * operator may do to an application, and the invariant that holds all of it together —
 * `is_verified` and `verification_status` move in the same batch, always.
 *
 * ## Four acts, and the sentence each one says to a merchant
 *
 * - **Apply** (`business.requestVerification`) — "we would like to be verified", with evidence.
 * - **Approve** (`admin.approveBusinessVerification`) — "you are".
 * - **Reject** — "we looked at what you sent and said no", which is why the shop reads
 *   `REJECTED` rather than falling back to `NONE`: one of those means "you never applied".
 * - **Revoke** — "you were, and you are not any more", which needs an approval to take back.
 *
 * A rejection needs an **open application**; a revocation needs an **approval**. They are
 * different preconditions on purpose, and the tests below assert each one refuses the other's
 * case — a shape where either procedure accepted either state would let the log record a
 * decision about something that never happened.
 *
 * ## The two halves of a decision that are easy to get wrong
 *
 * 1. **The application is closed.** `approveBusinessVerification` requires one, so it closes
 *    one; `admin.verifyBusiness` does not, so it closes whatever it finds — see
 *    `decideRequestStatement`. A shop that reads `APPROVED` while the queue still holds its
 *    row is the badge-versus-list disagreement `approval-counts.test.ts` exists to catch.
 * 2. **`is_verified` is written with the status.** It is the compatibility projection every
 *    pre-Phase-1 read still uses, and a path that writes one without the other is the exact
 *    bug the projection's docblock describes. Every assertion below reads both columns.
 *
 * ## What a revocation deliberately does not do
 *
 * It does **not** revoke memberships. The brief's phrase — "revocation deactivates active
 * memberships and clears badge eligibility" — describes two different procedures: the first is
 * `business.revokeAffiliation`, which ends a *job*, and the second is this one, which ends a
 * *claim about a shop*. Auto-revoking the team would lock every employee out of a dashboard
 * over a registration problem, and — because an owner is a member too — would produce the
 * ownerless business `assertNotLastOwner` exists to prevent. Both halves of the phrase are
 * tested: the badge comes down here, the membership comes down in the other file.
 */

/** A shop with an owner, and a way to build callers for anybody else. */
async function shop(
	overrides: {
		id?: string;
		slug?: string;
		verificationStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
		verificationExpiresAt?: Date | null;
		verificationLevel?: "NONE" | "BUSINESS";
		verifiedAt?: Date | null;
	} = {},
) {
	const test = world();
	const businessId = await seedBusiness(test.db, {
		id: overrides.id ?? "biz_verify_shop",
		slug: overrides.slug ?? "tienda-verificable",
		name: "Panadería La Espiga",
		verificationStatus: overrides.verificationStatus ?? "NONE",
		verificationLevel: overrides.verificationLevel ?? "NONE",
		verifiedAt: overrides.verifiedAt ?? null,
		verificationExpiresAt: overrides.verificationExpiresAt ?? null,
	});
	const owner = await seedUser(test.db, { id: "usr_verify_owner" });
	await seedMembership(test.db, owner.id, businessId, "OWNER");

	const callerFor = async (user: typeof owner) =>
		appRouter.createCaller(await authed(test, user)) as Caller;

	return { test, businessId, owner, callerFor };
}

/** A platform operator. The id is suffixed so one world can hold two of them. */
async function adminCaller(
	test: ReturnType<typeof world>,
	suffix = "a",
): Promise<Caller> {
	const admin = await seedUser(test.db, {
		id: `usr_verify_admin_${suffix}`,
		isAdmin: true,
	});
	return appRouter.createCaller(await authed(test, admin)) as Caller;
}

/** The business row's verification columns, read raw so a spec can assert on the storage. */
async function businessRow(test: ReturnType<typeof world>, businessId: string) {
	const rows = await test.db
		.select({
			isVerified: businessTable.isVerified,
			verificationStatus: businessTable.verificationStatus,
			verificationLevel: businessTable.verificationLevel,
			verifiedAt: businessTable.verifiedAt,
			verificationExpiresAt: businessTable.verificationExpiresAt,
			status: businessTable.status,
		})
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);
	return rows[0];
}

/** One application row, read raw, including the fields no wire shape carries. */
async function requestRow(test: ReturnType<typeof world>, requestId: string) {
	const rows = await test.db
		.select()
		.from(businessVerificationRequestTable)
		.where(eq(businessVerificationRequestTable.id, requestId))
		.limit(1);
	return rows[0];
}

/** The audit actions recorded against a business, oldest first. */
async function auditActions(
	test: ReturnType<typeof world>,
	businessId: string,
): Promise<string[]> {
	const rows = await test.db
		.select({ action: auditLogTable.action })
		.from(auditLogTable)
		.where(eq(auditLogTable.targetId, businessId));
	return rows.map((row) => row.action);
}

/**
 * The evidence a real application carries, typed as the wire shape so a field added to the
 * input schema cannot quietly stop being exercised by these tests.
 */
const EVIDENCE: Omit<VerificationRequestInput, "businessId"> = {
	legalName: "Panadería La Espiga S.A.",
	country: "CR",
	taxId: "3-101-123456",
	supportEmail: "hola@laespiga.cr",
	domain: "https://www.LaEspiga.cr/menu",
	domainEvidenceUrl: "https://laespiga.cr/nosotros",
	documents: ["upl_test_patente", "upl_test_cedula"],
};

describe("applying for verification", () => {
	test("records the application, moves the shop to PENDING, and says who asked", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);

		const applied = await ownerCaller.business.requestVerification({
			businessId,
			...EVIDENCE,
		});

		expect(applied.status).toBe("PENDING");
		expect(applied.submittedAt).toBeInstanceOf(Date);

		const request = await requestRow(test, applied.requestId);
		expect(request?.status).toBe("PENDING");
		expect(request?.businessId).toBe(businessId);
		expect(request?.submittedByUserId).toBe(owner.id);
		expect(request?.taxId).toBe("3-101-123456");
		expect(request?.legalName).toBe("Panadería La Espiga S.A.");
		expect(request?.documents).toEqual(["upl_test_patente", "upl_test_cedula"]);

		// Both halves of the state, in one read: the projection and the record.
		const row = await businessRow(test, businessId);
		expect(row?.verificationStatus).toBe("PENDING");
		expect(row?.isVerified).toBe(false);

		// `business.verification_request`, not `business.verify`: applying is the merchant
		// asking and verifying is the platform granting, and an audit log that recorded both
		// under one action could not answer "did they apply or did we decide".
		const entries = await test.db
			.select()
			.from(auditLogTable)
			.where(
				and(
					eq(auditLogTable.targetId, businessId),
					eq(auditLogTable.actorUserId, owner.id),
				),
			);
		expect(entries.map((entry) => entry.action)).toEqual([
			"business.verification_request",
		]);
		expect(
			(entries[0]?.meta as { after: { requestId: string } } | null)?.after
				.requestId,
		).toBe(applied.requestId);

		test.close();
	});

	test("normalises the domain to the host a reviewer can compare", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);

		const applied = await ownerCaller.business.requestVerification({
			businessId,
			...EVIDENCE,
		});

		// The scheme, the `www.`, the path and the case are gone; the accented host is not
		// punycoded, because a human is going to read this column and compare it against a
		// registration document that also says `laespiga.cr`.
		const request = await requestRow(test, applied.requestId);
		expect(request?.domain).toBe("laespiga.cr");

		test.close();
	});

	test("stores no documents rather than an empty list when none were sent", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);

		const applied = await ownerCaller.business.requestVerification({
			businessId,
			legalName: "Solo el nombre",
			documents: [],
		});

		// `[]` and `null` would both render as "no documents", but only one of them is what
		// the column means — and a queue row that showed `[]` for a shop that sent nothing
		// and `[]` for a shop that sent an empty upload would be two states in one value.
		expect((await requestRow(test, applied.requestId))?.documents).toBeNull();

		test.close();
	});

	test("is refused to a staff member, because it speaks for the business", async () => {
		const { test, businessId, callerFor } = await shop();
		const staff = await seedUser(test.db, { id: "usr_verify_staff" });
		await seedMembership(test.db, staff.id, businessId, "STAFF");

		const staffCaller = await callerFor(staff);
		const failure = await refused(
			staffCaller.business.requestVerification({ businessId }),
		);

		// `business:settings` is MANAGER's and OWNER's. Applying for verification is a claim
		// about the company, and a claim about the company is not a cashier's to make.
		expect(failure.code).toBe("FORBIDDEN");

		test.close();
	});

	test("is refused to a stranger, even with the right businessId", async () => {
		const { test, businessId, callerFor } = await shop();
		const stranger = await seedUser(test.db, { id: "usr_verify_stranger" });

		const strangerCaller = await callerFor(stranger);
		const failure = await refused(
			strangerCaller.business.requestVerification({ businessId }),
		);

		expect(failure.code).toBe("FORBIDDEN");
		expect((await businessRow(test, businessId))?.verificationStatus).toBe("NONE");

		test.close();
	});

	test("cannot be aimed at somebody else's shop", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedBusiness(test.db, { id: "biz_verify_neighbour" });

		const ownerCaller = await callerFor(owner);
		const failure = await refused(
			ownerCaller.business.requestVerification({
				businessId: "biz_verify_neighbour",
			}),
		);

		// The middleware resolves the membership from the *input's* businessId, so naming a
		// shop the caller has no membership in is refused before the service runs — which is
		// the property that makes every `businessProcedure` safe by construction.
		expect(failure.code).toBe("FORBIDDEN");
		expect(
			(await businessRow(test, "biz_verify_neighbour"))?.verificationStatus,
		).toBe("NONE");

		test.close();
	});

	test("refuses a second application while one is open", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);
		await ownerCaller.business.requestVerification({ businessId, ...EVIDENCE });

		const failure = await refused(
			ownerCaller.business.requestVerification({
				businessId,
				legalName: "Otra vez",
			}),
		);

		// A sentence, not a constraint error: the partial unique index is what guarantees
		// one open application, and this is what explains it.
		expect(failure.code).toBe("CONFLICT");
		expect(failure.message).toContain("en revisión");

		test.close();
	});

	test("refuses to re-apply while the approval is still live", async () => {
		const { test, businessId, owner, callerFor } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
			verificationExpiresAt: new Date("2027-01-01T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		const failure = await refused(
			ownerCaller.business.requestVerification({ businessId }),
		);

		expect(failure.code).toBe("CONFLICT");
		expect(failure.message).toContain("ya está verificado");

		test.close();
	});

	test("lets a shop whose approval lapsed apply again, which is the only path back", async () => {
		const lapsed = new Date("2026-01-01T00:00:00Z");
		const { test, businessId, owner, callerFor } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2025-01-01T00:00:00Z"),
			verificationExpiresAt: lapsed,
		});

		const ownerCaller = await callerFor(owner);

		// Before applying: the record says APPROVED, the effective status says NONE, and the
		// stored window is reported as it is. That is the shape `business.verification`
		// documents — the *status* collapses and the *date* does not, because for the shop
		// the date is the difference between "never verified" and "it ran out".
		const before = await ownerCaller.business.verification({ businessId });
		expect(before.status).toBe("NONE");
		expect(before.expiresAt?.getTime()).toBe(lapsed.getTime());
		expect(before.verifiedAt).toBeNull();

		const applied = await ownerCaller.business.requestVerification({
			businessId,
			...EVIDENCE,
		});
		expect(applied.status).toBe("PENDING");

		test.close();
	});

	test("clears the previous episode's level and date, because both describe an approval", async () => {
		const { test, businessId, owner, callerFor } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2025-01-01T00:00:00Z"),
			verificationExpiresAt: new Date("2026-01-01T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		await ownerCaller.business.requestVerification({ businessId, ...EVIDENCE });

		const row = await businessRow(test, businessId);
		expect(row?.verificationStatus).toBe("PENDING");
		// A shop under review is not a `BUSINESS`-level verified shop, and leaving the level
		// behind would make `business.verification` report `{status: "PENDING", level:
		// "BUSINESS"}` to the applicant. The history is not lost — it is in the request rows.
		expect(row?.verificationLevel).toBe("NONE");
		expect(row?.verifiedAt).toBeNull();

		test.close();
	});

	test("stops a shop that applies in a loop", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);

		// The first attempt succeeds, and the four after it are refused on their merits —
		// the limiter counts *attempts*, before the service, so a loop that never succeeds
		// still cannot run forever. Five is the window's allowance.
		await ownerCaller.business.requestVerification({
			businessId,
			legalName: "Primera solicitud",
		});

		const codes: string[] = [];
		for (let attempt = 0; attempt < 6; attempt += 1) {
			const error = await refused(
				ownerCaller.business.requestVerification({
					businessId,
					legalName: `Intento ${attempt}`,
				}),
			);
			codes.push(error.code);
		}

		expect(codes.slice(0, 4)).toEqual([
			"CONFLICT",
			"CONFLICT",
			"CONFLICT",
			"CONFLICT",
		]);
		expect(codes[4]).toBe("TOO_MANY_REQUESTS");
		expect(codes[5]).toBe("TOO_MANY_REQUESTS");

		test.close();
	});
});

describe("the shop's own review history", () => {
	test("reports the open application and the effective status", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);

		const applied = await ownerCaller.business.requestVerification({
			businessId,
			...EVIDENCE,
		});
		const view = await ownerCaller.business.verification({ businessId });

		expect(view.status).toBe("PENDING");
		expect(view.openRequestId).toBe(applied.requestId);
		expect(view.expiresAt).toBeNull();
		expect(view.timeline).toHaveLength(1);
		expect(view.timeline[0]?.id).toBe(applied.requestId);
		expect(view.timeline[0]?.status).toBe("PENDING");
		expect(view.timeline[0]?.reviewedAt).toBeNull();
		expect(view.timeline[0]?.decisionReason).toBeNull();

		test.close();
	});

	test("carries no reviewer's note and no evidence, on any field", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_private",
			businessId,
			submittedByUserId: owner.id,
			status: "REJECTED",
			legalName: "Panadería La Espiga S.A.",
			taxId: "3-101-123456",
			supportEmail: "hola@laespiga.cr",
			documents: ["upl_test_patente"],
			reviewNote: "El cédula jurídica no coincide con el nombre legal",
			decisionReason: "Necesitamos la cédula jurídica vigente",
			reviewedAt: new Date("2026-02-01T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		const view = await ownerCaller.business.verification({ businessId });
		const serialised = JSON.stringify(view);

		// The reviewer's internal note is the field this shape exists without: the applicant
		// is told `decisionReason` instead, and a note that travelled here would be the leak
		// the whole design is arranged to prevent.
		expect(serialised).not.toContain("no coincide");
		expect(serialised).not.toContain("3-101-123456");
		expect(serialised).not.toContain("upl_test_patente");
		expect(serialised).not.toContain("usr_verify_admin");

		// What the applicant *is* owed: the reason a human wrote for them.
		expect(view.timeline[0]?.decisionReason).toBe(
			"Necesitamos la cédula jurídica vigente",
		);

		test.close();
	});

	test("keeps every episode, newest first", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_old",
			businessId,
			status: "REJECTED",
			decisionReason: "Faltaba el dominio",
			createdAt: new Date("2025-06-01T00:00:00Z"),
			reviewedAt: new Date("2025-06-02T00:00:00Z"),
		});
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_new",
			businessId,
			status: "PENDING",
			createdAt: new Date("2025-07-01T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		const view = await ownerCaller.business.verification({ businessId });

		// A shop that has applied twice reads both applications: the refusal is not erased by
		// the retry, which is the difference between a history and a status.
		expect(view.timeline.map((entry) => entry.id)).toEqual([
			"bvr_verify_new",
			"bvr_verify_old",
		]);
		expect(view.openRequestId).toBe("bvr_verify_new");

		test.close();
	});
});

describe("approving an application", () => {
	test("grants the mark, closes the application, and writes the audit row", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);
		const applied = await ownerCaller.business.requestVerification({
			businessId,
			...EVIDENCE,
		});

		const admin = await adminCaller(test);
		const decided = await admin.admin.approveBusinessVerification({
			targetId: businessId,
			reviewNote: "Cédula verificada contra el registro",
		});

		expect(decided).toEqual({
			businessId,
			requestId: applied.requestId,
			status: "APPROVED",
		});

		const row = await businessRow(test, businessId);
		expect(row?.verificationStatus).toBe("APPROVED");
		expect(row?.verificationLevel).toBe("BUSINESS");
		expect(row?.verifiedAt).toBeInstanceOf(Date);
		// The approval granted here is open-ended. A stored expiry would be a date nobody
		// chose, and `deriveDisplay` would refuse the badge on it.
		expect(row?.verificationExpiresAt).toBeNull();
		expect(row?.isVerified).toBe(true);

		const request = await requestRow(test, applied.requestId);
		expect(request?.status).toBe("APPROVED");
		expect(request?.reviewedAt).toBeInstanceOf(Date);
		expect(request?.reviewedByUserId).toBe("usr_verify_admin_a");

		// `business.verify`, the platform granting — not `business.verification_request`.
		expect(await auditActions(test, businessId)).toEqual([
			"business.verification_request",
			"business.verify",
		]);

		test.close();
	});

	test("draws the badge on the shop's public profile, and on its team", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		const ownerCaller = await callerFor(owner);
		await ownerCaller.business.requestVerification({ businessId, ...EVIDENCE });

		const admin = await adminCaller(test);
		await admin.admin.approveBusinessVerification({ targetId: businessId });

		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		const profile = await anonymous.identity.profile({
			slug: "tienda-verificable",
		});

		expect(profile.verification.status).toBe("APPROVED");
		expect(profile.verification.level).toBe("BUSINESS");
		expect(profile.display.profileBadge).toBe("verifiedBusiness");
		expect(profile.display.avatarShape).toBe("roundedSquare");

		// And the person: a circle whose affiliation badge is on, because the shop they work
		// at is verified and the scope they asked about is that shop.
		const mine = await ownerCaller.identity.mine({
			scopeBusinessId: businessId,
		});
		expect(mine.identity.display.profileBadge).toBe("none");
		expect(mine.identity.display.avatarShape).toBe("circle");
		expect(mine.identity.display.affiliationBadge).toBe(true);

		test.close();
	});

	test("requires an open application, because a queue decision about nothing is nothing", async () => {
		const { test, businessId } = await shop();
		const admin = await adminCaller(test);

		const failure = await refused(
			admin.admin.approveBusinessVerification({ targetId: businessId }),
		);

		expect(failure.code).toBe("NOT_FOUND");
		expect((await businessRow(test, businessId))?.verificationStatus).toBe("NONE");

		test.close();
	});

	test("cannot be performed twice on the same application", async () => {
		const { test, businessId } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_twice",
			businessId,
		});

		const admin = await adminCaller(test);
		await admin.admin.approveBusinessVerification({ targetId: businessId });

		// A stale console page holds a business id and a button. The second press finds no
		// open application and is refused, rather than writing a second `business.verify`
		// row for a decision that was already made.
		const failure = await refused(
			admin.admin.approveBusinessVerification({ targetId: businessId }),
		);
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});

	test("clears a stale expiry, so re-approving a lapsed shop actually takes effect", async () => {
		const { test, businessId } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2025-01-01T00:00:00Z"),
			verificationExpiresAt: new Date("2026-01-01T00:00:00Z"),
		});
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_lapsed",
			businessId,
		});

		const admin = await adminCaller(test);
		await admin.admin.approveBusinessVerification({ targetId: businessId });

		// Before Phase 2 this wrote `APPROVED` beside a past expiry: `is_verified` said true,
		// `deriveDisplay` refused the badge, and the shop was verified everywhere except on
		// its own storefront. Clearing the column is what makes the approval mean anything.
		const row = await businessRow(test, businessId);
		expect(row?.verificationExpiresAt).toBeNull();
		expect(row?.isVerified).toBe(true);

		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		expect(
			(await anonymous.identity.profile({ slug: "tienda-verificable" })).display
				.profileBadge,
		).toBe("verifiedBusiness");

		test.close();
	});

	test("is refused to a merchant, because it is not their decision", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedVerificationRequest(test.db, { id: "bvr_verify_noadmin", businessId });

		const ownerCaller = await callerFor(owner);
		await expect(
			ownerCaller.admin.approveBusinessVerification({ targetId: businessId }),
		).rejects.toThrow("Solo el equipo de PymesHub");

		expect((await businessRow(test, businessId))?.verificationStatus).toBe("NONE");

		test.close();
	});
});

describe("rejecting an application", () => {
	test("requires a reason, which the wire does not enforce for this action", async () => {
		const { test, businessId } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_noreason",
			businessId,
		});

		const admin = await adminCaller(test);

		// `adminVerificationDecisionInput.reason` is optional — an approval needs none — so a
		// blank string reaches the service and `requireReason` is what refuses it. This is
		// the one place in Phase 2 where the service gate is the only gate, and therefore the
		// one place worth asserting through the router.
		const failure = await refused(
			admin.admin.rejectBusinessVerification({
				targetId: businessId,
				reason: "",
			}),
		);

		expect(failure.code).toBe("BAD_REQUEST");
		expect((await businessRow(test, businessId))?.verificationStatus).toBe("NONE");
		expect(await auditActions(test, businessId)).toEqual([]);

		test.close();
	});

	test("refuses the application, tells the applicant why, and keeps the note internal", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_reject",
			businessId,
			submittedByUserId: owner.id,
		});

		const admin = await adminCaller(test);
		const decided = await admin.admin.rejectBusinessVerification({
			targetId: businessId,
			reason: "La cédula jurídica venció",
			reviewNote: "Consultar con el registro antes de la próxima revisión",
		});

		expect(decided.status).toBe("REJECTED");

		const row = await businessRow(test, businessId);
		// `REJECTED` on the business, not a fall back to `NONE`: the two are different
		// sentences to a merchant — "you applied and we said no" against "you never applied".
		expect(row?.verificationStatus).toBe("REJECTED");
		expect(row?.verificationLevel).toBe("NONE");
		expect(row?.verifiedAt).toBeNull();
		expect(row?.isVerified).toBe(false);

		const request = await requestRow(test, "bvr_verify_reject");
		expect(request?.status).toBe("REJECTED");
		expect(request?.reviewNote).toBe(
			"Consultar con el registro antes de la próxima revisión",
		);
		// The applicant is told the reason written for them, and it defaults to the audited
		// one — a refusal with no explanation is a refusal with no next step.
		expect(request?.decisionReason).toBe("La cédula jurídica venció");

		const ownerCaller = await callerFor(owner);
		const view = await ownerCaller.business.verification({ businessId });
		expect(view.status).toBe("REJECTED");
		expect(view.openRequestId).toBeNull();
		expect(view.timeline[0]?.decisionReason).toBe("La cédula jurídica venció");
		expect(JSON.stringify(view)).not.toContain("Consultar con el registro");

		test.close();
	});

	test("is not a ban: the shop applies again immediately, and both episodes survive", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_first",
			businessId,
			status: "REJECTED",
			decisionReason: "Faltaba el dominio",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			reviewedAt: new Date("2026-01-02T00:00:00Z"),
		});

		const ownerCaller = await callerFor(owner);
		const applied = await ownerCaller.business.requestVerification({
			businessId,
			...EVIDENCE,
		});

		expect(applied.status).toBe("PENDING");

		const view = await ownerCaller.business.verification({ businessId });
		expect(view.status).toBe("PENDING");
		expect(view.timeline.map((entry) => entry.status)).toEqual([
			"PENDING",
			"REJECTED",
		]);
		// The refused application stays on its own row, with the reason it was refused for.
		expect(view.timeline[1]?.decisionReason).toBe("Faltaba el dominio");

		test.close();
	});
});

describe("revoking a verification", () => {
	test("requires an approval to take back", async () => {
		const { test, businessId } = await shop({ verificationStatus: "REJECTED" });
		const admin = await adminCaller(test);

		const failure = await refused(
			admin.admin.revokeBusinessVerification({
				targetId: businessId,
				reason: "La cédula no coincide",
			}),
		);

		// Answering `{ok: true}` for a claim that does not exist would make "did the badge
		// actually come down" unanswerable. A state conflict rather than a `NOT_FOUND`: the
		// shop is right there, it simply has nothing to take back.
		expect(failure.code).toBe("CONFLICT");
		expect(failure.message).toContain("no tiene una verificación que revocar");
		expect((await businessRow(test, businessId))?.verificationStatus).toBe("REJECTED");

		test.close();
	});

	test("requires a reason", async () => {
		const { test, businessId } = await shop({ verificationStatus: "APPROVED" });
		const admin = await adminCaller(test);

		const failure = await refused(
			admin.admin.revokeBusinessVerification({
				targetId: businessId,
				reason: "  ",
			}),
		);

		expect(failure.code).toBe("BAD_REQUEST");
		expect((await businessRow(test, businessId))?.verificationStatus).toBe("APPROVED");

		test.close();
	});

	test("takes the badge down for the shop and its team, and keeps the team", async () => {
		const { test, businessId, owner, callerFor } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const member = await seedUser(test.db, { id: "usr_verify_member" });
		const membershipId = await seedMembership(
			test.db,
			member.id,
			businessId,
			"STAFF",
		);

		const admin = await adminCaller(test);
		await admin.admin.revokeBusinessVerification({
			targetId: businessId,
			reason: "La sociedad se disolvió",
			decisionReason: "Tu verificación fue retirada",
		});

		const row = await businessRow(test, businessId);
		expect(row?.verificationStatus).toBe("REVOKED");
		expect(row?.verificationLevel).toBe("NONE");
		expect(row?.verifiedAt).toBeNull();
		expect(row?.isVerified).toBe(false);

		// The badge comes down at read time, for the shop and for every member, because
		// `deriveDisplay` asks `verificationIsLive` on each read. Nothing had to be written
		// for that to happen — which is why the membership below is untouched.
		const anonymous = appRouter.createCaller(await contextFor(test, null)) as Caller;
		const profile = await anonymous.identity.profile({
			slug: "tienda-verificable",
		});
		expect(profile.verification.status).toBe("REVOKED");
		expect(profile.verification.level).toBe("NONE");
		// The status is reported and the badge is not: a revocation is a public fact about a
		// public claim — the badge was on the storefront, so its removal is visible — and
		// `deriveDisplay` is what turns "not live" into "no badge".
		expect(profile.display.profileBadge).toBe("none");
		expect(profile.display.avatarShape).toBe("circle");

		const memberCaller = await callerFor(member);
		const mine = await memberCaller.identity.mine({ scopeBusinessId: businessId });
		expect(mine.identity.display.affiliationBadge).toBe(false);
		// Still in the switcher, because a mark is a claim about a shop and a membership is
		// a job. Revoking the team would lock this person out of their own dashboard over a
		// registration problem.
		expect(mine.affiliations.map((row) => row.businessId)).toEqual([businessId]);
		expect((await businessRow(test, businessId))?.status).toBe("ACTIVE");

		const memberships = await test.db
			.select({ status: membershipTable.status })
			.from(membershipTable)
			.where(eq(membershipTable.id, membershipId));
		expect(memberships[0]?.status).toBe("ACTIVE");

		// And the member can still act for the shop: `orders:read` is every role's, and this
		// STAFF member reaches it as they did before the mark came down.
		await memberCaller.business.dashboardPreferences({ businessId });

		test.close();
	});

	test("moves an open application to REVOKED, so the queue holds nothing undecidable", async () => {
		const { test, businessId } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
		await seedVerificationRequest(test.db, {
			id: "bvr_verify_open",
			businessId,
		});

		const admin = await adminCaller(test);
		await admin.admin.revokeBusinessVerification({
			targetId: businessId,
			reason: "El dominio fue vendido",
		});

		// Reachable when a shop was verified manually while an application was open. Left
		// alone, the row would sit in the queue forever: `approve` would find the shop
		// already approved and the reviewer would have no way to close it.
		expect((await requestRow(test, "bvr_verify_open"))?.status).toBe("REVOKED");
		expect((await admin.admin.verificationQueue({ limit: 50 })).rows).toEqual([]);

		const failure = await refused(
			admin.admin.approveBusinessVerification({ targetId: businessId }),
		);
		expect(failure.code).toBe("NOT_FOUND");

		test.close();
	});

	test("can take back a lapsed approval, because the record still says verified", async () => {
		const { test, businessId } = await shop({
			verificationStatus: "APPROVED",
			verificationLevel: "BUSINESS",
			verifiedAt: new Date("2025-01-01T00:00:00Z"),
			verificationExpiresAt: new Date("2026-01-01T00:00:00Z"),
		});

		const admin = await adminCaller(test);
		await admin.admin.revokeBusinessVerification({
			targetId: businessId,
			reason: "La verificación se otorgó por error",
		});

		// The stored status is what every read collapses from, so an operator withdrawing the
		// record is a real act even when the badge was already down.
		const row = await businessRow(test, businessId);
		expect(row?.verificationStatus).toBe("REVOKED");
		expect(row?.verificationExpiresAt).toBeNull();
		expect(await auditActions(test, businessId)).toEqual([
			"business.verification_revoke",
		]);

		test.close();
	});
});

describe("the review queue", () => {
	test("carries the evidence a reviewer has to check, and nothing they must not", async () => {
		const { test, businessId, owner } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_queue_evidence",
			businessId,
			submittedByUserId: owner.id,
			legalName: "Panadería La Espiga S.A.",
			country: "CR",
			taxId: "3-101-123456",
			supportEmail: "hola@laespiga.cr",
			domain: "laespiga.cr",
			domainEvidenceUrl: "https://laespiga.cr/nosotros",
			documents: ["upl_test_patente"],
			reviewNote: "nota de una revisión anterior",
		});

		const admin = await adminCaller(test);
		const { rows } = await admin.admin.verificationQueue({ limit: 25 });

		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row?.businessName).toBe("Panadería La Espiga");
		expect(row?.taxId).toBe("3-101-123456");
		expect(row?.legalName).toBe("Panadería La Espiga S.A.");
		expect(row?.country).toBe("CR");
		expect(row?.domain).toBe("laespiga.cr");
		expect(row?.documents).toEqual(["upl_test_patente"]);
		expect(row?.submittedBy).toEqual({
			id: owner.id,
			name: owner.name,
			email: owner.email,
		});
		// A queue row is what a reviewer reads *before* deciding; a note is what a previous
		// reviewer wrote *after* one, and it belongs on the detail screen rather than in a
		// page of fifty rows.
		expect(JSON.stringify(row)).not.toContain("nota de una revisión anterior");

		test.close();
	});

	test("is refused to a merchant, because it carries tax ids from every shop", async () => {
		const { test, businessId, owner, callerFor } = await shop();
		await seedVerificationRequest(test.db, { id: "bvr_queue_noadmin", businessId });

		const ownerCaller = await callerFor(owner);
		await expect(
			ownerCaller.admin.verificationQueue({ limit: 25 }),
		).rejects.toThrow("Solo el equipo de PymesHub");

		test.close();
	});

	test("still lists an application whose submitter is gone", async () => {
		const { test, businessId } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_queue_orphan",
			businessId,
			submittedByUserId: null,
		});

		const admin = await adminCaller(test);
		const { rows } = await admin.admin.verificationQueue({ limit: 25 });

		// `submitted_by_user_id` is `on delete set null`, and an application does not stop
		// being reviewable because the manager who filed it left the company.
		expect(rows).toHaveLength(1);
		expect(rows[0]?.submittedBy).toBeNull();

		test.close();
	});

	test("pages oldest first, because a queue is worked from the back", async () => {
		const { test } = await shop();

		// Three shops, because a shop can have at most one *open* application — the partial
		// unique index on `(business_id) where status = 'PENDING'` guarantees it, and a
		// fixture that seeded three for one shop would be seeding a state the database
		// refuses.
		for (const [id, createdAt] of [
			["biz_queue_oldest", "2026-01-01T00:00:00Z"],
			["biz_queue_middle", "2026-02-01T00:00:00Z"],
			["biz_queue_newest", "2026-03-01T00:00:00Z"],
		] as const) {
			await seedBusiness(test.db, { id });
			await seedVerificationRequest(test.db, {
				id: `bvr_${id}`,
				businessId: id,
				createdAt: new Date(createdAt),
			});
		}

		const admin = await adminCaller(test);
		const first = await admin.admin.verificationQueue({ limit: 2 });

		// The one list on the platform that runs oldest first: the opposite order would let a
		// busy week bury an application that has been waiting a month.
		expect(first.rows.map((row) => row.businessId)).toEqual([
			"biz_queue_oldest",
			"biz_queue_middle",
		]);
		expect(first.nextCursor).not.toBeNull();

		const second = await admin.admin.verificationQueue({
			limit: 2,
			cursor: first.nextCursor ?? undefined,
		});
		expect(second.rows.map((row) => row.businessId)).toEqual([
			"biz_queue_newest",
		]);
		expect(second.nextCursor).toBeNull();

		test.close();
	});

	test("does not list decided applications", async () => {
		const { test, businessId } = await shop();
		await seedVerificationRequest(test.db, {
			id: "bvr_queue_decided",
			businessId,
			status: "APPROVED",
			reviewedAt: new Date("2026-01-01T00:00:00Z"),
		});

		const admin = await adminCaller(test);
		expect((await admin.admin.verificationQueue({ limit: 25 })).rows).toEqual([]);

		test.close();
	});
});
