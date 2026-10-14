import { merchantCategory, product } from "@pymeshub/db";
import { newId } from "@pymeshub/shared";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import type { BusinessContext } from "./helpers";

function businessIdOf(ctx: BusinessContext) {
	return ctx.membership.businessId;
}

async function categoryOf(ctx: BusinessContext, id: string) {
	const [row] = await ctx.db
		.select()
		.from(merchantCategory)
		.where(
			and(
				eq(merchantCategory.id, id),
				eq(merchantCategory.businessId, businessIdOf(ctx)),
			),
		)
		.limit(1);
	if (!row) throw new NotFoundError();
	return row;
}

async function ensureUnique(
	ctx: BusinessContext,
	name: string,
	exceptId?: string,
) {
	const [duplicate] = await ctx.db
		.select({ id: merchantCategory.id })
		.from(merchantCategory)
		.where(
			and(
				eq(merchantCategory.businessId, businessIdOf(ctx)),
				sql`lower(${merchantCategory.name}) = lower(${name})`,
				exceptId ? ne(merchantCategory.id, exceptId) : undefined,
			),
		)
		.limit(1);
	if (duplicate)
		throw new ConflictError("Ya existe una categoría con ese nombre");
}

export async function list(ctx: BusinessContext) {
	return ctx.db
		.select({
			id: merchantCategory.id,
			name: merchantCategory.name,
			sortOrder: merchantCategory.sortOrder,
			productCount: sql<number>`count(${product.id})`,
		})
		.from(merchantCategory)
		.leftJoin(product, eq(product.merchantCategoryId, merchantCategory.id))
		.where(eq(merchantCategory.businessId, businessIdOf(ctx)))
		.groupBy(merchantCategory.id)
		.orderBy(asc(merchantCategory.sortOrder), asc(merchantCategory.createdAt));
}

export async function create(ctx: BusinessContext, name: string) {
	await ensureUnique(ctx, name);
	const id = newId("merchantCategory");
	await ctx.db.insert(merchantCategory).values({
		id,
		businessId: businessIdOf(ctx),
		name,
		createdAt: new Date(),
	});
	return { id };
}

export async function rename(ctx: BusinessContext, id: string, name: string) {
	await categoryOf(ctx, id);
	await ensureUnique(ctx, name, id);
	await ctx.db
		.update(merchantCategory)
		.set({ name })
		.where(
			and(
				eq(merchantCategory.id, id),
				eq(merchantCategory.businessId, businessIdOf(ctx)),
			),
		);
	return { id };
}

export async function remove(
	ctx: BusinessContext,
	id: string,
	reassignToId?: string,
) {
	await categoryOf(ctx, id);
	const [usage] = await ctx.db
		.select({ count: sql<number>`count(*)` })
		.from(product)
		.where(
			and(
				eq(product.businessId, businessIdOf(ctx)),
				eq(product.merchantCategoryId, id),
			),
		);
	if (usage && usage.count > 0) {
		if (!reassignToId || reassignToId === id)
			throw new ValidationError(
				"Elige otra categoría para reasignar los productos",
			);
		await categoryOf(ctx, reassignToId);
		await ctx.db.batch([
			ctx.db
				.update(product)
				.set({ merchantCategoryId: reassignToId, updatedAt: new Date() })
				.where(
					and(
						eq(product.businessId, businessIdOf(ctx)),
						eq(product.merchantCategoryId, id),
					),
				),
			ctx.db
				.delete(merchantCategory)
				.where(
					and(
						eq(merchantCategory.id, id),
						eq(merchantCategory.businessId, businessIdOf(ctx)),
					),
				),
		]);
	} else {
		await ctx.db
			.delete(merchantCategory)
			.where(
				and(
					eq(merchantCategory.id, id),
					eq(merchantCategory.businessId, businessIdOf(ctx)),
				),
			);
	}
	return { id };
}
