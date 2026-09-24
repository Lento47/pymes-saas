/// <reference types="@cloudflare/workers-types" />

import { createDb, type Db, outboxEvent as outboxTable } from "@pymeshub/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { Env } from "./env";
import { envelopeFromRow, type OrderEventEnvelope } from "./events";
import type { Logger } from "./logging";

/**
 * Getting a decided event onto the queue, without ever losing one.
 *
 * The request path used to `await env.ORDER_EVENTS.send(message)` immediately after the
 * batch that wrote the order. That has a window no amount of care closes: the batch
 * commits, the isolate is evicted before the send, and a confirmed order exists with
 * nobody told about it. Nothing recovers from that, because nothing knows it was supposed
 * to happen — the queue never saw the message and the database has no record of an
 * intention.
 *
 * So the intention is written down. `outbox_event` gets a row *inside* the same D1 batch
 * as the change it describes, which makes "the order moved" and "there is an event about
 * it" one atomic fact. Delivery is a separate, retryable step:
 *
 *     request path   →  batch { order + event row }  →  best-effort publish
 *     cron           →  publishPending()             →  catches whatever the first missed
 *
 * **At-least-once, and that is the design rather than a shortfall.** A crash between the
 * send and the mark re-sends, and a queue redelivery re-delivers, so the consumer must
 * deduplicate — which it does, on `eventId`. Exactly-once delivery is not available from
 * a queue and chasing it is how a system ends up with an event that is dropped *and*
 * believed delivered.
 *
 * `publishedAt` is set only after a send returned. A row that marked itself published on
 * the way in would be an event lost with a receipt saying otherwise, which is the one
 * failure this file exists to make impossible.
 */

/** How many rows one sweep takes. Bounded so a backlog cannot become one huge batch. */
const SWEEP_LIMIT = 100;

/**
 * The outbox row for an event, ready to push into the caller's batch.
 *
 * Exported from `events.ts` as `outboxRowOf` — re-exported here because this is the file
 * a reader looking for "how does an event get out" arrives at, and the row's shape is
 * half of that answer.
 */
export { outboxRowOf } from "./events";

/**
 * Send these events and mark them sent. The caller has already committed their rows.
 *
 * Failures are collected rather than thrown: the row is already durable, the caller is a
 * request that has nothing left to do about it, and the sweeper will try again. Throwing
 * would turn a queue hiccup into a failed checkout for an order that exists.
 */
export async function publishEvents(
	env: Env,
	db: Db,
	logger: Logger,
	envelopes: readonly OrderEventEnvelope[],
): Promise<{ sent: number; failed: number }> {
	let sent = 0;
	let failed = 0;

	for (const envelope of envelopes) {
		try {
			await env.ORDER_EVENTS.send(envelope);
			const now = new Date();
			// Conditional on `publishedAt IS NULL`, so two publishers racing the same row
			// cannot have the later one rewrite the earlier one's timestamp — the second
			// statement matches nothing instead. The send already happened twice in that
			// race, which is safe: the consumer deduplicates on `eventId`.
			await db
				.update(outboxTable)
				.set({ publishedAt: now, attempts: sql`${outboxTable.attempts} + 1` })
				.where(
					and(
						eq(outboxTable.eventId, envelope.eventId),
						isNull(outboxTable.publishedAt),
					),
				);
			sent += 1;
		} catch (error) {
			failed += 1;
			const message = error instanceof Error ? error.message : String(error);
			// Named fields only. A queue error can quote the message body, and the body
			// carries a customer's order id — which is why the reason is truncated to its
			// own sentence and the payload is never logged.
			logger.warn("no se pudo publicar el evento", {
				eventId: envelope.eventId,
				eventType: envelope.eventType,
				reason: message.slice(0, 200),
			});
			// Recorded on the row so a stuck event is *visible* — an attempts count that
			// only grows is how a human finds out before a customer does. Best-effort: a
			// failure to record a failure must not mask the original one.
			try {
				await db
					.update(outboxTable)
					.set({
						attempts: sql`${outboxTable.attempts} + 1`,
						lastError: message.slice(0, 500),
					})
					.where(
						and(
							eq(outboxTable.eventId, envelope.eventId),
							isNull(outboxTable.publishedAt),
						),
					);
			} catch {
				// Nothing left to do about it: the row is unpublished, so the next sweep
				// picks it up regardless of whether this counter moved.
			}
		}
	}

	return { sent, failed };
}

/**
 * Sweep unpublished rows, oldest first. The cron's whole job, and the reason a lost send
 * is a delay rather than a loss.
 *
 * Deliberately not conditional on anything having gone wrong: an outbox that only runs
 * when someone suspects a problem is an outbox whose failure is discovered by a customer.
 * Every tick takes whatever is pending, which is normally nothing and costs one indexed
 * read.
 */
export async function publishPending(
	env: Env,
	logger: Logger,
	limit = SWEEP_LIMIT,
): Promise<{ sent: number; failed: number }> {
	const db = createDb(env.DB);

	const rows = await db
		.select({
			eventId: outboxTable.eventId,
			aggregateType: outboxTable.aggregateType,
			aggregateId: outboxTable.aggregateId,
			aggregateVersion: outboxTable.aggregateVersion,
			occurredAt: outboxTable.occurredAt,
			payload: outboxTable.payload,
			attempts: outboxTable.attempts,
		})
		.from(outboxTable)
		.where(isNull(outboxTable.publishedAt))
		.orderBy(asc(outboxTable.createdAt))
		.limit(limit);

	if (rows.length === 0) return { sent: 0, failed: 0 };

	const result = await publishEvents(
		env,
		db,
		logger,
		rows.map((row) => envelopeFromRow(row)),
	);

	if (result.failed > 0) {
		logger.error("la bandeja de salida dejó eventos sin publicar", {
			pending: rows.length,
			sent: result.sent,
			failed: result.failed,
			// The oldest row's attempt count is the alarm signal: a number that keeps
			// climbing while `pending` stays put is a poison message, not a blip.
			oldestAttempts: rows[0]?.attempts ?? 0,
		});
	}

	return result;
}
