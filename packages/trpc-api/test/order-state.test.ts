import { describe, expect, test } from "bun:test";
import { addressInput, addToCartInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * The order state machine, end to end.
 *
 * Five claims, each of which is a bug that ships if it is untested:
 *
 * 1. An illegal transition is refused, and the order did not move.
 * 2. A pickup order can never reach `OUT_FOR_DELIVERY`.
 * 3. `expectedStatus` is optimistic concurrency: a stale advance loses, and writes nothing.
 * 4. Every legal move is announced twice — onto the queue and to the order's Durable Object.
 * 5. Who may move an order is decided by the caller's relationship to the order row, and a
 *    stranger gets the same answer a fabricated id gets.
 *
 * The caller goes through `appRouter.createCaller`, so the middleware, the input schema and
 * the service are all the production ones. Only the database socket is substituted; see
 * `harness.ts`.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const CASH = "CASH" as const;

/** A shop with a stocked product, a customer with a basket, and the staff who serve it. */
async function shop(test: Test, fulfilment: "PICKUP" | "DELIVERY") {
	const shopId = await seedBusiness(test.db);
	const product = await seedProduct(test.db, { businessId: shopId });
	const customer = await seedUser(test.db, { id: "usr_test_customer" });
	const staff = await seedUser(test.db, {
		id: "usr_test_staff",
		name: "Cocina",
	});
	const manager = await seedUser(test.db, { id: "usr_test_manager" });
	await seedMembership(test.db, staff.id, shopId, "STAFF");
	await seedMembership(test.db, manager.id, shopId, "MANAGER");

	const customerCaller = appRouter.createCaller(
		await authed(test, customer),
	) as Caller;

	await customerCaller.cart.addItem(
		addToCartInput.parse({ productId: product.id, quantity: 1 }),
	);

	// The address rides only on a delivery: `placeOrderInput` refuses a DELIVERY without
	// one and a PICKUP with one, so each branch has to be given exactly what it takes.
	const address =
		fulfilment === "DELIVERY"
			? await customerCaller.users.saveAddress(
					addressInput.parse({
						label: "Casa",
						line1: "Calle 1, Avenida 2",
						city: "San José",
						region: "San José",
					}),
				)
			: null;

	const order = await customerCaller.orders.place({
		fulfilment,
		paymentMethod: CASH,
		clientRequestId: `req_${fulfilment.toLowerCase()}_000001`,
		...(address ? { addressId: address.id } : {}),
	});

	return {
		product,
		customer,
		staff,
		manager,
		customerCaller,
		staffCaller: appRouter.createCaller(await authed(test, staff)) as Caller,
		managerCaller: appRouter.createCaller(
			await authed(test, manager),
		) as Caller,
		order,
	};
}

describe("the order state machine", () => {
	test("an illegal transition is refused, and the order does not move", async () => {
		const test = world();
		const { staffCaller, order } = await shop(test, "PICKUP");

		// PENDING → COMPLETED skips ACCEPTED, PREPARING and READY. `canTransition` says no,
		// and the service reports it as a request the caller could fix rather than writing
		// the move and letting the timeline lie about what happened in between.
		const error = await refused(
			staffCaller.orders.advance({ orderId: order.id, to: "COMPLETED" }),
		);
		expect(error.code).toBe("BAD_REQUEST");

		const after = await staffCaller.orders.byId({ id: order.id });
		expect(after.status).toBe("PENDING");

		// And nothing was announced for a move that did not happen.
		expect(test.sent.map((event) => event.type)).toEqual(["ORDER_PLACED"]);
		expect(test.published).toHaveLength(1);

		test.close();
	});

	test("a pickup order can never reach OUT_FOR_DELIVERY", async () => {
		const test = world();
		const { staffCaller, order } = await shop(test, "PICKUP");

		for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) {
			await staffCaller.orders.advance({ orderId: order.id, to });
		}

		const error = await refused(
			staffCaller.orders.advance({ orderId: order.id, to: "OUT_FOR_DELIVERY" }),
		);
		expect(error.code).toBe("BAD_REQUEST");

		// READY → COMPLETED is the pickup path, and it still works: the refusal was about
		// the courier state, not about an order that is now stuck.
		const completed = await staffCaller.orders.advance({
			orderId: order.id,
			to: "COMPLETED",
		});
		expect(completed.status).toBe("COMPLETED");

		test.close();
	});

	test("a delivery order may be dispatched, and every move is announced twice", async () => {
		const test = world();
		const { staffCaller, order } = await shop(test, "DELIVERY");

		for (const to of [
			"ACCEPTED",
			"PREPARING",
			"READY",
			"OUT_FOR_DELIVERY",
		] as const) {
			await staffCaller.orders.advance({
				orderId: order.id,
				to,
				...(to === "OUT_FOR_DELIVERY"
					? { courierName: "Repartidor de Prueba", courierPhone: "88888888" }
					: {}),
			});
		}

		const delivered = await staffCaller.orders.advance({
			orderId: order.id,
			to: "COMPLETED",
		});
		expect(delivered.status).toBe("COMPLETED");

		// The queue and the order's room saw the same six events. Both are announced from
		// the same durable outbox row, and an event that reached one and not the other is
		// the kind of drift that only shows up in production.
		expect(test.sent.map((event) => event.type)).toEqual([
			"ORDER_PLACED",
			"ORDER_STATUS_CHANGED",
			"ORDER_STATUS_CHANGED",
			"ORDER_STATUS_CHANGED",
			"ORDER_STATUS_CHANGED",
			"ORDER_STATUS_CHANGED",
		]);
		expect(test.published).toHaveLength(6);

		const last = test.published.at(-1) as { status?: string; at?: string };
		expect(last.status).toBe("COMPLETED");
		// `at` crosses a socket as an ISO string, never a `Date`.
		expect(typeof last.at).toBe("string");
		expect(Number.isNaN(Date.parse(last.at ?? ""))).toBe(false);

		test.close();
	});

	test("a stale expectedStatus loses the race and writes nothing", async () => {
		const test = world();
		const { staffCaller, order } = await shop(test, "PICKUP");

		await staffCaller.orders.advance({
			orderId: order.id,
			to: "ACCEPTED",
			expectedStatus: "PENDING",
		});

		// Two phones, both showing PENDING, both tapping. The second is told its view is
		// stale rather than being allowed to write a second ACCEPTED event.
		const error = await refused(
			staffCaller.orders.advance({
				orderId: order.id,
				to: "PREPARING",
				expectedStatus: "PENDING",
			}),
		);
		expect(error.code).toBe("CONFLICT");

		const after = await staffCaller.orders.byId({ id: order.id });
		expect(after.status).toBe("ACCEPTED");
		expect(after.events.map((event) => event.status)).toEqual([
			"PENDING",
			"ACCEPTED",
		]);

		test.close();
	});

	test("the customer may cancel before the kitchen starts, and not after", async () => {
		const test = world();
		const first = await shop(test, "PICKUP");

		const cancelled = await first.customerCaller.orders.cancel({
			orderId: first.order.id,
		});
		expect(cancelled.status).toBe("CANCELLED");
		test.close();

		const second = world();
		const { customerCaller, staffCaller, order } = await shop(second, "PICKUP");

		await staffCaller.orders.advance({ orderId: order.id, to: "ACCEPTED" });
		await staffCaller.orders.advance({ orderId: order.id, to: "PREPARING" });

		// PREPARING → CANCELLED excludes CUSTOMER: the food is being made and the money is
		// spent. The rule is in `canTransition`, not in this spec's service.
		const error = await refused(
			customerCaller.orders.cancel({ orderId: order.id }),
		);
		expect(error.code).toBe("BAD_REQUEST");

		second.close();
	});

	test("a customer cannot advance an order, and a stranger gets what a fake id gets", async () => {
		const test = world();
		const { customerCaller, order } = await shop(test, "PICKUP");

		// The caller *is* the customer, so the order is reachable — and the actor is
		// CUSTOMER, which `canTransition` does not accept for PENDING → ACCEPTED.
		const refusedAdvance = await refused(
			customerCaller.orders.advance({ orderId: order.id, to: "ACCEPTED" }),
		);
		expect(refusedAdvance.code).toBe("BAD_REQUEST");

		const stranger = await seedUser(test.db, { id: "usr_test_stranger" });
		const strangerCaller = appRouter.createCaller(
			await authed(test, stranger),
		) as Caller;

		// Not the customer, not an admin, not a member: the same `NotFoundError` a
		// fabricated order id gets, so the caller learns nothing about the order.
		const missing = await refused(strangerCaller.orders.byId({ id: order.id }));
		expect(missing.code).toBe("NOT_FOUND");

		const forbidden = await refused(
			strangerCaller.orders.queue({
				businessId: "biz_test_shop",
				role: "BUSINESS",
			}),
		);
		expect(forbidden.code).toBe("FORBIDDEN");

		test.close();
	});
});
