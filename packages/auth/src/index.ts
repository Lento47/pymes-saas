import "@pymeshub/env/load";

/**
 * `@pymeshub/auth` — the caller's identity, spelled the same way by the API and its
 * clients.
 *
 * **Better Auth owns who a person is.** It runs inside `apps/api` (`src/auth.ts`),
 * keeps its accounts in the D1 `auth_*` tables, and issues the session cookie or the
 * bearer token. It owns nothing else: products, orders, memberships and payouts live
 * in D1 behind the Worker (see `adrs/0001-cloudflare-multi-client-marketplace.md`).
 *
 * The rule that holds it together: **a token proves identity, never permission.** Who
 * may read a business's orders is decided by the `membership` table, on every request,
 * from the session's user id in `apps/api/src/context.ts` — never by a claim in a
 * token, because a claim is data the bearer is holding.
 *
 * Nothing in this file runs in a browser or on a phone. The clients take the
 * dependency-free subpath `@pymeshub/auth/marketplace-client`, which never imports
 * this module.
 *
 * ## Why the side-effect import above
 *
 * `@pymeshub/env/load` reads the root `.env` into `process.env`. It has to be imported
 * for its side effect rather than called here, because ES imports are hoisted and
 * evaluated before the importing file's top-level code — a module that reads
 * `process.env` at import time cannot load the file for itself.
 *
 * This is the last surviving home of that side effect in this package: it used to be
 * reached through `config.ts`, which the Supabase verifier owned. `apps/api` imports
 * this module with `import type` only, which erases — so this import does not fire on
 * the Worker's boot path today. It is kept deliberately, because dropping it fails
 * silently: nothing throws, the environment simply stops being loaded for whoever next
 * imports the package root for value.
 */

/**
 * Who is calling.
 *
 * `email` may legitimately be missing — an account that signed up with a phone number
 * has none — so it is `string | null` rather than optional. A consumer forced to
 * distinguish "absent" from "null" gets it wrong somewhere, and there is no third state
 * worth representing.
 *
 * `sessionId` is Better Auth's session row id. It is carried for logging and for
 * revoking a session, and it decides no access on its own.
 */
export type AuthenticatedUser = {
	id: string;
	email: string | null;
	phone: string | null;
	name: string;
	image: string | null;
	sessionId: string | null;
};
