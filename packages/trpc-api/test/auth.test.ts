import { describe, expect, test } from "bun:test";
import { user as userTable } from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import { createContext } from "../src/context";
import type { Env } from "../src/env";
import {
	refused,
	seedSession,
	seedUser,
	type TestWorld,
	world,
} from "./harness";

/**
 * The identity path: Better Auth over D1, and the three answers it has to give.
 *
 * This suite exists because the migration from Supabase left the whole identity story
 * untested — `harness.ts` imported the `AuthenticatedUser` *type* and nothing else, and the
 * old spec covered a verifier for a service that is no longer called. So the properties
 * below are the ones a future edit to `auth.ts` or `context.ts` can silently break:
 *
 * - **it fails closed.** `AUTH_SECRET` is a placeholder in a fresh clone, and `createAuth`
 *   answers `null` for it — no session, no `/auth/*`, and a 401 on anything that needs one.
 *   The point of the suite's first group is that this is not the *absence* of a check: a
 *   genuine `auth_session` row and a genuine token are present in the database and are
 *   still ignored, because there is no secret to verify them with.
 * - **a suspended account is refused.** `suspendedAt` is a real gate in `resolveUser`, and
 *   the strongest way to pin it is to flip that one column on one row and watch the same
 *   token go from 200 to 403 and back.
 * - **a credential that did not verify is never accepted.** No token, garbage, a forged
 *   signed-cookie shape and an expired row are four different refusals that must not
 *   collapse into a success.
 * - **the rate limit still bites where it is for, and nowhere else.** Better Auth counts
 *   `${ip}|${path}`, so the sign-in allowance and the session read are separate buckets.
 *   The last group here is what stops a future edit from widening the first one by accident
 *   and what stops a rule key typo from turning the second into nothing.
 *
 * Everything here goes through the real Hono app rather than `appRouter.createCaller`,
 * because the identity path *is* the HTTP path: `resolveUser` reads `request.headers`, the
 * bearer plugin rewrites them, and a caller-level test would skip exactly the plumbing
 * under test. `seedSession` in `harness.ts` explains why a hand-written session row still
 * exercises the production verifier end to end.
 */

/**
 * A secret long enough for the guard in `createAuth`, and the two lengths that bracket it.
 *
 * Built with `repeat` rather than written out, because the first draft of this file spelled
 * a "31 character" secret that was 33 characters long and the boundary assertion passed for
 * the wrong reason. A length the reader has to count is a length nobody checks.
 */
const SECRET = "test-secret-that-is-at-least-32-characters-long";
const SHORT_SECRET = "x".repeat(31); // one short of the guard: `length < 32` refuses it.
const MIN_SECRET = "x".repeat(32); // exactly at it, and accepted.
const AUTH_URL = "http://localhost:8787";

/**
 * The test's bindings, with identity configured or deliberately not.
 *
 * `world()`'s `Env` carries no `AUTH_SECRET` and no `AUTH_URL`, which is what a fresh clone
 * has and therefore the state most of this suite wants. Overriding per call rather than
 * building a second harness keeps one `env` object as the thing under test in every spec.
 */
function envWith(test: TestWorld, overrides: Partial<Env> = {}): Env {
	return { ...test.env, ...overrides } as Env;
}

/** The bindings a deployed Worker has: a secret it can verify with, and a base URL. */
function configured(test: TestWorld): Env {
	return envWith(test, { AUTH_SECRET: SECRET, AUTH_URL });
}

/**
 * One tRPC call through the Worker, and the parsed body it answered with.
 *
 * Mirrors `errors.test.ts`'s helper, and for the same reason: what these specs assert is
 * the body and the status a client actually parses, not a caller-level rejection.
 *
 * `result` is lifted out of the batch envelope because "the call was allowed" and "the
 * procedure ran" are different claims, and a spec that only checked the status could not
 * tell a 200 carrying an empty body from a 200 carrying a cart.
 */
async function call(
	env: Env,
	options: { authorization?: string; origin?: string } = {},
): Promise<{ status: number; error?: WireError; result?: unknown }> {
	const search = new URLSearchParams({
		batch: "1",
		input: JSON.stringify({ "0": { json: undefined } }),
	});
	const headers: Record<string, string> = { "x-client": "web" };
	if (options.authorization) headers.authorization = options.authorization;
	if (options.origin) headers.origin = options.origin;

	const response = await createApp().fetch(
		new Request(`http://api.test/trpc/cart.get?${search}`, { headers }),
		env as never,
	);

	const body = (await response.json()) as [
		{ error?: { json: WireError }; result?: { data?: { json?: unknown } } },
	];
	return {
		status: response.status,
		error: body[0]?.error?.json,
		result: body[0]?.result?.data?.json,
	};
}

type WireError = {
	message: string;
	data: { code: string; httpStatus: number; domainCode: string | null };
};

describe("identity is not configured", () => {
	test("createAuth refuses every placeholder a fresh clone ships", () => {
		const test = world();

		// The state this repository is in by default, and the state a self-hoster is in
		// until they run `wrangler secret put AUTH_SECRET`. Each of these is a *different*
		// way to be unconfigured, and each has to reach the same `null`:
		expect(createAuth(envWith(test))).toBeNull();
		// `AUTH_SECRET=` in `.env` is an empty string, not an absent key — and it is not
		// falsy-checked by accident, it is falsy on purpose.
		expect(createAuth(envWith(test, { AUTH_SECRET: "", AUTH_URL }))).toBeNull();
		// The boundary is inclusive at 32, so 31 is the last length that fails. A guard that
		// drifted to `<= 32` would silently reject a valid secret; this line is what says so.
		expect(
			createAuth(envWith(test, { AUTH_SECRET: SHORT_SECRET, AUTH_URL })),
		).toBeNull();
		// A secret with nowhere to serve it from is also not a working install: `baseURL`
		// decides the cookie's `Secure` attribute and the OAuth redirect scheme.
		expect(createAuth(envWith(test, { AUTH_SECRET: SECRET }))).toBeNull();

		// The control, without which the four `toBeNull()`s above would pass just as happily
		// against a `createAuth` that always returned `null` — or that threw on import.
		const auth = createAuth(envWith(test, { AUTH_SECRET: SECRET, AUTH_URL }));
		expect(auth).not.toBeNull();
		expect(typeof auth?.api.getSession).toBe("function");
		// 32 is accepted, so the four refusals above are the guard's boundary and not its
		// blanket behaviour.
		expect(
			createAuth(envWith(test, { AUTH_SECRET: MIN_SECRET, AUTH_URL })),
		).not.toBeNull();

		test.close();
	});

	test("/auth/* answers 503 auth_not_configured rather than 500 or a 200", async () => {
		const test = world();

		// Mounted unconditionally in `app.ts`, and it has to say *why* rather than fall over:
		// a client that gets a 500 here cannot tell a missing secret from a broken Worker,
		// and a 200 with an empty body would read as "no session" — which is how a client
		// ends up retrying sign-in forever instead of surfacing a misconfigured deploy.
		const response = await createApp().fetch(
			new Request("http://api.test/auth/get-session"),
			test.env as never,
		);
		expect(response.status).toBe(503);
		// The body is asserted whole rather than with `toMatchObject`: this response carries a
		// single key, and a second one appearing beside it would be a client-visible change
		// that a subset match would wave through.
		const body = (await response.json()) as { error: string };
		expect(body).toEqual({ error: "auth_not_configured" });

		test.close();
	});

	test("a genuine session row and a genuine token are both ignored", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_failclosed" });
		// A session `createAuth` would accept, if only it had a secret to accept it with.
		const token = await seedSession(test.db, user.id);

		// The sharp form of fail-closed, and the reason it needs a test separate from "a
		// garbage token is refused": here the credential is *valid in every respect except
		// that the deployment cannot verify it*. The refusal comes from `resolveUser`'s
		// `if (!provider) return null`, not from a bad token — so this spec is the one that
		// would go red if that guard were ever reordered below the `getSession` call.
		const { status, error } = await call(envWith(test), {
			authorization: `Bearer ${token}`,
		});
		expect(status).toBe(401);
		expect(error?.data.domainCode).toBe("UNAUTHORIZED");
		expect(error?.data.httpStatus).toBe(401);

		// And the same token, against the same database, once a secret exists: 200. This is
		// what makes the 401 above a statement about `createAuth` rather than about a seed
		// that quietly did not work — the credential is genuinely valid, and the only thing
		// that changed between the two calls is whether the deployment can verify one.
		const withSecret = await call(configured(test), {
			authorization: `Bearer ${token}`,
		});
		expect(withSecret.status).toBe(200);

		test.close();
	});

	test("a secret that is set but too short refuses at the boundary too", async () => {
		const test = world();
		// The partial configuration, and the reason it needs a spec rather than one more line
		// in the `createAuth` test above: `AUTH_SECRET` is *present* here. An operator has set
		// it, a deploy has passed it through, and any check that asked "is the variable set"
		// — rather than "did `createAuth` give me an instance" — would call this deployment
		// live. `app.ts` and `resolveUser` both ask the second question, and this is what says
		// so at the two places a caller actually meets.
		const short = envWith(test, { AUTH_SECRET: SHORT_SECRET, AUTH_URL });
		// A token that is valid in every respect: a real `auth_session` row, signed the way
		// Better Auth signs one, for a user row that exists and is not suspended. So a 200
		// below would mean the deployment accepted a credential it has no secret to verify —
		// the exact failure this suite exists to catch, and the one a length check is for.
		const user = await seedUser(test.db, { id: "usr_short_secret" });
		const token = await seedSession(test.db, user.id);

		const route = await createApp().fetch(
			new Request("http://api.test/auth/get-session", {
				headers: { authorization: `Bearer ${token}` },
			}),
			short as never,
		);
		expect(route.status).toBe(503);
		const body = (await route.json()) as { error: string };
		expect(body).toEqual({ error: "auth_not_configured" });

		const { status, error } = await call(short, {
			authorization: `Bearer ${token}`,
		});
		expect(status).toBe(401);
		expect(error?.data.domainCode).toBe("UNAUTHORIZED");

		// The control, and without it the two refusals would be indistinguishable from a
		// token that never worked: the same token, the same database, one character more in
		// the secret. It is the *length* that decides, which is what `MIN_SECRET` is for.
		const exact = await call(
			envWith(test, { AUTH_SECRET: MIN_SECRET, AUTH_URL }),
			{
				authorization: `Bearer ${token}`,
			},
		);
		expect(exact.status).toBe(200);

		test.close();
	});

	test("an authenticated procedure answers 401, not 500", async () => {
		const test = world();

		// `protectedProcedure` -> `requireAuthed` -> `UnauthorizedError`, which the formatter
		// republishes as a 401 carrying `domainCode`. A 500 here would be the failure mode
		// this whole route exists to avoid: a client that retries instead of prompting for a
		// sign-in, and a log line that blames our code rather than the configuration.
		const { status, error } = await call(envWith(test));
		expect(status).toBe(401);
		expect(error?.data.code).toBe("UNAUTHORIZED");
		expect(error?.message).toBe("Inicia sesión para continuar");

		test.close();
	});

	test("/auth/* refuses a browser origin that is not allowed before it reaches the handler", async () => {
		const test = world();

		// `CORS_ORIGINS` is unset in `world()` and in a fresh clone, and `corsOrigins` turns
		// that into an empty list rather than a wildcard. The gate is above the handler on
		// purpose: a disallowed origin must not be able to *reach* Better Auth, because the
		// sign-in endpoints set a session cookie and a mis-set origin is how one gets read
		// cross-site. The native apps send no `Origin` and are unaffected — asserted below,
		// since a gate that also blocked them would break every phone.
		const denied = await createApp().fetch(
			new Request("http://api.test/auth/get-session", {
				headers: { origin: "https://evil.example" },
			}),
			test.env as never,
		);
		expect(denied.status).toBe(403);
		const deniedBody = (await denied.json()) as { error: string };
		expect(deniedBody).toEqual({ error: "forbidden" });

		const noOrigin = await createApp().fetch(
			new Request("http://api.test/auth/get-session"),
			test.env as never,
		);
		// Still 503, because the secret is still missing — the point is that it got *past*
		// the origin gate, which a 403 would not have shown.
		expect(noOrigin.status).toBe(503);

		// And an allowed origin, once one is configured, is let through to the handler.
		const allowedEnv = envWith(test, {
			AUTH_SECRET: SECRET,
			AUTH_URL,
			CORS_ORIGINS: "https://app.example",
		});
		const allowed = await createApp().fetch(
			new Request("http://api.test/auth/get-session", {
				headers: { origin: "https://app.example" },
			}),
			allowedEnv as never,
		);
		// Better Auth answers `null` for an anonymous `get-session` — a 200 with no session,
		// which is its own contract and not ours to change.
		expect(allowed.status).toBe(200);

		test.close();
	});
});

describe("a session that verified", () => {
	/**
	 * The credential has to be issued by Better Auth itself somewhere, or everything below
	 * is a suite about `seedSession` rather than about identity.
	 *
	 * So this spec goes the long way: a real `sign-up/email` through the mounted route
	 * writes the `user`, `auth_account`, `auth_session` and `auth_rate_limit` rows with the
	 * production adapter, and the token it hands back is then spent on a protected
	 * procedure. Every refusal later in this file is read against what this test proves is
	 * a working install — which is the only way to tell "it refused because it is safe"
	 * from "it refused because it is broken".
	 */
	test("a sign-up issues a session the API accepts, and stores no plaintext password", async () => {
		const test = world();
		const env = configured(test);
		const password = "una-contrasena-larga";

		const signUp = await createApp().fetch(
			new Request("http://api.test/auth/sign-up/email", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: "nueva@example.test",
					password,
					name: "Cliente Nueva",
				}),
			}),
			env as never,
		);
		expect(signUp.status).toBe(200);
		const issued = (await signUp.json()) as {
			token?: string;
			user?: { id?: string };
		};
		expect(typeof issued.token).toBe("string");
		// `?? ""` rather than a non-null assertion: an id that did not come back has to fail
		// the `not.toBe("")` below and *not* reach the query, where it would silently match
		// nothing and let the password assertions pass vacuously.
		const userId = issued.user?.id ?? "";
		expect(userId).not.toBe("");

		// The token from the sign-up response is a bearer token, and it works: no cookie jar,
		// no second round trip. This is the exact sequence a phone performs.
		const { status, result } = await call(env, {
			authorization: `Bearer ${issued.token}`,
		});
		expect(status).toBe(200);
		expect(result).toMatchObject({ status: "OPEN" });

		// The adapter really wrote everything, in this database, and the password is a hash
		// rather than the string the customer typed. A `minPasswordLength: 12` in `auth.ts`
		// means nothing if the value lands in a column verbatim.
		const account = test.sqlite
			.prepare("select password from auth_account where user_id = ?")
			.get(userId) as { password: string } | undefined;
		expect(account?.password).toBeTruthy();
		expect(account?.password).not.toBe(password);
		expect(account?.password).not.toContain(password);

		test.close();
	});

	test("resolves the caller, and is the control the refusals below are read against", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_signed_in" });
		const token = await seedSession(test.db, user.id);

		// The mounted route first, so the session is proven at its source and not only
		// through the tRPC context. If this ever returns `null`, every 401 in this file
		// becomes a test of the harness rather than of the API.
		const session = await createApp().fetch(
			new Request("http://api.test/auth/get-session", {
				headers: { authorization: `Bearer ${token}` },
			}),
			configured(test) as never,
		);
		expect(session.status).toBe(200);
		const body = (await session.json()) as { user?: { id?: string } } | null;
		expect(body?.user?.id).toBe(user.id);

		// And through the Worker's own path: the bearer plugin signs the token into the
		// session cookie, `sessionMiddleware` unsigns it, the adapter looks the row up by
		// token, and `resolveUser` mirrors the `user` row. The *cart* is what proves the last
		// step rather than only the first four — `protectedProcedure` refuses before the body
		// runs, so an empty 200 would mean the guard passed and the service then did nothing.
		const { status, result } = await call(configured(test), {
			authorization: `Bearer ${token}`,
		});
		expect(status).toBe(200);
		expect(result).toMatchObject({ status: "OPEN", items: [] });

		test.close();
	});

	test("no credentials at all is UNAUTHORIZED", async () => {
		const test = world();
		// Identity is fully configured, so this refusal is about the absent credential and
		// not about the absent secret — the two are different bugs and must be told apart.
		const { status, error } = await call(configured(test));
		expect(status).toBe(401);
		expect(error?.data.domainCode).toBe("UNAUTHORIZED");

		test.close();
	});

	test("a forged bearer is refused in both shapes it can take", async () => {
		const test = world();
		const env = configured(test);

		// The plugin branches on the token's shape, and the two branches fail differently —
		// so both need covering. A token with no `.` is signed by the *server* before it is
		// read back (`serializeSignedCookie`), so the HMAC always verifies; the refusal
		// arrives later, when no `auth_session` row matches. That is the branch a forged
		// opaque token takes, and it must not be mistaken for a valid one.
		const opaque = await call(env, {
			authorization: "Bearer not-a-real-token",
		});
		expect(opaque.status).toBe(401);
		expect(opaque.error?.data.domainCode).toBe("UNAUTHORIZED");

		// A token that *already* looks like a signed cookie is taken at its word and its
		// signature is checked against the secret. This is the closer forgery — an attacker
		// who knows the cookie format chooses the value — and a valid signature over a
		// bogus token would be exactly how one gets in.
		const forged = await call(env, {
			authorization: "Bearer forged.token.signature",
		});
		expect(forged.status).toBe(401);
		expect(forged.error?.data.domainCode).toBe("UNAUTHORIZED");

		// Neither is better than no token at all, which is the property being pinned: a
		// refused credential and an absent one are the same answer to the caller.
		const anon = await call(env);
		expect(anon.status).toBe(401);
		expect(anon.error?.data.domainCode).toBe(forged.error?.data.domainCode);

		test.close();
	});

	test("an expired session is refused", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_expired" });
		const token = await seedSession(test.db, user.id, {
			expiresAt: new Date(Date.now() - 1000),
		});

		// The row is real and the secret can verify this deployment, so the only thing wrong
		// is the timestamp. `expiresIn` is seven days in `auth.ts`, and a session that
		// outlives it is a phone that never asks to sign in again.
		const { status, error } = await call(configured(test), {
			authorization: `Bearer ${token}`,
		});
		expect(status).toBe(401);
		expect(error?.data.domainCode).toBe("UNAUTHORIZED");

		test.close();
	});
});

describe("the limiter over /auth/*", () => {
	/**
	 * Two claims, and they are two because they fail in opposite directions.
	 *
	 * The limiter is Better Auth's own and lives in its router, above the routing table, so
	 * every path under the mount is counted — including one that does not exist. What these
	 * specs are about is *which* counter a request spends from, because
	 * `createRateLimitKey` is `${ip}|${path}`: the two are independent, and an edit to one
	 * rule can therefore neither loosen nor tighten the other. That independence is the
	 * whole reason a session read could be given its own ceiling at all.
	 *
	 * The addresses are TEST-NET-3, which exists for exactly this: no packet is routed there
	 * and no customer is behind one. They are sent as `cf-connecting-ip`, the header
	 * `auth.ts` resolves first, and sending it is also what proves the resolution works — a
	 * config that had lost `ipAddressHeaders` would fall back to the literal
	 * `no-trusted-ip` bucket, and both addresses below would then share one allowance.
	 */
	const IP_ONE = "203.0.113.7";
	const IP_TWO = "203.0.113.8";
	const IP_THREE = "203.0.113.9";

	/** The status one request through the real app answered with, from a chosen address. */
	async function statusFrom(
		env: Env,
		path: string,
		ip: string,
		body?: unknown,
	): Promise<number> {
		const headers: Record<string, string> = { "cf-connecting-ip": ip };
		if (body !== undefined) headers["content-type"] = "application/json";
		const response = await createApp().fetch(
			new Request(`http://api.test/auth/${path}`, {
				method: body === undefined ? "GET" : "POST",
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
			env as never,
		);
		return response.status;
	}

	/** A credential that is wrong in the ordinary way: no `auth_account` row at all. */
	function signIn(env: Env, ip: string, email: string): Promise<number> {
		return statusFrom(env, "sign-in/email", ip, {
			email,
			password: "una-contrasena-larga",
		});
	}

	test("refuses the sixth sign-in from one address, and only from that address", async () => {
		const test = world();
		const env = configured(test);

		// No account exists for that address, so each attempt is a 401: made, refused, and
		// counted. The 401s are asserted rather than skipped because they are what rules out
		// the other explanation for the 429 below — a route refusing everything, which is a
		// rate limit nobody could ever get past.
		//
		// Five is the allowance `customRules` sets for this path, and it is the number that
		// must not grow: it is the only thing standing between D1 and a password-guessing loop,
		// so the sixth attempt is what says it is still there.
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect(await signIn(env, IP_ONE, "nadie@example.test")).toBe(401);
		}
		expect(await signIn(env, IP_ONE, "nadie@example.test")).toBe(429);

		// The control the shared-bucket failure would not survive: the same request, inside the
		// same window, from a different address, answered rather than refused. If
		// `ipAddressHeaders` were dropped from `auth.ts`, both callers would land in one bucket
		// and this would be a 429 as well — so this line is what makes the refusal above a
		// statement about *one* customer's allowance.
		//
		// That bucket would be named `127.0.0.1`, not `no-trusted-ip`. `getIP` answers
		// `LOCALHOST_IP` whenever `isTest()` or `isDevelopment()` is true, and returns `null`
		// — the value `resolveRateLimitConfig` is what turns into `no-trusted-ip` — only in a
		// real deployment with no resolvable header. The failure is identical either way, but
		// the wrong literal would send the next reader hunting for a key this test never
		// produces.
		expect(await signIn(env, IP_TWO, "otra@example.test")).toBe(401);

		test.close();
	});

	test("does not count a burst of session reads as anything", async () => {
		const test = world();
		const env = configured(test);

		// More than the 30/min every path used to get, and fewer than the 300 the read is
		// allowed now. That band is the point: against the un-narrowed rule the 31st read is a
		// 429, and a 429 on the read is what the session providers used to render as "signed
		// out" — a customer signing themselves out by opening the app.
		//
		// The statuses are collected rather than asserted one by one, because a failure has to
		// be readable: "expected [] to equal [429, 429, …]" says what happened and how often,
		// and forty `toBe(200)`s would say only that one of them did not.
		const refused: number[] = [];
		for (let attempt = 0; attempt < 40; attempt += 1) {
			const status = await statusFrom(env, "get-session", IP_THREE);
			if (status !== 200) refused.push(status);
		}
		expect(refused).toEqual([]);

		// The read spending nothing from the credential bucket is the other half of the
		// independence claim, and it is not decoration: it is what says the ceiling added to
		// `/get-session` is a change to that one counter and not a change to the one in front
		// of the password.
		expect(await signIn(env, IP_THREE, "tercera@example.test")).toBe(401);

		test.close();
	});
});

describe("a suspended account", () => {
	test("is refused at 403, and the refusal follows the one column that decides it", async () => {
		const test = world();
		const env = configured(test);
		const user = await seedUser(test.db, {
			id: "usr_suspended",
			suspendedAt: new Date(),
		});
		const token = await seedSession(test.db, user.id);

		// `resolveUser` throws rather than returning `null`, and the difference is the whole
		// reason this test exists: a `null` would be a 401, which tells a suspended customer
		// their password is wrong and sends them into a reset loop. `ForbiddenError` says the
		// account is suspended, in Spanish, and it is what the apps show.
		const direct = await refused(
			createContext({
				env,
				request: new Request("http://api.test/trpc/cart.get", {
					headers: { authorization: `Bearer ${token}` },
				}),
				requestId: "test",
			}),
		);
		expect(direct.code).toBe("FORBIDDEN");
		expect(direct.message).toBe("Esta cuenta está suspendida");

		// The same thing at the boundary a client meets. Note it is a *domain* error here,
		// corrected by the formatter even though `createContext` threw before a tRPC context
		// existed — a 500 would have been the easy answer wrong.
		const suspended = await call(env, { authorization: `Bearer ${token}` });
		expect(suspended.status).toBe(403);
		expect(suspended.error?.data.domainCode).toBe("FORBIDDEN");
		expect(suspended.error?.message).toBe("Esta cuenta está suspendida");

		// The control, and the reason this is one test rather than two: nothing changes here
		// but `suspendedAt` on the same row. Same token, same secret, same user id — so the
		// refusal above cannot be about the session, the seed, or the environment.
		await test.db
			.update(userTable)
			.set({ suspendedAt: null })
			.where(eq(userTable.id, user.id));
		const reinstated = await call(env, { authorization: `Bearer ${token}` });
		expect(reinstated.status).toBe(200);

		test.close();
	});
});
