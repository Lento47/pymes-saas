import { describe, expect, test } from "bun:test";
import { subscription as subscriptionTable } from "@pymeshub/db";
import { addToCartInput, productCreateInput } from "@pymeshub/shared";
import {
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	LAUNCH_PRICE_BOOK,
	PLAN_LIMITS,
	priceMinorFor,
	subscriptionStatusAt,
} from "@pymeshub/shared/plans";
import { eq } from "drizzle-orm";

import { requireAuthed } from "../src/context";
import { appRouter } from "../src/routers";
import * as adminService from "../src/services/admin";
import * as subscriptions from "../src/services/subscription";
import {
	authed,
	contextFor,
	daysAgo,
	refused,
	seedBusiness,
	seedCategory,
	seedMembership,
	seedOrder,
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
		plan: "STARTER",
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
			plan: "EMPRENDE",
		});
		const owner = await seedUser(w.db, { id: "usr_limit_weekly_owner" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		// Seed to exactly the cap. A refusal at the cap and a refusal *over* it are
		// different bugs, and this pins the boundary from below.
		for (let index = 0; index < PLAN_LIMITS.EMPRENDE.products; index += 1) {
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
		expect(details.current).toBe(PLAN_LIMITS.EMPRENDE.products);
		expect(details.max).toBe(PLAN_LIMITS.EMPRENDE.products);
		expect(details.plan).toBe("EMPRENDE");
		// The actionable half: what they would have to move to.
		expect(details.upgradeTo).toBe("STARTER");

		w.close();
	});

	test("a monthly shop is not refused where a weekly one is", async () => {
		const w = world();
		const { businessId, caller } = await monthlyOwner(w);

		for (let index = 0; index < PLAN_LIMITS.EMPRENDE.products + 1; index += 1) {
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
		expect(stored.n).toBe(PLAN_LIMITS.EMPRENDE.products + 1);

		w.close();
	});

	test("an archived product does not count against the cap", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_limit_archived",
			plan: "EMPRENDE",
		});
		const owner = await seedUser(w.db, { id: "usr_limit_archived" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		const created: string[] = [];
		for (let index = 0; index < PLAN_LIMITS.EMPRENDE.products; index += 1) {
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

	test("a rider is not an employee, so the staff cap does not refuse one", async () => {
		const w = world();
		// **`FREE`, and the spec needs it to be.** The claim is that a rider does not count
		// toward `staffAccounts`, and the sharpest form of that claim is a shop whose staff
		// cap the owner alone already fills — one seat, one owner. On a tier with two seats
		// the spec would pass whether or not riders were counted.
		const businessId = await seedBusiness(w.db, {
			id: "biz_limit_rider",
			plan: "FREE",
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
		// credited for anything: the owner alone already fills the staff cap, so the
		// number the check reads is at the limit before a single rider is invited.
		const employees = w.sqlite
			.prepare(
				"select count(*) as n from membership where business_id = ? and role <> 'COURIER'",
			)
			.get(businessId) as { n: number };
		expect(employees.n).toBeGreaterThanOrEqual(
			PLAN_LIMITS.FREE.staffAccounts,
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
			plan: "EMPRENDE",
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
			plan: "STARTER",
		});
		const owner = await seedUser(w.db, { id: "usr_lapse_owner" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");

		// 45 days past a period end: past the 30-day grace, inside the 90-day window.
		// `storedStatus: "ACTIVE"` is the whole point — a sweeper that never ran must
		// not be what decides whether a shop keeps its tools.
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
			daysUntilDue: -45,
			storedStatus: "ACTIVE",
		});

		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;
		const current = await caller.subscription.current({ businessId });
		expect(current?.status).toBe("PAST_DUE");
		// Still listed. A shop that stopped paying keeps its customers for another 45
		// days; the punishment is the tools, not the storefront.
		expect(current?.listed).toBe(true);
		// And the price it was paying, not today's. The fixture prices from the launch book
		// for the tier and cadence it seeded — `STARTER` on `MONTHLY` — and this asserts the
		// figure a merchant would see on their own invoice rather than a restated constant.
		expect(current?.priceMinor).toBe(
			priceMinorFor("STARTER", "MONTHLY", LAUNCH_PRICE_BOOK),
		);
		// The cadence travels with it, and it is what the next period's length follows.
		expect(current?.cadence).toBe("MONTHLY");

		w.close();
	});

	test("a shop past due is held to the floor's limits, and a current one is not", async () => {
		const w = world();

		// Current, on the monthly plan, with the cap raised so a second branch is
		// possible at all. **No plan allows two**, which is why the two specs that need
		// it raise the cap rather than seed something the pricing forbids.
		const okId = await seedBusiness(w.db, {
			id: "biz_lapse_ok",
			plan: "STARTER",
			raiseLimits: { locations: 2 },
		});
		const okOwner = await seedUser(w.db, { id: "usr_lapse_ok" });
		await seedMembership(w.db, okOwner.id, okId, "OWNER");
		await seedSubscription(w.db, {
			businessId: okId,
			plan: "STARTER",
			daysUntilDue: 10,
		});
		const okCaller = appRouter.createCaller(await authed(w, okOwner)) as Caller;
		await okCaller.business.createLocation(newLocation(okId, "Sucursal 2"));

		// Past due: the same call, on the floor plan's cap of one. No `raiseLimits` here
		// — that is the assertion. A shop thirty days late has lost the second branch
		// it was entitled to.
		const lateId = await seedBusiness(w.db, {
			id: "biz_lapse_late",
			plan: "STARTER",
		});
		const lateOwner = await seedUser(w.db, { id: "usr_lapse_late" });
		await seedMembership(w.db, lateOwner.id, lateId, "OWNER");
		await seedSubscription(w.db, {
			businessId: lateId,
			plan: "STARTER",
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
			prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 },
			effectiveFrom: daysAgo(90),
		});
		const earlyId = await seedBusiness(w.db, {
			id: "biz_price_early",
			plan: "STARTER",
		});
		const earlyOwner = await seedUser(w.db, { id: "usr_price_early" });
		await seedMembership(w.db, earlyOwner.id, earlyId, "OWNER");
		const earlyCaller = appRouter.createCaller(
			await authed(w, earlyOwner),
		) as Caller;

		// The pair is what is chosen: a tier alone cannot be priced, so the cadence is
		// required and `null` would be the free tier.
		await earlyCaller.subscription.changePlan({
			businessId: earlyId,
			plan: "STARTER",
			cadence: "MONTHLY",
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
				prices: [
					{ plan: "EMPRENDE", cadence: "MONTHLY", minor: 2_500 },
					{ plan: "STARTER", cadence: "MONTHLY", minor: 14_000 },
				],
				effectiveFrom: new Date(Date.now() + 30 * 86_400_000),
				reason: "Subida de precio de julio 2027",
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
		const book = await subscriptions.activePriceBookWithPrices(w.db, laterClock);
		expect(book.label).toBe("2027");
		expect(priceMinorFor("STARTER", "MONTHLY", book)).toBe(14_000);
		// The pair the old book priced is still readable through the new one, which is the
		// point of the child table: a rise is a new row, not a rewrite.
		expect(priceMinorFor("EMPRENDE", "MONTHLY", book)).toBe(2_500);
		// And a pair this book does not carry is **refused rather than priced at zero**.
		expect(() => priceMinorFor("GROWTH", "YEARLY", book)).toThrow();

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
					prices: [
						{ plan: "EMPRENDE", cadence: "MONTHLY", minor: 3_000 },
						{ plan: "STARTER", cadence: "MONTHLY", minor: 18_000 },
					],
					effectiveFrom: daysAgo(10),
					reason: "Subida retroactiva, que debe rechazarse",
				},
				new Date(),
			),
		);
		expect(error.code).toBe("BAD_REQUEST");

		w.close();
	});

	test("the plan picker shows the effective plan and the IVA split", async () => {
		const w = world();
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });
		const businessId = await seedBusiness(w.db, {
			id: "biz_picker",
			plan: "STARTER",
		});
		const owner = await seedUser(w.db, { id: "usr_picker" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		// A subscription row, because **the cadence lives on it** and `isCurrent` is now a
		// question about a pair. A shop with no row has no cadence, so no pair could be
		// current and the assertion below would be vacuous rather than false.
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
			cadence: "MONTHLY",
		});
		const caller = appRouter.createCaller(await authed(w, owner)) as Caller;

		const { options } = await caller.subscription.options({ businessId });

		// **One entry per (tier, cadence) pair**, plus the free one — not one per tier. A
		// picker keyed by tier alone cannot say which invoice it is quoting, and the pair is
		// the unit a merchant actually chooses. The fixture seeds a complete book, so this is
		// four tiers × two cadences + `FREE`.
		expect(options).toHaveLength(9);
		expect(options.filter((option) => option.cadence === "YEARLY")).toHaveLength(4);
		const free = options.find((option) => option.isFree);
		const emprende = options.find((option) => option.plan === "EMPRENDE");
		const starter = options.find((option) => option.plan === "STARTER");

		expect(starter?.priceMinor).toBe(10_000);
		// IVA-inclusive: 10,000 / 1.13, and the two add back to what was quoted.
		expect(starter?.netMinor).toBe(8_850);
		expect(starter?.ivaMinor).toBe(1_150);
		expect((starter?.netMinor ?? 0) + (starter?.ivaMinor ?? 0)).toBe(10_000);
		expect(emprende?.priceMinor).toBe(2_000);

		// The free entry is priced at nothing **and carries no period**, which is what tells
		// a client to render a subscribe button rather than a price with a checkout.
		expect(free?.priceMinor).toBe(0);
		expect(free?.cadence).toBeNull();
		expect(free?.periodDays).toBeNull();

		// `isCurrent` follows the *effective* plan **and** the cadence: this shop is on
		// `STARTER` and monthly, so exactly one pair is current.
		expect(starter?.isCurrent).toBe(true);
		expect(starter?.cadence).toBe("MONTHLY");
		expect(emprende?.isCurrent).toBe(false);
		expect(free?.isCurrent).toBe(false);

		// `STARTER` has tiers above it, so it is not a ceiling; `BUSINESS` is the top and
		// must not be sold as a step up. **The ceiling is a property of the tier, not of the
		// cadence** — both `BUSINESS` pairs carry it, because neither one buys more shop.
		expect(starter?.isCeiling).toBe(false);
		const ceilings = options.filter((option) => option.isCeiling);
		expect(ceilings).toHaveLength(2);
		expect(ceilings.every((option) => option.plan === "BUSINESS")).toBe(true);

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
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });
		const businessId = await seedBusiness(w.db, {
			id: "biz_search_arrears",
			name: "Pulpería La Esquina",
			plan: "STARTER",
		});
		const owner = await seedUser(w.db, {
			id: "usr_search_arrears",
			email: "duena@laesquina.cr",
		});
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
			daysUntilDue: -5,
		});
		const admin = await seedUser(w.db, {
			id: "usr_arrears_search_admin",
			isAdmin: true,
		});
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
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });

		// Current: nothing owed.
		const currentId = await seedBusiness(w.db, {
			id: "biz_arrears_current",
			plan: "STARTER",
		});
		await seedSubscription(w.db, {
			businessId: currentId,
			plan: "STARTER",
			daysUntilDue: 10,
		});

		// Two whole periods late, on the cheap tier. The divisor is the merchant's **own**
		// cadence and the multiplier their **own** price, so this is two times ₡2,000 and
		// not two times ₡10,000 — using one shop's arithmetic for another is how an operator
		// ends up chasing a merchant for five times what they owe.
		const lateId = await seedBusiness(w.db, {
			id: "biz_arrears_late",
			plan: "EMPRENDE",
		});
		await seedSubscription(w.db, {
			businessId: lateId,
			plan: "EMPRENDE",
			cadence: "MONTHLY",
			priceMinor: 2_000,
			daysUntilDue: -61,
		});

		// The **same** 61 days, on the annual cadence, is one period and not two — which is
		// the assertion that the divisor follows the cadence rather than being 30 days for
		// everybody. Without this, a yearly merchant 300 days late would be chased for ten
		// months of a bill they owe once.
		const yearlyId = await seedBusiness(w.db, {
			id: "biz_arrears_yearly",
			plan: "EMPRENDE",
		});
		await seedSubscription(w.db, {
			businessId: yearlyId,
			plan: "EMPRENDE",
			cadence: "YEARLY",
			priceMinor: 69_000,
			daysUntilDue: -61,
		});

		// One monthly period late: a single price, not a fraction of it.
		const monthlyId = await seedBusiness(w.db, {
			id: "biz_arrears_monthly",
			plan: "STARTER",
		});
		await seedSubscription(w.db, {
			businessId: monthlyId,
			plan: "STARTER",
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
		// 61 days late on a 30-day cadence: two whole periods, at ₡2,000 each.
		expect(byId.get(lateId)?.periodsOwed).toBe(2);
		expect(byId.get(lateId)?.arrearsMinor).toBe(4_000);
		// The same 61 days on the annual cadence is **one** period — the divisor is the
		// cadence, not a constant.
		expect(byId.get(yearlyId)?.periodsOwed).toBe(1);
		expect(byId.get(yearlyId)?.arrearsMinor).toBe(69_000);
		// One period late on a 30-day cadence at the dearer tier.
		expect(byId.get(monthlyId)?.periodsOwed).toBe(1);
		expect(byId.get(monthlyId)?.arrearsMinor).toBe(10_000);

		// Newest debt first — the order an operator opening the table expects.
		expect(rows[0]?.arrearsMinor).toBeGreaterThanOrEqual(
			rows[rows.length - 1]?.arrearsMinor ?? 0,
		);

		w.close();
	});

	test("the dashboard's order series spans 60 days, so a window can be compared", async () => {
		// The series exists to be compared against the period before it, and that only works if
		// both periods are in **one** response. A 30-day fetch can only compare 15 against 15.
		//
		// So the assertion is about the boundary, not the total: an order 45 days old is
		// outside the old 30-day window and inside this one. If someone shortens it back to 30
		// the dashboard silently loses its comparison and every total still looks plausible.
		const w = world();
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });
		const businessId = await seedBusiness(w.db, { id: "biz_series_window" });
		const customer = await seedUser(w.db, { id: "usr_series_window" });

		// 20 days back is inside any window; 45 days back is only inside a 60-day one.
		await seedOrder(w.db, {
			id: "ord_series_recent",
			businessId,
			customerId: customer.id,
		});
		const old = await seedOrder(w.db, {
			id: "ord_series_old",
			businessId,
			customerId: customer.id,
		});
		w.sqlite.run("update `order` set placed_at = ? where id = ?", [
			Date.now() - 45 * 86_400_000,
			old,
		]);

		const admin = await seedUser(w.db, {
			id: "usr_series_admin",
			isAdmin: true,
		});
		const ctx = requireAuthed((await authed(w, admin)) as never);

		const metrics = await adminService.metrics(ctx);
		// Ascending, so the **first** day is the oldest. The ordering is itself part of the
		// claim: a chart drawn left-to-right is wrong if the series is not sorted.
		const days = metrics.orderSeries.map((row) => row.day);
		const oldest = days[0] ?? "";

		// 45 days back must still be present, which a 30-day window would have dropped.
		const cutoff = new Date(Date.now() - 44 * 86_400_000)
			.toISOString()
			.slice(0, 10);
		expect(oldest).not.toBe("");
		expect(oldest <= cutoff).toBe(true);
		expect(metrics.orderSeries.length).toBeGreaterThanOrEqual(2);
	});

	test("the order series counts cancellations without excluding them from the total", async () => {
		// Two different questions, and averaging them hides both: "how much activity was
		// there" includes a cancelled order, "how much completed volume" does not. The series
		// answers the first and carries `cancelled` so the console can see the second's shadow.
		const w = world();
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });
		const businessId = await seedBusiness(w.db, { id: "biz_series_cancel" });
		const customer = await seedUser(w.db, { id: "usr_series_cancel" });
		await seedOrder(w.db, {
			id: "ord_series_ok",
			businessId,
			customerId: customer.id,
		});
		await seedOrder(w.db, {
			id: "ord_series_cancelled",
			businessId,
			customerId: customer.id,
			status: "CANCELLED",
		});

		const admin = await seedUser(w.db, {
			id: "usr_series_cancel_admin",
			isAdmin: true,
		});
		const ctx = requireAuthed((await authed(w, admin)) as never);

		const metrics = await adminService.metrics(ctx);
		const today = new Date().toISOString().slice(0, 10);
		const row = metrics.orderSeries.find((entry) => entry.day === today);

		expect(row?.count).toBe(2);
		expect(row?.cancelled).toBe(1);

		w.close();
	});

	test("the SQL status derivation agrees with the shared helper, in all four states", async () => {
		// The reader derives status in SQL (`derivedStatusSql`) while the merchant's own
		// screens and `effectivePlan` go through `subscriptionStatusAt`. Both exist: one is an
		// expression over a table, the other a function over a row, and they cannot share an
		// implementation. What they can do is be *pinned to each other*, which is this test.
		//
		// If someone edits one branch and not the other, this fails — rather than the console
		// quietly filtering on something the rest of the platform does not believe.
		const w = world();
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });

		// One subscription per status, dated so each branch is the deciding one:
		// ACTIVE     periodEnd in the future
		// GRACE      period ended, but inside the 30-day window
		// PAST_DUE   grace spent, but under the 90 days that unlists a shop
		// SUSPENDED  90 days past the period end
		const cases = [
			{ id: "biz_status_active", status: "ACTIVE", daysUntilDue: 10 },
			{ id: "biz_status_grace", status: "GRACE", daysUntilDue: -5 },
			{ id: "biz_status_past", status: "PAST_DUE", daysUntilDue: -60 },
			{ id: "biz_status_suspended", status: "SUSPENDED", daysUntilDue: -120 },
		] as const;

		for (const entry of cases) {
			await seedBusiness(w.db, { id: entry.id, plan: "STARTER" });
			await seedSubscription(w.db, {
				businessId: entry.id,
				plan: "STARTER",
				priceMinor: 10_000,
				daysUntilDue: entry.daysUntilDue,
				// Deliberately disagreeing with the dates, so the assertion below cannot be
				// satisfied by a reader that just echoes the column.
				storedStatus: "ACTIVE",
			});
		}

		const admin = await seedUser(w.db, {
			id: "usr_status_admin",
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

		const now = new Date();
		for (const entry of cases) {
			const stored = await w.db
				.select()
				.from(subscriptionTable)
				.where(eq(subscriptionTable.businessId, entry.id));

			// The shared helper, on the real row — and the seeded intent asserted alongside,
			// so a failure names which of the two broke.
			// Named rather than asserted: a missing row would otherwise throw on `undefined`,
			// and "cannot read property of undefined" says nothing about which seed broke.
			const row = stored[0];
			if (!row) throw new Error(`no subscription was seeded for ${entry.id}`);
			const expected = subscriptionStatusAt(row, now);
			expect(expected).toBe(entry.status);

			// And what the SQL derivation says, read through the endpoint the console calls.
			const found = rows.find((row) => row.businessId === entry.id);
			expect(found?.status).toBe(expected);
		}

		w.close();
	});

	test("filtering by status counts the filtered set, not the table", async () => {
		// The bug this closes: the status filter was applied *after* shaping, so `total`
		// counted the whole table. A pager built on that total offers "page 1 of 4" over one
		// matching row, and the footer contradicts the table it sits under.
		//
		// Four subscriptions, one per status. `total` must now answer "how many are in this
		// filtered view", which for any single status is 1 — not 4.
		const w = world();
		await seedPriceBook(w.db, { prices: { "EMPRENDE:MONTHLY": 2_000, "STARTER:MONTHLY": 10_000 } });

		for (const [id, daysUntilDue] of [
			["biz_count_active", 10],
			["biz_count_grace", -5],
			["biz_count_past", -60],
			["biz_count_suspended", -120],
		] as const) {
			await seedBusiness(w.db, { id, plan: "STARTER" });
			await seedSubscription(w.db, {
				businessId: id,
				plan: "STARTER",
				priceMinor: 10_000,
				daysUntilDue,
			});
		}

		const admin = await seedUser(w.db, {
			id: "usr_count_admin",
			isAdmin: true,
		});
		const adminCaller = appRouter.createCaller(
			await authed(w, admin),
		) as Caller;

		// Unfiltered: all four, and the count says so.
		const all = await adminCaller.admin.subscriptions({
			limit: 50,
			direction: "desc",
			sort: "arrears",
		});
		expect(all.rows).toHaveLength(4);
		expect(all.total).toBe(4);

		// Filtered: one row, and a count that matches it. Every status is checked, because
		// the two queries can disagree per-branch, and disagreeing on only one of them still
		// looks plausible on screen.
		for (const status of [
			"ACTIVE",
			"GRACE",
			"PAST_DUE",
			"SUSPENDED",
		] as const) {
			const filtered = await adminCaller.admin.subscriptions({
				status,
				limit: 50,
				direction: "desc",
				sort: "arrears",
			});
			expect(filtered.rows.length).toBe(1);
			expect(filtered.total).toBe(1);
			expect(filtered.rows[0]?.status).toBe(status);
		}

		w.close();
	});
});

describe("the never-gated promise", () => {
	test("a suspended shop can still pause a branch and change its address", async () => {
		const w = world();
		const businessId = await seedBusiness(w.db, {
			id: "biz_never_gated",
			plan: "STARTER",
		});
		const owner = await seedUser(w.db, { id: "usr_never_gated" });
		await seedMembership(w.db, owner.id, businessId, "OWNER");
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
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
			plan: "EMPRENDE",
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
