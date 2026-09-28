/// <reference types="@cloudflare/workers-types" />

import { createDb } from "@pymeshub/db";
import { createApp } from "./app";
import type { Env } from "./env";
import type { OrderEventEnvelope } from "./events";
import { createLogger } from "./logging";
import { publishPending } from "./outbox";
import { handleQueue } from "./queue";
import { sweepLapsed } from "./services/subscription";
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
	 * The scheduled sweep: the outbox, then billing.
	 *
	 * **Order matters, and the reason is blast radius.** `publishPending` walks the
	 * outbox one row at a time and a send that fails is recorded and left behind, so it
	 * is the half that can be slow and that touches every pending row. `sweepLapsed`
	 * touches at most the handful of subscriptions that changed state this minute.
	 * Running billing first would put a five-row write in front of an unbounded walk,
	 * and a cron that is `1 * * * *` has a per-invocation budget to spend.
	 *
	 * The two are separate awaits rather than one `Promise.all` on purpose: a failure in
	 * the outbox must not skip the billing sweep, and `publishPending` throws on a read
	 * error, which would abort the tick before billing ran.
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
		try {
			await publishPending(env, logger);
		} catch (error) {
			// Logged, not rethrown. The billing sweep below must run even when the outbox
			// cannot be read, because a merchant falling off the feed is a customer-
			// facing failure and a delayed notification is not.
			logger.error("outbox sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			const drifted = await sweepLapsed(createDb(env.DB), new Date());
			// Only logged when something moved. A sweep that found nothing is the expected
			// case every minute of every day, and an `info` line per minute is a log bill
			// for a message nobody reads.
			if (drifted > 0) {
				logger.warn("suspended subscriptions caught up", { drifted });
			}
		} catch (error) {
			logger.error("billing sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			await sweepExpiredOffers(createDb(env.DB));
		} catch (error) {
			logger.error("delivery offer sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}
	},
} satisfies ExportedHandler<Env, OrderEventEnvelope>;
