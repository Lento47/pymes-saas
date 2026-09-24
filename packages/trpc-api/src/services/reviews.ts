import type { Db } from "@pymeshub/db";
import {
	business as businessTable,
	notification as notificationTable,
	order as orderTable,
	review as reviewTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type CreateReviewInput,
	decodeCursor,
	encodeCursor,
	newId,
	type ReplyToReviewInput,
	type Review,
	type ReviewListInput,
} from "@pymeshub/shared";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";

import type { Context } from "../context";
import { ConflictError, ValidationError } from "../errors";
import type { BusinessContext, UserContext } from "./helpers";
import { orNotFound, publicBusiness } from "./helpers";
import { reviewOf } from "./mappers";

/**
 * Reviews, and the business's single answer to one.
 *
 * Two facts shape the file, and only the first is enforced by an index:
 *
 * - **A review is written once.** `review_order_unique` enforces it, and the write
 *   below uses that index as the claim rather than checking first — a check can be
 *   passed by two taps at once, a unique index cannot.
 * - **A reply lives on the review it answers** (`reply_text`, `replied_at`),
 *   and the inbox row is only the telling. The two used to be one insert — a
 *   `notification` row keyed `REVIEW_REPLY:<reviewId>` did the answering and
 *   the telling at once — which made "don't tell me" delete the answer: a
 *   customer who turned reply alerts off would erase the reply from the
 *   storefront too. Rows written that way were moved onto their reviews by
 *   migration `0004`; new replies write both places, or only the review when
 *   the customer opted out.
 *
 * Two readers, and they are two different reads rather than one with a flag: `listForBusiness`
 * is scoped by the membership the middleware injected — the shop's own page, which must still
 * work for a shop the marketplace cannot see — and `listPublic` is scoped by the shop's own
 * `status`, because a stranger has no membership to be scoped by.
 */

/** The reply's ledger key. One per review, so editing replaces rather than appends. */
const REPLY_KIND = "REVIEW_REPLY";

/** The status a review can be written from. Only a finished order has an opinion. */
const REVIEWABLE_STATUS = "COMPLETED";

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * The customer's own line about a finished order.
 *
 * Three gates, in order of how cheaply they fail: the order must be the caller's and
 * COMPLETED, the review must not exist yet, and the business's aggregate is rebuilt from
 * the review rows rather than incremented — an average nudged by a delta is wrong the
 * first time two reviews land together, and it stays wrong forever.
 */
export async function create(
	ctx: UserContext,
	input: CreateReviewInput,
): Promise<Review> {
	// Scoped by customer in the same statement that reads it: somebody else's order id
	// resolves to nothing, so a customer cannot review a stranger's dinner.
	const orders = await ctx.db
		.select()
		.from(orderTable)
		.where(
			and(
				eq(orderTable.id, input.orderId),
				eq(orderTable.customerId, ctx.user.id),
			),
		)
		.limit(1);

	const order = orNotFound(orders[0]);

	if (order.status !== REVIEWABLE_STATUS) {
		throw new ValidationError("Sólo puedes reseñar un pedido completado", {
			status: order.status,
		});
	}

	const now = new Date();
	const id = newId("review");

	// The insert *is* the check. `review_order_unique` makes the second write a no-op, and
	// the empty result is how this call learns it lost — the same shape as the order
	// idempotency ledger, for the same reason.
	const inserted = await ctx.db
		.insert(reviewTable)
		.values({
			id,
			orderId: order.id,
			businessId: order.businessId,
			customerId: ctx.user.id,
			// Null: this is a review of the order, and the order may hold several products.
			// A per-product rating is a different feature.
			productId: null,
			rating: input.rating,
			comment: input.comment ?? null,
			createdAt: now,
		})
		.onConflictDoNothing()
		.returning({ id: reviewTable.id });

	if (!inserted[0]) {
		throw new ConflictError("Ya reseñaste este pedido");
	}

	// The aggregate, rebuilt inside the same transaction as the row that changed it. As
	// scalar subqueries rather than a read-modify-write, because the read half of that
	// pattern is the stale one.
	await ctx.db
		.update(businessTable)
		.set({
			ratingCount: sql`(select count(*) from ${reviewTable} where ${reviewTable.businessId} = ${order.businessId})`,
			ratingAvg: sql`(select coalesce(avg(${reviewTable.rating}), 0) from ${reviewTable} where ${reviewTable.businessId} = ${order.businessId})`,
		})
		.where(eq(businessTable.id, order.businessId));

	const row = orNotFound(
		(
			await ctx.db
				.select()
				.from(reviewTable)
				.where(eq(reviewTable.id, id))
				.limit(1)
		)[0],
	);

	const author = await ctx.db
		.select({
			name: userTable.name,
			image: userTable.image,
			showReviewAvatar: userTable.showReviewAvatar,
		})
		.from(userTable)
		.where(eq(userTable.id, ctx.user.id))
		.limit(1);

	return reviewOf(
		row,
		{
			name: author[0]?.name ?? "Cliente",
			image:
				author[0]?.showReviewAvatar === false
					? null
					: (author[0]?.image ?? null),
		},
		null,
	);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * A business's reviews, newest first.
 *
 * The scope comes from the membership the middleware injected and never from the input,
 * and the authors and the replies are read in one query each rather than one per row —
 * twenty reviews is otherwise forty-one round trips to D1.
 */
export async function listForBusiness(
	ctx: BusinessContext,
	input: ReviewListInput,
): Promise<{ items: Review[]; nextCursor: string | null }> {
	const businessId = ctx.membership.businessId;
	const after = decodeCursor<{ at: number; id: string }>(input.cursor);

	const conditions: SQL[] = [eq(reviewTable.businessId, businessId)];

	if (after) {
		// A tuple: two reviews written in the same millisecond must not both appear on one
		// page and neither on the next.
		conditions.push(
			sql`(${reviewTable.createdAt} < ${after.at} or (${reviewTable.createdAt} = ${after.at} and ${reviewTable.id} < ${after.id}))`,
		);
	}

	const page = await ctx.db
		.select()
		.from(reviewTable)
		.where(and(...conditions))
		.orderBy(desc(reviewTable.createdAt), desc(reviewTable.id))
		// One extra row, read to answer "is there a next page" without a second query.
		.limit(input.limit + 1);

	const hasMore = page.length > input.limit;
	const rows = hasMore ? page.slice(0, input.limit) : page;
	const last = rows[rows.length - 1];

	return {
		items: await hydrate(ctx.db, rows),
		nextCursor:
			hasMore && last
				? encodeCursor({ at: last.createdAt.getTime(), id: last.id })
				: null,
	};
}

/**
 * A shop's reviews, readable by anybody: the rows behind the storefront's rating.
 *
 * `businesses.bySlug` answers `ratingAvg` and `ratingCount` and no rows, and
 * `listForBusiness` cannot stand in for the missing half — it is a `businessProcedure`, so
 * it answers a shop's staff and refuses the customer reading the page. A rating nobody can
 * check is the one number on a storefront that has to be taken on faith.
 *
 * **The shop must be visible, and the predicate is `publicBusiness()` from `helpers.ts`** —
 * the same `where` clause `products.list` grew when the suspended-shop leak was closed.
 * That read joined `business` for the seller card and never looked at its status, so
 * `Frutería La Cosecha` — `SUSPENDED` in the seed — came back with a price and an `inStock`
 * badge while `products.byId`, `cart.addItem`, `catalog.search` and `businesses.bySlug` all
 * refused the same rows; a customer who found one could not open it. A review is that same
 * kind of row: `review.businessId` says nothing about whether the shop may be seen. So the
 * status is filtered in the `where`, joined, beside the id — never read first and judged
 * after — and the answer for a hidden shop is an empty page rather than a refusal, exactly
 * as it is for its products: a stranger has no relationship with the business to be
 * refused *from*.
 *
 * **No membership exemption here, deliberately.** `products.list` carries one because it is
 * also the dashboard's own list; `listForBusiness` is this module's dashboard list already,
 * so a shop that has been suspended still reads its reviews from the procedure whose
 * middleware is built for members, and this one can stay strictly public.
 *
 * **What it returns about a reviewer is what the page shows.** `hydrate` reads the author row
 * as `{ name, image }` and nothing else — never the email or the phone, and `userId` is not
 * a field on `Review` at all — so the public payload carries the display name an author
 * chose, the avatar they uploaded, and the words they wrote. `orderId` travels with the
 * review because it is the review's own domain key: `orders.byId` scopes by `customerId`, so
 * a stranger holding one gets the same 404 a fabricated id gets.
 */
export async function listPublic(
	ctx: Context,
	input: ReviewListInput,
): Promise<{ items: Review[]; nextCursor: string | null }> {
	const after = decodeCursor<{ at: number; id: string }>(input.cursor);

	const conditions: SQL[] = [
		eq(reviewTable.businessId, input.businessId),
		publicBusiness(),
	];

	if (after) {
		// The same tuple as the business-side list, so a cursor one read issued is a cursor the
		// other can spend: two reviews written in the same millisecond must not both appear on
		// one page and neither on the next.
		conditions.push(
			sql`(${reviewTable.createdAt} < ${after.at} or (${reviewTable.createdAt} = ${after.at} and ${reviewTable.id} < ${after.id}))`,
		);
	}

	const page = await ctx.db
		.select({ review: reviewTable })
		.from(reviewTable)
		.innerJoin(businessTable, eq(reviewTable.businessId, businessTable.id))
		.where(and(...conditions))
		.orderBy(desc(reviewTable.createdAt), desc(reviewTable.id))
		// One extra row, read to answer "is there a next page" without a second query.
		.limit(input.limit + 1);

	const hasMore = page.length > input.limit;
	const rows = (hasMore ? page.slice(0, input.limit) : page).map(
		(row) => row.review,
	);
	const last = rows[rows.length - 1];

	return {
		items: await hydrate(ctx.db, rows),
		nextCursor:
			hasMore && last
				? encodeCursor({ at: last.createdAt.getTime(), id: last.id })
				: null,
	};
}

/**
 * One review, on its own or on the order it belongs to.
 *
 * `orders.review` and `reviews.reply` both answer with a `Review`, so both need the same
 * three reads behind it: the row, its author and the business's answer.
 */
export async function byId(
	ctx: UserContext,
	reviewId: string,
): Promise<Review> {
	const rows = await ctx.db
		.select()
		.from(reviewTable)
		.where(eq(reviewTable.id, reviewId))
		.limit(1);

	return orNotFound((await hydrate(ctx.db, [orNotFound(rows[0])]))[0]);
}

// ---------------------------------------------------------------------------
// Replying
// ---------------------------------------------------------------------------

/**
 * The business's answer, written once and editable forever after.
 *
 * An upsert against `dedupe_key` rather than an insert-or-update pair: "one reply per
 * review" is the rule, and the unique index is the only place it can be enforced for a
 * table whose shape does not carry it. Editing replaces the text and moves the timestamp,
 * which is what a reply that was corrected should look like.
 */
export async function reply(
	ctx: BusinessContext,
	input: ReplyToReviewInput,
): Promise<Review> {
	const businessId = ctx.membership.businessId;

	// Scoped by business in the same statement that reads it. See `orNotFound`.
	const rows = await ctx.db
		.select()
		.from(reviewTable)
		.where(
			and(
				eq(reviewTable.id, input.reviewId),
				eq(reviewTable.businessId, businessId),
			),
		)
		.limit(1);

	const review = orNotFound(rows[0]);
	const now = new Date();

	// The answer, always: the review row carries it whether or not anybody is
	// told. One statement, no index needed — the row was just read by id.
	await ctx.db
		.update(reviewTable)
		.set({ replyText: input.reply, repliedAt: now })
		.where(eq(reviewTable.id, review.id));

	// The telling, only while wanted. Skipped before the insert rather than
	// filtered on read: a row written despite the switch would sit in the
	// inbox the next read draws, and a filter there would be a second truth
	// about the same question.
	const wantsReply =
		(
			await ctx.db
				.select({ notifyReviewReplies: userTable.notifyReviewReplies })
				.from(userTable)
				.where(eq(userTable.id, review.customerId))
				.limit(1)
		)[0]?.notifyReviewReplies !== false;

	if (wantsReply) {
		await ctx.db
			.insert(notificationTable)
			.values({
				id: newId("notification"),
				// Addressed to the customer, because the reply *is* news for them.
				userId: review.customerId,
				kind: REPLY_KIND,
				title: "La tienda respondió tu reseña",
				body: input.reply,
				data: { reviewId: review.id, businessId },
				dedupeKey: replyKey(review.id),
				readAt: null,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: notificationTable.dedupeKey,
				set: {
					body: input.reply,
					// Read again, so a customer who had already seen the first answer sees the
					// corrected one as unread rather than as unchanged.
					readAt: null,
					createdAt: now,
				},
			});
	}

	return orNotFound(
		(
			await hydrate(ctx.db, [
				{ ...review, replyText: input.reply, repliedAt: now },
			])
		)[0],
	);
}

/** `REVIEW_REPLY:<reviewId>` — identifies the review, never the clock. */
function replyKey(reviewId: string): string {
	return `${REPLY_KIND}:${reviewId}`;
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/**
 * Rows in, reviews out: the authors in one query, the answers off the rows.
 *
 * The reply travels on the review itself (`reply_text`, `replied_at`) — one
 * read, no second table — because the inbox row is only the telling and may
 * not exist for a customer who opted out. Twenty reviews is otherwise twenty
 * lookups for answers that are sitting on the rows already in hand.
 */
async function hydrate(
	db: Db,
	rows: (typeof reviewTable.$inferSelect)[],
): Promise<Review[]> {
	if (rows.length === 0) return [];

	const authors = await db
		.select({
			id: userTable.id,
			name: userTable.name,
			image: userTable.image,
			showReviewAvatar: userTable.showReviewAvatar,
		})
		.from(userTable)
		.where(
			inArray(userTable.id, [...new Set(rows.map((row) => row.customerId))]),
		);

	const authorOf = new Map(authors.map((user) => [user.id, user]));

	return rows.map((row) => {
		const author = authorOf.get(row.customerId);
		return reviewOf(
			row,
			{
				name: author?.name ?? "Cliente",
				// The author's own switch: hidden means the public payload carries
				// the name they chose and no picture. `!== false` because the
				// column defaults true and old rows predate nothing — every row
				// has a value, and a missing author is already "Cliente".
				image:
					author?.showReviewAvatar === false ? null : (author?.image ?? null),
			},
			row.replyText
				? { text: row.replyText, at: row.repliedAt ?? row.createdAt }
				: null,
		);
	});
}
