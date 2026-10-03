import { ORDER_STATUSES, type OrderStatus } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/context";

/**
 * Where the reader is in a purchase, reduced to the four states the feed's background draws.
 *
 * `browsing` → nothing in the basket, nothing in flight.
 * `basket`   → lines in the basket: the reader has chosen something.
 * `placed`   → an order exists and the shop has not started making it.
 * `onTheWay` → an order exists and it is being prepared, is ready, or has left.
 *
 * ## Why an order outranks the basket
 *
 * These are not mutually exclusive: a reader can have a full basket *and* an order being
 * delivered. `placed` and `onTheWay` are checked first because the order is the more advanced
 * and more interesting fact — "your food is on its way" matters more than "you also have four
 * things in the basket" — and a background that regressed from green to neutral because
 * somebody added milk would be telling the reader less than it knew.
 *
 * ## Why the statuses are named here rather than hardcoded at the call site
 *
 * `FULFILMENT_STATUSES` is derived from `ORDER_STATUSES` so a status added to the enum in
 * `packages/shared/src/order-state.ts` cannot be forgotten here: a new status lands in
 * `onTheWay` by default rather than silently rendering as `browsing`. The grouping itself is
 * this file's judgement about what a background should say, and it is stated here in one place
 * so a reader can disagree with it in one place.
 *
 * `PENDING` and `ACCEPTED` are `placed` because that is what "paid" means to a customer who
 * has just checked out: the money has left and the shop has the order. `PREPARING` onwards is
 * `onTheWay` because the thing has become somebody's job. `COMPLETED`, `CANCELLED` and
 * `REJECTED` are terminal and are in neither list, which is what makes the background settle
 * back to `browsing` when an order ends — a reader whose order was refused should not be left
 * staring at a green "success" wash.
 *
 * ## Both queries are enabled, and neither blocks a paint
 *
 * This hook is read by a background wash, so it must never suspend the screen. Both queries
 * return `undefined` while loading and both fall through to `browsing`, which is the state a
 * reader is in before they have done anything. A background that appears a beat late is
 * correct; a spinner over it would not be.
 *
 * ## `browsing` is a real answer, not a placeholder
 *
 * It is the state a signed-out visitor is permanently in, and it is the state the whole feed
 * is drawn in until the reader touches it. The wash is drawn in that state too, at low
 * contrast, so the screen is never a flat colour with a colour appearing later.
 */
export type PurchaseState = "browsing" | "basket" | "placed" | "onTheWay";

/**
 * The statuses that mean "the order exists and the shop has it".
 *
 * Derived from the enum rather than written as its own list, so the two cannot drift.
 */
const PLACED_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
	(status) => status === "PENDING" || status === "ACCEPTED",
);

/**
 * The statuses that mean "somebody is working on it".
 *
 * `PREPARING`, `READY`, `OUT_FOR_DELIVERY` — and anything the enum gains later, which is the
 * point of the filter: a new non-terminal status describes an order in progress, and dropping
 * it into "not placed" would render a reader's live order as though nothing had happened.
 */
const FULFILMENT_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
	(status) =>
		!PLACED_STATUSES.includes(status) &&
		status !== "COMPLETED" &&
		status !== "CANCELLED" &&
		status !== "REJECTED",
);

export function usePurchaseState(): PurchaseState {
	const trpc = useTRPC();

	// The basket, for `basket`. `cart.get` is the one query every quick-add already writes to
	// (`lib/cart-mutations.ts` seeds its cache optimistically), so the wash reacts to an add in
	// the same frame the tab-bar badge does, with no polling of its own.
	const cart = useQuery(trpc.cart.get.queryOptions());

	// The reader's orders, for `placed` and `onTheWay`. `orders.list` is already fetched by
	// `app/(customer)/orders` and by the checkout success screen, so in practice this is served
	// from a cache the reader filled on the way here.
	const orders = useQuery(trpc.orders.list.queryOptions({ limit: 5 }));

	const status = newestLiveStatus(orders.data);
	if (status) {
		if (FULFILMENT_STATUSES.includes(status)) return "onTheWay";
		if (PLACED_STATUSES.includes(status)) return "placed";
	}

	// `items.length`, not the totals: a basket whose lines are all zero-quantity is not a
	// basket, and `totals` would still be a well-formed zero.
	return cart.data && cart.data.items.length > 0 ? "basket" : "browsing";
}

/**
 * The status of the reader's most recent order that has not finished.
 *
 * The key is `items`, not `orders`: `orders.list` is the same cursor envelope `cart.get`
 * returns, and this hook is the first caller in the app that reads it for a status rather than
 * for a list to render — `app/(customer)/orders` maps `data.items` and never needed the name
 * spelled out here, so it was easy to assume.
 *
 * Walking the rows rather than taking `[0]` matters. `orders.list` is newest-first by the API,
 * so the first row is normally the one to read — but a reader whose newest order was cancelled
 * and whose one before it is still out for delivery should be told about the delivery, not
 * about the cancellation. Five rows is enough for that to be rare and small enough not to matter.
 */
function newestLiveStatus(
	data: { items?: { status: OrderStatus }[] } | undefined,
): OrderStatus | null {
	const rows = data?.items;
	if (!rows) return null;
	for (const row of rows) {
		if (FULFILMENT_STATUSES.includes(row.status)) return row.status;
		if (PLACED_STATUSES.includes(row.status)) return row.status;
	}
	return null;
}
