/// <reference types="@cloudflare/workers-types" />

import type { LogLevel } from "./logging";
import type { OrderEventEnvelope } from "./events";

/**
 * Everything this Worker is handed per request.
 *
 * Bindings and secrets arrive in the same object, and the difference between them
 * is not in the type — it is in `wrangler.toml`, where `[vars]` is committed and
 * a secret is set with `wrangler secret put`. Nothing here is read at module scope:
 * a Worker is given its configuration per request, and a module-level read captures
 * whatever the first request in that isolate saw.
 */
export type Env = {
	/** D1. The only durable store for everything that is ours. */
	DB: D1Database;

	/**
	 * KV. Read-through cache and rate-limit counters — never the source of truth
	 * for anything. A cache that loses a key must cost a query, not a fact, so
	 * nothing here is written that cannot be recomputed from D1.
	 */
	CACHE: KVNamespace;

	/**
	 * Queued order events. The API's own request path does not wait for a
	 * notification to be written or a socket to be told; it enqueues and answers.
	 *
	 * The request path does not send here either — it inserts an `outbox_event` row in
	 * the same batch that writes the order, and the publisher in `outbox.ts` does the
	 * sending. See that file for why.
	 */
	ORDER_EVENTS: Queue<OrderEventEnvelope>;

	/**
	 * R2. The bytes behind a `/files/:id`; the `upload` row is only the index.
	 *
	 * This is the binding whose absence made `upload.data` exist. D1 caps a database at
	 * 10 GB with no way to raise it, so a marketplace that stores product photos as
	 * D1 blobs runs out of platform at roughly 5,000 images — and a storefront read
	 * is a full blob transfer through the Worker rather than an object fetch. R2 has
	 * no row ceiling, costs $0.015/GB-month and charges nothing for egress.
	 */
	MEDIA: R2Bucket;

	/**
	 * One Durable Object per live order, for the order's live socket.
	 *
	 * The socket is served at `/orders/:id/live` and is not open: no client connects to
	 * it, and both clients poll instead (`orders.byId`, plus `orders.track` on web). This
	 * said "the socket the apps hold open", which described a connection the apps never
	 * make - the endpoint is finished and verified, and nothing holds it yet.
	 *
	 * Addressed through `orderRoomFor` so the naming rule lives in one place.
	 */
	ORDER_ROOM: DurableObjectNamespace;
	/**
	 * One request counter per (bucket, identity), for `context.ts`'s `rateLimit`.
	 *
	 * A Durable Object and not the `CACHE` KV namespace this replaced: a DO instance is
	 * single-threaded, so the compare and the increment happen together. KV allows one
	 * write per second per key and **throws** past it, and the limiter's key was fixed
	 * per window — so the counter provoked the limit it existed to enforce, and the
	 * rejection escaped as a 500 on `orders.place`.
	 *
	 * Addressed through `rateLimitRoomFor` so the naming rule lives in one place.
	 */
	RATE_LIMIT_ROOM: DurableObjectNamespace;
	/** `production`, `staging`, `development`. Decides log format and error detail. */
	ENVIRONMENT: string;
	/** Reported by `health.check` and on every log line, so a deploy is identifiable. */
	API_VERSION: string;
	/**
	 * Temporary observability threshold — errors only until an operator sets it
	 * to `"warn"` or `"info"`. See `logging.ts` for the implementation.
	 */
	LOG_LEVEL?: LogLevel;
	/** Comma-separated origins allowed to call this API from a browser. */
	CORS_ORIGINS?: string;
	/** Operator-controlled HTTPS OSRM endpoint; never a public demo server. */
	ROUTING_BASE_URL?: string;
	/** Road-priced CRC deliveries are opt-in; absent or false keeps the legacy fee. */
	ROUTE_FEE_ENABLED?: string;
	/** ETA-first courier ranking; absent keeps the legacy ordering. */
	AFFINITY_V2_ENABLED?: string;
	/** Show a quoted-road arrival estimate only after courier pickup. */
	DELIVERY_ETA_ENABLED?: string;

	AUTH_SECRET?: string;
	AUTH_URL?: string;

	/**
	 * The optional second identity provider.
	 *
	 * These are public coordinates, not Better Auth's `AUTH_SECRET`. The Worker needs the
	 * project URL and publishable key to verify a user JWT and ask Supabase Auth for the
	 * authoritative `email_confirmed_at`; the publishable key is safe to ship to a phone
	 * and is deliberately not a service-role credential. `SUPABASE_SECRET_KEY` is never
	 * read here: user verification and the session bridge do not need it.
	 */
	SUPABASE_URL?: string;
	SUPABASE_PUBLISHABLE_KEY?: string;
	SUPABASE_JWKS_URL?: string;

	/** Optional when Expo push security is disabled; otherwise a Worker secret. */
	EXPO_ACCESS_TOKEN?: string;
	/** Sentry ingestion DSN. Store as a Worker secret; absent disables the SDK. */
	SENTRY_DSN?: string;
};

/** The origins a browser may call this API from. `*` is never returned. */
export function corsOrigins(env: Env): string[] {
	return (env.CORS_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0 && origin !== "*");
}

/** One Durable Object per order, named so two requests for one order meet. */
export function orderRoomFor(env: Env, orderId: string): DurableObjectStub {
	return env.ORDER_ROOM.get(env.ORDER_ROOM.idFromName(`order:${orderId}`));
}

/**
 * One Durable Object per (bucket, identity), named so two attempts on the same counter
 * meet — and no two different counters share one.
 *
 * The `rl:` prefix is kept from the KV key this replaced, so an operator reading a
 * Durable Object id has the same word in front of them that they had in a KV key list.
 * The window is deliberately *not* in the name: the window rolls over inside the object
 * (see `durable/rate-limit-room.ts`), so a per-window name would mint a new object every
 * minute and leave the old ones to expire unvisited.
 */
export function rateLimitRoomFor(
	env: Env,
	bucket: string,
	identity: string,
): DurableObjectStub {
	return env.RATE_LIMIT_ROOM.get(
		env.RATE_LIMIT_ROOM.idFromName(`rl:${bucket}:${identity}`),
	);
}
