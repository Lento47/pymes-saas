import type { Db } from "@pymeshub/db";
import {
	boundingBox,
	business as businessTable,
	category as categoryTable,
	encodeGeohash,
	haversineKm,
	merchantLocation as locationTable,
	membership as membershipTable,
	orderItem as orderItemTable,
	order as orderTable,
	payout as payoutTable,
	product as productTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type BusinessAnalytics,
	type BusinessCard,
	type BusinessCreateInput,
	type BusinessListInput,
	type BusinessSettings,
	type BusinessStorefront,
	type BusinessUpdateInput,
	type Category,
	decodeCursor,
	encodeCursor,
	isTerminalStatus,
	MARKET_UTC_OFFSET_MINUTES,
	type MembershipRole,
	type MembershipSummary,
	newId,
	ORDER_STATUSES,
	type Payout,
	type StaffMember,
	scoreCandidate,
} from "@pymeshub/shared";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	like,
	lte,
	type SQL,
	sql,
} from "drizzle-orm";

import type { Context } from "../context";
import { ConflictError, ForbiddenError, ValidationError } from "../errors";
import { payoutReferencesFor } from "./admin";
import type { BusinessContext, UserContext } from "./helpers";
import {
	assertRole,
	inCategory,
	isOpenAt,
	likePattern,
	orNotFound,
	PUBLIC_BUSINESS_STATUSES,
	roundKm,
} from "./helpers";
import {
	businessCardOf,
	businessSettingsOf,
	categoryOf,
	currencyOf,
	membershipSummaryOf,
	payoutOf,
	productCardOf,
	staffMemberOf,
} from "./mappers";

/**
 * The tenant's own surface, plus the public storefront.
 *
 * Two rules hold for every function in this file:
 *
 * - **`ctx.membership.businessId` is the only business id used for scoping.** The
 *   input's `businessId` decided which tenant the caller was checked against —
 *   `businessProcedure` does that before this code runs — and from here on the query
 *   uses the membership's copy. Reading the id back out of the input would be the
 *   same value today and a different one the day somebody edits the middleware, and
 *   a service that reads `where id = :id` without `and businessId = :businessId` is
 *   the bug this whole design exists to prevent.
 * - **The public reads never see a DRAFT or a SUSPENDED business.** A draft has not
 *   been published and a suspended one has been taken down. The filter lives inside
 *   the `where` clause rather than in a check after the read, so there is no path
 *   where the row is loaded and then judged.
 */

/**
 * Statuses a customer may see — `PUBLIC_BUSINESS_STATUSES` from `helpers.ts`, declared
 * once there because `catalog.ts` narrows every public read by the same set and two
 * copies of it is how a suspended business survives in one of the two lists.
 */

/**
 * Products and categories a storefront carries before it stops being a shop front and
 * becomes a catalogue — the full list is a cursor away, behind `products.list`.
 */
const STOREFRONT_FEATURED_LIMIT = 12;

/**
 * How many rows a nearby search pulls before it sorts by distance.
 *
 * A bounding box is a square and a geohash is a cell, so this has to hold the
 * businesses inside the customer's radius *plus* the corners of a box that is up to
 * 41% larger than the circle it approximates. At city scale that is tens of rows.
 *
 * The compromise, stated plainly: sorting by a computed distance cannot happen in
 * SQL, so SQL narrows and this sorts. At national scale the narrowing is the first
 * thing to replace — see `packages/db/src/geo.ts`.
 */
export const NEARBY_CANDIDATE_LIMIT = 200;

/** The tuple a business list pages on: the sort key, then the id as a tiebreaker. */
type BusinessCursor = { v: string | number; id: string };

interface BusinessCandidate {
	card: BusinessCard;
	sortValue: string | number;
}

// ---------------------------------------------------------------------------
// The caller's own businesses
// ---------------------------------------------------------------------------

export async function myBusinesses(
	ctx: UserContext,
): Promise<MembershipSummary[]> {
	const rows = await ctx.db
		.select({
			businessId: membershipTable.businessId,
			businessName: businessTable.name,
			businessSlug: businessTable.slug,
			logoUrl: businessTable.logoUrl,
			role: membershipTable.role,
		})
		.from(membershipTable)
		.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
		.where(eq(membershipTable.userId, ctx.user.id));

	// Sorted here rather than in SQL because a switcher lists three rows, and the
	// collation SQLite would use on the name is not the one the clients use.
	return rows
		.sort((a, b) => a.businessName.localeCompare(b.businessName))
		.map(membershipSummaryOf);
}

// ---------------------------------------------------------------------------
// Public storefront
// ---------------------------------------------------------------------------

/**
 * The storefront, in one response: card, hours, `isOpen`, categories, featured.
 *
 * Four reads behind one procedure because a phone opening a shop needs all four at
 * once, and four round trips on one bar of signal is four spinners where there should
 * be one. The pieces stay separate inside the shape so a screen can draw the header
 * before the grid without asking for either again.
 */
export async function bySlug(
	ctx: Context,
	input: { slug: string },
): Promise<BusinessStorefront> {
	const rows = await ctx.db
		.select({
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(businessTable)
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(
			and(
				eq(businessTable.slug, input.slug),
				inArray(businessTable.status, [...PUBLIC_BUSINESS_STATUSES]),
			),
		)
		.limit(1);

	// A draft business and a business that does not exist answer identically, which is
	// the rule `orders.byId` follows too: a probe learns nothing from the difference.
	const row = orNotFound(rows[0]);
	const now = new Date();

	const [categories, featured] = await Promise.all([
		storefrontCategories(ctx.db, row.business.id),
		activeProductsOf(ctx.db, row.business.id, true),
	]);

	// A shop that has marked nothing featured still needs a grid: an empty product
	// area reads as a broken page, not as an untagged catalogue.
	const shown =
		featured.length > 0
			? featured
			: await activeProductsOf(ctx.db, row.business.id, false);

	return {
		card: businessCardOf(row.business, {
			categoryName: row.categoryName,
			categoryNameEn: row.categoryNameEn,
			now,
		}),
		hours: row.business.hours ?? [],
		isOpen: isOpenAt(row.business.hours, now),
		categories,
		featured: shown.map((product) =>
			productCardOf(product, row.business, { now }),
		),
	};
}

async function activeProductsOf(
	db: Db,
	businessId: string,
	featuredOnly: boolean,
) {
	return db
		.select()
		.from(productTable)
		.where(
			and(
				eq(productTable.businessId, businessId),
				eq(productTable.status, "ACTIVE"),
				...(featuredOnly ? [eq(productTable.isFeatured, true)] : []),
			),
		)
		.orderBy(desc(productTable.sortOrder), desc(productTable.createdAt))
		.limit(STOREFRONT_FEATURED_LIMIT);
}

async function storefrontCategories(
	db: Db,
	businessId: string,
): Promise<Category[]> {
	const rows = await db
		.select({
			category: categoryTable,
			productCount: sql<number>`count(${productTable.id})`,
		})
		.from(productTable)
		.innerJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
		.where(
			and(
				eq(productTable.businessId, businessId),
				eq(productTable.status, "ACTIVE"),
			),
		)
		.groupBy(categoryTable.id)
		.orderBy(asc(categoryTable.sortOrder), asc(categoryTable.name));

	return rows.map((row) => categoryOf(row.category, Number(row.productCount)));
}

/**
 * Browse businesses, optionally near a point.
 *
 * The narrow-then-sort shape is described at `NEARBY_CANDIDATE_LIMIT`. Worth stating
 * separately is the ordering rule when the customer sent no coordinates: there is no
 * distance, so `sort: "distance"` degrades to rating rather than to an arbitrary
 * order. A list that silently returns rows in rowid order looks random, and the client
 * asked for "nearest" because it wants the most useful row first.
 *
 * **What `sort: "best"` is, and is not.** It reorders the candidates this function
 * already retrieved — it is not a search of every business in the database, and it
 * cannot surface a shop the geo retrieval never returned. The retrieval is the geohash
 * box (see `packages/db/src/geo.ts`), so a better scorer cannot fix a shop that was
 * never a candidate: that limit is the first thing to measure, and `CandidateRecall@K`
 * is what measures it. The scorer itself is `scoreCandidate` in `@pymeshub/shared`, and
 * the reasons it orders the way it does are written down there.
 *
 * Eligibility is the caller's, not the ranker's: the filters above (`status`, category,
 * `deliveryOnly`, `openNow`, radius) decide who is in the list, and `best` only decides
 * their order. A closed shop is therefore *filtered* by `openNow` when the customer asks
 * for it — never quietly demoted by a score, which would be a shop that keeps appearing
 * without ever being orderable.
 */
export async function list(
	ctx: Context,
	input: BusinessListInput,
): Promise<{ items: BusinessCard[]; nextCursor: string | null }> {
	const now = new Date();
	const conditions = [
		inArray(businessTable.status, [...PUBLIC_BUSINESS_STATUSES]),
	];

	// A sector means the categories under it as well — see `inCategory`. A shop is filed
	// under a leaf, so the equality this replaced answered an empty list for "Food &
	// Beverage" while the shops it holds were open.
	if (input.categoryId)
		conditions.push(inCategory(businessTable.categoryId, input.categoryId));
	if (input.deliveryOnly)
		conditions.push(eq(businessTable.deliveryEnabled, true));
	if (input.search)
		conditions.push(like(businessTable.name, likePattern(input.search)));

	const origin =
		input.lat !== undefined && input.lng !== undefined
			? { lat: input.lat, lng: input.lng }
			: null;

	if (origin) {
		// A square, then a circle: the box narrows in SQL, the haversine check below
		// rejects the corners. Without the second step a customer at the centre of a
		// 10 km box sees shops 14 km away.
		const box = boundingBox(origin.lat, origin.lng, input.radiusKm);
		conditions.push(
			gte(businessTable.lat, box.minLat),
			lte(businessTable.lat, box.maxLat),
			gte(businessTable.lng, box.minLng),
			lte(businessTable.lng, box.maxLng),
			// A shop with no coordinates is not in anybody's radius, and the loop below drops
			// it — but it would drop it *after* the limit, spending candidate slots on rows
			// that can never appear in a distance-ranked answer. Filtering here keeps those
			// slots for shops that can.
			isNotNull(businessTable.lat),
			isNotNull(businessTable.lng),
		);
	}

	const rows = await ctx.db
		.select({
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(businessTable)
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(and(...conditions))
		.orderBy(...truncationOrderFor(input.sort, origin))
		.limit(NEARBY_CANDIDATE_LIMIT);

	const candidates: BusinessCandidate[] = [];
	for (const row of rows) {
		let distanceKm: number | null = null;

		if (origin) {
			// A business with no coordinates is not in anybody's radius. Letting it
			// through would put a shop with no address at the top of a "nearest" list.
			if (row.business.lat === null || row.business.lng === null) continue;
			distanceKm = roundKm(
				haversineKm(origin, { lat: row.business.lat, lng: row.business.lng }),
			);
			if (distanceKm > input.radiusKm) continue;
		}

		const card = businessCardOf(row.business, {
			categoryName: row.categoryName,
			categoryNameEn: row.categoryNameEn,
			distanceKm,
			now,
		});

		if (input.openNow && !card.isOpen) continue;

		candidates.push({
			card,
			sortValue: sortValueOf(input.sort, row.business, distanceKm, {
				nowMs: now.getTime(),
			}),
		});
	}

	candidates.sort((a, b) => compareCandidates(a, b, input.sort));

	// The cursor is a `(sortValue, id)` tuple compared with the very comparator the list
	// is ordered by, so a page boundary cannot skip or repeat a row — which is why
	// `pagination.ts` refuses to page a feed on an id alone.
	const cursor = decodeCursor<BusinessCursor>(input.cursor);
	const remaining = cursor
		? candidates.filter((entry) => isAfterCursor(entry, cursor, input.sort))
		: candidates;

	const page = remaining.slice(0, input.limit);
	const last = page[page.length - 1];

	return {
		items: page.map((entry) => entry.card),
		nextCursor:
			remaining.length > input.limit && last
				? encodeCursor({ v: last.sortValue, id: last.card.id })
				: null,
	};
}

/**
 * The order rows are *fetched* in, which is not the order they come back in.
 *
 * The answer is sorted in JavaScript below, because a computed distance cannot be sorted in
 * SQL — so this decides only which `NEARBY_CANDIDATE_LIMIT` rows survive the limit. Without
 * it SQLite answers in whatever order it likes, and a dense neighbourhood loses its nearest
 * shop to a cut that was never chosen: the row that would have been first is simply not in
 * the set, and nothing in the response says so.
 *
 * The rule is "truncate by the sort the caller asked for, using the column that best
 * approximates it in SQL" — so a `newest` list keeps its newest rows rather than its nearest
 * ones, which is the difference between a cut that approximates the answer and one that
 * quietly answers a different question. Distance is the one sort with no column: it is the
 * squared equirectangular distance, with no `cos(lat)` correction, because the correction
 * costs about 1% in Costa Rica and buys nothing an ordering needs — `haversineKm` still
 * decides both the displayed distance and the radius. `best` is truncated the same way, since
 * proximity is its largest single weight and the pool is already bounded by the radius.
 *
 * `id` is the tiebreak everywhere, so the cut is reproducible: two requests that truncate the
 * same set truncate it the same way, and a page boundary cannot land inside a different cut.
 */
function truncationOrderFor(
	sort: BusinessListInput["sort"],
	origin: { lat: number; lng: number } | null,
): SQL[] {
	if (origin && (sort === "distance" || sort === "best")) {
		return [
			sql`(${businessTable.lat} - ${origin.lat}) * (${businessTable.lat} - ${origin.lat}) + (${businessTable.lng} - ${origin.lng}) * (${businessTable.lng} - ${origin.lng})`,
			asc(businessTable.id),
		];
	}

	switch (sort) {
		case "popular":
			return [desc(businessTable.ratingCount), asc(businessTable.id)];
		case "newest":
			return [desc(businessTable.createdAt), asc(businessTable.id)];
		default:
			// `rating`, and `best` for a caller who sent no coordinates — which is also where
			// `distance` degrades to the rating. With no origin, proximity is not a signal at
			// all, so the quality signals are what is left to cut by.
			return [desc(businessTable.ratingAvg), asc(businessTable.id)];
	}
}

function sortValueOf(
	sort: BusinessListInput["sort"],
	row: {
		id: string;
		ratingAvg: number;
		ratingCount: number;
		createdAt: Date;
	},
	distanceKm: number | null,
	ranking: { nowMs: number },
): string | number {
	switch (sort) {
		case "distance":
			// Only reachable with `distanceKm` null when the caller sent no coordinates,
			// and then the rating stands in. See `list`.
			return distanceKm ?? row.ratingAvg;
		case "rating":
			return row.ratingAvg;
		case "popular":
			// Review count rather than an order count: `business` carries no sold counter,
			// and a review is the only public signal of a shop being used. Stated because
			// it is a proxy for the label rather than the number the label names.
			return row.ratingCount;
		case "newest":
			return row.createdAt.getTime();
		case "best":
			// The score *is* the sort key, so the cursor pages on `(score, id)` with no new
			// machinery — and `businessDirection` already reads a descending sort, which is
			// what a score is.
			//
			// The score has to be identical on the second request or a page boundary repeats
			// or skips a row, which is why `nowMs` is passed in rather than read: today only
			// distance and rating feed the sum and neither depends on it. Once preparation
			// counts arrive that stops being true — their *age* enters the score through a
			// freshness decay — and the fix is a per-request ranking snapshot (one `now` for
			// the whole walk, carried with the cursor), not a wider rounding. Noted here
			// because the failure it prevents is a duplicated shop three pages in, which no
			// single-page test can see.
			return scoreCandidate(
				{
					id: row.id,
					distanceKm,
					ratingAvg: row.ratingAvg,
					ratingCount: row.ratingCount,
					// The projection that counts on-time preparations is not wired yet, so this
					// signal sits on its prior. That is the substitution rule doing its job rather
					// than a stub: `best` is honest with two signals and gets sharper when the
					// counts land, with no change to the ordering code.
					prep: null,
				},
				{ nowMs: ranking.nowMs },
			).score;
	}
}

/** Distance sorts best-first ascending; stars and reviews sort descending. */
function businessDirection(sort: BusinessListInput["sort"]): 1 | -1 {
	return sort === "distance" ? 1 : -1;
}

function compareCandidates(
	a: BusinessCandidate,
	b: BusinessCandidate,
	sort: BusinessListInput["sort"],
): number {
	const direction = businessDirection(sort);
	if (a.sortValue !== b.sortValue)
		return a.sortValue < b.sortValue ? -direction : direction;
	return a.card.id < b.card.id ? -1 : 1;
}

/** True when the candidate falls strictly after the cursor's own row. */
function isAfterCursor(
	candidate: BusinessCandidate,
	cursor: BusinessCursor,
	sort: BusinessListInput["sort"],
): boolean {
	const direction = businessDirection(sort);
	if (candidate.sortValue !== cursor.v) {
		return candidate.sortValue < cursor.v ? -direction > 0 : direction > 0;
	}
	// Equal sort keys: the id breaks the tie, and the cursor's own row must not repeat.
	return candidate.card.id > cursor.id;
}

// ---------------------------------------------------------------------------
// Settings — the member's view
// ---------------------------------------------------------------------------

export async function settings(
	ctx: BusinessContext,
	_input: { businessId: string },
): Promise<BusinessSettings> {
	return settingsOf(ctx, ctx.membership.businessId);
}

async function settingsOf(
	ctx: BusinessContext,
	businessId: string,
): Promise<BusinessSettings> {
	const rows = await ctx.db
		.select({
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(businessTable)
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(eq(businessTable.id, businessId))
		.limit(1);

	const row = orNotFound(rows[0]);
	return businessSettingsOf(row.business, {
		categoryName: row.categoryName,
		categoryNameEn: row.categoryNameEn,
	});
}

/**
 * Edit the business's own settings.
 *
 * The patch is built only from the keys the caller actually sent, so a form that posts
 * three fields cannot blank the other twenty. `currency` and `slug` are not in
 * `businessUpdateInput` at all: a currency change would reinterpret every historical
 * order, and a slug change would break every printed QR code.
 */
export async function update(
	ctx: BusinessContext,
	input: BusinessUpdateInput & { businessId: string },
): Promise<BusinessSettings> {
	const businessId = ctx.membership.businessId;
	const patch: Partial<typeof businessTable.$inferInsert> = {
		updatedAt: new Date(),
	};

	assignIfPresent(patch, "name", input.name);
	assignIfPresent(patch, "description", input.description);
	assignIfPresent(patch, "categoryId", input.categoryId);
	assignIfPresent(patch, "phone", input.phone);
	assignIfPresent(patch, "email", input.email);
	assignIfPresent(patch, "line1", input.line1);
	assignIfPresent(patch, "line2", input.line2);
	assignIfPresent(patch, "city", input.city);
	assignIfPresent(patch, "region", input.region);
	assignIfPresent(patch, "country", input.country);
	assignIfPresent(patch, "postalCode", input.postalCode);
	assignIfPresent(patch, "logoUrl", input.logoUrl);
	assignIfPresent(patch, "coverUrl", input.coverUrl);
	assignIfPresent(patch, "deliveryEnabled", input.deliveryEnabled);
	assignIfPresent(patch, "pickupEnabled", input.pickupEnabled);
	assignIfPresent(patch, "deliveryFeeMinor", input.deliveryFeeMinor);
	assignIfPresent(patch, "deliveryRadiusKm", input.deliveryRadiusKm);
	assignIfPresent(patch, "prepTimeMinutes", input.prepTimeMinutes);
	assignIfPresent(patch, "minOrderMinor", input.minOrderMinor);
	if (input.hours !== undefined) patch.hours = input.hours;

	// The same rule as `create`, on the one path that can move a shop afterwards. `categoryId`
	// stays optional here because `businessUpdateInput` is `businessCreateInput.partial()` and
	// every field on the settings form is optional by design — a shop that has not set one yet
	// is edited without being forced through this first.
	if (input.categoryId !== undefined)
		await assertLeafCategory(ctx, input.categoryId);

	// Moving the shop moves its geohash, or a customer standing outside it would not
	// find it. Both coordinates are resolved before either is written: a patch that
	// sets only `lat` still has to produce a hash for the pair.
	if (input.lat !== undefined || input.lng !== undefined) {
		const current = await ctx.db
			.select({ lat: businessTable.lat, lng: businessTable.lng })
			.from(businessTable)
			.where(eq(businessTable.id, businessId))
			.limit(1);

		const existing = orNotFound(current[0]);
		const lat = input.lat ?? existing.lat;
		const lng = input.lng ?? existing.lng;

		patch.lat = lat;
		patch.lng = lng;
		patch.geohash =
			lat !== null && lng !== null ? encodeGeohash(lat, lng) : null;
	}

	const defaultLocationPatch: Partial<typeof locationTable.$inferInsert> = {
		updatedAt: patch.updatedAt,
	};
	assignIfPresent(defaultLocationPatch, "name", input.name);
	assignIfPresent(defaultLocationPatch, "line1", input.line1);
	assignIfPresent(defaultLocationPatch, "line2", input.line2);
	assignIfPresent(defaultLocationPatch, "city", input.city);
	assignIfPresent(defaultLocationPatch, "region", input.region);
	assignIfPresent(defaultLocationPatch, "country", input.country);
	assignIfPresent(defaultLocationPatch, "postalCode", input.postalCode);
	if (patch.lat !== undefined) defaultLocationPatch.lat = patch.lat;
	if (patch.lng !== undefined) defaultLocationPatch.lng = patch.lng;
	await ctx.db.batch([
		ctx.db
			.update(businessTable)
			.set(patch)
			.where(eq(businessTable.id, businessId)),
		ctx.db
			.update(locationTable)
			.set(defaultLocationPatch)
			.where(
				and(
					eq(locationTable.businessId, businessId),
					eq(locationTable.isDefault, true),
				),
			),
	]);

	return settingsOf(ctx, businessId);
}

/**
 * Assign only what the caller sent.
 *
 * Drizzle already skips `undefined`, but the intent is worth spelling out: an explicit
 * `null` from a form — "clear the cover image" — is a value, and must not be confused
 * with a field the caller never mentioned.
 */
function assignIfPresent<T extends object, K extends keyof T>(
	patch: T,
	key: K,
	value: T[K] | undefined,
): void {
	if (value !== undefined) patch[key] = value;
}

/**
 * The category a shop may be filed under, or a refusal.
 *
 * A **leaf** of the taxonomy and nothing else: an active row that has a parent. A sector is
 * refused because `businesses.list` already reads a sector as "this sector and the categories
 * under it" (`inCategory`) — a shop filed on the sector itself would answer for every child it
 * has nothing to do with. An inactive row is refused because `catalog.categories` never sends
 * one, so the id could only have come from a client holding a list that has since changed.
 *
 * The check is here rather than in `businessCreateInput` because zod cannot read a table. It is
 * not redundant with the foreign key either: `business.category_id` references `category(id)`,
 * and a sector satisfies that reference exactly as well as a leaf does.
 */
async function assertLeafCategory(
	ctx: { db: Db },
	categoryId: string,
): Promise<void> {
	const found = await ctx.db
		.select({ id: categoryTable.id })
		.from(categoryTable)
		.where(
			and(
				eq(categoryTable.id, categoryId),
				eq(categoryTable.isActive, true),
				isNotNull(categoryTable.parentId),
			),
		)
		.limit(1);

	if (found.length === 0)
		throw new ValidationError("Elige una categoría de la lista", {
			field: "categoryId",
		});
}

/**
 * Open a business. The caller becomes its OWNER.
 *
 * Business and membership are written in one `batch`: a business whose owner
 * membership did not land is a tenant nobody can administer.
 *
 * It starts DRAFT and is published through `business.setStatus`. A shop that went live
 * the instant its name was typed is a shop with no address, no hours and no products,
 * which is worse for the customer than a shop that is not there yet.
 */
export async function create(
	ctx: UserContext,
	input: BusinessCreateInput,
): Promise<BusinessSettings> {
	const now = new Date();
	const id = newBusinessId();
	const slug = await uniqueSlug(ctx, input.slug ?? slugify(input.name));
	const located = input.lat !== undefined && input.lng !== undefined;

	await assertLeafCategory(ctx, input.categoryId);

	// Narrowed into locals so the write below reads a `number` and not a `number |
	// undefined`: `noUncheckedIndexedAccess` is off for these, but the pair still has to
	// be proven together to build a hash from them.
	const lat = input.lat ?? null;
	const lng = input.lng ?? null;

	await ctx.db.batch([
		ctx.db.insert(businessTable).values({
			id,
			slug,
			name: input.name,
			description: input.description ?? null,
			categoryId: input.categoryId,
			phone: input.phone ?? null,
			email: input.email ?? null,
			line1: input.line1,
			line2: input.line2 ?? null,
			city: input.city,
			region: input.region,
			country: input.country,
			postalCode: input.postalCode ?? null,
			lat,
			lng,
			geohash:
				located && lat !== null && lng !== null
					? encodeGeohash(lat, lng)
					: null,
			currency: input.currency,
			status: "DRAFT",
			deliveryEnabled: input.deliveryEnabled,
			pickupEnabled: input.pickupEnabled,
			deliveryFeeMinor: input.deliveryFeeMinor,
			deliveryRadiusKm: input.deliveryRadiusKm,
			prepTimeMinutes: input.prepTimeMinutes,
			minOrderMinor: input.minOrderMinor,
			createdAt: now,
			updatedAt: now,
		}),
		ctx.db.insert(membershipTable).values({
			id: newMembershipId(),
			businessId: id,
			userId: ctx.user.id,
			role: "OWNER",
			createdAt: now,
		}),
		ctx.db.insert(locationTable).values({
			id: newId("location"),
			businessId: id,
			name: input.name,
			isDefault: true,
			line1: input.line1,
			line2: input.line2 ?? null,
			city: input.city,
			region: input.region,
			country: input.country,
			postalCode: input.postalCode ?? null,
			lat,
			lng,
			createdAt: now,
			updatedAt: now,
		}),
	]);

	// The membership exists, but `ctx` was built before this request wrote it, so the
	// read below runs without `businessProcedure`. Safe here and only here: the id is
	// one this request minted, for a row it just wrote.
	const rows = await ctx.db
		.select({
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(businessTable)
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(eq(businessTable.id, id))
		.limit(1);

	const row = orNotFound(rows[0]);
	return businessSettingsOf(row.business, {
		categoryName: row.categoryName,
		categoryNameEn: row.categoryNameEn,
	});
}

/**
 * Publish or close the shop.
 *
 * ACTIVE and CLOSED only. SUSPENDED is a platform decision that no owner may set or
 * clear — an owner who could lift their own suspension is a suspension that means
 * nothing — and it belongs to the admin surface alone. DRAFT→ACTIVE is the publication
 * step this procedure exists for.
 */
export async function setStatus(
	ctx: BusinessContext,
	input: { businessId: string; status: "ACTIVE" | "CLOSED" },
): Promise<BusinessSettings> {
	const businessId = ctx.membership.businessId;

	if (input.status !== "ACTIVE" && input.status !== "CLOSED") {
		throw new ValidationError(
			"Un negocio sólo puede abrirse o cerrarse desde aquí",
		);
	}

	const current = await ctx.db
		.select({ status: businessTable.status })
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);

	if (orNotFound(current[0]).status === "SUSPENDED") {
		throw new ForbiddenError("Este negocio está suspendido por PymesHub");
	}

	await ctx.db
		.update(businessTable)
		.set({ status: input.status, updatedAt: new Date() })
		.where(eq(businessTable.id, businessId));

	return settingsOf(ctx, businessId);
}

// ---------------------------------------------------------------------------
// The team
// ---------------------------------------------------------------------------

export async function staff(ctx: BusinessContext): Promise<StaffMember[]> {
	const rows = await ctx.db
		.select({
			membership: membershipTable,
			user: {
				id: userTable.id,
				name: userTable.name,
				email: userTable.email,
				image: userTable.image,
			},
		})
		.from(membershipTable)
		.innerJoin(userTable, eq(membershipTable.userId, userTable.id))
		.where(eq(membershipTable.businessId, ctx.membership.businessId));

	// OWNER first, then MANAGER, then STAFF, then COURIER. The list is a
	// permission ladder, and sorting it alphabetically buries the person who
	// can fix the account. The courier rides last: they can move their own
	// runs and read the board, and nothing else.
	const rank: Record<MembershipRole, number> = {
		OWNER: 0,
		MANAGER: 1,
		STAFF: 2,
		COURIER: 3,
	};
	return rows
		.sort(
			(a, b) =>
				rank[a.membership.role] - rank[b.membership.role] ||
				a.user.name.localeCompare(b.user.name),
		)
		.map((row) => staffMemberOf(row.membership, row.user));
}

/**
 * Add an existing PymesHub user to the team.
 *
 * Staff can be added from an existing account. A courier is different: their profile
 * must be reviewed and they must accept an in-app invitation before a membership exists.
 * The COURIER refusal here is deliberate — it keeps this legacy email path from becoming
 * a second way around that consent boundary.
 */
export async function inviteStaff(
	ctx: BusinessContext,
	input: { businessId: string; email: string; role: MembershipRole },
): Promise<StaffMember> {
	if (input.role === "COURIER") {
		throw new ValidationError(
			"Los repartidores se invitaran desde el directorio de la app",
		);
	}

	const businessId = ctx.membership.businessId;

	// Creating another OWNER is handing over the business, so `staff:manage` — which a
	// MANAGER also holds — is not enough for that one case.
	if (input.role === "OWNER") assertRole(ctx, "OWNER");

	const invitee = await ctx.db
		.select()
		.from(userTable)
		.where(eq(userTable.email, input.email))
		.limit(1);

	const user = invitee[0];
	if (!user) {
		// Deliberately not a `NotFoundError`: the manager typed an address and needs to
		// be told it has no account, which is actionable rather than a dead end. The rate
		// limit is what keeps this from being an enumeration oracle.
		throw new ValidationError(
			"Esa persona todavía no tiene cuenta en PymesHub",
			{
				email: input.email,
			},
		);
	}

	const existing = await ctx.db
		.select({ id: membershipTable.id })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, user.id),
			),
		)
		.limit(1);

	if (existing[0])
		throw new ConflictError("Esa persona ya forma parte del equipo");

	const now = new Date();
	const id = newMembershipId();

	await ctx.db.insert(membershipTable).values({
		id,
		businessId,
		userId: user.id,
		role: input.role,
		createdAt: now,
	});

	return staffMemberOf(
		{ id, businessId, userId: user.id, role: input.role, createdAt: now },
		user,
	);
}

/**
 * Change somebody's role. OWNER only.
 *
 * `staff:manage` belongs to MANAGER as well, so the gate in the middleware is not
 * enough on its own. Demoting the last OWNER is refused for the same reason removing
 * them is: it leaves a business nobody can administer, and the state is unreachable
 * from the UI afterwards.
 */
export async function updateStaffRole(
	ctx: BusinessContext,
	input: { businessId: string; userId: string; role: MembershipRole },
): Promise<StaffMember> {
	assertRole(ctx, "OWNER");
	if (input.role === "COURIER") {
		throw new ValidationError(
			"Los repartidores deben aceptar una invitacion del directorio",
		);
	}
	const businessId = ctx.membership.businessId;

	const target = await ctx.db
		.select({ membership: membershipTable, user: userTable })
		.from(membershipTable)
		.innerJoin(userTable, eq(membershipTable.userId, userTable.id))
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, input.userId),
			),
		)
		.limit(1);

	const row = orNotFound(target[0]);

	if (row.membership.role === "OWNER" && input.role !== "OWNER") {
		await assertNotLastOwner(ctx, businessId, input.userId);
	}

	await ctx.db
		.update(membershipTable)
		.set({ role: input.role })
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, input.userId),
			),
		);

	return staffMemberOf({ ...row.membership, role: input.role }, row.user);
}

/**
 * Remove somebody from the team. OWNER only, and never the last one.
 *
 * The last-owner check runs in the same request as the delete, which is weaker than a
 * constraint and worth saying so: two owners removed concurrently would each see the
 * other in the count. Accepting that gap is deliberate — the lock that closes it is a
 * transaction D1 does not offer from here, and the consequence is a state an admin can
 * repair rather than one a customer sees.
 */
export async function removeStaff(
	ctx: BusinessContext,
	input: { businessId: string; userId: string },
): Promise<{ ok: true }> {
	assertRole(ctx, "OWNER");
	const businessId = ctx.membership.businessId;

	const target = await ctx.db
		.select()
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, input.userId),
			),
		)
		.limit(1);

	const membership = orNotFound(target[0]);
	if (membership.role === "OWNER")
		await assertNotLastOwner(ctx, businessId, input.userId);

	// By membership id, which was read under both `businessId` and `userId`: the delete
	// cannot reach a row in another tenant, even if the two inputs disagreed.
	await ctx.db
		.delete(membershipTable)
		.where(eq(membershipTable.id, membership.id));

	return { ok: true };
}

async function assertNotLastOwner(
	ctx: BusinessContext,
	businessId: string,
	excludedUserId: string,
): Promise<void> {
	const owners = await ctx.db
		.select({ userId: membershipTable.userId })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.role, "OWNER"),
			),
		);

	if (owners.every((owner) => owner.userId === excludedUserId)) {
		throw new ConflictError("Un negocio debe tener al menos un propietario");
	}
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/** Statuses still in flight: every non-terminal one, by the machine's own rule. */
const ACTIVE_STATUSES = ORDER_STATUSES.filter(
	(status) => !isTerminalStatus(status),
);

/**
 * What one location did over a window the business chooses.
 *
 * Every figure is a count or a stored amount — nothing is projected, and nothing is
 * summed across currencies because a business has exactly one. Only completed orders
 * are sales; orders still in flight and cancelled orders remain visible in order counts.
 */
export async function analytics(
	ctx: BusinessContext,
	input: {
		businessId: string;
		locationId: string;
		from: Date;
		to: Date;
		/** The series' bucket width; the router defaults it to `"day"`. */
		granularity?: "hour" | "day" | "month";
	},
): Promise<BusinessAnalytics> {
	const businessId = ctx.membership.businessId;
	const location = await ctx.db
		.select({ id: locationTable.id })
		.from(locationTable)
		.where(
			and(
				eq(locationTable.id, input.locationId),
				eq(locationTable.businessId, businessId),
			),
		)
		.limit(1);
	orNotFound(location[0]);

	const current = await ctx.db
		.select({ currency: businessTable.currency })
		.from(businessTable)
		.where(eq(businessTable.id, businessId))
		.limit(1);
	const currency = orNotFound(current[0]).currency;

	const inWindow = and(
		eq(orderTable.businessId, businessId),
		eq(orderTable.locationId, input.locationId),
		gte(orderTable.placedAt, input.from),
		lte(orderTable.placedAt, input.to),
	);

	const [
		totals,
		completedSales,
		activeCount,
		salesAndOperations,
		ordersByDay,
		topProducts,
	] = await Promise.all([
		ctx.db
			.select({
				total: sql<number>`count(*)`,
				completed: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' then 1 else 0 end), 0)`,
				cancelled: sql<number>`coalesce(sum(case when ${orderTable.status} in ('CANCELLED','REJECTED') then 1 else 0 end), 0)`,
			})
			.from(orderTable)
			.where(inWindow),
		ctx.db
			.select({
				grossMinor: sql<number>`coalesce(sum(${orderTable.totalMinor}), 0)`,
				orderCount: sql<number>`count(*)`,
			})
			.from(orderTable)
			.where(and(inWindow, eq(orderTable.status, "COMPLETED")))
			// Grouped by customer rather than returned per order, so the repeat-customer
			// count comes from the same completed rows as revenue instead of a second
			// pass that could disagree with it.
			.groupBy(orderTable.customerId),
		ctx.db
			.select({ count: sql<number>`count(*)` })
			.from(orderTable)
			.where(and(inWindow, inArray(orderTable.status, [...ACTIVE_STATUSES]))),
		ctx.db
			.select({
				accepted: sql<number>`coalesce(sum(case when ${orderTable.acceptedAt} is not null then 1 else 0 end), 0)`,
				refundsMinor: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' and ${orderTable.paymentStatus} = 'REFUNDED' then ${orderTable.totalMinor} else 0 end), 0)`,
				discountsMinor: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' then ${orderTable.discountMinor} else 0 end), 0)`,
				avgAcceptSeconds: sql<
					number | null
				>`avg(case when ${orderTable.acceptedAt} is not null then (${orderTable.acceptedAt} - ${orderTable.placedAt}) / 1000.0 end)`,
				avgPreparationSeconds: sql<
					number | null
				>`avg(case when ${orderTable.acceptedAt} is not null and ${orderTable.readyAt} is not null then (${orderTable.readyAt} - ${orderTable.acceptedAt}) / 1000.0 end)`,
			})
			.from(orderTable)
			.where(inWindow),
		ordersByDayOf(
			ctx.db,
			businessId,
			input.locationId,
			input.from,
			input.to,
			input.granularity,
		),
		topProductsOf(ctx.db, businessId, input.locationId, input.from, input.to),
	]);

	const row = totals[0] ?? { total: 0, completed: 0, cancelled: 0 };
	const grossMinor = completedSales.reduce(
		(sum, entry) => sum + Number(entry.grossMinor),
		0,
	);
	const completedOrders = completedSales.reduce(
		(sum, entry) => sum + Number(entry.orderCount),
		0,
	);
	const refundsMinor = Number(salesAndOperations[0]?.refundsMinor ?? 0);

	return {
		from: input.from,
		to: input.to,
		currency: currencyOf(currency),
		sales: {
			refunds_minor: refundsMinor,
			discounts_minor: Number(salesAndOperations[0]?.discountsMinor ?? 0),
		},
		orders: {
			total: Number(row.total),
			accepted: Number(salesAndOperations[0]?.accepted ?? 0),
			completed: Number(row.completed),
			cancelled: Number(row.cancelled),
			active: Number(activeCount[0]?.count ?? 0),
		},
		revenue: {
			grossMinor,
			netMinor: Math.max(0, grossMinor - refundsMinor),
		},
		operations: {
			avg_accept_seconds:
				salesAndOperations[0]?.avgAcceptSeconds == null
					? null
					: Math.round(Number(salesAndOperations[0].avgAcceptSeconds)),
			avg_preparation_seconds:
				salesAndOperations[0]?.avgPreparationSeconds == null
					? null
					: Math.round(Number(salesAndOperations[0].avgPreparationSeconds)),
		},
		// Null rather than zero over an empty window: "₡0 average" reads as a collapse,
		// and the truth is that nothing happened.
		averageOrderMinor:
			completedOrders > 0 ? Math.round(grossMinor / completedOrders) : null,
		customers: {
			total: completedSales.length,
			repeat: completedSales.filter((entry) => Number(entry.orderCount) > 1)
				.length,
		},
		ordersByDay,
		topProducts,
	};
}

/**
 * The `strftime` picture per granularity — and therefore the shape of the bucket key the
 * client labels its axis with: an hourly read returns `YYYY-MM-DD HH:00`, a monthly read
 * `YYYY-MM`, and the day every existing caller asks for stays exactly `YYYY-MM-DD`. The
 * name stays `ordersByDay` in the response because the schema's contract is "a series of
 * ordered buckets", not a date width; the width is the caller's own question, echoed by
 * the buckets themselves.
 */
const BUCKET_PICTURE: Record<"hour" | "day" | "month", string> = {
	hour: "%Y-%m-%d %H:00",
	day: "%Y-%m-%d",
	month: "%Y-%m",
};

async function ordersByDayOf(
	db: Db,
	businessId: string,
	locationId: string,
	from: Date,
	to: Date,
	granularity: "hour" | "day" | "month" = "day",
): Promise<BusinessAnalytics["ordersByDay"]> {
	const rows = await db
		.select({
			// The selected location's orders are bucketed by Costa Rica wall time at the
			// caller's granularity.
			day: sql<string>`strftime(${BUCKET_PICTURE[granularity]}, ${orderTable.placedAt} / 1000, 'unixepoch', ${`${MARKET_UTC_OFFSET_MINUTES} minutes`})`,
			orderCount: sql<number>`count(*)`,
			revenueMinor: sql<number>`coalesce(sum(case when ${orderTable.status} = 'COMPLETED' then ${orderTable.totalMinor} else 0 end), 0)`,
		})
		.from(orderTable)
		.where(
			and(
				eq(orderTable.businessId, businessId),
				eq(orderTable.locationId, locationId),
				gte(orderTable.placedAt, from),
				lte(orderTable.placedAt, to),
			),
		)
		// Grouped and ordered by the day expression by *position*, so the three copies of
		// it cannot drift apart.
		.groupBy(sql`1`)
		.orderBy(sql`1 asc`);

	return rows.map((row) => ({
		day: row.day,
		orderCount: Number(row.orderCount),
		revenueMinor: Number(row.revenueMinor),
	}));
}

async function topProductsOf(
	db: Db,
	businessId: string,
	locationId: string,
	from: Date,
	to: Date,
): Promise<BusinessAnalytics["topProducts"]> {
	const rows = await db
		.select({
			productId: orderItemTable.productId,
			name: orderItemTable.nameSnapshot,
			quantity: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)`,
			revenueMinor: sql<number>`coalesce(sum(${orderItemTable.lineTotalMinor}), 0)`,
		})
		.from(orderItemTable)
		.innerJoin(orderTable, eq(orderItemTable.orderId, orderTable.id))
		.where(
			and(
				eq(orderTable.businessId, businessId),
				eq(orderTable.locationId, locationId),
				gte(orderTable.placedAt, from),
				lte(orderTable.placedAt, to),
				eq(orderTable.status, "COMPLETED"),
			),
		)
		// Grouped by the snapshot name as well as the id: an archived product keeps its
		// lines, and a product renamed twice in a window would otherwise collapse into one
		// row carrying whichever name the database happened to pick.
		.groupBy(orderItemTable.productId, orderItemTable.nameSnapshot)
		.orderBy(sql`3 desc`)
		.limit(10);

	return rows.map((row) => ({
		productId: row.productId,
		name: row.name,
		quantity: Number(row.quantity),
		revenueMinor: Number(row.revenueMinor),
	}));
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

/**
 * The business's payout runs. OWNER, via `payouts:read`.
 *
 * `orderCount` is not a column: it is the number of orders in the payout's own period,
 * counted from `order` rather than stored, so it cannot drift from the orders it
 * describes.
 */
export async function listPayouts(
	ctx: BusinessContext,
	_input: { businessId: string },
): Promise<Payout[]> {
	const businessId = ctx.membership.businessId;

	const rows = await ctx.db
		.select({
			payout: payoutTable,
			businessName: businessTable.name,
			currency: businessTable.currency,
		})
		.from(payoutTable)
		.innerJoin(businessTable, eq(payoutTable.businessId, businessTable.id))
		.where(eq(payoutTable.businessId, businessId))
		.orderBy(desc(payoutTable.periodStart));

	if (rows.length === 0) return [];

	const spans = rows.map((row) => row.payout);
	const spanStart = new Date(
		Math.min(...spans.map((span) => span.periodStart.getTime())),
	);
	const spanEnd = new Date(
		Math.max(...spans.map((span) => span.periodEnd.getTime())),
	);

	// One read for every period rather than one per payout, then bucketed in memory. A
	// payout is a monthly row and a business has a handful, so the alternative is a query
	// per row to save a scan of a few hundred order rows.
	const orders = await ctx.db
		.select({ placedAt: orderTable.placedAt })
		.from(orderTable)
		.where(
			and(
				eq(orderTable.businessId, businessId),
				gte(orderTable.placedAt, spanStart),
				lte(orderTable.placedAt, spanEnd),
			),
		);

	// `payout` stores no reference or method; the reference lives on the audit entry an
	// admin wrote when marking it paid. Reading it back is the difference between a
	// settlement a business can reconcile and one it has to take on faith.
	const references = await payoutReferencesFor(
		ctx.db,
		spans.map((span) => span.id),
	);

	return rows.map((row) =>
		payoutOf(row.payout, {
			businessName: row.businessName,
			currency: currencyOf(row.currency),
			orderCount: orders.filter(
				(order) =>
					order.placedAt >= row.payout.periodStart &&
					order.placedAt <= row.payout.periodEnd,
			).length,
			reference: references.get(row.payout.id) ?? null,
		}),
	);
}

// ---------------------------------------------------------------------------
// Ids and slugs
// ---------------------------------------------------------------------------

function newBusinessId(): string {
	return `biz_${crypto.randomUUID()}`;
}

function newMembershipId(): string {
	return `mem_${crypto.randomUUID()}`;
}

/** A name turned into a URL: accents folded, punctuation dropped, runs of `-` collapsed. */
function slugify(name: string): string {
	const folded = name
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);

	// A name that is entirely punctuation folds to nothing, and the unique index would
	// then collide every such business onto `""`.
	return folded.length >= 2
		? folded
		: `negocio-${crypto.randomUUID().slice(0, 8)}`;
}

/** The first free `slug`, then `slug-2`, `slug-3`… A URL that is taken is not a URL. */
export async function uniqueSlug(
	ctx: UserContext,
	base: string,
): Promise<string> {
	for (let attempt = 1; attempt <= 20; attempt += 1) {
		const candidate = attempt === 1 ? base : `${base}-${attempt}`;
		const taken = await ctx.db
			.select({ id: businessTable.id })
			.from(businessTable)
			.where(eq(businessTable.slug, candidate))
			.limit(1);
		if (!taken[0]) return candidate;
	}

	// Twenty shops with one name is not a naming problem, it is a script.
	throw new ConflictError(
		"No pudimos asignar un identificador único para este negocio",
	);
}
