/// <reference types="@cloudflare/workers-types" />

import { trpcServer } from "@hono/trpc-server";
import {
	createDb,
	membership as membershipTable,
	order as orderTable,
} from "@pymeshub/db";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { createContext } from "./context";
import { corsOrigins, type Env, orderRoomFor } from "./env";
import { DomainError, InternalError } from "./errors";
import { createLogger, requestIdFrom } from "./logging";
import { appRouter } from "./routers";

/**
 * The Worker's HTTP surface.
 *
 * Three things live here and nothing else: the request id and its log line, CORS, and
 * the mounts — `/trpc` for everything the clients read and write, `/auth` for Better
 * Auth's own handlers, and `/orders/:id/live` for the socket. REST is
 * deliberately not a second data surface. The one exception is `/health`, which a
 * deploy smoke test hits before it trusts a release and which therefore must not need
 * a session.
 *
 * The error handler is the last piece of `docs/api.md`'s discipline to survive: a
 * failure leaving this Worker is either a domain error carrying a sentence written for
 * a customer, or a generic sentence plus the request id that finds the cause in the
 * logs. An unhandled exception's own message never reaches a client — a D1 error names
 * tables and constraints, which is a schema disclosure wearing helpfulness as a
 * disguise.
 */

const TRPC_PREFIX = "/trpc";
const AUTH_PREFIX = "/auth";

/**
 * The CORS policy both browser-facing mounts share.
 *
 * `/trpc` and `/auth` have to answer a preflight identically. A browser told it may
 * call one mount and refused the other fails on a request nobody wrote — the OPTIONS it
 * sends first — so the endpoint that looks broken is never the one that was refused,
 * and the failure reads as a 404 for a path no client asks for in our own code.
 */
function browserCors(origins: string[]): Parameters<typeof cors>[0] {
	return {
		// `null` for a disallowed origin, never a fallback to `origins[0]`: echoing some
		// *other* allowed origin back at a disallowed caller is a confusing header to
		// debug, even though the browser blocks the request either way.
		origin: (origin: string) => (origins.includes(origin) ? origin : null),
		allowHeaders: ["authorization", "content-type", "x-client", "x-request-id"],
		allowMethods: ["GET", "POST", "OPTIONS"],
		// `set-auth-token` is how the native client is *given* its bearer token — the
		// Expo app reads it off the response and stores it — so it has to be readable
		// cross-origin or the token never reaches SecureStore.
		exposeHeaders: ["x-request-id", "set-auth-token"],
		credentials: true,
		maxAge: 86400,
	};
}

/** Whether this user may watch this order: theirs as a customer, or their business's. */
async function mayWatchOrder(
	db: ReturnType<typeof createDb>,
	orderId: string,
	userId: string,
): Promise<boolean> {
	const rows = await db
		.select({
			customerId: orderTable.customerId,
			businessId: orderTable.businessId,
		})
		.from(orderTable)
		.where(eq(orderTable.id, orderId))
		.limit(1);

	const row = rows[0];
	// The order does not exist and the order is not yours answer identically, on
	// purpose — see `errors.ts`. A socket is the one place where a difference would be
	// easy to leak, because the answer is a 404 or a 101 and nothing in between.
	if (!row) return false;
	if (row.customerId === userId) return true;

	const staff = await db
		.select({ id: membershipTable.id })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, row.businessId),
				eq(membershipTable.userId, userId),
			),
		)
		.limit(1);
	return staff.length > 0;
}

export function createApp() {
	const app = new Hono<{ Bindings: Env; Variables: { requestId: string } }>();

	/**
	 * Request id, first, so everything after it — including the error handler — can name
	 * the request. Taken from `x-request-id` when a client or our own web app supplies
	 * one, which is what makes a browser error and a Worker log line the same story.
	 */
	app.use("*", async (c, next) => {
		const requestId = requestIdFrom(c.req.header("x-request-id"));
		c.set("requestId", requestId);
		c.header("x-request-id", requestId);
		await next();
	});

	/**
	 * One log line per request.
	 *
	 * Path only, never the query string: `?code=…` on an OAuth callback and `?token=…`
	 * on anything a customer pasted are both real, and a log line is the artefact that
	 * outlives the request. The level follows the status, so a 5xx is findable by
	 * filtering and a healthy 200 does not drown it.
	 */
	app.use("*", async (c, next) => {
		const started = Date.now();
		const logger = createLogger({
			requestId: c.get("requestId"),
			environment: c.env.ENVIRONMENT,
			version: c.env.API_VERSION,
		});
		await next();
		const fields = {
			method: c.req.method,
			path: new URL(c.req.url).pathname,
			status: c.res.status,
			durationMs: Date.now() - started,
			client: c.req.header("x-client") ?? "unknown",
		};
		if (c.res.status >= 500) logger.error("request failed", fields);
		else if (c.res.status >= 400) logger.warn("request rejected", fields);
		else logger.info("request", fields);
	});

	/**
	 * CORS for the web app, and for Expo's web target in development.
	 *
	 * `credentials` is **on**, and it follows the two clients rather than one. The web
	 * client is built with no storage argument — `apps/web/lib/auth/client.ts` calls
	 * `createMarketplaceAuthClient(baseUrl)` and stops — so `marketplace-client.ts`
	 * fetches with `credentials: "include"` and the session is an HttpOnly cookie
	 * Better Auth sets. The native client is the opposite: it passes a SecureStore
	 * implementation, fetches with `credentials: "omit"`, and attaches its bearer token
	 * in `Authorization` itself. Turning credentials off would break the first; the
	 * bearer scheme is what the second uses, not what this header decides.
	 *
	 * Allowing credentials is safe here *because* the allowed origin is an explicit
	 * allowlist and never `*`: the header is one exact origin out of `corsOrigins(env)`,
	 * or nothing at all. A browser will not expose a credentialed response to a page
	 * whose origin did not come back in `Access-Control-Allow-Origin`, so a mis-set
	 * origin cannot read a session — the worst case is a request that fails.
	 *
	 * An empty `CORS_ORIGINS` allows no browser origin, not all of them: the native apps
	 * send no `Origin` and are unaffected, and a deployed Worker that forgot the variable
	 * answers nothing rather than everything.
	 */
	app.use(`${TRPC_PREFIX}/*`, async (c, next) => {
		const allowed = corsOrigins(c.env);
		const origin = c.req.header("origin");
		if (c.req.method === "POST" && origin && !allowed.includes(origin))
			return c.json({ error: "forbidden" }, 403);
		return cors(browserCors(allowed))(c, next);
	});

	/**
	 * The same policy over `/auth/*`, plus the preflight it was missing.
	 *
	 * `POST /auth/sign-in/email` carries `content-type: application/json` and cookies, so
	 * it is not a CORS-simple request: the browser asks `OPTIONS /auth/sign-in/email`
	 * first. Nothing answered that — the OPTIONS matched no route of its own and fell
	 * through to `app.notFound`, and a 404 preflight is a sign-in that never leaves the
	 * browser. `cors()` terminates a preflight itself, with an empty 204, and does not
	 * call `next`, so the router below only ever sees the GET and the POST.
	 *
	 * The origin gate runs *before* the middleware writes anything, so a disallowed
	 * caller is refused while no `Access-Control-*` header exists yet: it gets the 403
	 * it always got, and a page that cannot read the 403 cannot read anything else.
	 */
	app.use(`${AUTH_PREFIX}/*`, async (c, next) => {
		const allowed = corsOrigins(c.env);
		const origin = c.req.header("origin");
		if (origin && !allowed.includes(origin))
			return c.json({ error: "forbidden" }, 403);
		return cors(browserCors(allowed))(c, next);
	});

	app.on(["GET", "POST"], `${AUTH_PREFIX}/*`, async (c) => {
		const auth = createAuth(c.env);
		if (!auth) return c.json({ error: "auth_not_configured" }, 503);
		c.header("Cache-Control", "no-store");
		return auth.handler(c.req.raw);
	});

	/**
	 * Uploaded images, served from R2.
	 *
	 * Public, and necessarily so: the URL ends up in an `<img>` - a business
	 * reading a courier's vehicle profile, the same picture on web and on the
	 * phone - and an `<img>` sends no credentials worth checking. The objects
	 * are public-by-construction anyway: nothing sensitive is uploaded through
	 * `uploads.image`, and a signed URL would expire inside a profile row that
	 * is meant to outlive the request that wrote it.
	 *
	 * `immutable` because the keys are generated per upload: a replaced photo
	 * is a new key, never a re-used one, so no cache ever holds a stale picture
	 * under a current URL.
	 */
	app.get("/uploads/*", async (c) => {
		const key = c.req.param("*");
		if (!key || key.startsWith("/") || key.includes(".."))
			return c.json({ error: "not_found" }, 404);

		const object = await c.env.MEDIA.get(key);
		if (!object) return c.json({ error: "not_found" }, 404);

		return new Response(object.body, {
			headers: {
				"Content-Type":
					object.httpMetadata?.contentType ?? "application/octet-stream",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	});

	/** Public, and it must stay public: the smoke test that gates a deploy runs first. */
	app.get("/health", async (c) => {
		const db = createDb(c.env.DB);
		let database: "ok" | "unreachable" = "ok";
		try {
			// A real round trip, not a binding check. `c.env.DB` is present on a Worker
			// whose database has been deleted, and a health check that passes in that
			// state is worse than none.
			await db.run(sql`select 1`);
		} catch {
			database = "unreachable";
		}
		return c.json(
			{ ok: database === "ok", version: c.env.API_VERSION, db: database },
			database === "ok" ? 200 : 503,
		);
	});

	app.use(
		`${TRPC_PREFIX}/*`,
		trpcServer({
			router: appRouter,
			createContext: (_opts, c) =>
				createContext({
					env: c.env,
					request: c.req.raw,
					requestId: c.get("requestId"),
				}),
		}),
	);

	/**
	 * The live order socket.
	 *
	 * The session is verified **here**, in the Worker, and only then is the upgrade
	 * forwarded to the Durable Object. A DO is keyed by order id and deciding who may
	 * connect is not its job: resolving a token against `auth_session` is
	 * `createContext`'s work, and re-reading `membership` belongs to the procedures in
	 * `trpc.ts`. A room that answered that question itself would be a second, silently
	 * diverging answer to "may this person watch this order" — and one reachable by
	 * anyone holding an order id. That is why this route exists at all rather than the
	 * clients addressing the DO directly.
	 */
	app.get("/orders/:id/live", async (c) => {
		const orderId = c.req.param("id");
		const context = await createContext({
			env: c.env,
			request: c.req.raw,
			requestId: c.get("requestId"),
		});
		if (!context.user) return c.json({ error: "unauthorized" }, 401);

		const db = createDb(c.env.DB);
		if (!(await mayWatchOrder(db, orderId, context.user.id))) {
			return c.json({ error: "not_found", requestId: c.get("requestId") }, 404);
		}

		return orderRoomFor(c.env, orderId).fetch(c.req.raw);
	});

	app.notFound((c) =>
		c.json({ error: "not_found", requestId: c.get("requestId") }, 404),
	);

	app.onError((error, c) => {
		const requestId = c.get("requestId") ?? "unknown";
		const logger = createLogger({ requestId, environment: c.env?.ENVIRONMENT });

		if (error instanceof DomainError) {
			logger.warn("domain error escaped a handler", {
				code: error.code,
				message: error.message,
			});
			return c.json(
				{ error: error.code, message: error.userMessage, requestId },
				statusFor(error),
			);
		}

		const internal = new InternalError(error);
		logger.error("unhandled error", {
			message: internal.message,
			cause: error instanceof Error ? error.message : String(error),
		});
		return c.json(
			{ error: "INTERNAL", message: internal.userMessage, requestId },
			500,
		);
	});

	return app;
}

function statusFor(
	error: DomainError,
): 400 | 401 | 403 | 404 | 409 | 429 | 500 {
	switch (error.code) {
		case "BAD_REQUEST":
			return 400;
		case "UNAUTHORIZED":
			return 401;
		case "FORBIDDEN":
			return 403;
		case "NOT_FOUND":
			return 404;
		case "CONFLICT":
			return 409;
		case "TOO_MANY_REQUESTS":
			return 429;
		default:
			return 500;
	}
}
