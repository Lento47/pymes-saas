/**
 * The id that makes placing an order safe to retry.
 *
 * `orders.place` is idempotent on `clientRequestId`: the same id twice returns the order
 * that already exists instead of placing a second one. That matters more on a phone than
 * anywhere else, because a phone is where the network disappears mid-request — in a lift,
 * on the road to the shop — and where the customer's reaction is to tap again. Without
 * this, that tap is a second order.
 *
 * So the id is generated **once per checkout attempt**, when the screen is opened or when
 * the customer confirms, and reused for every retry of that attempt. A fresh id per tap
 * is the same as no id at all.
 *
 * `crypto.randomUUID` when the runtime has it (Hermes on a modern RN does; older ones do
 * not), and a timestamp plus randomness when it does not. The fallback is not
 * cryptographically random and does not need to be — this is a deduplication key scoped to
 * one customer's attempts, not a secret. What it must be is unique across two taps in the
 * same second on two phones, which 13 random base-36 characters is.
 */
export function newClientRequestId(): string {
	const webCrypto = globalThis.crypto;
	if (typeof webCrypto?.randomUUID === "function") {
		return webCrypto.randomUUID();
	}
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 15)}`;
}

/**
 * The id a mutation carries so that a double-tap does not become two writes.
 *
 * Same reasoning, different scope: this one is per screen instance rather than per
 * attempt, which is what a mutation that is *not* idempotent server-side needs — the second
 * tap in the same second is the same intent and should be dropped, and a tap a minute
 * later is a new one. Reset it when the intent changes.
 */
export function newIdempotencyKey(): string {
	return newClientRequestId();
}
