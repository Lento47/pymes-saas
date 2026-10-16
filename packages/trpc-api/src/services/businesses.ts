import type { Db } from "@pymeshub/db";
import {
	mobileShopAppearance as appearanceTable,
	auditLog as auditLogTable,
	boundingBox,
	business as businessTable,
	category as categoryTable,
	delivery as deliveryTable,
	encodeGeohash,
	haversineKm,
	merchantLocation as locationTable,
	membership as membershipTable,
	orderItem as orderItemTable,
	order as orderTable,
	product as productTable,
	subscription as subscriptionTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type AuditLogEntry,
	type BusinessAnalytics,
	type BusinessAuditHistoryInput,
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
	type PendingInvitation,
	resolveStorefrontAppearance,
	type StaffMember,
	type Subscription,
	scoreCandidate,
} from "@pymeshub/shared";
import {
	and,
	asc,
	desc,
	eq,
	exists,
	gte,
	inArray,
	isNotNull,
	isNull,
	like,
	lte,
	ne,
	notInArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

import type { BatchItem } from "drizzle-orm/batch";

import type { Context } from "../context";
import { ConflictError, ForbiddenError, ValidationError } from "../errors";
import { auditStatement } from "./audit";
import { dispatchNext } from "./delivery-dispatch";
import { canSetDeliveryFee } from "./delivery-policy";
import type { BusinessContext, UserContext } from "./helpers";
import {
	assertRole,
	batchOf,
	inCategory,
	isOpenAt,
	likePattern,
	orNotFound,
	PUBLIC_BUSINESS_STATUSES,
	roundKm,
} from "./helpers";
import {
	auditLogEntryOf,
	businessCardOf,
	businessSettingsOf,
	categoryOf,
	currencyOf,
	membershipSummaryOf,
	productCardOf,
	staffMemberOf,
} from "./mappers";
import { checkCount } from "./plan-limits";
import * as subscriptionService from "./subscription";

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

/**
 * The app's business switcher: the shops this person may **operate right now**.
 *
 * The `ACTIVE` filter is what makes the switcher's contract true rather than
 * approximate. This procedure is the list a client draws as "my businesses" and
 * picks a scope from, so a `PENDING_USER_ACCEPTANCE` row appearing here would be
 * an invitation rendered as a shop — selectable, and then refused by
 * `businessProcedure` on the first call that needed it.
 *
 * Invitations are **not** returned in some other field of this response, and that
 * is deliberate: they arrive from `pendingInvitations` instead. One response
 * carrying both would make "is this a shop I can use" a property the caller has
 * to remember to check, and the field name is a weaker guard than a separate
 * procedure.
 */
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
		.where(
			and(
				eq(membershipTable.userId, ctx.user.id),
				eq(membershipTable.status, "ACTIVE"),
			),
		);

	// Sorted here rather than in SQL because a switcher lists three rows, and the
	// collation SQLite would use on the name is not the one the clients use.
	return rows
		.sort((a, b) => a.businessName.localeCompare(b.businessName))
		.map(membershipSummaryOf);
}

/**
 * Invitations this person has been sent and has not answered.
 *
 * The other half of the split above, and **non-authorizing on purpose**. Nothing
 * here is a shop the caller may use: no capability is minted from it, it is not
 * selectable, it does not count against a plan's seat cap, and
 * `resolveProfileIdentity` will not accept one of these business ids as a scope.
 * It exists so a screen can say "you have been invited to Café Central" without
 * that sentence being a permission.
 *
 * `expiresAt` is returned rather than filtered on. An invitation whose window has
 * passed is still something the person was sent, and a client that hid it would
 * leave them wondering why a notification led nowhere; the accept path is where a
 * lapsed row is refused, once, in the one place that can do something about it.
 */
export async function pendingInvitations(
	ctx: UserContext,
): Promise<PendingInvitation[]> {
	const rows = await ctx.db
		.select({
			id: membershipTable.id,
			businessId: membershipTable.businessId,
			businessSlug: businessTable.slug,
			businessName: businessTable.name,
			businessLogoUrl: businessTable.logoUrl,
			role: membershipTable.role,
			expiresAt: membershipTable.expiresAt,
			createdAt: membershipTable.createdAt,
			inviterId: userTable.id,
			inviterName: userTable.name,
			inviterImage: userTable.image,
		})
		.from(membershipTable)
		.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
		// A left join, because `invited_by_user_id` is nullable twice over: an owner's
		// own membership has no inviter, and the column is `on delete set null` so the
		// person who invited you can remove their account while the invitation stands.
		.leftJoin(userTable, eq(membershipTable.invitedByUserId, userTable.id))
		.where(
			and(
				eq(membershipTable.userId, ctx.user.id),
				eq(membershipTable.status, "PENDING_USER_ACCEPTANCE"),
			),
		);

	return rows
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.map((row) => ({
			id: row.id,
			businessId: row.businessId,
			businessSlug: row.businessSlug,
			businessName: row.businessName,
			businessLogoUrl: row.businessLogoUrl,
			role: row.role,
			invitedBy: row.inviterId
				? {
						id: row.inviterId,
						name: row.inviterName ?? "",
						image: row.inviterImage,
					}
				: null,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
		}));
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

	const [categories, featured, appearanceRows] = await Promise.all([
		storefrontCategories(ctx.db, row.business.id),
		activeProductsOf(ctx.db, row.business.id, true),
		ctx.db
			.select({ published: appearanceTable.published })
			.from(appearanceTable)
			.where(eq(appearanceTable.businessId, row.business.id))
			.limit(1),
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
			roadFeeEnabled: ctx.env.ROUTE_FEE_ENABLED === "true",
			now,
		}),
		hours: row.business.hours ?? [],
		isOpen: isOpenAt(row.business.hours, now),
		categories,
		featured: shown.map((product) =>
			productCardOf(product, row.business, { now }),
		),
		appearance: appearanceRows[0]?.published
			? resolveStorefrontAppearance(appearanceRows[0].published)
			: undefined,
	};
}

/** Authenticated preview also admits an unopened shop; public bySlug never does. */
export async function previewForBusiness(
	ctx: BusinessContext,
): Promise<BusinessStorefront> {
	const businessId = ctx.membership.businessId;
	const [row] = await ctx.db
		.select({
			business: businessTable,
			categoryName: categoryTable.name,
			categoryNameEn: categoryTable.nameEn,
		})
		.from(businessTable)
		.leftJoin(categoryTable, eq(businessTable.categoryId, categoryTable.id))
		.where(eq(businessTable.id, businessId))
		.limit(1);
	const found = orNotFound(row);
	const now = new Date();
	const [categories, featured, appearanceRows] = await Promise.all([
		storefrontCategories(ctx.db, businessId),
		activeProductsOf(ctx.db, businessId, true),
		ctx.db
			.select({
				draft: appearanceTable.draft,
				published: appearanceTable.published,
			})
			.from(appearanceTable)
			.where(eq(appearanceTable.businessId, businessId))
			.limit(1),
	]);
	const shown = featured.length
		? featured
		: await activeProductsOf(ctx.db, businessId, false);
	return {
		card: businessCardOf(found.business, {
			categoryName: found.categoryName,
			categoryNameEn: found.categoryNameEn,
			roadFeeEnabled: ctx.env.ROUTE_FEE_ENABLED === "true",
			now,
		}),
		hours: found.business.hours ?? [],
		isOpen: isOpenAt(found.business.hours, now),
		categories,
		featured: shown.map((product) =>
			productCardOf(product, found.business, { now }),
		),
		appearance: resolveStorefrontAppearance(
			appearanceRows[0]?.draft ?? appearanceRows[0]?.published,
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
			roadFeeEnabled: ctx.env.ROUTE_FEE_ENABLED === "true",
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
	return {
		...businessSettingsOf(row.business, {
			categoryName: row.categoryName,
			categoryNameEn: row.categoryNameEn,
		}),
		canSetDeliveryFee: await canSetDeliveryFee(ctx.db, businessId),
	};
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
	assignIfPresent(patch, "deliveryPricingMode", input.deliveryPricingMode);
	assignIfPresent(
		patch,
		"merchantCoversDelivery",
		input.merchantCoversDelivery,
	);
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
	if (
		input.merchantCoversDelivery !== undefined ||
		input.deliveryPricingMode !== undefined ||
		input.deliveryFeeMinor !== undefined ||
		input.deliveryEnabled !== undefined
	) {
		const [current] = await ctx.db
			.select({
				fee: businessTable.deliveryFeeMinor,
				mode: businessTable.deliveryPricingMode,
				deliveryEnabled: businessTable.deliveryEnabled,
			})
			.from(businessTable)
			.where(eq(businessTable.id, businessId))
			.limit(1);
		const existing = orNotFound(current);
		if (
			input.deliveryFeeMinor !== undefined &&
			input.deliveryFeeMinor > 0 &&
			!(await canSetDeliveryFee(ctx.db, businessId))
		)
			throw new ForbiddenError("biz.settings.delivery.affiliatedRequired");
		if (
			input.deliveryPricingMode === "AFFILIATED" &&
			!(await canSetDeliveryFee(ctx.db, businessId))
		)
			throw new ForbiddenError("biz.settings.delivery.affiliatedRequired");
		if (
			(input.deliveryPricingMode ?? existing.mode) === "AFFILIATED" &&
			(input.deliveryEnabled ?? existing.deliveryEnabled) &&
			(input.deliveryFeeMinor ?? existing.fee) === 0
		)
			throw new ValidationError("biz.settings.delivery.courierFeeRequired", {
				field: "deliveryFeeMinor",
			});
	}

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
	// A delivery created before the shop had a pin holds an empty pickup snapshot.
	// Repair only unassigned, still-searching runs from this default branch. Once a
	// courier has an offer or accepts, the route remains its original snapshot.
	const waiting =
		patch.lat != null && patch.lng != null
			? await ctx.db
					.select({
						id: deliveryTable.id,
						line1: locationTable.line1,
						city: locationTable.city,
						region: locationTable.region,
					})
					.from(deliveryTable)
					.innerJoin(orderTable, eq(orderTable.id, deliveryTable.orderId))
					.innerJoin(locationTable, eq(locationTable.id, orderTable.locationId))
					.where(
						and(
							eq(deliveryTable.businessId, businessId),
							eq(locationTable.businessId, businessId),
							eq(locationTable.isDefault, true),
							eq(deliveryTable.status, "SEARCHING"),
							isNull(deliveryTable.courierUserId),
							isNull(deliveryTable.pickupLat),
							isNull(deliveryTable.pickupLng),
							notInArray(orderTable.status, [
								"CANCELLED",
								"REJECTED",
								"COMPLETED",
							]),
						),
					)
			: [];
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
		...waiting.map(({ id, line1, city, region }) =>
			ctx.db
				.update(deliveryTable)
				.set({
					pickupLine1: input.line1 ?? line1 ?? "",
					pickupCity: input.city ?? city ?? "",
					pickupRegion: input.region ?? region ?? "",
					pickupLat: patch.lat,
					pickupLng: patch.lng,
					updatedAt: patch.updatedAt,
				})
				.where(
					and(
						eq(deliveryTable.id, id),
						eq(deliveryTable.status, "SEARCHING"),
						isNull(deliveryTable.courierUserId),
						isNull(deliveryTable.pickupLat),
						isNull(deliveryTable.pickupLng),
					),
				),
		),
	]);
	for (const { id } of waiting) {
		try {
			await dispatchNext(ctx.db, id, ctx.env);
		} catch (error) {
			// The pin and the waiting delivery were committed above. A transient offer
			// failure must not tell the merchant the pin failed to save; opening the
			// courier board or reporting presence retries SEARCHING deliveries.
			console.error("pickup dispatch failed after shop pin save", {
				deliveryId: id,
				error: String(error),
			});
		}
	}

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
	if (input.deliveryPricingMode === "AFFILIATED" || input.deliveryFeeMinor > 0)
		throw new ForbiddenError("biz.settings.delivery.affiliatedRequired");

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
			merchantCoversDelivery: input.merchantCoversDelivery,
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
			// An owner writing their own membership is the one row that is `ACTIVE` by
			// construction — there is nobody to accept an invitation from, and leaving
			// this to the column default would make the shop's own founder a member by
			// accident of a schema choice rather than by intent.
			status: "ACTIVE",
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

/**
 * The team, as the staff screen lists it: **people who can act for this shop
 * today**.
 *
 * Pending invitations are excluded, and they are excluded from *here* rather than
 * filtered by the client, because this list is what another screen offers to
 * change roles and remove people from. A `PENDING_USER_ACCEPTANCE` row rendered
 * beside an `ACTIVE` one would be a name with a role dropdown next to it for
 * somebody who has agreed to nothing — and removing them would delete an
 * invitation rather than a colleague.
 *
 * `inviteStaff`'s own list of who is already on the team is this same set, which
 * is why the two reads carry the same filter: a manager must not be able to send
 * a second invitation to somebody whose first is still open.
 */
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
		.where(
			and(
				eq(membershipTable.businessId, ctx.membership.businessId),
				eq(membershipTable.status, "ACTIVE"),
			),
		);

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
 * Deliberately not an email invitation. An invitation is a row saying "somebody who is
 * not here yet may join", and there is nowhere to put one: the membership table
 * requires a `userId`. Inventing a pending state would mean either a nullable `userId`
 * — and every membership check in the codebase remembering it — or a parallel invite
 * table with its own lifecycle. So the product's honest position today is: the person
 * signs up, then a manager adds them by address.
 *
 * Rate-limited at the router, because it is the one business procedure that can be used
 * to probe which addresses have accounts.
 */
export async function inviteStaff(
	ctx: BusinessContext,
	input: { businessId: string; email: string; role: MembershipRole },
): Promise<StaffMember> {
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

	/**
	 * **Unfiltered by `status`, and the reason has changed since Phase 1.**
	 *
	 * It is still unfiltered because it exists to answer "does a row already exist for
	 * this pair": `membership_business_user_unique` is on `(business_id, user_id)` and a
	 * second insert is a constraint failure rather than an invitation, so narrowing this
	 * read would let the code past the check and into that failure — a 500 where a
	 * sentence belongs.
	 *
	 * What changed is what happens next. Phase 1 refused on *any* row and recorded the
	 * consequence in the docblock above: re-inviting somebody whose membership was
	 * revoked had no path, and the refusal said "ya forma parte del equipo" about a person
	 * who demonstrably did not. The reactivation path is now here — the branch below
	 * updates the row instead of colliding with it — and `inviteAffiliate` carries the
	 * same branch for invitations.
	 *
	 * Unfiltered, the check can still only ever be **stricter** than a status-aware one:
	 * it refuses where the narrow version might have proceeded. A read that cannot grant
	 * anything is not an authorization boundary, which is why it is safe to leave as it is
	 * and why the branch, not the filter, is the fix.
	 */
	const existing = await ctx.db
		.select({ id: membershipTable.id, status: membershipTable.status })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, user.id),
			),
		)
		.limit(1);

	const row = existing[0];
	// `ACTIVE` is the only status that means "already on the team". Everything else is a
	// relationship that ended, and this is a new one.
	if (row?.status === "ACTIVE")
		throw new ConflictError("Esa persona ya forma parte del equipo");

	/**
	 * The plan's staff cap, and why a rider never reaches it.
	 *
	 * `staffAccounts` counts **employees**. The filter below drops couriers from the
	 * count for exactly that reason: a courier is a rider the platform routes deliveries
	 * to — a per-order relationship that comes and goes — and a shop with two couriers on
	 * a Tuesday may have none on Sunday. The plan caps employees; riders are not
	 * employees.
	 *
	 * Which is why the cap is not merely *excluded* from the count but is not
	 * **consulted** for a rider, and the second half is the part that was missing. The two
	 * are one rule seen from two sides, and reading only the count left the check
	 * contradicting it: the weekly cap is one, the owner already holds that seat, so
	 * `checkCount` compared 1 against 1 and refused. Every shop on the default plan was
	 * therefore unable to add the first courier its own onboarding asks for — not because
	 * it had reached a limit, but because the owner is not an addition. The invitation
	 * never wrote a row, and the client had no vocabulary for a refusal that does not go
	 * away on a retry.
	 *
	 * The branch is on the role rather than on the number, so the count query is not spent
	 * on an invitation that cannot change its answer: a rider does not grow the population
	 * the cap measures. The filter stays inside the branch because a shop may already hold
	 * riders — the role is a column, and anything that put one there is a membership this
	 * cap has never counted.
	 */
	if (input.role !== "COURIER") {
		const [staff] = await ctx.db
			.select({ count: sql<number>`count(*)` })
			.from(membershipTable)
			.where(
				and(
					eq(membershipTable.businessId, businessId),
					ne(membershipTable.role, "COURIER"),
					// Only people who can act count. A seat is taken by somebody who
					// is on the team, and an unaccepted invitation is nobody: counting
					// pending rows would let a manager exhaust a plan's seats by
					// typing addresses, which is a paid resource spent without a
					// person behind it — and the invitation could still be declined,
					// leaving the shop paying for nothing.
					eq(membershipTable.status, "ACTIVE"),
				),
			);
		checkCount({
			ctx,
			limitName: "staffAccounts",
			resourceType: "cuentas de equipo",
			current: staff?.count ?? 0,
		});
	}

	const now = new Date();
	const id = newMembershipId();

	/**
	 * The write, the audit row, and the reactivation branch, in one batch.
	 *
	 * The batch is new here and it is the rule `services/audit.ts` states: a change and the
	 * record of the change are one atomic unit. `inviteStaff` was one of the paths that
	 * predated the rule, which meant a shop could add somebody and have no row saying who
	 * did it — and the person added could be an OWNER.
	 *
	 * The update branch is addressed by id, which was read under both `businessId` and
	 * `userId`, and it restates `status <> 'ACTIVE'`: D1 offers no transaction to open
	 * around the read and the write, so a membership activated between them must not be
	 * silently re-written by a stale invitation.
	 */
	const write: BatchItem<"sqlite"> = row
		? ctx.db
				.update(membershipTable)
				.set({
					role: input.role,
					status: "ACTIVE",
					// The new episode's dates, not the old one's. `acceptedAt` is written
					// because this path grants access immediately — there is no second thing
					// for the person to agree to — and the cleared fields are what stops a
					// revoked row from carrying its revocation into a membership that is live.
					acceptedAt: now,
					revokedAt: null,
					expiresAt: null,
					inviteTokenHash: null,
					invitedByUserId: ctx.user.id,
				})
				.where(
					and(
						eq(membershipTable.id, row.id),
						ne(membershipTable.status, "ACTIVE"),
					),
				)
		: ctx.db.insert(membershipTable).values({
				id,
				businessId,
				userId: user.id,
				role: input.role,
				// Written rather than left to the column default, so that the one insert in
				// this file that *grants* access says out loud which state it grants. A
				// reader should not have to open the schema to learn that this is `ACTIVE`.
				status: "ACTIVE",
				// The inviter, which the insert never recorded. It is what lets the shop's
				// ledger answer "who brought this person in" for a team member as well as for
				// an invitation, and it is nullable because a row created by an owner for
				// themselves has nobody to name.
				invitedByUserId: ctx.user.id,
				createdAt: now,
			});

	await ctx.db.batch(
		batchOf([
			write,
			auditStatement(ctx, {
				action: "affiliation.invite",
				targetType: "membership",
				targetId: row?.id ?? id,
				before: row ? { status: row.status } : null,
				after: {
					status: "ACTIVE",
					role: input.role,
					userId: user.id,
					businessId,
				},
				reason: null,
				now,
			}),
		]),
	);

	return staffMemberOf({ role: input.role, createdAt: now }, user);
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
	const businessId = ctx.membership.businessId;
	if (input.role === "COURIER") {
		throw new ValidationError(
			"Invita repartidores desde el directorio de repartidores",
			{ field: "role" },
		);
	}

	const target = await ctx.db
		.select({ membership: membershipTable, user: userTable })
		.from(membershipTable)
		.innerJoin(userTable, eq(membershipTable.userId, userTable.id))
		.where(
			and(
				eq(membershipTable.businessId, businessId),
				eq(membershipTable.userId, input.userId),
				// A non-active row is not a member, so this answers `NOT_FOUND` rather
				// than demoting somebody who cannot be demoted — the same shape as a
				// `userId` from another tenant.
				eq(membershipTable.status, "ACTIVE"),
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
				// The read above already established that this row is `ACTIVE`, and the
				// condition is restated here on purpose. The update is addressed by
				// `(businessId, userId)` rather than by the membership's id, and D1
				// offers no transaction to open around the pair — so without this, a
				// membership revoked between the read and the write would still be
				// promoted, and the caller would be told it worked. The window is small
				// and the consequence is an ex-employee holding a role, which is worth
				// one more clause.
				eq(membershipTable.status, "ACTIVE"),
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
				// Removing somebody who has already been removed is a `NOT_FOUND`, not
				// a second delete. The alternative — succeeding on a row that was not
				// there — would make "did this work" unanswerable from the response.
				//
				// The consequence is that the Phase 2 revoke path cannot be reached
				// through this procedure, which is intended: revoking keeps the row
				// and its history, and this deletes it. They are different actions.
				eq(membershipTable.status, "ACTIVE"),
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

/**
 * Refuse to leave a business with nobody who can administer it.
 *
 * The `ACTIVE` filter is load-bearing and easy to miss. Without it, a revoked
 * owner would still be counted as an owner — so revoking the last one would look
 * like the business still had one, and the shop would end up with an owner list
 * that exists only in this query's imagination: nobody able to log in, and no way
 * to fix it from the UI. The question this asks is "how many people can still
 * administer this shop", and a revoked membership answers zero to it.
 *
 * **Exported** because three callers now need it and they are not all in this file:
 * `removeStaff` and `updateStaffRole` here, and `services/affiliations.ts`'s
 * `leaveBusiness` and `revokeAffiliation`. A second copy is how one of them ends up
 * counting a revoked owner - which is precisely the bug the `ACTIVE` filter above
 * was added to fix, and it would come back in the copy nobody re-read.
 *
 * `UserContext` rather than `BusinessContext`, and that is not a loosening: the function
 * reads nothing but `ctx.db`, and the caller who needs it most is `leaveBusiness`, whose
 * `protectedProcedure` has no middleware-built membership to pass. It still takes
 * `businessId` as an argument rather than reading one off a context, because it is a
 * question *about a shop* rather than about the caller - and the answer must not depend on
 * which shop the caller happened to be acting for.
 */
export async function assertNotLastOwner(
	ctx: UserContext,
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
				eq(membershipTable.status, "ACTIVE"),
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
// Billing
// ---------------------------------------------------------------------------

/**
 * The merchant's own subscription. OWNER, via `payouts:read`.
 *
 * **One row, not a history.** This replaced `listPayouts`, which returned a list of
 * settlement runs, and the change is the point: there is nothing to settle. The
 * consumer pays the merchant for products and the courier for delivery; the platform
 * charges a flat fee, so the merchant's only relationship to the money is the fee.
 *
 * That makes the whole `payouts:read` surface a single subscription, which is why the
 * capability name is worth keeping rather than renaming — it is the permission to see
 * billing, and the permission did not change even though the shape did.
 *
 * `null` is a real answer and not a failure: a business created but never billed has
 * no row, and a dashboard that renders "no data" for that is correct. Returning an
 * empty list, as the old `listPayouts` did for a shop with no runs, would be a shape
 * the client has to unwrap to discover the same thing.
 */
export async function currentSubscription(
	ctx: BusinessContext,
	_input: { businessId: string },
): Promise<Subscription | null> {
	return subscriptionService.current(
		ctx,
		ctx.membership.businessId,
		new Date(),
	);
}

export async function auditHistory(
	ctx: BusinessContext,
	input: BusinessAuditHistoryInput,
): Promise<{ rows: AuditLogEntry[]; total: number }> {
	const businessId = ctx.membership.businessId;
	const decodedCursor =
		typeof input.cursor === "string"
			? decodeCursor<{ offset: number }>(input.cursor)
			: null;
	const cursorOffset =
		decodedCursor && Number.isFinite(decodedCursor.offset)
			? Math.max(0, Math.trunc(decodedCursor.offset))
			: typeof input.cursor === "number"
				? input.cursor
				: 0;
	const offset =
		input.cursor !== undefined ? cursorOffset : (input.offset ?? 0);
	const ownership = or(
		and(
			eq(auditLogTable.targetType, "business"),
			eq(auditLogTable.targetId, businessId),
		),
		and(
			eq(auditLogTable.targetType, "merchant_location"),
			exists(
				ctx.db
					.select({ id: locationTable.id })
					.from(locationTable)
					.where(
						and(
							eq(locationTable.id, auditLogTable.targetId),
							eq(locationTable.businessId, businessId),
						),
					),
			),
		),
		and(
			eq(auditLogTable.targetType, "subscription"),
			exists(
				ctx.db
					.select({ id: subscriptionTable.id })
					.from(subscriptionTable)
					.where(
						and(
							eq(subscriptionTable.id, auditLogTable.targetId),
							eq(subscriptionTable.businessId, businessId),
						),
					),
			),
		),
		and(
			eq(auditLogTable.targetType, "order"),
			exists(
				ctx.db
					.select({ id: orderTable.id })
					.from(orderTable)
					.where(
						and(
							eq(orderTable.id, auditLogTable.targetId),
							eq(orderTable.businessId, businessId),
						),
					),
			),
		),
		and(
			eq(auditLogTable.targetType, "user"),
			// **Deliberately not `ACTIVE`-filtered, and it is the only membership read
			// in this file that is not.** This clause decides which entries about a
			// *person* are visible to a shop, and its question is historical: "was
			// this actor ever on this team". Filtering it would erase a removed
			// employee's entire audit trail from the shop's own history — the records
			// of what they did while they worked there would disappear at the moment
			// the shop most needs to look at them, which is right after removing
			// somebody. `status` says what a membership is *now*; this asks what it
			// *was*, and those are different questions.
			exists(
				ctx.db
					.select({ id: membershipTable.id })
					.from(membershipTable)
					.where(
						and(
							eq(membershipTable.userId, auditLogTable.actorUserId),
							eq(membershipTable.businessId, businessId),
						),
					),
			),
		),
	);
	const where = and(ownership);
	const [rows, counted] = await Promise.all([
		ctx.db
			.select({ entry: auditLogTable, actorName: userTable.name })
			.from(auditLogTable)
			.leftJoin(userTable, eq(auditLogTable.actorUserId, userTable.id))
			.where(where)
			.orderBy(
				input.sortDirection === "asc"
					? asc(auditLogTable.createdAt)
					: desc(auditLogTable.createdAt),
				asc(auditLogTable.id),
			)
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(auditLogTable)
			.where(where),
	]);

	return {
		rows: rows.map((row) => auditLogEntryOf(row.entry, row.actorName)),
		total: Number(counted[0]?.total ?? 0),
	};
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
