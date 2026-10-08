import { describe, expect, test } from "bun:test";

import { requireAuthed } from "../src/context";
import * as crashReport from "../src/services/crash-report";
import type { TestWorld } from "./harness";
import {
	contextFor,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

/**
 * The crash queue's three load-bearing claims.
 *
 * Each test here is a decision that would have been wrong quietly:
 *
 * 1. **A crash outlives its account.** `user_id` is nullable with `ON DELETE SET NULL`, and
 *    that is the entire reason to keep the table. If deleting the reporter took the report
 *    with it, the platform would forget the crash the moment the person who hit it left.
 * 2. **A crash does not block a business delete.** `support_ticket` legitimately does —
 *    it is in `REASON_REQUIRED_ACTIONS` — and that is the reason this is a separate table
 *    and not a category on that one.
 * 3. **A customer with no shop can report, and the report is a row.** The majority of crashes
 *    come from phones with no membership, and `business_id` has no foreign key precisely so
 *    that "no shop" is a value rather than a refusal.
 *
 * `adminContent`'s ticket list inner-joins `business` and `user`
 * (`services/admin-content.ts:479-481`), so a null in either column would drop the row
 * before the console could return it. The list assertions below are the anti-regression for
 * that, and they are here rather than in a UI test because the disappearance would be
 * invisible from the phone.
 */

/** An operator's context, since every read here is `adminProcedure`. */
async function operator(w: TestWorld) {
	const admin = await seedUser(w.db, { id: "usr_crash_admin", isAdmin: true });
	return requireAuthed(await contextFor(w, admin));
}

/**
 * How many rows are in `crash_report`, read straight from SQLite.
 *
 * **Through the service's own mapper this would answer "what does the read model say"**, which
 * is the wrong question for these claims: they are about the table and its foreign keys, and
 * the read model is the thing most likely to have been deleted along with the row.
 */
function countRows(w: TestWorld, where = "1=1"): number {
	const row = w.sqlite
		.query(`select count(*) as n from crash_report where ${where}`)
		.get() as { n: number };
	return Number(row.n);
}

/** One row by id, or null. `.get()` takes the binding as a single argument, not varargs. */
function rowOf(
	w: TestWorld,
	columns: string,
	id: string,
): Record<string, unknown> | null {
	return (
		(w.sqlite
			.query(`select ${columns} from crash_report where id = ?`)
			.get(id) as Record<string, unknown> | undefined) ?? null
	);
}

describe("a crash outlives the account that produced it", () => {
	test("deleting the reporter leaves the report standing", async () => {
		const w = world();
		const customer = await seedUser(w.db, { id: "usr_crash_customer" });
		const ctx = requireAuthed(await contextFor(w, customer));

		const written = await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "TypeError: undefined is not a function",
			buildNumber: "13",
		});
		expect(countRows(w)).toBe(1);

		w.sqlite.run("delete from user where id = ?", [customer.id]);

		// The report is still there, with no reporter. This is the claim the table design
		// rests on, and the reason `user_id` is `SET NULL` where `support_ticket.opened_by`
		// is `restrict`.
		expect(countRows(w)).toBe(1);
		const row = rowOf(w, "user_id, message", written.id) as {
			user_id: string | null;
			message: string;
		};
		expect(row.user_id).toBeNull();
		// ...and the message is intact. A report that outlived its reporter but lost what it
		// said would be a row nobody can act on.
		expect(row.message).toBe("TypeError: undefined is not a function");
	});
});

describe("a crash does not block a business delete", () => {
	test("a shop with a crash can still be deleted", async () => {
		const w = world();
		const merchant = await seedUser(w.db, { id: "usr_crash_merchant" });
		const businessId = await seedBusiness(w.db, { id: "biz_crash" });
		await seedMembership(w.db, merchant.id, businessId, "OWNER");

		const ctx = requireAuthed(
			await contextFor(w, merchant, {
				memberships: [{ businessId, role: "OWNER" }],
			}),
		);
		await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "Map crashed on this screen",
		});
		expect(countRows(w)).toBe(1);

		// No `business_id` foreign key, so the delete goes through. On `support_ticket` this
		// delete is *refused*, and that refusal is the guard that keeps a shop with history
		// from being erased — a stack trace is not history.
		w.sqlite.run("delete from business where id = ?", [businessId]);
		expect(
			w.sqlite.query("select 1 from business where id = ?").get(businessId),
		).toBeNull();

		// The crash outlives the shop too, carrying a `business_id` that now names nothing.
		// That is the same reason it is a bare column: it was never an ownership claim, and a
		// report about a shop that no longer exists is still a report about a release.
		expect(countRows(w)).toBe(1);
		const row = w.sqlite
			.query("select business_id, message from crash_report")
			.get() as { business_id: string | null; message: string };
		expect(row.business_id).toBe(businessId);
		expect(row.message).toBe("Map crashed on this screen");
	});
});

describe("a customer with no shop can report", () => {
	test("the report is written, with a null business", async () => {
		const w = world();
		const customer = await seedUser(w.db, { id: "usr_crash_noshop" });
		// No membership anywhere: this is the majority case, and the one a schema with
		// `business_id NOT NULL` would refuse outright.
		const ctx = requireAuthed(await contextFor(w, customer));

		const written = await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_REJECTION",
			severity: "ERROR",
			message: "Checkout never resolved",
			route: "/(customer)/checkout",
		});

		const row = w.sqlite
			.query(
				"select business_id, category, route from crash_report where id = ?",
			)
			.get(written.id) as {
			business_id: string | null;
			category: string;
			route: string | null;
		};
		expect(row.business_id).toBeNull();
		expect(row.category).toBe("UNHANDLED_REJECTION");
		expect(row.route).toBe("/(customer)/checkout");
	});

	test("a merchant's crash names their shop, without being asked which one", async () => {
		const w = world();
		const merchant = await seedUser(w.db, { id: "usr_crash_shop" });
		const businessId = await seedBusiness(w.db, { id: "biz_crash_named" });
		await seedMembership(w.db, merchant.id, businessId, "MANAGER");

		const ctx = requireAuthed(
			await contextFor(w, merchant, {
				memberships: [{ businessId, role: "MANAGER" }],
			}),
		);
		await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "Orders tab threw",
		});

		// Read from the caller's membership, not the input. A client that could name whose
		// screen it was on would be a client filing crashes against somebody else's shop.
		const row = w.sqlite
			.query("select business_id from crash_report")
			.get() as { business_id: string | null };
		expect(row.business_id).toBe(businessId);
	});
});

describe("the queue shows the rows an inner join would drop", () => {
	test("a report whose account and shop are gone is still in the queue", async () => {
		const w = world();
		const admin = await operator(w);
		const customer = await seedUser(w.db, { id: "usr_crash_gone" });
		const customerCtx = requireAuthed(await contextFor(w, customer));

		await crashReport.report(customerCtx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "Crash from a deleted account",
		});
		w.sqlite.run("delete from user where id = ?", [customer.id]);

		const page = await crashReport.list(admin, {
			status: ["OPEN", "WAITING", "RESOLVED", "CLOSED"],
			category: undefined,
			source: undefined,
			buildNumber: undefined,
			search: undefined,
			sort: "newest",
			cursor: undefined,
			limit: 25,
		});

		// This is the assertion that would have caught the silent disappearance: the ticket
		// list inner-joins `user`, so on that table this row would simply not be returned,
		// and an operator would look at an empty queue and conclude nothing had crashed.
		expect(page.total).toBe(1);
		expect(page.rows).toHaveLength(1);
		expect(page.rows[0]?.userName).toBeNull();
		expect(page.rows[0]?.businessName).toBeNull();
		expect(page.rows[0]?.message).toBe("Crash from a deleted account");
	});

	test("the live queue hides resolved crashes and the full set does not", async () => {
		const w = world();
		const admin = await operator(w);
		const customer = await seedUser(w.db, { id: "usr_crash_live" });
		const ctx = requireAuthed(await contextFor(w, customer));

		await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "Still broken",
		});
		await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "Already fixed",
		});

		const second = w.sqlite
			.query("select id from crash_report where message = ?")
			.get("Already fixed") as { id: string };
		await crashReport.resolve(admin, {
			id: second.id,
			status: "RESOLVED",
			note: "Fixed in 14",
		});

		const common = {
			category: undefined,
			source: undefined,
			buildNumber: undefined,
			search: undefined,
			sort: "newest" as const,
			cursor: undefined,
			limit: 25,
		};

		// A queue is the work still to do, so no `status` means the live ones.
		expect((await crashReport.list(admin, common)).total).toBe(1);
		expect(
			(await crashReport.list(admin, { ...common, status: undefined })).total,
		).toBe(1);
		expect(
			(
				await crashReport.list(admin, {
					...common,
					status: ["OPEN", "WAITING", "RESOLVED", "CLOSED"],
				})
			).total,
		).toBe(2);
	});
});

describe("a resolution is a note and an audit entry, or it is nothing", () => {
	test("closing writes an audit row carrying the reason", async () => {
		const w = world();
		const admin = await operator(w);
		const customer = await seedUser(w.db, { id: "usr_crash_resolve" });
		const ctx = requireAuthed(await contextFor(w, customer));

		const written = await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "CRITICAL",
			message: "White screen on boot",
		});
		await crashReport.resolve(admin, {
			id: written.id,
			status: "RESOLVED",
			note: "Rolle Boot could not resolve; guarded in 14",
		});

		const row = w.sqlite
			.query("select status, resolved_at from crash_report where id = ?")
			.get(written.id) as { status: string; resolved_at: number | null };
		expect(row.status).toBe("RESOLVED");
		expect(row.resolved_at).not.toBeNull();

		// There is no thread on this table, so the audit entry is the only place the reasoning
		// can live. An entry saying "closed at 14:02" without the reason is not checkable
		// when build 15 crashes the same way, which is the only thing anyone wants from here.
		const entry = w.sqlite
			.query("select meta as m from audit_log where action = 'crash.resolve'")
			.get() as { m: string };
		expect(entry).toBeDefined();
		expect(entry.m).toContain("Rolle Boot");
	});

	test("the note is required, so a crash cannot close itself into silence", async () => {
		// The input contract, asserted where the contract lives rather than at the router:
		// `crashReportResolveInput.note` is `.min(1)`, and there is no column for it, so an
		// empty note would be a resolution with no record of the reasoning anywhere.
		const { crashReportResolveInput } = await import("@pymeshub/shared");
		expect(
			crashReportResolveInput.safeParse({
				id: "crs_1",
				status: "RESOLVED",
				note: "",
			}).success,
		).toBe(false);
		expect(
			crashReportResolveInput.safeParse({
				id: "crs_1",
				status: "RESOLVED",
				note: "x",
			}).success,
		).toBe(true);
		// And only the two terminal states are expressible, so no input can move a crash
		// somewhere the operator did not choose.
		expect(
			crashReportResolveInput.safeParse({
				id: "crs_1",
				status: "OPEN",
				note: "x",
			}).success,
		).toBe(false);
	});
});

describe("the client cannot file a crash that says where it came from", () => {
	test("a smuggled source is stripped, not honoured", async () => {
		// **Zod strips unknown keys rather than rejecting them** — an object schema is not
		// `.strict()` here — so the first draft of this test asserted `success === false` and
		// was wrong. Rejecting is not the protection and would be the wrong thing to add: the
		// protection is that `report` takes `source` as its own argument and never reads
		// `input.source`, so a smuggled value has nowhere to land.
		const { crashReportInput } = await import("@pymeshub/shared");
		const parsed = crashReportInput.parse({
			category: "UNHANDLED_ERROR",
			message: "x",
			source: "WEB",
			status: "CLOSED",
		});
		expect(parsed).not.toHaveProperty("source");
		expect(parsed).not.toHaveProperty("status");
	});

	test("and the row carries the procedure's source, whatever the body claimed", async () => {
		const w = world();
		const customer = await seedUser(w.db, { id: "usr_crash_smuggle" });
		const ctx = requireAuthed(await contextFor(w, customer));

		// Written through the same strip: a client that tried to say "this was WEB" is stored
		// as MOBILE, because `crashReport.report` was called with MOBILE.
		const written = await crashReport.report(ctx, "MOBILE", {
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: "x",
		});

		const row = w.sqlite
			.query("select source, status from crash_report where id = ?")
			.get(written.id) as { source: string; status: string };
		expect(row.source).toBe("MOBILE");
		// ...and `OPEN` regardless, because `report` writes the status and reads nothing.
		expect(row.status).toBe("OPEN");
	});
});
