import type { Db } from "@pymeshub/db";
import {
	business as businessTable,
	category as categoryTable,
	favorite as favoriteTable,
	haversineKm,
	product as productTable,
	promotion as promotionTable,
} from "@pymeshub/db";
import {
	type BusinessCard,
	type Category,
	type ProductCard,
	type ProductSearchResult,
	type PromotionCard,
} from "@pymeshub/shared";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	or,
	sql,
} from "drizzle-orm";
import type { Context } from "../context";
import { ValidationError } from "../errors";
import { NEARBY_CANDIDATE_LIMIT } from "./businesses";
import type { UserContext } from "./helpers";
import {
	isPublicBusiness,
	likePattern,
	orNotFound,
	publicBusiness,
	roundKm,
} from "./helpers";
import {
	businessCardOf,
	categoryOf,
	productCardOf,
	promotionCardOf,
} from "./mappers";

/**
 * Discovery: the category strip, the home feed, search, and favourites.
 *
 * Everything a stranger can read about a business goes through the two helpers at the
 * bottom of this file, and they exist so that "is this visible to a customer" is
 * answered once. A second copy of `status in ('ACTIVE','CLOSED')` in a third query is
 * a suspended shop that stays on the home screen until somebody notices.
 */

/** The most a home feed will show of each kind, whatever a client asks for. */
const FEED_FEATURED_LIMIT = 12;
const FEED_NEARBY_LIMIT = 12;
/**
 * The two offer bands. Smaller than the other two on purpose: a rail is read by scrolling
 * sideways, and twelve tiles of one width is already more than a thumb swipes past — a
 * longer list behind a horizontal gesture is a list whose tail nobody sees.
 */
const FEED_OFFER_LIMIT = 12;
const FEED_PROMO_LIMIT = 12;
const SEARCH_PRODUCT_LIMIT = 20;
const SEARCH_BUSINESS_LIMIT = 10;
const SEARCH_CATEGORY_LIMIT = 10;
const FAVORITE_LIMIT = 50;

/**
 * The category strip.
 *
 * The whole active taxonomy, and the cap is above it rather than below it. Migration
 * `0006_category_taxonomy.sql` writes 242 rows into this table — 18 sectors and their 224
 * children — and the `50` that used to sit here answered with the 18 sectors and the first
 * 32 children: 192 categories no client could ask for, because nothing pages this read and
 * every screen that draws a category draws it from here. `500` clears the taxonomy as
 * written and the rows an operator adds through `admin.saveCategory`.
 *
 * `sortOrder` is what makes a flat list usable as a two-level one: a sector is numbered
 * 100, 200, 300 … and its children just above it, so a parent is immediately followed by
 * the categories it holds and a client renders the strip without building the tree itself.
 *
 * `productCount` counts *buyable* products only — a category whose every item is a
 * draft reads as empty, which is true, rather than as stocked, which is not.
 *
 * The outer reference is written `category.category.id` — table, then column — and the
 * duplication is load-bearing. Drizzle renders an interpolated Column inside a `sql`
 * template as its own bare name, `"id"`, so the obvious `${categoryTable.id}` became a
 * comparison against the *inner* table's `id`: `product.category_id = product.id`, false
 * for every row. Every category therefore reported `productCount: 0` — the strip on the
 * home screen, the rail on the search tab and every tile of the app's category grid read
 * "0 productos" over a stocked catalogue, and `app/category/[slug]` had nothing to list.
 * Interpolating the table first restores the qualifier; dropping either half brings the
 * zeroes back. `./admin`'s aggregate block documents the same trap at length, along with
 * the two fragments there that SQLite rejects outright instead of answering.
 */
export async function categories(ctx: Context): Promise<Category[]> {
	const rows = await ctx.db
		.select({
			category: categoryTable,
			productCount: sql<number>`(
				select count(*) from ${productTable}
				where ${productTable.categoryId} = ${categoryTable}.${categoryTable.id}
					and ${productTable.status} = 'ACTIVE'
					and ${productTable.archivedAt} is null
			)`,
		})
		.from(categoryTable)
		.where(eq(categoryTable.isActive, true))
		.orderBy(asc(categoryTable.sortOrder), asc(categoryTable.name))
		.limit(500);

	return rows.map((row) => categoryOf(row.category, Number(row.productCount)));
}

/**
 * The home screen, in one round trip.
 *
 * A phone on one bar of signal cannot afford six calls to draw its first screen, so
 * the featured products, the nearby businesses, the two offer bands and the category
 * strip come back together. They stay separate fields rather than one merged list
 * because the screen renders them as separate sections, and a client that has to split
 * them has been handed the work the server could have done.
 *
 * ## The two offer bands, and why they are two
 *
 * `offers` is products and `promotions` is shops, and they are different objects with
 * different gestures behind them. An offer is a **price that is already lower** —
 * `compareAtPriceMinor` above `priceMinor` on the row, decided by whoever priced the
 * product — and tapping one opens that product's page, where the discount is already
 * applied by the time the customer arrives. A promotion is a **code to type at
 * checkout**, held by a shop, with a minimum, a window and a redemption cap of its own;
 * tapping one opens the shop, because that is where the customer has to go to fill a
 * basket worth redeeming.
 *
 * Collapsing them into one rail would put a struck-through price and an untyped coupon
 * side by side, which is two unrelated promises under one heading, and the customer has
 * no way to tell which card does which.
 *
 * ## Both are filtered to what is true now
 *
 * An offer is excluded when `compareAtPriceMinor` is null *or* not above the price: the
 * second case is the one that matters, because a card renders the compare-at as a
 * struck-through figure and printing one that is lower than the live price reads as a
 * price rise. `productCreateInput` refuses to store that, and this does not lean on the
 * refusal — a row written before the rule existed, or by a migration, still renders.
 *
 * A promotion is excluded by every condition `livePromotionOf` refuses a code for at
 * redemption — inactive, not yet started, expired, out of redemptions — so the rail
 * cannot advertise a code the cart will reject. `minOrderMinor` is deliberately **not**
 * a filter: a minimum is not a reason the code fails, it is a condition the customer
 * meets by spending more, and the copy on the card states the amount. What is *not* here
 * is the sentence that says it — see `promotionCardSchema`.
 *
 * Neither filter is a substitute for the other check. The cart re-reads all of this when
 * it redeems, because every one of these conditions can change between the rail being
 * drawn and the code being typed.
 */
export async function feed(
	ctx: Context,
	input: { lat?: number; lng?: number; limit?: number },
): Promise<{
	featured: ProductCard[];
	offers: ProductCard[];
	nearby: BusinessCard[];
	promotions: PromotionCard[];
	categories: Category[];
}> {
	const featuredLimit = clampLimit(
		input.limit,
		FEED_FEATURED_LIMIT,
		FEED_NEARBY_LIMIT,
	);
	const nearbyLimit = clampLimit(
		input.limit,
		FEED_NEARBY_LIMIT,
		FEED_NEARBY_LIMIT,
	);

	const origin =
		input.lat === undefined || input.lng === undefined
			? null
			: { lat: input.lat, lng: input.lng };

	// Above the `Promise.all`, not below it. Two of the five reads below are windows on the
	// clock — a promotion starts, a promotion ends — and a `now` taken after the batch
	// resolved would be a *later* instant than the one those rows were filtered against, so
	// a code that expired in between would be advertised by a response that also knew it had
	// expired. One instant for the whole response is the only version of this a reader can
	// reason about.
	const now = new Date();

	const [featuredRows, offerRows, nearbyRows, promotionRows, strip] =
		await Promise.all([
			ctx.db
				.select({ product: productTable, business: businessTable })
				.from(productTable)
				.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
				.where(
					and(
						eq(productTable.status, "ACTIVE"),
						isNull(productTable.archivedAt),
						eq(productTable.isFeatured, true),
						publicBusiness(),
					),
				)
				// Best-rated first, then newest: a home screen that reshuffles between two
				// loads of the same data is a screen nobody trusts to be the same place.
				.orderBy(desc(productTable.ratingAvg), desc(productTable.createdAt))
				.limit(featuredLimit),
			ctx.db
				.select({ product: productTable, business: businessTable })
				.from(productTable)
				.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
				.where(
					and(
						eq(productTable.status, "ACTIVE"),
						isNull(productTable.archivedAt),
						isNotNull(productTable.compareAtPriceMinor),
						// `gt` between two columns, not against a literal: the rule is "the
						// compare-at is above the price", which is a comparison the row carries
						// and not a number anybody here knows.
						gt(productTable.compareAtPriceMinor, productTable.priceMinor),
						publicBusiness(),
					),
				)
				// Deepest cut first. The depth is a *ratio* and not the difference in minor
				// units, because a ₡500 cut on a ₡2 000 item and a ₡500 cut on a ₡20 000 one
				// are the same number and not the same offer — sorting by the subtrahend
				// would put the expensive product first for being expensive.
				//
				// The division is by the compare-at price, which the `where` above has already
				// established is non-null and above a non-null price, so nothing here divides
				// by zero or by a null. SQLite's `/` on two integers is integer division, hence
				// the `1.0`: without it every ratio below 1 truncates to 0 and the whole rail
				// sorts by the tiebreak.
				.orderBy(
					desc(
						sql`((${productTable.compareAtPriceMinor} - ${productTable.priceMinor}) * 1.0
							/ ${productTable.compareAtPriceMinor})`,
					),
					// Deterministic to the end: two products cut by the same percentage, or by
					// the same percentage to the rounding SQLite does, must not swap places
					// between two loads of the same data.
					desc(productTable.ratingAvg),
					asc(productTable.id),
				)
				.limit(FEED_OFFER_LIMIT),
			publicBusinesses(ctx.db, { origin, limit: nearbyLimit }),
			ctx.db
				.select({ promotion: promotionTable, business: businessTable })
				.from(promotionTable)
				.innerJoin(
					businessTable,
					eq(promotionTable.businessId, businessTable.id),
				)
				.where(
					and(
						eq(promotionTable.isActive, true),
						// The three conditions `livePromotionOf` refuses a code for, in the same
						// order, so the two cannot drift into disagreeing about whether a code is
						// live. `or(isNull(...), ...)` rather than a bare comparison because both
						// columns are nullable and mean "no bound" — and SQL three-valued logic
						// makes `ends_at > now` evaluate to NULL, not true, on an unbounded code.
						or(
							isNull(promotionTable.startsAt),
							lte(promotionTable.startsAt, now),
						),
						or(isNull(promotionTable.endsAt), gt(promotionTable.endsAt, now)),
						or(
							isNull(promotionTable.maxRedemptions),
							lt(promotionTable.redemptions, promotionTable.maxRedemptions),
						),
						publicBusiness(),
					),
				)
				// Ending soonest first, and the ones with no deadline last. Ordering the rail by
				// what a code is *worth* is not available and would not be honest if it were:
				// `value` is a percent for one kind and minor units for another, and comparing
				// the two sorts by nothing. Urgency is the one axis every kind shares.
				.orderBy(
					asc(sql`${promotionTable.endsAt} is null`),
					asc(promotionTable.endsAt),
					asc(promotionTable.id),
				)
				.limit(FEED_PROMO_LIMIT),
			categories(ctx),
		]);

	return {
		featured: featuredRows.map((row) =>
			productCardOf(row.product, row.business, { now }),
		),
		offers: offerRows.map((row) =>
			productCardOf(row.product, row.business, { now }),
		),
		nearby: nearbyRows,
		promotions: promotionRows.map((row) =>
			promotionCardOf(row.promotion, row.business),
		),
		categories: strip,
	};
}

/**
 * One search box, three answers.
 *
 * A customer typing "café" means a product, a shop, or a category and does not know
 * which — so all three come back and the client renders the sections it has. The
 * matching is `LIKE` over the name and the description, with the pattern escaped:
 * a customer searching for "100%" must not have their percent sign widen the query.
 */
export async function search(
	ctx: Context,
	input: { q: string; lat?: number; lng?: number },
): Promise<ProductSearchResult> {
	const pattern = likePattern(input.q);
	const origin =
		input.lat === undefined || input.lng === undefined
			? null
			: { lat: input.lat, lng: input.lng };

	const [productRows, businessRows, categoryRows] = await Promise.all([
		ctx.db
			.select({ product: productTable, business: businessTable })
			.from(productTable)
			.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
			.where(
				and(
					eq(productTable.status, "ACTIVE"),
					isNull(productTable.archivedAt),
					publicBusiness(),
					or(
						like(productTable.name, pattern),
						like(productTable.description, pattern),
					),
				),
			)
			.orderBy(desc(productTable.soldCount), desc(productTable.ratingAvg))
			.limit(SEARCH_PRODUCT_LIMIT),
		ctx.db
			.select({
				business: businessTable,
				categoryName: categoryTable.name,
				categoryNameEn: categoryTable.nameEn,
			})
			.from(businessTable)
			.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
			.where(
				and(
					publicBusiness(),
					or(
						like(businessTable.name, pattern),
						like(businessTable.description, pattern),
					),
				),
			)
			.limit(SEARCH_BUSINESS_LIMIT),
		ctx.db
			.select({ category: categoryTable })
			.from(categoryTable)
			.where(
				and(
					eq(categoryTable.isActive, true),
					like(categoryTable.name, pattern),
				),
			)
			.orderBy(asc(categoryTable.sortOrder))
			.limit(SEARCH_CATEGORY_LIMIT),
	]);

	const now = new Date();

	return {
		products: productRows.map((row) =>
			productCardOf(row.product, row.business, { now }),
		),
		businesses: businessRows.map((row) =>
			businessCardOf(row.business, {
				categoryName: row.categoryName,
				categoryNameEn: row.categoryNameEn,
				distanceKm: distanceTo(origin, row.business.lat, row.business.lng),
				now,
			}),
		),
		categories: categoryRows.map((row) => categoryOf(row.category)),
	};
}

/**
 * Everything the caller has hearted, in the two shapes a favourites screen shows.
 *
 * Products whose business has since been suspended are left out: the shop cannot take
 * the order, so a heart on it is a tap that leads to a closed door.
 */
export async function listFavorites(
	ctx: UserContext,
): Promise<{ businesses: BusinessCard[]; products: ProductCard[] }> {
	const rows = await ctx.db
		.select({
			business: businessTable,
			product: productTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(favoriteTable)
		.leftJoin(businessTable, eq(favoriteTable.businessId, businessTable.id))
		.leftJoin(productTable, eq(favoriteTable.productId, productTable.id))
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(eq(favoriteTable.userId, ctx.user.id))
		.orderBy(desc(favoriteTable.createdAt))
		.limit(FAVORITE_LIMIT);

	const now = new Date();

	// A product favourite still needs its business row for the card's seller strip, so
	// the businesses behind the product rows are read in one follow-up query rather
	// than joined again per row.
	const productBusinessIds = [
		...new Set(
			rows
				.filter((row) => row.product !== null && row.business === null)
				.map((row) => row.product?.businessId)
				.filter((id): id is string => typeof id === "string"),
		),
	];

	const productBusinesses = new Map<
		string,
		typeof businessTable.$inferSelect
	>();
	if (productBusinessIds.length > 0) {
		const owner = await ctx.db
			.select()
			.from(businessTable)
			.where(inArray(businessTable.id, productBusinessIds));
		for (const business of owner) productBusinesses.set(business.id, business);
	}

	const businesses: BusinessCard[] = [];
	const products: ProductCard[] = [];

	for (const row of rows) {
		if (row.business) {
			businesses.push(
				businessCardOf(row.business, {
					categoryName: row.categoryName,
					categoryNameEn: row.categoryNameEn,
					now,
				}),
			);
			continue;
		}

		const product = row.product;
		if (!product) continue; // A favourite whose target is gone. Nothing to render.

		const business = productBusinesses.get(product.businessId);
		if (!business) continue;
		if (!isPublicBusiness(business.status)) continue;

		products.push(productCardOf(product, business, { now }));
	}

	return { businesses, products };
}

/**
 * Heart or un-heart one thing.
 *
 * Exactly one of the two ids, and the response says which state the caller is now in
 * rather than what changed — a client that assumes "it was not favourited, so now it
 * is" gets it wrong on the second tap of a double-tap, and renders an empty heart on
 * something the server just favourited.
 */
export async function toggleFavorite(
	ctx: UserContext,
	input: { businessId?: string; productId?: string },
): Promise<{ favorited: boolean }> {
	if ((input.businessId ? 1 : 0) + (input.productId ? 1 : 0) !== 1) {
		throw new ValidationError("Indica una tienda o un producto, no ambos");
	}

	if (input.businessId) {
		const rows = await ctx.db
			.select({ id: businessTable.id, status: businessTable.status })
			.from(businessTable)
			.where(and(eq(businessTable.id, input.businessId), publicBusiness()))
			.limit(1);
		orNotFound(rows[0]);

		const existing = await ctx.db
			.select({ id: favoriteTable.id })
			.from(favoriteTable)
			.where(
				and(
					eq(favoriteTable.userId, ctx.user.id),
					eq(favoriteTable.businessId, input.businessId),
				),
			)
			.limit(1);

		if (existing[0]) {
			await ctx.db
				.delete(favoriteTable)
				.where(eq(favoriteTable.id, existing[0].id));
			return { favorited: false };
		}

		await ctx.db.insert(favoriteTable).values({
			id: newFavoriteId(),
			userId: ctx.user.id,
			businessId: input.businessId,
			productId: null,
			createdAt: new Date(),
		});

		return { favorited: true };
	}

	const productId = input.productId as string;
	const products = await ctx.db
		.select({ product: productTable, business: businessTable })
		.from(productTable)
		.innerJoin(businessTable, eq(productTable.businessId, businessTable.id))
		.where(
			and(
				eq(productTable.id, productId),
				eq(productTable.status, "ACTIVE"),
				isNull(productTable.archivedAt),
				publicBusiness(),
			),
		)
		.limit(1);
	orNotFound(products[0]);

	const existing = await ctx.db
		.select({ id: favoriteTable.id })
		.from(favoriteTable)
		.where(
			and(
				eq(favoriteTable.userId, ctx.user.id),
				eq(favoriteTable.productId, productId),
			),
		)
		.limit(1);

	if (existing[0]) {
		await ctx.db
			.delete(favoriteTable)
			.where(eq(favoriteTable.id, existing[0].id));
		return { favorited: false };
	}

	await ctx.db.insert(favoriteTable).values({
		id: newFavoriteId(),
		userId: ctx.user.id,
		businessId: null,
		productId,
		createdAt: new Date(),
	});

	return { favorited: true };
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

// `publicBusiness()` — the `where` clause every public business read carries — used to
// live here, which is why `products.ts` grew its own copy of the visibility rule and
// then forgot it. It is in `helpers.ts` now, next to the list of statuses it reads.

/**
 * Public businesses, newest first — or nearest first when the caller sent coordinates.
 *
 * These are two different lists, and only one of them can filter.
 *
 * A business with no coordinates cannot be ranked against one that has them, so it drops
 * out of the distance-ranked list. That rule used to be applied to *both* lists, which is
 * the bug this shape fixes: with no origin `distanceTo` answers `null` for every row, so
 * the filter removed every row and `catalog.feed`'s `nearby` was empty for **every** caller
 * who had not granted location. The home screen draws that list and offers its location
 * prompt from the list's *empty* state, so the prompt was the only thing in the section —
 * and the screen's own docblock promises the opposite: "without coords the API answers
 * with the same shape and `nearby` is the newest businesses instead of the closest."
 *
 * Nothing is dropped in the no-origin branch because there is nothing to drop it from: the
 * order is `createdAt`, which every business has.
 */
async function publicBusinesses(
	db: Db,
	input: { origin: { lat: number; lng: number } | null; limit: number },
): Promise<BusinessCard[]> {
	const rows = await db
		.select({
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(businessTable)
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(publicBusiness())
		.orderBy(
			// Ranked by rating before sorting by distance, because the distance is computed
			// here and not in SQL — see `NEARBY_CANDIDATE_LIMIT` for why the pool is wider
			// than the page. The two orders differ because the lists do: "closest" is not a
			// question a `createdAt` index can answer, and "newest" is not one rating can.
			...(input.origin
				? [desc(businessTable.ratingAvg), desc(businessTable.ratingCount)]
				: [desc(businessTable.createdAt)]),
		)
		.limit(input.origin ? NEARBY_CANDIDATE_LIMIT : input.limit);

	const now = new Date();
	const cards = rows.map((row) =>
		businessCardOf(row.business, {
			categoryName: row.categoryName,
			categoryNameEn: row.categoryNameEn,
			distanceKm: distanceTo(input.origin, row.business.lat, row.business.lng),
			now,
		}),
	);

	if (!input.origin) return cards.slice(0, input.limit);

	return cards
		.filter((card) => card.distanceKm !== null)
		.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
		.slice(0, input.limit);
}

/**
 * How far away a business is, when both ends have coordinates.
 *
 * `boundingBox` is imported so the shape of "near" is the same one `businesses.list`
 * narrows with; the distance itself is `haversineKm`, rounded to two decimals because
 * a card shows "1,2 km" and a float with fourteen digits is a payload nobody reads.
 */
function distanceTo(
	origin: { lat: number; lng: number } | null,
	lat: number | null,
	lng: number | null,
): number | null {
	if (!origin || lat === null || lng === null) return null;
	return roundKm(haversineKm(origin, { lat, lng }));
}

function clampLimit(
	requested: number | undefined,
	fallback: number,
	maximum: number,
): number {
	if (requested === undefined) return fallback;
	return Math.max(1, Math.min(maximum, Math.trunc(requested)));
}

/** Minted here rather than in `@pymeshub/shared/ids` so a client can never choose one. */
function newFavoriteId(): string {
	return `fav_${crypto.randomUUID()}`;
}
