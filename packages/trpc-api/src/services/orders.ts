import type { ChosenOption, Db, PromotionKind } from "@pymeshub/db";
import {
	address as addressTable,
	business as businessTable,
	cartItem as cartItemTable,
	cart as cartTable,
	courierProfile as courierProfileTable,
	deliveryOffer as deliveryOfferTable,
	delivery as deliveryTable,
	merchantLocation as locationTable,
	membership as membershipTable,
	notification as notificationTable,
	orderEvent as orderEventTable,
	orderItem as orderItemTable,
	order as orderTable,
	outboxEvent as outboxTable,
	product as productTable,
	promotion as promotionTable,
	review as reviewTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type AdvanceOrderInput,
	type AssignCourierInput,
	applyDiscount,
	CART_STATUSES,
	type CancelOrderInput,
	type Cart,
	type CartStatus,
	canTransition,
	type Discount,
	decodeCursor,
	discountAmountOf,
	encodeCursor,
	isPaymentMethodEnabled,
	isTerminalStatus,
	MARKET_TIME_ZONE,
	MAX_CART_LINES,
	MAX_LINE_QUANTITY,
	newId,
	newOrderReference,
	type OperationalPulse,
	ORDER_STATUSES,
	type OrderActor,
	type OrderDetail,
	type OrderListInput,
	type OrderStatus,
	type OrderSummary,
	type OrderTracking,
	optionsHash,
	type PlaceOrderInput,
	type ProductCard,
	type PromotionErrorKey,
	REORDER_ERROR_KEYS,
	type ReorderOrderInput,
	type ReorderResult,
	type ReorderSkippedLine,
	type ReorderSkipReason,
	type ReportLocationInput,
	requiresCollection,
	startOfMarketDay,
} from "@pymeshub/shared";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	like,
	lt,
	lte,
	type SQL,
	sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { rateLimit } from "../context";
import type { OrderRoom } from "../durable/order-room";
import { orderRoomFor } from "../env";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../errors";
import { type OrderEventEnvelope, orderEvent, outboxRowOf } from "../events";
import { publishEvents } from "../outbox";
import * as cartService from "./cart";
import { prepareDeliveryForOrder } from "./delivery-dispatch";
import type { BusinessContext, UserContext } from "./helpers";
import {
	batchOf,
	isPublicBusiness,
	likePattern,
	orNotFound,
	publicBusiness,
} from "./helpers";
import { operationalStatus } from "./locations";
import {
	orderDetailOf,
	orderSummaryOf,
	orderTrackingOf,
	productCardOf,
} from "./mappers";

/**
 * Orders — the one table where money has already changed hands.
 *
 * Three rules the whole file is built on:
 *
 * - **The server computes every amount.** `placeOrderInput` has no price field, and
 *   nothing here reads one from the payload: the unit price comes from the product
 *   row and the option deltas from the option rows, so a client cannot choose what it
 *   pays by sending a number.
 * - **An order is scoped by the caller.** By id, it is reachable by the customer who
 *   placed it and by a member of the business fulfilling it, and by nobody else — and
 *   "nobody else" gets the `NotFoundError` a fabricated id gets.
 * - **Every move is an event, written once and announced twice.** The event row goes into
 *   the same batch as the move it describes (`outbox_event`), and only then is it sent
 *   onto `ORDER_EVENTS` for the notification write and into the order's Durable Object
 *   over RPC, which fans it out to any socket that happens to be open. The queue can lag
 *   by seconds; the person who just tapped "confirmar" is looking at the screen now.
 *
 *   Nothing is holding one of those sockets. No client connects: web polls `orders.byId`
 *   and `orders.track`, and the apps poll `orders.byId`. The second announcement is
 *   therefore addressed to nobody today — it is kept because it is correct and cheap, and
 *   this line used to claim the apps were subscribed to it.
 */

/** An open cart, or none. `OPEN` is the only status a customer ever edits. */
const OPEN_CART_STATUS: CartStatus = CART_STATUSES[0];

/** The statuses that mean the order is still somebody's job. */
const ACTIVE_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
	(status) => !isTerminalStatus(status),
);

/**
 * The statuses whose orders actually bought something.
 *
 * The machine's own split twice over, and never a list typed here: `isTerminalStatus`
 * names the finished statuses, and `COMPLETED` is the one of them that is a sale - the
 * other two, `CANCELLED` and `REJECTED`, bought nothing and must not put products on a
 * shelf. An order still in flight counts, because the customer has bought the products
 * and the shop has merely not finished them yet.
 *
 * Derived the way `ACTIVE_STATUSES` above derives its half of the same split - the same
 * derivation `apps/web/app/(shop)/orders/page.tsx` uses for the "past" segment - so a
 * status added to `ORDER_STATUSES` is classified once, in `order-state.ts`, instead of
 * being remembered here and in every other list.
 */
const PURCHASED_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
	(status) => !isTerminalStatus(status) || status === "COMPLETED",
);

/**
 * The ledger kind. Written into `notification` for its unique index, and filtered out of
 * `users.listNotifications` by the matching constant there.
 */
export const ORDER_LEDGER_KIND = "ORDER_REQUEST";

/** Placing an order: generous, because a real customer retries on a bad connection. */
const PLACE_LIMIT = 10;
const PLACE_WINDOW_SECONDS = 60;

/** How long the loser of an idempotency race waits for the winner's order id. */
const CLAIM_ATTEMPTS = 5;
const CLAIM_WAIT_MS = 40;

// ---------------------------------------------------------------------------
// Placing
// ---------------------------------------------------------------------------

/**
 * Turn the caller's cart into an order.
 *
 * Idempotence lives in `claim` below; this function is the sequence of reads that decide
 * what the order *is*, and every one of them is scoped to the caller: the cart is the
 * caller's open cart, the address must be theirs, and the prices come from the product
 * rows the cart lines point at.
 */
export async function place(
	ctx: UserContext,
	input: PlaceOrderInput,
): Promise<OrderDetail> {
	// Before the cart is read: a retry loop that never reaches the ledger must still be
	// stopped, and a request that will be refused should not do four queries first.
	await rateLimit(
		ctx.env,
		"orders:place",
		ctx.user.id,
		PLACE_LIMIT,
		PLACE_WINDOW_SECONDS,
	);

	if (!isPaymentMethodEnabled(input.paymentMethod)) {
		throw new ValidationError("Ese método de pago todavía no está disponible", {
			field: "paymentMethod",
		});
	}

	// A duplicate that arrives after the first request *finished* is answered from the ledger
	// row, and this read has to come before the cart: the winner has already checked that
	// cart out, so the second attempt would otherwise be refused for an empty basket instead
	// of being handed the order it is asking about — which is the double-tap this whole
	// mechanism exists for. It is a read, not the concurrency control: the claim below is.
	const settled = await orderIdForDedupeKey(ctx, input.clientRequestId);
	if (settled) return detail(ctx, settled, "CUSTOMER");

	// No open cart is not a "not found": nothing here takes an id a probe could guess, and
	// the honest answer for a customer whose basket was cleared on another device is the one
	// they can act on — the same sentence the empty-cart branch below gives, as a
	// `BAD_REQUEST` with a message in it rather than a dead-end not-found state.
	const cart = await openCartOf(ctx.db, ctx.user.id);
	if (!cart) throw new ValidationError("Tu carrito está vacío");

	const lines = await ctx.db
		.select({ item: cartItemTable, product: productTable })
		.from(cartItemTable)
		.innerJoin(productTable, eq(cartItemTable.productId, productTable.id))
		.where(eq(cartItemTable.cartId, cart.id));

	if (lines.length === 0) throw new ValidationError("Tu carrito está vacío");

	const business = orNotFound(
		(
			await ctx.db
				.select()
				.from(businessTable)
				.where(eq(businessTable.id, cart.businessId))
				.limit(1)
		)[0],
	);

	// A shop suspended while the basket sat there cannot take the order, and the customer
	// must be told before the money is recorded rather than after.
	if (business.status !== "ACTIVE") {
		throw new ValidationError(
			"La tienda no está aceptando pedidos en este momento",
		);
	}

	const locations = await ctx.db
		.select()
		.from(locationTable)
		.where(eq(locationTable.businessId, business.id));
	const location = input.locationId
		? locations.find((entry) => entry.id === input.locationId)
		: locations.length === 1
			? locations[0]
			: undefined;
	if (!location) {
		throw new ValidationError(
			input.locationId
				? "La sucursal elegida no pertenece a esta tienda"
				: "Elige una sucursal para este pedido",
			{ field: "locationId" },
		);
	}
	if (operationalStatus(location, business, new Date()) !== "open") {
		throw new ValidationError(
			"Esta sucursal no está aceptando pedidos en este momento",
			{ field: "locationId" },
		);
	}

	const deliveryAddress = await resolveAddress(ctx, input);
	const addressId = deliveryAddress?.id ?? null;

	// Every price, re-read from the rows. The cart line's own `unitPriceMinor` was a price
	// at the time of adding and may have moved since; `priceDeltaMinor` comes from the
	// option ids the cart stored rather than from the product's current options.
	const priced = lines.map((line) => {
		const chosen = (line.item.options ?? []) as ChosenOption[];
		const unitPriceMinor =
			line.product.priceMinor +
			chosen.reduce((total, option) => total + option.priceDeltaMinor, 0);

		return {
			line: line.item,
			product: line.product,
			chosen,
			quantity: line.item.quantity,
			unitPriceMinor,
			lineTotalMinor: unitPriceMinor * line.item.quantity,
		};
	});

	const subtotalMinor = priced.reduce(
		(total, line) => total + line.lineTotalMinor,
		0,
	);

	if (business.minOrderMinor > 0 && subtotalMinor < business.minOrderMinor) {
		throw new ValidationError("Tu pedido no alcanza el mínimo de la tienda", {
			field: "subtotalMinor",
			minimumMinor: business.minOrderMinor,
		});
	}

	const promotion = await promotionFor(
		ctx.db,
		business.id,
		input.promotionCode ?? cart.promotionCode,
		subtotalMinor,
	);

	// Thrown rather than quietly dropped: a basket can hold a code that expired while the
	// customer browsed, and an order whose total differs from the one they were shown is
	// worse than one they are asked to re-confirm. The message is the reason's message key
	// (see `promotionFor`); `details` still names the field it is about, and a client that
	// resolves keys from the dictionary renders it as the sentence it stands for.
	if (promotion.error) {
		throw new ValidationError(promotion.error, { field: "promotionCode" });
	}

	const discountMinor = promotion.discount
		? discountAmountOf(subtotalMinor, promotion.discount)
		: 0;

	// Charged only when it is being delivered. A pickup carrying a delivery fee is the most
	// ordinary way an order total goes wrong.
	const deliveryFeeMinor =
		input.fulfilment === "DELIVERY" && !promotion.freeDelivery
			? business.deliveryFeeMinor
			: 0;
	// No tax engine: the ADR says so, and a rate nobody configured would be invented here.
	const taxMinor = 0;

	const totalMinor = Math.max(
		0,
		(promotion.discount
			? applyDiscount(subtotalMinor, promotion.discount)
			: subtotalMinor) +
			deliveryFeeMinor +
			taxMinor +
			input.tipMinor,
	);

	// The claim is taken last, and that is deliberate: it is the gate on the *writes*, so a
	if (
		input.expectedTotalMinor !== undefined &&
		input.expectedTotalMinor !== totalMinor
	) {
		throw new ConflictError(
			"El total cambió. Revisa el pedido y confirma de nuevo",
		);
	}

	// The claim is taken last, and that is deliberate: it is the gate on the *writes*, so a
	// request that is going to be refused — an empty cart, a shop that closed, a basket under
	// the minimum, a promotion that expired while they browsed — must not consume the
	// customer's `clientRequestId` on its way out. Taken before those reads it did exactly
	// that: the ledger row survived the refusal with no order behind it, and every later
	// retry of that id answered `existingOrderFor`'s "your previous order did not finish"
	// until it gave up — so the retry the message asks for could never succeed.
	const now = new Date();
	const orderId = newId("order");
	const reference = newOrderReference();
	const preparedDelivery = deliveryAddress
		? await prepareDeliveryForOrder(ctx.db, {
				orderId,
				businessId: business.id,
				businessName: business.name,
				businessPhone: business.phone,
				customerId: ctx.user.id,
				customerName: ctx.user.name,
				location,
				dropoff: {
					name: deliveryAddress.label || ctx.user.name || "",
					line1: deliveryAddress.line1,
					line2: deliveryAddress.line2,
					city: deliveryAddress.city,
					region: deliveryAddress.region ?? "",
					postalCode: deliveryAddress.postalCode,
					lat: deliveryAddress.lat,
					lng: deliveryAddress.lng,
					phone: deliveryAddress.phone ?? ctx.user.phone,
					instructions: deliveryAddress.instructions,
				},
				now,
			})
		: null;

	const claimRow = await claim(ctx, input.clientRequestId);
	if (!claimRow) return existingOrderFor(ctx, input.clientRequestId);

	// One batch, so the order, its lines, its first event, the cart that produced it and
	// the ledger row either all land or none do. D1 has no `begin`/`commit`; this is the
	// transaction.
	const statements: BatchItem<"sqlite">[] = [
		ctx.db.insert(orderTable).values({
			id: orderId,
			reference,
			customerId: ctx.user.id,
			businessId: business.id,
			locationId: location.id,
			addressId,
			fulfilment: input.fulfilment,
			status: "PENDING",
			// The first version. Every move after this is a compare-and-set on the column,
			// so the number an event carries means something.
			version: 1,
			paymentMethod: input.paymentMethod,
			paymentStatus: "UNPAID",
			currency: business.currency,
			subtotalMinor,
			discountMinor,
			deliveryFeeMinor,
			taxMinor,
			tipMinor: input.tipMinor,
			totalMinor,
			notes: input.customerNotes ?? null,
			scheduledFor: null,
			placedAt: now,
			createdAt: now,
			updatedAt: now,
		}),
		...(preparedDelivery?.statements ?? []),
		...priced.map((line) =>
			ctx.db.insert(orderItemTable).values({
				id: newId("orderItem"),
				orderId,
				productId: line.product.id,
				// The snapshot: a price rise tomorrow must not rewrite today's receipt.
				nameSnapshot: line.product.name,
				imageUrlSnapshot: line.product.imageUrl,
				quantity: line.quantity,
				unitPriceMinor: line.unitPriceMinor,
				options: line.chosen,
				lineTotalMinor: line.lineTotalMinor,
				notes: line.line.notes,
			}),
		),
		ctx.db.insert(orderEventTable).values({
			id: newId("orderEvent"),
			orderId,
			// Null on the row that records the order being placed: nothing preceded it.
			fromStatus: null,
			toStatus: "PENDING",
			actor: "CUSTOMER",
			actorUserId: ctx.user.id,
			note: null,
			createdAt: now,
		}),
		ctx.db
			.update(cartTable)
			.set({ status: "CHECKED_OUT", updatedAt: now })
			.where(eq(cartTable.id, cart.id)),
		// The ledger row gets its order id in the same transaction that creates the order,
		// so the loser of a race finds a real order rather than a claim with nothing behind it.
		ctx.db
			.update(notificationTable)
			.set({ data: { orderId } })
			.where(eq(notificationTable.id, claimRow.id)),
	];

	// Redemptions move only when an order actually exists: a code validated and then
	// abandoned at checkout is not a redemption.
	if (promotion.promotionId) {
		statements.push(
			ctx.db
				.update(promotionTable)
				.set({ redemptions: sql`${promotionTable.redemptions} + 1` })
				.where(eq(promotionTable.id, promotion.promotionId)),
		);
	}

	// The event is decided *before* the batch, because its row goes in the batch: from the
	// commit onward the event exists, and whether the send below succeeds changes only
	// *when* the shop hears about it, never whether it will.
	const envelope = orderEvent({
		aggregateId: orderId,
		aggregateVersion: 1,
		occurredAt: now,
		payload: {
			type: "ORDER_PLACED",
			orderId,
			businessId: business.id,
			actorId: ctx.user.id,
		},
	});
	statements.push(
		ctx.db.insert(outboxTable).values(outboxRowOf(envelope, now)),
	);

	try {
		await ctx.db.batch(batchOf(statements));
	} catch (error) {
		// The trigger evaluates the location inside the order's write transaction.
		// A pause that commits after the read above but before this insert must refuse
		// the order and release this attempt's empty idempotency claim for a retry.
		if (!String(error).includes("LOCATION_NOT_ACCEPTING_ORDERS")) throw error;
		await ctx.db
			.delete(notificationTable)
			.where(
				and(
					eq(notificationTable.id, claimRow.id),
					eq(
						notificationTable.dedupeKey,
						ledgerKey(ctx.user.id, input.clientRequestId),
					),
					isNull(notificationTable.data),
				),
			);
		throw new ValidationError(
			"Esta sucursal no está aceptando pedidos en este momento",
			{ field: "locationId" },
		);
	}

	await announce(ctx, envelope, "PENDING", now, null);

	return detail(ctx, orderId, "CUSTOMER");
}

/**
 * The claim, or nothing.
 *
 * `onConflictDoNothing().returning()` is the whole concurrency control: SQLite serialises
 * the two inserts against the unique index on `dedupe_key`, exactly one returns a row, and
 * the other gets an empty result and knows it lost. Written as a read-then-insert it would
 * be a check that two requests can both pass, which is precisely the double-tap this
 * exists to stop.
 *
 * The ledger is a `notification` row because `dedupe_key` carries the unique index this
 * needs and nothing else in the schema does. A table of its own would be a migration; this
 * is a column that already exists for exactly this shape of problem.
 */
async function claim(
	ctx: UserContext,
	clientRequestId: string,
): Promise<{ id: string } | null> {
	const rows = await ctx.db
		.insert(notificationTable)
		.values({
			id: newId("notification"),
			userId: ctx.user.id,
			kind: ORDER_LEDGER_KIND,
			// Never rendered — `users.listNotifications` filters this kind out precisely
			// because a ledger row addressed to the customer would be a bell entry saying
			// nothing. The columns are `notNull`, so they get honest text.
			title: "Pedido en proceso",
			body: "",
			data: null,
			dedupeKey: ledgerKey(ctx.user.id, clientRequestId),
			readAt: null,
			createdAt: new Date(),
		})
		.onConflictDoNothing()
		.returning({ id: notificationTable.id });

	return rows[0] ?? null;
}

/**
 * The order this request id already produced, or nothing.
 *
 * One read, so both callers can share it: `place` asks once at the top, because a duplicate
 * that arrives after the first attempt finished should be answered before the cart — which
 * the winner has already checked out — is even looked at.
 */
async function orderIdForDedupeKey(
	ctx: UserContext,
	clientRequestId: string,
): Promise<string | null> {
	const rows = await ctx.db
		.select({ data: notificationTable.data })
		.from(notificationTable)
		.where(
			eq(notificationTable.dedupeKey, ledgerKey(ctx.user.id, clientRequestId)),
		)
		.limit(1);

	const orderId = (rows[0]?.data as { orderId?: unknown } | null | undefined)
		?.orderId;
	return typeof orderId === "string" ? orderId : null;
}

/**
 * The order the winning request produced, for the request that lost the race.
 *
 * Bounded waiting rather than an immediate answer: the winner is writing its order right
 * now, and a loser that answered "conflict" to a double-tap would show the customer an
 * error for the thing that just succeeded. The wait is short — the winner's remaining work
 * is one batch — and it ends in a `ConflictError` rather than in a fabricated success, so
 * a request that genuinely cannot resolve says so.
 */
async function existingOrderFor(
	ctx: UserContext,
	clientRequestId: string,
): Promise<OrderDetail> {
	for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
		const orderId = await orderIdForDedupeKey(ctx, clientRequestId);
		if (orderId) return detail(ctx, orderId, "CUSTOMER");

		await delay(CLAIM_WAIT_MS);
	}

	// The ledger row exists and never got its order id, so the winning request died inside
	// its batch — the only failure left that can strand a claim, since everything that can
	// refuse a placement now runs before the claim is taken. Nothing was written (the batch
	// is atomic), so a retry is safe; it needs a fresh id, which is what the app supplies
	// when the customer taps again.
	throw new ConflictError(
		"Tu pedido anterior no terminó de registrarse. Intenta de nuevo.",
	);
}

/** `ORDER_PLACED:<customerId>:<clientRequestId>` — identifies the request, never a clock. */
function ledgerKey(customerId: string, clientRequestId: string): string {
	return `ORDER_PLACED:${customerId}:${clientRequestId}`;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The address a delivery goes to, which must be the caller's own.
 *
 * Scoped by owner in the same statement that reads it: somebody else's address id resolves
 * to nothing, and the customer is told the address is missing rather than that it is not
 * theirs. A pickup carries no address at all — `placeOrderInput` refuses an input that
 * sends both — and an order that kept one from an earlier delivery attempt is a driver
 * sent to a house for nothing.
 */
async function resolveAddress(
	ctx: UserContext,
	input: PlaceOrderInput,
): Promise<typeof addressTable.$inferSelect | null> {
	if (input.fulfilment !== "DELIVERY") return null;

	const rows = await ctx.db
		.select()
		.from(addressTable)
		.where(
			and(
				eq(addressTable.id, input.addressId as string),
				eq(addressTable.userId, ctx.user.id),
			),
		)
		.limit(1);

	const address = rows[0];
	// The same answer for "no such address" and "not yours"; see `orNotFound`.
	if (!address) {
		throw new ValidationError("Elige una dirección para la entrega", {
			field: "addressId",
		});
	}

	return address;
}

/**
 * A promotion, if it applies to this order right now.
 *
 * Read fresh at checkout rather than trusted from the cart: every one of these conditions
 * can change while a basket sits there, and the total the customer agreed to is the total
 * this function produces.
 *
 * The reason it refuses is a **message key** — the same `PROMOTION_ERROR_KEYS` set
 * `services/cart.ts` answers with — and not the Spanish sentence it used to be. This is the
 * one place that reason is *thrown* rather than returned as a field: placing an order is a
 * request that failed, so there is no cart to hang it on. `placeOrder` passes the key to the
 * `ValidationError`, and a client that reads `message` resolves it through its dictionary
 * before it reaches a screen.
 */
async function promotionFor(
	db: Db,
	businessId: string,
	code: string | null | undefined,
	subtotalMinor: number,
): Promise<{
	discount: Discount | null;
	error: PromotionErrorKey | null;
	promotionId: string | null;
	freeDelivery?: boolean;
}> {
	if (!code) return { discount: null, error: null, promotionId: null };

	const rows = await db
		.select()
		.from(promotionTable)
		.where(
			and(
				eq(promotionTable.businessId, businessId),
				eq(promotionTable.code, code),
			),
		)
		.limit(1);

	const promotion = rows[0];
	if (!promotion)
		return {
			discount: null,
			error: "cart.promotion.error.notFound",
			promotionId: null,
		};

	const now = Date.now();
	if (!promotion.isActive) {
		return {
			discount: null,
			error: "cart.promotion.error.inactive",
			promotionId: null,
		};
	}
	if (promotion.startsAt && promotion.startsAt.getTime() > now) {
		return {
			discount: null,
			error: "cart.promotion.error.notYetValid",
			promotionId: null,
		};
	}
	if (promotion.endsAt && promotion.endsAt.getTime() < now) {
		return {
			discount: null,
			error: "cart.promotion.error.expired",
			promotionId: null,
		};
	}
	if (
		promotion.maxRedemptions !== null &&
		promotion.redemptions >= promotion.maxRedemptions
	) {
		return {
			discount: null,
			error: "cart.promotion.error.exhausted",
			promotionId: null,
		};
	}
	if (
		promotion.minOrderMinor !== null &&
		subtotalMinor < promotion.minOrderMinor
	) {
		return {
			discount: null,
			error: "cart.promotion.error.belowMinimum",
			promotionId: null,
		};
	}

	return {
		discount: discountOf(promotion.kind, promotion.value),
		error: null,
		promotionId: promotion.id,
		freeDelivery: promotion.kind === "FREE_DELIVERY",
	};
}

/**
 * A promotion row as a `Discount`.
 *
 * `FREE_DELIVERY` takes nothing off a subtotal. The fee is a checkout concern — it depends
 * on the fulfilment mode — and the honest thing to take off the goods is nothing; the free
 * delivery is realised by the fee being zero for that kind, which is read here rather than
 * in pricing a line.
 */
function discountOf(kind: PromotionKind, value: number): Discount {
	if (kind === "PERCENT") return { kind: "PERCENT", percent: value };
	return { kind: "FIXED", valueMinor: kind === "FREE_DELIVERY" ? 0 : value };
}

// ---------------------------------------------------------------------------
// Advancing
// ---------------------------------------------------------------------------

/**
 * Move an order, as the business, the customer or an admin.
 *
 * **Not** a `businessProcedure`, and that is a deliberate divergence from
 * `api-surface.md`'s "every procedure here takes `businessId`": `advanceOrderInput`
 * carries an `orderId` and no business, and it cannot carry one — the customer's own app
 * cancels through the same shape. So the order is read first, the caller's relationship to
 * it is resolved from the row, and a caller who is neither the customer, a member of the
 * business, nor an admin gets the same `NotFoundError` a fabricated order id gets.
 *
 * `expectedStatus` is optimistic concurrency. Two staff on two phones both tapping "Listo"
 * would otherwise write two events and notify the customer twice; the second writer is
 * told the order moved under it.
 */
export async function advance(
	ctx: UserContext,
	input: AdvanceOrderInput,
): Promise<OrderDetail> {
	const order = await reachableOrder(ctx, input.orderId);
	const actor = actorFor(ctx, order);

	if (input.expectedStatus && input.expectedStatus !== order.status) {
		throw new ConflictError("El pedido cambió mientras lo mirabas", {
			currentStatus: order.status,
		});
	}

	// A courier moves only the run they carry. Without this a courier could
	// advance any order of the shop — including ones another courier is
	// already riding — because the membership check in `reachableOrder` only
	// says they belong to the business. Same `NotFoundError` as a fabricated
	// id: a courier probing other runs learns nothing about which exist.
	if (actor === "COURIER" && order.courierUserId !== ctx.user.id) {
		throw new NotFoundError("No encontramos ese pedido");
	}

	const linkedDelivery =
		order.fulfilment === "DELIVERY" &&
		(input.to === "OUT_FOR_DELIVERY" || input.to === "COMPLETED")
			? (
					await ctx.db
						.select({
							id: deliveryTable.id,
							status: deliveryTable.status,
							courierUserId: deliveryTable.courierUserId,
						})
						.from(deliveryTable)
						.where(eq(deliveryTable.orderId, order.id))
						.limit(1)
				)[0]
			: null;
	if (linkedDelivery) {
		if (actor !== "COURIER" || linkedDelivery.courierUserId !== ctx.user.id) {
			throw new ValidationError("El repartidor debe confirmar este paso");
		}
		const expectedDeliveryStatus =
			input.to === "OUT_FOR_DELIVERY" ? "AT_PICKUP" : "PICKED_UP";
		if (linkedDelivery.status !== expectedDeliveryStatus) {
			throw new ConflictError("La entrega todavía no llegó a este paso", {
				deliveryStatus: linkedDelivery.status,
			});
		}
	}

	if (
		!canTransition({
			from: order.status,
			to: input.to,
			actor,
			fulfilment: order.fulfilment,
		})
	) {
		throw new ValidationError(
			`El pedido no puede pasar de ${order.status} a ${input.to}`,
			{
				from: order.status,
				to: input.to,
			},
		);
	}

	return applyMove(ctx, order, {
		to: input.to,
		actor,
		actorUserId: ctx.user.id,
		note: input.note ?? input.reason ?? null,
		courierName: input.courierName ?? null,
		courierPhone: input.courierPhone ?? null,
	});
}

/**
 * The customer's own cancellation.
 *
 * The rule that matters is not written here: `canTransition` refuses a customer's
 * CANCELLED the moment the order is PREPARING, because past that point the food is made
 * and the money is spent. `api-surface.md` says "refused once the business has started
 * preparing", and the state machine is where that sentence is enforced.
 */
export async function cancel(
	ctx: UserContext,
	input: CancelOrderInput,
): Promise<OrderDetail> {
	const order = await reachableOrder(ctx, input.orderId);
	const actor = actorFor(ctx, order);

	if (
		!canTransition({
			from: order.status,
			to: "CANCELLED",
			actor,
			fulfilment: order.fulfilment,
		})
	) {
		throw new ValidationError("Ya no puedes cancelar este pedido", {
			status: order.status,
		});
	}

	return applyMove(ctx, order, {
		to: "CANCELLED",
		actor,
		actorUserId: ctx.user.id,
		note: input.reason ?? null,
		courierName: null,
		courierPhone: null,
	});
}

/** A ping is cheap, so the allowance is generous: one every 15 seconds is four a minute. */
const LOCATE_LIMIT = 12;
const LOCATE_WINDOW_SECONDS = 60;

/**
 * Hand a READY delivery order to one of the shop's couriers.
 *
 * MANAGER or OWNER only — handing out runs is staffing, and `staff:manage` is
 * the capability that names it, but this procedure takes an `orderId` rather
 * than a `businessId` (like `advance`, it resolves the business from the
 * row), so the role is checked here against the order's own shop instead of
 * in the middleware. A STAFF member reaches the order and is refused with
 * FORBIDDEN; a non-member gets the same `NotFoundError` as a fabricated id.
 *
 * The assignee must already be a COURIER member of the shop: an id, not a
 * typed name, because a name typed at dispatch is a different person every
 * time it is spelled differently. When the member has a courier profile, it
 * must be VERIFIED and available; legacy members without a profile remain
 * assignable until they create one. The row's name and phone are copied from
 * the member's profile at assignment — denormalised the way `actorName` is,
 * so a courier who is later removed keeps their name on the runs they rode.
 * Reassigning while still READY overwrites; once the run left, the courier is
 * history and only the machine moves it.
 */
export async function assign(
	ctx: UserContext,
	input: AssignCourierInput,
): Promise<OrderDetail> {
	const order = await reachableOrder(ctx, input.orderId);

	const membership = await ctx.db
		.select({ role: membershipTable.role })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, order.businessId),
				eq(membershipTable.userId, ctx.user.id),
			),
		)
		.limit(1);

	const role = membership[0]?.role;
	if (role !== "MANAGER" && role !== "OWNER") {
		throw new ForbiddenError("Solo un encargado puede asignar repartos");
	}

	if (order.fulfilment !== "DELIVERY") {
		throw new ValidationError("Solo los pedidos a domicilio llevan repartidor");
	}
	if (order.status !== "READY") {
		throw new ValidationError("El pedido todavía no está listo para salir", {
			status: order.status,
		});
	}

	const assignee = await ctx.db
		.select({
			id: userTable.id,
			name: userTable.name,
			phone: userTable.phone,
			role: membershipTable.role,
		})
		.from(membershipTable)
		.innerJoin(userTable, eq(membershipTable.userId, userTable.id))
		.where(
			and(
				eq(membershipTable.businessId, order.businessId),
				eq(membershipTable.userId, input.courierUserId),
			),
		)
		.limit(1);

	const courier = assignee[0];
	if (courier?.role !== "COURIER") {
		throw new ValidationError("Esa persona no es repartidora de esta tienda");
	}

	const profile = await ctx.db
		.select({
			isAvailable: courierProfileTable.isAvailable,
			verificationStatus: courierProfileTable.verificationStatus,
		})
		.from(courierProfileTable)
		.where(eq(courierProfileTable.userId, courier.id))
		.limit(1);
	if (
		profile[0] &&
		(!profile[0].isAvailable || profile[0].verificationStatus !== "VERIFIED")
	) {
		throw new ValidationError("Este repartidor no está disponible ahora mismo");
	}

	const now = new Date();
	await ctx.db.batch(
		batchOf([
			ctx.db
				.update(orderTable)
				.set({
					courierUserId: courier.id,
					courierName: courier.name,
					courierPhone: courier.phone,
					updatedAt: now,
				})
				.where(eq(orderTable.id, order.id)),
			ctx.db
				.update(deliveryTable)
				.set({
					courierUserId: courier.id,
					status: "AT_PICKUP",
					acceptedAt: now,
					startedToPickupAt: now,
					arrivedPickupAt: now,
					updatedAt: now,
				})
				.where(eq(deliveryTable.orderId, order.id)),
			ctx.db
				.update(deliveryOfferTable)
				.set({ status: "CANCELLED", respondedAt: now })
				.where(
					and(
						eq(
							deliveryOfferTable.deliveryId,
							sql`(select id from delivery where order_id = ${order.id})`,
						),
						eq(deliveryOfferTable.status, "PENDING"),
					),
				),
		]),
	);

	return detail(ctx, order.id, actorFor(ctx, order));
}

/**
 * One foreground ping from the courier carrying the order.
 *
 * Three refusals, in the order they are cheapest to state: a stranger (or a
 * courier eyeing somebody else's run) gets `NotFoundError`; a run that has
 * not left gets `ValidationError`, because a position only matters on the
 * way; and only then the rate limit, twelve a minute for a phone that pings
 * every fifteen seconds. No event row: this is not a move, and the customer's
 * tracker re-reads `track` on its own poll.
 */
export async function reportLocation(
	ctx: UserContext,
	input: ReportLocationInput,
): Promise<{ ok: true }> {
	const order = await reachableOrder(ctx, input.orderId);

	if (order.courierUserId !== ctx.user.id) {
		throw new NotFoundError("No encontramos ese pedido");
	}
	if (order.status !== "OUT_FOR_DELIVERY") {
		throw new ValidationError("La ubicación solo se comparte en camino", {
			status: order.status,
		});
	}

	await rateLimit(
		ctx.env,
		"orders:locate",
		ctx.user.id,
		LOCATE_LIMIT,
		LOCATE_WINDOW_SECONDS,
	);

	const now = new Date();
	await ctx.db
		.update(orderTable)
		.set({
			courierLat: input.lat,
			courierLng: input.lng,
			courierAt: now,
			updatedAt: now,
		})
		.where(eq(orderTable.id, order.id));

	return { ok: true };
}

/**
 * The write side of a move: the order row, the event, and the two announcements.
 *
 * All of it in one place, because the failures this prevents are a status that moved
 * without an event (a tracker that skips a step) and an event nobody was told about (a
 * customer staring at a screen that never changes).
 */
async function applyMove(
	ctx: UserContext,
	order: typeof orderTable.$inferSelect,
	move: {
		to: OrderStatus;
		actor: OrderActor;
		actorUserId: string;
		note: string | null;
		courierName: string | null;
		courierPhone: string | null;
	},
): Promise<OrderDetail> {
	const now = new Date();

	// Reserve this move's version before writing anything, as a compare-and-set.
	//
	// `version` is only worth having if it is genuinely monotonic, and a read-then-write in
	// JavaScript is not: two movers read the same number and both write the same increment,
	// so the second one's event would claim a version the first already speaks for. The CAS
	// makes exactly one caller the owner of `version + 1`, so no two events ever claim the
	// same version of one order — which is the property `aggregateVersion` exists to give a
	// projection and a stale-event check.
	//
	// The alternative — the same guard in the `where` of the update inside the batch below —
	// was rejected for a specific reason: a D1 batch is atomic, so a lost CAS would roll back
	// nothing but its own effect, and the `outbox_event` row sitting next to it would still
	// commit. That is an event about a move that never happened, carrying an `eventId` the
	// consumer has never seen, so nothing would ever drop it. Reserving here instead costs
	// one statement and makes the loser's failure total: it commits nothing at all.
	//
	// What this does **not** guarantee, spelled out because the guard reads as if it did: the
	// CAS is keyed on `version` alone and the status write is in the batch that *follows* it.
	// A mover that reads the row inside that window sees the new version with the old status,
	// so its own `expectedStatus` check passes and its CAS matches too. Two taps, two moves,
	// two events — distinct and correctly identified, so both are processed: a duplicate
	// notification, not a lost one. Closing it needs the status write and the CAS in the same
	// statement, and then the two log inserts have to be conditional on that statement
	// (`insert … select … where exists`) or the batch commits an event for a move that lost.
	// That belongs with the per-order Durable Object, which serialises one order's moves by
	// construction. Not here.
	//
	// The other cost: a batch that fails *after* this line leaves a version consumed with no
	// move to show for it. The number skips, which nothing observes — `aggregateVersion`
	// promises order, not consecutiveness — and the retry reads the row again and reserves
	// the next one.
	const reserved = await ctx.db
		.update(orderTable)
		.set({ version: sql`${orderTable.version} + 1` })
		.where(
			and(eq(orderTable.id, order.id), eq(orderTable.version, order.version)),
		)
		.returning({ version: orderTable.version });

	const version = reserved[0]?.version;
	if (version === undefined) {
		// Read the row again rather than reporting `order.status`: the caller is being told
		// its view is stale, and a stale status in that message is a message about the wrong
		// order.
		const [current] = await ctx.db
			.select({ status: orderTable.status })
			.from(orderTable)
			.where(eq(orderTable.id, order.id))
			.limit(1);
		throw new ConflictError("El pedido cambió mientras lo mirabas", {
			currentStatus: current?.status ?? order.status,
		});
	}

	const patch: Partial<typeof orderTable.$inferInsert> = {
		status: move.to,
		updatedAt: now,
	};

	// Each timestamp is set by the move that causes it and never cleared: they are the
	// record of what happened, and a later move does not un-happen an earlier one.
	if (move.to === "ACCEPTED") patch.acceptedAt = now;
	if (move.to === "READY") patch.readyAt = now;
	if (move.to === "COMPLETED") {
		patch.completedAt = now;
		// Completing a cash or SINPE order is the moment the money changes hands — nobody
		// hands over food unpaid. A payment status left UNPAID on a finished order is a
		// payout report that never reconciles. See `requiresCollection`.
		if (requiresCollection(order.paymentStatus)) patch.paymentStatus = "PAID";
	}
	if (move.to === "CANCELLED" || move.to === "REJECTED") {
		patch.cancelledAt = now;
		patch.cancelReason = move.note;
	}
	if (move.to === "OUT_FOR_DELIVERY") {
		patch.courierName = move.courierName ?? order.courierName;
		patch.courierPhone = move.courierPhone ?? order.courierPhone;
	}

	const envelope = orderEvent({
		aggregateId: order.id,
		aggregateVersion: version,
		occurredAt: now,
		payload:
			move.to === "CANCELLED"
				? {
						type: "ORDER_CANCELLED",
						orderId: order.id,
						businessId: order.businessId,
						actorId: move.actorUserId,
						reason: move.note ?? undefined,
					}
				: {
						type: "ORDER_STATUS_CHANGED",
						orderId: order.id,
						businessId: order.businessId,
						actorId: move.actorUserId,
						from: order.status,
						to: move.to,
					},
	});

	// The status, the timeline row and the event row, in one batch. That is the whole point
	// of the outbox: "the order moved" and "there is an event about it" are one write, so
	// there is no instant at which one is true and the other is not.
	const statements: BatchItem<"sqlite">[] = [
		ctx.db.update(orderTable).set(patch).where(eq(orderTable.id, order.id)),
		ctx.db.insert(orderEventTable).values({
			id: newId("orderEvent"),
			orderId: order.id,
			fromStatus: order.status,
			toStatus: move.to,
			actor: move.actor,
			// SYSTEM has no account. Every signed-in courier keeps their own id so
			// delivery metrics can attribute the action to the person who made it.
			actorUserId: move.actor === "SYSTEM" ? null : move.actorUserId,
			note: move.note,
			createdAt: now,
		}),
		ctx.db.insert(outboxTable).values(outboxRowOf(envelope, now)),
	];
	if (move.to === "OUT_FOR_DELIVERY") {
		statements.push(
			ctx.db
				.update(deliveryTable)
				.set({ status: "PICKED_UP", pickedUpAt: now, updatedAt: now })
				.where(
					and(
						eq(deliveryTable.orderId, order.id),
						eq(deliveryTable.courierUserId, move.actorUserId),
						eq(deliveryTable.status, "AT_PICKUP"),
					),
				),
		);
	}
	if (move.to === "COMPLETED") {
		statements.push(
			ctx.db
				.update(deliveryTable)
				.set({ status: "DELIVERED", deliveredAt: now, updatedAt: now })
				.where(
					and(
						eq(deliveryTable.orderId, order.id),
						eq(deliveryTable.courierUserId, move.actorUserId),
						eq(deliveryTable.status, "PICKED_UP"),
					),
				),
		);
	}
	if (move.to === "CANCELLED" || move.to === "REJECTED") {
		statements.push(
			ctx.db
				.update(deliveryTable)
				.set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
				.where(eq(deliveryTable.orderId, order.id)),
			ctx.db
				.update(deliveryOfferTable)
				.set({ status: "CANCELLED", respondedAt: now })
				.where(
					and(
						eq(
							deliveryOfferTable.deliveryId,
							sql`(select id from delivery where order_id = ${order.id})`,
						),
						eq(deliveryOfferTable.status, "PENDING"),
					),
				),
		);
	}

	await ctx.db.batch(batchOf(statements));

	await announce(ctx, envelope, move.to, now, move.note);

	return detail(ctx, order.id, move.actor);
}

/**
 * Tell the queue, and tell the order's room.
 *
 * Both are best-effort *now*, and the reason is the outbox: the caller wrote an
 * `outbox_event` row in the same batch as the move, so the event is already durable before
 * this function runs. A failure here costs a delay — the sweeper publishes what this
 * attempt missed — and never a notification. That is what makes it safe to not care
 * whether the room answered.
 *
 * The room is told second so that a Durable Object which is slow, evicted or unreachable
 * cannot delay the queue publish behind it, and it must never fail the staff member's tap.
 * It is also told nobody: the room fans out to whatever sockets are open, and no client
 * opens one — both apps and the web app poll. So the `warn` below is not a degraded
 * live-update path today, it is a request that would have gone to an empty room.
 *
 * The failure is logged by name only. There is no token, header or body in reach here, and
 * a log line is not worth acquiring one.
 */
async function announce(
	ctx: UserContext,
	envelope: OrderEventEnvelope,
	status: OrderStatus,
	at: Date,
	note: string | null,
): Promise<void> {
	await publishEvents(ctx.env, ctx.db, ctx.logger, [envelope]);

	try {
		// `env.ORDER_ROOM` is declared as the unparameterised namespace, so the stub arrives
		// without its RPC surface; the cast names the class the binding actually points at.
		const room = orderRoomFor(
			ctx.env,
			envelope.aggregateId,
		) as DurableObjectStub<OrderRoom>;
		await room.publish({
			orderId: envelope.aggregateId,
			type: envelope.eventType,
			status,
			// ISO, because this crosses a socket where a `Date` arrives as something else.
			at: at.toISOString(),
			...(note ? { note } : {}),
		});
	} catch (error) {
		ctx.logger.warn("No se pudo publicar el evento del pedido", {
			orderId: envelope.aggregateId,
			type: envelope.eventType,
			reason: error instanceof Error ? error.name : "unknown",
		});
	}
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * One order, for whoever is entitled to see it.
 *
 * The *shape* depends on who is asking: `orderSummaryOf` computes `nextStatuses` and
 * `canCancel` from the state machine for that actor, so the buttons a business sees and
 * the moves the API will accept are one fact rather than two.
 */
export async function byId(
	ctx: UserContext,
	input: { id: string },
): Promise<OrderDetail> {
	const order = await reachableOrder(ctx, input.id);
	return detail(ctx, order.id, actorFor(ctx, order));
}

/**
 * How long the kitchen needs for this order, in minutes.
 *
 * The kitchen works in parallel: the longest line sets the wait. A line whose
 * product carries no per-product value inherits the shop default, so explicit
 * values can only raise the estimate above what the shop promises, never lower
 * it. `null` when neither side has a number — the mapper falls back to
 * `DEFAULT_PREP_MINUTES` there, which is the same answer as before this rule.
 */
export function effectivePrepTimeMinutes(
	linePreps: (number | null)[],
	shopDefault: number | null,
): number | null {
	let best = shopDefault;
	for (const prep of linePreps) {
		const value = prep ?? shopDefault;
		if (value !== null && (best === null || value > best)) best = value;
	}
	return best;
}

export async function track(
	ctx: UserContext,
	input: { id: string },
): Promise<OrderTracking> {
	const order = await reachableOrder(ctx, input.id);

	const [events, business, lines] = await Promise.all([
		ctx.db
			.select()
			.from(orderEventTable)
			.where(eq(orderEventTable.orderId, order.id))
			.orderBy(asc(orderEventTable.createdAt)),
		ctx.db
			.select({ prepTimeMinutes: businessTable.prepTimeMinutes })
			.from(businessTable)
			.where(eq(businessTable.id, order.businessId))
			.limit(1),
		ctx.db
			.select({ prepTimeMinutes: productTable.prepTimeMinutes })
			.from(orderItemTable)
			.innerJoin(productTable, eq(orderItemTable.productId, productTable.id))
			.where(eq(orderItemTable.orderId, order.id)),
	]);

	return orderTrackingOf(
		order,
		events,
		effectivePrepTimeMinutes(
			lines.map((line) => line.prepTimeMinutes),
			business[0]?.prepTimeMinutes ?? null,
		),
	);
}

/**
 * Order history, from either side of the order.
 *
 * One procedure for both clients, because the two questions are the same query with a
 * different scope: a customer's own orders and a business's queue are both "orders, newest
 * first, filtered". The branch is on `role`, and the business side is checked against
 * `membership` here rather than in a middleware — `orders.list` is a `protectedProcedure`,
 * so the check has to exist, and a scope that arrives as a *parameter* is exactly the kind
 * of thing that must never be trusted.
 */
export async function list(
	ctx: UserContext,
	input: OrderListInput,
): Promise<{ items: OrderSummary[]; nextCursor: string | null }> {
	if (input.role === "BUSINESS") return queue(ctx, input);

	return pageOf(ctx, input, eq(orderTable.customerId, ctx.user.id), "CUSTOMER");
}

/** The live board, for a member of the business. */
export async function queue(
	ctx: UserContext,
	input: OrderListInput,
): Promise<{ items: OrderSummary[]; nextCursor: string | null }> {
	const businessId = input.businessId;
	if (!businessId) throw new ValidationError("Falta la tienda");

	// The check and the query are one statement's worth of truth: a non-member's
	// `businessId` matches no membership row, and the answer is the one a non-existent
	// business gets.
	const membership = await ctx.db
		.select({ role: membershipTable.role })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, ctx.user.id),
			),
		)
		.limit(1);

	orNotFound(membership[0]);
	if (input.locationId)
		await assertLocationInBusiness(ctx, businessId, input.locationId);

	// The courier's board is this flag rather than a procedure of its own: same
	// rows, same paging, one fewer name for two clients to agree on. The cast
	// is safe because every element spread in is defined — `and` only answers
	// `undefined` for an empty list, and the business half is unconditional.
	return pageOf(
		ctx,
		input,
		and(
			eq(orderTable.businessId, businessId),
			...(input.locationId
				? [eq(orderTable.locationId, input.locationId)]
				: []),
			...(input.assignedToMe
				? [eq(orderTable.courierUserId, ctx.user.id)]
				: []),
		) as SQL,
		"BUSINESS",
	);
}

async function assertLocationInBusiness(
	ctx: UserContext,
	businessId: string,
	locationId: string,
): Promise<void> {
	const ownedLocation = await ctx.db
		.select({ id: locationTable.id })
		.from(locationTable)
		.where(
			and(
				eq(locationTable.id, locationId),
				eq(locationTable.businessId, businessId),
			),
		)
		.limit(1);
	orNotFound(ownedLocation[0]);
}

/**
 * The three numbers at the top of the business's order board.
 *
 * `revenueByCurrency` groups before it sums. A business is priced in one currency today,
 * but the query reads the stored `currency` column, and a single total would become a sum
 * across currencies the day that stops being true.
 *
 * "Today" is the UTC day, matching `dayKey`, which is what every other series in this API
 * groups by. A market-local midnight would be a second definition of a day in a codebase
 * that only needs one.
 */
export async function stats(
	ctx: BusinessContext,
	input: { businessId: string; locationId?: string },
): Promise<OperationalPulse> {
	// The scope comes from the membership the middleware injected, never from the input.
	const businessId = ctx.membership.businessId;
	if (input.locationId)
		await assertLocationInBusiness(ctx, businessId, input.locationId);
	const scope = [
		eq(orderTable.businessId, businessId),
		...(input.locationId ? [eq(orderTable.locationId, input.locationId)] : []),
	];
	const now = new Date();
	const todayStart = startOfMarketDay(now);
	const business = orNotFound(
		(
			await ctx.db
				.select({ currency: businessTable.currency })
				.from(businessTable)
				.where(eq(businessTable.id, businessId))
				.limit(1)
		)[0],
	);
	const salesFor = async (from: Date, to: Date) => {
		const [row] = await ctx.db
			.select({
				grossSalesMinor: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' then ${orderTable.totalMinor} else 0 end), 0)`,
				discountsMinor: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' then ${orderTable.discountMinor} else 0 end), 0)`,
				refundsMinor: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' and ${orderTable.paymentStatus} = 'REFUNDED' then ${orderTable.totalMinor} else 0 end), 0)`,
				orderCount: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' then 1 else 0 end), 0)`,
			})
			.from(orderTable)
			.where(
				and(
					...scope,
					eq(orderTable.currency, business.currency),
					gte(orderTable.placedAt, from),
					lt(orderTable.placedAt, to),
				),
			);
		return {
			grossSalesMinor: Number(row?.grossSalesMinor ?? 0),
			discountsMinor: Number(row?.discountsMinor ?? 0),
			refundsMinor: Number(row?.refundsMinor ?? 0),
			orderCount: Number(row?.orderCount ?? 0),
		};
	};
	const previousDayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
	const previousDayEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const previousWeekStart = new Date(
		todayStart.getTime() - 7 * 24 * 60 * 60 * 1000,
	);
	const previousWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const [
		active,
		today,
		revenue,
		todayRevenue,
		current,
		previousDay,
		previousWeek,
	] = await Promise.all([
		ctx.db
			.select({ count: sql<number>`count(*)` })
			.from(orderTable)
			.where(and(...scope, inArray(orderTable.status, [...ACTIVE_STATUSES]))),
		ctx.db
			.select({ count: sql<number>`count(*)` })
			.from(orderTable)
			.where(and(...scope, gte(orderTable.placedAt, todayStart))),
		ctx.db
			.select({
				currency: orderTable.currency,
				revenueMinor: sql<number>`coalesce(sum(${orderTable.totalMinor}), 0)`,
				orderCount: sql<number>`count(*)`,
			})
			.from(orderTable)
			// Completed only: a cancelled or refused order never became revenue, and a board
			// that counts it is a board the owner stops trusting.
			.where(and(...scope, eq(orderTable.status, "COMPLETED")))
			.groupBy(orderTable.currency),
		// Today's completed revenue, for the merchant home's pulse band: the same
		// COMPLETED-only meaning as the all-time query below, scoped to the market day
		// `today` above is counted against. A client-side sum over a listed page is
		// not this — a page is not the day, and the day is not a page.
		ctx.db
			.select({
				currency: orderTable.currency,
				revenueMinor: sql<number>`coalesce(sum(${orderTable.totalMinor}), 0)`,
				orderCount: sql<number>`count(*)`,
			})
			.from(orderTable)
			.where(
				and(
					...scope,
					eq(orderTable.status, "COMPLETED"),
					gte(orderTable.placedAt, todayStart),
				),
			)
			.groupBy(orderTable.currency),
		salesFor(todayStart, now),
		salesFor(previousDayStart, previousDayEnd),
		salesFor(previousWeekStart, previousWeekEnd),
	]);

	const grossSalesMinor = current.grossSalesMinor;
	const discountsMinor = current.discountsMinor;
	const refundsMinor = current.refundsMinor;
	const orderCount = current.orderCount;
	const merchantNetSalesMinor = Math.max(0, grossSalesMinor - refundsMinor);
	const previousDayNet = Math.max(
		0,
		previousDay.grossSalesMinor - previousDay.refundsMinor,
	);
	const previousWeekNet = Math.max(
		0,
		previousWeek.grossSalesMinor - previousWeek.refundsMinor,
	);

	return {
		active: Number(active[0]?.count ?? 0),
		today: Number(today[0]?.count ?? 0),
		revenueByCurrency: revenue.map((row) => ({
			currency: row.currency,
			revenueMinor: Number(row.revenueMinor),
			orderCount: Number(row.orderCount),
		})),
		todayRevenueByCurrency: todayRevenue.map((row) => ({
			currency: row.currency,
			revenueMinor: Number(row.revenueMinor),
			orderCount: Number(row.orderCount),
		})),
		period: {
			from: todayStart,
			to: now,
			timezone: MARKET_TIME_ZONE,
		},
		grossSalesMinor,
		discountsMinor,
		refundsMinor,
		merchantNetSalesMinor,
		orderCount,
		averageOrderValueMinor:
			orderCount > 0 ? Math.round(grossSalesMinor / orderCount) : 0,
		currency: business.currency,
		comparisons: [
			{
				period: "previous_day",
				salesDeltaMinor: merchantNetSalesMinor - previousDayNet,
				orderDelta: orderCount - previousDay.orderCount,
			},
			{
				period: "previous_week",
				salesDeltaMinor: merchantNetSalesMinor - previousWeekNet,
				orderDelta: orderCount - previousWeek.orderCount,
			},
		],
	};
}

/**
 * The home screen's "Order again" shelf: what the caller has bought before, as cards.
 *
 * The reason it is a procedure and not a client-side stitch: `orders.list` answers with
 * `OrderSummary` - a headline and a total, and no per-product rows - and an order's
 * snapshot lines are deliberately not a catalogue (invariant 2 in `docs/domain.md`).
 * These cards come from the live `product` and `business` rows, through the same
 * `productCardOf` every other card uses, so the shelf shows what is on sale today rather
 * than what was on sale when the order was placed.
 *
 * Four decisions, each one a bug it prevents:
 *
 * - **The caller's own purchases, and only ever that.** `customerId` is in the `where`
 *   clause, exactly as `reorder` scopes itself: a shop's staff and an admin see their own
 *   purchases and nobody else's, at any privilege. There is no cross-customer shelf to
 *   allow, so there is no `userId` on the input to allow it with.
 * - **An order that bought nothing contributes nothing.** `PURCHASED_STATUSES` drops
 *   `CANCELLED` and `REJECTED` - a cancelled order is not a purchase, and a shelf built
 *   from one advertises products the customer walked away from.
 * - **One card per product, at the position of its most recent purchase.** Bought twice,
 *   shown once: `max(order.placedAt)` per product is both the dedupe and the ordering,
 *   and doing it any other way is a shelf where yesterday's purchase outranks today's.
 * - **Only what can still be bought.** `status = 'ACTIVE'`, `archivedAt` null, and
 *   `publicBusiness()` - the same three conditions every public read of a product
 *   carries (`helpers.ts`: "both must be filtered the same way in every public read"), so
 *   `Frutería La Cosecha` - `SUSPENDED` in the seed - drops off the shelf the moment the
 *   platform closes the shop. A card that cannot be tapped is the bug that filter is for.
 *
 * Two reads and no third. The first decides *which* products and in what order - the
 * distinct product ids of the caller's qualifying lines, deduplicated and ordered by SQL,
 * with every visibility condition in its `where` so the `limit` caps cards rather than
 * candidates. The second loads the `product` + `business` rows for those ids alone; its
 * row order is whatever SQLite returns, so the map puts the rows back in the order the
 * first query decided. One `now` for the whole response - the badges ("Nuevo") compare
 * against it, and a clock read per card is a shelf that contradicts itself across rows.
 */
export async function purchasedProducts(
	ctx: UserContext,
	input: { limit: number },
): Promise<ProductCard[]> {
	const candidates = await ctx.db
		.select({ productId: orderItemTable.productId })
		.from(orderItemTable)
		.innerJoin(orderTable, eq(orderItemTable.orderId, orderTable.id))
		// The join is also the null check: a line whose `productId` has no product row
		// behind it - a snapshot that outlived what the shelf can show - matches nothing
		// here and is skipped rather than mapped.
		.innerJoin(productTable, eq(orderItemTable.productId, productTable.id))
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.where(
			and(
				eq(orderTable.customerId, ctx.user.id),
				inArray(orderTable.status, [...PURCHASED_STATUSES]),
				eq(productTable.status, "ACTIVE"),
				isNull(productTable.archivedAt),
				publicBusiness(),
			),
		)
		.groupBy(orderItemTable.productId)
		// Newest purchase first, ties broken on the product id so the shelf is the same
		// shelf between two reads of the same rows (same rule as `ranking.ts`: a list that
		// reshuffles cannot be trusted to be the same place).
		.orderBy(
			desc(sql`max(${orderTable.placedAt})`),
			asc(orderItemTable.productId),
		)
		.limit(input.limit);

	const ids = candidates.map((row) => row.productId);
	if (ids.length === 0) return [];

	const rows = await ctx.db
		.select({ product: productTable, business: businessTable })
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.where(inArray(productTable.id, ids));

	const rowOf = new Map(rows.map((row) => [row.product.id, row]));
	const now = new Date();

	return ids.flatMap((id) => {
		const row = rowOf.get(id);
		return row ? [productCardOf(row.product, row.business, { now })] : [];
	});
}

// ---------------------------------------------------------------------------
// Reordering
// ---------------------------------------------------------------------------

/**
 * Put an old order's lines back in the caller's cart.
 *
 * Three decisions shape this function, and each one is a bug it exists to not have:
 *
 * - **The order must be the caller's own, as the customer.** The `where` clause is
 *   `id` *and* `customerId`, so the lookup and the ownership check are one statement:
 *   a member of the fulfilling business, an admin, and a stranger holding a real order
 *   id all get the same `NotFoundError` a fabricated id gets. A shop's staff must not be
 *   able to fill a stranger's basket, and "it is the same row you can already read" is
 *   not an argument for letting them.
 * - **It rebuilds through `cart.addItem`, the only function that writes cart lines.**
 *   Not through inserts of our own: that function owns the business-conflict rule, the
 *   live-price read and the `(cartId, productId, optionsHash)` upsert, and a second
 *   implementation of any of those is a second answer to "what does this line cost".
 * - **A line that cannot come back is skipped and reported, never fatal.** A shop that
 *   renamed an option, or took a product down, would otherwise make yesterday's order
 *   permanently unbuyable — the customer would get a refusal and no other information,
 *   with no way to see which of their five lines was the problem.
 *
 * The two failure kinds are told apart **by error class, never by the message string**:
 * `readBuyableProduct` answers a product that is missing, not `ACTIVE` or archived with
 * a `NotFoundError`, and `chosenOptionsOf` answers options that no longer exist with a
 * `ValidationError`. Reading those sentences to classify them would break the day
 * somebody rewords one. A `ConflictError` is deliberately *not* caught: it is the
 * "your cart is from another shop" case, which the client answers with a sheet, and
 * swallowing it per line would turn a decision into a silent partial reorder.
 *
 * Nothing here is idempotent — a second call adds the quantities again, exactly as a
 * second `cart.addItem` would — so the screen disables its button while this is in
 * flight. That is a client concern and not something a key on the input could fix.
 */
export async function reorder(
	ctx: UserContext,
	input: ReorderOrderInput,
): Promise<ReorderResult> {
	const order = orNotFound(
		(
			await ctx.db
				.select()
				.from(orderTable)
				.where(
					and(
						eq(orderTable.id, input.orderId),
						eq(orderTable.customerId, ctx.user.id),
					),
				)
				.limit(1)
		)[0],
	);

	// Before any write, and that ordering is the point: a suspended or deleted shop must
	// not leave a cart behind. `cart.addItem` would refuse the first line anyway — same
	// check, same `isPublicBusiness` — but by then the cart may already exist from an
	// earlier line, or the client would get a bare "not found" about a *product* when the
	// truth is about the shop. A cart pointing at a shop nobody can buy from is an orphan,
	// and this is the one refusal in the function, so it is the one place a key is needed.
	const shop = await ctx.db
		.select({ status: businessTable.status })
		.from(businessTable)
		.where(eq(businessTable.id, order.businessId))
		.limit(1);

	if (!shop[0] || !isPublicBusiness(shop[0].status)) {
		throw new ValidationError(REORDER_ERROR_KEYS[0]);
	}

	const lines = await ctx.db
		.select({
			productId: orderItemTable.productId,
			name: orderItemTable.nameSnapshot,
			quantity: orderItemTable.quantity,
			options: orderItemTable.options,
		})
		.from(orderItemTable)
		.where(eq(orderItemTable.orderId, order.id))
		// The order's own order. Ids are time-ordered, so this is the sequence the customer
		// saw at checkout, and it is what makes "which line got skipped" reproducible when
		// the basket has no room for all of them.
		.orderBy(asc(orderItemTable.id));

	// The room left in the basket, measured before the loop instead of discovered by it.
	//
	// `cart.addItem` throws "Tu carrito está lleno" at `MAX_CART_LINES`, and that throw
	// would land in the classifier below, where the only `ValidationError` left is the
	// options one — so a full basket would be reported as five lines with broken options.
	// Counting first is what keeps that impossible: a line that *merges* into one already
	// there costs no slot (the key below is the same `(productId, optionsHash)` the unique
	// index is built on), and a line that would open a slot at the cap is skipped with the
	// reason that is actually true.
	//
	// The basket is only counted when it is at *this* shop: at another one, `replace`
	// abandons it and `reject` refuses the first line, so either way the reorder starts
	// from an empty cart and starts counting at zero. `optionsHash` reads only the option
	// ids, so the key can be built from the order's own snapshot without a second read.
	const open = await openCartOf(ctx.db, ctx.user.id);
	const held = new Set<string>();
	let lineCount = 0;

	if (open?.businessId === order.businessId) {
		const rows = await ctx.db
			.select({
				productId: cartItemTable.productId,
				optionsHash: cartItemTable.optionsHash,
			})
			.from(cartItemTable)
			.where(eq(cartItemTable.cartId, open.id));

		for (const row of rows) {
			held.add(`${row.productId}:${row.optionsHash}`);
			lineCount += 1;
		}
	}

	const skipped: ReorderSkippedLine[] = [];
	let rebuilt: Cart | undefined;
	let addedCount = 0;
	let replaced = false;

	for (const line of lines) {
		// The snapshot's own choices, hashed as they are: `optionsHash` reads the option ids
		// only, so this is the same fingerprint the basket's stored line carries and no read
		// of the option rows is needed to compare them.
		const chosen = line.options ?? [];
		const key = `${line.productId}:${optionsHash(chosen)}`;

		if (!held.has(key) && lineCount >= MAX_CART_LINES) {
			skipped.push(skippedLineOf(line, "order.reorder.skipped.cartFull"));
			continue;
		}

		try {
			rebuilt = await cartService.addItem(ctx, {
				productId: line.productId,
				// Clamped rather than refused, at both ends. `addToCartInput` already bounds a
				// quantity to `1..MAX_LINE_QUANTITY`, so this is a no-op for every order this
				// API wrote — it is here because `addItem` is called as a function here and not
				// through that schema, so a row written by a migration or a hand-run script is
				// otherwise the one input that reaches a cart line without zod seeing it.
				quantity: Math.min(Math.max(line.quantity, 1), MAX_LINE_QUANTITY),
				optionIds: chosen.map((option) => option.optionId),
				onBusinessConflict: input.onBusinessConflict,
			});
		} catch (error) {
			const reason = skipReasonOf(error);
			// Anything else — the conflict, a rate limit, a genuine fault — is the caller's
			// to see. A reorder that half-succeeded and reported nothing would be worse than
			// one that stopped.
			if (!reason) throw error;
			skipped.push(skippedLineOf(line, reason));
			continue;
		}

		addedCount += 1;
		// Only the replacing call reports it, and only one line can be the replacing one —
		// which is why the flag is carried out of the loop instead of read off the last
		// cart. The returned cart is the last successful one, so the earlier `true` would
		// otherwise be lost and the "your basket was replaced" notice never shown.
		replaced = replaced || rebuilt.replacedCart;

		if (!held.has(key)) {
			held.add(key);
			lineCount += 1;
		}
	}

	// Every line skipped means `addItem` was never called, and there is no cart in hand:
	// read the caller's own rather than answering `null`, because `cartSchema` says a cart
	// is never null and the screen has one shape to render.
	const cart = rebuilt
		? { ...rebuilt, replacedCart: replaced }
		: await cartService.get(ctx);

	return { cart, addedCount, skipped };
}

/** One skipped line, named from the order's snapshot — the product row is what may be gone. */
function skippedLineOf(
	line: { productId: string; name: string; quantity: number },
	reason: ReorderSkipReason,
): ReorderSkippedLine {
	return {
		productId: line.productId,
		name: line.name,
		quantity: line.quantity,
		reason,
	};
}

/**
 * Whether this refusal is a fact about one line, and which.
 *
 * By class and not by text — see `reorder`'s docblock. `null` means "not a line's
 * problem", and the caller rethrows.
 */
function skipReasonOf(error: unknown): ReorderSkipReason | null {
	if (error instanceof NotFoundError)
		return "order.reorder.skipped.productUnavailable";
	if (error instanceof ValidationError)
		return "order.reorder.skipped.optionsUnavailable";
	return null;
}

/** The shared body of the customer list and the business queue. */
async function pageOf(
	ctx: UserContext,
	input: OrderListInput,
	scope: SQL,
	actor: OrderActor,
): Promise<{ items: OrderSummary[]; nextCursor: string | null }> {
	const after = decodeCursor<{ v: number; id: string }>(input.cursor);
	const ascending = input.sortDirection === "asc";
	const direction = ascending ? asc : desc;
	// Two sort keys, and both are integers on the row — a timestamp in milliseconds, money
	// in minor units — so the cursor carries a number and the boundary is raw SQL rather
	// than a typed `gt`/`lt` whose column type differs per key.
	const column =
		input.sort === "total" ? orderTable.totalMinor : orderTable.placedAt;

	const conditions: (SQL | undefined)[] = [scope];

	if (input.status && input.status.length > 0) {
		conditions.push(inArray(orderTable.status, [...input.status]));
	}
	if (input.activeOnly) {
		conditions.push(inArray(orderTable.status, [...ACTIVE_STATUSES]));
	}
	if (input.from) conditions.push(gte(orderTable.placedAt, input.from));
	if (input.to) conditions.push(lte(orderTable.placedAt, input.to));

	if (input.search) {
		// `like` is typed as possibly undefined by drizzle's overloads; a condition that
		// came back undefined is simply not one.
		conditions.push(like(orderTable.reference, likePattern(input.search)));
	}

	if (after) {
		// A tuple, not a single value: without the id half the page boundary is not total,
		// and two orders placed in the same millisecond are either both served on one page
		// and neither on the next, or served twice.
		const operator = sql.raw(ascending ? ">" : "<");
		conditions.push(
			sql`(${column} ${operator} ${after.v} or (${column} = ${after.v} and ${orderTable.id} > ${after.id}))`,
		);
	}

	const rows = await ctx.db
		.select({ order: orderTable })
		.from(orderTable)
		.where(and(...conditions))
		.orderBy(direction(column), asc(orderTable.id))
		// One extra row, read to answer "is there another page" without a second query.
		.limit(input.limit + 1);

	const hasMore = rows.length > input.limit;
	const page = hasMore ? rows.slice(0, input.limit) : rows;

	const items = await summariesOf(
		ctx.db,
		page.map((row) => row.order),
		actor,
	);
	const last = page[page.length - 1];

	return {
		items,
		nextCursor:
			hasMore && last
				? encodeCursor({
						v:
							input.sort === "total"
								? last.order.totalMinor
								: last.order.placedAt.getTime(),
						id: last.order.id,
					})
				: null,
	};
}

/**
 * The list shape for a page of orders: one query for the lines and one for the businesses,
 * rather than two per row.
 */
async function summariesOf(
	db: Db,
	orders: (typeof orderTable.$inferSelect)[],
	actor: OrderActor,
): Promise<OrderSummary[]> {
	if (orders.length === 0) return [];

	const ids = orders.map((order) => order.id);

	const [items, businesses] = await Promise.all([
		db
			.select({
				orderId: orderItemTable.orderId,
				productId: orderItemTable.productId,
				nameSnapshot: orderItemTable.nameSnapshot,
				quantity: orderItemTable.quantity,
			})
			.from(orderItemTable)
			.where(inArray(orderItemTable.orderId, ids)),
		db
			.select({
				id: businessTable.id,
				prepTimeMinutes: businessTable.prepTimeMinutes,
			})
			.from(businessTable)
			.where(
				inArray(businessTable.id, [
					...new Set(orders.map((order) => order.businessId)),
				]),
			),
	]);

	const productIds = [...new Set(items.map((item) => item.productId))];
	// A product deleted after the order still leaves the order readable: a line
	// whose product is gone inherits the shop default like a line with no value.
	const linePreps =
		productIds.length > 0
			? await db
					.select({
						id: productTable.id,
						prepTimeMinutes: productTable.prepTimeMinutes,
					})
					.from(productTable)
					.where(inArray(productTable.id, productIds))
			: [];
	const prepByProduct = new Map(
		linePreps.map((row) => [row.id, row.prepTimeMinutes]),
	);

	const prepTimeOf = new Map(
		businesses.map((row) => [row.id, row.prepTimeMinutes]),
	);

	return orders.map((order) => {
		const shopDefault = prepTimeOf.get(order.businessId) ?? null;
		const lines = items.filter((item) => item.orderId === order.id);
		return orderSummaryOf({
			order,
			items: lines,
			actor,
			prepTimeMinutes: effectivePrepTimeMinutes(
				lines.map((item) => prepByProduct.get(item.productId) ?? null),
				shopDefault,
			),
		});
	});
}

/**
 * The full detail, assembled from the pieces `orderDetailOf` expects.
 *
 * The review is read here too: the customer's own rating of a finished order belongs on
 * the order, and a second call to fetch it is a second spinner on the screen that most
 * needs to be one screen.
 */
async function detail(
	ctx: UserContext,
	orderId: string,
	actor: OrderActor,
): Promise<OrderDetail> {
	const [orderRows, items, events, review] = await Promise.all([
		ctx.db.select().from(orderTable).where(eq(orderTable.id, orderId)).limit(1),
		ctx.db
			.select()
			.from(orderItemTable)
			.where(eq(orderItemTable.orderId, orderId))
			.orderBy(asc(orderItemTable.id)),
		ctx.db
			.select()
			.from(orderEventTable)
			.where(eq(orderEventTable.orderId, orderId))
			.orderBy(asc(orderEventTable.createdAt)),
		ctx.db
			.select()
			.from(reviewTable)
			.where(eq(reviewTable.orderId, orderId))
			.limit(1),
	]);

	const row = orNotFound(orderRows[0]);
	const actorIds = [
		...new Set(
			events
				.map((event) => event.actorUserId)
				.filter((id): id is string => typeof id === "string"),
		),
	];

	const [business, customer, address, staff] = await Promise.all([
		ctx.db
			.select()
			.from(businessTable)
			.where(eq(businessTable.id, row.businessId))
			.limit(1),
		ctx.db
			.select()
			.from(userTable)
			.where(eq(userTable.id, row.customerId))
			.limit(1),
		row.addressId
			? ctx.db
					.select()
					.from(addressTable)
					.where(eq(addressTable.id, row.addressId))
					.limit(1)
			: Promise.resolve([]),
		// The names on the events, in one read. A member who leaves keeps their name on the
		// events they wrote, which is why `orderDetailOf` takes it denormalised.
		actorIds.length > 0
			? ctx.db
					.select({ id: userTable.id, name: userTable.name })
					.from(userTable)
					.where(inArray(userTable.id, actorIds))
			: Promise.resolve([]),
	]);

	const nameOf = new Map(staff.map((user) => [user.id, user.name]));

	return orderDetailOf({
		order: row,
		items,
		business: orNotFound(business[0]),
		customer: {
			id: row.customerId,
			name: customer[0]?.name ?? "Cliente",
			phone: customer[0]?.phone ?? null,
		},
		deliveryAddress: address[0] ?? null,
		events: events.map((event) => ({
			row: event,
			actorName: event.actorUserId
				? (nameOf.get(event.actorUserId) ?? null)
				: null,
		})),
		review: review[0] ?? null,
		actor,
	});
}

// ---------------------------------------------------------------------------
// Who may see what
// ---------------------------------------------------------------------------

/**
 * One order, if the caller has any business knowing about it.
 *
 * Three ways to be entitled and no fourth: the customer who placed it, a member of the
 * business fulfilling it, or a platform admin. Everything else — including a signed-in
 * stranger holding a real order id — gets the same `NotFoundError`, so the endpoint cannot
 * be used to learn which order ids exist.
 */
async function reachableOrder(
	ctx: UserContext,
	orderId: string,
): Promise<typeof orderTable.$inferSelect> {
	const rows = await ctx.db
		.select()
		.from(orderTable)
		.where(eq(orderTable.id, orderId))
		.limit(1);

	const order = orNotFound(rows[0]);

	if (order.customerId === ctx.user.id) return order;
	if (ctx.user.isAdmin) return order;

	const membership = await ctx.db
		.select({ role: membershipTable.role })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, order.businessId),
				eq(membershipTable.userId, ctx.user.id),
			),
		)
		.limit(1);

	// The same error whether the caller is nobody or the row is nothing.
	orNotFound(membership[0]);

	return order;
}

/** Which side of the order the caller is on. The state machine answers per actor. */
function actorFor(
	ctx: UserContext,
	order: typeof orderTable.$inferSelect,
): OrderActor {
	if (order.customerId === ctx.user.id) return "CUSTOMER";
	// Admin before membership: a platform operator who happens to own a shop must not be
	// quietly downgraded to BUSINESS on an order they are investigating.
	if (ctx.user.isAdmin) return "ADMIN";
	// A courier is a member with the COURIER role, and the machine has moves only
	// they can make (READY → OUT_FOR_DELIVERY → COMPLETED on a delivery). Any
	// other role stays BUSINESS, exactly as before this role existed.
	const membership = ctx.memberships.find(
		(entry) => entry.businessId === order.businessId,
	);
	if (membership?.role === "COURIER") return "COURIER";
	return "BUSINESS";
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function openCartOf(
	db: Db,
	userId: string,
): Promise<typeof cartTable.$inferSelect | undefined> {
	const rows = await db
		.select()
		.from(cartTable)
		.where(
			and(eq(cartTable.userId, userId), eq(cartTable.status, OPEN_CART_STATUS)),
		)
		.limit(1);
	return rows[0];
}
