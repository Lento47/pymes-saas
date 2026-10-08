import { describe, expect, test } from "bun:test";

import {
	CADENCES,
	type Cadence,
	canAcceptExpress,
	type CountablePlanLimit,
	DEFAULT_PLAN,
	effectivePlan,
	EXPRESS_WINDOW_DAYS,
	GATED_CAPABILITIES,
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	IVA_RATE,
	isPeriodDue,
	ivaOn,
	LAUNCH_PRICE_BOOK,
	NEVER_GATED,
	netOfIva,
	periodDaysFor,
	PLAN_LIMITS,
	PLAN_ORDER,
	PLANS,
	type Plan,
	periodEndFrom,
	planSatisfying,
	priceMinorFor,
	STATUS_GRANTS_FULL_ACCESS,
	STATUS_IS_LISTED,
	subscriptionStatusAt,
	SUBSCRIPTION_STATUSES,
	upgradeTarget,
	cadencesFor,
	weekWindowStart,
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
 * 2. **A tier is never ordered against itself.** `priceMinorFor` and the upgrade
 *    search both walk `PLAN_ORDER`, so a tier that is cheaper than the one above it
 *    would quietly make `upgradeTarget` name a downgrade.
 * 3. **`SUSPENDED` is the only status that unlists a shop.** Everything else keeps a
 *    business in the feed, because a merchant who stops paying should lose their
 *    tools before they lose their customers.
 *
 * And two that the tier/cadence split introduced:
 *
 * 4. **A cadence buys no limits.** An annual merchant holds exactly the numbers a monthly
 *    one does, because buying a year is not buying more shop. Nothing else protects that.
 * 5. **A free shop never falls into arrears.** It is permanent, and `subscriptionStatusAt`
 *    is what makes that true — without the `plan` argument a null `periodEnd` reads as a
 *    period that ended before it began, and the shop is `SUSPENDED` at 90 days with no
 *    payment ever requested.
 */

/** Every paid (tier, cadence) pair, for the loops that must hold across all of them. */
const PAID_PAIRS: [Plan, Cadence][] = PLANS.filter((plan) => plan !== "FREE").flatMap(
	(plan) => CADENCES.map((cadence) => [plan, cadence] as [Plan, Cadence]),
);

describe("what a merchant pays", () => {
	test("every price is IVA-inclusive and the net divides back cleanly", () => {
		for (const [plan, cadence] of PAID_PAIRS) {
			const gross = priceMinorFor(plan, cadence, LAUNCH_PRICE_BOOK);
			const net = netOfIva(gross);
			const iva = ivaOn(gross);

			// The two add back to what was charged, to the colón.
			expect(net + iva).toBe(gross);
			// And the IVA is the stated share of the gross, within rounding.
			expect(iva / gross).toBeCloseTo(IVA_RATE / (1 + IVA_RATE), 2);
		}
	});

	test("the launch book is the one the seed and a fresh install run on", () => {
		expect(LAUNCH_PRICE_BOOK.priceBookId).toBeTruthy();
		// Every paid tier carries both cadences. A tier missing one is a picker offering a
		// plan the charge path cannot price.
		for (const plan of PLANS) {
			if (plan === "FREE") continue;
			for (const cadence of CADENCES) {
				expect(typeof LAUNCH_PRICE_BOOK.prices[plan]?.[cadence]).toBe("number");
			}
		}
		// And FREE is absent from every one, rather than present at zero: a free shop is
		// never charged, and absence is what makes that checkable.
		for (const cadence of CADENCES) {
			expect(LAUNCH_PRICE_BOOK.prices.FREE?.[cadence]).toBeUndefined();
		}
	});

	test("a missing price throws instead of charging nothing for a year", () => {
		// Both wrong answers are real: 0 charges a merchant nothing for a year, and
		// undefined puts NaN into an invoice. A throw fails the request.
		expect(() => priceMinorFor("GROWTH", "YEARLY", { prices: {} })).toThrow();
		expect(() => priceMinorFor("FREE", "MONTHLY", LAUNCH_PRICE_BOOK)).toThrow();
	});

	test("annual is ten months of monthly, on every tier", () => {
		// One rule rather than three unrelated discounts, so the pricing page can state a
		// single saving. Asserted per tier because three tiers agreeing by accident is not
		// the claim — the claim is that they all do it.
		for (const plan of PLANS) {
			if (plan === "FREE") continue;
			const monthly = priceMinorFor(plan, "MONTHLY", LAUNCH_PRICE_BOOK);
			const yearly = priceMinorFor(plan, "YEARLY", LAUNCH_PRICE_BOOK);
			expect(yearly).toBe(monthly * 10);
		}
	});

	test("a period is thirty days monthly or 365 yearly, and due the instant it ends", () => {
		const start = new Date("2026-09-26T00:00:00.000Z");
		expect(periodEndFrom(start, "STARTER", "MONTHLY")).toEqual(
			new Date("2026-10-26T00:00:00.000Z"),
		);
		// **365, not 360.** Twelve 30-day months is five days short of a year, and a
		// merchant who paid for a year and got 360 is a refund and a bad review.
		expect(periodEndFrom(start, "STARTER", "YEARLY")).toEqual(
			new Date("2027-09-26T00:00:00.000Z"),
		);

		// `>=` and not `>`: a period must never be un-chargeable by accident.
		const end = periodEndFrom(start, "STARTER", "MONTHLY");
		expect(isPeriodDue(end, new Date(end.getTime() - 1))).toBe(false);
		expect(isPeriodDue(end, end)).toBe(true);
		expect(isPeriodDue(end, new Date(end.getTime() + 1))).toBe(true);
	});

	test("the free plan has no period, and asking for one is a refusal", () => {
		// `null` rather than 0 days: `0` would make `isPeriodDue` true forever and the
		// charge path would bill a free shop on every sweep.
		expect(periodDaysFor("FREE", "MONTHLY")).toBeNull();
		expect(periodDaysFor("FREE", "YEARLY")).toBeNull();
		expect(cadencesFor("FREE")).toEqual([]);
		// A caller that has not established the plan is paid is asking a question with no
		// answer, and both available answers put a free shop one step from being charged.
		expect(() => periodEndFrom(new Date(), "FREE", "MONTHLY")).toThrow();
	});

	test("a cadence buys no limits", () => {
		// The invariant the whole split exists to protect, stated the only way it can be
		// enforced: `PLAN_LIMITS` is keyed by tier and **takes no cadence**, so an annual
		// merchant and a monthly one on the same tier are literally the same object. The day
		// someone adds `cadence` to the limits table, the type of this module stops
		// compiling — which is a louder failure than any assertion here.
		for (const cadence of CADENCES) {
			// Priced per day, an annual tier is a *premium* rather than a rounding, and it
			// carries no more shop. If a limit ever started following the cadence, the second
			// assertion below would be the one to move — so both are named here.
			expect(priceMinorFor("GROWTH", cadence, LAUNCH_PRICE_BOOK)).toBeGreaterThan(0);
			expect(PLAN_LIMITS[PLAN_ORDER[PLAN_ORDER.length - 1] as Plan]).toBeDefined();
		}
		// The concrete shape of "no more shop": a paid tier's numbers do not vary, and the
		// free tier's are the same whichever cadence it is asked about (it has none).
		const growth = PLAN_LIMITS.GROWTH;
		expect(growth.products).toBe(600);
		expect(growth.expressPerWeek).toBe(250);
		expect(PLAN_LIMITS.FREE.products).toBe(15);
	});
});

describe("the plans", () => {
	test("a tier is never cheaper than the one above it, on either cadence", () => {
		const ordered: Plan[] = [...PLAN_ORDER];
		for (let i = 1; i < ordered.length; i += 1) {
			const lower = ordered[i - 1] as Plan;
			const upper = ordered[i] as Plan;
			for (const cadence of CADENCES) {
				if (lower === "FREE" || upper === "FREE") continue;
				expect(priceMinorFor(upper, cadence, LAUNCH_PRICE_BOOK)).toBeGreaterThan(
					priceMinorFor(lower, cadence, LAUNCH_PRICE_BOOK),
				);
				// Per day, not per period, so an annual tier is not merely "twelve months at
				// a higher number" — it is dearer per day too, which is what makes it a
				// premium rather than a rounding.
				const days = 365 * 86_400_000;
				expect(
					priceMinorFor(upper, cadence, LAUNCH_PRICE_BOOK) / days,
				).toBeGreaterThanOrEqual(
					priceMinorFor(lower, cadence, LAUNCH_PRICE_BOOK) / days,
				);
			}
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
		// **The floor is `FREE`, and it has to be.** A merchant who stops paying keeps their
		// storefront until SUSPENDED, so during PAST_DUE they are a live shop on the floor —
		// and while the floor was the paid small tier, `effectivePlan` handed out 25 products
		// to somebody who had stopped paying. It was an accident of which plan sorted first.
		expect(DEFAULT_PLAN).toBe("FREE");
		// A degraded merchant must be able to do *something*: the default plan is the
		// floor, so it has to permit at least one of everything countable.
		expect(PLAN_LIMITS[DEFAULT_PLAN].locations).toBeGreaterThan(0);
		expect(PLAN_LIMITS[DEFAULT_PLAN].products).toBeGreaterThan(0);
	});

	test("the express quota rises with the tier and is weekly, not per period", () => {
		const ordered: Plan[] = [...PLAN_ORDER];
		for (let i = 1; i < ordered.length; i += 1) {
			expect(PLAN_LIMITS[ordered[i] as Plan].expressPerWeek).toBeGreaterThanOrEqual(
				PLAN_LIMITS[ordered[i - 1] as Plan].expressPerWeek,
			);
		}
		// The rungs the tiers were set at. Ten a week on the free tier is about one busy
		// lunch and one busy dinner.
		expect(PLAN_LIMITS.FREE.expressPerWeek).toBe(10);
		expect(PLAN_LIMITS.EMPRENDE.expressPerWeek).toBe(30);
		expect(PLAN_LIMITS.STARTER.expressPerWeek).toBe(90);
		// The top tier has bought out of being told no, and a number there would be one
		// that gets raised by a support ticket anyway.
		expect(PLAN_LIMITS.BUSINESS.expressPerWeek).toBe(Infinity);
		// Weekly is its own window and is **not** the billing period. Deriving one from the
		// other produces "ten a month divided by four", which strands a shop on the two
		// busiest days of its week.
		expect(EXPRESS_WINDOW_DAYS).toBe(7);
	});

	test("the express quota refuses the eleventh and not the tenth", () => {
		// `<` and not `<=`: a shop holding exactly 10 of 10 can take none more, and the
		// refusal reports 10 of 10 rather than claiming it is one over.
		expect(canAcceptExpress("FREE", 9)).toBe(true);
		expect(canAcceptExpress("FREE", 10)).toBe(false);
		expect(canAcceptExpress("FREE", 11)).toBe(false);
		// And no cap anywhere refuses a top-tier shop.
		expect(canAcceptExpress("BUSINESS", 1_000_000)).toBe(true);
	});

	test("the express window is seven days from the epoch, not a calendar week", () => {
		const inside = new Date("2026-10-08T14:30:00.000Z");
		const start = weekWindowStart(inside);

		expect(inside.getTime()).toBeGreaterThanOrEqual(start.getTime());
		expect(inside.getTime() - start.getTime()).toBeLessThan(7 * 86_400_000);
		// The window's edge is what matters: one millisecond before the boundary is the
		// previous window and has its own quota, so a shop cannot spend two weeks' worth
		// in the space between two loads of the page.
		expect(weekWindowStart(new Date(start.getTime() - 1)).getTime()).toBe(
			start.getTime() - 7 * 86_400_000,
		);
		// And it is stable within the window, or the count and the limit disagree.
		expect(weekWindowStart(new Date(start.getTime() + 3_600_000))).toEqual(start);
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

	/**
	 * A free shop is permanent, and this is the test that makes it true.
	 *
	 * Without the `plan` argument, the null `periodEnd` of a never-charged row falls back
	 * to `createdAt` — which for a shop signed up 400 days ago is a period that ended
	 * before it began. It then reads `GRACE` at 30 days, `PAST_DUE` at 31 and **`SUSPENDED`
	 * at 90**, and `SUSPENDED` is `STATUS_IS_LISTED: false`. The shop leaves the
	 * marketplace having never been asked for money, and it reads as "the free tier didn't
	 * convert" rather than as a defect.
	 *
	 * Written against the real 400-day-old row rather than a 30-day one, because a young
	 * row passes by accident — that is exactly how the bug would have survived a test.
	 */
	test("a free shop is active at 400 days old, with no payment ever requested", () => {
		const createdAt = new Date("2025-08-24T00:00:00.000Z");
		const now = new Date("2026-10-08T00:00:00.000Z");

		const status = subscriptionStatusAt(
			{ plan: "FREE", periodEnd: null, gracedUntil: null, createdAt },
			now,
		);

		expect(status).toBe("ACTIVE");
		// The consequence, asserted rather than implied: it is still in the feed, and it
		// still holds its own tier's limits rather than the floor's.
		expect(STATUS_IS_LISTED[status]).toBe(true);
		expect(STATUS_GRANTS_FULL_ACCESS[status]).toBe(true);
		expect(effectivePlan("FREE", status)).toBe("FREE");
	});

	test("a paid shop past its period still falls into arrears", () => {
		// The counterpart to the test above, and it is why the free rule is a rule about
		// the plan rather than a blanket exemption: the deriver still charges anybody who
		// owes money, and only somebody who was never charged anything.
		const createdAt = new Date("2025-08-24T00:00:00.000Z");
		const longAgo = new Date("2025-09-01T00:00:00.000Z");

		expect(
			subscriptionStatusAt(
				{ plan: "STARTER", periodEnd: longAgo, gracedUntil: null, createdAt },
				new Date("2026-10-08T00:00:00.000Z"),
			),
		).toBe("SUSPENDED");
	});
});

describe("the limits", () => {
	test("find the cheapest tier that reaches a stated need", () => {
		expect(planSatisfying({ products: 15 })).toBe("FREE");
		expect(planSatisfying({ products: 16 })).toBe("EMPRENDE");
		expect(planSatisfying({ staffAccounts: 3 })).toBe("STARTER");
		// Beyond even the top tier: null is a real answer, not a missing one.
		expect(planSatisfying({ products: 1001 })).toBeNull();
	});

	test("name an upgrade that actually raises the limit", () => {
		const target = upgradeTarget("FREE", "products", 15);
		expect(target?.plan).toBe("EMPRENDE");
		expect(target?.allows).toBeGreaterThan(15);
		// Already on the top tier: nothing to offer.
		expect(upgradeTarget("BUSINESS", "products", 25)).toBeNull();
		// And a limit the current tier already allows is not an upgrade at all.
		expect(upgradeTarget("FREE", "products", 10)).toBeNull();
	});

	test("the express quota names the tier that raises it", () => {
		// A shop at its ceiling is told what to move to, and **not** that it could go
		// annual: limits follow the tier alone, so an annual shop holds the same numbers
		// and "go annual" would be selling it nothing.
		expect(upgradeTarget("FREE", "expressPerWeek", 10)?.plan).toBe("EMPRENDE");
		expect(upgradeTarget("EMPRENDE", "expressPerWeek", 30)?.plan).toBe("STARTER");
		expect(upgradeTarget("STARTER", "expressPerWeek", 90)?.plan).toBe("GROWTH");
		// The top tier is `Infinity`, so nothing is ever refused and nothing is offered.
		expect(upgradeTarget("BUSINESS", "expressPerWeek", 1_000_000)).toBeNull();
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
