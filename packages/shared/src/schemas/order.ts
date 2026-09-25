/**
 * Orders — the one place where money has already changed hands and the data can no
 * longer be corrected, only compensated.
 *
 * Two consequences run through this file:
 *
 * 1. **The order snapshots the product.** `OrderItem` carries the name, the unit
 *    price and the chosen options as they were at checkout. A business that raises
 *    the price of a coffee tomorrow must not change what yesterday's receipt says,
 *    and a product row that is deleted must not empty an old order.
 * 2. **Every status change is an event.** `OrderEvent` is append-only and the order's
 *    `status` is a cached read of its last entry. The customer's timeline, the
 *    business's queue and the admin's dispute investigation all read the same log,
 *    so they cannot tell three different stories about one order.
 *
 * The legal moves live in `order-state.ts` and are shared with the API. This file
 * only describes what a move looks like on the wire.
 */

import { z } from "zod";
import {
	FULFILMENT_KINDS,
	ORDER_STATUSES,
	PAYMENT_METHODS,
	PAYMENT_STATUSES,
} from "../order-state";
import { cartSchema } from "./cart";
import { currencySchema, latitudeSchema, longitudeSchema } from "./common";

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const fulfilmentKindSchema = z.enum(FULFILMENT_KINDS);

export const MAX_TIP_MINOR = 50_000_000;

/**
 * Placing an order. Note what is *not* here: no prices, no totals, no business id.
 * Everything that determines the amount is read server-side from the cart, because
 * a client that sends a total is a client that can send a different total.
 */
export const placeOrderInput = z
	.object({
		fulfilment: fulfilmentKindSchema,
		/** Select the exact branch when a merchant has more than one location. */
		locationId: z.string().optional(),
		/** Required for DELIVERY, ignored for PICKUP. Enforced below. */
		addressId: z.string().optional(),
		paymentMethod: paymentMethodSchema,
		tipMinor: z.number().int().min(0).max(MAX_TIP_MINOR).default(0),
		customerNotes: z.string().trim().max(500).optional(),
		/** Promo code re-sent at checkout so the discount is applied against a fresh read. */
		promotionCode: z.string().trim().max(40).optional(),
		/** Idempotency: a double-tapped "pay" must not create two orders. */
		clientRequestId: z.string().min(8).max(64),
		/** Reject a changed quote before creating an order. Never used to price it. */
		expectedTotalMinor: z.number().int().min(0).optional(),
	})
	.refine((input) => input.fulfilment !== "DELIVERY" || !!input.addressId, {
		message: "Se requiere una dirección para entrega a domicilio",
		path: ["addressId"],
	})
	.refine((input) => input.fulfilment !== "PICKUP" || !input.addressId, {
		message: "Un pedido para retirar no lleva dirección de entrega",
		path: ["addressId"],
	});
export type PlaceOrderInput = z.infer<typeof placeOrderInput>;

/**
 * Advancing an order. `expectedStatus` is optimistic concurrency, not ceremony: two
 * staff on two phones both tapping "Listo" on the same order would otherwise write
 * two events and notify the customer twice. The second writer loses and is told so.
 */
export const advanceOrderInput = z.object({
	orderId: z.string().startsWith("ord_"),
	to: orderStatusSchema,
	expectedStatus: orderStatusSchema.optional(),
	note: z.string().trim().max(300).optional(),
	/** Set when moving to REJECTED or CANCELLED, so the customer is told why. */
	reason: z.string().trim().max(300).optional(),
	/** Delivery only: who is carrying it. */
	courierName: z.string().trim().max(120).optional(),
	courierPhone: z.string().trim().max(24).optional(),
});
export type AdvanceOrderInput = z.infer<typeof advanceOrderInput>;

export const cancelOrderInput = z.object({
	orderId: z.string().startsWith("ord_"),
	reason: z.string().trim().max(300).optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderInput>;

/**
 * Hand a READY delivery order to a courier. The courier is a member with the
 * COURIER role — an id, not a typed name — because a free-text name is a
 * different person every time it is spelled differently, and a phone typed at
 * dispatch is a number nobody verified. `advanceOrderInput`'s `courierName` /
 * `courierPhone` stay for the legacy path and are ignored once an assignee
 * exists: the row's name and phone come from the member's own profile.
 */
export const assignCourierInput = z.object({
	orderId: z.string().startsWith("ord_"),
	courierUserId: z.string(),
});
export type AssignCourierInput = z.infer<typeof assignCourierInput>;

/**
 * One ping from the courier's phone: where they are, on the order they carry.
 * Foreground only — the app posts while the run is open, roughly every 15
 * seconds — so a stale point means the app went to the background, not that
 * the courier stopped. Readers treat `courierAt` older than a minute as "last
 * seen", never as live.
 */
export const reportLocationInput = z.object({
	orderId: z.string().startsWith("ord_"),
	lat: latitudeSchema,
	lng: longitudeSchema,
});
export type ReportLocationInput = z.infer<typeof reportLocationInput>;

export const orderItemSchema = z.object({
	id: z.string(),
	productId: z.string().nullable(),
	/** The snapshot: these are the values at checkout, not the product's today. */
	name: z.string(),
	/**
	 * The picture the product had when the line was bought
	 * (`order_item.imageUrlSnapshot`), and `null` when it had none at checkout.
	 *
	 * A snapshot, and deliberately **not** a live read of the product: a receipt must
	 * not change its picture when the catalogue does.
	 */
	imageUrl: z.string().nullable(),
	unitPriceMinor: z.number().int(),
	quantity: z.number().int().min(1),
	lineTotalMinor: z.number().int(),
	options: z.array(
		z.object({ name: z.string(), priceDeltaMinor: z.number().int() }),
	),
	notes: z.string().nullable(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderEventSchema = z.object({
	id: z.string(),
	status: z.enum([...ORDER_STATUSES, "NOTE"] as const),
	actor: z.enum(["CUSTOMER", "BUSINESS", "COURIER", "ADMIN", "SYSTEM"]),
	/** Denormalised for display: a staff member who leaves keeps their name on the events they wrote. */
	actorName: z.string().nullable(),
	note: z.string().nullable(),
	createdAt: z.date(),
});
export type OrderEvent = z.infer<typeof orderEventSchema>;

export const orderTotalsSchema = z.object({
	subtotalMinor: z.number().int(),
	discountMinor: z.number().int(),
	deliveryFeeMinor: z.number().int(),
	taxMinor: z.number().int(),
	tipMinor: z.number().int(),
	totalMinor: z.number().int(),
	currency: currencySchema,
});
export type OrderTotals = z.infer<typeof orderTotalsSchema>;

export const orderAddressSchema = z.object({
	label: z.string(),
	line1: z.string(),
	line2: z.string().nullable(),
	city: z.string(),
	region: z.string(),
	postalCode: z.string().nullable(),
	lat: z.number().nullable(),
	lng: z.number().nullable(),
	phone: z.string().nullable(),
	instructions: z.string().nullable(),
});
export type OrderAddress = z.infer<typeof orderAddressSchema>;

/** The compact shape a list renders — a customer's "Mis pedidos", a business's queue. */
export const orderSummarySchema = z.object({
	id: z.string(),
	locationId: z.string().nullable(),
	reference: z.string(),
	status: orderStatusSchema,
	fulfilment: fulfilmentKindSchema,
	paymentMethod: paymentMethodSchema,
	paymentStatus: paymentStatusSchema,
	totalMinor: z.number().int(),
	currency: currencySchema,
	itemCount: z.number().int().min(1),
	/** One line of the order, for the list: "2× Café chorreado y 1 más". */
	headline: z.string(),
	placedAt: z.date(),
	/** What the caller can do next, computed server-side from the shared state machine. */
	nextStatuses: z.array(orderStatusSchema),
	canCancel: z.boolean(),
	estimatedReadyAt: z.date().nullable(),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const orderDetailSchema = orderSummarySchema.extend({
	business: z.object({
		id: z.string(),
		name: z.string(),
		slug: z.string(),
		logoUrl: z.string().nullable(),
		phone: z.string().nullable(),
	}),
	customer: z.object({
		id: z.string(),
		name: z.string(),
		phone: z.string().nullable(),
	}),
	items: z.array(orderItemSchema),
	totals: orderTotalsSchema,
	deliveryAddress: orderAddressSchema.nullable(),
	pickupCode: z.string().nullable(),
	courier: z
		.object({ name: z.string().nullable(), phone: z.string().nullable() })
		.nullable(),
	customerNotes: z.string().nullable(),
	events: z.array(orderEventSchema),
	review: z
		.object({
			id: z.string(),
			rating: z.number().int().min(1).max(5),
			comment: z.string().nullable(),
		})
		.nullable(),
	cancellationReason: z.string().nullable(),
	scheduledFor: z.date().nullable(),
	completedAt: z.date().nullable(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

/**
 * `role` decides which side of the order the caller is on, so one procedure serves both apps.
 *
 * The sort direction is `sortDirection` and not `direction` — `@trpc/tanstack-react-query`
 * writes `direction` into an infinite query's input itself, so the shorter name made every
 * call through `infiniteQueryOptions` unreadable. `productListInput` carries the long note.
 */
export const orderListInput = z.object({
	role: z.enum(["CUSTOMER", "BUSINESS"]).default("CUSTOMER"),
	/** Business view only; ignored for a customer, whose scope is always themselves. */
	businessId: z.string().optional(),
	/** Business view only. The service checks that this location belongs to businessId. */
	locationId: z.string().optional(),
	status: z.array(orderStatusSchema).max(9).optional(),
	activeOnly: z.boolean().default(false),
	/**
	 * Business view only: only orders assigned to the caller. The courier's
	 * board is this flag rather than a procedure of its own — same rows, same
	 * paging, one fewer name for two clients to agree on.
	 */
	assignedToMe: z.boolean().default(false),
	from: z.date().optional(),
	to: z.date().optional(),
	search: z.string().trim().max(120).optional(),
	sort: z.enum(["placedAt", "total"]).default("placedAt"),
	sortDirection: z.enum(["asc", "desc"]).default("desc"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(50).default(20),
});
export type OrderListInput = z.infer<typeof orderListInput>;

/**
 * The home screen's "Order again" shelf: the products the caller has bought before.
 *
 * A `limit` and nothing else, because everything else the shelf needs belongs to the
 * session: *whose* purchases (always the caller's own - there is no `userId` to send,
 * and no privilege buys a read of somebody else's) and *how many* (a shelf, not a
 * catalogue - twenty is the ceiling of a rail of cards, and the customer's full history
 * is `orders.list`'s job). The dedupe and the recency ordering are the server's for the
 * same reason: "bought twice, shown once at the later purchase" is a fact about
 * `order_item` rows spread over several orders, which no single response a client holds
 * can answer.
 */
export const purchasedProductsInput = z.object({
	limit: z.number().int().min(1).max(20).default(8),
});
export type PurchasedProductsInput = z.infer<typeof purchasedProductsInput>;

/**
 * The order's timeline, as a projection rather than a subscription.
 *
 * Polled by the web client's order page. The apps do not read this one — they poll
 * `orders.byId` — so nothing here has a subscriber waiting on the other end of it.
 *
 * This said "a Durable Object pushes it to the apps", which was wrong twice. No app receives
 * a push: the room's event is `OrderRoomEvent` (`apps/api/src/durable/order-room.ts`), and the
 * room currently fans out to nobody because no client opens that socket — a fact the room's own
 * docblock and `docs/api-surface.md` both state, which left this line as the last place the
 * corrected fact had not reached, in a package both clients import. And the payload is not the
 * room's to push: what arrives here is a projection the Worker builds from D1, so the old
 * sentence misplaced where the data comes from as well as how it travels.
 */
export const orderTrackingSchema = z.object({
	orderId: z.string(),
	status: orderStatusSchema,
	timeline: z.array(
		z.object({
			status: orderStatusSchema,
			state: z.enum(["done", "current", "upcoming", "skipped"]),
			at: z.date().nullable(),
		}),
	),
	courier: z
		.object({
			name: z.string().nullable(),
			phone: z.string().nullable(),
			lat: z.number().nullable(),
			lng: z.number().nullable(),
			updatedAt: z.date().nullable(),
		})
		.nullable(),
	estimatedReadyAt: z.date().nullable(),
	estimatedDeliveryAt: z.date().nullable(),
});
export type OrderTracking = z.infer<typeof orderTrackingSchema>;

/**
 * The customer's own line about a finished order. One per order, enforced by a unique
 * index rather than by a check, because a check can be skipped by a second writer and
 * a unique index cannot.
 */
export const createReviewInput = z.object({
	orderId: z.string().startsWith("ord_"),
	rating: z.number().int().min(1).max(5),
	comment: z.string().trim().max(1000).optional(),
	imageUrls: z.array(z.string()).max(4).default([]),
});
export type CreateReviewInput = z.infer<typeof createReviewInput>;

export const reviewSchema = z.object({
	id: z.string(),
	orderId: z.string(),
	businessId: z.string(),
	rating: z.number().int().min(1).max(5),
	comment: z.string().nullable(),
	imageUrls: z.array(z.string()),
	/** Displayed name only — never the reviewer's email or phone. */
	authorName: z.string(),
	authorImage: z.string().nullable(),
	reply: z.string().nullable(),
	repliedAt: z.date().nullable(),
	createdAt: z.date(),
});
export type Review = z.infer<typeof reviewSchema>;

export const replyToReviewInput = z.object({
	reviewId: z.string(),
	reply: z.string().trim().min(1).max(1000),
});
export type ReplyToReviewInput = z.infer<typeof replyToReviewInput>;

/**
 * A business's review list — the input both of its readers take.
 *
 * `businessId` is here because a procedure has to say *which* business, and what
 * validates it depends on which reader asked: `reviews.listForBusiness` checks it
 * against the caller's `membership` row, and `reviews.list` — the public one — checks
 * it against the business's own `status`. One shape for both is what lets one client
 * component page the shop's own list and the storefront's with the same cursor. It
 * lives beside the review shapes rather than in `business.ts` so that the page of
 * reviews and the page of orders are described in one file.
 */
export const reviewListInput = z.object({
	businessId: z.string(),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(50).default(20),
});
export type ReviewListInput = z.infer<typeof reviewListInput>;

/**
 * The three numbers at the top of the business's order board.
 *
 * `revenueByCurrency` is a list for the same reason `admin.metrics`'s
 * `volumeByCurrency` is one: a business *is* priced in one currency today, but the
 * query behind this reads `order.currency`, and a single total would be a sum across
 * currencies the day a business is repriced or a migration half-lands. Grouping is
 * free here and the failure it prevents is a number with no meaning.
 */
export const orderStatsSchema = z.object({
	/** Orders that have not reached COMPLETED, CANCELLED or REJECTED. */
	active: z.number().int().min(0),
	/** Orders placed since midnight in Costa Rica. */
	today: z.number().int().min(0),
	revenueByCurrency: z.array(
		z.object({
			currency: currencySchema,
			revenueMinor: z.number().int(),
			orderCount: z.number().int().min(0),
		}),
	),
	/**
	 * Today's completed revenue, same entries as `revenueByCurrency` and the same
	 * COMPLETED-only meaning, scoped to the Costa Rica day `stats()` reads `today`
	 * against. A second field rather than a narrowed `revenueByCurrency` because that
	 * one is every completed order ever and the web dashboard reads it as exactly
	 * that (`dashboard-view.tsx` says a card labelled "today" showing all time is
	 * the number that teaches an owner to distrust the screen). The merchant home's
	 * pulse band reads this one; anything labelled all-time reads the other.
	 */
	todayRevenueByCurrency: z.array(
		z.object({
			currency: currencySchema,
			revenueMinor: z.number().int(),
			orderCount: z.number().int().min(0),
		}),
	),
});
export type OrderStats = z.infer<typeof orderStatsSchema>;

export const OPERATIONAL_PULSE_COMPARISONS = [
	"previous_day",
	"previous_week",
] as const;
export type OperationalPulseComparisonPeriod =
	(typeof OPERATIONAL_PULSE_COMPARISONS)[number];

export const operationalPulseComparisonSchema = z.object({
	period: z.enum(OPERATIONAL_PULSE_COMPARISONS),
	salesDeltaMinor: z.number().int(),
	orderDelta: z.number().int(),
});
export type OperationalPulseComparison = z.infer<
	typeof operationalPulseComparisonSchema
>;

export const operationalPulseSchema = orderStatsSchema.extend({
	period: z.object({
		from: z.date(),
		to: z.date(),
		timezone: z.string().min(1),
	}),
	grossSalesMinor: z.number().int().min(0),
	discountsMinor: z.number().int().min(0),
	refundsMinor: z.number().int().min(0),
	merchantNetSalesMinor: z.number().int(),
	orderCount: z.number().int().min(0),
	averageOrderValueMinor: z.number().int().min(0),
	currency: currencySchema,
	comparisons: z.array(operationalPulseComparisonSchema).optional(),
});
export type OperationalPulse = z.infer<typeof operationalPulseSchema>;

/**
 * Reordering — buying the same things again, and the reason it is a procedure.
 *
 * It is the highest-frequency job a marketplace customer has, and it is the one job a
 * client cannot do on its own. A cart line is a **product id and option ids**, and the
 * order's rows carry those only as the *snapshot* taken at checkout: `order_item.options`
 * is the `ChosenOption[]` of that moment, and every price in it — the product's
 * `priceMinor` and each option's `priceDeltaMinor` — is catalog data that is allowed to
 * have moved since. `cart.addItem` reads the live product row and the live option rows for
 * exactly that reason, so a client that rebuilt a basket from an order's own rows would be
 * a second pricing implementation that disagrees with the first. The Worker rebuilds it
 * through the one function that writes cart lines, and answers with the cart plus the lines
 * it could not bring back.
 */
export const reorderOrderInput = z.object({
	orderId: z.string().startsWith("ord_"),
	/**
	 * What to do when the caller already has a basket at a different shop.
	 *
	 * The same two values as `addToCartInput`, with the same default and for the same
	 * reason: replacing a basket the customer spent five minutes on is not a decision to
	 * make on their behalf, so the default refuses and the client asks. A reorder is
	 * additive and not idempotent — a second call adds the quantities again, exactly as a
	 * second `cart.addItem` would — so a screen disables its button while the call is in
	 * flight rather than relying on a key here.
	 */
	onBusinessConflict: z.enum(["reject", "replace"]).default("reject"),
});
export type ReorderOrderInput = z.infer<typeof reorderOrderInput>;

/**
 * Why a line of the order could not come back — as **message keys**, never as sentences.
 *
 * The same rule `PROMOTION_ERROR_KEYS` follows, for the same reason: a Worker has no
 * dictionary, so a sentence written in the service reaches an English reader verbatim. The
 * value travelling on the wire *is* the key, so the screen translates `reason` and there is
 * no second mapping table to drift from this one.
 *
 * Three reasons and no fourth. A line is dropped for a fact about the *line* — its product
 * is gone, or its options are — or because the basket has no room for it; the shop being
 * closed is not a per-line fact and is refused before anything is written.
 */
export const REORDER_SKIP_REASONS = [
	"order.reorder.skipped.productUnavailable",
	"order.reorder.skipped.optionsUnavailable",
	"order.reorder.skipped.cartFull",
] as const;
export type ReorderSkipReason = (typeof REORDER_SKIP_REASONS)[number];

/**
 * A line that did not come back, named so the screen can say which one and why.
 *
 * `name` is the order's own `nameSnapshot`, and it has to be: the product row is precisely
 * what may have gone, so the live name is the one string this cannot rely on.
 */
export const reorderSkippedLineSchema = z.object({
	productId: z.string(),
	name: z.string(),
	quantity: z.number().int().min(1),
	reason: z.enum(REORDER_SKIP_REASONS),
});
export type ReorderSkippedLine = z.infer<typeof reorderSkippedLineSchema>;

/**
 * The rebuilt cart, and the lines it is missing.
 *
 * `cart` is the whole `Cart` rather than a count, because the screen that asked has to show
 * what changed — this is the same object `cart.get` returns, so one renderer serves both.
 * When every line was skipped it is whatever cart the customer already had, which is never
 * `null` (`cartSchema`'s own rule).
 *
 * ## Lines, not units — and the difference is real
 *
 * `addedCount + skipped.length` is the order's **line** count, always: every line either came
 * back or is named here. `addedCount` counts lines (`orders.ts:1264` increments it once per
 * successful `addItem`), never units, so a line that returns *short* is counted in `addedCount`
 * all the same and does **not** appear in `skipped` — because `skipped` means "this line did
 * not come back", and a partial line did.
 *
 * A line can return short because two caps truncate rather than refuse, both deliberately
 * (`cart.ts:156` "Capped rather than refused: a customer tapping '+' past the limit should see
 * the quantity stop, not an error on a button they are holding down"):
 *
 *   - the reorder clamps the requested quantity to `MAX_LINE_QUANTITY` (`orders.ts:1250`);
 *   - `cart.addItem` **merges** into an existing line at the same cap —
 *     `Math.min(MAX_LINE_QUANTITY, line[0].quantity + input.quantity)` (`cart.ts:158-161`).
 *
 * So an order line of 10, reordered while the customer's open cart already holds 15 of the same
 * configuration, arrives as 5 more: the customer asked for ten and got five, with no entry in
 * `skipped` and no field anywhere in this result that says so. Measured, not inferred — a probe
 * against the in-memory harness reported `addedCount: 1, skipped: []` and a line going from 15
 * to 20.
 *
 * This docblock used to end "Nothing is dropped silently, which is the whole reason `skipped`
 * exists rather than a boolean." That sentence is true of lines and false of quantities, and it
 * was written without the merge in view. The gap is recorded rather than papered over: closing
 * it is a product decision (report the shortfall as its own outcome, or refuse a line that
 * cannot come back whole and name it `cartFull`), not a docblock's to make.
 */
export const reorderResultSchema = z.object({
	cart: cartSchema,
	addedCount: z.number().int().min(0),
	skipped: z.array(reorderSkippedLineSchema),
});
export type ReorderResult = z.infer<typeof reorderResultSchema>;

/**
 * The one refusal a reorder raises before it writes anything.
 *
 * A key rather than a sentence for the reason above, and closed so the client cannot be
 * handed a reason it has no words for. `isReorderErrorKey` is what a client uses to tell
 * this apart from tRPC's own `BAD_REQUEST` text before printing it at a customer.
 */
export const REORDER_ERROR_KEYS = [
	"order.reorder.error.businessUnavailable",
] as const;
export type ReorderErrorKey = (typeof REORDER_ERROR_KEYS)[number];

/** Whether a value that arrived over the wire is the refusal above. */
export function isReorderErrorKey(value: unknown): value is ReorderErrorKey {
	return (
		typeof value === "string" &&
		(REORDER_ERROR_KEYS as readonly string[]).includes(value)
	);
}
