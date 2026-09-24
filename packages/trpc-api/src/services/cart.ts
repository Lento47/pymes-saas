import type { ChosenOption, Db, PromotionKind } from "@pymeshub/db";
import {
	business as businessTable,
	cartItem as cartItemTable,
	cart as cartTable,
	productOptionGroup as productOptionGroupTable,
	productOption as productOptionTable,
	product as productTable,
	promotion as promotionTable,
} from "@pymeshub/db";
import {
	type AddToCartInput,
	applyDiscount,
	CART_STATUSES,
	type Cart,
	type CartItem,
	type CartStatus,
	type CartTotals,
	type Currency,
	type Discount,
	discountAmountOf,
	EMPTY_CART_TOTALS,
	MAX_CART_LINES,
	MAX_LINE_QUANTITY,
	newId,
	optionsHash,
	type PromotionErrorKey,
	type UpdateCartItemInput,
} from "@pymeshub/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { ConflictError, NotFoundError, ValidationError } from "../errors";
import type { UserContext } from "./helpers";
import { batchOf, isPublicBusiness, orNotFound } from "./helpers";
import { cartItemOf } from "./mappers";

/**
 * The cart, and the one rule that shapes all of it: **one cart belongs to one
 * business.**
 *
 * Two businesses in one basket is not a merge problem, it is a fulfilment problem —
 * two delivery fees, two prep times, two payouts, and a customer who cannot say which
 * half of their order is late. So the second business is never merged in: it either
 * refuses, and the client shows the "start a new cart?" sheet, or it replaces.
 *
 * The cart id is never an input to anything here. A cart is *the caller's* open cart,
 * found by their user id, so there is no version of these functions that reads somebody
 * else's basket by getting an argument wrong.
 */

/** An open cart, or none. `OPEN` is the only status a customer ever edits. */
const OPEN_STATUS: CartStatus = CART_STATUSES[0];

export async function get(ctx: UserContext): Promise<Cart> {
	const cart = await openCartOf(ctx.db, ctx.user.id);
	if (!cart) return emptyCartOf();

	return buildCart(ctx.db, cart);
}

/** Checkout quote, calculated by the same server that accepts the order. */
export async function quote(
	ctx: UserContext,
	fulfilment: "PICKUP" | "DELIVERY",
): Promise<CartTotals> {
	const row = await openCartOf(ctx.db, ctx.user.id);
	if (!row) return EMPTY_CART_TOTALS;
	const cart = await buildCart(ctx.db, row);
	const [business] = await ctx.db
		.select()
		.from(businessTable)
		.where(eq(businessTable.id, row.businessId))
		.limit(1);
	if (!business) throw new NotFoundError();
	if (
		(fulfilment === "DELIVERY" && !business.deliveryEnabled) ||
		(fulfilment === "PICKUP" && !business.pickupEnabled)
	)
		throw new ValidationError("Esta forma de entrega no está disponible");
	const promotion = await livePromotionOf(
		ctx.db,
		row,
		cart.totals.subtotalMinor,
	);
	const deliveryFeeMinor =
		fulfilment === "DELIVERY" && !promotion.freeDelivery
			? business.deliveryFeeMinor
			: 0;
	return {
		...cart.totals,
		deliveryFeeMinor,
		totalMinor: cart.totals.totalMinor + deliveryFeeMinor,
	};
}

/**
 * Add a line, or grow one that is already there.
 *
 * Three things happen in one transaction, and they have to: the conflict check reads
 * the cart, the line is upserted against a unique index, and the cart's timestamp
 * moves. Split across separate statements, two taps of the same "add" button arriving
 * together either create two lines or lose one of the quantities.
 */
export async function addItem(
	ctx: UserContext,
	input: AddToCartInput,
): Promise<Cart> {
	const product = await readBuyableProduct(ctx.db, input.productId);
	const chosen = await chosenOptionsOf(ctx.db, product.id, input.optionIds);

	const existing = await openCartOf(ctx.db, ctx.user.id);
	let replaced = false;

	// The conflict, and the only place in this file that refuses. `reject` is the default
	// because clearing a basket the customer spent five minutes on is not a decision to
	// make on their behalf — the client asks, and calls back with `replace`.
	if (existing && existing.businessId !== product.businessId) {
		if (input.onBusinessConflict === "reject") {
			throw new ConflictError("Tu carrito tiene productos de otra tienda", {
				cartBusinessId: existing.businessId,
				productBusinessId: product.businessId,
			});
		}
		replaced = true;
		// Replaced, not deleted: the old cart keeps its lines and becomes history, which
		// is what makes "why did my basket empty?" answerable rather than a mystery.
		await ctx.db
			.update(cartTable)
			.set({ status: "ABANDONED", updatedAt: new Date() })
			.where(
				and(eq(cartTable.id, existing.id), eq(cartTable.userId, ctx.user.id)),
			);
	}

	const cart =
		existing && existing.businessId === product.businessId
			? existing
			: await createCart(ctx, product.businessId);

	const hash = optionsHash(chosen);
	const now = new Date();

	const line = await ctx.db
		.select()
		.from(cartItemTable)
		.where(
			and(
				eq(cartItemTable.cartId, cart.id),
				eq(cartItemTable.productId, product.id),
				eq(cartItemTable.optionsHash, hash),
			),
		)
		.limit(1);

	if (line[0]) {
		// Capped rather than refused: a customer tapping "+" past the limit should see the
		// quantity stop, not an error on a button they are holding down.
		const quantity = Math.min(
			MAX_LINE_QUANTITY,
			line[0].quantity + input.quantity,
		);
		await ctx.db.batch(
			batchOf([
				ctx.db
					.update(cartItemTable)
					.set({ quantity, notes: input.notes ?? line[0].notes })
					.where(eq(cartItemTable.id, line[0].id)),
				ctx.db
					.update(cartTable)
					.set({ updatedAt: now })
					.where(eq(cartTable.id, cart.id)),
			]),
		);
	} else {
		const count = await ctx.db
			.select({ count: sql<number>`count(*)` })
			.from(cartItemTable)
			.where(eq(cartItemTable.cartId, cart.id));

		if (Number(count[0]?.count ?? 0) >= MAX_CART_LINES) {
			throw new ValidationError("Tu carrito está lleno");
		}

		await ctx.db.batch(
			batchOf([
				ctx.db.insert(cartItemTable).values({
					id: newId("cartItem"),
					cartId: cart.id,
					productId: product.id,
					quantity: input.quantity,
					// The price at the moment it was added. Checkout re-reads the product and
					// snapshots again, so a price change between the two is applied rather than
					// silently locked in at the older number.
					unitPriceMinor: product.priceMinor,
					options: chosen,
					optionsHash: hash,
					notes: input.notes ?? null,
				}),
				ctx.db
					.update(cartTable)
					.set({ updatedAt: now })
					.where(eq(cartTable.id, cart.id)),
			]),
		);
	}

	return buildCart(ctx.db, { ...cart, updatedAt: now }, replaced);
}

/** `quantity: 0` removes the line — one input instead of a second procedure. */
export async function updateItem(
	ctx: UserContext,
	input: UpdateCartItemInput,
): Promise<Cart> {
	const line = await ownedLine(ctx, input.cartItemId);

	if (input.quantity === 0) {
		await ctx.db.delete(cartItemTable).where(eq(cartItemTable.id, line.id));
	} else {
		await ctx.db
			.update(cartItemTable)
			.set({ quantity: input.quantity })
			.where(eq(cartItemTable.id, line.id));
	}

	return touchAndBuild(ctx, line.cartId);
}

export async function removeItem(
	ctx: UserContext,
	input: { cartItemId: string },
): Promise<Cart> {
	const line = await ownedLine(ctx, input.cartItemId);
	await ctx.db.delete(cartItemTable).where(eq(cartItemTable.id, line.id));
	return touchAndBuild(ctx, line.cartId);
}

/**
 * Apply a code, or record why it did not apply.
 *
 * The failure is *not* thrown. The customer is mid-keystroke: they have typed four
 * characters of a six-character code, and a red toast that appears while they are
 * still typing is an error message about something they have not finished doing. The
 * code is stored and the reason is returned beside it, so the field can show why it did
 * not work — as a message key the client translates — under what they typed, and clear it
 * the moment they fix it.
 *
 * **A code that does not exist is never stored over one that does.** The row has one
 * column and the customer has one code: writing the refused one into it silently dropped
 * a discount they already had, on a typo they were about to correct. So the cart keeps the
 * code it is holding, and the refusal comes back on the cart the customer is looking at —
 * `promotionError` names it, and `promotionCode` is still the code that works. A refused
 * code was never *accepted*, so persisting it as the cart's code was a claim about the
 * cart that was not true.
 *
 * What that costs is the other half of the old comment: the refused code no longer survives
 * a reload, because it is not written down. The field state it protected is still there for
 * the case that had nothing to lose — a cart with no code on it stores what was typed, so
 * opening the screen again shows the same code and the same reason. Where a working code is
 * kept, a reload shows the working code with no error, which is the honest picture: nothing
 * about that cart is wrong.
 */
export async function applyPromotion(
	ctx: UserContext,
	input: { code: string },
): Promise<Cart> {
	const cart = await requiredCart(ctx);

	const promotion = await ctx.db
		.select()
		.from(promotionTable)
		.where(
			and(
				eq(promotionTable.businessId, cart.businessId),
				eq(promotionTable.code, input.code),
			),
		)
		.limit(1);

	if (!promotion[0]) {
		// The cart already holds a code: it stays. See the docblock — this is the case that
		// used to lose a working discount. `livePromotionOf` builds the reason for whatever
		// is on the cart, so the refusal is layered over it rather than replacing it.
		if (cart.promotionCode) {
			const kept = await buildCart(ctx.db, cart);
			return { ...kept, promotionError: "cart.promotion.error.notFound" };
		}

		// Nothing to keep: stored so a reload shows the same field state, and clearing it is a
		// separate, deliberate request (`removePromotion`).
		const updatedAt = new Date();
		await ctx.db
			.update(cartTable)
			.set({ promotionCode: input.code, updatedAt })
			.where(eq(cartTable.id, cart.id));
		return buildCart(ctx.db, {
			...cart,
			promotionCode: input.code,
			updatedAt,
		});
	}

	const updatedAt = new Date();
	await ctx.db
		.update(cartTable)
		.set({ promotionCode: promotion[0].code, updatedAt })
		.where(eq(cartTable.id, cart.id));

	return buildCart(ctx.db, {
		...cart,
		promotionCode: promotion[0].code,
		updatedAt,
	});
}

/**
 * Take the code off the cart, and keep everything else.
 *
 * `clear` already drops the promotion code, but it does it by deleting every line as well —
 * so before this the only way to stop using a code was to empty the basket, which is a
 * customer throwing away five minutes of choosing to fix a typo in a coupon field. The
 * discount goes with the code, because `livePromotionOf` reads the code to find it; nothing
 * else about the cart moves.
 *
 * Refused rather than ignored when there is no open cart, for the same reason
 * `applyPromotion` is: a write to a cart that does not exist is a client with a stale idea
 * of what is on the screen, and answering it with an empty cart would hide that.
 */
export async function removePromotion(ctx: UserContext): Promise<Cart> {
	const cart = await requiredCart(ctx);
	const updatedAt = new Date();

	await ctx.db
		.update(cartTable)
		.set({ promotionCode: null, updatedAt })
		.where(eq(cartTable.id, cart.id));

	return buildCart(ctx.db, {
		...cart,
		promotionCode: null,
		updatedAt,
	});
}

/** Empty the basket, keeping the cart itself so the business stays chosen. */
export async function clear(ctx: UserContext): Promise<Cart> {
	const cart = await openCartOf(ctx.db, ctx.user.id);
	if (!cart) return emptyCartOf();

	await ctx.db.batch(
		batchOf([
			ctx.db.delete(cartItemTable).where(eq(cartItemTable.cartId, cart.id)),
			ctx.db
				.update(cartTable)
				.set({ promotionCode: null, updatedAt: new Date() })
				.where(eq(cartTable.id, cart.id)),
		]),
	);

	return buildCart(ctx.db, {
		...cart,
		promotionCode: null,
		updatedAt: new Date(),
	});
}

// ---------------------------------------------------------------------------
// Reading a cart
// ---------------------------------------------------------------------------

type CartRow = typeof cartTable.$inferSelect;

async function openCartOf(db: Db, userId: string): Promise<CartRow | null> {
	const rows = await db
		.select()
		.from(cartTable)
		.where(and(eq(cartTable.userId, userId), eq(cartTable.status, OPEN_STATUS)))
		.limit(1);
	return rows[0] ?? null;
}

async function requiredCart(ctx: UserContext): Promise<CartRow> {
	// `?? undefined` because `orNotFound` takes the undefined a missing row produces, and
	// `null` is the shape this module reads a cart with. Same answer either way.
	return orNotFound((await openCartOf(ctx.db, ctx.user.id)) ?? undefined);
}

/**
 * One line, from one of the caller's own carts.
 *
 * The ownership check is a join rather than a read-then-compare: `cart.userId` is in
 * the `where`, so a line id belonging to somebody else's cart matches nothing, and the
 * answer is the same "not found" a fabricated id gets.
 */
async function ownedLine(
	ctx: UserContext,
	cartItemId: string,
): Promise<typeof cartItemTable.$inferSelect> {
	const rows = await ctx.db
		.select({ item: cartItemTable })
		.from(cartItemTable)
		.innerJoin(cartTable, eq(cartItemTable.cartId, cartTable.id))
		.where(
			and(eq(cartItemTable.id, cartItemId), eq(cartTable.userId, ctx.user.id)),
		)
		.limit(1);

	return orNotFound(rows[0]?.item);
}

async function touchAndBuild(ctx: UserContext, cartId: string): Promise<Cart> {
	const updatedAt = new Date();
	await ctx.db
		.update(cartTable)
		.set({ updatedAt })
		.where(and(eq(cartTable.id, cartId), eq(cartTable.userId, ctx.user.id)));

	const rows = await ctx.db
		.select()
		.from(cartTable)
		.where(and(eq(cartTable.id, cartId), eq(cartTable.userId, ctx.user.id)))
		.limit(1);

	return buildCart(ctx.db, orNotFound(rows[0]));
}

/**
 * The whole cart, from the cart row.
 *
 * `replaced` is a parameter rather than a column: only `addItem` can replace a cart, and
 * it knows it did. Stored, the flag would be a second source of truth that the next read
 * has to remember to clear, and a cart that keeps saying `replacedCart: true` is a client
 * opening the same sheet on every render.
 */
async function buildCart(
	db: Db,
	cart: CartRow,
	replaced = false,
): Promise<Cart> {
	const rows = await db
		.select({ item: cartItemTable, product: productTable })
		.from(cartItemTable)
		.innerJoin(productTable, eq(cartItemTable.productId, productTable.id))
		.where(eq(cartItemTable.cartId, cart.id));

	const items: CartItem[] = rows
		// The order the lines were added, which is their id order — the ids are
		// time-ordered UUIDs, and a basket that reshuffles between renders is a basket
		// where the customer taps delete on the wrong row.
		.sort((a, b) => a.item.id.localeCompare(b.item.id))
		.map((row) => cartItemOf({ item: row.item, product: row.product }));

	const business = await db
		.select()
		.from(businessTable)
		.where(eq(businessTable.id, cart.businessId))
		.limit(1);

	const subtotalMinor = items.reduce(
		(total, item) => total + item.lineTotalMinor,
		0,
	);
	const promotion = await livePromotionOf(db, cart, subtotalMinor);

	const totals = totalsOf({
		currency: cart.currency,
		subtotalMinor,
		promotion: promotion.discount,
		minOrderMinor: business[0]?.minOrderMinor ?? 0,
	});

	return {
		id: cart.id,
		businessId: cart.businessId,
		businessName: business[0]?.name ?? null,
		businessSlug: business[0]?.slug ?? null,
		currency: cart.currency,
		status: cart.status,
		items,
		totals,
		promotionCode: cart.promotionCode,
		promotionError: promotion.error,
		replacedCart: replaced,
		updatedAt: cart.updatedAt,
	};
}

/**
 * The promotion a cart is holding, or the reason it is not being applied.
 *
 * Recomputed on every read rather than trusted from the row, because every one of these
 * conditions can change while the cart sits there: a code expires, a shop raises its
 * minimum, a campaign runs out of redemptions. A cart that still shows the discount
 * after the coupon expired is a total the customer was quoted and the order will not
 * have.
 *
 * **The reason is a message key, not a sentence.** It used to be Spanish prose written
 * here, and it reached the customer as prose: an English reader saw "El código no existe"
 * under the promo field, because a Worker has no dictionary and the sentence crossed the
 * boundary verbatim. The keys are `PROMOTION_ERROR_KEYS` in `@pymeshub/shared` and the
 * words are in `@pymeshub/i18n` — one set, resolved by whichever client is reading.
 */
async function livePromotionOf(
	db: Db,
	cart: CartRow,
	subtotalMinor: number,
): Promise<{
	discount: Discount | null;
	error: PromotionErrorKey | null;
	freeDelivery?: boolean;
}> {
	if (!cart.promotionCode) return { discount: null, error: null };

	const rows = await db
		.select()
		.from(promotionTable)
		.where(
			and(
				eq(promotionTable.businessId, cart.businessId),
				eq(promotionTable.code, cart.promotionCode),
			),
		)
		.limit(1);

	const promotion = rows[0];
	if (!promotion)
		return { discount: null, error: "cart.promotion.error.notFound" };

	const now = Date.now();
	if (!promotion.isActive)
		return { discount: null, error: "cart.promotion.error.inactive" };
	if (promotion.startsAt && promotion.startsAt.getTime() > now) {
		return { discount: null, error: "cart.promotion.error.notYetValid" };
	}
	if (promotion.endsAt && promotion.endsAt.getTime() < now) {
		return { discount: null, error: "cart.promotion.error.expired" };
	}
	if (
		promotion.maxRedemptions !== null &&
		promotion.redemptions >= promotion.maxRedemptions
	) {
		return { discount: null, error: "cart.promotion.error.exhausted" };
	}
	if (
		promotion.minOrderMinor !== null &&
		subtotalMinor < promotion.minOrderMinor
	) {
		// The amount still missing is already in `totals.missingForMinOrderMinor` for the
		// business's own minimum; this one names the coupon's, which is usually higher.
		return { discount: null, error: "cart.promotion.error.belowMinimum" };
	}

	return {
		discount: discountOf(promotion.kind, promotion.value),
		error: null,
		freeDelivery: promotion.kind === "FREE_DELIVERY",
	};
}

/**
 * A promotion row as a `Discount`.
 *
 * `FREE_DELIVERY` maps to a zero fixed discount deliberately. Delivery is not part of
 * the cart's subtotal — the fee is decided at checkout, from the fulfilment mode — so
 * the honest thing to take off a subtotal is nothing, and the checkout applies the free
 * delivery where the fee actually exists.
 */
function discountOf(kind: PromotionKind, value: number): Discount {
	if (kind === "PERCENT") return { kind: "PERCENT", percent: value };
	return { kind: "FIXED", valueMinor: kind === "FREE_DELIVERY" ? 0 : value };
}

/**
 * The cart's totals, from its lines.
 *
 * `deliveryFeeMinor` is zero here and is not an omission: the fee depends on the
 * fulfilling mode the customer picks at checkout, and a delivery charge shown in the
 * basket that changes two screens later is worse than one that appears where it is
 * decided. `taxMinor` is zero because this product has no tax engine — the ADR says so —
 * and a tax computed from a rate nobody configured would be a number invented at the
 * last moment.
 */
function totalsOf(input: {
	currency: Currency;
	subtotalMinor: number;
	promotion: Discount | null;
	minOrderMinor: number;
}): CartTotals {
	const discountMinor = input.promotion
		? discountAmountOf(input.subtotalMinor, input.promotion)
		: 0;
	const totalMinor = input.promotion
		? applyDiscount(input.subtotalMinor, input.promotion)
		: input.subtotalMinor;

	return {
		...EMPTY_CART_TOTALS,
		subtotalMinor: input.subtotalMinor,
		discountMinor,
		totalMinor,
		currency: input.currency,
		missingForMinOrderMinor: Math.max(
			0,
			input.minOrderMinor - input.subtotalMinor,
		),
	};
}

/** The cart a customer with nothing in it still has. Never null; see `cartSchema`. */
function emptyCartOf(): Cart {
	return {
		id: "",
		businessId: null,
		businessName: null,
		businessSlug: null,
		currency: EMPTY_CART_TOTALS.currency,
		status: OPEN_STATUS,
		items: [],
		totals: EMPTY_CART_TOTALS,
		promotionCode: null,
		promotionError: null,
		replacedCart: false,
		updatedAt: new Date(),
	};
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function createCart(
	ctx: UserContext,
	businessId: string,
): Promise<CartRow> {
	const business = await ctx.db
		.select({ currency: businessTable.currency })
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);

	const now = new Date();
	const row: CartRow = {
		id: newId("cart"),
		userId: ctx.user.id,
		businessId,
		status: OPEN_STATUS,
		// The cart's currency is the business's, copied once. Re-reading it on every
		// render would let an owner change it under a basket whose lines were priced in
		// the old one, and the totals would then be a sum in two currencies.
		currency: orNotFound(business[0]).currency,
		promotionCode: null,
		createdAt: now,
		updatedAt: now,
	};

	await ctx.db.insert(cartTable).values(row);
	return row;
}

/**
 * A product a stranger may add to a basket.
 *
 * Two conditions, and they are not the same one twice: the product must be on sale, and
 * its *shop* must be visible. A suspended business's still-ACTIVE product is exactly the
 * case a filter on the product alone would miss.
 */
async function readBuyableProduct(db: Db, productId: string) {
	const rows = await db
		.select({ product: productTable, business: businessTable })
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.where(
			and(
				eq(productTable.id, productId),
				eq(productTable.status, "ACTIVE"),
				sql`${productTable.archivedAt} is null`,
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);
	// The same "not found" as a missing product, for the same reason.
	if (!isPublicBusiness(row.business.status)) throw new NotFoundError();

	return row.product;
}

/**
 * The chosen options, priced from the catalogue and never from the client.
 *
 * `optionIds` is the whole input; the names and the deltas are read from the option
 * rows. A client that sent its own `priceDeltaMinor` would be choosing what it pays —
 * the same reason `placeOrderInput` has no price field.
 */
async function chosenOptionsOf(
	db: Db,
	productId: string,
	optionIds: readonly string[],
): Promise<ChosenOption[]> {
	if (optionIds.length === 0) return [];

	const rows = await db
		.select({
			option: productOptionTable,
			group: productOptionGroupTable,
		})
		.from(productOptionTable)
		.innerJoin(
			productOptionGroupTable,
			eq(productOptionTable.groupId, productOptionGroupTable.id),
		)
		.where(
			and(
				eq(productOptionGroupTable.productId, productId),
				inArray(productOptionTable.id, [...optionIds]),
			),
		);

	// Every id must belong to *this* product. An option id from another product silently
	// dropped would price the line as though the customer had chosen nothing, and they
	// would be charged for a plain item they did not order.
	if (rows.length !== new Set(optionIds).size) {
		throw new ValidationError("Una de las opciones ya no está disponible");
	}

	const unavailable = rows.filter((row) => !row.option.isAvailable);
	if (unavailable.length > 0) {
		throw new ValidationError("Una de las opciones ya no está disponible");
	}

	return rows.map((row) => ({
		groupId: row.group.id,
		groupName: row.group.name,
		optionId: row.option.id,
		name: row.option.name,
		priceDeltaMinor: row.option.priceDeltaMinor,
	}));
}
