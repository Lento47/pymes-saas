import {
	business as businessTable,
	category as categoryTable,
	courierInvite as courierInviteTable,
	courierProfile as courierProfileTable,
	order as orderTable,
	product as productTable,
	promotion as promotionTable,
	review as reviewTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type AdminCourierInviteRow,
	type AdminListInput,
	type AdminProductRow,
	type AdminPromotionRow,
	type AdminReviewRow,
	decodeCursor,
} from "@pymeshub/shared";
import { and, asc, eq, gte, like, lte, or, sql } from "drizzle-orm";

import type { UserContext } from "./helpers";
import { likePattern } from "./helpers";

/**
 * The content an operator can inspect across tenants: products, promotions and
 * reviews.
 *
 * These are read-only tables by design. A customer's order and a shop's
 * catalogue are the business's records; the console's job is to make a bad
 * row findable and to reach the business or account controls beside it. No
 * page here edits a price, a rating or a discount.
 */
type OffsetCursor = { offset: number };

function offsetOf(cursor: string | undefined): number {
	if (!cursor) return 0;
	const decoded = decodeCursor<OffsetCursor>(cursor);
	if (decoded && Number.isFinite(decoded.offset) && decoded.offset >= 0) {
		return Math.trunc(decoded.offset);
	}
	const plain = Number(cursor);
	return Number.isFinite(plain) && plain >= 0 ? Math.trunc(plain) : 0;
}

const DIRECTIONS = {
	asc: sql`asc`,
	desc: sql`desc`,
} as const;

function directionOf(input: AdminListInput) {
	return DIRECTIONS[input.direction] ?? DIRECTIONS.desc;
}

export async function products(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminProductRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(
				like(productTable.name, pattern),
				like(productTable.sku, pattern),
				like(businessTable.name, pattern),
			),
		);
	}
	if (input.from) conditions.push(gte(productTable.createdAt, input.from));
	if (input.to) conditions.push(lte(productTable.createdAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const sort = {
		newest: sql`${productTable.createdAt}`,
		name: sql`${productTable.name}`,
		orders: sql`${productTable.soldCount}`,
		revenue: sql`${productTable.priceMinor}`,
	}[input.sort];
	const direction = directionOf(input);

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				product: productTable,
				businessName: businessTable.name,
				categoryName: categoryTable.name,
			})
			.from(productTable)
			.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
			.leftJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
			.where(where)
			.orderBy(sql`${sort} ${direction}`, asc(productTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(productTable)
			.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			id: row.product.id,
			businessId: row.product.businessId,
			businessName: row.businessName,
			categoryId: row.product.categoryId,
			categoryName: row.categoryName,
			name: row.product.name,
			description: row.product.description,
			imageUrl: row.product.imageUrl,
			sku: row.product.sku,
			priceMinor: row.product.priceMinor,
			currency: row.product.currency,
			status: row.product.status,
			isFeatured: row.product.isFeatured,
			ratingAvg: row.product.ratingAvg,
			ratingCount: row.product.ratingCount,
			soldCount: row.product.soldCount,
			stockQuantity: row.product.stockQuantity,
			trackInventory: row.product.trackInventory,
			createdAt: row.product.createdAt,
			updatedAt: row.product.updatedAt,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}

export async function promotions(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminPromotionRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(like(promotionTable.code, pattern), like(businessTable.name, pattern)),
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = directionOf(input);

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({ promotion: promotionTable, business: businessTable })
			.from(promotionTable)
			.innerJoin(businessTable, eq(promotionTable.businessId, businessTable.id))
			.where(where)
			.orderBy(sql`${promotionTable.code} ${direction}`, asc(promotionTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(promotionTable)
			.innerJoin(businessTable, eq(promotionTable.businessId, businessTable.id))
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			id: row.promotion.id,
			businessId: row.promotion.businessId,
			businessName: row.business.name,
			code: row.promotion.code,
			kind: row.promotion.kind,
			value: row.promotion.value,
			currency: row.business.currency,
			isActive: row.promotion.isActive,
			minOrderMinor: row.promotion.minOrderMinor,
			maxRedemptions: row.promotion.maxRedemptions,
			redemptions: row.promotion.redemptions,
			startsAt: row.promotion.startsAt,
			endsAt: row.promotion.endsAt,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}

export async function courierInvites(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminCourierInviteRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(
				like(businessTable.name, pattern),
				like(courierProfileTable.displayName, pattern),
				like(userTable.name, pattern),
			),
		);
	}
	if (input.from)
		conditions.push(gte(courierInviteTable.createdAt, input.from));
	if (input.to) conditions.push(lte(courierInviteTable.createdAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = directionOf(input);

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				invite: courierInviteTable,
				businessName: businessTable.name,
				courierName: courierProfileTable.displayName,
			})
			.from(courierInviteTable)
			.innerJoin(
				businessTable,
				eq(courierInviteTable.businessId, businessTable.id),
			)
			.innerJoin(
				courierProfileTable,
				eq(courierInviteTable.profileId, courierProfileTable.id),
			)
			.innerJoin(userTable, eq(courierInviteTable.courierUserId, userTable.id))
			.where(where)
			.orderBy(
				sql`${courierInviteTable.createdAt} ${direction}`,
				asc(courierInviteTable.id),
			)
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(courierInviteTable)
			.innerJoin(
				businessTable,
				eq(courierInviteTable.businessId, businessTable.id),
			)
			.innerJoin(
				courierProfileTable,
				eq(courierInviteTable.profileId, courierProfileTable.id),
			)
			.innerJoin(userTable, eq(courierInviteTable.courierUserId, userTable.id))
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			id: row.invite.id,
			businessId: row.invite.businessId,
			businessName: row.businessName,
			courierUserId: row.invite.courierUserId,
			courierName: row.courierName,
			profileId: row.invite.profileId,
			status: row.invite.status,
			createdAt: row.invite.createdAt,
			expiresAt: row.invite.expiresAt,
			respondedAt: row.invite.respondedAt,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}

export async function reviews(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminReviewRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(
				like(reviewTable.comment, pattern),
				like(businessTable.name, pattern),
				like(userTable.name, pattern),
				like(orderTable.reference, pattern),
			),
		);
	}
	if (input.from) conditions.push(gte(reviewTable.createdAt, input.from));
	if (input.to) conditions.push(lte(reviewTable.createdAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = directionOf(input);
	const sort = {
		newest: sql`${reviewTable.createdAt}`,
		name: sql`${reviewTable.comment}`,
		orders: sql`${reviewTable.rating}`,
		revenue: sql`${reviewTable.rating}`,
	}[input.sort];

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				review: reviewTable,
				order: orderTable,
				businessName: businessTable.name,
				customerName: userTable.name,
				productName: productTable.name,
			})
			.from(reviewTable)
			.innerJoin(orderTable, eq(reviewTable.orderId, orderTable.id))
			.innerJoin(businessTable, eq(reviewTable.businessId, businessTable.id))
			.innerJoin(userTable, eq(reviewTable.customerId, userTable.id))
			.leftJoin(productTable, eq(reviewTable.productId, productTable.id))
			.where(where)
			.orderBy(sql`${sort} ${direction}`, asc(reviewTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(reviewTable)
			.innerJoin(orderTable, eq(reviewTable.orderId, orderTable.id))
			.innerJoin(businessTable, eq(reviewTable.businessId, businessTable.id))
			.innerJoin(userTable, eq(reviewTable.customerId, userTable.id))
			.leftJoin(productTable, eq(reviewTable.productId, productTable.id))
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			id: row.review.id,
			orderId: row.review.orderId,
			orderReference: row.order.reference,
			businessId: row.review.businessId,
			businessName: row.businessName,
			customerId: row.review.customerId,
			customerName: row.customerName,
			productId: row.review.productId,
			productName: row.productName,
			rating: row.review.rating,
			comment: row.review.comment,
			replyText: row.review.replyText,
			createdAt: row.review.createdAt,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}
