/**
 * `createMarketplaceAuthClient`, against a fake `fetch`.
 *
 * This is the file that replaced the old `verify.test.ts`. That one tested
 * `verifySupabaseToken`, which was deleted with the Supabase path — so the package's
 * `test` script passed while exercising nothing that ships. Everything below is on the
 * path a real sign-in takes: the web app and the Expo app both call this module, and
 * it is the only thing in the package a client can import.
 *
 * Three things are worth testing here and nothing else is:
 *
 * - **The wire.** The URL, the method and the payload for each call. Better Auth owns
 *   the other end; a typo in a path is a 404 that surfaces as "sign-in failed".
 * - **The error mapping**, asserted against the strings in the source rather than
 *   against strings retyped here, because these leave the package as translation keys.
 * - **The two transports.** A browser holds an HttpOnly cookie and must send
 *   `credentials: "include"`; a phone has no cookie jar, holds a token in SecureStore
 *   and must send `Authorization: Bearer`. Getting that backwards is a silent
 *   unauthenticated session, not an error.
 *
 * No test here touches the network: `fetch` is replaced for the duration of each case
 * and restored afterwards.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
	createMarketplaceAuthClient,
	type TokenStorage,
} from "./marketplace-client";

const BASE = "https://api.pymeshub.test";

/**
 * The storage key the module writes under. Retyped rather than imported because it is
 * not exported, and because it is a contract: the phone's SecureStore holds the session
 * under this key, so a change here is a change to what is already on customers' devices.
 */
const TOKEN_KEY = "pymeshub.session";

const originalFetch = globalThis.fetch;

type RecordedCall = {
	url: string;
	method: string;
	credentials: RequestCredentials | undefined;
	headers: Record<string, string>;
	body: string | undefined;
};

/**
 * Replace the global `fetch` with one that records the call and answers with whatever
 * the case decides. The module calls the global rather than taking a `fetch` argument,
 * so this is the only seam available — and it also proves the client reaches for the
 * platform's fetch and nothing else.
 */
function installFetch(
	respond: (call: RecordedCall) => Response,
): RecordedCall[] {
	const calls: RecordedCall[] = [];
	globalThis.fetch = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const call: RecordedCall = {
			url: String(input),
			method: (init?.method ?? "GET").toUpperCase(),
			credentials: init?.credentials,
			headers: { ...(init?.headers as Record<string, string> | undefined) },
			body: typeof init?.body === "string" ? init.body : undefined,
		};
		calls.push(call);
		return respond(call);
	}) as typeof fetch;
	return calls;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

/**
 * A `TokenStorage` that behaves like the phone's: async, and empty until written.
 *
 * Typed as the interface rather than inferred, so the fake cannot drift from what
 * SecureStore must implement — `read` is the test's own window into it.
 */
function memoryStorage(
	seed: Record<string, string> = {},
): TokenStorage & { read: (key: string) => string | undefined } {
	const items = new Map(Object.entries(seed));
	return {
		async getItem(key) {
			return items.get(key) ?? null;
		},
		async setItem(key, value) {
			items.set(key, value);
		},
		async removeItem(key) {
			items.delete(key);
		},
		read: (key) => items.get(key),
	};
}

const ok = (headers: Record<string, string> = {}) =>
	new Response(null, { status: 200, headers });
const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
const failure = (status: number) => new Response(null, { status });

/**
 * The rejection's message, as an exact string.
 *
 * `toThrow("...")` matches a substring, which would accept `"auth.error.generic"`
 * inside a longer message and would still pass if the string gained a prefix. These
 * keys are read by the i18n layer, so the whole value is the contract.
 */
async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof Error) return error.message;
		return String(error);
	}
	return "";
}

describe("the wire", () => {
	test("signIn POSTs the credentials to /auth/sign-in/email", async () => {
		const calls = installFetch(() => ok());
		await createMarketplaceAuthClient(BASE).signIn(
			"ana@example.test",
			"correct-horse-battery",
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(`${BASE}/auth/sign-in/email`);
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.body).toBe(
			JSON.stringify({
				email: "ana@example.test",
				password: "correct-horse-battery",
			}),
		);
		expect(calls[0]?.headers["content-type"]).toBe("application/json");
	});

	test("signUp POSTs email, password and name to /auth/sign-up/email", async () => {
		const calls = installFetch(() => ok());
		await createMarketplaceAuthClient(BASE).signUp(
			"nuevo@example.test",
			"a-long-enough-password",
			"Nuevo Cliente",
		);

		expect(calls[0]?.url).toBe(`${BASE}/auth/sign-up/email`);
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.body).toBe(
			JSON.stringify({
				email: "nuevo@example.test",
				password: "a-long-enough-password",
				name: "Nuevo Cliente",
			}),
		);
	});

	test("signOut POSTs an empty body to /auth/sign-out", async () => {
		const calls = installFetch(() => ok());
		await createMarketplaceAuthClient(BASE).signOut();

		expect(calls[0]?.url).toBe(`${BASE}/auth/sign-out`);
		expect(calls[0]?.method).toBe("POST");
		// Not `undefined`: `{}` is what makes this a POST rather than a GET, and Better
		// Auth answers a GET here with the sign-out page's HTML.
		expect(calls[0]?.body).toBe("{}");
	});

	test("currentSession GETs /auth/get-session with no body and no content type", async () => {
		const calls = installFetch(() => json(null));
		await createMarketplaceAuthClient(BASE).currentSession();

		expect(calls[0]?.url).toBe(`${BASE}/auth/get-session`);
		expect(calls[0]?.method).toBe("GET");
		expect(calls[0]?.body).toBeUndefined();
		expect(calls[0]?.headers["content-type"]).toBeUndefined();
	});
});

describe("error mapping", () => {
	test("429 becomes auth.error.rateLimited", async () => {
		installFetch(() => failure(429));
		const message = await rejectionMessage(
			createMarketplaceAuthClient(BASE).signIn("a@b.test", "password-123456"),
		);
		expect(message).toBe("auth.error.rateLimited");
	});

	test("401 becomes auth.error.invalidCredentials", async () => {
		installFetch(() => failure(401));
		const message = await rejectionMessage(
			createMarketplaceAuthClient(BASE).signIn("a@b.test", "password-123456"),
		);
		expect(message).toBe("auth.error.invalidCredentials");
	});

	test("anything else becomes auth.error.generic", async () => {
		for (const status of [400, 403, 404, 500, 503]) {
			installFetch(() => failure(status));
			const message = await rejectionMessage(
				createMarketplaceAuthClient(BASE).signUp(
					"a@b.test",
					"password-123456",
					"Ana",
				),
			);
			expect(message).toBe("auth.error.generic");
		}
	});

	test("the rejection is an Error, so callers can rely on `instanceof`", async () => {
		installFetch(() => failure(500));
		await expect(
			createMarketplaceAuthClient(BASE).signOut(),
		).rejects.toBeInstanceOf(Error);
	});

	test("a rejected sign-in leaves the stored session alone", async () => {
		// 429 and 5xx are not a verdict on the token; only 401 is.
		const storage = memoryStorage({ [TOKEN_KEY]: "still-good-token" });
		installFetch(() => failure(503));
		await rejectionMessage(
			createMarketplaceAuthClient(BASE, storage).currentSession(),
		);
		expect(storage.read(TOKEN_KEY)).toBe("still-good-token");
	});
});

describe("the two transports", () => {
	test("without storage it uses the cookie: credentials include, no bearer", async () => {
		const calls = installFetch(() =>
			ok({ "set-auth-token": "ignored-without-storage" }),
		);
		const client = createMarketplaceAuthClient(BASE);

		await client.signIn("a@b.test", "password-123456");

		expect(calls[0]?.credentials).toBe("include");
		expect(calls[0]?.headers.authorization).toBeUndefined();
		// The response header is read but there is nowhere to put it: a browser already
		// holds the session in the HttpOnly cookie the client cannot see.
		expect(await client.accessToken()).toBeNull();
	});

	test("with storage it uses the bearer: credentials omit, token attached", async () => {
		const storage = memoryStorage({ [TOKEN_KEY]: "stored-token" });
		// A JSON body, because `currentSession` parses the response — an empty one
		// throws on `response.json()` before the assertion could run.
		const calls = installFetch(() => json(null));

		await createMarketplaceAuthClient(BASE, storage).currentSession();

		expect(calls[0]?.credentials).toBe("omit");
		expect(calls[0]?.headers.authorization).toBe("Bearer stored-token");
	});

	test("with storage it persists set-auth-token off a successful response", async () => {
		const storage = memoryStorage();
		installFetch(() => ok({ "set-auth-token": "fresh-token" }));
		const client = createMarketplaceAuthClient(BASE, storage);

		await client.signIn("a@b.test", "password-123456");

		expect(storage.read(TOKEN_KEY)).toBe("fresh-token");
		expect(await client.accessToken()).toBe("fresh-token");
	});

	test("a 401 with storage drops the stored token", async () => {
		// The whole reason the phone persists anything: a session revoked on another
		// device must not keep being sent as a bearer token that will fail every call.
		const storage = memoryStorage({ [TOKEN_KEY]: "revoked-token" });
		installFetch(() => failure(401));

		const message = await rejectionMessage(
			createMarketplaceAuthClient(BASE, storage).signOut(),
		);

		expect(message).toBe("auth.error.invalidCredentials");
		expect(storage.read(TOKEN_KEY)).toBeUndefined();
	});

	test("signOut clears storage after the call succeeds", async () => {
		const storage = memoryStorage({ [TOKEN_KEY]: "stored-token" });
		const calls = installFetch(() => ok());

		await createMarketplaceAuthClient(BASE, storage).signOut();

		expect(calls[0]?.headers.authorization).toBe("Bearer stored-token");
		expect(storage.read(TOKEN_KEY)).toBeUndefined();
	});
});

describe("accessToken", () => {
	test("reads storage, and only storage", async () => {
		const calls = installFetch(() => {
			throw new Error("accessToken must not reach the network");
		});
		const storage = memoryStorage({ [TOKEN_KEY]: "stored-token" });

		expect(await createMarketplaceAuthClient(BASE, storage).accessToken()).toBe(
			"stored-token",
		);
		expect(calls).toHaveLength(0);
	});

	test("is null on the web, where the token is an HttpOnly cookie", async () => {
		const calls = installFetch(() => {
			throw new Error("accessToken must not reach the network");
		});
		expect(await createMarketplaceAuthClient(BASE).accessToken()).toBeNull();
		expect(calls).toHaveLength(0);
	});
});

describe("currentSession", () => {
	test("maps the payload into a MarketplaceSession", async () => {
		const storage = memoryStorage({ [TOKEN_KEY]: "stored-token" });
		installFetch(() =>
			json({
				user: { id: "user-1", email: "ana@example.test" },
				session: { expiresAt: "2026-01-01T00:00:00.000Z" },
			}),
		);

		const session = await createMarketplaceAuthClient(
			BASE,
			storage,
		).currentSession();

		expect(session).toEqual({
			userId: "user-1",
			email: "ana@example.test",
			accessToken: "stored-token",
			// Seconds, not milliseconds: every consumer compares it to `Date.now() / 1000`.
			expiresAt: Date.parse("2026-01-01T00:00:00.000Z") / 1000,
		});
	});

	test("carries an empty token on the web rather than undefined", async () => {
		installFetch(() =>
			json({
				user: { id: "user-1", email: "ana@example.test" },
				session: { expiresAt: "2026-01-01T00:00:00.000Z" },
			}),
		);

		const session = await createMarketplaceAuthClient(BASE).currentSession();

		expect(session?.accessToken).toBe("");
	});

	test("an empty session is null, and clears a stored token", async () => {
		// Better Auth answers `null` rather than 401 for "nobody is signed in", so this
		// branch — not the error path — is what a signed-out phone actually hits.
		const storage = memoryStorage({ [TOKEN_KEY]: "stale-token" });
		installFetch(() => json(null));

		expect(
			await createMarketplaceAuthClient(BASE, storage).currentSession(),
		).toBeNull();
		expect(storage.read(TOKEN_KEY)).toBeUndefined();
	});
});
