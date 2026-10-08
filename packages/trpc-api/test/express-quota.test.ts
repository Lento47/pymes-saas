import { describe, expect, test } from "bun:test";

import { PLAN_LIMITS, type Plan } from "@pymeshub/shared/plans";

import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedOrder,
	seedSubscription,
	seedUser,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

/**
 * The express quota: how many express orders a tier may **accept** in a week.
 *
 * This is a usage limit on the business, not a subsidy — the customer pays the courier and
 * always did, so nothing here touches who pays for a delivery. What the tier changes is how
 * many customers the shop may serve *at speed*.
 *
 * Four claims, and each one is a way the mechanic could be wrong in a way nobody notices:
 *
 * 1. **The count is on acceptance.** An order the shop declined costs it nothing, and an
 *    order it has not answered yet costs it nothing either.
 * 2. **The window is the week, not the billing period.** A monthly merchant gets ten a
 *    week, not ten a month divided by four.
 * 3. **Standard orders are never counted.** The quota is about speed; a shop must always be
 *    able to take an ordinary order, or the limit has become a cap on trading — which
 *    `NEVER_GATED` forbids.
 * 4. **The refusal names the tier that raises it**, and never the cadence. Limits follow the
 *    tier alone, so "go annual" would be selling a shop nothing.
 */

/** A shop on `plan`, with an owner who can act for it. */
async function shop(plan: Plan) {
	const w = world();
	const businessId = await seedBusiness(w.db, { id: `biz_express_${plan}`, plan });
	const owner = await seedUser(w.db, { id: `usr_express_${plan}` });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	const caller = appRouter.createCaller(await authed(w, owner)) as Caller;
	return { w, businessId, caller };
}

/** `n` express orders this shop already accepted, inside the current window. */
async function acceptedExpress(
	w: ReturnType<typeof world>,
	businessId: string,
	n: number,
	customerId: string,
) {
	for (let index = 0; index < n; index += 1) {
		await seedOrder(w.db, {
			id: `ord_express_${businessId}_${index}`,
			businessId,
			customerId,
			status: "COMPLETED",
			deliverySpeed: "EXPRESS",
			acceptedAt: new Date(),
		});
	}
}

describe("the express quota", () => {
	test("a free shop is refused on the eleventh express order", async () => {
		const { w, businessId, caller } = await shop("FREE");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		await acceptedExpress(w, businessId, PLAN_LIMITS.FREE.expressPerWeek, customer.id);

		// The order it cannot take. Seeded `PENDING` with no acceptance, so nothing but the
		// quota stands between it and `ACCEPTED`.
		const pending = await seedOrder(w.db, {
			id: "ord_express_overflow",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "EXPRESS",
			acceptedAt: null,
		});

		const error = await refused(
			caller.orders.advance({ orderId: pending, to: "ACCEPTED" }),
		);

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
		expect(details.limit).toBe("expressPerWeek");
		expect(details.current).toBe(PLAN_LIMITS.FREE.expressPerWeek);
		expect(details.max).toBe(PLAN_LIMITS.FREE.expressPerWeek);
		expect(details.plan).toBe("FREE");
		// The tier that raises it — **not** a cadence, because an annual `FREE` is not a
		// thing and an annual `EMPRENDE` holds the same ten.
		expect(details.upgradeTo).toBe("EMPRENDE");

		w.close();
	});

	test("the tenth is accepted, so the boundary is the cap and not one below it", async () => {
		const { w, businessId, caller } = await shop("FREE");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		// One fewer than the cap, so this acceptance is the one that *reaches* it.
		await acceptedExpress(w, businessId, PLAN_LIMITS.FREE.expressPerWeek - 1, customer.id);

		const pending = await seedOrder(w.db, {
			id: "ord_express_last",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "EXPRESS",
			acceptedAt: null,
		});

		const moved = await caller.orders.advance({ orderId: pending, to: "ACCEPTED" });
		expect(moved.status).toBe("ACCEPTED");

		w.close();
	});

	test("a standard order is never counted and never refused", async () => {
		const { w, businessId, caller } = await shop("FREE");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		// The shop is at its express ceiling...
		await acceptedExpress(w, businessId, PLAN_LIMITS.FREE.expressPerWeek, customer.id);

		// ...and an ordinary order still goes through. This is `NEVER_GATED` read literally:
		// a shop must always be able to take the order a customer is waiting on, and the
		// express quota may not become a cap on trading.
		const standard = await seedOrder(w.db, {
			id: "ord_standard_any",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "STANDARD",
			acceptedAt: null,
		});

		const moved = await caller.orders.advance({ orderId: standard, to: "ACCEPTED" });
		expect(moved.status).toBe("ACCEPTED");

		w.close();
	});

	test("an express order accepted last week does not spend this week's quota", async () => {
		const { w, businessId, caller } = await shop("FREE");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		// Eight days back, which is a different 7-day window from now under any anchor.
		const lastWeek = new Date(Date.now() - 8 * 86_400_000);
		for (let index = 0; index < PLAN_LIMITS.FREE.expressPerWeek; index += 1) {
			await seedOrder(w.db, {
				id: `ord_express_lastweek_${index}`,
				businessId,
				customerId: customer.id,
				status: "COMPLETED",
				deliverySpeed: "EXPRESS",
				acceptedAt: lastWeek,
			});
		}

		const pending = await seedOrder(w.db, {
			id: "ord_express_new_week",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "EXPRESS",
			acceptedAt: null,
		});

		// A full week of last week's express does not follow the shop into this one. The
		// window is the week and **not** the billing period, so a monthly merchant is not
		// working off a month's allowance divided by four.
		const moved = await caller.orders.advance({ orderId: pending, to: "ACCEPTED" });
		expect(moved.status).toBe("ACCEPTED");

		w.close();
	});

	test("a rejected express order costs the shop nothing", async () => {
		const { w, businessId, caller } = await shop("FREE");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		// The shop said no, ten times, this week. A decline must not consume the quota it
		// declined to use — otherwise the cheapest way to run out of express is to be asked
		// for it.
		for (let index = 0; index < PLAN_LIMITS.FREE.expressPerWeek; index += 1) {
			await seedOrder(w.db, {
				id: `ord_express_rejected_${index}`,
				businessId,
				customerId: customer.id,
				status: "REJECTED",
				deliverySpeed: "EXPRESS",
				acceptedAt: new Date(),
			});
		}

		const pending = await seedOrder(w.db, {
			id: "ord_express_after_rejects",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "EXPRESS",
			acceptedAt: null,
		});

		const moved = await caller.orders.advance({ orderId: pending, to: "ACCEPTED" });
		expect(moved.status).toBe("ACCEPTED");

		w.close();
	});

	test("the top tier has bought out of being told no", async () => {
		const { w, businessId, caller } = await shop("BUSINESS");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		// Far past any number a real shop reaches, because the claim is that the cap is
		// absent rather than large.
		await acceptedExpress(w, businessId, 300, customer.id);

		const pending = await seedOrder(w.db, {
			id: "ord_express_top",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "EXPRESS",
			acceptedAt: null,
		});

		const moved = await caller.orders.advance({ orderId: pending, to: "ACCEPTED" });
		expect(moved.status).toBe("ACCEPTED");
		expect(PLAN_LIMITS.BUSINESS.expressPerWeek).toBe(Infinity);

		w.close();
	});

	test("a shop that stopped paying is held to the floor, not to what it bought", async () => {
		const { w, businessId, caller } = await shop("BUSINESS");
		const customer = await seedUser(w.db, { id: "usr_express_buyer" });

		// 45 days past a period end: past grace, inside the hidden window. `effectivePlan`
		// sends it to `FREE`, so the cap that applies is ten and not the tier it paid for.
		await seedSubscription(w.db, {
			businessId,
			plan: "BUSINESS",
			cadence: "MONTHLY",
			daysUntilDue: -45,
		});
		await acceptedExpress(w, businessId, PLAN_LIMITS.FREE.expressPerWeek, customer.id);

		const pending = await seedOrder(w.db, {
			id: "ord_express_lapsed",
			businessId,
			customerId: customer.id,
			status: "PENDING",
			deliverySpeed: "EXPRESS",
			acceptedAt: null,
		});

		const error = await refused(
			caller.orders.advance({ orderId: pending, to: "ACCEPTED" }),
		);
		expect(error.code).toBe("FORBIDDEN");
		expect((error.details as { plan: string }).plan).toBe("FREE");

		w.close();
	});
});
