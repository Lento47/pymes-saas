import { describe, expect, test } from "bun:test";
import { LAUNCH_PRICE_BOOK, priceMinorFor } from "@pymeshub/shared/plans";

import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedPriceBook,
	seedSubscription,
	seedUser,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

async function merchant(w: ReturnType<typeof world>, suffix: string) {
	await seedPriceBook(w.db);
	const businessId = await seedBusiness(w.db, {
		id: `biz_sub_${suffix}`,
		plan: "FREE",
	});
	const owner = await seedUser(w.db, { id: `usr_sub_${suffix}` });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	return {
		businessId,
		caller: appRouter.createCaller(await authed(w, owner)) as Caller,
	};
}

async function rejected(promise: Promise<unknown>) {
	try {
		await promise;
		throw new Error("expected the call to be refused, and it succeeded");
	} catch (error) {
		return error as { code?: string };
	}
}

describe("subscription.changePlan", () => {
	test("a paid plan without a SINPE reference is refused", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "no_ref");
		const error = await rejected(
			caller.subscription.changePlan({
				businessId,
				plan: "STARTER",
				cadence: "MONTHLY",
			}),
		);
		expect(error.code).toBe("BAD_REQUEST");
		w.close();
	});

	test("a paid plan with a short reference is refused", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "short_ref");
		const error = await rejected(
			caller.subscription.changePlan({
				businessId,
				plan: "STARTER",
				cadence: "MONTHLY",
				reference: "ab",
			}),
		);
		expect(error.code).toBe("BAD_REQUEST");
		w.close();
	});

	test("a SINPE reference activates the paid plan now", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "pay");
		const before = Date.now();
		const updated = await caller.subscription.changePlan({
			businessId,
			plan: "STARTER",
			cadence: "MONTHLY",
			reference: "SINPE-441122",
		});
		expect(updated.plan).toBe("STARTER");
		expect(updated.cadence).toBe("MONTHLY");
		expect(updated.status).toBe("ACTIVE");
		expect(updated.priceMinor).toBe(
			priceMinorFor("STARTER", "MONTHLY", LAUNCH_PRICE_BOOK),
		);
		expect(updated.lastPaidAt?.getTime()).toBeGreaterThanOrEqual(before);
		expect(updated.periodStart?.getTime()).toBeGreaterThanOrEqual(before);
		expect(updated.periodEnd?.getTime()).toBeGreaterThan(before);

		const row = w.sqlite
			.query(
				"select action, meta as m from audit_log where action = 'SUBSCRIPTION_PLAN_CHANGED'",
			)
			.get() as { action: string; m: string };
		const meta = JSON.parse(row.m) as { reference: string };
		expect(meta.reference).toBe("SINPE-441122");
		w.close();
	});

	test("a mid-period switch recaptures the new price now", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "switch");
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
			cadence: "MONTHLY",
			daysUntilDue: 20,
			priceMinor: priceMinorFor("STARTER", "MONTHLY", LAUNCH_PRICE_BOOK),
		});
		const updated = await caller.subscription.changePlan({
			businessId,
			plan: "GROWTH",
			cadence: "MONTHLY",
			reference: "SINPE-GROWTH-9",
		});
		expect(updated.plan).toBe("GROWTH");
		expect(updated.priceMinor).toBe(
			priceMinorFor("GROWTH", "MONTHLY", LAUNCH_PRICE_BOOK),
		);
		expect(updated.status).toBe("ACTIVE");
		w.close();
	});

	test("a past-due shop on the same pair restarts the period with a reference", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "past");
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
			cadence: "MONTHLY",
			daysUntilDue: -45,
		});
		const updated = await caller.subscription.changePlan({
			businessId,
			plan: "STARTER",
			cadence: "MONTHLY",
			reference: "SINPE-RENEW-01",
		});
		expect(updated.status).toBe("ACTIVE");
		expect(updated.plan).toBe("STARTER");
		expect(updated.lastPaidAt).not.toBeNull();
		w.close();
	});

	test("FREE does not take a reference and clears the period", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "free");
		await seedSubscription(w.db, {
			businessId,
			plan: "STARTER",
			cadence: "MONTHLY",
			daysUntilDue: 10,
		});
		const refusedPaid = await rejected(
			caller.subscription.changePlan({
				businessId,
				plan: "FREE",
				cadence: null,
				reference: "SINPE-NOPE",
			}),
		);
		expect(refusedPaid.code).toBe("BAD_REQUEST");

		const updated = await caller.subscription.changePlan({
			businessId,
			plan: "FREE",
			cadence: null,
		});
		expect(updated.plan).toBe("FREE");
		expect(updated.cadence).toBeNull();
		expect(updated.priceMinor).toBeNull();
		expect(updated.periodStart).toBeNull();
		expect(updated.periodEnd).toBeNull();
		w.close();
	});
});

describe("subscription.options", () => {
	test("names the platform SINPE number when the env has one", async () => {
		const w = world();
		w.env.PLATFORM_SINPE_PHONE = "8888-1234";
		const { businessId, caller } = await merchant(w, "sinpe");
		const listed = await caller.subscription.options({ businessId });
		expect(listed.sinpePhone).toBe("8888-1234");
		expect(listed.options.length).toBeGreaterThan(0);
		w.close();
	});

	test("returns a blank destination as null", async () => {
		const w = world();
		const { businessId, caller } = await merchant(w, "nosinpe");
		const listed = await caller.subscription.options({ businessId });
		expect(listed.sinpePhone).toBeNull();
		w.close();
	});
});
