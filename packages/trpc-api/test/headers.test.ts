import { describe, expect, test } from "bun:test";

import { newRequestId } from "@pymeshub/shared";

import { createApp } from "../src/app";
import type { Env } from "../src/env";
import { type TestWorld, world } from "./harness";

/**
 * The headers every response on this origin carries, asserted through the real
 * Hono app for the same reason `auth.test.ts` does: a header is a property of
 * the HTTP path (which middleware ran, in what order, before or after a route
 * set its own), and a unit test of a function nobody calls on its own would
 * prove none of that.
 *
 * Three things are pinned here:
 *
 * 1. **The origin's security headers.** `nosniff` is the one with a concrete
 *    bug behind it — `/files/:id` answers with a `Content-Type` read from the
 *    `upload` row and a year of `immutable` caching, so the header is what keeps
 *    a stored file from being sniffed into a document.
 * 2. **The request-id contract in both directions.** A valid inbound id is
 *    reflected (that is the feature: a phone's error and a Worker log line name
 *    the same request), and an inbound id the log format cannot carry is
 *    *replaced* rather than echoed — which is an injection guard, because the
 *    value is both printed to a log and written to a response header.
 * 3. **What a cross-origin client may read back.** `exposeHeaders` is the only
 *    thing that makes `x-request-id` and `cf-ray` visible to a browser; without
 *    it the client sends an id it can never correlate with.
 */

const ALLOWED_ORIGIN = "https://app.example";
const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

function envWith(test: TestWorld, overrides: Partial<Env> = {}): Env {
	return { ...test.env, ...overrides } as Env;
}

async function get(
	env: Env,
	path: string,
	headers: Record<string, string> = {},
): Promise<Response> {
	return createApp().fetch(
		new Request(`http://api.test${path}`, { headers }),
		env as never,
	);
}

describe("response headers", () => {
	test("every response carries the origin's security headers and a request id", async () => {
		const test = world();

		const response = await get(envWith(test), "/health");

		expect(response.status).toBe(200);
		// `nosniff` first: it is the header with the stored-file bug behind it.
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");

		// None inbound, so this is the generated branch — and generated means
		// *inside the alphabet the logger will echo*, not merely "some string".
		const generated = response.headers.get("x-request-id");
		expect(generated).not.toBeNull();
		expect(generated).toMatch(REQUEST_ID);

		test.close();
	});

	test("an inbound x-request-id is reflected, so a client error and a log line agree", async () => {
		const test = world();

		const response = await get(envWith(test), "/health", {
			// What a client mints with `newRequestId` from `@pymeshub/shared`.
			"x-request-id": newRequestId(),
		});

		const echoed = response.headers.get("x-request-id");
		expect(echoed).toMatch(REQUEST_ID);

		test.close();
	});

	test("an id the log format cannot carry is replaced, not reflected", async () => {
		const test = world();

		// What can actually reach the app: a value that is a legal header value
		// (Bun's Headers — and every browser — refuse CR/LF at construction, so an
		// injection that never leaves the client is the platform's guard, not ours)
		// but not a legal log id. Reflecting this into a log line and a response
		// header is what `requestIdFrom`'s format check refuses.
		const forged = "short forged!value";
		const response = await get(envWith(test), "/health", {
			"x-request-id": forged,
		});

		const echoed = response.headers.get("x-request-id");
		expect(echoed).not.toBe(forged);
		expect(echoed).toMatch(REQUEST_ID);

		test.close();
	});

	test("/files/:id carries them too, leaving its own caching to the route", async () => {
		const test = world();

		// An id with no row: 404, and still this origin's headers — the middleware
		// runs before routing, which is the ordering the point rests on.
		const response = await get(envWith(test), "/files/upl_missing");

		expect(response.status).toBe(404);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("x-request-id")).toMatch(REQUEST_ID);

		test.close();
	});

	test("a cross-origin response exposes the ids a browser may read", async () => {
		const test = world();

		// Under `/trpc`, where `browserCors` is mounted — `/health` is a bare
		// healthcheck with no CORS layer, and the status of this call (an
		// unauthenticated GET, so a 401) is not what is being pinned: the cors
		// middleware wraps the handler, and what it puts on the response is the
		// contract under test.
		const response = await get(
			envWith(test, { CORS_ORIGINS: ALLOWED_ORIGIN }),
			"/trpc/cart.get?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D",
			{ origin: ALLOWED_ORIGIN },
		);

		expect(response.status).toBe(401);
		const exposed = (
			response.headers.get("access-control-expose-headers") ?? ""
		).toLowerCase();
		// All three, because each answers a different question after a failure:
		// which request (ours), which token hand-off (`set-auth-token`), and
		// whether the edge saw it before the Worker did (`cf-ray`).
		expect(exposed).toContain("x-request-id");
		expect(exposed).toContain("set-auth-token");
		expect(exposed).toContain("cf-ray");

		test.close();
	});

	test("a preflight still allows the id header a client now sends", async () => {
		const test = world();

		const response = await createApp().fetch(
			new Request("http://api.test/trpc/cart.get", {
				method: "OPTIONS",
				headers: {
					origin: ALLOWED_ORIGIN,
					"access-control-request-method": "POST",
					"access-control-request-headers": "x-request-id,content-type",
				},
			}),
			envWith(test, { CORS_ORIGINS: ALLOWED_ORIGIN }) as never,
		);

		// Allowed, or every request from both clients fails at the preflight and
		// the CORS allow-list above is a lie.
		expect(response.status).toBeLessThan(300);
		const allowed = (
			response.headers.get("access-control-allow-headers") ?? ""
		).toLowerCase();
		expect(allowed).toContain("x-request-id");

		test.close();
	});

	test("/auth answers its preflight too, which is the mount the sign-in form actually uses", async () => {
		const test = world();

		// The `/trpc` preflight above was pinned while `/auth` had no equivalent, and that
		// gap is how `/auth` came to answer a preflight with a 403 carrying no
		// `Access-Control-*` header: a response the browser cannot read, so a sign-up that
		// never left the tab was reported as a CORS policy failure instead of the refusal it
		// was. `POST /auth/sign-up/email` is the request behind this preflight, so the mount
		// carrying the credentials is the one that has to answer it.
		const response = await createApp().fetch(
			new Request("http://api.test/auth/sign-up/email", {
				method: "OPTIONS",
				headers: {
					origin: ALLOWED_ORIGIN,
					"access-control-request-method": "POST",
					"access-control-request-headers": "content-type",
				},
			}),
			envWith(test, { CORS_ORIGINS: ALLOWED_ORIGIN }) as never,
		);

		expect(response.status).toBeLessThan(300);
		// The allowed origin is echoed back, so the browser lets the real POST through.
		expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
		// And `credentials` is why: the session is an HttpOnly cookie, so a preflight that
		// did not agree to credentials would still fail on the POST behind it.
		expect(response.headers.get("access-control-allow-credentials")).toBe("true");

		test.close();
	});
});
