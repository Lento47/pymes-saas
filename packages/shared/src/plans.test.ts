import { describe, expect, test } from "bun:test";

import {
	type CountablePlanLimit,
	DEFAULT_PLAN,
	GATED_CAPABILITIES,
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	IVA_RATE,
	isPeriodDue,
	ivaOn,
	LAUNCH_PRICE_BOOK,
	NEVER_GATED,
	netOfIva,
	PLAN_LIMITS,
	PLAN_ORDER,
	PLANS,
	type Plan,
	periodEndFrom,
	planSatisfying,
	priceMinorFor,
	STATUS_GRANTS_FULL_ACCESS,
	STATUS_IS_LISTED,
	SUBSCRIPTION_STATUSES,
	upgradeTarget,
} from "./plans";

/**
 * The billing contract, pinned.
 *
 * Three claims are worth a test each, and the third is the one that would cost real
 * money if it broke:
 *
 * 1. **The IVA division is exact enough to remit.** `netOfIva` and `ivaOn` have to be
 *    inverses of each other and sum back to the gross, because the platform remits
 *    `ivaOn(price)` and keeps the rest. A drift of a colón per merchant per month is
 *    invisible on one row and a reconciliation problem at a thousand.
 * 2. **A plan is never ordered against itself.** `priceMinorFor` and the upgrade
 *    search both walk `PLAN_ORDER`, so a plan that is cheaper than the one above it
 *    would quietly make `upgradeTarget` name a downgrade.
 * 3. **`SUSPENDED` is the only status that unlists a shop.** Everything else keeps a
 *    business in the feed, because a merchant who stops paying should lose their
 *    tools before they lose their customers.
 */

const book = { weeklyMinor: 2_000, monthlyMinor: 10_000 };

describe("what a merchant pays", () => {
	test("both prices are IVA-inclusive and the net divides back cleanly", () => {
		for (const plan of PLANS) {
			const gross = priceMinorFor(plan, book);
			const net = netOfIva(gross);
			const iva = ivaOn(gross);

			// The two add back to what was charged, to the colón.
			expect(net + iva).toBe(gross);
			// And the IVA is the stated share of the gross, within rounding.
			expect(iva / gross).toBeCloseTo(IVA_RATE / (1 + IVA_RATE), 2);
			// The headline numbers, so a change to the launch book is a deliberate diff.
			expect(gross).toBe(plan === "WEEKLY" ? 2_000 : 10_000);
		}
	});

	test("the launch book is the one the seed and a fresh install run on", () => {
		expect(LAUNCH_PRICE_BOOK.weeklyMinor).toBe(2_000);
		expect(LAUNCH_PRICE_BOOK.monthlyMinor).toBe(10_000);
		expect(LAUNCH_PRICE_BOOK.priceBookId).toBeTruthy();
	});

	test("a period is seven or thirty days, and due the instant it ends", () => {
		const start = new Date("2026-09-26T00:00:00.000Z");
		expect(periodEndFrom(start, "WEEKLY")).toEqual(
			new Date("2026-10-03T00:00:00.000Z"),
		);
		expect(periodEndFrom(start, "MONTHLY")).toEqual(
			new Date("2026-10-26T00:00:00.000Z"),
		);

		// `>=` and not `>`: a period must never be un-chargeable by accident.
		const end = periodEndFrom(start, "WEEKLY");
		expect(isPeriodDue(end, new Date(end.getTime() - 1))).toBe(false);
		expect(isPeriodDue(end, end)).toBe(true);
		expect(isPeriodDue(end, new Date(end.getTime() + 1))).toBe(true);
	});
});

describe("the plans", () => {
	test("monthly is never cheaper than the weekly above it", () => {
		const ordered: Plan[] = [...PLAN_ORDER];
		for (let i = 1; i < ordered.length; i += 1) {
			const lower = ordered[i - 1] as Plan;
			const upper = ordered[i] as Plan;
			expect(priceMinorFor(upper, book)).toBeGreaterThan(
				priceMinorFor(lower, book),
			);
			// Per day, not per period: a month is 30 days and a week 7, so the monthly
			// plan is not merely "four weeks at a higher number" — it is dearer per day
			// too, which is what makes it a premium rather than a rounding.
			expect(priceMinorFor(upper, book) / (30 * 86_400_000)).toBeGreaterThan(
				priceMinorFor(lower, book) / (7 * 86_400_000),
			);
		}
	});

	test("every plan is at least as generous as the one below it", () => {
		// `PLAN_ORDER` is `readonly Plan[]`, so an index is `Plan | undefined` under
		// `noUncheckedIndexedAccess`. Pairing with `zip` would work; asserting
		// non-undefined says the same thing about a list that is correct by
		// construction, and fails loudly if it ever is not.
		const ordered: Plan[] = [...PLAN_ORDER];
		for (let i = 1; i < ordered.length; i += 1) {
			const lower = PLAN_LIMITS[ordered[i - 1] as Plan];
			const upper = PLAN_LIMITS[ordered[i] as Plan];
			// Countable limits are ordered; the one boolean is a switch, not a quantity,
			// so it is excluded rather than compared with `>=`. The `typeof` guard is
			// not defensive noise — `CountablePlanLimit` is a type-level exclusion and
			// `Object.keys` returns strings, so the compiler cannot see it. The cast is
			// what makes the loop's arithmetic well-typed; the guard is what makes it
			// true.
			for (const key of Object.keys(lower) as CountablePlanLimit[]) {
				const below = lower[key];
				const above = upper[key];
				if (typeof below !== "number" || typeof above !== "number") continue;
				expect(above).toBeGreaterThanOrEqual(below);
			}
		}
	});

	test("the default plan is the one a lapse falls back to", () => {
		expect(PLAN_LIMITS[DEFAULT_PLAN]).toBeDefined();
		expect(PLAN_ORDER).toContain(DEFAULT_PLAN);
		// A degraded merchant must be able to do *something*: the default plan is the
		// floor, so it has to permit at least one of everything countable.
		expect(PLAN_LIMITS[DEFAULT_PLAN].locations).toBeGreaterThan(0);
		expect(PLAN_LIMITS[DEFAULT_PLAN].products).toBeGreaterThan(0);
	});
});

describe("lapsing", () => {
	test("a merchant keeps their storefront until SUSPENDED, and nothing longer", () => {
		for (const status of SUBSCRIPTION_STATUSES) {
			if (status === "SUSPENDED") expect(STATUS_IS_LISTED[status]).toBe(false);
			else expect(STATUS_IS_LISTED[status]).toBe(true);
		}
	});

	test("access is withheld only after the grace period, never during it", () => {
		expect(STATUS_GRANTS_FULL_ACCESS.ACTIVE).toBe(true);
		expect(STATUS_GRANTS_FULL_ACCESS.GRACE).toBe(true);
		expect(STATUS_GRANTS_FULL_ACCESS.PAST_DUE).toBe(false);
		expect(STATUS_GRANTS_FULL_ACCESS.SUSPENDED).toBe(false);
		// Grace is a real window, and it is long enough to forgive a late week.
		expect(GRACE_DAYS).toBeGreaterThan(7);
		expect(HIDDEN_AFTER_DAYS).toBeGreaterThan(GRACE_DAYS);
	});
});

describe("the limits", () => {
	test("find the cheapest plan that reaches a stated need", () => {
		expect(planSatisfying({ products: 25 })).toBe("WEEKLY");
		expect(planSatisfying({ products: 26 })).toBe("MONTHLY");
		expect(planSatisfying({ staffAccounts: 3 })).toBe("MONTHLY");
		// Beyond even the top plan: null is a real answer, not a missing one.
		expect(planSatisfying({ products: 151 })).toBeNull();
	});

	test("name an upgrade that actually raises the limit", () => {
		const target = upgradeTarget("WEEKLY", "products", 25);
		expect(target?.plan).toBe("MONTHLY");
		expect(target?.allows).toBeGreaterThan(25);
		// Already on the top plan: nothing to offer.
		expect(upgradeTarget("MONTHLY", "products", 25)).toBeNull();
		// And a limit the current plan already allows is not an upgrade at all.
		expect(upgradeTarget("WEEKLY", "products", 10)).toBeNull();
	});
});

describe("what is never withheld", () => {
	test("a merchant can always stop taking orders and always leave", () => {
		// The specific failure this prevents: a cap that can refuse an order, or that
		// can strand a merchant who decided to close.
		expect(NEVER_GATED).toContain("orders:advance");
		expect(NEVER_GATED).toContain("reviews:write");
		expect(NEVER_GATED).toContain("business:delete");
		// Nothing that gates one of those may exist.
		for (const gated of Object.keys(GATED_CAPABILITIES)) {
			expect(NEVER_GATED).not.toContain(gated);
		}
	});

	test("a gated capability is governed by a limit the plan table defines", () => {
		for (const limit of Object.values(GATED_CAPABILITIES)) {
			for (const plan of PLANS) {
				expect(PLAN_LIMITS[plan][limit]).toBeDefined();
			}
		}
	});
});
