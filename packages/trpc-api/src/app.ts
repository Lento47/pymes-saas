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
import {
	createAuth,
	parseSignUpConsent,
	withoutConsentFlags,
} from "./auth";
import { createContext } from "./context";
import { corsOrigins, type Env, orderRoomFor } from "./env";
import { DomainError, InternalError } from "./errors";
import { createLogger, requestIdFrom } from "./logging";
import { appRouter } from "./routers";
import * as uploads from "./services/uploads";
import { exchangeSupabaseSession } from "./supabase-exchange";

/**
 * The Worker's HTTP surface.
 *
 * Three things live here and nothing else: the request id and its log line, CORS, and
 * the mounts — `/trpc` for everything the clients read and write, `/auth` for Better
 * Auth's own handlers, `/orders/:id/live` for the socket, and `/files/:id` for a
 * stored picture. REST is deliberately not a second data surface. The two exceptions
 * are `/health`, which a deploy smoke test hits before it trusts a release and which
 * therefore must not need a session, and `/files/:id`, which is not a data surface at
 * all: it is the same object `uploads.create` returned, served as bytes — the
 * distinction `apps/api`'s `StorageController` already draws between a document API
 * and the thing an `<img>` tags at.
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
const SUPABASE_AUTH_PREFIX = "/auth-supabase";

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
		// cross-origin or the token never reaches SecureStore. `cf-ray` is
		// Cloudflare's own edge id: a failure the client logs with both that and our
		// `x-request-id` can be split into "the edge saw it" and "the Worker saw it"
		// without asking anyone to reproduce the request first.
		exposeHeaders: ["x-request-id", "set-auth-token", "cf-ray"],
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
	 *
	 * The three response headers beside it are here for the same reason they are not
	 * per-route: they are properties of *this origin*, not of one endpoint, and a route
	 * that forgets them is the one that ships without them.
	 *
	 * - `X-Content-Type-Options: nosniff` is the one with a concrete bug behind it.
	 *   `/files/:id` answers with a `Content-Type` read from the `upload` row and a
	 *   year of `immutable` caching — content-type is the *only* thing standing between
	 *   a stored file and a browser deciding it is a document, and this header removes
	 *   the deciding.
	 * - `X-Frame-Options: DENY`: nothing on this origin is an HTML document, so there
	 *   is no legitimate frame and refusing one can only be a win.
	 * - `Referrer-Policy: no-referrer`: a JSON body should never be the reason a URL
	 *   leaves the machine on a subsequent navigation.
	 *
	 * `Cache-Control` is deliberately untouched — `/files/:id` owns its own immutable
	 * directive and auth already answers `no-store` — and these are set before `next()`
	 * so preflights and the `/orders/:id/live` upgrade response carry them too.
	 */
	app.use("*", async (c, next) => {
		const requestId = requestIdFrom(c.req.header("x-request-id"));
		c.set("requestId", requestId);
		c.header("x-request-id", requestId);
		c.header("x-content-type-options", "nosniff");
		c.header("x-frame-options", "DENY");
		c.header("referrer-policy", "no-referrer");
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

	/**
	 * The second provider's one bridge, mounted outside Better Auth's catch-all.
	 *
	 * The client signs in with Supabase first and sends that short-lived access token
	 * here. The Worker verifies it, links the verified email to the D1 user, and mints a
	 * normal Better Auth session. After this response the two providers are the same
	 * session to every existing route; the Supabase token itself never reaches D1, a
	 * membership query or a role decision.
	 */
	app.use(`${SUPABASE_AUTH_PREFIX}/*`, async (c, next) => {
		const allowed = corsOrigins(c.env);
		const origin = c.req.header("origin");
		if (origin && !allowed.includes(origin))
			return c.json({ error: "forbidden" }, 403);
		return cors(browserCors(allowed))(c, next);
	});

	app.post(`${SUPABASE_AUTH_PREFIX}/exchange`, async (c) => {
		c.header("Cache-Control", "no-store");
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "invalid_request" }, 400);
		}
		const accessToken =
			typeof body === "object" && body !== null
				? (body as { accessToken?: unknown }).accessToken
				: undefined;
		const result = await exchangeSupabaseSession(
			accessToken,
			c.env,
			createDb(c.env.DB),
		);
		if (!result.ok) return c.json({ error: result.code }, result.status);
		c.header("set-auth-token", result.token);
		return c.json({ user: result.user });
	});

	/**
	 * The consent gate for a sign-up, before Better Auth parses anything.
	 *
	 * The mobile app posts here and this is the only point in the request where the
	 * body still has the shape the client sent. `app.ts` used to forward
	 * `c.req.raw` untouched, which meant a sign-up carrying no terms acceptance and no
	 * age assertion created an account — on the surface that then asks the device for
	 * location and a push token. The web sign-up has been gated at the NestJS app for
	 * a while; this is the other door to the same product.
	 *
	 * It has to be here and not in a Better Auth hook. The body is parsed into
	 * Better Auth's own shape before any hook runs, so fields it does not model are
	 * already gone by then — see `parseSignUpConsent` in `./auth`, which records the
	 * correction rather than leaving the reason implicit.
	 *
	 * The body is read once and re-sent rather than consumed: `c.req.raw` is a stream,
	 * and a forwarded request whose body has been drained reaches Better Auth with no
	 * credentials at all. The clone is what gets drained; the original is rebuilt from
	 * the flags-stripped body.
	 */
	app.on(["POST"], `${AUTH_PREFIX}/sign-up/email`, async (c) => {
		let body: unknown;
		try {
			body = await c.req.raw.clone().json();
		} catch {
			// A body that is not JSON is Better Auth's problem to word, not this
			// gate's — this gate only answers "were the assertions made".
			body = undefined;
		}

		const parsed = parseSignUpConsent(body);
		if (!parsed.ok) {
			c.header("Cache-Control", "no-store");
			return c.json(
				{ error: parsed.refusal.code, message: parsed.refusal.message },
				400,
			);
		}

		const auth = createAuth(c.env, parsed.consent);
		if (!auth) return c.json({ error: "auth_not_configured" }, 503);
		c.header("Cache-Control", "no-store");
		return auth.handler(
			new Request(c.req.raw.url, {
				method: "POST",
				headers: c.req.raw.headers,
				body: JSON.stringify(withoutConsentFlags(body)),
			}),
		);
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

	/**
	 * A stored picture, as bytes.
	 *
	 * **Public, and that is the product rather than a gap.** A product photo sits on a
	 * storefront a visitor has not signed in to, and React Native's `Image` takes a
	 * `uri` and no `Authorization` header worth building every call site around. The
	 * write is authenticated and allow-listed (`services/uploads.ts`); the read is
	 * id-exact, and `upl_` ids are UUIDs — this is not a directory listing.
	 *
	 * Immutable caching is correct because the id names the bytes: a create mints a new
	 * id, and nothing rewrites the object under an old one. A row whose object is gone
	 * answers 404 like an id that never existed.
	 *
	 * The bytes come out of R2 and the `Content-Type` out of the row, which is why the
	 * two have to be written together — `uploads.create` sets the object's
	 * `httpMetadata` from the same `input.mimeType` it records on the row, so a direct
	 * read of the object and this route cannot disagree about what the picture is.
	 *
	 * The status and the body are the whole answer. No JSON error envelope: the client
	 * on this route is `components/image`, which fails to a muted box on any non-200
	 * and would show a JSON blob as a broken picture if one were returned with a 200.
	 */
	app.get("/files/:id", async (c) => {
		const row = await uploads.read(c.env, c.req.param("id"));
		if (!row) return c.body(null, 404);

		return new Response(row.data as unknown as BodyInit, {
			headers: {
				"Content-Type": row.mimeType,
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
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
