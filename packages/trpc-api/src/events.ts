/**
 * What an order event *is*, in one place, because three things have to agree about it:
 * the request path that decides an order moved, the row that records the decision, and
 * the consumer that acts on it minutes later in another isolate.
 *
 * The failure this prevents is a specific one. The consumer deduplicates by writing a
 * `dedupeKey` into a column with a unique index, so the key *is* the identity of an
 * event. `ORDER_STATUS_CHANGED:<orderId>` was the first spelling of that key, and it
 * silently collapsed four legitimate events into one: an order that went PENDING →
 * ACCEPTED → PREPARING → READY produced four messages with one key, the index swallowed
 * the last three, `onConflictDoNothing()` reported success, and `message.ack()` ran. The
 * shop heard its order was accepted and then nothing until it was collected.
 *
 * Nothing logged the loss, because from the consumer's seat there was nothing to log.
 * That is what makes this the wrong place to be clever: a key derived from the *shape* of
 * a message is a bet that no two events will ever share that shape, and the bet is placed
 * in the one field whose failure mode is silence.
 *
 * So identity is minted, not derived. `eventId` is created once, travels with the event
 * through the outbox and the queue, and is what the consumer deduplicates on:
 *
 *     retry(E)      → same eventId
 *     E_i ≠ E_j     → eventId_i ≠ eventId_j, even when their types are equal
 *
 * `aggregate*` and `occurredAt` are not identity — they are what makes an event
 * *placeable*: which thing it is about, which version of that thing it describes, and
 * when it happened. A consumer that only had `eventId` could tell a duplicate from a new
 * event and nothing else.
 */

import { newId } from "@pymeshub/shared";

/**
 * The message an order event puts on the queue.
 *
 * A small, closed union rather than a free-form payload: the consumer acts on `type`, and
 * an unknown type that still carries a plausible body is how a consumer ends up notifying
 * somebody about something that did not happen.
 */
export type OrderEventMessage =
	| {
			type: "ORDER_PLACED";
			orderId: string;
			businessId: string;
			actorId: string;
	  }
	| {
			type: "ORDER_STATUS_CHANGED";
			orderId: string;
			businessId: string;
			actorId: string;
			from: string;
			to: string;
	  }
	| {
			type: "ORDER_CANCELLED";
			orderId: string;
			businessId: string;
			actorId: string;
			reason?: string;
	  };

export type OrderEventType = OrderEventMessage["type"];

/**
 * The kind of thing an event is about.
 *
 * One value today, and it is not redundant with the payload's `orderId`: a delivery event
 * will have `aggregateType: "delivery"` and an `aggregateId` that is the delivery, while
 * its payload still names the order it is fulfilling. Two different ids about two
 * different things, which is why the aggregate is named here rather than inferred from the
 * payload.
 */
export const AGGREGATE_TYPES = ["order"] as const;
export type AggregateType = (typeof AGGREGATE_TYPES)[number];

/**
 * An event with everything needed to identify it, place it, and act on it.
 *
 * `eventType` repeats `payload.type`, and this is the one place in the repo where a fact
 * is deliberately stored twice — because the outbox table indexes it, and a `where` clause
 * over a JSON column is a scan. It is safe here and only here: `orderEvent` below is the
 * only constructor, and it derives both from a single argument, so they cannot disagree.
 * Anywhere else, two sources for one fact is a bug waiting for a deploy.
 */
export type OrderEventEnvelope = {
	/** Minted once. The consumer's dedupe key. Never derived from the message's shape. */
	eventId: string;
	aggregateType: AggregateType;
	aggregateId: string;
	aggregateVersion: number;
	eventType: OrderEventType;
	/** ISO 8601, from the server's clock. A client's clock is never consulted. */
	occurredAt: string;
	payload: OrderEventMessage;
};

/**
 * The only way an event is created.
 *
 * `occurredAt` is passed in rather than read from the clock here so that the event's
 * timestamp is the *same* instant the order's own row was stamped with — a move that
 * writes `acceptedAt` and an event claiming a later `occurredAt` are two records of one
 * moment that disagree.
 */
export function orderEvent(input: {
	aggregateId: string;
	aggregateVersion: number;
	occurredAt: Date;
	payload: OrderEventMessage;
}): OrderEventEnvelope {
	return {
		eventId: newId("event"),
		aggregateType: "order",
		aggregateId: input.aggregateId,
		aggregateVersion: input.aggregateVersion,
		eventType: input.payload.type,
		occurredAt: input.occurredAt.toISOString(),
		payload: input.payload,
	};
}

/**
 * The outbox row for an event, ready to be pushed into the same batch that writes the
 * change it describes.
 *
 * `publishedAt` is absent on purpose: a row is published when a send succeeded, and a row
 * that claimed otherwise on the way in would be an event lost with a receipt saying it was
 * sent.
 */
export function outboxRowOf(
	envelope: OrderEventEnvelope,
	now: Date,
): {
	id: string;
	eventId: string;
	aggregateType: string;
	aggregateId: string;
	aggregateVersion: number;
	eventType: string;
	occurredAt: string;
	payload: Record<string, unknown>;
	publishedAt: null;
	attempts: number;
	lastError: null;
	createdAt: Date;
} {
	return {
		id: newId("outboxEvent"),
		eventId: envelope.eventId,
		aggregateType: envelope.aggregateType,
		aggregateId: envelope.aggregateId,
		aggregateVersion: envelope.aggregateVersion,
		eventType: envelope.eventType,
		occurredAt: envelope.occurredAt,
		// The envelope minus its identity, which the columns above already carry. Stored as
		// the message body rather than as the envelope so the row is exactly what goes on the
		// wire — a publisher that had to reassemble the message could reassemble it wrong.
		payload: envelope.payload as unknown as Record<string, unknown>,
		publishedAt: null,
		attempts: 0,
		lastError: null,
		createdAt: now,
	};
}

/** The queue message for a stored row: the identity columns, plus the body. */
export function envelopeFromRow(row: {
	eventId: string;
	aggregateType: string;
	aggregateId: string;
	aggregateVersion: number;
	occurredAt: string;
	payload: unknown;
}): OrderEventEnvelope {
	return {
		eventId: row.eventId,
		aggregateType: row.aggregateType as AggregateType,
		aggregateId: row.aggregateId,
		aggregateVersion: row.aggregateVersion,
		eventType: (row.payload as OrderEventMessage).type,
		occurredAt: row.occurredAt,
		payload: row.payload as OrderEventMessage,
	};
}
