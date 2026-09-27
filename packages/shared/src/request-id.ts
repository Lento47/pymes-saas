/**
 * A correlation id the *client* mints, for one HTTP request.
 *
 * This is deliberately **not** an id kind in `./ids`: `newId` mints row identities
 * server-side only (its docblock: `globalThis.crypto` is not guaranteed on React
 * Native, and a client must never choose a row's identity). A request id is the
 * opposite shape of thing — it never reaches a table, the server only echoes it
 * back into its own log line, and the *reason* to send it is that the phone that
 * just showed "algo salió mal" can name the exact request a support thread should
 * grep for in `wrangler tail`.
 *
 * Two constraints shape the body:
 *
 * - **No `crypto`.** The mobile client is the main user of this, and the same
 *   module has to load under Hermes without a polyfill. `Math.random` is not
 *   cryptographic and does not need to be: this id grants nobody anything, it
 *   only has to be unique within one API's log stream.
 * - **The server decides what it accepts.** `requestIdFrom` in
 *   `packages/trpc-api/src/logging.ts` reflects only `^[A-Za-z0-9._-]{8,64}$`
 *   and mints its own otherwise — so anything it rejects degrades to a
 *   server-generated id rather than failing. This function stays inside that
 *   alphabet on purpose: an id the server refuses is an id that fails to
 *   correlate, which is the entire feature.
 *
 * One per HTTP request, not per procedure: `httpBatchLink` folds several calls
 * into one request, and the server has one id for that request.
 */
export function newRequestId(): string {
	const stamp = Date.now().toString(36);
	const suffix = Math.random().toString(36).slice(2, 13);
	return `${stamp}-${suffix}`;
}

/**
 * True when a string would be reflected by the server as-is — the alphabet and
 * length `requestIdFrom` accepts. Offered to tests and to a client that wants to
 * pre-validate before logging its own id; not called on the sending path,
 * because a rejection there is harmless (the server mints one instead).
 */
export function isReflectableRequestId(value: string): boolean {
	return /^[A-Za-z0-9._-]{8,64}$/.test(value);
}
