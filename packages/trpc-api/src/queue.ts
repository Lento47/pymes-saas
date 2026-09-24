/// <reference types="@cloudflare/workers-types" />

import {
	createDb,
	type Db,
	membership as membershipTable,
	notification as notificationTable,
	order as orderTable,
	user as userTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";

import type { Env } from "./env";
import type { OrderEventEnvelope, OrderEventMessage } from "./events";
import { createLogger } from "./logging";

/**
 * What happens after an order moves, off the request path.
 *
 * The API enqueues and answers. A customer tapping "confirmar pedido" waits for the
 * order to be written, not for a notification row and a receipt — and a queue is what
 * makes that split honest, because the work still happens even if the isolate that
 * took the request is gone a millisecond later.
 *
 * Two rules the consumer lives by:
 *
 * - **Idempotent, because a queue is at-least-once.** The same message can arrive
 *   twice — a retry after a slow batch, a redelivery after an eviction, or the outbox
 *   publisher sending a row the request path had already sent. Every write here carries
 *   a `dedupeKey` and relies on the unique index on it, so a duplicate delivery is a
 *   no-op rather than a second bell in the shop's list.
 * - **A failure is retried, a bad message is not.** The write is inside the try; a
 *   message whose *shape* is wrong is acked with a log, because retrying it three
 *   times only delays the rest of the batch and it will never parse.
 */

/**
 * The dedupe key: the event's own identity, plus whose copy of it this is.
 *
 * `type:orderId` was the first spelling of this and it failed silently — see `events.ts`
 * for the full account of the four events it collapsed into one. The lesson is short
 * enough to repeat here, because this is the line that would regress: a key derived from
 * the *shape* of a message bets that no two events will ever share that shape, and the
 * bet is placed in the one field whose failure mode is silence.
 *
 * So the key is the `eventId` the producer minted, which is unique per event by
 * construction and stable across redeliveries — exactly the pair of properties the index
 * needs, and the pair a derived key can only approximate.
 *
 * The recipient is appended because one event now has several effects, one per member of
 * the business. The identity is still the event's; the suffix says which copy of the
 * consequence this row is. Without it the fan-out would deduplicate itself: the first
 * member's notification would collide with the second's and the index would swallow it.
 */
function dedupeKeyFor(eventId: string, userId: string): string {
	return `event:${eventId}:${userId}`;
}

/** What the row says. Who reads it is `recipientsFor`'s business, not this function's. */
function notificationFor(
	event: OrderEventMessage,
): { kind: string; title: string; body: string } | null {
	switch (event.type) {
		case "ORDER_PLACED":
			// The business is told; the actor is not. A customer does not need a
			// notification saying they ordered.
			return {
				kind: "ORDER",
				title: "Nuevo pedido",
				body: `Tienes un pedido nuevo (${event.orderId})`,
			};
		case "ORDER_STATUS_CHANGED":
			return {
				kind: "ORDER",
				title: "Pedido actualizado",
				body: `El pedido pasó de ${event.from} a ${event.to}`,
			};
		case "ORDER_CANCELLED":
			return {
				kind: "ORDER",
				title: "Pedido cancelado",
				body: event.reason ?? `El pedido ${event.orderId} se canceló`,
			};
		default:
			return null;
	}
}

/**
 * Who gets told: the people in the business, because a business has no inbox.
 *
 * This used to write `event.businessId` into `notification.user_id`, and that column is a
 * foreign key to `user`. Under D1's foreign keys the insert threw, the message retried
 * five times and went to the dead-letter queue, and the shop was told about none of its
 * orders — the entire point of the queue, failing quietly behind a retry log. With the
 * constraint off it would have been worse in one way and no better in another: the row
 * would exist, addressed to an id no person has, and nothing reads it.
 *
 * So the recipients are the business's members, all of them. A shop with two owners has
 * two phones, and telling one of them is not the same product as telling the shop.
 */
async function recipientsFor(db: Db, businessId: string): Promise<string[]> {
	const rows = await db
		.select({ userId: membershipTable.userId })
		.from(membershipTable)
		.where(eq(membershipTable.businessId, businessId));

	return rows.map((row) => row.userId);
}

/**
 * One row for the customer whose order moved — or none, for three reasons that
 * are checked in this order:
 *
 * 1. The move was theirs (their own cancel): the actor is never told.
 * 2. They turned order updates off: the switch is read here, at the write,
 *    because a row written despite it would sit in the next inbox read.
 * 3. The order row is gone: nothing to deep-link to, and retrying will not
 *    bring it back — same ack-and-name treatment as the no-recipients case.
 *
 * The dedupe key carries the customer id for the same reason the business
 * fan-out does: one event, several copies, and the index must tell them apart.
 */
async function notifyCustomer(
	db: Db,
	eventId: string,
	event: Extract<
		OrderEventMessage,
		{ type: "ORDER_STATUS_CHANGED" | "ORDER_CANCELLED" }
	>,
	content: { kind: string; title: string; body: string },
): Promise<void> {
	const orderRows = await db
		.select({ customerId: orderTable.customerId })
		.from(orderTable)
		.where(eq(orderTable.id, event.orderId))
		.limit(1);
	const customerId = orderRows[0]?.customerId;
	if (!customerId || customerId === event.actorId) return;

	const prefs = (
		await db
			.select({ notifyOrderUpdates: userTable.notifyOrderUpdates })
			.from(userTable)
			.where(eq(userTable.id, customerId))
			.limit(1)
	)[0];
	if (prefs?.notifyOrderUpdates === false) return;

	await db
		.insert(notificationTable)
		.values({
			id: crypto.randomUUID(),
			userId: customerId,
			kind: content.kind,
			title: content.title,
			body: content.body,
			data: { orderId: event.orderId, type: event.type },
			readAt: null,
			createdAt: new Date(),
			dedupeKey: dedupeKeyFor(eventId, customerId),
		})
		.onConflictDoNothing();
}

export async function handleQueue(
	batch: MessageBatch<OrderEventEnvelope>,
	env: Env,
	_executionCtx: ExecutionContext,
): Promise<void> {
	const logger = createLogger({
		environment: env.ENVIRONMENT,
		version: env.API_VERSION,
		queue: batch.queue,
	});
	const db = createDb(env.DB);

	for (const message of batch.messages) {
		const envelope = message.body;
		const event = envelope?.payload;

		// `eventId` is checked with the rest because it is no longer decoration: it *is*
		// the dedupe key. An envelope without one has nothing to be deduplicated by, so
		// processing it would mean a redelivery writes a second notification — the exact
		// failure this file's other half exists to prevent.
		if (
			!envelope ||
			typeof envelope.eventId !== "string" ||
			envelope.eventId.length === 0 ||
			!event ||
			typeof event.type !== "string" ||
			typeof event.orderId !== "string"
		) {
			logger.warn("dropping malformed order event");
			message.ack();
			continue;
		}

		const notification = notificationFor(event);
		if (!notification) {
			// A message type this consumer does not know is a deploy that is older than
			// the producer. Acked rather than retried: the next deploy will handle it,
			// and a retry storm in the meantime delays everything else in the batch.
			logger.warn("ignoring unknown order event", { type: event.type });
			message.ack();
			continue;
		}

		try {
			const recipients = await recipientsFor(db, event.businessId);
			if (recipients.length === 0) {
				// Nobody to tell, and retrying will not produce anybody: a business with no
				// members is a data problem, not a delivery problem. Acked and named, so it
				// shows up in the log rather than as five attempts and a dead letter.
				logger.warn("order event has no recipients", {
					eventId: envelope.eventId,
					type: event.type,
					businessId: event.businessId,
				});
				message.ack();
				continue;
			}

			const now = new Date();
			await db
				.insert(notificationTable)
				.values(
					recipients.map((userId) => ({
						id: crypto.randomUUID(),
						userId,
						kind: notification.kind,
						title: notification.title,
						body: notification.body,
						// What a client needs to deep-link back to the thing being announced.
						data: { orderId: event.orderId, type: event.type },
						readAt: null,
						createdAt: now,
						// Deterministic, so a redelivery collides with the first write instead of
						// adding a row. Built from what identifies the *event* and whose copy of
						// it this is — not from a timestamp, which would make every delivery
						// unique and defeat the index.
						dedupeKey: dedupeKeyFor(envelope.eventId, userId),
					})),
				)
				.onConflictDoNothing();

			// The customer, when the news is theirs and they still want it. Until
			// this block the inbox's promise ("novedades de tus pedidos") was one
			// no writer kept: the rows above go to the business's members, and the
			// customer learned of a move by polling. ORDER_PLACED stays
			// business-only — the actor needs no notification saying they ordered —
			// and a move the customer made themselves (their own cancel) tells them
			// nothing either, which is what the `actorId` check is for.
			if (
				event.type === "ORDER_STATUS_CHANGED" ||
				event.type === "ORDER_CANCELLED"
			) {
				await notifyCustomer(db, envelope.eventId, event, notification);
			}

			message.ack();
		} catch (error) {
			// `retry()`, not `ack()`: a silent ack would drop a customer's notification
			// because D1 was briefly unavailable. Backoff capped at a minute, because a
			// queue message that is still failing after a minute is failing for a reason
			// the next attempt will not fix either.
			logger.error("order event failed, will retry", {
				eventId: envelope.eventId,
				type: event.type,
				orderId: event.orderId,
				attempt: message.attempts,
				error: error instanceof Error ? error.message : String(error),
			});
			message.retry({ delaySeconds: Math.min(60, 2 ** message.attempts) });
		}
	}
}
