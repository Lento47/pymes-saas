/// <reference types="@cloudflare/workers-types" />

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
	 * One Durable Object per live order, for the order's live socket.
	 *
	 * The socket is served at `/orders/:id/live` and is not open: no client connects to
	 * it, and both clients poll instead (`orders.byId`, plus `orders.track` on web). This
	 * said "the socket the apps hold open", which described a connection the apps never
	 * make — the endpoint is finished and verified, and nothing holds it yet.
	 *
	 * Addressed through `orderRoomFor` so the naming rule lives in one place.
	 */
	ORDER_ROOM: DurableObjectNamespace;

	/**
	 * R2. Image bytes - a courier's vehicle photo today, avatars and product
	 * images when they arrive. Served back through `GET /uploads/*`, so nothing
	 * stores a presigned URL and every stored path stays valid.
	 */
	MEDIA: R2Bucket;

	/** `production`, `staging`, `development`. Decides log format and error detail. */
	ENVIRONMENT: string;
	/** Reported by `health.check` and on every log line, so a deploy is identifiable. */
	API_VERSION: string;
	/** Comma-separated origins allowed to call this API from a browser. */
	CORS_ORIGINS?: string;

	AUTH_SECRET?: string;
	AUTH_URL?: string;
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
