/**
 * Product feedback from any signed-in user.
 *
 * ## Why this is not a support ticket, and not a crash
 *
 * `SupportTicket` is a merchant's question about their shop. `business_id` is NOT NULL
 * with cascade, `opened_by` is restrict, and the table is in `REASON_REQUIRED_ACTIONS`,
 * so a ticket **blocks a business delete**. An idea from a customer with no shop cannot
 * live there: the admin list inner-joins `business` and `user`, and a null business
 * would drop the row before the console could return it.
 *
 * `CrashReport` is a stack trace. An operator closing one is matching a release to a
 * fix. Mixing "what if the cart remembered the last address" into that queue is how
 * ideas go unread under unreadable stacks.
 *
 * So the object is shared — something arrived, someone has to look, then it is closed
 * with a note — and the row is not.
 *
 * ## No thread
 *
 * There is no reply, no WAITING, and no public board. The submitter sees their own
 * list. An operator closes with a required note that lives in the `idea.resolve`
 * audit entry, which is the only place the reasoning can live.
 */

import { z } from "zod";

/**
 * Who the submitter was, as the session knew it at write time.
 *
 * Derived on the server from memberships, never from the body: MERCHANT if any
 * non-courier membership, else COURIER if any courier membership, else CUSTOMER.
 * Stored rather than recomputed so an operator can still see the role after the
 * membership is gone.
 */
export const IDEA_ROLE = ["CUSTOMER", "COURIER", "MERCHANT"] as const;
export type IdeaRole = (typeof IDEA_ROLE)[number];

/**
 * Where an idea is. Two states on purpose: there is nobody waiting on the other
 * end, so WAITING would be a word with no meaning. The client writes OPEN and
 * never touches the column again.
 */
export const IDEA_STATUS = ["OPEN", "CLOSED"] as const;
export type IdeaStatus = (typeof IDEA_STATUS)[number];

const SUBJECT_MAX = 120;
const BODY_MAX = 2000;

/** One idea, as the submitter's list draws it. */
export const ideaSchema = z.object({
	id: z.string(),
	/** Null once the account is gone. The idea outlives it. */
	userId: z.string().nullable(),
	/**
	 * The shop the submitter belonged to, when there was one.
	 *
	 * A filter, never an ownership claim: no foreign key, so an idea never blocks
	 * a business delete the way a ticket does.
	 */
	businessId: z.string().nullable(),
	roleAtSubmit: z.enum(IDEA_ROLE),
	subject: z.string(),
	body: z.string(),
	status: z.enum(IDEA_STATUS),
	resolvedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type Idea = z.infer<typeof ideaSchema>;

/**
 * What the client may send.
 *
 * **No id, no status, no role, no timestamps.** All four are the server's: an id
 * is minted by `newId`, a client that could write `status` could hide its own
 * idea from the queue, and a client that could name its role could file a
 * customer idea as a merchant's.
 */
export const ideaCreateInput = z.object({
	subject: z.string().trim().min(1).max(SUBJECT_MAX),
	body: z.string().trim().min(1).max(BODY_MAX),
});
export type IdeaCreateInput = z.infer<typeof ideaCreateInput>;

/** The submitter's own list. No names: they already know who they are. */
export const ideaListMineInput = z.object({
	status: z.array(z.enum(IDEA_STATUS)).max(2).optional(),
	limit: z.number().int().min(1).max(100).default(50),
});
export type IdeaListMineInput = z.infer<typeof ideaListMineInput>;

/**
 * The operator's queue.
 *
 * `search` covers the subject and the body, because those are the two things
 * somebody remembers: a headline, and a word from the paragraph.
 */
export const ideaListInput = z.object({
	search: z.string().trim().max(120).optional(),
	/** Defaults to every *live* idea, for the same reason `supportTicketListInput` does. */
	status: z.array(z.enum(IDEA_STATUS)).max(2).optional(),
	role: z.array(z.enum(IDEA_ROLE)).max(3).optional(),
	sort: z.enum(["newest", "oldest"]).default("newest"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(100).default(25),
});
export type IdeaListInput = z.infer<typeof ideaListInput>;

/**
 * The operator's row: the idea plus the two names an operator needs to answer by.
 *
 * Both nullable: an idea routinely outlives the account and the shop.
 */
export const ideaRowSchema = ideaSchema.extend({
	userName: z.string().nullable(),
	businessName: z.string().nullable(),
});
export type IdeaRow = z.infer<typeof ideaRowSchema>;

/**
 * Closing an idea, which is one note and one state change.
 *
 * `note` is required. There is no thread on this table, so the note and the audit
 * entry are the only two places the reasoning can live. Only `CLOSED`, so no input
 * can express a move the operator did not earn.
 */
export const ideaResolveInput = z.object({
	id: z.string(),
	status: z.literal("CLOSED"),
	note: z.string().trim().min(1).max(2000),
});
export type IdeaResolveInput = z.infer<typeof ideaResolveInput>;

export const ideaGetInput = z.object({
	id: z.string(),
});
export type IdeaGetInput = z.infer<typeof ideaGetInput>;
