import type { Db } from "@pymeshub/db";
import {
	business as businessTable,
	promotion as promotionTable,
} from "@pymeshub/db";
import {
	type Currency,
	newId,
	type PromotionActiveInput,
	type PromotionCreateInput,
	type PromotionDetail,
	type PromotionKind,
	type PromotionUpdateInput,
} from "@pymeshub/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { ValidationError } from "../errors";
import type { BusinessContext } from "./helpers";
import { orNotFound } from "./helpers";
import { currencyOf, promotionDetailOf } from "./mappers";
import { checkCount } from "./plan-limits";

/**
 * The codes a shop opens, and what each one is worth.
 *
 * The same two rules the catalogue runs on, for the same reasons:
 *
 * - **A promotion is scoped by its business, always.** Every read and write carries
 *   `and businessId = :businessId` in the `where`, so a member of one shop cannot open
 *   another shop's discount by knowing its `prm_…` id — the update matches nothing and
 *   answers the same "not found" a made-up id gets.
 * - **A code is closed, never deleted.** Orders record the code they were placed under;
 *   a row that disappears leaves a receipt explaining a discount nobody can look up.
 *   `setActive` is the whole of the removal story, and it is a pause, not a delete.
 *
 * The third rule is this file's own: **a code's spelling is settled once, at the write.**
 * `promotionCodeSchema` uppercases what arrives, the cart uppercases what a customer
 * types, and the lookup is an exact match — so the only way those three disagree is for
 * this file to store a code the other two cannot produce. It does not.
 */

export async function list(ctx: BusinessContext): Promise<PromotionDetail[]> {
	const rows = await ctx.db
		.select({ promotion: promotionTable, currency: businessTable.currency })
		.from(promotionTable)
		.innerJoin(businessTable, eq(promotionTable.businessId, businessTable.id))
		.where(eq(promotionTable.businessId, ctx.membership.businessId))
		// Live codes first, then the ones about to expire, then the closed ones — the
		// order a merchant decides in, and the order the screen draws without sorting.
		.orderBy(desc(promotionTable.isActive), asc(promotionTable.endsAt));
	// No `limit` and no cursor: a shop runs a handful of codes, and the screen is
	// the whole list. A page here would be a scroll on a list that has no end.

	return rows.map((row) =>
		promotionDetailOf(row.promotion, currencyOf(row.currency)),
	);
}

export async function detail(
	ctx: BusinessContext,
	input: { id: string },
): Promise<PromotionDetail> {
	const [row] = await readOne(ctx.db, ctx.membership.businessId, input.id);
	const promotion = orNotFound(row);
	return promotionDetailOf(promotion.promotion, currencyOf(promotion.currency));
}

export async function create(
	ctx: BusinessContext,
	input: PromotionCreateInput & { businessId: string },
): Promise<PromotionDetail> {
	const businessId = ctx.membership.businessId;
	const currency = await readCurrency(ctx.db, businessId);

	assertFitsKind(input.kind, input.value);
	assertWindowIsOrdered(input.startsAt, input.endsAt);
	await assertCodeIsFree(ctx.db, businessId, input.code, null);

	/**
	 * The plan's promotion cap, counting **active** codes.
	 *
	 * An inactive promotion is a code a merchant is keeping for later, and capping them
	 * on it would push them to delete codes they intend to run at Christmas. The
	 * `isActive` filter is therefore the difference between a limit that says "you have
	 * too many live offers" and one that says "clean up your archive".
	 */
	const [active] = await ctx.db
		.select({ count: sql<number>`count(${promotionTable.id})` })
		.from(promotionTable)
		.where(
			and(
				eq(promotionTable.businessId, businessId),
				eq(promotionTable.isActive, true),
			),
		);
	checkCount({
		ctx,
		limitName: "activePromotions",
		resourceType: "promociones activas",
		current: active?.count ?? 0,
	});

	const id = newId("promotion");

	await ctx.db.insert(promotionTable).values({
		id,
		businessId,
		code: input.code,
		kind: input.kind,
		value: input.value,
		minOrderMinor: input.minOrderMinor ?? null,
		maxRedemptions: input.maxRedemptions ?? null,
		startsAt: input.startsAt ?? null,
		endsAt: input.endsAt ?? null,
		// Absent is the brand fill, which is the same as an explicit null here: a create
		// has no previous picture to keep, so there is nothing for the field to preserve.
		imageUrl: input.imageUrl ?? null,
		description: input.description ?? null,
		// Born open. Closing it is the `setActive` procedure, never a create-time
		// option: a code the shop has to switch on after saving it is a code nobody
		// remembers to.
		isActive: true,
	});

	// Re-read rather than assemble the answer here: the row carries `redemptions` and
	// the insert's defaults, and a mapper fed a hand-built object is a mapper that
	// drifts from the one the list uses.
	const [row] = await readOne(ctx.db, businessId, id);
	const created = orNotFound(row);
	return promotionDetailOf(created.promotion, currency);
}

export async function update(
	ctx: BusinessContext,
	input: PromotionUpdateInput & { businessId: string; id: string },
): Promise<PromotionDetail> {
	const businessId = ctx.membership.businessId;
	const [row] = await readOne(ctx.db, businessId, input.id);
	const before = orNotFound(row);

	// The rules are checked against the *result*, not the payload — the reason
	// `promotionUpdateInput` only fires them when the update supplies both fields it
	// reads. Lowering the price and saying nothing about the kind must still be refused
	// when the stored kind ends up not fitting the new number.
	assertFitsKind(
		input.kind ?? before.promotion.kind,
		input.value ?? before.promotion.value,
	);
	assertWindowIsOrdered(
		input.startsAt === undefined ? before.promotion.startsAt : input.startsAt,
		input.endsAt === undefined ? before.promotion.endsAt : input.endsAt,
	);

	// A rename is a real operation and it is checked like one: two shops' codes are
	// independent, one shop's are not, and the index says so.
	if (input.code !== undefined && input.code !== before.promotion.code) {
		await assertCodeIsFree(ctx.db, businessId, input.code, input.id);
	}

	const patch: Partial<typeof promotionTable.$inferInsert> = {};
	assign(patch, "code", input.code);
	assign(patch, "kind", input.kind);
	assign(patch, "value", input.value);
	assign(patch, "minOrderMinor", input.minOrderMinor);
	assign(patch, "maxRedemptions", input.maxRedemptions);
	assign(patch, "startsAt", input.startsAt);
	assign(patch, "endsAt", input.endsAt);
	// `assign`'s own rule is the whole of this: absent leaves the stored picture alone,
	// and an explicit `null` takes it off. A form that saves without touching the field
	// therefore cannot quietly strip a banner the shop uploaded last month.
	assign(patch, "imageUrl", input.imageUrl);
	assign(patch, "description", input.description);

	const [written] = await ctx.db
		.update(promotionTable)
		.set(patch)
		.where(
			and(
				eq(promotionTable.id, input.id),
				eq(promotionTable.businessId, businessId),
			),
		)
		.returning({ id: promotionTable.id });

	orNotFound(written);

	const [after] = await readOne(ctx.db, businessId, input.id);
	const promotion = orNotFound(after);
	return promotionDetailOf(promotion.promotion, currencyOf(promotion.currency));
}

/**
 * Open or close a live code.
 *
 * Its own procedure rather than a field on `promotionUpdateInput`, because this is the
 * one write customers feel immediately: a code they are holding in a cart stops working
 * the moment this lands. A form that could set it in passing would make that a
 * side effect of editing a typo, which is the shape of change this API refuses to have
 * — see `packages/shared/src/schemas/promotions.ts`.
 */
export async function setActive(
	ctx: BusinessContext,
	input: PromotionActiveInput & { businessId: string },
): Promise<PromotionDetail> {
	const businessId = ctx.membership.businessId;

	const [written] = await ctx.db
		.update(promotionTable)
		.set({ isActive: input.isActive })
		.where(
			and(
				eq(promotionTable.id, input.promotionId),
				eq(promotionTable.businessId, businessId),
			),
		)
		.returning({ id: promotionTable.id });

	orNotFound(written);

	const [after] = await readOne(ctx.db, businessId, input.promotionId);
	const promotion = orNotFound(after);
	return promotionDetailOf(promotion.promotion, currencyOf(promotion.currency));
}

// ---------------------------------------------------------------------------
// Shared rules
// ---------------------------------------------------------------------------

/**
 * Read one promotion, scoped by business in the same statement that reads it.
 *
 * The join is here rather than at each call site for the same reason `orNotFound` is
 * one function: the shop's currency is not a column on `promotion`, every answer needs
 * it, and three copies of the join is three chances to forget the `where`.
 */
function readOne(db: Db, businessId: string, id: string) {
	return db
		.select({ promotion: promotionTable, currency: businessTable.currency })
		.from(promotionTable)
		.innerJoin(businessTable, eq(promotionTable.businessId, businessTable.id))
		.where(
			and(eq(promotionTable.id, id), eq(promotionTable.businessId, businessId)),
		)
		.limit(1);
}

async function readCurrency(db: Db, businessId: string): Promise<Currency> {
	const rows = await db
		.select({ currency: businessTable.currency })
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);
	return currencyOf(orNotFound(rows[0]).currency);
}

/**
 * The three shapes `value` takes, checked against the kind that gives it meaning.
 *
 * The schema's copy of this rule can only see the fields one payload carries; this one
 * sees the merged result. Both are needed for the reason `products.update` keeps
 * `assertCompareAtPrice` on both sides of the wire.
 */
function assertFitsKind(kind: PromotionKind, value: number): void {
	if (kind === "PERCENT" && (value < 1 || value > 100)) {
		throw new ValidationError(
			"El descuento debe ser entre 1 y 100 por ciento",
			{ field: "value" },
		);
	}
	if (kind === "FIXED" && value < 1) {
		throw new ValidationError("El descuento debe ser mayor que cero", {
			field: "value",
		});
	}
}

/**
 * A window that ends before it starts is a code nobody can use, and the customer would
 * find that out at checkout rather than in the form that made it.
 */
function assertWindowIsOrdered(
	startsAt: Date | null | undefined,
	endsAt: Date | null | undefined,
): void {
	if (startsAt == null || endsAt == null) return;
	if (endsAt.getTime() <= startsAt.getTime()) {
		throw new ValidationError(
			"La fecha de fin debe ser posterior a la de inicio",
			{ field: "endsAt" },
		);
	}
}

/**
 * One code per shop, checked before the write rather than caught after it.
 *
 * The database enforces the same thing (`promotion_business_code_unique`), and this is
 * not a second gate — it is the *message*. A driver error is a stack trace; this is a
 * field on a form. The pre-check is not the integrity guarantee, the index is.
 */
async function assertCodeIsFree(
	db: Db,
	businessId: string,
	code: string,
	exceptId: string | null,
): Promise<void> {
	const taken = await db
		.select({ id: promotionTable.id })
		.from(promotionTable)
		.where(
			and(
				eq(promotionTable.businessId, businessId),
				eq(promotionTable.code, code),
			),
		)
		.limit(2);

	const clash = taken.find((row) => row.id !== exceptId);
	if (clash) {
		throw new ValidationError("Ya existe una promoción con ese código", {
			field: "code",
		});
	}
}

/** A partial update: absent means "leave it". A null the caller sent is copied as null. */
function assign<T extends object, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined,
): void {
	if (value === undefined) return;
	target[key] = value;
}
