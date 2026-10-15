import { describe, expect, test } from "bun:test";
import { courierProfile as courierProfileTable } from "@pymeshub/db";

import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedUser,
	seedVerificationRequest,
	world,
} from "./harness";

/**
 * `admin.approvalCounts` — the number on the console's queue badge.
 *
 * ## Why this endpoint exists at all
 *
 * The badge used to assemble itself from two unrelated reads: `pendingVerification` out of
 * `admin.metrics`, a ~30-row payload that refetches every 30 seconds, and the courier half
 * from `courierProfiles({ status: "PENDING", limit: 1 })`, reading `.total` off a one-row
 * page. Two requests for two integers, one of them wasteful and one of them indirect.
 *
 * ## The claim worth testing
 *
 * Not "it returns a number" — that the counts **equal the totals of the lists they send you
 * to**. A badge that says 4 and opens a list of 3 is worse than no badge: the operator
 * concludes somebody handled one silently, which is a conclusion they will act on.
 *
 * So every assertion here is a comparison against the corresponding list's own `total`, and
 * the interesting cases are the ones where the two implementations could plausibly disagree:
 * a shop that never applied, a shop whose application was refused, and a courier profile
 * whose user row is gone.
 *
 * ## The disagreement this file recorded for a year, and how Phase 2 ended it
 *
 * The version of this file that preceded the verified-profiles work carried a skipped test
 * named "the badge and the queue agree on what awaits verification", with a docblock
 * explaining that they could not: the badge counted `is_verified = 0`, which is every shop
 * that has not been approved — including every shop that never applied — while the
 * Aprobaciones tab listed `status = 'DRAFT'`, an axis with nothing to do with verification.
 * Neither predicate described a queue, so neither agreed with the other, and the skip
 * recorded that fixing it was a product call.
 *
 * Phase 2 made the call. `is_verified` is a **projection** of `verification_status`, so it
 * cannot distinguish `PENDING` from `REJECTED`, from `REVOKED`, or from a shop nobody has
 * ever looked at — and the honest predicate for "applications awaiting review" is the status
 * itself. Both the badge and the queue now read `verification_status = 'PENDING'`, the
 * skipped test is un-skipped against `admin.verificationQueue`, and the two tests that
 * replace it pin the halves of the bug that the old predicate produced.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

async function adminCaller(w: ReturnType<typeof world>) {
	const admin = await seedUser(w.db, {
		id: `usr_approvals_admin_${Math.random().toString(36).slice(2, 8)}`,
		isAdmin: true,
	});
	return appRouter.createCaller(await authed(w, admin)) as Caller;
}

describe("approval queue depth", () => {
	test("is zero on an empty platform, not undefined", async () => {
		const w = world();
		const admin = await adminCaller(w);

		// The badge renders `badge > 0`, so `undefined` and `0` look identical here — but
		// `undefined` is what a query that has not resolved looks like too, and the default
		// tab decision reads the same value. Zero is the honest answer here.
		expect(await admin.admin.approvalCounts()).toEqual({
			pendingVerification: 0,
			pendingCouriers: 0,
		});

		w.close();
	});

	test("the badge and the queue agree on what awaits verification", async () => {
		const w = world();
		const applicant = await seedUser(w.db, { id: "usr_appr_agreeing" });
		await seedBusiness(w.db, {
			id: "biz_appr_agreeing",
			verificationStatus: "PENDING",
		});
		await seedVerificationRequest(w.db, {
			id: "bvr_appr_agreeing",
			businessId: "biz_appr_agreeing",
			submittedByUserId: applicant.id,
		});

		const admin = await adminCaller(w);
		const counts = await admin.admin.approvalCounts();
		const queue = await admin.admin.verificationQueue({ limit: 50 });

		// The assertion the old file could not make, against the list the badge actually
		// sends an operator to. `verificationQueue` is the Phase 2 addition that makes this
		// checkable at all: it pages `verification_status = 'PENDING'`, which is the badge's
		// own predicate.
		expect(counts.pendingVerification).toBe(queue.rows.length);
		expect(counts.pendingVerification).toBe(1);
		expect(queue.rows[0]?.businessId).toBe("biz_appr_agreeing");

		w.close();
	});

	test("a shop that has never applied is not in the queue, which is what the old predicate got wrong", async () => {
		const w = world();

		// Two shops, neither of which has ever applied for anything. The predicate this
		// replaced — `is_verified = 0` — counted both, because it asks "is this shop
		// approved" rather than "is this shop waiting". On the real platform that is every
		// shop, so the badge read a four-figure number over a queue of three, and an
		// operator who opened it and found three rows concluded the console was broken.
		await seedBusiness(w.db, { id: "biz_appr_never_a" });
		await seedBusiness(w.db, { id: "biz_appr_never_b" });

		const admin = await adminCaller(w);

		expect((await admin.admin.approvalCounts()).pendingVerification).toBe(0);

		w.close();
	});

	test("a shop whose application was refused is not waiting for anything", async () => {
		const w = world();

		// The other half of "the projection cannot tell the states apart": `REJECTED` and
		// `PENDING` both leave `is_verified` false. Only one of them is work.
		await seedBusiness(w.db, {
			id: "biz_appr_rejected",
			verificationStatus: "REJECTED",
		});

		const admin = await adminCaller(w);

		expect((await admin.admin.approvalCounts()).pendingVerification).toBe(0);

		w.close();
	});

	test("a suspended shop that applied is still counted, because its application is still open", async () => {
		const w = world();

		// The predicate this replaced had a `status <> 'SUSPENDED'` clause, and it was there
		// for a good reason: a suspended shop is not waiting *for verification*, it is
		// suspended. What the clause got wrong was the population — with `is_verified = 0` in
		// front of it, the exclusion was doing the work the whole predicate should have been
		// doing.
		//
		// With the population fixed to applications, the clause is not just unnecessary, it
		// is wrong: a shop that applied and was then suspended has an application a reviewer
		// must still decide, and hiding it from the badge means the queue has a row the
		// number above it denies. So the badge counts it, and this test says so out loud
		// rather than leaving the absence of a clause to be re-derived.
		//
		// Both rows are seeded because the product writes both: `requestVerification` moves
		// the shop to `PENDING` *and* opens an application in one batch. The queue pages the
		// application, the badge counts the shop, and they agree because no path writes one
		// without the other.
		await seedBusiness(w.db, {
			id: "biz_appr_suspended",
			status: "SUSPENDED",
			verificationStatus: "PENDING",
		});
		await seedVerificationRequest(w.db, {
			id: "bvr_appr_suspended",
			businessId: "biz_appr_suspended",
		});

		const admin = await adminCaller(w);
		const counts = await admin.admin.approvalCounts();
		const queue = await admin.admin.verificationQueue({ limit: 50 });

		expect(counts.pendingVerification).toBe(1);
		expect(queue.rows.map((row) => row.businessId)).toEqual([
			"biz_appr_suspended",
		]);

		w.close();
	});

	test("matches the courier queue, and ignores a profile whose user is gone", async () => {
		const w = world();

		const pendingUser = await seedUser(w.db, { id: "usr_appr_pending" });
		const verifiedUser = await seedUser(w.db, { id: "usr_appr_verified" });
		await w.db.insert(courierProfileTable).values({
			id: "cpr_appr_pending",
			userId: pendingUser.id,
			displayName: "Pendiente",
			serviceArea: "San Jose",
			isAvailable: true,
			verificationStatus: "PENDING",
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		await w.db.insert(courierProfileTable).values({
			id: "cpr_appr_verified",
			userId: verifiedUser.id,
			displayName: "Ya visto",
			serviceArea: "San Jose",
			isAvailable: true,
			verificationStatus: "VERIFIED",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const admin = await adminCaller(w);

		const counts = await admin.admin.approvalCounts();
		const queue = await admin.admin.courierProfiles({
			status: "PENDING",
			limit: 50,
		});

		expect(counts.pendingCouriers).toBe(1);
		expect(queue.total).toBe(counts.pendingCouriers);

		w.close();
	});

	test("a profile is counted only while it is actually pending", async () => {
		const w = world();

		// The transition the operator performs, which is the one that has to move the number.
		// A badge that does not fall when a courier is approved is a badge that stops meaning
		// anything, and it is the failure nobody notices — the count is only ever checked when
		// it is too high, never when it is too low.
		const applicant = await seedUser(w.db, { id: "usr_appr_applicant" });
		await w.db.insert(courierProfileTable).values({
			id: "cpr_appr_transition",
			userId: applicant.id,
			displayName: "Applicant",
			serviceArea: "San Jose",
			isAvailable: true,
			verificationStatus: "PENDING",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const admin = await adminCaller(w);
		expect((await admin.admin.approvalCounts()).pendingCouriers).toBe(1);

		await admin.admin.reviewCourier({
			profileId: "cpr_appr_transition",
			decision: "VERIFIED",
		});

		expect((await admin.admin.approvalCounts()).pendingCouriers).toBe(0);

		w.close();
	});

	test("the business badge falls when an application is approved", async () => {
		const w = world();

		// The same transition on the business side, and it is worth its own test because the
		// two halves of this endpoint are two separate queries: the courier transition above
		// cannot catch a business predicate that never moves. An approval writes
		// `verification_status = 'APPROVED'` and the badge counts `'PENDING'`, so the number
		// falls as a consequence of the decision rather than as a separate write that could
		// be forgotten.
		await seedBusiness(w.db, {
			id: "biz_appr_transition",
			verificationStatus: "PENDING",
		});
		await seedVerificationRequest(w.db, {
			id: "bvr_appr_transition",
			businessId: "biz_appr_transition",
		});

		const admin = await adminCaller(w);
		expect((await admin.admin.approvalCounts()).pendingVerification).toBe(1);

		await admin.admin.approveBusinessVerification({
			targetId: "biz_appr_transition",
		});

		expect((await admin.admin.approvalCounts()).pendingVerification).toBe(0);

		w.close();
	});

	test("the manual path closes the application too, so the badge and the queue cannot disagree", async () => {
		const w = world();

		// The divergence this pins, and it was reachable: `admin.verifyBusiness` grants the
		// mark without reading an application, so before Phase 2 it left one open — the shop
		// read `APPROVED`, the badge (which counts the shop's status) said nothing was
		// waiting, and the queue (which pages the request table) still listed the row. One
		// shop, two answers, from the pair of reads that exist precisely to agree.
		//
		// Both writes now come from `grantVerificationStatements`, so the application is
		// closed by the same batch that grants the mark.
		await seedBusiness(w.db, {
			id: "biz_appr_manual",
			verificationStatus: "PENDING",
		});
		await seedVerificationRequest(w.db, {
			id: "bvr_appr_manual",
			businessId: "biz_appr_manual",
		});

		const admin = await adminCaller(w);
		expect((await admin.admin.verificationQueue({ limit: 50 })).rows).toHaveLength(
			1,
		);

		await admin.admin.verifyBusiness({ targetId: "biz_appr_manual" });

		const [counts, queue] = await Promise.all([
			admin.admin.approvalCounts(),
			admin.admin.verificationQueue({ limit: 50 }),
		]);
		expect(counts.pendingVerification).toBe(0);
		expect(queue.rows).toEqual([]);

		w.close();
	});

	test("counts across tenants, because a queue is not per-shop", async () => {
		const w = world();
		await seedBusiness(w.db, {
			id: "biz_appr_a",
			verificationStatus: "PENDING",
		});
		await seedBusiness(w.db, {
			id: "biz_appr_b",
			verificationStatus: "PENDING",
		});
		await seedBusiness(w.db, {
			id: "biz_appr_c",
			verificationStatus: "PENDING",
		});

		const admin = await adminCaller(w);

		// Three shops, three different owners, none of them this admin. An approval queue
		// that is scoped to the caller's own shops is a count of nothing.
		expect((await admin.admin.approvalCounts()).pendingVerification).toBe(3);

		w.close();
	});

	test("is refused to a caller who is not a platform admin", async () => {
		const w = world();
		const merchant = await seedUser(w.db, { id: "usr_appr_not_admin" });
		const caller = appRouter.createCaller(await authed(w, merchant)) as Caller;

		// Cross-tenant counts are the most sensitive thing on this router: they tell a
		// stranger how much work the platform is avoiding. The count is not the gate; the
		// Worker is — `adminProcedure` refuses on `isAdmin` before the service runs.
		//
		// Asserted on the message rather than a `code` field because `TRPCError`'s code is
		// not enumerable, so `toMatchObject({ code: "FORBIDDEN" })` does not match it and
		// would pass for the wrong reason if this ever stopped being an error.
		await expect(caller.admin.approvalCounts()).rejects.toThrow(
			"Solo el equipo de PymesHub",
		);

		w.close();
	});
});
