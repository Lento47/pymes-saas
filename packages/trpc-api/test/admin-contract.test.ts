import { describe, expect, test } from "bun:test";
import {
	type AdminListInput,
	adminBusinessDetailSchema,
	adminUserDetailSchema,
} from "@pymeshub/shared";

import { requireAuthed } from "../src/context";
import * as admin from "../src/services/admin";
import * as adminContent from "../src/services/admin-content";
import * as subscriptions from "../src/services/subscription";
import type { TestWorld } from "./harness";
import {
	contextFor,
	refused,
	seedBusiness,
	seedMembership,
	seedOrder,
	seedPriceBook,
	seedSubscription,
	seedSupportTicket,
	seedUser,
	world,
} from "./harness";

/**
 * Row counts read straight from SQLite, by id or by any column.
 *
 * Through the service's own mapper these would answer "what does the read model say", which is
 * the wrong question for a deletion spec — the claim is about the table. And for a delete in
 * particular the read model is the thing most likely to have been deleted along with it.
 */
function countRows(
	w: TestWorld,
	table: string,
	value: string,
	byColumn = "id",
): number {
	const row = w.sqlite
		.query(`select count(*) as n from ${table} where ${byColumn} = ?`)
		.get(value) as { n: number };
	return row.n;
}

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
				prices: [
					{ plan: "EMPRENDE", cadence: "MONTHLY", minor: 3_000 },
					{ plan: "STARTER", cadence: "MONTHLY", minor: 18_000 },
				],
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
			after: {
				label: string;
				prices: { plan: string; cadence: string; minor: number }[];
			};
		};
		// The reason is the reason the operator typed, not a summary of it — it is the only
		// place this decision is ever explained.
		expect(meta.reason).toBe(
			"Subida de precio acordada para el segundo trimestre",
		);
		expect(meta.after.label).toBe("2027-Q2");
		// **The whole book is recorded, every pair.** This used to assert two columns, and
		// the shape is the point: a reader of this row has to be able to see every figure the
		// operator set without joining a table that a later price book will have moved on
		// from. A row naming only `monthlyMinor` would not say what an annual merchant was
		// charged.
		expect(meta.after.prices).toEqual([
			{ plan: "EMPRENDE", cadence: "MONTHLY", minor: 3_000 },
			{ plan: "STARTER", cadence: "MONTHLY", minor: 18_000 },
		]);

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
					prices: [
						{ plan: "EMPRENDE", cadence: "MONTHLY", minor: 3_000 },
						{ plan: "STARTER", cadence: "MONTHLY", minor: 18_000 },
					],
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

	test("a person reads as the detail envelope, with a nullable courier profile", async () => {
		const w = world();
		const adminUser = await seedUser(w.db, {
			id: "usr_detail_person",
			isAdmin: true,
		});
		const ctx = requireAuthed(await contextFor(w, adminUser));
		const customer = await seedUser(w.db, {
			id: "usr_plain",
			name: "Cliente Común",
		});

		const detail = adminUserDetailSchema.parse(
			await admin.userDetail(ctx, { id: customer.id }),
		);

		expect(detail.user.id).toBe(customer.id);
		/*
		 * `null`, not absent — most customers never become couriers, so "not a courier" has
		 * to be answerable, and the console draws a block only when this is truthy.
		 */
		expect(detail.courierProfile).toBeNull();
		expect(Array.isArray(detail.recentOrders)).toBe(true);
		expect(Array.isArray(detail.auditLog)).toBe(true);

		w.close();
	});

	describe("recording a payment", () => {
		/**
		 * A shop one period behind, with the numbers a real row carries.
		 *
		 * `daysUntilDue: -7` on a WEEKLY plan at ₡2,000 is one period owed: `periodEnd` is a
		 * week ago, so `periodsOwed` is 1 and `arrearsMinor` is 2,000.
		 */
		async function shop(daysUntilDue: number, priceMinor = 2_000) {
			const w = world();
			const admin = await seedUser(w.db, {
				id: "usr_pay_admin",
				isAdmin: true,
			});
			await seedBusiness(w.db, { id: "biz_pay", name: "Arreteros SA" });
			/**
			 * The book agrees with the row, because in a real system it always does.
			 *
			 * A renewal is priced from the book in force (`recordPayment`), while the amount
			 * being settled is the copy captured on the row — so a fixture that set the row
			 * to a figure its own price book did not carry would be asserting the two agree
			 * about a merchant that cannot exist.
			 */
			const priceBookId = await seedPriceBook(w.db, {
				prices: { "EMPRENDE:MONTHLY": priceMinor },
			});
			const subscriptionId = await seedSubscription(w.db, {
				businessId: "biz_pay",
				plan: "EMPRENDE",
				cadence: "MONTHLY",
				priceMinor,
				priceBookId,
				daysUntilDue,
			});
			return {
				w,
				ctx: requireAuthed(await contextFor(w, admin)),
				subscriptionId,
			};
		}

		test("the exact-amount payment succeeds — the case the API used to reject", async () => {
			const { w, ctx, subscriptionId } = await shop(-7);

			await admin.recordSubscriptionPayment(ctx, {
				subscriptionId,
				amountMinor: 2_000,
				reference: "SINPE-778899",
				reason: "Pago semanal del periodo vencido",
			});

			expect(
				w.sqlite
					.query(
						"select count(*) as n from audit_log where action = 'subscription.record_payment'",
					)
					.get() as { n: number },
			).toEqual({ n: 1 });

			w.close();
		});

		test("no reason is refused, and nothing is written", async () => {
			const { w, ctx, subscriptionId } = await shop(-7);

			const error = await refused(
				admin.recordSubscriptionPayment(ctx, {
					subscriptionId,
					amountMinor: 2_000,
					reference: "SINPE-778899",
					reason: "",
				}),
			);
			expect(error.code).toBe("BAD_REQUEST");

			expect(
				w.sqlite
					.query(
						"select count(*) as n from audit_log where action = 'subscription.record_payment'",
					)
					.get() as { n: number },
			).toEqual({ n: 0 });

			w.close();
		});

		test("the amount recorded is the one the operator typed", async () => {
			const { w, ctx, subscriptionId } = await shop(-7);

			// Overpayment: recorded rather than refused, because a merchant who sends more
			// than the invoice has made a mistake an operator should see, not an error.
			await admin.recordSubscriptionPayment(ctx, {
				subscriptionId,
				amountMinor: 11_000,
				reference: "SINPE-778899",
				reason: "El comercio envio de mas por error; se devuelve la diferencia",
			});

			const row = w.sqlite
				.query(
					"select meta as m from audit_log where action = 'subscription.record_payment'",
				)
				.get() as { m: string };
			const meta = JSON.parse(row.m) as {
				after: Record<string, number>;
				reference: string;
			};

			// Each figure named, so a reader six months later cannot confuse the money
			// collected with the successor period's price — which is what this row used to
			// call `priceMinor`.
			expect(meta.after.paidMinor).toBe(11_000);
			expect(meta.after.invoicedMinor).toBe(2_000);
			expect(meta.after.differenceMinor).toBe(9_000);
			expect(meta.after.writtenOffMinor).toBe(0);
			expect(meta.after.nextPeriodMinor).toBe(2_000);
			expect(meta.reference).toBe("SINPE-778899");

			w.close();
		});

		test("an underpayment is refused rather than granting a period", async () => {
			// The direction that matters. A payment grants a whole new period, so a shop that
			// paid ₡1 against a ₡2,000 invoice would walk away current. Before this change the
			// guard was unreachable — the caller passed the invoice, so the comparison was
			// `x !== x` — which would have made that possible.
			const { w, ctx, subscriptionId } = await shop(-7, 2_000);

			const error = await refused(
				admin.recordSubscriptionPayment(ctx, {
					subscriptionId,
					amountMinor: 1,
					reference: "SINPE-778899",
					reason: "Pago parcial incompleto",
				}),
			);
			expect(error.code).toBe("BAD_REQUEST");

			// And the period did not move.
			expect(
				w.sqlite.query("select count(*) as n from audit_log").get() as {
					n: number;
				},
			).toEqual({ n: 0 });

			w.close();
		});

		test("clearing several periods of debt records the ones nobody paid", async () => {
			// 61 days on a 30-day cadence: `periodEnd` is two whole periods old, so two
			// periods are owed — ₡4,000. One payment resets `periodEnd`, arrears is derived
			// from it, and the debt goes to zero. That is the intended rule (one period per
			// payment, no instalments), and `writtenOffMinor` is where it now says so.
			//
			// **Two periods and not three, because the cadence is 30 days.** The fixture used
			// to lean on a 7-day period that no longer exists; the claim it makes — that a
			// single payment forgives the debt beyond what it settles — is unaffected by which
			// cadence produces the arrears.
			const { w, ctx, subscriptionId } = await shop(-61);

			const before = await admin.subscriptions(ctx, {
				search: undefined,
				sort: "arrears",
				direction: "desc",
				limit: 25,
			});
			expect(before.rows[0]?.arrearsMinor).toBe(4_000);
			expect(before.rows[0]?.periodsOwed).toBe(2);

			await admin.recordSubscriptionPayment(ctx, {
				subscriptionId,
				amountMinor: 2_000,
				reference: "SINPE-778899",
				reason: "Se salda el periodo vencido; el resto se perdona por acuerdo",
			});

			const row = w.sqlite
				.query(
					"select meta as m from audit_log where action = 'subscription.record_payment'",
				)
				.get() as { m: string };
			const meta = JSON.parse(row.m) as {
				before: { arrearsMinor: number };
				after: { paidMinor: number; writtenOffMinor: number };
			};

			expect(meta.before.arrearsMinor).toBe(4_000);
			expect(meta.after.paidMinor).toBe(2_000);
			expect(meta.after.writtenOffMinor).toBe(2_000);

			w.close();
		});
	});

	/**
	 * The three list services, called the way only a test calls them.
	 *
	 * `businesses`, `users` and `orders` are typed `AdminListInput` — the schema's **output**
	 * — where `sort`, `direction` and `limit` are non-optional, so TypeScript believes every
	 * caller supplied them. The router does: it parses before calling. A direct caller does
	 * not, and the runtime had no answer for it.
	 */
	describe("a list service called without a parsed input", () => {
		test("defaults its own paging the way the schema does", async () => {
			const w = world();
			const operator = await seedUser(w.db, { id: "usr_bare", isAdmin: true });
			const ctx = requireAuthed(await contextFor(w, operator));
			await seedBusiness(w.db, { id: "biz_bare_1" });
			await seedBusiness(w.db, { id: "biz_bare_2" });

			// `{}` is not a valid `AdminListInput` and does not pretend to be: the cast is
			// the point, standing in for the untyped JS caller a script would be.
			const bare = {} as AdminListInput;

			// Before the fix each of these reached `order by  desc` — SQLite reads the empty
			// expression as a column name and refuses with `no such column: desc`, an error
			// about a column the request never mentioned.
			const businesses = await admin.businesses(ctx, bare);
			expect(businesses.rows.length).toBe(2);
			expect(businesses.total).toBe(2);

			// The operator themself is the only user, which is enough: the claim is that the
			// call returns, not what it returns.
			const users = await admin.users(ctx, bare);
			expect(users.rows.length).toBeGreaterThan(0);

			// No orders were seeded, so this is `0` — and **asserted as 0** rather than as
			// "did not throw", because a spec that only checked for the absence of a crash
			// would pass against a service that returned nothing for a reason of its own.
			const orders = await admin.orders(ctx, bare);
			expect(orders.rows).toEqual([]);
			expect(orders.total).toBe(0);

			w.close();
		});

		test("honours a sort that was actually asked for", async () => {
			// The other half of the same fix: defaulting must not become ignoring. Without a
			// sort the rows come back newest-first, and a spec that only checked the crash
			// would pass with a service that silently ignored every sort it was given.
			const w = world();
			const operator = await seedUser(w.db, { id: "usr_sort", isAdmin: true });
			const ctx = requireAuthed(await contextFor(w, operator));
			await seedBusiness(w.db, { id: "biz_sort_a", name: "Alfa" });
			await seedBusiness(w.db, { id: "biz_sort_b", name: "Zeta" });

			const ascending = await admin.businesses(ctx, {
				sort: "name",
				direction: "asc",
				limit: 25,
			} as AdminListInput);
			expect(ascending.rows[0]?.name).toBe("Alfa");

			const descending = await admin.businesses(ctx, {
				sort: "name",
				direction: "desc",
				limit: 25,
			} as AdminListInput);
			expect(descending.rows[0]?.name).toBe("Zeta");

			w.close();
		});
	});

	/**
	 * The two destructive procedures, and the guards that make them survivable.
	 *
	 * `business.delete` and `order.refund` were both in `ADMIN_ACTIONS` — and `business.delete`
	 * in `REASON_REQUIRED_ACTIONS` — with no procedure behind either. A policy that names an
	 * action nothing can perform is not a policy, and `REASON_REQUIRED_ACTIONS` had an entry
	 * describing a reason that no form in the console collected.
	 *
	 * What these specs are really about is the **refusals**, because a delete is judged by what
	 * it declines to delete.
	 */
	describe("the destructive procedures", () => {
		test("a business with an order cannot be deleted", async () => {
			// `order.business_id` is `onDelete: "restrict"`, so the database would refuse this
			// anyway — but as a raw constraint failure, with no shop name and no advice. The
			// service refuses first so the operator gets a sentence.
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_del_order",
				isAdmin: true,
			});
			const customer = await seedUser(w.db, { id: "usr_del_order_cust" });
			const businessId = await seedBusiness(w.db, { id: "biz_del_order" });
			await seedOrder(w.db, { businessId, customerId: customer.id });
			const ctx = requireAuthed(await contextFor(w, operator));

			const error = await refused(
				admin.deleteBusiness(ctx, {
					targetId: businessId,
					reason: "Limpieza de pruebas",
				}),
			);
			expect(error.code).toBe("CONFLICT");
			// The advice is the point: an operator who wanted this shop gone almost always
			// wanted it invisible, and suspension is reversible.
			expect(error.message).toContain("Suspender");

			expect(countRows(w, "business", businessId)).toBe(1);
			w.close();
		});

		test("a business with a subscription cannot be deleted — its arrears would vanish", async () => {
			// The one that the foreign keys do **not** protect. `subscription.business_id`
			// cascades, so a delete takes `periodEnd` and `priceMinor` with it, and a merchant
			// three periods into debt becomes a merchant with no subscription: which is how debt
			// disappears without anything looking like an event.
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_del_sub",
				isAdmin: true,
			});
			const businessId = await seedBusiness(w.db, { id: "biz_del_sub" });
			await seedSubscription(w.db, {
				businessId,
				plan: "STARTER",
				priceMinor: 10_000,
				daysUntilDue: -60,
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			// Confirm the debt is real before trying to destroy it, so this cannot pass by
			// accident against a fixture that owed nothing. Sixty days on a thirty-day plan is
			// **two** periods, so ₡20,000 — and the number matters, because the whole argument
			// is that two periods' worth of debt evaporates with the row.
			const owed = await admin.subscriptions(ctx, {
				search: undefined,
				sort: "arrears",
				direction: "desc",
				limit: 25,
			} as never);
			expect(owed.rows[0]?.periodsOwed).toBe(2);
			expect(owed.rows[0]?.arrearsMinor).toBe(20_000);

			const error = await refused(
				admin.deleteBusiness(ctx, {
					targetId: businessId,
					reason: "Limpieza de pruebas",
				}),
			);
			expect(error.code).toBe("CONFLICT");
			expect(countRows(w, "business", businessId)).toBe(1);
			expect(countRows(w, "subscription", businessId, "business_id")).toBe(1);

			w.close();
		});

		test("an abandoned business with none of those is deleted, and the record survives", async () => {
			// The useful case: a signup that never traded, never paid and never asked anything.
			// And the audit row is written **before** the delete, in its own statement, because
			// `audit_log` holds no foreign key to `business` — which is the only reason the
			// record of this deletion outlives the row it describes.
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_del_ok",
				isAdmin: true,
			});
			const businessId = await seedBusiness(w.db, {
				id: "biz_del_ok",
				name: "Never Trades",
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			const result = await admin.deleteBusiness(ctx, {
				targetId: businessId,
				reason: "Registro abandonado, nunca operó",
			});
			expect(result.id).toBe(businessId);
			expect(countRows(w, "business", businessId)).toBe(0);

			const entry = w.sqlite
				.query("select action, meta as m from audit_log")
				.get() as { action: string; m: string };
			expect(entry.action).toBe("business.delete");
			const meta = JSON.parse(entry.m) as {
				before: { name: string };
				after: unknown;
				reason: string;
			};
			// The name and slug travel with the audit row, because after the delete there is
			// nothing else on the platform that knows this shop ever existed.
			expect(meta.before.name).toBe("Never Trades");
			expect(meta.after).toBeNull();
			expect(meta.reason).toBe("Registro abandonado, nunca operó");

			w.close();
		});

		test("what support said outlives the shop it was said to", async () => {
			// The reason `support.reply` and `support.resolve` are audited at all.
			//
			// `ADMIN_ACTIONS` justifies it as a record that "outlives the ticket row and is
			// what makes a disputed answer checkable later" — and `support_ticket` is one of
			// the tables that cascade from `business`. So the conversation is the thing that does
			// *not* survive, and the audit entry is the only copy.
			//
			// Note the tension with the delete guard: this ticket **blocks** the delete. Both
			// are deliberate — the guard is the primary protection, and the audit row is what
			// remains for the conversations that predate the guard.
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_surv_admin",
				isAdmin: true,
			});
			const merchant = await seedUser(w.db, { id: "usr_surv_merchant" });
			const businessId = await seedBusiness(w.db, { id: "biz_surv" });
			await seedMembership(w.db, merchant.id, businessId, "OWNER");
			const ticketId = await seedSupportTicket(w.db, {
				id: "tkt_surv",
				businessId,
				openedBy: merchant.id,
				subject: "No me aparece el comprobante",
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			await adminContent.replyOnTicket(ctx, {
				ticketId,
				body: "Lo enviamos por WhatsApp, llega en minutos.",
			});
			await adminContent.resolveTicket(ctx, {
				ticketId,
				status: "RESOLVED",
				note: "Comprobante reenviado y confirmado.",
			});

			expect(
				w.sqlite
					.query("select action, meta as m from audit_log order by created_at")
					.all() as { action: string; m: string }[],
			).toHaveLength(2);

			// The **body** is in the audit entry, not just the fact of a reply. An entry saying
			// "an operator replied at 14:02" without the text is not checkable, and checkability
			// is the stated purpose.
			const reply = w.sqlite
				.query("select meta as m from audit_log where action = 'support.reply'")
				.get() as { m: string };
			expect(
				(JSON.parse(reply.m) as { after: { body: string } }).after.body,
			).toBe("Lo enviamos por WhatsApp, llega en minutos.");

			const resolve = w.sqlite
				.query(
					"select meta as m from audit_log where action = 'support.resolve'",
				)
				.get() as { m: string };
			const meta = JSON.parse(resolve.m) as {
				before: { status: string };
				after: { status: string };
			};
			// `before` is the ticket's previous status, so the entry says what it moved from as
			// well as to.
			expect(meta.before.status).toBe("OPEN");
			expect(meta.after.status).toBe("RESOLVED");

			// And the claim itself, checked rather than asserted: delete the business behind the
			// guard's back — a cascade, so the conversation goes — and confirm the audit rows
			// are still there afterwards. `deleteBusiness` refuses this exact case, so the
			// service is the *primary* protection and these rows are what remains for the
			// conversations that predate it.
			w.sqlite.run("delete from business where id = ?", [businessId]);
			expect(countRows(w, "support_ticket", ticketId)).toBe(0);
			expect(
				countRows(w, "support_ticket_message", ticketId, "ticket_id"),
			).toBe(0);
			expect(countRows(w, "audit_log", ticketId, "target_id")).toBe(2);

			w.close();
		});

		test("deleting a business without a reason is refused, and writes nothing", async () => {
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_del_nr",
				isAdmin: true,
			});
			const businessId = await seedBusiness(w.db, { id: "biz_del_nr" });
			const ctx = requireAuthed(await contextFor(w, operator));

			const error = await refused(
				admin.deleteBusiness(ctx, { targetId: businessId, reason: "  " }),
			);
			expect(error.code).toBe("BAD_REQUEST");
			expect(countRows(w, "business", businessId)).toBe(1);
			expect(
				w.sqlite.query("select count(*) as n from audit_log").get() as {
					n: number;
				},
			).toEqual({ n: 0 });

			w.close();
		});

		test("a refund needs a reason, and records the amount", async () => {
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_refund",
				isAdmin: true,
			});
			const customer = await seedUser(w.db, { id: "usr_refund_cust" });
			const businessId = await seedBusiness(w.db, { id: "biz_refund" });
			const orderId = await seedOrder(w.db, {
				businessId,
				customerId: customer.id,
				paymentStatus: "PAID",
				totalMinor: 18_500,
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			const error = await refused(
				admin.refundOrder(ctx, { targetId: orderId, reason: "" }),
			);
			expect(error.code).toBe("BAD_REQUEST");

			const row = await admin.refundOrder(ctx, {
				targetId: orderId,
				reason: "El cliente|reportó que nunca llegó",
			});

			// Fulfilment is untouched: the order still happened. A refund moves payment, not
			// the food.
			expect(row.status).toBe("COMPLETED");
			expect(row.paymentStatus).toBe("REFUNDED");

			const entry = w.sqlite
				.query("select action, meta as m from audit_log")
				.get() as { action: string; m: string };
			expect(entry.action).toBe("order.refund");
			const meta = JSON.parse(entry.m) as {
				before: { paymentStatus: string };
				after: { paymentStatus: string; refundedMinor: number };
			};
			expect(meta.before.paymentStatus).toBe("PAID");
			expect(meta.after.paymentStatus).toBe("REFUNDED");
			// The amount is here because nothing else in the system records it: there is no
			// settlement, so the audit row is the only trace that money was meant to go back.
			expect(meta.after.refundedMinor).toBe(18_500);

			w.close();
		});

		test("an unpaid order cannot be refunded, and a paid one cannot be refunded twice", async () => {
			// Both halves matter for real money. Refunding an `UNPAID` order invents a refund
			// for a payment that never happened; refunding a `REFUNDED` one is the double claim
			// that costs actual money against an actual provider.
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_refund_g",
				isAdmin: true,
			});
			const customer = await seedUser(w.db, { id: "usr_refund_g_cust" });
			const businessId = await seedBusiness(w.db, { id: "biz_refund_g" });
			const unpaidId = await seedOrder(w.db, {
				id: "ord_refund_unpaid",
				businessId,
				customerId: customer.id,
				paymentStatus: "UNPAID",
			});
			const paidId = await seedOrder(w.db, {
				id: "ord_refund_paid",
				businessId,
				customerId: customer.id,
				paymentStatus: "PAID",
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			const unpaidError = await refused(
				admin.refundOrder(ctx, {
					targetId: unpaidId,
					reason: "Prueba sin pago",
				}),
			);
			expect(unpaidError.code).toBe("CONFLICT");
			expect(unpaidError.message).toContain("no tiene un pago capturado");

			await admin.refundOrder(ctx, {
				targetId: paidId,
				reason: "Primera devolución",
			});
			const twice = await refused(
				admin.refundOrder(ctx, {
					targetId: paidId,
					reason: "Segunda devolución",
				}),
			);
			expect(twice.code).toBe("CONFLICT");
			expect(twice.message).toContain("ya fue reembolsado");

			// One audit row, not two: the second attempt was refused, not performed.
			expect(
				w.sqlite
					.query(
						"select count(*) as n from audit_log where action = 'order.refund'",
					)
					.get() as { n: number },
			).toEqual({ n: 1 });

			w.close();
		});
	});

	/**
	 * The two acts that had no way back.
	 *
	 * `suspendUser` could cut a person off and `grantAdmin` could hand out the platform flag,
	 * and neither had a counterpart. An admin who should not be one any more had to be
	 * "suspended as a user, or demoted in SQL" — the service's own docblock said so — and
	 * both routes are worse than a procedure: the SQL route writes no actor, no timestamp and
	 * no audit entry, so "who restored this account" has no answer anywhere.
	 *
	 * Four claims, and the third is the one that protects the platform rather than a user:
	 *
	 * 1. lifting a suspension restores access and records **when it started**, not just that
	 *    there was one;
	 * 2. revoking admin is a removal, so it demands a reason — and the refusal writes nothing;
	 * 3. **an admin cannot revoke their own flag**, because if they are the last one the
	 *    console becomes unreachable and nothing in it can undo that;
	 * 4. both are idempotent, so a retry does not manufacture a second audit entry for one act.
	 */
	describe("reversing a decision", () => {
		/**
		 * The flag straight out of SQLite.
		 *
		 * Not the service's own return value: these assertions are about whether the *column*
		 * moved, and reading it back through the same mapper that would have shaped a refusal
		 * into a success would test the mapper instead of the write.
		 */
		const isAdminIn = (w: { sqlite: TestWorld["sqlite"] }, id: string) =>
			(
				w.sqlite
					.query("select is_admin as a from user where id = ?")
					.get(id) as {
					a: number;
				}
			).a === 1;

		test("lifting a suspension restores access and records when it began", async () => {
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_rev_admin",
				isAdmin: true,
			});
			const suspendedAt = new Date(Date.now() - 3 * 86_400_000);
			const target = await seedUser(w.db, {
				id: "usr_rev_target",
				suspendedAt,
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			const row = await admin.reactivateUser(ctx, { targetId: target.id });

			// `isSuspended`, not `suspendedAt`: the row carries a flag and the audit entry carries the
			// timestamp. Splitting them this way is what lets the log answer *when*, which a
			// boolean on the row could not.
			expect(row.isSuspended).toBe(false);

			const entry = w.sqlite
				.query("select action, meta as m from audit_log where target_id = ?")
				.get(target.id) as { action: string; m: string };
			expect(entry.action).toBe("user.reactivate");

			// The suspension's own timestamp, so "how long was this account cut off" is
			// answerable from the audit log alone.
			const meta = JSON.parse(entry.m) as {
				before: { suspendedAt: string | null };
				after: { suspendedAt: string | null };
			};
			expect(meta.before.suspendedAt).toBe(suspendedAt.toISOString());
			expect(meta.after.suspendedAt).toBeNull();

			w.close();
		});

		test("lifting a suspension twice writes one audit row, not two", async () => {
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_idem_admin",
				isAdmin: true,
			});
			const target = await seedUser(w.db, {
				id: "usr_idem_target",
				suspendedAt: new Date(),
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			await admin.reactivateUser(ctx, { targetId: target.id });
			await admin.reactivateUser(ctx, { targetId: target.id });

			const count = w.sqlite
				.query(
					"select count(*) as n from audit_log where action = 'user.reactivate'",
				)
				.get() as { n: number };
			expect(count.n).toBe(1);

			w.close();
		});

		test("revoking admin without a reason is refused, and writes nothing", async () => {
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_revreq_admin",
				isAdmin: true,
			});
			const target = await seedUser(w.db, {
				id: "usr_revreq_target",
				isAdmin: true,
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			const error = await refused(
				admin.revokeAdmin(ctx, { userId: target.id, reason: "  " }),
			);
			expect(error.code).toBe("BAD_REQUEST");

			// The flag is still on. A refused demotion that demoted anyway would be the whole
			// bug this pair exists to close, one layer down.
			expect(isAdminIn(w, target.id)).toBe(true);
			expect(
				w.sqlite.query("select count(*) as n from audit_log").get() as {
					n: number;
				},
			).toEqual({ n: 0 });

			w.close();
		});

		test("revoking admin takes the flag, with the reason in the audit entry", async () => {
			const w = world();
			const operator = await seedUser(w.db, {
				id: "usr_revok_admin",
				isAdmin: true,
			});
			const target = await seedUser(w.db, {
				id: "usr_revok_target",
				isAdmin: true,
			});
			const ctx = requireAuthed(await contextFor(w, operator));

			const row = await admin.revokeAdmin(ctx, {
				userId: target.id,
				reason: "Dejamos de pertenecer al equipo",
			});
			expect(row.isAdmin).toBe(false);

			const entry = w.sqlite
				.query("select action, meta as m from audit_log")
				.get() as { action: string; m: string };
			expect(entry.action).toBe("user.revoke_admin");

			const meta = JSON.parse(entry.m) as {
				before: { isAdmin: boolean };
				after: { isAdmin: boolean };
				reason: string | null;
			};
			expect(meta.before.isAdmin).toBe(true);
			expect(meta.after.isAdmin).toBe(false);
			expect(meta.reason).toBe("Dejamos de pertenecer al equipo");

			w.close();
		});

		test("an admin cannot revoke their own flag", async () => {
			// The refusal that protects the platform. Every route into this console runs
			// through `adminProcedure`, so the last admin demoting themselves leaves nobody
			// who can undo it — and they cannot know they are the last, because that count
			// lives in `admin.metrics` rather than in the row in front of them.
			const w = world();
			const sole = await seedUser(w.db, {
				id: "usr_sole_admin",
				isAdmin: true,
			});
			const ctx = requireAuthed(await contextFor(w, sole));

			const error = await refused(
				admin.revokeAdmin(ctx, {
					userId: sole.id,
					reason: "Me toca salir a mí",
				}),
			);
			expect(error.code).toBe("BAD_REQUEST");

			expect(isAdminIn(w, sole.id)).toBe(true);

			w.close();
		});
	});
});
