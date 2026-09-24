import { describe, expect, test } from "bun:test";
import { addToCartInput } from "@pymeshub/shared";

import type { OrderEventEnvelope } from "../src/events";
import { createLogger } from "../src/logging";
import { publishPending } from "../src/outbox";
import { handleQueue } from "../src/queue";
import { appRouter } from "../src/routers";
import {
	authed,
	delivery,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * Getting a decided event onto the queue, and being right about which event it is.
 *
 * One question decides whether any of this works: **can a confirmed change in D1 lose its
 * event, or can a legitimately repeated event be dropped silently?** Both halves of this
 * file are answers to it, and both failures are silent — which is why they get tests rather
 * than a comment claiming they cannot happen.
 *
 * The first half is the outbox. The event row is written in the same batch as the change it
 * describes, so there is no instant at which the order moved and no event exists; the send
 * is a separate, retryable step, and a send that fails leaves the row unpublished for the
 * sweeper rather than losing it.
 *
 * The second half is identity. `ORDER_STATUS_CHANGED:<orderId>` used to be the dedupe key,
 * so four legitimate transitions of one order collapsed into one notification and nothing
 * logged the loss. The key is now the minted `eventId`, and the two properties that has to
 * have are exactly the pair the old key could not: a redelivery of one event deduplicates,
 * and two different events never do.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const CASH = "CASH" as const;
const logger = createLogger({ requestId: "test", environment: "test" });

function count(sqlite: Test["sqlite"], table: string, where = ""): number {
	const row = sqlite
		.prepare(`select count(*) as n from "${table}" ${where}`)
		.get() as { n: number };
	return row.n;
}

/** A shop with a product, a customer with a placed order, and the shop's own caller. */
async function placedOrder(test: Test, clientRequestId = "req_events_000001") {
	const shopId = await seedBusiness(test.db);
	await seedProduct(test.db, { businessId: shopId, priceMinor: 1500 });

	const customer = await seedUser(test.db, { id: "usr_events_customer" });
	const caller = appRouter.createCaller(await authed(test, customer)) as Caller;
	await caller.cart.addItem(
		addToCartInput.parse({ productId: "prd_test_item", quantity: 1 }),
	);
	const order = await caller.orders.place({
		fulfilment: "PICKUP",
		paymentMethod: CASH,
		clientRequestId,
	});

	const owner = await seedUser(test.db, { id: "usr_events_owner" });
	await seedMembership(test.db, owner.id, shopId, "OWNER");
	const shop = appRouter.createCaller(await authed(test, owner)) as Caller;

	return { shopId, customer, caller, order, shop };
}

/** Every envelope the API has handed to the queue, in order. */
function envelopes(test: Test): OrderEventEnvelope[] {
	return test.sent.map((event) => event.body as OrderEventEnvelope);
}

/** Drive the consumer the way the platform does, and return what it decided. */
async function consume(test: Test, bodies: unknown[], attempts = 0) {
	const one = delivery(bodies, attempts);
	await handleQueue(one.batch, test.env, {} as ExecutionContext);
	return one.settled;
}

describe("the outbox", () => {
	test("the event is committed with the order, in one batch", async () => {
		const test = world();
		const { order } = await placedOrder(test);

		const row = test.sqlite
			.prepare(
				"select event_id, aggregate_type, aggregate_id, aggregate_version, event_type, published_at, attempts from outbox_event",
			)
			.get() as {
			event_id: string;
			aggregate_type: string;
			aggregate_id: string;
			aggregate_version: number;
			event_type: string;
			published_at: number | null;
			attempts: number;
		};

		expect(row.aggregate_type).toBe("order");
		expect(row.aggregate_id).toBe(order.id);
		expect(row.event_type).toBe("ORDER_PLACED");
		// Placing an order is the first version of it. `aggregateVersion` has to be honest
		// from the start, or stale-event detection downstream compares against a fiction.
		expect(row.aggregate_version).toBe(1);
		// Marked published, and only because the send that followed actually returned.
		expect(row.published_at).not.toBeNull();
		expect(row.attempts).toBe(1);

		// The identity the consumer will deduplicate on travels with the message.
		expect(test.sent).toHaveLength(1);
		expect(test.sent[0]?.eventId).toBe(row.event_id);

		test.close();
	});

	test("a queue that refuses the send does not fail the order, and the sweeper catches it", async () => {
		const test = world();
		const { caller, order } = await placedOrder(test);

		// The case the outbox exists for: the batch committed and the send that follows it
		// did not. Swapped in after the fact so the order already exists when the queue goes
		// down — which is the window being tested, not a different one.
		const queue = test.env.ORDER_EVENTS;
		const sent = test.sent;
		let refuse = true;
		(test.env as { ORDER_EVENTS: unknown }).ORDER_EVENTS = {
			send: async (body: unknown) => {
				if (refuse) throw new Error("queue unavailable");
				sent.push({
					type: (body as { eventType?: string }).eventType ?? "unknown",
					eventId: (body as { eventId?: string }).eventId ?? null,
					body,
				});
			},
		};
		test.sent.length = 0;

		// A second order, placed while the queue is down. The checkout succeeds: an order
		// that exists must not become a failed request because a notification could not be
		// handed over, and before the outbox it would have been lost silently instead.
		//
		// A fresh basket first, because placing the first order closed the cart it used —
		// one open cart per customer, which is its own invariant and not this test's.
		await caller.cart.addItem(
			addToCartInput.parse({ productId: "prd_test_item", quantity: 1 }),
		);
		const second = await caller.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: CASH,
			clientRequestId: "req_events_000002",
		});
		expect(second.status).toBe("PENDING");
		expect(count(test.sqlite, "order")).toBe(2);

		const pending = test.sqlite
			.prepare(
				"select event_id, published_at, attempts, last_error from outbox_event where aggregate_id = ?",
			)
			.get(second.id) as {
			event_id: string;
			published_at: number | null;
			attempts: number;
			last_error: string | null;
		};
		expect(pending.published_at).toBeNull();
		expect(pending.attempts).toBe(1);
		expect(pending.last_error).toContain("queue unavailable");
		expect(test.sent).toHaveLength(0);

		// The queue comes back. The sweep is the only thing that runs, and it is enough.
		refuse = false;
		expect(await publishPending(test.env, logger)).toEqual({
			sent: 1,
			failed: 0,
		});

		// Same event, not a new one: `Retry(E) ⇒ same eventId`. The consumer sees the id it
		// would have seen had the first send worked, so a redelivery is a duplicate.
		expect(test.sent).toHaveLength(1);
		expect(test.sent[0]?.eventId).toBe(pending.event_id);
		expect(test.sent[0]?.type).toBe("ORDER_PLACED");

		const published = test.sqlite
			.prepare(
				"select published_at, attempts from outbox_event where aggregate_id = ?",
			)
			.get(second.id) as { published_at: number | null; attempts: number };
		expect(published.published_at).not.toBeNull();
		expect(published.attempts).toBe(2);

		// Sweeping again finds nothing. A row that is published is not pending, and a
		// sweeper that re-sent it every minute would be a queue that never goes quiet.
		expect(await publishPending(test.env, logger)).toEqual({
			sent: 0,
			failed: 0,
		});
		expect(test.sent).toHaveLength(1);

		// The first order's event is untouched by any of this: the sweep republished what
		// was pending, and what was already sent stays sent.
		const first = test.sqlite
			.prepare("select published_at from outbox_event where aggregate_id = ?")
			.get(order.id) as { published_at: number | null };
		expect(first.published_at).not.toBeNull();

		(test.env as { ORDER_EVENTS: unknown }).ORDER_EVENTS = queue;
		test.close();
	});

	test("the event of a move carries the version the move produced", async () => {
		const test = world();
		const { order, shop } = await placedOrder(test);

		await shop.orders.advance({ orderId: order.id, to: "ACCEPTED" });

		const versions = test.sqlite
			.prepare(
				"select aggregate_version from outbox_event where aggregate_id = ? order by aggregate_version",
			)
			.all(order.id) as { aggregate_version: number }[];
		expect(versions.map((row) => row.aggregate_version)).toEqual([1, 2]);

		const stored = test.sqlite
			.prepare('select version from "order" where id = ?')
			.get(order.id) as { version: number };
		expect(stored.version).toBe(2);
		expect(envelopes(test).at(-1)?.aggregateVersion).toBe(2);

		test.close();
	});

	test("two movers racing never claim the same version", async () => {
		const test = world();
		const { order, shop } = await placedOrder(test);

		// Two staff, two phones, one order, the same tap. Both read the row before either
		// writes it — which is the whole reason `version` is a compare-and-set rather than a
		// read-then-increment in JavaScript. `expectedStatus` is set so the loser is refused
		// whichever guard catches it first: the status check if it read late, the version
		// check if it read early.
		const move = {
			orderId: order.id,
			to: "ACCEPTED",
			expectedStatus: "PENDING",
		} as const;
		const outcomes = await Promise.allSettled([
			shop.orders.advance(move),
			shop.orders.advance(move),
		]);
		const refusedCount = outcomes.filter(
			(outcome) => outcome.status === "rejected",
		).length;

		// The assertions below are deliberately interleaving-independent: which of the two
		// callers wins, and whether one or both get through, depends on where the event loop
		// happens to switch between the read and the write, and a test that pinned that
		// would be a test of the scheduler.
		expect(outcomes.some((outcome) => outcome.status === "fulfilled")).toBe(
			true,
		);
		expect(refusedCount).toBeLessThanOrEqual(1);

		// What the compare-and-set guarantees in *every* interleaving: no two events claim
		// the same version of the order, so `aggregateVersion` is a number a projection can
		// order by and a stale-event check can compare against.
		const versions = test.sqlite
			.prepare(
				"select aggregate_version from outbox_event where aggregate_id = ?",
			)
			.all(order.id) as { aggregate_version: number }[];
		const claimed = versions.map((row) => row.aggregate_version);
		expect(new Set(claimed).size).toBe(claimed.length);

		// And every committed move bumped the counter exactly once, so the version is a count
		// of what happened rather than a number that drifted.
		const after = test.sqlite
			.prepare('select version from "order" where id = ?')
			.get(order.id) as { version: number };
		const committed = count(
			test.sqlite,
			"order_event",
			"where to_status = 'ACCEPTED'",
		);
		expect(committed).toBeGreaterThanOrEqual(1);
		expect(after.version).toBe(1 + committed);

		test.close();
	});
});

describe("event identity", () => {
	test("two legitimate moves of the same type are two events, and both are processed", async () => {
		const test = world();
		const { order, shop } = await placedOrder(test);

		// PENDING → ACCEPTED → PREPARING. Two `ORDER_STATUS_CHANGED` messages about one
		// order, which is exactly the shape the old `type:orderId` key collapsed into one.
		await shop.orders.advance({ orderId: order.id, to: "ACCEPTED" });
		await shop.orders.advance({ orderId: order.id, to: "PREPARING" });

		const changes = test.sent.filter(
			(event) => event.type === "ORDER_STATUS_CHANGED",
		);
		expect(changes).toHaveLength(2);
		// Not just "two messages" — two *identities*. Same aggregate, same type, different
		// event ids, which is the contract the consumer's dedupe rests on.
		expect(changes[0]?.eventId).not.toBe(changes[1]?.eventId);
		expect(envelopes(test)[1]?.aggregateId).toBe(order.id);
		expect(envelopes(test)[2]?.aggregateId).toBe(order.id);

		const settled = await consume(test, [
			envelopes(test)[1],
			envelopes(test)[2],
		]);
		expect(settled.acked).toBe(2);
		expect(settled.retried).toHaveLength(0);

		// Four notifications, two per move: the shop's copy and the customer's.
		// Under the old key the second move was swallowed by the unique index
		// and acked as though it had been written.
		//
		// Counted by `kind`, because placing the order also writes a notification — the
		// idempotency ledger row, which is `ORDER_REQUEST` and is not a bell anybody hears.
		expect(count(test.sqlite, "notification", "where kind = 'ORDER'")).toBe(4);

		const keys = test.sqlite
			.prepare(
				"select dedupe_key, user_id from notification where kind = 'ORDER' order by dedupe_key",
			)
			.all() as { dedupe_key: string; user_id: string }[];
		expect(keys).toHaveLength(4);
		expect(keys[0]?.dedupe_key).not.toBe(keys[1]?.dedupe_key);
		// Named by the event, not by its shape: `event:<eventId>:<recipient>`. Compared as a
		// set because the rows come back sorted by key, and the key sorts by a random uuid —
		// asserting an order here would be asserting `crypto.randomUUID`'s alphabet.
		expect(new Set(keys.map((row) => row.dedupe_key))).toEqual(
			new Set([
				`event:${changes[0]?.eventId}:usr_events_owner`,
				`event:${changes[1]?.eventId}:usr_events_owner`,
				`event:${changes[0]?.eventId}:usr_events_customer`,
				`event:${changes[1]?.eventId}:usr_events_customer`,
			]),
		);

		// Addressed to people, not to the business. `notification.user_id` is a foreign key
		// to `user`, and this wrote `event.businessId` into it — so under D1's foreign keys
		// every insert threw, retried five times and dead-lettered, and the shop learned
		// about none of its orders. The FK is what caught it; nothing else would have.
		expect(
			keys
				.filter((row) => row.user_id === "usr_events_owner")
				.map((row) => row.dedupe_key),
		).toHaveLength(2);
		expect(
			keys
				.filter((row) => row.user_id === "usr_events_customer")
				.map((row) => row.dedupe_key),
		).toHaveLength(2);

		test.close();
	});

	test("the same event delivered twice writes one notification", async () => {
		const test = world();
		const { order, shop } = await placedOrder(test);
		await shop.orders.advance({ orderId: order.id, to: "ACCEPTED" });

		const envelope = envelopes(test)[1];
		if (!envelope) throw new Error("expected the move to have been announced");

		// The same message twice, which is what an at-least-once queue does — on a retry, on
		// a redelivery after an eviction, or because the sweeper republished a row whose
		// first send succeeded and whose mark did not.
		const first = await consume(test, [envelope]);
		const second = await consume(test, [envelope]);

		// Acked both times, and written once per recipient. A second row per
		// recipient would be a second bell in their list for one thing that
		// happened: one for the shop, one for the customer.
		expect(first.acked).toBe(1);
		expect(second.acked).toBe(1);
		expect(first.retried).toHaveLength(0);
		expect(count(test.sqlite, "notification", "where kind = 'ORDER'")).toBe(2);

		test.close();
	});

	test("an envelope with no event id is dropped rather than deduplicated by guesswork", async () => {
		const test = world();

		// It has nothing to be deduplicated by, so the only safe reading is "do not act":
		// processing it would mean a redelivery writes a second notification, which is the
		// failure the key exists to prevent.
		const settled = await consume(test, [
			{
				eventId: "",
				aggregateType: "order",
				aggregateId: "ord_x",
				aggregateVersion: 1,
				eventType: "ORDER_PLACED",
				occurredAt: new Date().toISOString(),
				payload: {
					type: "ORDER_PLACED",
					orderId: "ord_x",
					businessId: "biz_x",
					actorId: "usr_x",
				},
			},
		]);

		expect(settled.acked).toBe(1);
		expect(settled.retried).toHaveLength(0);
		expect(count(test.sqlite, "notification")).toBe(0);

		test.close();
	});

	test("a write that fails is retried, not acked", async () => {
		const test = world();
		const { order, shop } = await placedOrder(test);
		await shop.orders.advance({ orderId: order.id, to: "ACCEPTED" });

		// The table the consumer writes to, gone. D1 being briefly unavailable is the case
		// this covers: an `ack()` here drops the notification permanently, and a `retry()`
		// brings it back with backoff.
		test.sqlite.exec("drop table notification");

		const envelope = envelopes(test)[1];
		if (!envelope) throw new Error("expected the move to have been announced");
		const settled = await consume(test, [envelope], 3);

		expect(settled.acked).toBe(0);
		// `2 ** attempts`, capped at a minute: a third attempt means eight seconds.
		expect(settled.retried).toEqual([8]);

		test.close();
	});
});

describe("customer notifications", () => {
	test("an opted-out customer gets no row, and the shop still does", async () => {
		const test = world();
		const { caller, order, shop } = await placedOrder(test);

		await caller.users.updatePreferences({ notifyOrderUpdates: false });
		await shop.orders.advance({ orderId: order.id, to: "ACCEPTED" });

		const settled = await consume(test, [envelopes(test).at(-1)]);
		expect(settled.acked).toBe(1);
		expect(
			count(
				test.sqlite,
				"notification",
				"where kind = 'ORDER' and user_id = 'usr_events_owner'",
			),
		).toBe(1);
		expect(
			count(
				test.sqlite,
				"notification",
				"where kind = 'ORDER' and user_id = 'usr_events_customer'",
			),
		).toBe(0);

		test.close();
	});

	test("a customer's own cancel tells nobody new", async () => {
		const test = world();
		const { caller, order } = await placedOrder(test);

		await caller.orders.cancel({ orderId: order.id });

		const settled = await consume(test, [envelopes(test).at(-1)]);
		expect(settled.acked).toBe(1);
		// The shop hears about the cancelled order; the customer who cancelled
		// it is the actor, and the actor is never told.
		expect(
			count(
				test.sqlite,
				"notification",
				"where kind = 'ORDER' and user_id = 'usr_events_owner'",
			),
		).toBe(1);
		expect(
			count(
				test.sqlite,
				"notification",
				"where kind = 'ORDER' and user_id = 'usr_events_customer'",
			),
		).toBe(0);

		test.close();
	});

	test("placing an order writes no customer bell", async () => {
		const test = world();
		await placedOrder(test);

		const settled = await consume(test, [envelopes(test)[0]]);
		expect(settled.acked).toBe(1);
		// The ledger row is `ORDER_REQUEST`, not a bell: placing an order tells
		// the shop, and the customer needs no notification saying they ordered.
		expect(
			count(
				test.sqlite,
				"notification",
				"where kind = 'ORDER' and user_id = 'usr_events_owner'",
			),
		).toBe(1);
		expect(
			count(
				test.sqlite,
				"notification",
				"where kind = 'ORDER' and user_id = 'usr_events_customer'",
			),
		).toBe(0);

		test.close();
	});
});
