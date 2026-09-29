import {
	business as businessTable,
	category as categoryTable,
	courierInvite as courierInviteTable,
	courierProfile as courierProfileTable,
	order as orderTable,
	product as productTable,
	promotion as promotionTable,
	review as reviewTable,
	supportTicketMessage as supportTicketMessageTable,
	supportTicket as supportTicketTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type AdminCourierInviteRow,
	type AdminListInput,
	type AdminProductRow,
	type AdminPromotionRow,
	type AdminReviewRow,
	type AdminSupportTicketDetail,
	type AdminSupportTicketListInput,
	type AdminSupportTicketReplyInput,
	type AdminSupportTicketResolveInput,
	type AdminSupportTicketRow,
	decodeCursor,
	newId,
	type SupportTicketMessage,
	TICKET_CATEGORY,
	TICKET_STATUS,
	type TicketCategory,
	type TicketStatus,
} from "@pymeshub/shared";
import { and, asc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";

import { NotFoundError } from "../errors";
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

/**
 * A status outside the vocabulary is a data bug, and it fails here rather than rendering
 * as a blank cell in a table of two hundred.
 *
 * This is the same check `services/support.ts` makes, and it is duplicated on purpose: that
 * one guards the merchant's screen and this one guards the console's table, and sharing the
 * throw across an admin read and a customer read would couple a support desk to a
 * permission check for no benefit. The vocabulary itself is not duplicated — both import
 * `TICKET_STATUS`, so adding a state updates both in one place.
 */
function assertKnownStatus(status: string): TicketStatus {
	if (!(TICKET_STATUS as readonly string[]).includes(status)) {
		throw new Error(`support ticket has an unknown status: ${status}`);
	}
	return status as TicketStatus;
}

function assertKnownCategory(category: string): TicketCategory {
	if (!(TICKET_CATEGORY as readonly string[]).includes(category)) {
		throw new Error(`support ticket has an unknown category: ${category}`);
	}
	return category as TicketCategory;
}

/**
 * Every shop's support tickets, for the operator's queue.
 *
 * Unlike the merchant list this defaults to **every** status. `adminSupportTicketListInput`
 * says why, and it is worth restating because it is the opposite of `services/support.ts`:
 * a merchant wants their live questions, an operator on Monday wants the weekend's — and a
 * queue that opens already filtered to the two live states cannot tell "nothing happened"
 * from "everything was handled and I never looked".
 *
 * The two thread aggregates are subqueries for the same reason they are on the merchant
 * list: one round trip instead of one per row, and no counter column that can drift from
 * the messages it counts.
 */
export async function supportTickets(
	ctx: UserContext,
	input: AdminSupportTicketListInput,
): Promise<{ rows: AdminSupportTicketRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.status?.length) {
		conditions.push(inArray(supportTicketTable.status, input.status));
	}
	if (input.category?.length) {
		conditions.push(inArray(supportTicketTable.category, input.category));
	}
	if (input.businessId) {
		conditions.push(eq(supportTicketTable.businessId, input.businessId));
	}
	if (input.search) {
		// The subject and the opening message, because a merchant's words are frequently in
		// the body and the subject is whatever they typed first — often three words.
		const pattern = likePattern(input.search);
		conditions.push(
			or(
				like(supportTicketTable.subject, pattern),
				like(businessTable.name, pattern),
				like(userTable.name, pattern),
				sql`exists (
					select 1 from ${supportTicketMessageTable}
					where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
					and ${supportTicketMessageTable.body} like ${pattern}
				)`,
			),
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	// `activity` is the queue's own ordering and is the one an operator wants by default in
	// spirit: the ticket somebody spoke on last is the one that might still be waiting. It
	// sorts on the computed `lastMessageAt`, so it cannot use an index — which is why
	// `newest` is the default and this is a choice, not an accident of column order.
	const sort = {
		newest: sql`${supportTicketTable.createdAt}`,
		oldest: sql`${supportTicketTable.createdAt}`,
		activity: sql`(
			select max(${supportTicketMessageTable.createdAt})
			from ${supportTicketMessageTable}
			where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
		)`,
		messages: sql`(
			select count(*) from ${supportTicketMessageTable}
			where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
		)`,
	}[input.sort];
	// `oldest` is the only sort that wants ascending; the other three want the head of the
	// queue at the top. Tying it to one named sort rather than to a separate `direction`
	// field is deliberate — the admin contract for this table has no direction field,
	// because "oldest" already says "the other way" and two controls for one axis is how a
	// table ends up sorted by nothing.
	const direction = input.sort === "oldest" ? DIRECTIONS.asc : DIRECTIONS.desc;

	const columns = {
		ticket: supportTicketTable,
		businessName: businessTable.name,
		openedByName: userTable.name,
		messageCount: sql<number>`(
			select count(*) from ${supportTicketMessageTable}
			where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
		)`,
		lastMessageAt: sql<Date | null>`(
			select max(${supportTicketMessageTable.createdAt})
			from ${supportTicketMessageTable}
			where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
		)`,
	};

	// The joins are in a helper because the rows query and the count query need the same
	// ones, and a count that joins differently from the rows it counts is a total that
	// disagrees with the page above it.
	const from = () =>
		ctx.db
			.select(columns)
			.from(supportTicketTable)
			.innerJoin(
				businessTable,
				eq(supportTicketTable.businessId, businessTable.id),
			)
			.innerJoin(userTable, eq(supportTicketTable.openedBy, userTable.id));

	const [rows, counted] = await Promise.all([
		from()
			.where(where)
			// `id` breaks the tie for the two same-millisecond sorts, and it is ascending
			// under both directions: the sort the operator chose decides what is first, and
			// the tiebreak only has to be *stable*, not interesting.
			.orderBy(sql`${sort} ${direction}`, asc(supportTicketTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(supportTicketTable)
			.innerJoin(
				businessTable,
				eq(supportTicketTable.businessId, businessTable.id),
			)
			.innerJoin(userTable, eq(supportTicketTable.openedBy, userTable.id))
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			id: row.ticket.id,
			businessId: row.ticket.businessId,
			businessName: row.businessName,
			openedBy: row.ticket.openedBy,
			openedByName: row.openedByName,
			category: assertKnownCategory(row.ticket.category),
			subject: row.ticket.subject,
			status: assertKnownStatus(row.ticket.status),
			messageCount: Number(row.messageCount ?? 0),
			lastMessageAt: row.lastMessageAt ?? null,
			createdAt: row.ticket.createdAt,
			updatedAt: row.ticket.updatedAt,
			resolvedAt: row.ticket.resolvedAt,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}

/**
 * One ticket and its whole thread, oldest first.
 *
 * No membership check and no `businessId` in the input: this is the console, where crossing
 * tenants is the job. `newId` is imported for `replyOnTicket` and `resolveTicket` below,
 * not here.
 */
export async function supportTicket(
	ctx: UserContext,
	ticketId: string,
): Promise<AdminSupportTicketDetail> {
	const rows = await ctx.db
		.select({
			ticket: supportTicketTable,
			businessName: businessTable.name,
			openedByName: userTable.name,
		})
		.from(supportTicketTable)
		.innerJoin(
			businessTable,
			eq(supportTicketTable.businessId, businessTable.id),
		)
		.innerJoin(userTable, eq(supportTicketTable.openedBy, userTable.id))
		.where(eq(supportTicketTable.id, ticketId))
		.limit(1);

	const row = rows[0];
	if (!row) throw new NotFoundError("Ticket no encontrado");

	const messages = await ctx.db
		.select()
		.from(supportTicketMessageTable)
		.where(eq(supportTicketMessageTable.ticketId, ticketId))
		.orderBy(supportTicketMessageTable.createdAt, supportTicketMessageTable.id);

	return {
		id: row.ticket.id,
		businessId: row.ticket.businessId,
		businessName: row.businessName,
		openedBy: row.ticket.openedBy,
		openedByName: row.openedByName,
		category: assertKnownCategory(row.ticket.category),
		subject: row.ticket.subject,
		status: assertKnownStatus(row.ticket.status),
		messageCount: messages.length,
		lastMessageAt: messages.at(-1)?.createdAt ?? null,
		createdAt: row.ticket.createdAt,
		updatedAt: row.ticket.updatedAt,
		resolvedAt: row.ticket.resolvedAt,
		messages: messages.map(messageOf),
	};
}

function messageOf(
	row: typeof supportTicketMessageTable.$inferSelect,
): SupportTicketMessage {
	return {
		id: row.id,
		ticketId: row.ticketId,
		authorId: row.authorId,
		fromSupport: row.fromSupport,
		body: row.body,
		createdAt: row.createdAt,
	};
}

/**
 * PymesHub answering, as a plain message.
 *
 * Deliberately does **not** move the ticket. An operator mid-investigation should not have
 * to also decide where the ticket lives, and a `RESOLVED` ticket that gets a follow-up
 * question is a resolved ticket whose last word is the merchant's — which is what the
 * merchant's own `reply` treats as a reason to reopen. If this also moved the state, the
 * two ends of the same thread would disagree about what a reply means.
 */
export async function replyOnTicket(
	ctx: UserContext,
	input: AdminSupportTicketReplyInput,
): Promise<{ id: string; createdAt: Date }> {
	const now = new Date();
	const id = newId("supportTicketMessage");

	await ctx.db.batch([
		ctx.db.insert(supportTicketMessageTable).values({
			id,
			ticketId: input.ticketId,
			// The operator, not null: only the message that *opened* a ticket has a null
			// author, and it means "see opened_by". A support message has an author here.
			authorId: ctx.user.id,
			fromSupport: true,
			body: input.body,
			createdAt: now,
		}),
		ctx.db
			.update(supportTicketTable)
			.set({ updatedAt: now })
			.where(eq(supportTicketTable.id, input.ticketId)),
	]);

	return { id, createdAt: now };
}

/**
 * Closing a ticket: the operator's note and the state change, **one batch**.
 *
 * The batch is the point. A resolved ticket with no message is a ticket that closed itself,
 * and a note with no state change is an answer to a question that stays in the queue
 * forever — the merchant sees support replied and concludes nobody is dealing with it,
 * while the console shows it as open. The two cannot be allowed to half-happen, and one
 * `db.batch` is the only atomic unit D1 offers.
 *
 * `from_support: true` and `isResolution` are the same fact on the same row, so the note is
 * also the closing message: the merchant reads it in the thread, in order, with the answer
 * attached to the moment the ticket stopped being open.
 *
 * Re-resolving an already-resolved ticket is allowed and does not move `resolvedAt` —
 * an operator adding a second answer to a closed question should not rewrite when the
 * original answer landed, and the first timestamp is the one the merchant was told.
 */
export async function resolveTicket(
	ctx: UserContext,
	input: AdminSupportTicketResolveInput,
): Promise<{ id: string; status: TicketStatus; createdAt: Date }> {
	const now = new Date();
	const messageId = newId("supportTicketMessage");

	const existing = await ctx.db.query.supportTicket.findFirst({
		where: eq(supportTicketTable.id, input.ticketId),
	});
	if (!existing) throw new NotFoundError("Ticket no encontrado");

	const alreadyResolved = existing.resolvedAt !== null;

	await ctx.db.batch([
		ctx.db.insert(supportTicketMessageTable).values({
			id: messageId,
			ticketId: input.ticketId,
			authorId: ctx.user.id,
			fromSupport: true,
			body: input.note,
			createdAt: now,
		}),
		ctx.db
			.update(supportTicketTable)
			.set({
				status: input.status,
				resolvedAt: existing.resolvedAt ?? now,
				updatedAt: now,
			})
			.where(eq(supportTicketTable.id, input.ticketId)),
	]);

	return {
		id: messageId,
		status: input.status,
		createdAt: alreadyResolved ? (existing.resolvedAt ?? now) : now,
	};
}
