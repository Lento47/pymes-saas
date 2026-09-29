/**
 * A merchant's support ticket: one problem they raised, and the thread under it.
 *
 * ## Why this is a ticket and not a message
 *
 * A merchant asking for help needs to know two things that a chat window cannot promise:
 * that the question was *received* while they were not looking at the app, and that it is
 * still open. Both are a row with a status and a timestamp, which is what `SupportTicket`
 * is. The thread is separate (`SupportTicketMessage`) because the two have different
 * lifecycles — the ticket closes, the thread does not — and because a column that needs
 * querying gets a column: `schema.ts` says nothing in SQLite queries inside a JSON blob,
 * so "every message on this ticket, oldest first" is a table and not a `messages` field.
 *
 * ## The status is the merchant's, not the operator's
 *
 * `OPEN` and `WAITING` are the two a merchant can move themselves, and the distinction is
 * the one that earns its keep: `WAITING` means *we asked you something and you have not
 * answered*, and it is the state that stops a ticket being closed out from under a
 * merchant who was away for a week. `RESOLVED` and `CLOSED` are set by whoever handled it.
 * A client that only ever writes `OPEN` is still a correct client — nothing in the input
 * contract below lets a merchant close their own ticket, because closing is how a question
 * disappears, and a merchant who is done should say so rather than have it inferred.
 *
 * `category` is a closed set on purpose. It is the one field a support desk triages on,
 * and a closed set is what makes "show me the billing ones" a query rather than a text
 * search. `OTHER` exists so that a merchant is never forced into a wrong answer, which is
 * what makes the other four worth trusting.
 *
 * ## The inputs carry `businessId` even where the row already has it
 *
 * Every procedure in the business section names the business it acts on, because
 * `businessProcedure`'s middleware is what turns that id into a checked membership. Without
 * one in the input there is nothing for the middleware to check, and the alternative —
 * trusting a `ticketId` and looking the business up afterwards — is an authorisation check
 * that happens after the read.
 */

import { z } from "zod";

/** The four a merchant is offered, plus the one that admits the other four are not enough. */
export const TICKET_CATEGORY = [
	"BILLING",
	"TECHNICAL",
	"ACCOUNT",
	"PRODUCT",
	"OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORY)[number];

/**
 * Where a ticket is. `OPEN` and `WAITING` are the merchant's to move; `RESOLVED` and
 * `CLOSED` are not.
 */
export const TICKET_STATUS = ["OPEN", "WAITING", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];

/** A message on a ticket, and who wrote it. */
export const supportTicketMessageSchema = z.object({
	id: z.string(),
	ticketId: z.string(),
	/** `null` for the merchant who opened the ticket, a user id for whoever answered. */
	authorId: z.string().nullable(),
	/** True for whoever is on PymesHub's side of the conversation. */
	fromSupport: z.boolean(),
	body: z.string(),
	createdAt: z.date(),
});
export type SupportTicketMessage = z.infer<typeof supportTicketMessageSchema>;

/** One ticket, as the list draws it. The thread is a separate read. */
export const supportTicketSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	/** The person who opened it, kept so the list can say whose question this is. */
	openedBy: z.string(),
	category: z.enum(TICKET_CATEGORY),
	subject: z.string(),
	status: z.enum(TICKET_STATUS),
	/** How many messages the ticket has, so the list can show a thread without reading it. */
	messageCount: z.number().int(),
	/** The other party's last word, for the list's one-line preview. */
	lastMessageAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	resolvedAt: z.date().nullable(),
});
export type SupportTicket = z.infer<typeof supportTicketSchema>;

/** A ticket and its thread, which is what the detail screen draws. */
export const supportTicketWithMessagesSchema = supportTicketSchema.extend({
	messages: z.array(supportTicketMessageSchema),
});
export type SupportTicketWithMessages = z.infer<
	typeof supportTicketWithMessagesSchema
>;

/** How much a merchant may type. The body is a paragraph, not an essay. */
const SUBJECT_MAX = 120;
const BODY_MAX = 2000;
const MESSAGE_MAX = 2000;

/**
 * Opening a ticket.
 *
 * `subject` is bounded at 120 rather than left free because the list draws it on one line
 * and an unbounded subject is a list that breaks on one row. The body is bounded for the
 * ordinary reason: this is a text field in a phone, and 2000 is already more than anyone
 * types into one.
 */
export const supportTicketCreateInput = z.object({
	businessId: z.string(),
	category: z.enum(TICKET_CATEGORY),
	subject: z.string().trim().min(1).max(SUBJECT_MAX),
	body: z.string().trim().min(1).max(BODY_MAX),
});
export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateInput>;

/**
 * Adding to the thread. There is no `status` here on purpose — see `TICKET_STATUS`: a
 * merchant cannot resolve or close, only keep talking.
 */
export const supportTicketReplyInput = z.object({
	businessId: z.string(),
	ticketId: z.string(),
	body: z.string().trim().min(1).max(MESSAGE_MAX),
});
export type SupportTicketReplyInput = z.infer<typeof supportTicketReplyInput>;

/**
 * The merchant's own move between `OPEN` and `WAITING`, and the only status change a
 * merchant can make. `RESOLVED` and `CLOSED` are not offered, so there is no input that
 * can set them.
 */
export const supportTicketSetWaitingInput = z.object({
	businessId: z.string(),
	ticketId: z.string(),
	/** True to mark the question answered and awaiting them; false to put it back in the queue. */
	waiting: z.boolean(),
});
export type SupportTicketSetWaitingInput = z.infer<
	typeof supportTicketSetWaitingInput
>;

/**
 * Reading one ticket's thread.
 *
 * The shape of `supportTicketSetWaitingInput` without its `waiting`, and named separately
 * because the detail screen needs it typed and a client that hand-assembled
 * `{ businessId, ticketId }` at the call site is a client that can also hand-assemble it
 * wrong. `businessId` is here for the same reason it is on every other input in this file:
 * `businessProcedure` turns it into a checked membership before the ticket is read.
 */
export const supportTicketDetailInput = z.object({
	businessId: z.string(),
	ticketId: z.string(),
});
export type SupportTicketDetailInput = z.infer<typeof supportTicketDetailInput>;

/**
 * The operator's list, across every shop.
 *
 * Separate from `supportTicketListInput` rather than a wider version of it, because the two
 * answer different questions. The merchant list has no `businessId` filter and no paging
 * beyond a limit — a shop has one support desk and it is never long. This one pages, sorts
 * and searches, and defaults to *every* state rather than the live ones: an operator
 * filtering out closed tickets would arrive on Monday to a queue that looks identical to
 * Friday's and conclude that nothing happened over the weekend.
 */
export const adminSupportTicketListInput = z.object({
	/** Matches the subject, the body, the shop's name and the opener's name. */
	search: z.string().trim().max(120).optional(),
	status: z.array(z.enum(TICKET_STATUS)).max(4).optional(),
	category: z.array(z.enum(TICKET_CATEGORY)).max(5).optional(),
	businessId: z.string().optional(),
	sort: z.enum(["newest", "oldest", "activity", "messages"]).default("newest"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(100).default(25),
});
export type AdminSupportTicketListInput = z.infer<
	typeof adminSupportTicketListInput
>;

/** One ticket as the operator's table draws it: the merchant row plus the shop's name. */
export const adminSupportTicketRowSchema = supportTicketSchema.extend({
	businessName: z.string(),
	openedByName: z.string(),
});
export type AdminSupportTicketRow = z.infer<typeof adminSupportTicketRowSchema>;

/**
 * The operator's view of one ticket: the merchant row, the two names an operator needs to
 * address the shop and answer by name, and the whole thread.
 *
 * The names are here rather than looked up on demand because the thread is where an
 * operator works, and a thread whose header says only a `usr_…` id is a thread they have to
 * leave to answer.
 */
export const adminSupportTicketDetailSchema =
	adminSupportTicketRowSchema.extend({
		messages: z.array(supportTicketMessageSchema),
	});
export type AdminSupportTicketDetail = z.infer<
	typeof adminSupportTicketDetailSchema
>;

/**
 * PymesHub answering.
 *
 * A plain reply, not a status change: an operator who is still working should not have to
 * also decide where the ticket now lives. The status moves separately, and the reply works
 * on any ticket including a resolved one — a follow-up question about last week's answer
 * does not reopen anything by itself.
 */
export const adminSupportTicketReplyInput = z.object({
	ticketId: z.string(),
	body: z.string().trim().min(1).max(MESSAGE_MAX),
});
export type AdminSupportTicketReplyInput = z.infer<
	typeof adminSupportTicketReplyInput
>;

/**
 * Closing a ticket, which is one message and one state change.
 *
 * `note` is required, and it is the **message the operator is posting**, not a separate
 * column. A resolution nobody wrote is a ticket that closed itself, and the next person to
 * ask the same question has nothing to read — which is the entire reason
 * `REASON_REQUIRED_ACTIONS` makes a reason mandatory for an audited act. Here it is
 * structural rather than conventional: the note is a `from_support` message on the thread,
 * so the answer lives in the conversation where the merchant will actually find it.
 *
 * Only the two terminal states are in this union. An operator does not get to type `OPEN`
 * here — sending a ticket back to the queue is `reply`, which is what a merchant's own
 * answer does automatically.
 */
export const adminSupportTicketResolveInput = z.object({
	ticketId: z.string(),
	status: z.enum(["RESOLVED", "CLOSED"]),
	note: z.string().trim().min(1).max(MESSAGE_MAX),
});
export type AdminSupportTicketResolveInput = z.infer<
	typeof adminSupportTicketResolveInput
>;

/**
 * The list. `status` filters to one state, or reads every *open* one — a merchant looking
 * at their support screen wants "the ones still live", not a closed archive they have to
 * filter out themselves.
 */
export const supportTicketListInput = z.object({
	businessId: z.string(),
	status: z.enum(TICKET_STATUS).optional(),
	limit: z.number().int().min(1).max(100).default(50),
});
export type SupportTicketListInput = z.infer<typeof supportTicketListInput>;
