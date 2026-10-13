import { describe, expect, test } from "bun:test";

import { requireAuthed } from "../src/context";
import * as idea from "../src/services/idea";
import type { TestWorld } from "./harness";
import {
	contextFor,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

/**
 * The ideas queue's load-bearing claims.
 *
 * 1. **An idea outlives its account.** `user_id` is nullable with `ON DELETE SET NULL`.
 * 2. **An idea does not block a business delete.** `support_ticket` does; this table must not.
 * 3. **A customer with no shop can submit, and the report is a row.**
 * 4. **Role is derived from memberships, never from the body.**
 */

async function operator(w: TestWorld) {
	const admin = await seedUser(w.db, { id: "usr_idea_admin", isAdmin: true });
	return requireAuthed(await contextFor(w, admin));
}

function countRows(w: TestWorld, where = "1=1"): number {
	const row = w.sqlite
		.query(`select count(*) as n from idea where ${where}`)
		.get() as { n: number };
	return Number(row.n);
}

function rowOf(
	w: TestWorld,
	columns: string,
	id: string,
): Record<string, unknown> | null {
	return (
		(w.sqlite
			.query(`select ${columns} from idea where id = ?`)
			.get(id) as Record<string, unknown> | undefined) ?? null
	);
}

describe("an idea outlives the account that produced it", () => {
	test("deleting the reporter leaves the idea standing", async () => {
		const w = world();
		const customer = await seedUser(w.db, { id: "usr_idea_customer" });
		const ctx = requireAuthed(await contextFor(w, customer));

		const written = await idea.create(ctx, {
			subject: "Remember last address",
			body: "The cart should offer the last delivery address.",
		});
		expect(countRows(w)).toBe(1);

		w.sqlite.run("delete from user where id = ?", [customer.id]);

		expect(countRows(w)).toBe(1);
		const row = rowOf(w, "user_id, subject", written.id) as {
			user_id: string | null;
			subject: string;
		};
		expect(row.user_id).toBeNull();
		expect(row.subject).toBe("Remember last address");
	});
});

describe("an idea does not block a business delete", () => {
	test("a shop with an idea can still be deleted", async () => {
		const w = world();
		const merchant = await seedUser(w.db, { id: "usr_idea_merchant" });
		const businessId = await seedBusiness(w.db, { id: "biz_idea" });
		await seedMembership(w.db, merchant.id, businessId, "OWNER");

		const ctx = requireAuthed(
			await contextFor(w, merchant, {
				memberships: [{ businessId, role: "OWNER" }],
			}),
		);
		await idea.create(ctx, {
			subject: "Bulk CSV",
			body: "Let me upload the catalogue as a spreadsheet.",
		});
		expect(countRows(w)).toBe(1);

		w.sqlite.run("delete from business where id = ?", [businessId]);
		expect(
			w.sqlite.query("select 1 from business where id = ?").get(businessId),
		).toBeNull();

		expect(countRows(w)).toBe(1);
		const row = w.sqlite
			.query("select business_id, subject from idea")
			.get() as { business_id: string | null; subject: string };
		expect(row.business_id).toBe(businessId);
		expect(row.subject).toBe("Bulk CSV");
	});
});

describe("who the submitter was is the session's, not the body's", () => {
	test("a customer with no shop writes CUSTOMER and a null business", async () => {
		const w = world();
		const customer = await seedUser(w.db, { id: "usr_idea_noshop" });
		const ctx = requireAuthed(await contextFor(w, customer));

		const written = await idea.create(ctx, {
			subject: "Dark map",
			body: "The map is hard to read at night.",
		});

		const row = w.sqlite
			.query(
				"select business_id, role_at_submit, status from idea where id = ?",
			)
			.get(written.id) as {
			business_id: string | null;
			role_at_submit: string;
			status: string;
		};
		expect(row.business_id).toBeNull();
		expect(row.role_at_submit).toBe("CUSTOMER");
		expect(row.status).toBe("OPEN");
	});

	test("a merchant's idea names their shop as MERCHANT", async () => {
		const w = world();
		const merchant = await seedUser(w.db, { id: "usr_idea_shop" });
		const businessId = await seedBusiness(w.db, { id: "biz_idea_named" });
		await seedMembership(w.db, merchant.id, businessId, "MANAGER");

		const ctx = requireAuthed(
			await contextFor(w, merchant, {
				memberships: [{ businessId, role: "MANAGER" }],
			}),
		);
		await idea.create(ctx, {
			subject: "Prep time",
			body: "Let me set prep time per product.",
		});

		const row = w.sqlite.query("select business_id, role_at_submit from idea").get() as {
			business_id: string | null;
			role_at_submit: string;
		};
		expect(row.business_id).toBe(businessId);
		expect(row.role_at_submit).toBe("MERCHANT");
	});

	test("a courier-only membership files as COURIER", async () => {
		const w = world();
		const courier = await seedUser(w.db, { id: "usr_idea_courier" });
		const businessId = await seedBusiness(w.db, { id: "biz_idea_courier" });
		await seedMembership(w.db, courier.id, businessId, "COURIER");

		const ctx = requireAuthed(
			await contextFor(w, courier, {
				memberships: [{ businessId, role: "COURIER" }],
			}),
		);
		await idea.create(ctx, {
			subject: "Zone pin",
			body: "Let me save more than one delivery zone.",
		});

		const row = w.sqlite.query("select role_at_submit from idea").get() as {
			role_at_submit: string;
		};
		expect(row.role_at_submit).toBe("COURIER");
	});

	test("a merchant who also delivers still files as MERCHANT", async () => {
		const w = world();
		const person = await seedUser(w.db, { id: "usr_idea_both" });
		const shopId = await seedBusiness(w.db, { id: "biz_idea_own" });
		const otherId = await seedBusiness(w.db, { id: "biz_idea_other" });
		await seedMembership(w.db, person.id, shopId, "OWNER");
		await seedMembership(w.db, person.id, otherId, "COURIER");

		const ctx = requireAuthed(
			await contextFor(w, person, {
				memberships: [
					{ businessId: shopId, role: "OWNER" },
					{ businessId: otherId, role: "COURIER" },
				],
			}),
		);
		await idea.create(ctx, {
			subject: " dual role",
			body: "I own one shop and deliver for another.",
		});

		const row = w.sqlite.query("select role_at_submit from idea").get() as {
			role_at_submit: string;
		};
		expect(row.role_at_submit).toBe("MERCHANT");
	});
});

describe("the queue shows the rows an inner join would drop", () => {
	test("an idea whose account is gone is still in the queue", async () => {
		const w = world();
		const admin = await operator(w);
		const customer = await seedUser(w.db, { id: "usr_idea_gone" });
		const customerCtx = requireAuthed(await contextFor(w, customer));

		await idea.create(customerCtx, {
			subject: "From a deleted account",
			body: "Keep this even if I leave.",
		});
		w.sqlite.run("delete from user where id = ?", [customer.id]);

		const page = await idea.list(admin, {
			status: ["OPEN", "CLOSED"],
			role: undefined,
			search: undefined,
			sort: "newest",
			cursor: undefined,
			limit: 25,
		});

		expect(page.total).toBe(1);
		expect(page.rows).toHaveLength(1);
		expect(page.rows[0]?.userName).toBeNull();
		expect(page.rows[0]?.businessName).toBeNull();
		expect(page.rows[0]?.subject).toBe("From a deleted account");
	});

	test("the live queue hides closed ideas and the full set does not", async () => {
		const w = world();
		const admin = await operator(w);
		const customer = await seedUser(w.db, { id: "usr_idea_live" });
		const ctx = requireAuthed(await contextFor(w, customer));

		await idea.create(ctx, {
			subject: "Still open",
			body: "Please look at this.",
		});
		await idea.create(ctx, {
			subject: "Already done",
			body: "This one is finished.",
		});

		const second = w.sqlite
			.query("select id from idea where subject = ?")
			.get("Already done") as { id: string };
		await idea.resolve(admin, {
			id: second.id,
			status: "CLOSED",
			note: "Shipped in the next release.",
		});

		const common = {
			role: undefined,
			search: undefined,
			sort: "newest" as const,
			cursor: undefined,
			limit: 25,
		};

		expect((await idea.list(admin, common)).total).toBe(1);
		expect(
			(await idea.list(admin, { ...common, status: undefined })).total,
		).toBe(1);
		expect(
			(await idea.list(admin, { ...common, status: ["OPEN", "CLOSED"] })).total,
		).toBe(2);
	});
});

describe("a submitter only sees their own ideas", () => {
	test("listMine does not return another person's row", async () => {
		const w = world();
		const alice = await seedUser(w.db, { id: "usr_idea_alice" });
		const bob = await seedUser(w.db, { id: "usr_idea_bob" });
		const aliceCtx = requireAuthed(await contextFor(w, alice));
		const bobCtx = requireAuthed(await contextFor(w, bob));

		await idea.create(aliceCtx, {
			subject: "Alice's idea",
			body: "Only Alice should see this.",
		});
		await idea.create(bobCtx, {
			subject: "Bob's idea",
			body: "Only Bob should see this.",
		});

		const mine = await idea.listMine(bobCtx, {
			status: undefined,
			limit: 50,
		});
		expect(mine.rows).toHaveLength(1);
		expect(mine.rows[0]?.subject).toBe("Bob's idea");
	});
});

describe("a resolution is a note and an audit entry, or it is nothing", () => {
	test("closing writes an audit row carrying the reason", async () => {
		const w = world();
		const admin = await operator(w);
		const customer = await seedUser(w.db, { id: "usr_idea_resolve" });
		const ctx = requireAuthed(await contextFor(w, customer));

		const written = await idea.create(ctx, {
			subject: "Saved carts",
			body: "Keep the cart across devices.",
		});
		await idea.resolve(admin, {
			id: written.id,
			status: "CLOSED",
			note: "On the roadmap for Q4.",
		});

		const row = w.sqlite
			.query("select status, resolved_at from idea where id = ?")
			.get(written.id) as { status: string; resolved_at: number | null };
		expect(row.status).toBe("CLOSED");
		expect(row.resolved_at).not.toBeNull();

		const entry = w.sqlite
			.query("select meta as m from audit_log where action = 'idea.resolve'")
			.get() as { m: string };
		expect(entry).toBeDefined();
		expect(entry.m).toContain("On the roadmap for Q4.");
	});

	test("the note is required, so an idea cannot close itself into silence", async () => {
		const { ideaResolveInput } = await import("@pymeshub/shared");
		expect(
			ideaResolveInput.safeParse({
				id: "ida_1",
				status: "CLOSED",
				note: "",
			}).success,
		).toBe(false);
		expect(
			ideaResolveInput.safeParse({
				id: "ida_1",
				status: "CLOSED",
				note: "x",
			}).success,
		).toBe(true);
		expect(
			ideaResolveInput.safeParse({
				id: "ida_1",
				status: "OPEN",
				note: "x",
			}).success,
		).toBe(false);
	});
});

describe("the client cannot file an idea that says who it is or how it ended", () => {
	test("a smuggled role and status are stripped, not honoured", async () => {
		const { ideaCreateInput } = await import("@pymeshub/shared");
		const parsed = ideaCreateInput.parse({
			subject: "x",
			body: "y",
			roleAtSubmit: "MERCHANT",
			status: "CLOSED",
		});
		expect(parsed).not.toHaveProperty("roleAtSubmit");
		expect(parsed).not.toHaveProperty("status");
	});
});
