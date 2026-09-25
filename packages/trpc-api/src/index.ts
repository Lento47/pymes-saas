/// <reference types="@cloudflare/workers-types" />

import { createDb } from "@pymeshub/db";
import { createApp } from "./app";
import type { Env } from "./env";
import type { OrderEventEnvelope } from "./events";
import { createLogger } from "./logging";
import { publishPending } from "./outbox";
import { handleQueue } from "./queue";
import { sweepExpiredOffers } from "./services/delivery-dispatch";

/**
 * The Worker.
 *
 * Three entry points, because this deployment is three things: an HTTP API, the
 * consumer for the queue that same API writes to, and the sweeper that republishes what
 * the API failed to hand over. They are one Worker deliberately — a separate deployment
 * would mean two copies of the D1 binding, two `wrangler.toml`s that must agree about
 * the database id, and a deploy that can put them out of step with a schema they share.
 *
 * The Durable Object is exported from here rather than from its own module so that
 * `[[durable_objects.bindings]]` in `wrangler.toml` has one unambiguous place to point
 * — the entry module — which is what the platform requires.
 */

export { OrderRoom } from "./durable/order-room";

const app = createApp();

export default {
	fetch: app.fetch,
	queue: (
		batch: MessageBatch<OrderEventEnvelope>,
		env: Env,
		ctx: ExecutionContext,
	) => handleQueue(batch, env, ctx),

	/**
	 * The outbox sweep.
	 *
	 * Every tick, take whatever is unpublished and send it. Normally nothing, which costs
	 * one indexed read; when the request path's own publish failed — a queue hiccup, an
	 * isolate evicted between the batch and the send — this is the thing that makes the
	 * event late instead of lost.
	 *
	 * It throws only when the *read* fails, which is the platform's problem to retry. A
	 * send that fails is recorded on the row and left for the next tick, because throwing
	 * there would abort the sweep and strand every row behind the one that failed.
	 */
	scheduled: async (
		_controller: ScheduledController,
		env: Env,
	): Promise<void> => {
		const logger = createLogger({
			environment: env.ENVIRONMENT,
			version: env.API_VERSION,
			queue: "outbox",
		});
		await publishPending(env, logger);
		await sweepExpiredOffers(createDb(env.DB));
	},
} satisfies ExportedHandler<Env, OrderEventEnvelope>;
