/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";

import type { Env } from "../env";

/**
 * A fixed-window request counter, one instance per (bucket, identity).
 *
 * This exists because the counter it replaces provoked the limit it was written to
 * enforce. The KV version used one key per window bucket — `rl:${bucket}:${id}:${window}`
 * — so every attempt inside the window wrote the key it had just read. Cloudflare
 * documents the consequence ("Write key-value pairs · Workers KV"):
 *
 * > Workers KV has a maximum of 1 write to the same key per second. Writes made to
 * > the same key within 1 second will cause rate limiting (`429`) errors to be thrown.
 *
 * The rejection is not a `DomainError`, nothing caught it, and `toDomainError` wrapped
 * it into `InternalError` — so a customer tapping "place order" twice could be told a
 * working shop was broken. Reads are unlimited; only writes are capped.
 *
 * **Why a Durable Object, rather than a KV key with a sub-second component.** An
 * object's instance is single-threaded, so the compare and the increment happen
 * together. Splitting them across two round trips would leave exactly the race that
 * makes this worth doing: two concurrent attempts can both read `used = 9`, both see
 * `9 < 10`, and both write `10`. Cloudflare's other suggestion — spreading writes
 * across distinct keys — avoids the 429 by making every write a different key, which
 * also makes the counter count nothing.
 *
 * **The object owns the atomicity; the API owns the numbers.** `limit` and
 * `windowSeconds` arrive as data from the call sites' own constants, so what the
 * thresholds *mean* stays in `context.ts`. This object is told a threshold, not a
 * policy, and it never decides what a refusal means to a customer — `rateLimit` still
 * throws the `RateLimitError`.
 *
 * **A refusal does not increment.** The KV version threw *before* its `put`, so a
 * refused attempt left the count parked at `limit`; an object that incremented and
 * then reported "over the limit" would let the count climb without bound inside one
 * window. The outcome is the same either way — still refused for the rest of the
 * window — but this keeps the behaviour identical rather than quietly changing it.
 *
 * **Not a source of truth.** A DO can be evicted, and losing a count means a client
 * gets a fresh window, which is the right failure for a limiter. The one thing that
 * must not depend on this is a purchase, and it does not: `orders.place` is idempotent
 * on `clientRequestId`, so a retry this limiter failed to stop is still one order.
 */
export class RateLimitRoom extends DurableObject<Env> {
	/**
	 * One attempt: counted, and whether it was allowed.
	 *
	 * `count` is the number of *allowed* attempts in the current window, so a caller can
	 * log it without re-deriving anything.
	 */
	async hit(
		limit: number,
		windowSeconds: number,
	): Promise<{ allowed: boolean; count: number }> {
		const window = Math.floor(Date.now() / 1000 / windowSeconds);
		const state = await this.ctx.storage.get<StoredState>("window");

		// A rollover resets rather than carrying over. That is the fixed-window behaviour
		// the KV version had, including its looseness at a boundary, where the worst case
		// is two windows' worth of attempts — a looseness the previous docblock named as
		// the right trade, and this is not the commit to change it.
		if (!state || state.window !== window) {
			await this.ctx.storage.put("window", {
				window,
				count: 1,
			} satisfies StoredState);
			return { allowed: true, count: 1 };
		}

		if (state.count >= limit) {
			// No write. See the class docblock: refusing must not move the count.
			return { allowed: false, count: state.count };
		}

		const count = state.count + 1;
		await this.ctx.storage.put("window", {
			...state,
			count,
		} satisfies StoredState);
		return { allowed: true, count };
	}
}

/**
 * The object's whole state: which window it is counting, and how far into it.
 *
 * Two fields rather than one counter, because the window number has to travel with the
 * count — a bare integer cannot say whether it belongs to the window that is running now
 * or the one before it, and reading the old one is what makes the reset happen at all.
 */
type StoredState = {
	window: number;
	count: number;
};
