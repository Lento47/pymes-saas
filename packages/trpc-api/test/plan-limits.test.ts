import { describe, expect, test } from "bun:test";
import { addToCartInput, productCreateInput } from "@pymeshub/shared";
import {
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	PLAN_LIMITS,
	priceMinorFor,
} from "@pymeshub/shared/plans";

import { requireAuthed } from "../src/context";
import { appRouter } from "../src/routers";
import * as subscriptions from "../src/services/subscription";
import {
	authed,
	contextFor,
	daysAgo,
	refused,
	seedBusiness,
	seedCategory,
	seedMembership,
	seedPriceBook,
	seedProduct,
	seedSubscription,
	seedUser,
	world,
} from "./harness";

/**
 * What a merchant may do, and what happens when they stop paying.
 *
 * Four claims, and the second is the one that costs money if it is wrong:
 *
 * 1. **A plan's limits are enforced at the create path**, and the refusal names the
 *    plan that would lift it. A limit nothing enforces is not a limit.
 * 2. **The status is derived, never trusted.** A subscription whose stored `status`
 *    says `ACTIVE` while its dates say otherwise must be treated as lapsed — otherwise
 *    a merchant keeps access on the strength of a column nobody has written to.
 * 3. **Grace keeps everything, and only `SUSPENDED` unlists a shop.** They are separate
 *    states because a shop that stops paying should lose its tools before it loses its
 *    customers.
 * 4. **A price rise does not reach a merchant who already subscribed.** This is the
 *    whole mechanism behind "raise the price as the app grows", and it has no other
 *    safety net.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

/**
 * A minimal product payload.
 *
 * The helper exists because `productCreateInput` does not carry `businessId` — the
 * router's own `scopedProduct` adds it — so every call has to be an intersection. Five
 * copies of that intersection is five chances to forget the status, and a spec that
 * forgot it would be counting **drafts** against the active-product cap.
 */
function newProduct(businessId: string, name: string) {
	return {
		...productCreateInput.parse({
			name,
			priceMinor: 1_000,
			status: "ACTIVE",
		}),
		businessId,
	};
}

function newLocation(businessId: string, name: string) {
	return {
		businessId,
		name,
		line1: "Avenida Central",
		city: "San José",
		region: "San José",
		country: "CR",
	};
}

async function monthlyOwner(w: ReturnType<typeof world>) {
	const businessId = await seedBusiness(w.db, {
		id: "biz_limit_monthly",
		plan: "MONTHLY",
	});
	const owner = await seedUser(w.db, { id: "usr_limit_owner" });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	return {
		businessId,
		caller: appRouter.createCaller(await authed(w, owner)) as Caller,
	};
}

describe("a plan's limits", () => {
	test("a weekly shop is refused at twenty-five products and told what to do", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_limit_weekly",
			plan: "WEEKLY",
		});
		const owner = await seedUser(w.db, { id: "usr_limit_weekly_owner" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		// Seed to exactly the cap. A refusal at the cap and a refusal *over* it are
		// different bugs, and this pins the boundary from below.
		for (let index = 0; index < PLAN_LIMITS.WEEKLY.products; index += 1) {
			await caller.products.create(newProduct(businessId, `Producto ${index}`));
		}

		const error = await refused(
			caller.products.create(newProduct(businessId, "El que no cabe")),
		);
		// A `ForbiddenError` carrying `QUOTA_EXCEEDED`, not a validation error: the
		// request was well-formed and the answer is "not on this plan".
		expect(error.code).toBe("FORBIDDEN");
		const details = error.details as {
			error: string;
			limit: string;
			current: number;
			max: number;
			plan: string;
			upgradeTo: string;
		};
		expect(details.error).toBe("QUOTA_EXCEEDED");
		expect(details.limit).toBe("products");
		expect(details.current).toBe(PLAN_LIMITS.WEEKLY.products);
		expect(details.max).toBe(PLAN_LIMITS.WEEKLY.products);
		expect(details.plan).toBe("WEEKLY");
		// The actionable half: what they would have to move to.
		expect(details.upgradeTo).toBe("MONTHLY");

		w.close();
	});

	test("a monthly shop is not refused where a weekly one is", async () => {
		const w = world();
		const { businessId, caller } = await monthlyOwner(w);

		for (let index = 0; index < PLAN_LIMITS.WEEKLY.products + 1; index += 1) {
			await caller.products.create(newProduct(businessId, `Producto ${index}`));
		}

		// The same count that was refused above is fine here. Without this, the spec
		// above would pass against a limit that is simply set too high.
		//
		// Counted in SQL rather than through `products.list`, whose page size is twenty:
		// the assertion is about the cap, and a list call would cap the *evidence* at
		// twenty and quietly pass a limit set to nineteen.
		const stored = w.sqlite
			.prepare(
				"select count(*) as n from product where business_id = ? and status = 'ACTIVE'",
			)
			.get(businessId) as { n: number };
		expect(stored.n).toBe(PLAN_LIMITS.WEEKLY.products + 1);

		w.close();
	});

	test("an archived product does not count against the cap", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_limit_archived",
			plan: "WEEKLY",
		});
		const owner = await seedUser(w.db, { id: "usr_limit_archived" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		const created: string[] = [];
		for (let index = 0; index < PLAN_LIMITS.WEEKLY.products; index += 1) {
			const row = await caller.products.create(
				newProduct(businessId, `Producto ${index}`),
			);
			created.push(row.id);
		}

		await refused(caller.products.create(newProduct(businessId, "No cabe")));

		// Archive one and the number goes down. A merchant who tidies their menu has to
		// see the cap respond, or they delete things for nothing.
		await caller.products.update({
			businessId,
			id: created[0] as string,
			status: "ARCHIVED",
		});

		const room = await caller.products.create(
			newProduct(businessId, "Ahora sí cabe"),
		);
		expect(room.id).toBeTruthy();

		w.close();
	});

	test("a rider is not an employee, so the weekly cap does not refuse one", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_limit_rider",
			plan: "WEEKLY",
		});
		const owner = await seedUser(w.db, { id: "usr_rider_owner" });
		// Both riders exist before either is invited: the invitee must already hold an
		// account, and "a rider has to sign up before a shop can ask them" is a separate
		// rule this spec must not end up measuring instead of the cap.
		const first = await seedUser(w.db, {
			id: "usr_rider_one",
			email: "repartidor.uno@example.test",
		});
		const second = await seedUser(w.db, {
			id: "usr_rider_two",
			email: "repartidor.dos@example.test",
		});
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		// The state that refused every rider in production, pinned before the fix is
		// credited for anything: the owner alone already fills the weekly cap, so the
		// number the check reads is at the limit before a single rider is invited.
		const employees = w.sqlite
			.prepare(
				"select count(*) as n from membership where business_id = ? and role <> 'COURIER'",
			)
			.get(businessId) as { n: number };
		expect(employees.n).toBeGreaterThanOrEqual(
			PLAN_LIMITS.WEEKLY.staffAccounts,
		);

		// Two riders, not one. The second is the assertion that matters: a fix that merely
		// let the first one through would satisfy a shop which only ever needs one rider at
		// a time, which is not the claim — a shop takes a second order while the first is
		// still out.
		const one = await caller.business.inviteStaff({
			businessId,
			email: "repartidor.uno@example.test",
			role: "COURIER",
		});
		expect(one.userId).toBe(first.id);
		expect(one.role).toBe("COURIER");
		const two = await caller.business.inviteStaff({
			businessId,
			email: "repartidor.dos@example.test",
			role: "COURIER",
		});
		expect(two.userId).toBe(second.id);

		// Stored as memberships, which is what `orders.assignCourier` resolves an assignee
		// against: a rider who is not a member of the shop cannot be handed a run, so the
		// row is the whole of what "added" means here.
		const stored = w.sqlite
			.prepare(
				"select count(*) as n from membership where business_id = ? and role = 'COURIER'",
			)
			.get(businessId) as { n: number };
		expect(stored.n).toBe(2);

		// The cap still bites where it was always meant to. Without this the spec would
		// also pass against a service that had stopped counting employees altogether,
		// which is the opposite repair.
		await seedUser(w.db, {
			id: "usr_rider_employee",
			email: "empleado@example.test",
		});
		const error = await refused(
			caller.business.inviteStaff({
				businessId,
				email: "empleado@example.test",
				role: "STAFF",
			}),
		);
		expect(error.code).toBe("FORBIDDEN");
		const details = error.details as { error: string; limit: string };
		expect(details.error).toBe("QUOTA_EXCEEDED");
		expect(details.limit).toBe("staffAccounts");

		// A MONTHLY shop, whose cap is three, still refuses the fourth employee. The
		// number differs from the spec above; the rule does not.
		const { businessId: monthlyId, caller: monthlyCaller } =
			await monthlyOwner(w);
		for (const email of ["a@example.test", "b@example.test"]) {
			await seedUser(w.db, { id: `usr_monthly_emp_${email}`, email });
			await monthlyCaller.business.inviteStaff({
				businessId: monthlyId,
				email,
				role: "STAFF",
			});
		}
		await seedUser(w.db, { id: "usr_monthly_emp_c", email: "c@example.test" });
		const monthlyError = await refused(
			monthlyCaller.business.inviteStaff({
				businessId: monthlyId,
				email: "c@example.test",
				role: "STAFF",
			}),
		);
		expect(monthlyError.code).toBe("FORBIDDEN");

		w.close();
	});

	test("inventory tracking is refused on the weekly plan and allowed on the monthly one", async () => {
		const w = world();

		const weeklyId = await seedBusiness(w.db, {
			id: "biz_limit_inv_weekly",
			plan: "WEEKLY",
		});
		const weeklyOwner = await seedUser(w.db, { id: "usr_inv_weekly" });
		await seedMembership(w.db, weeklyOwner.id, weeklyId, "OWNER");
		const weeklyCaller = appRouter.createCaller(
			await authed(w, weeklyOwner),
		) as Caller;

		const error = await refused(
			weeklyCaller.products.create({
				...newProduct(weeklyId, "Con inventario"),
				trackInventory: true,
			}),
		);
		expect(error.code).toBe("FORBIDDEN");

		const { businessId: monthlyId, caller: monthlyCaller } =
			await monthlyOwner(w);
		const ok = await monthlyCaller.products.create({
			...newProduct(monthlyId, "Con inventario"),
			trackInventory: true,
		});
		// `ProductCard` carries no `trackInventory` — it is a member's field, not a
		// storefront one — so acceptance is the assertion and the read-back is the only
		// way to see the value that was stored.
		const stored = w.sqlite
			.prepare("select track_inventory from product where id = ?")
			.get(ok.id) as { track_inventory: number };
		expect(stored.track_inventory).toBe(1);

		w.close();
	});
});

describe("lapsing", () => {
	test("a merchant past due reads as past due even when the stored status says active", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_lapse_derived",
			plan: "MONTHLY",
		});
		const owner = await seedUser(w.db, { id: "usr_lapse_owner" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");

		// 45 days past a period end: past the 30-day grace, inside the 90-day window.
		// `storedStatus: "ACTIVE"` is the whole point — a sweeper that never ran must
		// not be what decides whether a shop keeps its tools.
		await seedSubscription(w.db, {
			businessId,
			plan: "MONTHLY",
			daysUntilDue: -45,
			storedStatus: "ACTIVE",
		});

		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;
		const current = await caller.subscription.current({ businessId });
		expect(current?.status).toBe("PAST_DUE");
		// Still listed. A shop that stopped paying keeps its customers for another 45
		// days; the punishment is the tools, not the storefront.
		expect(current?.listed).toBe(true);
		// And the price it was paying, not today's.
		expect(current?.priceMinor).toBe(10_000);

		w.close();
	});

	test("a shop past due is held to the weekly limits, and a current one is not", async () => {
		const w = world();

		// Current, on the monthly plan, with the cap raised so a second branch is
		// possible at all. **No plan allows two**, which is why the two specs that need
		// it raise the cap rather than seed something the pricing forbids.
		const okId = await seedBusiness(w.db, {
			id: "biz_lapse_ok",
			plan: "MONTHLY",
			raiseLimits: { locations: 2 },
		});
		const okOwner = await seedUser(w.db, { id: "usr_lapse_ok" });
		await seedMembership(w.db, okOwner.id, okId, "OWNER");
		await seedSubscription(w.db, {
			businessId: okId,
			plan: "MONTHLY",
			daysUntilDue: 10,
		});
		const okCaller = appRouter.createCaller(await authed(w, okOwner)) as Caller;
		await okCaller.business.createLocation(newLocation(okId, "Sucursal 2"));

		// Past due: the same call, on the floor plan's cap of one. No `raiseLimits` here
		// — that is the assertion. A shop thirty days late has lost the second branch
		// it was entitled to.
		const lateId = await seedBusiness(w.db, {
			id: "biz_lapse_late",
			plan: "MONTHLY",
		});
		const lateOwner = await seedUser(w.db, { id: "usr_lapse_late" });
		await seedMembership(w.db, lateOwner.id, lateId, "OWNER");
		await seedSubscription(w.db, {
			businessId: lateId,
			plan: "MONTHLY",
			daysUntilDue: -45,
		});
		const lateCaller = appRouter.createCaller(
			await authed(w, lateOwner),
		) as Caller;

		const error = await refused(
			lateCaller.business.createLocation(newLocation(lateId, "Sucursal 2")),
		);
		expect(error.code).toBe("FORBIDDEN");

		w.close();
	});

	test("suspended is the only state that unlists a shop, and it takes ninety days", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, { id: "biz_lapse_hidden" });
		const owner = await seedUser(w.db, { id: "usr_lapse_hidden" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		// Inside grace, and the *stored* status claims the worst thing possible. The
		// derived status is the answer.
		await seedSubscription(w.db, {
			businessId,
			daysUntilDue: -10,
			storedStatus: "SUSPENDED",
		});
		const inGrace = await caller.subscription.current({ businessId });
		expect(inGrace?.status).toBe("GRACE");
		expect(inGrace?.listed).toBe(true);

		// Past grace, inside the hidden window: still listed.
		await seedSubscription(w.db, {
			id: `sub_hidden_late_${businessId}`,
			businessId,
			daysUntilDue: -(GRACE_DAYS + 10),
		});
		const pastGrace = await caller.subscription.current({ businessId });
		expect(pastGrace?.status).toBe("PAST_DUE");
		expect(pastGrace?.listed).toBe(true);

		// Past the hidden window: unlisted.
		await seedSubscription(w.db, {
			id: `sub_hidden_gone_${businessId}`,
			businessId,
			daysUntilDue: -(HIDDEN_AFTER_DAYS + 5),
		});
		const gone = await caller.subscription.current({ businessId });
		expect(gone?.status).toBe("SUSPENDED");
		expect(gone?.listed).toBe(false);

		w.close();
	});
});

describe("price", () => {
	test("a rise reaches a new subscription and not an existing one", async () => {
		const w = world();

		await seedPriceBook(w.db, {
			id: "pbk_launch",
			weeklyMinor: 2_000,
			monthlyMinor: 10_000,
			effectiveFrom: daysAgo(90),
		});
		const earlyId = await seedBusiness(w.db, {
			id: "biz_price_early",
			plan: "MONTHLY",
		});
		const earlyOwner = await seedUser(w.db, { id: "usr_price_early" });
		await seedMembership(w.db, earlyOwner.id, earlyId, "OWNER");
		const earlyCaller = appRouter.createCaller(
			await authed(w, earlyOwner),
		) as Caller;

		await earlyCaller.subscription.changePlan({
			businessId: earlyId,
			plan: "MONTHLY",
		});
		expect(
			(await earlyCaller.subscription.current({ businessId: earlyId }))
				?.priceMinor,
		).toBe(10_000);

		// The rise, dated forward. Staging it rather than applying it now is what
		// `effectiveFrom` exists for.
		const admin = await seedUser(w.db, {
			id: "usr_price_admin",
			isAdmin: true,
		});
		// `requireAuthed` rather than `authed`: a price book is written through the
		// service, and the service takes a `UserContext`. The narrowing is the same one
		// `adminProcedure` performs, and the spec bypasses the router on purpose — it is
		// testing the price mechanism, not the admin guard.
		const adminCtx = requireAuthed(await contextFor(w, admin));
		await subscriptions.createPriceBook(
			adminCtx,
			{
				label: "2027",
				weeklyMinor: 2_500,
				monthlyMinor: 14_000,
				effectiveFrom: new Date(Date.now() + 30 * 86_400_000),
			},
			new Date(),
		);

		// The existing shop is untouched: still the price it agreed to.
		const unchanged = await earlyCaller.subscription.current({
			businessId: earlyId,
		});
		expect(unchanged?.priceMinor).toBe(10_000);

		// A book dated in the past *is* the current one, and the picker follows it. The
		// clock is moved forward rather than the date back: `createPriceBook` refuses a
		// past `effectiveFrom` precisely so a rise cannot be retroactive, and a spec must
		// not route around that guard to set one up.
		const laterClock = new Date(Date.now() + 31 * 86_400_000);
		const book = await subscriptions.activePriceBook(w.db, laterClock);
		expect(book.monthlyMinor).toBe(14_000);
		expect(book.label).toBe("2027");
		expect(priceMinorFor("MONTHLY", book)).toBe(14_000);

		// The early shop is *still* on 10,000, at the later clock too. This is the
		// assertion that fails if `priceMinor` were read through the book at charge time
		// instead of captured when the period began.
		expect(
			(await earlyCaller.subscription.current({ businessId: earlyId }))
				?.priceMinor,
		).toBe(10_000);

		w.close();
	});

	test("a price book dated in the past is refused", async () => {
		const w = world();
		const admin = await seedUser(w.db, {
			id: "usr_price_past_admin",
			isAdmin: true,
		});
		const adminCtx = requireAuthed(await contextFor(w, admin));

		// Retroactive by construction: it would reprice everybody who joined since.
		const error = await refused(
			subscriptions.createPriceBook(
				adminCtx,
				{
					label: "Backdated",
					weeklyMinor: 3_000,
					monthlyMinor: 18_000,
					effectiveFrom: daysAgo(10),
				},
				new Date(),
			),
		);
		expect(error.code).toBe("BAD_REQUEST");

		w.close();
	});

	test("the plan picker shows the effective plan and the IVA split", async () => {
		const w = world();
		await seedPriceBook(w.db, { monthlyMinor: 10_000, weeklyMinor: 2_000 });
		const businessId = await seedBusiness(w.db, {
			id: "biz_picker",
			plan: "MONTHLY",
		});
		const owner = await seedUser(w.db, { id: "usr_picker" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		const { options } = await caller.subscription.options({ businessId });
		expect(options).toHaveLength(2);
		const monthly = options.find((option) => option.plan === "MONTHLY");
		const weekly = options.find((option) => option.plan === "WEEKLY");
		expect(monthly?.priceMinor).toBe(10_000);
		// IVA-inclusive: 10,000 / 1.13, and the two add back to what was quoted.
		expect(monthly?.netMinor).toBe(8_850);
		expect(monthly?.ivaMinor).toBe(1_150);
		expect((monthly?.netMinor ?? 0) + (monthly?.ivaMinor ?? 0)).toBe(10_000);
		expect(weekly?.priceMinor).toBe(2_000);
		// `isCurrent` follows the *effective* plan, and a current monthly shop is
		// current on monthly.
		expect(monthly?.isCurrent).toBe(true);
		expect(weekly?.isCurrent).toBe(false);
		// The top plan has nothing above it, so the picker must not sell it as a step up.
		expect(monthly?.isCeiling).toBe(true);
		expect(weekly?.isCeiling).toBe(false);

		w.close();
	});
});

describe("the admin's view of money owed", () => {
	test("searching the arrears table does not 500", async () => {
		// The search filter puts `user.email` into the shared `where`, and the **count**
		// query is built from that same `where` without the `leftJoin(user)` the rows query
		// has. SQLite then fails on `no such column: user.email` and the whole request 500s
		// — which is what an operator sees the moment they type in the Cobros search box.
		//
		// Found in production, not here: the endpoint was called with no `search` and
		// returned 500, and this test exists because the failure only appears on the one
		// path nobody exercised. `adminSubscriptionsInput` has always allowed `search`; the
		// console's `BillingTab` has always sent it.
		const w = world();
		await seedPriceBook(w.db, { monthlyMinor: 10_000, weeklyMinor: 2_000 });
		const businessId = await seedBusiness(w.db, {
			id: "biz_search_arrears",
			name: "Pulpería La Esquina",
			plan: "MONTHLY",
		});
		const owner = await seedUser(w.db, {
			id: "usr_search_arrears",
			email: "duena@laesquina.cr",
		});
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		await seedSubscription(w.db, {
			businessId,
			plan: "MONTHLY",
			daysUntilDue: -5,
		});
		const admin = await seedUser(w.db, { id: "usr_arrears_search_admin", isAdmin: true });
		const adminCaller = appRouter.createCaller(
			await authed(w, admin),
		) as Caller;

		// By shop name.
		const byName = await adminCaller.admin.subscriptions({
			search: "Esquina",
			limit: 50,
			direction: "desc",
			sort: "arrears",
		});
		expect(byName.rows.map((row) => row.businessId)).toEqual([businessId]);
		expect(byName.total).toBe(1);

		// By owner email — the branch that reaches `user.email` and so the missing join.
		const byEmail = await adminCaller.admin.subscriptions({
			search: "duena@laesquina.cr",
			limit: 50,
			direction: "desc",
			sort: "arrears",
		});
		expect(byEmail.rows.map((row) => row.businessId)).toEqual([businessId]);
		expect(byEmail.total).toBe(1);

		// A search that matches nothing is an empty page, not an error.
		const noMatch = await adminCaller.admin.subscriptions({
			search: "no such shop",
			limit: 50,
			direction: "desc",
			sort: "arrears",
		});
		expect(noMatch.rows).toEqual([]);
		expect(noMatch.total).toBe(0);

		w.close();
	});

	test("arrears counts whole periods at the price the merchant joined under", async () => {
		const w = world();
		await seedPriceBook(w.db, { monthlyMinor: 10_000, weeklyMinor: 2_000 });

		// Current: nothing owed.
		const currentId = await seedBusiness(w.db, {
			id: "biz_arrears_current",
			plan: "MONTHLY",
		});
		await seedSubscription(w.db, {
			businessId: currentId,
			plan: "MONTHLY",
			daysUntilDue: 10,
		});

		// Three weekly periods late. The divisor is the **weekly** period and the
		// multiplier the **weekly** price, so three weeks is three times ₡2,000 and not
		// three times ₡10,000 — using one plan's arithmetic for the other is how an
		// operator ends up chasing a merchant for five times what they owe.
		const lateId = await seedBusiness(w.db, {
			id: "biz_arrears_weekly",
			plan: "WEEKLY",
		});
		await seedSubscription(w.db, {
			businessId: lateId,
			plan: "WEEKLY",
			priceMinor: 2_000,
			daysUntilDue: -22,
		});

		// One monthly period late: a single price, not a fraction of it.
		const monthlyId = await seedBusiness(w.db, {
			id: "biz_arrears_monthly",
			plan: "MONTHLY",
		});
		await seedSubscription(w.db, {
			businessId: monthlyId,
			plan: "MONTHLY",
			priceMinor: 10_000,
			daysUntilDue: -31,
		});

		const admin = await seedUser(w.db, {
			id: "usr_arrears_admin",
			isAdmin: true,
		});
		const adminCaller = appRouter.createCaller(
			await authed(w, admin),
		) as Caller;

		const { rows } = await adminCaller.admin.subscriptions({
			limit: 50,
			direction: "desc",
			sort: "arrears",
		});
		const byId = new Map(rows.map((row) => [row.businessId, row]));

		expect(byId.get(currentId)?.arrearsMinor).toBe(0);
		expect(byId.get(currentId)?.periodsOwed).toBe(0);
		// 22 days late on a 7-day plan: three whole periods.
		expect(byId.get(lateId)?.periodsOwed).toBe(3);
		expect(byId.get(lateId)?.arrearsMinor).toBe(6_000);
		// One period late on a 30-day plan.
		expect(byId.get(monthlyId)?.periodsOwed).toBe(1);
		expect(byId.get(monthlyId)?.arrearsMinor).toBe(10_000);

		// Newest debt first — the order an operator opening the table expects.
		expect(rows[0]?.arrearsMinor).toBeGreaterThanOrEqual(
			rows[rows.length - 1]?.arrearsMinor ?? 0,
		);

		w.close();
	});
});

describe("the never-gated promise", () => {
	test("a suspended shop can still pause a branch and change its address", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_never_gated",
			plan: "MONTHLY",
		});
		const owner = await seedUser(w.db, { id: "usr_never_gated" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		await seedSubscription(w.db, {
			businessId,
			plan: "MONTHLY",
			daysUntilDue: -(HIDDEN_AFTER_DAYS + 30),
		});
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		// Suspended: off the feed, and still fully able to run its kitchen. These are
		// capabilities that must never be gated, and the assertion is that they work in
		// the state where everything else has been taken away.
		expect((await caller.subscription.current({ businessId }))?.status).toBe(
			"SUSPENDED",
		);

		const paused = await caller.business.pauseLocation({
			businessId,
			locationId: `loc_${businessId}`,
			reason: "manual",
		});
		expect(paused.status).toBe("paused_manual");

		await caller.business.update({ businessId, line1: "Avenida Central" });
		const settings = await caller.business.settings({ businessId });
		expect(settings.line1).toBe("Avenida Central");

		w.close();
	});

	test("a shop past every window still takes the order it was sent", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_orders_unmetered",
			plan: "WEEKLY",
		});
		const owner = await seedUser(w.db, { id: "usr_orders_unmetered" });
		const customer = await seedUser(w.db, { id: "usr_orders_customer" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		await seedCategory(w.db);
		const product = await seedProduct(w.db, { businessId });
		await seedSubscription(w.db, {
			businessId,
			daysUntilDue: -(HIDDEN_AFTER_DAYS + 30),
		});

		const customerCaller = appRouter.createCaller(
			await authed(w, customer),
		) as Caller;
		await customerCaller.cart.addItem(
			addToCartInput.parse({ productId: product.id, quantity: 1 }),
		);
		// No cap on orders exists, deliberately: a merchant that hit its limit
		// mid-service would have to refuse a customer who already paid, and that is not
		// a pricing decision, it is a way to lose both of them.
		const order = await customerCaller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: "CASH" as const,
			clientRequestId: "req_never_gated_000001",
		});

		expect(order.items).toHaveLength(1);
		expect(order.items[0]?.productId).toBe(product.id);

		w.close();
	});
});
