import type { Db } from "@pymeshub/db";
import {
	business as businessTable,
	category as categoryTable,
	productOptionGroup as productOptionGroupTable,
	productOption as productOptionTable,
	product as productTable,
} from "@pymeshub/db";
import {
	decodeCursor,
	encodeCursor,
	newId,
	type ProductCard,
	type ProductCreateInput,
	type ProductDetail,
	type ProductListInput,
	type ProductOptionGroup,
	type ProductStatus,
	type ProductUpdateInput,
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
	lte,
	or,
	sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Context } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import type { BusinessContext, UserContext } from "./helpers";
import {
	batchOf,
	inCategory,
	isPublicBusiness,
	likePattern,
	orNotFound,
	publicBusiness,
} from "./helpers";
import {
	productCardOf,
	productDetailOf,
	productOptionGroupOf,
} from "./mappers";

/**
 * The catalogue: what a customer browses, and what a business edits.
 *
 * Two rules run through the file:
 *
 * - **A product is scoped by its business, always.** Every write carries
 *   `and businessId = :businessId` in the `where`, so a member of one business cannot
 *   reach another's product by knowing its id — the update matches nothing, and the
 *   answer is the same "not found" a non-existent id gets.
 * - **A product is archived, never deleted.** An order line points at it with
 *   `on delete restrict`, so a delete fails at the database the moment anybody has ever
 *   ordered the thing, and the customer reads that as a crash. Archiving takes it off
 *   the shelf and leaves the receipt intact.
 */

/** How many products a detail page offers as "more from this business". */
const RELATED_LIMIT = 6;

/**
 * The one status a stranger may see.
 *
 * Typed as the schema's own union rather than written as a bare string, so renaming a
 * member of `PRODUCT_STATUSES` breaks here — where it is easy to fix — instead of
 * quietly matching no rows and reading as an empty shop.
 */
const PUBLIC_PRODUCT_STATUS: ProductStatus = "ACTIVE";
const ARCHIVED_STATUS: ProductStatus = "ARCHIVED";

export async function byId(
	ctx: Context,
	input: { id: string },
): Promise<ProductDetail> {
	const rows = await ctx.db
		.select({
			product: productTable,
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.leftJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
		.where(
			and(
				eq(productTable.id, input.id),
				eq(productTable.status, PUBLIC_PRODUCT_STATUS),
				isNull(productTable.archivedAt),
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);

	// The product's own visibility is filtered in SQL and the *business's* is checked
	// here, because the two failures are not the same answer. A product whose shop is
	// suspended reads as missing: the customer has no relationship with the business to
	// be refused from, and a 403 would tell them the id is real.
	if (!isPublicBusiness(row.business.status)) throw new NotFoundError();

	const [optionGroups, related] = await Promise.all([
		optionGroupsOf(ctx.db, row.product.id),
		relatedOf(ctx.db, row.product),
	]);

	return productDetailOf({
		product: row.product,
		business: row.business,
		categoryName: row.categoryName,
		categoryNameEn: row.categoryNameEn,
		optionGroups,
		related,
	});
}

/**
 * A business's catalogue, or a filtered cross-business list.
 *
 * **The shop must be visible unless the caller works there.** This is the one public
 * read that used to answer with a suspended or unopened business's products: it joined
 * `business` to build the card and never checked its status, so `Frutería La Cosecha`
 * — `SUSPENDED` in the seed — came back from `products.list` with a seller card, a
 * price and an `inStock` badge, while `products.byId`, `cart.addItem`, `catalog.search`,
 * `businesses.bySlug` and the home feed all refused the same product. A customer who
 * found it could not open it: the detail page answers 404. The visible symptom of a
 * missing filter here is a product that cannot be tapped.
 *
 * The exemption is what keeps this procedure doing both of its jobs. It is a public
 * read *and* the business dashboard's own list (`apps/web/components/business/…`), and
 * a shop that has not opened or has been suspended still has to see its own catalogue
 * to manage it — hiding a menu from the only person who can fix it is not the same
 * decision as keeping it out of the marketplace. Membership is the line: the caller's
 * own `membership` rows, re-read per request like every other permission.
 *
 * The sort key is resolved through the table below and never interpolated into SQL, so
 * a caller sending `sort=price_minor; drop table` gets the default ordering instead of
 * a syntax error whose message quotes their input back into a log line.
 */
export async function list(
	ctx: Context,
	input: ProductListInput,
): Promise<{ items: ProductCard[]; nextCursor: string | null }> {
	const after = decodeCursor<{ v: number; id: string }>(input.cursor);
	const direction = input.sortDirection === "asc" ? asc : desc;
	const column = sortColumnOf(input.sort);

	// Only ever exempted for a business the caller is *on the team of*, and only when
	// they asked for that business by name: the cross-business list has no own-shop to
	// extend the courtesy to. The same membership gates the `status` parameter above —
	// a stranger asking for drafts is answered with the published shelf.
	const ownShop =
		input.businessId !== undefined &&
		ctx.memberships.some((one) => one.businessId === input.businessId);
	const statuses =
		ownShop && input.status !== undefined && input.status.length > 0
			? input.status
			: [PUBLIC_PRODUCT_STATUS];

	const conditions = [
		inArray(productTable.status, statuses),
		isNull(productTable.archivedAt),
	];

	if (!ownShop) conditions.push(publicBusiness());

	if (input.businessId)
		conditions.push(eq(productTable.businessId, input.businessId));
	// A sector means its children too — see `inCategory`. A product is filed under a leaf,
	// so the equality this replaced answered nothing for the top level of the taxonomy.
	if (input.categoryId)
		conditions.push(inCategory(productTable.categoryId, input.categoryId));
	if (input.featuredOnly) conditions.push(eq(productTable.isFeatured, true));
	if (input.minPriceMinor !== undefined)
		conditions.push(gte(productTable.priceMinor, input.minPriceMinor));
	if (input.maxPriceMinor !== undefined)
		conditions.push(lte(productTable.priceMinor, input.maxPriceMinor));

	if (input.search) {
		const pattern = likePattern(input.search);
		const matches = or(
			like(productTable.name, pattern),
			like(productTable.description, pattern),
		);
		if (matches) conditions.push(matches);
	}

	// The cursor is a tuple, and applied as "past the previous row's sort value, or
	// equal value and a larger id". Without the id half the page boundary is not total:
	// two products at ₡1500 sort arbitrarily between two requests, and one of them is
	// served on both pages while the other is never served at all.
	if (after) {
		const beyond =
			input.sortDirection === "asc"
				? sql`${column} > ${after.v}`
				: sql`${column} < ${after.v}`;

		const cursorCondition = or(
			beyond,
			and(eq(column, after.v), sql`${productTable.id} > ${after.id}`),
		);
		if (cursorCondition) conditions.push(cursorCondition);
	}

	const rows = await ctx.db
		.select({ product: productTable, business: businessTable })
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.where(and(...conditions))
		.orderBy(direction(column), asc(productTable.id))
		// One extra row, read to answer "is there another page" without a second query.
		.limit(input.limit + 1);

	const hasMore = rows.length > input.limit;
	const page = hasMore ? rows.slice(0, input.limit) : rows;
	const last = page[page.length - 1];
	const now = new Date();

	return {
		items: page.map((row) => productCardOf(row.product, row.business, { now })),
		nextCursor:
			hasMore && last
				? encodeCursor({
						v: sortValueOf(last.product, input.sort),
						id: last.product.id,
					})
				: null,
	};
}

export async function create(
	ctx: BusinessContext,
	input: ProductCreateInput & { businessId: string },
): Promise<ProductDetail> {
	const businessId = ctx.membership.businessId;
	const business = await readBusiness(ctx.db, businessId);

	assertCompareAtPrice(input.priceMinor, input.compareAtPriceMinor);

	const now = new Date();
	const id = newId("product");

	const statements: BatchItem<"sqlite">[] = [
		ctx.db.insert(productTable).values({
			id,
			businessId,
			categoryId: input.categoryId ?? null,
			name: input.name,
			description: input.description ?? null,
			imageUrl: input.imageUrl ?? null,
			images: input.images,
			priceMinor: input.priceMinor,
			compareAtPriceMinor: input.compareAtPriceMinor ?? null,
			// The business's currency, never the payload's: a product priced in a currency
			// other than its shop's is a card whose number means something else than the
			// total it is added to.
			currency: business.currency,
			sku: input.sku ?? null,
			status: input.status,
			isFeatured: input.isFeatured,
			trackInventory: input.trackInventory,
			stockQuantity: input.stockQuantity,
			prepTimeMinutes: input.prepTimeMinutes ?? null,
			tags: input.tags,
			createdAt: now,
			updatedAt: now,
		}),
	];
	appendOptionStatements(statements, ctx.db, id, input.optionGroups);

	await ctx.db.batch(batchOf(statements));

	// A product created as a DRAFT is deliberately invisible to `byId`, and the person
	// who just made it is the one person who must see it — so a draft comes back through
	// the member's read instead.
	return input.status === PUBLIC_PRODUCT_STATUS
		? byId(ctx, { id })
		: detailForMember(ctx, { businessId, id });
}

export async function update(
	ctx: BusinessContext,
	input: ProductUpdateInput & { businessId: string; id: string },
): Promise<ProductDetail> {
	const businessId = ctx.membership.businessId;

	// Scoped by business in the same statement that reads it. See `orNotFound`.
	const existing = await ctx.db
		.select()
		.from(productTable)
		.where(
			and(
				eq(productTable.id, input.id),
				eq(productTable.businessId, businessId),
			),
		)
		.limit(1);

	const before = orNotFound(existing[0]);

	// The rule is checked against the *result*, not against the payload. An update that
	// lowers the price and says nothing about the struck-through one must still be
	// refused when the stored compare-at ends up below the new price — validating the
	// partial payload against itself is exactly what lets that through.
	assertCompareAtPrice(
		input.priceMinor ?? before.priceMinor,
		input.compareAtPriceMinor === undefined
			? before.compareAtPriceMinor
			: input.compareAtPriceMinor,
	);

	const patch: Partial<typeof productTable.$inferInsert> = {
		updatedAt: new Date(),
	};
	assign(patch, "name", input.name);
	assign(patch, "description", input.description);
	assign(patch, "categoryId", input.categoryId);
	assign(patch, "imageUrl", input.imageUrl);
	assign(patch, "images", input.images);
	assign(patch, "priceMinor", input.priceMinor);
	assign(patch, "compareAtPriceMinor", input.compareAtPriceMinor);
	assign(patch, "sku", input.sku);
	assign(patch, "status", input.status);
	assign(patch, "isFeatured", input.isFeatured);
	assign(patch, "trackInventory", input.trackInventory);
	assign(patch, "stockQuantity", input.stockQuantity);
	assign(patch, "prepTimeMinutes", input.prepTimeMinutes);
	assign(patch, "tags", input.tags);

	const statements: BatchItem<"sqlite">[] = [
		ctx.db
			.update(productTable)
			.set(patch)
			.where(
				and(
					eq(productTable.id, input.id),
					eq(productTable.businessId, businessId),
				),
			),
	];

	// Option groups are replaced wholesale when the payload carries them and untouched
	// when it does not. `optionGroups: []` and an absent `optionGroups` are different
	// requests — "this product has no options now" and "I am only changing the price" —
	// and treating them the same is how an edit silently deletes a product's sizes.
	if (input.optionGroups) {
		statements.push(
			ctx.db
				.delete(productOptionGroupTable)
				.where(eq(productOptionGroupTable.productId, input.id)),
		);
		appendOptionStatements(statements, ctx.db, input.id, input.optionGroups);
	}

	await ctx.db.batch(batchOf(statements));

	return detailForMember(ctx, { businessId, id: input.id });
}

/**
 * Take a product off the shelf.
 *
 * Not a delete, and the difference is not pedantry: `order_item.product_id` is
 * `on delete restrict`, so the delete fails with a foreign-key error the moment anybody
 * has ever ordered the thing. Archiving hides the card and leaves the receipt intact.
 */
export async function archive(
	ctx: BusinessContext,
	input: { businessId: string; id: string },
): Promise<{ ok: true }> {
	const businessId = ctx.membership.businessId;
	const now = new Date();

	const result = await ctx.db
		.update(productTable)
		.set({
			status: ARCHIVED_STATUS,
			archivedAt: now,
			// A featured archived product is a home screen that opens onto a dead page.
			isFeatured: false,
			updatedAt: now,
		})
		.where(
			and(
				eq(productTable.id, input.id),
				eq(productTable.businessId, businessId),
			),
		)
		.returning({ id: productTable.id });

	orNotFound(result[0]);

	return { ok: true };
}

export async function setStock(
	ctx: BusinessContext,
	input: { businessId: string; id: string; quantity: number },
): Promise<ProductDetail> {
	const businessId = ctx.membership.businessId;

	const result = await ctx.db
		.update(productTable)
		.set({
			stockQuantity: input.quantity,
			// Counting stock is a statement that the kitchen counts stock, so tracking
			// turns on with it. The alternative is a number stored where nothing reads it.
			trackInventory: true,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(productTable.id, input.id),
				eq(productTable.businessId, businessId),
			),
		)
		.returning({ id: productTable.id });

	orNotFound(result[0]);

	return detailForMember(ctx, { businessId, id: input.id });
}

// ---------------------------------------------------------------------------
// Reads the writes share
// ---------------------------------------------------------------------------

/**
 * The member's view of a product: the public one, plus drafts and archives.
 *
 * A separate read from `byId` rather than a flag on it. The public read's filter is the
 * security property, and a boolean parameter that switches it off is a parameter that
 * somebody eventually passes from a public procedure.
 */
export async function detailForMember(
	ctx: UserContext,
	input: { businessId: string; id: string },
): Promise<ProductDetail> {
	const rows = await ctx.db
		.select({
			product: productTable,
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.leftJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
		.where(
			and(
				eq(productTable.id, input.id),
				eq(productTable.businessId, input.businessId),
			),
		)
		.limit(1);

	const row = orNotFound(rows[0]);

	const [optionGroups, related] = await Promise.all([
		optionGroupsOf(ctx.db, row.product.id),
		relatedOf(ctx.db, row.product),
	]);

	return productDetailOf({
		product: row.product,
		business: row.business,
		categoryName: row.categoryName,
		categoryNameEn: row.categoryNameEn,
		optionGroups,
		related,
	});
}

async function optionGroupsOf(
	db: Db,
	productId: string,
): Promise<ProductOptionGroup[]> {
	const groups = await db
		.select()
		.from(productOptionGroupTable)
		.where(eq(productOptionGroupTable.productId, productId))
		.orderBy(asc(productOptionGroupTable.sortOrder));

	if (groups.length === 0) return [];

	// One query for every option of every group rather than one per group: a product
	// with six option groups would otherwise be seven round trips to render one page.
	const options = await db
		.select()
		.from(productOptionTable)
		.where(
			inArray(
				productOptionTable.groupId,
				groups.map((group) => group.id),
			),
		)
		.orderBy(asc(productOptionTable.sortOrder));

	return groups.map((group) =>
		productOptionGroupOf(
			group,
			options.filter((option) => option.groupId === group.id),
		),
	);
}

/** "More from this business" — same category first, then whatever else it sells. */
async function relatedOf(
	db: Db,
	product: typeof productTable.$inferSelect,
): Promise<ProductCard[]> {
	const rows = await db
		.select({ product: productTable, business: businessTable })
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.where(
			and(
				eq(productTable.businessId, product.businessId),
				eq(productTable.status, PUBLIC_PRODUCT_STATUS),
				isNull(productTable.archivedAt),
				// Excludes the product being viewed: a "related" strip that leads back to
				// the page the customer is already on is a row of wasted taps.
				sql`${productTable.id} <> ${product.id}`,
			),
		)
		.orderBy(
			// Same category first, then best sellers — one ordering rather than two
			// queries, so the strip is filled by relevance before it is filled by anything.
			desc(
				sql`case when ${productTable.categoryId} = ${product.categoryId ?? ""} then 1 else 0 end`,
			),
			desc(productTable.soldCount),
		)
		.limit(RELATED_LIMIT);

	const now = new Date();
	return rows.map((row) => productCardOf(row.product, row.business, { now }));
}

async function readBusiness(db: Db, businessId: string) {
	const rows = await db
		.select()
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);
	return orNotFound(rows[0]);
}

// ---------------------------------------------------------------------------
// Shared rules
// ---------------------------------------------------------------------------

/**
 * The option rows for a product, appended to a statement list.
 *
 * The ids are minted here rather than by the database, like every other id in this API:
 * a client that has to wait for a round trip to learn the identity of what it just
 * created renders a spinner over a row it could already have.
 */
function appendOptionStatements(
	statements: BatchItem<"sqlite">[],
	db: Db,
	productId: string,
	groups: ProductCreateInput["optionGroups"],
): void {
	for (const group of groups) {
		const groupId = newId("optionGroup");

		statements.push(
			db.insert(productOptionGroupTable).values({
				id: groupId,
				productId,
				name: group.name,
				kind: group.kind,
				isRequired: group.isRequired,
				minSelect: group.minSelect,
				maxSelect: group.maxSelect,
				sortOrder: group.sortOrder,
			}),
		);

		group.options.forEach((option, index) => {
			statements.push(
				db.insert(productOptionTable).values({
					id: newId("option"),
					groupId,
					name: option.name,
					priceDeltaMinor: option.priceDeltaMinor,
					isDefault: option.isDefault,
					isAvailable: option.isAvailable,
					// The payload's order is the menu's order. The input carries no
					// per-option `sortOrder`, and a form that lists sizes S/M/L must not come
					// back as M/L/S because every row defaulted to zero.
					sortOrder: index,
				}),
			);
		});
	}
}

/**
 * A struck-through price that is not higher than the live one.
 *
 * Refused rather than normalised, because both normalisations are wrong: clearing it
 * throws away what the owner typed, and keeping it renders a discount that does not
 * exist — a card showing ₡2000 crossed out above a ₡1500 price reads as a price rise.
 */
function assertCompareAtPrice(
	priceMinor: number,
	compareAtPriceMinor: number | null | undefined,
): void {
	if (compareAtPriceMinor == null) return;
	if (compareAtPriceMinor <= priceMinor) {
		throw new ValidationError(
			"El precio anterior debe ser mayor que el precio actual",
			{
				field: "compareAtPriceMinor",
			},
		);
	}
}

/** The sort key, resolved against the columns this module allows. Never interpolated. */
function sortColumnOf(sort: ProductListInput["sort"]) {
	return {
		relevance: productTable.soldCount,
		price: productTable.priceMinor,
		rating: productTable.ratingAvg,
		newest: productTable.createdAt,
		popular: productTable.soldCount,
	}[sort];
}

/** The sort key's value on a row, for the cursor the next page sends back. */
function sortValueOf(
	product: typeof productTable.$inferSelect,
	sort: ProductListInput["sort"],
): number {
	switch (sort) {
		case "price":
			return product.priceMinor;
		case "rating":
			return product.ratingAvg;
		case "newest":
			return product.createdAt.getTime();
		default:
			return product.soldCount;
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
