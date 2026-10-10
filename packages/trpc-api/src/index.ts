/// <reference types="@cloudflare/workers-types" />

import { createDb } from "@pymeshub/db";
import { scrubTelemetryPayload } from "@pymeshub/shared";
import { withSentry } from "@sentry/cloudflare";
import { createApp } from "./app";
import type { Env } from "./env";
import type { OrderEventEnvelope } from "./events";
import { createLogger } from "./logging";
import { publishPending } from "./outbox";
import { deliverPendingPushes, processPushReceipts } from "./push";
import { handleQueue } from "./queue";
import { sweepAccountDeletions } from "./services/account-deletion";
import {
	sweepExpiredOffers,
	sweepWaitingDeliveries,
} from "./services/delivery-dispatch";
import { sweepExpiredRoadQuotes } from "./services/delivery-quote";
import { sweepLapsed } from "./services/subscription";

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
export { RateLimitRoom } from "./durable/rate-limit-room";

const app = createApp();

const handler = {
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
			await deliverPendingPushes(env, logger);
			await processPushReceipts(env, logger);
		} catch (error) {
			logger.error("push sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			const deletion = await sweepAccountDeletions(
				createDb(env.DB),
				new Date(),
			);
			if (deletion.completed || deletion.blocked || deletion.failed) {
				logger.warn("account deletion sweep completed", deletion);
			}
		} catch (error) {
			logger.error("account deletion sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			await sweepExpiredOffers(createDb(env.DB), 50, undefined, env);
		} catch (error) {
			logger.error("delivery offer sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}

		// The READY push fires dispatch the moment an order is prepared; this is the
		// backstop for the runs that push could not fill — no courier in the pool at
		// that instant, a courier whose offer expired without an answer. It runs after
		// the expiry sweep so a run just returned to `SEARCHING` by that sweep is
		// offered again within the same tick rather than the next one, and it is
		// bounded (`limit = 10`) so it cannot spend the whole tick on a busy day.
		try {
			await sweepWaitingDeliveries(createDb(env.DB), 10, env);
		} catch (error) {
			logger.error("waiting delivery sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			await sweepExpiredRoadQuotes(createDb(env.DB));
		} catch (error) {
			logger.error("delivery quote sweep failed", {
				cause: error instanceof Error ? error.message : String(error),
			});
		}
	},
} satisfies ExportedHandler<Env, OrderEventEnvelope>;

const monitoredHandler: ExportedHandler<Env, OrderEventEnvelope> = withSentry<
	Env,
	OrderEventEnvelope,
	unknown,
	typeof handler
>(
	(env) =>
		env.SENTRY_DSN
			? {
					dsn: env.SENTRY_DSN,
					environment: env.ENVIRONMENT,
					release: `pymeshub-worker@${env.API_VERSION}`,
					tracesSampleRate: env.ENVIRONMENT === "production" ? 0.05 : 0,
					beforeSend: (event) => scrubTelemetryPayload(event),
					beforeBreadcrumb: (breadcrumb) => scrubTelemetryPayload(breadcrumb),
				}
			: undefined,
	handler,
);

export default monitoredHandler;
