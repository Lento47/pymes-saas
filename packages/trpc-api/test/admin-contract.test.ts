import { describe, expect, test } from "bun:test";
import { adminBusinessDetailSchema } from "@pymeshub/shared";

import { requireAuthed } from "../src/context";
import * as admin from "../src/services/admin";
import * as subscriptions from "../src/services/subscription";
import { contextFor, refused, seedBusiness, seedUser, world } from "./harness";

/**
 * What the platform console is allowed to do, asserted where it actually happens.
 *
 * Two things live here, and both exist because of a defect that reached production.
 *
 * ## The audit row for a price rise
 *
 * `createPriceBook` staged a rise with a bare `insert` — no `audit_log`, no reason, no
 * actor — while `subscription.create_price_book` sat in `ADMIN_ACTIONS` and in
 * `REASON_REQUIRED_ACTIONS` the whole time. The policy said a price rise carries a reason
 * "the same way removing a storefront does", and the one operator action that repriced
 * every future merchant was the one nobody could name a performer for six months later.
 * The spec below pins the row and the refusal together, because either alone is weaker:
 * an audit row with no gate is a record nobody has to justify anything in, and a gate
 * with no row is a form that goes nowhere.
 *
 * ## The console's shape of a business
 *
 * See `adminBusinessDetailSchema`'s own docblock. The short version is that
 * `admin.business` answers with an envelope and the console parsed it as a row, so
 * `adminApi.business` threw a `ZodError` for every shop on the platform and the detail
 * sheet could only ever render its error state. Nothing compared the service's real return
 * value to the schema the client parses with, so this file is that comparison.
 *
 * ## Why it parses instead of asserting fields
 *
 * A field-by-field assertion proves the fields it names and is silent about the ones it
 * does not. `schema.parse(serviceOutput)` fails on *any* drift — a renamed key, a new
 * required column, a row that stopped carrying the actor — which is the whole class of bug
 * this file exists for.
 */
describe("platform console contracts", () => {
	test("staging a price rise writes exactly one audit row, with its actor", async () => {
		const w = world();
		const admin = await seedUser(w.db, { id: "usr_pb_admin", isAdmin: true });
		const ctx = requireAuthed(await contextFor(w, admin));

		await subscriptions.createPriceBook(
			ctx,
			{
				label: "2027-Q2",
				weeklyMinor: 3_000,
				monthlyMinor: 18_000,
				effectiveFrom: new Date(Date.now() + 30 * 86_400_000),
				reason: "Subida de precio acordada para el segundo trimestre",
			},
			new Date(),
		);

		// Read through the database rather than through the service: the claim is about a
		// row, and a service that returned its own writes would agree with itself.
		const rows = w.sqlite
			.query(
				"select actor_user_id as actor, action, meta from audit_log where action = 'subscription.create_price_book'",
			)
			.all() as { actor: string; action: string; meta: string }[];

		// `toHaveLength` above is the assertion that matters for the index below: reading
		// `rows[0]` unguarded would be a second claim about the same thing, and this file
		// does not make its claims twice.
		const [entry] = rows;
		expect(rows).toHaveLength(1);
		expect(entry?.actor).toBe(admin.id);

		const meta = JSON.parse(entry?.meta ?? "{}") as {
			reason: string;
			after: { label: string; monthlyMinor: number };
		};
		// The reason is the reason the operator typed, not a summary of it — it is the only
		// place this decision is ever explained.
		expect(meta.reason).toBe(
			"Subida de precio acordada para el segundo trimestre",
		);
		expect(meta.after.label).toBe("2027-Q2");
		expect(meta.after.monthlyMinor).toBe(18_000);

		w.close();
	});

	test("a price rise without a reason is refused, and writes nothing", async () => {
		const w = world();
		const admin = await seedUser(w.db, {
			id: "usr_pb_noreason",
			isAdmin: true,
		});
		const ctx = requireAuthed(await contextFor(w, admin));

		// Blank rather than absent, because the input schema already refuses `undefined`
		// and that would be testing zod. This is the service-level gate, which is the one
		// a direct caller reaches — a router, a script, or the next service that needs it.
		const error = await refused(
			subscriptions.createPriceBook(
				ctx,
				{
					label: "Sin motivo",
					weeklyMinor: 3_000,
					monthlyMinor: 18_000,
					effectiveFrom: new Date(Date.now() + 30 * 86_400_000),
					reason: "   ",
				},
				new Date(),
			),
		);
		expect(error.code).toBe("BAD_REQUEST");

		// Neither half of the write survives the refusal: a refused rise that still left a
		// `price_book` row would be the exact bug this file was written for, with the audit
		// row as a bonus.
		expect(
			w.sqlite.query("select count(*) as n from price_book").get() as {
				n: number;
			},
		).toEqual({ n: 0 });
		expect(
			w.sqlite.query("select count(*) as n from audit_log").get() as {
				n: number;
			},
		).toEqual({ n: 0 });

		w.close();
	});

	test("a business reads as the detail envelope the console parses", async () => {
		const w = world();
		const adminUser = await seedUser(w.db, { id: "usr_detail", isAdmin: true });
		const ctx = requireAuthed(await contextFor(w, adminUser));
		const businessId = await seedBusiness(w.db, { id: "biz_detail" });

		/*
		 * The single assertion that matters, and the one nothing was making before: the
		 * service's real return value, parsed with the schema the console parses with. It
		 * fails on any drift — a renamed key, a new required column, a row that stopped
		 * carrying its actor — where a field-by-field assertion would stay green.
		 *
		 * The console was parsing this envelope as a bare row, so `adminApi.business`
		 * threw for every business on the platform and the detail sheet could only render
		 * its error state.
		 */
		const detail = adminBusinessDetailSchema.parse(
			await admin.business(ctx, { id: businessId }),
		);

		expect(detail.business.id).toBe(businessId);
		// Both lists are `z.array(...)`, so an absent one would parse as `undefined` and
		// fail here rather than as a blank panel in the sheet.
		expect(Array.isArray(detail.recentOrders)).toBe(true);
		expect(Array.isArray(detail.auditLog)).toBe(true);

		w.close();
	});
});
