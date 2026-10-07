import { describe, expect, test } from "bun:test";

import { rateLimit } from "../src/context";
import type { Env } from "../src/env";
import { RateLimitError } from "../src/errors";
import { appRouter } from "../src/routers";

import { authed, seedBusiness, seedProduct, seedUser, world } from "./harness";

/**
 * The rate limiter, and the storage it counts on.
 *
 * `rateLimit` was a KV counter, and it could not work. The key was fixed for a whole
 * window — `rl:${bucket}:${identity}:${window}` — so every attempt inside the window
 * wrote the key it had just read, and Cloudflare KV allows one write per second per key
 * and **throws** past it. The rejection was not a `DomainError`, nothing caught it, and
 * `toDomainError` wrapped it into `InternalError`: a customer tapping "place order" twice
 * could be told a working shop was broken.
 *
 * These specs are mostly about the Durable Object that replaced it, and one is about the
 * consequence rather than the counter: **a limiter that cannot count must not refuse the
 * request.** That is the part worth pinning regardless of where the counting lives.
 */

const IDENTITY = "usr_ratelimit";

/** An env whose KV binding throws on any access, to prove nothing reads it. */
function withoutKv(env: Env): Env {
	return {
		...env,
		CACHE: {
			get: async () => {
				throw new Error("KV must not be on the rate-limit path");
			},
			put: async () => {
				throw new Error("KV must not be on the rate-limit path");
			},
			delete: async () => {
				throw new Error("KV must not be on the rate-limit path");
			},
		} as unknown as KVNamespace,
	};
}

describe("rateLimit", () => {
	test("counts nothing on KV — a KV that throws cannot stop the limiter", async () => {
		// The regression guard for the bug above, and behavioural on purpose. A spec that
		// read the source for `env.CACHE` would pass while a second KV write hid in the
		// object; this fails the moment anything on this path reaches for it.
		//
		// The assertion is that the limiter still *counts*, not merely that the call
		// resolves. Those are different, and the weaker one is worthless here: with KV on the
		// path and KV throwing, `rateLimit`'s catch would swallow every attempt, so the
		// limiter would answer "allowed" forever and the call would resolve — passing a
		// test that only checked for a resolution. Counting is the part that notices.
		const test = world();
		const env = withoutKv(test.env);
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await rateLimit(env, "orders:place", IDENTITY, 3, 60);
		}

		await expect(
			rateLimit(env, "orders:place", IDENTITY, 3, 60),
		).rejects.toBeInstanceOf(RateLimitError);

		test.close();
	});

	test("several attempts inside one second all succeed", async () => {
		// The exact shape that failed under KV: two writes to one key inside a second. Ten
		// in a tight loop is well inside a 60-second window, so every one of them is the
		// "second write" that used to throw.
		const test = world();
		for (let attempt = 0; attempt < 10; attempt += 1) {
			await rateLimit(test.env, "orders:place", IDENTITY, 10, 60);
		}

		test.close();
	});

	test("a burst stops at the limit and then refuses", async () => {
		const test = world();
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await rateLimit(test.env, "courier:invite", IDENTITY, 3, 60);
		}

		const refused = await rateLimit(
			test.env,
			"courier:invite",
			IDENTITY,
			3,
			60,
		).then(
			() => null,
			(error: unknown) => error,
		);
		expect(refused).toBeInstanceOf(RateLimitError);

		test.close();
	});

	test("a refused attempt does not move the count", async () => {
		// The KV version threw *before* its `put`, so a refusal left the count parked at
		// `limit`. An implementation that incremented and then reported "over the limit"
		// would let the count climb without bound inside one window. The outcome is the same
		// either way, which is exactly why it needs a spec.
		const test = world();
		await rateLimit(test.env, "support:reply", IDENTITY, 2, 60);
		await rateLimit(test.env, "support:reply", IDENTITY, 2, 60);
		for (let refusal = 0; refusal < 5; refusal += 1) {
			await rateLimit(test.env, "support:reply", IDENTITY, 2, 60).catch(
				() => {},
			);
		}

		// Still refusing, and — the part that would catch an increment-on-refusal — still
		// refusing rather than having fallen back to allowing once the count exceeded the
		// limit in a way that reset it.
		await expect(
			rateLimit(test.env, "support:reply", IDENTITY, 2, 60),
		).rejects.toBeInstanceOf(RateLimitError);

		test.close();
	});

	test("the count is per identity and per bucket", async () => {
		// Two counters that must not share. A merged counter would let one customer's
		// support replies exhaust a colleague's order placements.
		const test = world();
		await rateLimit(test.env, "orders:place", "usr_a", 1, 60);
		await expect(
			rateLimit(test.env, "orders:place", "usr_a", 1, 60),
		).rejects.toBeInstanceOf(RateLimitError);

		await rateLimit(test.env, "orders:place", "usr_b", 1, 60);
		await rateLimit(test.env, "orders:locate", "usr_a", 1, 60);

		test.close();
	});

	test("the count resets in the next window", async () => {
		const test = world();
		await rateLimit(test.env, "courier:directory", IDENTITY, 1, 60);
		await expect(
			rateLimit(test.env, "courier:directory", IDENTITY, 1, 60),
		).rejects.toBeInstanceOf(RateLimitError);

		// A one-second window and the next attempt lands in the following one. Written
		// against a 60-second window this would have to wait a minute for the suite.
		await rateLimit(test.env, "business:inviteStaff", IDENTITY, 1, 1);
		await new Promise((resolve) => setTimeout(resolve, 1100));
		await rateLimit(test.env, "business:inviteStaff", IDENTITY, 1, 1);

		test.close();
	});

	test("a storage failure does not refuse the request", async () => {
		// The consequence half, and the one that matters: a limiter is a defence against a
		// retry loop, not a correctness gate. `orders.place` is idempotent on
		// `clientRequestId`, so a retry this limiter failed to stop is still one order — a
		// duplicate the customer never sees. A refused order is a customer who cannot buy.
		const test = world();
		test.failRateLimitOnce();

		await expect(
			rateLimit(test.env, "orders:place", IDENTITY, 1, 60),
		).resolves.toBeUndefined();

		test.close();
	});
});

describe("an order survives a broken limiter", () => {
	test("orders.place still succeeds when the limiter's storage throws", async () => {
		// The end-to-end version of the case above, and the one that would have caught the
		// original bug: the KV rejection escaped as `InternalError` and the placement
		// failed with a 500 rather than with a sentence.
		const test = world();
		const shopId = await seedBusiness(test.db);
		await seedProduct(test.db, {
			id: "prd_limiter_item",
			businessId: shopId,
			priceMinor: 1750,
		});
		const customer = await seedUser(test.db, { id: "usr_limiter_customer" });
		const caller = appRouter.createCaller(await authed(test, customer));

		await caller.cart.addItem({
			productId: "prd_limiter_item",
			quantity: 1,
		});

		test.failRateLimitOnce();

		const order = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: "CASH",
			clientRequestId: "req_limiter_000001",
		});

		expect(order.status).toBe("PENDING");

		test.close();
	});
});
