import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	type TestWorld,
	world,
} from "./harness";

/**
 * The error contract, pinned where a client actually meets it — at the HTTP boundary.
 *
 * Everything else in this suite calls `appRouter.createCaller`, which skips the formatter:
 * handy, but it means a spec could pass against a wire shape no client ever sees. These
 * tests go through the real Hono app instead, so what they assert is the body a phone
 * parses, and they exist because that body is *not* what a first reading of
 * `docs/api-surface.md` suggests:
 *
 * tRPC knows nothing about `DomainError`, so a service's `ValidationError` reaches the
 * adapter as an unknown error and tRPC wraps it into `INTERNAL_SERVER_ERROR`, keeping the
 * domain error as the `cause`. The `errorFormatter` in `trpc.ts` reads exactly that cause
 * and republishes the code and the status the domain meant, plus `data.domainCode` and the
 * Spanish sentence — so a client may branch on `data.code`, and `domainCode` stays as the
 * name of the failure in our own vocabulary.
 *
 * What is *not* a domain error keeps tRPC's classification and answers 500. That is the
 * half worth pinning too: the correction must not turn a genuine bug into a plausible
 * 404 that nobody investigates.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

/** One tRPC call through the Worker, and the parsed body it answered with. */
async function call(
	test: TestWorld,
	procedure: string,
	input: unknown,
	options: { authorized?: boolean; environment?: string } = {},
): Promise<{ status: number; error?: WireError }> {
	const app = createApp();
	const search = new URLSearchParams({
		batch: "1",
		input: JSON.stringify({ "0": { json: input } }),
	});
	const response = await app.fetch(
		new Request(`http://api.test/trpc/${procedure}?${search}`, {
			headers: options.authorized
				? { authorization: "Bearer test-token" }
				: { "x-client": "web" },
		}),
		{ ...test.env, ENVIRONMENT: options.environment ?? "test" } as never,
	);

	const body = (await response.json()) as [{ error?: { json: WireError } }];
	return { status: response.status, error: body[0]?.error?.json };
}

type WireError = {
	message: string;
	code: number;
	data: {
		code: string;
		httpStatus: number;
		domainCode: string | null;
		requestId: string | null;
		details: Record<string, unknown> | null;
		stack?: string;
	};
};

describe("the error contract", () => {
	test("a domain error reaches the client as its domain code, in Spanish", async () => {
		const test = world();

		// `businesses.bySlug` is public, so this needs no session — a not-found is the
		// commonest domain error there is and it must not depend on auth to be shaped.
		const { error } = await call(test, "businesses.bySlug", {
			slug: "no-existe",
		});

		expect(error?.data.domainCode).toBe("NOT_FOUND");
		expect(error?.message).toBe("No encontramos lo que buscas");
		// Spanish, and written for a customer: no table name, no constraint, no stack frame
		// of ours in the message itself.
		expect(error?.message).not.toMatch(/select|drizzle|D1|at /i);
		// The request id is how a customer's screenshot becomes a log line.
		expect(typeof error?.data.requestId).toBe("string");

		// tRPC's own view, corrected to the domain's. These two lines used to be
		// `INTERNAL_SERVER_ERROR`/500 and were left deliberately red-adjacent, because a
		// domain error reaches tRPC as an unknown throw: it has no idea what a
		// `DomainError` is, so every one of them — a missing slug, an empty cart, a
		// suspended account — answered "something went wrong on our side".
		//
		// The correction lives in `trpc.ts`'s `errorFormatter`, not in a middleware as
		// `docs/api-surface.md` describes: a refusal thrown by `protectedProcedure` or
		// `businessProcedure` happens *before* any middleware appended after them, so
		// there is no later `next()` for one to wrap. The formatter is the only function
		// every response passes through.
		expect(error?.data.code).toBe("NOT_FOUND");
		expect(error?.data.httpStatus).toBe(404);

		test.close();
	});

	test("no session is UNAUTHORIZED, not a crash", async () => {
		const test = world();
		const { error } = await call(test, "cart.get", undefined, {
			authorized: true,
		});

		expect(error?.data.domainCode).toBe("UNAUTHORIZED");
		expect(error?.message).toBe("Inicia sesión para continuar");

		test.close();
	});

	test("the stack travels in development and not in production", async () => {
		const test = world();

		const dev = await call(test, "businesses.bySlug", { slug: "no-existe" });
		expect(typeof dev.error?.data.stack).toBe("string");

		// A bundled Worker's frames name our module layout, and a stack is not something a
		// customer's error report needs. It arrives as `null` rather than absent: the
		// formatter sets it to `undefined` and the wire encoding drops the key's value, not
		// the key.
		const prod = await call(
			test,
			"businesses.bySlug",
			{ slug: "no-existe" },
			{ environment: "production" },
		);
		expect(prod.error?.data.stack).toBeNull();
		expect(prod.error?.data.domainCode).toBe("NOT_FOUND");

		test.close();
	});

	test("the health check answers a value rather than throwing", async () => {
		const test = world();
		const app = createApp();
		const response = await app.fetch(
			new Request("http://api.test/health"),
			test.env as never,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ok: true, db: "ok" });

		test.close();
	});
});

describe("rate limits", () => {
	test("orders.place stops a retry loop, and says how", async () => {
		const test = world();
		const customer = await seedUser(test.db, { id: "usr_ratelimit" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		// The basket is empty, so every one of these is refused on its merits — which is the
		// point: the limiter counts *attempts*, before the order work, so a loop that never
		// succeeds still cannot run forever.
		const attempts: string[] = [];
		for (let attempt = 0; attempt < 12; attempt += 1) {
			const error = await refused(
				caller.orders.place({
					fulfilment: "PICKUP",
					paymentMethod: "CASH",
					clientRequestId: `req_limit_0000${attempt}`,
				}),
			);
			attempts.push(error.code);
		}

		// Ten in the window, then the refusal — and it is `TOO_MANY_REQUESTS`, which the apps
		// back off from rather than showing a modal.
		expect(attempts.slice(0, 10)).toEqual(Array(10).fill("BAD_REQUEST"));
		expect(attempts[10]).toBe("TOO_MANY_REQUESTS");
		expect(attempts[11]).toBe("TOO_MANY_REQUESTS");

		test.close();
	});

	test("business.inviteStaff stops an invitation loop", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db);
		const owner = await seedUser(test.db, { id: "usr_inviter" });
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(test, owner)) as Caller;

		const codes: string[] = [];
		for (let attempt = 0; attempt < 12; attempt += 1) {
			const error = await refused(
				caller.business.inviteStaff({
					businessId,
					email: `invitado${attempt}@example.test`,
					role: "STAFF",
				}),
			);
			codes.push(error.code);
		}

		expect(codes.slice(0, 10)).not.toContain("TOO_MANY_REQUESTS");
		expect(codes[10]).toBe("TOO_MANY_REQUESTS");

		// The limit is per caller, not per shop: another owner of the same business is
		// unaffected by somebody else's loop.
		const other = await seedUser(test.db, { id: "usr_other_owner" });
		await seedMembership(test.db, other.id, businessId, "OWNER");
		// The invitee has to exist: an address with no account is a `BAD_REQUEST` on
		// purpose, and that rule is not what this test is about.
		await seedUser(test.db, { id: "usr_invitee", email: "otro@example.test" });
		const otherCaller = appRouter.createCaller(
			await authed(test, other),
		) as Caller;
		const invited = await otherCaller.business.inviteStaff({
			businessId,
			email: "otro@example.test",
			role: "STAFF",
		});
		expect(invited).toBeDefined();

		test.close();
	});
});
