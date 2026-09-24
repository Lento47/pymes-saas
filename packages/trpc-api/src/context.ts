import type { AuthenticatedUser } from "@pymeshub/auth";
import {
	createDb,
	type Db,
	membership as membershipTable,
	user as userTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";
import { createAuth } from "./auth";

import { type Env } from "./env";
import { ForbiddenError, RateLimitError, UnauthorizedError } from "./errors";
import { createLogger, type Logger } from "./logging";

/**
 * Who is calling, and what they are allowed to touch.
 *
 * Built once per request, before any procedure runs. Two reads happen here and
 * nowhere else, and the reason is the same for both: **permission is never in the
 * token.** The token says who; this object says what, and it says it because we
 * looked it up.
 *
 * - `user` — our own row for the identity the session names, read by its id.
 * - `memberships` — every business the caller belongs to, with their role.
 *
 * A request for a business the caller is not a member of never reaches a service:
 * `requireMembership` in `trpc.ts` refuses it against this list. That list is read
 * from D1 on every request rather than carried in a claim, so revoking a membership
 * takes effect on the caller's *next* call rather than whenever their session row
 * happens to expire.
 */

export type Membership = {
	businessId: string;
	role: "OWNER" | "MANAGER" | "STAFF" | "COURIER";
};

export type ClientKind = "web" | "ios" | "android" | "unknown";

/**
 * The caller's row in `user`, in the shape an authorisation decision needs.
 *
 * The `Mirror` in the name is a leftover from when Supabase held the identity and these
 * fields were a copy of it. There is no second copy any more — Better Auth writes the
 * same D1 tables this reads, and this row *is* the record.
 */
export type MirrorUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	phone: string | null;
	isAdmin: boolean;
	suspendedAt: Date | null;
};

export type Context = {
	env: Env;
	db: Db;
	logger: Logger;
	requestId: string;
	/** Null when nobody is signed in. A procedure that needs one is `protected`. */
	auth: AuthenticatedUser | null;
	/** Our row, present exactly when `auth` is. */
	user: MirrorUser | null;
	memberships: Membership[];
	/** Which client is calling, from `x-client`. Used for logging, never for access. */
	client: ClientKind;
};

/**
 * Which app is calling.
 *
 * Read from a header rather than sniffed from a user agent: a user agent is a string
 * the caller controls and a browser rewrites. The only thing this value decides is a
 * log field — **never** an access decision, because a header is data the caller is
 * holding and an `ios` header from a browser must not unlock anything.
 */
export function clientFrom(header: string | null | undefined): ClientKind {
	const value = header?.trim().toLowerCase();
	return value === "web" || value === "ios" || value === "android"
		? value
		: "unknown";
}

async function loadMemberships(db: Db, userId: string): Promise<Membership[]> {
	const rows = await db
		.select({
			businessId: membershipTable.businessId,
			role: membershipTable.role,
		})
		.from(membershipTable)
		.where(eq(membershipTable.userId, userId));
	return rows.map((row) => ({ businessId: row.businessId, role: row.role }));
}

/**
 * Resolve the caller's identity from their session, then read our own row for it.
 *
 * Two reads, in this order, and neither is optional. `createAuth(env).api.getSession`
 * checks the session against `auth_session` in D1 — the web client's HttpOnly cookie or
 * the bearer token the native clients send — and returns null for an anonymous caller
 * rather than throwing. Identity therefore comes from a row Better Auth owns, not from a
 * claim we decode and trust: signing out deletes that row, and the very next request is
 * anonymous.
 *
 * The `user` row is then read by the id the session carries, because a session knows an
 * id and an email and nothing else. The name, the phone and `isAdmin` are ours, and a
 * screen that showed a name out of the session would be showing a copy of a fact instead
 * of the fact.
 *
 * `suspendedAt` is a **real authorisation gate, evaluated per request** — not a display
 * flag and not something cached. It is read from the row fetched here, on the way into
 * every procedure, and a suspended account gets `ForbiddenError("Esta cuenta está
 * suspendida")` before any handler runs. Suspending somebody therefore takes effect on
 * their next call with the session they already hold, which is the whole reason the
 * check sits on this path: everything authenticated — tRPC and the live-order socket
 * alike — reaches its handler through `createContext`.
 *
 * A session with no `user` row resolves to nobody rather than to a half-built identity.
 * An identity we cannot name is not one we can authorise.
 */
async function resolveUser(
	env: Env,
	db: Db,
	request: Request,
): Promise<{ auth: AuthenticatedUser; user: MirrorUser } | null> {
	const provider = createAuth(env);
	if (!provider) return null;
	const session = await provider.api.getSession({ headers: request.headers });
	if (!session) return null;
	const [row] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.id, session.user.id))
		.limit(1);
	if (!row) return null;
	if (row.suspendedAt) throw new ForbiddenError("Esta cuenta está suspendida");
	return {
		user: row,
		auth: {
			id: row.id,
			email: row.email,
			name: row.name,
			image: row.image,
			phone: row.phone,
			sessionId: session.session.id,
		},
	};
}

export type CreateContextOptions = {
	env: Env;
	request: Request;
	/** Extracted by the Hono middleware, so the response header carries the same value. */
	requestId: string;
};

export async function createContext({
	env,
	request,
	requestId,
}: CreateContextOptions): Promise<Context> {
	const client = clientFrom(request.headers.get("x-client"));
	const logger = createLogger({
		requestId,
		client,
		environment: env.ENVIRONMENT,
		version: env.API_VERSION,
	});
	const db = createDb(env.DB);

	const resolved = await resolveUser(env, db, request);

	return {
		env,
		db,
		logger,
		requestId,
		auth: resolved?.auth ?? null,
		user: resolved?.user ?? null,
		memberships: resolved ? await loadMemberships(db, resolved.auth.id) : [],
		client,
	};
}

/**
 * The context a `protectedProcedure` is guaranteed to have.
 *
 * Narrowing the type is the point: a body that reads `ctx.user.name` cannot be
 * written without the middleware that refuses an anonymous caller, so forgetting the
 * guard is a compile error rather than a null dereference in production.
 */
export type AuthedContext = Context & {
	auth: AuthenticatedUser;
	user: MirrorUser;
};

export function isAuthed(ctx: Context): ctx is AuthedContext {
	return ctx.auth !== null && ctx.user !== null;
}

/** The narrowing a middleware performs, with the error the customer sees. */
export function requireAuthed(ctx: Context): AuthedContext {
	if (!isAuthed(ctx)) throw new UnauthorizedError();
	return ctx;
}

/**
 * A read-through KV cache, for the values that are expensive and identical for
 * everybody: the category list, a storefront, the home feed.
 *
 * Deliberately not a global interceptor. A cache that applies to everything caches
 * the things that must never be cached — a customer's cart, an admin's table — and
 * the failure mode is not a slow page, it is one customer reading another's data.
 */
export async function cached<T>(
	env: Env,
	key: string,
	ttlSeconds: number,
	load: () => Promise<T>,
): Promise<T> {
	const hit = await env.CACHE.get(key, "json");
	if (hit !== null) return hit as T;
	const value = await load();
	await env.CACHE.put(key, JSON.stringify(value), {
		expirationTtl: ttlSeconds,
	});
	return value;
}

/** Drops cache keys, for the mutations that invalidate one. */
export async function invalidate(env: Env, ...keys: string[]): Promise<void> {
	await Promise.all(keys.map((key) => env.CACHE.delete(key)));
}

/**
 * A KV-backed counter, for the endpoints where a retry loop is the threat —
 * placing an order, sending an invitation, signing in.
 *
 * Counted per window *bucket* rather than with a sliding window, so the worst case
 * is two windows' worth of requests at a boundary. That is a real looseness and it is
 * the right trade: a sliding window needs a sorted set, and the alternative on
 * Workers is a Durable Object per key, which is more machinery than "stop the
 * hundredth retry" deserves.
 */
export async function rateLimit(
	env: Env,
	bucket: string,
	identity: string,
	limit: number,
	windowSeconds: number,
): Promise<void> {
	const window = Math.floor(Date.now() / 1000 / windowSeconds);
	const key = `rl:${bucket}:${identity}:${window}`;
	const used = Number.parseInt((await env.CACHE.get(key)) ?? "0", 10);
	if (used >= limit) throw new RateLimitError();
	await env.CACHE.put(key, String(used + 1), {
		expirationTtl: windowSeconds * 2,
	});
}
