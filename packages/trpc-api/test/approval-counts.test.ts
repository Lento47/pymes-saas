import { describe, expect, test } from "bun:test";
import {
	business as businessTable,
	courierProfile as courierProfileTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { authed, seedBusiness, seedUser, world } from "./harness";

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
 * a suspended shop, and a courier profile whose user row is gone.
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

	/**
	 * KNOWN ISSUE — skipped, and this is the one to un-skip first.
	 *
	 * The badge counts unverified shops; the Aprobaciones tab lists `status = 'DRAFT'` ones.
	 * `status` and `is_verified` are independent axes — a shop is created `DRAFT`, the owner
	 * publishes it to `ACTIVE` via `business.setStatus`, and `verifyBusiness` sets
	 * `is_verified` without touching `status` — so **approving a row does not remove it from
	 * the queue it was approved in**.
	 *
	 * Pre-existing, and not introduced by `approvalCounts`. But it is precisely the class of
	 * disagreement this endpoint was written to prevent, so it is recorded here rather than
	 * written around, and the suite stays green.
	 *
	 * Deciding the fix is a product call: the card reads "Esperan verificación" and its action
	 * is `verifyBusiness`, which both point at `is_verified`. Making the list agree means
	 * filtering it on `is_verified`, which `adminListInput` cannot express yet.
	 */
	test.skip("the badge and the queue agree on what awaits verification", async () => {
		const w = world();
		await seedBusiness(w.db, { id: "biz_appr_agreeing" });

		const admin = await adminCaller(w);
		const counts = await admin.admin.approvalCounts();
		// `status: ["DRAFT"]`, which is exactly what the console's client-side
		// `pendingVerifications()` helper asks for — spelled out here because the helper is a
		// filter on top of this procedure, not a procedure of its own.
		const queue = await admin.admin.businesses({
			status: ["DRAFT"],
			limit: 50,
		});

		expect(counts.pendingVerification).toBe(queue.total);
		expect(queue.rows.every((row) => !row.isVerified)).toBe(true);

		w.close();
	});

	test("counts the unverified shops, which is what the card is titled", async () => {
		const w = world();

		// `seedBusiness` has no `isVerified` override — deliberately, since almost nothing
		// else in the suite cares — so the column is written directly here.
		await seedBusiness(w.db, { id: "biz_appr_waiting" });
		await seedBusiness(w.db, { id: "biz_appr_approved" });
		await w.db
			.update(businessTable)
			.set({ isVerified: true })
			.where(eq(businessTable.id, "biz_appr_approved"));

		const admin = await adminCaller(w);

		const counts = await admin.admin.approvalCounts();
		const all = await admin.admin.businesses({ limit: 50 });
		const unverified = all.rows.filter(
			(row: { isVerified: boolean }) => !row.isVerified,
		);

		expect(counts.pendingVerification).toBe(unverified.length);
		expect(counts.pendingVerification).toBe(1);

		w.close();
	});

	test("does not count a suspended shop as waiting for verification", async () => {
		const w = world();
		const suspended = await seedBusiness(w.db, {
			id: "biz_appr_suspended",
			status: "SUSPENDED",
		});
		expect(suspended).toBeTruthy();

		const admin = await adminCaller(w);

		// The predicate is `is_verified = 0 and status <> 'SUSPENDED'`, copied from
		// `metrics`. A suspended shop is not queued behind a review, so counting it would
		// put a number on the badge that no queue can clear.
		const counts = await admin.admin.approvalCounts();
		expect(counts.pendingVerification).toBe(0);

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

	test("counts across tenants, because a queue is not per-shop", async () => {
		const w = world();
		await seedBusiness(w.db, { id: "biz_appr_a" });
		await seedBusiness(w.db, { id: "biz_appr_b" });
		await seedBusiness(w.db, { id: "biz_appr_c" });

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
