import {
	supportTicketMessage as supportTicketMessageTable,
	supportTicket as supportTicketTable,
} from "@pymeshub/db";
import {
	newId,
	type SupportTicket,
	type SupportTicketCreateInput,
	type SupportTicketListInput,
	type SupportTicketMessage,
	type SupportTicketReplyInput,
	type SupportTicketSetWaitingInput,
	type SupportTicketWithMessages,
	TICKET_STATUS,
	type TicketCategory,
	type TicketStatus,
} from "@pymeshub/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { BusinessContext } from "./helpers";
import { orNotFound } from "./helpers";

/**
 * A shop's support tickets.
 *
 * Everything here implements `packages/shared/src/schemas/support.ts`, which was written
 * before this file and is the contract: the router validates against it, the screen draws
 * from it, and neither may invent a field this does not answer.
 *
 * ## The tenant is the middleware's, not ours
 *
 * Every procedure below is `businessProcedure(...)`, which turns the `businessId` in the
 * input into a checked membership *before* the body runs, and puts the resolved id on
 * `ctx.membership.businessId`. So nothing here reads `input.businessId` for a query: a
 * business the caller is not a member of fails at the middleware and never reaches a
 * statement. That is the whole reason every input in the contract repeats `businessId` —
 * see its own docblock.
 *
 * ## The thread is read, not counted
 *
 * `messageCount` and `lastMessageAt` are aggregates over `support_ticket_message`, done in
 * the same query as the tickets rather than stored. A stored counter drifts the moment a
 * message insert and the row that carries it are not one statement, and a support queue
 * ordered by a stale counter is worse than an unindexed one.
 *
 * ## Who may close
 *
 * Not this file. `RESOLVED` and `CLOSED` are set by `routers/admin.ts` behind
 * `adminProcedure`; a merchant can only move `OPEN` ↔ `WAITING` through `setWaiting`.
 * That split is the contract's, and it is why `setWaiting` takes a boolean rather than a
 * status: no input here can express a state the author does not own.
 */

/** The two states a merchant may move between. See the package note on `WAITING`. */
const MERCHANT_MOVABLE: readonly TicketStatus[] = ["OPEN", "WAITING"];

/**
 * The states the list shows when the input asks for no particular one.
 *
 * The contract says an absent `status` "reads every *open* one", and open there means live
 * rather than literally `OPEN`: a ticket sitting in `WAITING` because support asked the
 * merchant a question is the most open thing on the screen, and hiding it behind a filter
 * would be the bug that makes a support desk look empty while it is not. The two terminal
 * states are what a merchant asks for by name.
 */
const LIVE_STATUSES: readonly TicketStatus[] = ["OPEN", "WAITING"];

/**
 * A status outside the vocabulary is our bug, not the caller's.
 *
 * The column is text because SQLite has no enum, so this check is the only thing standing
 * between a typo here and a screen that renders an empty state forever. It throws rather
 * than falling back to `OPEN`, because a silently relabelled ticket has lost its real
 * state — and a ticket stuck open forever is precisely the failure this feature exists to
 * prevent.
 */
function assertKnownStatus(status: string): TicketStatus {
	if (!(TICKET_STATUS as readonly string[]).includes(status)) {
		throw new Error(`support ticket has an unknown status: ${status}`);
	}
	return status as TicketStatus;
}

/**
 * The shop's tickets, newest first.
 *
 * Ordered by `created_at` rather than `last_message_at` because the latter is computed. A
 * queue that reorders itself every time a merchant replies is a queue where the thing you
 * just typed jumps to the top and the thing you are waiting on scrolls away.
 */
export async function list(
	ctx: BusinessContext,
	input: SupportTicketListInput,
): Promise<SupportTicket[]> {
	const where = and(
		eq(supportTicketTable.businessId, ctx.membership.businessId),
		input.status
			? eq(supportTicketTable.status, input.status)
			: inArray(supportTicketTable.status, [...LIVE_STATUSES]),
	);

	// Both aggregates come back on every row rather than in a second query per ticket,
	// which is the difference between one round trip and one per row.
	const rows = await ctx.db
		.select({
			id: supportTicketTable.id,
			businessId: supportTicketTable.businessId,
			openedBy: supportTicketTable.openedBy,
			category: supportTicketTable.category,
			subject: supportTicketTable.subject,
			status: supportTicketTable.status,
			resolvedAt: supportTicketTable.resolvedAt,
			createdAt: supportTicketTable.createdAt,
			updatedAt: supportTicketTable.updatedAt,
			messageCount: sql<number>`(
				select count(*) from ${supportTicketMessageTable}
				where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
			)`,
			lastMessageAt: sql<Date | null>`(
				select max(${supportTicketMessageTable.createdAt})
				from ${supportTicketMessageTable}
				where ${supportTicketMessageTable.ticketId} = ${supportTicketTable.id}
			)`,
		})
		.from(supportTicketTable)
		.where(where)
		.orderBy(desc(supportTicketTable.createdAt))
		.limit(input.limit);

	return rows.map((row) => ({
		...ticketFields(row),
		messageCount: Number(row.messageCount ?? 0),
		lastMessageAt: row.lastMessageAt ?? null,
	}));
}

/** One ticket and its whole thread, oldest first. */
export async function get(
	ctx: BusinessContext,
	ticketId: string,
): Promise<SupportTicketWithMessages> {
	const ticket = await ticketOf(ctx, ticketId);

	const messages = await ctx.db
		.select()
		.from(supportTicketMessageTable)
		.where(eq(supportTicketMessageTable.ticketId, ticket.id))
		// `id` last, because two messages written in the same millisecond otherwise come
		// back in whatever order the database felt like, and a thread that reshuffles
		// between two reads is a thread nobody can follow.
		.orderBy(supportTicketMessageTable.createdAt, supportTicketMessageTable.id);

	return {
		...ticketFields(ticket),
		messageCount: messages.length,
		lastMessageAt: messages.at(-1)?.createdAt ?? null,
		messages: messages.map(messageOf),
	};
}

/**
 * A ticket the caller is allowed to see.
 *
 * Scoped by the membership, not by the id alone: a ticket from another shop is a 404 here
 * rather than a row, because the caller has no way to act on it and a 403 would imply one.
 */
async function ticketOf(ctx: BusinessContext, ticketId: string) {
	return orNotFound(
		await ctx.db.query.supportTicket.findFirst({
			where: and(
				eq(supportTicketTable.id, ticketId),
				eq(supportTicketTable.businessId, ctx.membership.businessId),
			),
		}),
	);
}

/**
 * The row's own columns under the contract's names. The two thread aggregates are left
 * out on purpose: `list` computes them as SQL and `get` counts the rows it read, so no
 * caller can accidentally read a `null` where the contract promises a number.
 */
function ticketFields(ticket: typeof supportTicketTable.$inferSelect) {
	return {
		id: ticket.id,
		businessId: ticket.businessId,
		openedBy: ticket.openedBy,
		category: ticket.category as TicketCategory,
		subject: ticket.subject,
		status: assertKnownStatus(ticket.status),
		createdAt: ticket.createdAt,
		updatedAt: ticket.updatedAt,
		resolvedAt: ticket.resolvedAt,
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
 * Open a ticket.
 *
 * The ticket and its first message are **one batch**, and that is the whole reason: the
 * body a merchant typed is stored as the opening message, so a ticket whose message insert
 * failed would be a subject with no question under it — a row an operator can see, triage
 * and answer, having never read what was asked. One `db.batch` is the atomic unit D1
 * offers, and this is the one place it is the right unit rather than a convenience.
 */
export async function create(
	ctx: BusinessContext,
	input: SupportTicketCreateInput,
): Promise<{ id: string; createdAt: Date }> {
	const now = new Date();
	const ticketId = newId("supportTicket");
	const messageId = newId("supportTicketMessage");

	await ctx.db.batch([
		ctx.db.insert(supportTicketTable).values({
			id: ticketId,
			businessId: ctx.membership.businessId,
			openedBy: ctx.user.id,
			category: input.category,
			subject: input.subject,
			status: "OPEN",
			createdAt: now,
			updatedAt: now,
		}),
		// `authorId` is null on purpose: this message's author is the ticket's `openedBy`,
		// and storing it twice is a second answer to keep in step.
		ctx.db.insert(supportTicketMessageTable).values({
			id: messageId,
			ticketId,
			authorId: null,
			fromSupport: false,
			body: input.body,
			createdAt: now,
		}),
	]);

	return { id: ticketId, createdAt: now };
}

/**
 * Add to the thread.
 *
 * A reply to a resolved ticket **reopens** it and clears the timestamp. That is the
 * behaviour `WAITING` exists to make possible: a merchant answering a closed question does
 * not mean the old problem is back, but the queue must show that somebody spoke last — and
 * a resolved ticket whose last word is the merchant's, sitting quietly in a resolved list,
 * is a question nobody will ever read.
 */
export async function reply(
	ctx: BusinessContext,
	input: SupportTicketReplyInput,
): Promise<{ id: string; createdAt: Date }> {
	const ticket = await ticketOf(ctx, input.ticketId);

	const now = new Date();
	const messageId = newId("supportTicketMessage");
	const reopening = ticket.resolvedAt !== null;

	await ctx.db.batch([
		ctx.db.insert(supportTicketMessageTable).values({
			id: messageId,
			ticketId: ticket.id,
			authorId: ctx.user.id,
			fromSupport: false,
			body: input.body,
			createdAt: now,
		}),
		ctx.db
			.update(supportTicketTable)
			.set({
				status: reopening ? "OPEN" : ticket.status,
				resolvedAt: null,
				updatedAt: now,
			})
			.where(eq(supportTicketTable.id, ticket.id)),
	]);

	return { id: messageId, createdAt: now };
}

/**
 * The merchant's own move between `OPEN` and `WAITING`.
 *
 * A ticket that is already resolved or closed stays that way: the merchant can still
 * reply — `reply` handles that, and it reopens — but this control is about the two live
 * states, and quietly reopening from here would make the reply's behaviour depend on which
 * control was used.
 */
export async function setWaiting(
	ctx: BusinessContext,
	input: SupportTicketSetWaitingInput,
): Promise<{ status: TicketStatus }> {
	const ticket = await ticketOf(ctx, input.ticketId);

	const current = assertKnownStatus(ticket.status);
	if (!MERCHANT_MOVABLE.includes(current)) return { status: current };

	const next: TicketStatus = input.waiting ? "WAITING" : "OPEN";
	if (next === current) return { status: current };

	await ctx.db
		.update(supportTicketTable)
		.set({ status: next, updatedAt: new Date() })
		.where(eq(supportTicketTable.id, ticket.id));

	return { status: next };
}
