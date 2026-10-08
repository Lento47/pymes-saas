/**
 * A crash, as a thing an operator has to look at.
 *
 * ## Why this is a report and not a support ticket
 *
 * `SupportTicket` is a merchant's question about their shop. That model is deliberate down to
 * its keys: `business_id` is `NOT NULL` with `onDelete: "cascade"`, `opened_by` is `NOT NULL`
 * with `restrict`, and `support_ticket` is in `REASON_REQUIRED_ACTIONS` — so a ticket **blocks
 * a business delete**, which is the guard that keeps a shop with history from being erased.
 *
 * None of those fit a crash. A customer's phone threw on the checkout screen and belongs to no
 * business at all. A crash seen on a shop's screen must not stop that shop from being deleted.
 * And nobody is accountable for a crash, which is exactly why `opened_by` is `restrict` for a
 * conversation and nullable here.
 *
 * Putting crashes in that table would also break the console silently rather than loudly: the
 * admin list and detail both `innerJoin` `business` and `user`
 * (`services/admin-content.ts:479-481`, `:497-499`, `:543-545`), so a ticket with a null
 * business would be dropped before the row ever returned. An operator would see an empty queue
 * and conclude nothing had happened.
 *
 * So the object is shared — something arrived, someone has to look, and then it is closed with
 * a note — and the row is not.
 *
 * ## What it is for
 *
 * Reporting, and fixing the app. Not customer support. A crash on build 13 is a fact about the
 * release, and the job it exists for is deciding whether build 14 contains the fix.
 *
 * ## Why `status` is copied and not borrowed
 *
 * `OPEN` / `WAITING` / `RESOLVED` / `CLOSED` are the same four words as `TICKET_STATUS` on
 * purpose: an operator who works both queues should not learn a second vocabulary. What is
 * different is who moves them — a merchant may move a ticket between `OPEN` and `WAITING`, and
 * nothing may move a crash at all except an operator. The app writes `OPEN` and never touches
 * the column again.
 *
 * ## Why `buildNumber` is a column and not a note
 *
 * "Which version broke" is the first question anyone asks about a crash and the only one whose
 * answer changes what they do next. Indexed, because a report that cannot be found by the
 * release it belongs to is a report nobody looks up again.
 */

import { z } from "zod";

/**
 * What produced the report.
 *
 * `USER_REPORT` is here and not in a table of its own because it is the same class of thing:
 * a person saying *the app did not do its job*. An operator fixing a stack trace wants those
 * in the same queue, and separating them is how a queue fills with unreadable stacks while the
 * readable reports go unread.
 */
export const CRASH_CATEGORY = [
	/** `ErrorBoundary` caught a render error. */
	"UNHANDLED_ERROR",
	/** A promise rejected with nobody handling it. */
	"UNHANDLED_REJECTION",
	/** A person chose to tell us. A "report this problem" affordance. */
	"USER_REPORT",
] as const;
export type CrashCategory = (typeof CRASH_CATEGORY)[number];

/** Which client wrote it. `String` in the schema, not an enum — SQLite has no enum. */
export const CRASH_SOURCE = ["MOBILE", "WEB"] as const;
export type CrashSource = (typeof CRASH_SOURCE)[number];

/**
 * Where a crash is, in the operator's vocabulary.
 *
 * Deliberately the same four states as `TICKET_STATUS`, and deliberately a separate
 * declaration: they are two tables and a crash is not a ticket, so sharing the constant would
 * be a lie about the model. The words are shared because the operator is one person.
 */
export const CRASH_STATUS = ["OPEN", "WAITING", "RESOLVED", "CLOSED"] as const;
export type CrashStatus = (typeof CRASH_STATUS)[number];

const SEVERITY = ["ERROR", "CRITICAL", "WARNING"] as const;
export type CrashSeverity = (typeof SEVERITY)[number];

/** One crash, as the queue draws it. */
export const crashReportSchema = z.object({
	id: z.string(),
	/** Null once the reporting account is gone. The report outlives it — that is the point. */
	userId: z.string().nullable(),
	/**
	 * The shop the reporter was looking at, when there was one.
	 *
	 * A filter, never an ownership claim: it has no foreign key in the schema so a crash can
	 * never block or cascade with a business the way a ticket does.
	 */
	businessId: z.string().nullable(),
	source: z.enum(CRASH_SOURCE),
	category: z.enum(CRASH_CATEGORY),
	severity: z.enum(SEVERITY),
	title: z.string().nullable(),
	message: z.string(),
	stack: z.string().nullable(),
	/** The screen it happened on, as a route. */
	route: z.string().nullable(),
	/** `0.1.0`. From `Constants.expoVersion` — not an environment variable. */
	appVersion: z.string().nullable(),
	/** The real `versionCode`. Indexed: this is how a crash is matched to a release. */
	buildNumber: z.string().nullable(),
	context: z.record(z.string(), z.unknown()).nullable(),
	status: z.enum(CRASH_STATUS),
	/** Stamped when an operator closes it. Null while the crash is live. */
	resolvedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type CrashReport = z.infer<typeof crashReportSchema>;

/**
 * What the client may send.
 *
 * **No id, no status, no timestamps.** All three are the server's: an id is minted by
 * `newId` (ids are server-side only, `ids.ts` says why), and a client that could write
 * `status` could close its own crash — which would hide it from the queue that exists to find
 * it.
 *
 * The bounds are the old `error_reports.message` being made finite. That column was
 * `@db.Text` with no limit; D1 is SQLite and a row that grows without bound is a query that
 * eventually costs more than it should. `message` at 2000 is a paragraph, `title` at 200 is a
 * headline, and `stack` at 20000 is the field that legitimately wants room.
 */
export const crashReportInput = z.object({
	category: z.enum(CRASH_CATEGORY),
	severity: z.enum(SEVERITY).default("ERROR"),
	message: z.string().trim().min(1).max(2000),
	title: z.string().trim().min(1).max(200).optional(),
	stack: z.string().max(20_000).optional(),
	route: z.string().max(300).optional(),
	appVersion: z.string().max(40).optional(),
	buildNumber: z.string().max(40).optional(),
	context: z.record(z.string(), z.unknown()).optional(),
});
export type CrashReportInput = z.infer<typeof crashReportInput>;

/**
 * The operator's queue.
 *
 * `search` covers the subject and the route, because those are the two things somebody
 * remembers: the screen it broke on, and a word from the message.
 */
export const crashReportListInput = z.object({
	search: z.string().trim().max(120).optional(),
	/** Defaults to every *live* crash, for the same reason `supportTicketListInput` does. */
	status: z.array(z.enum(CRASH_STATUS)).max(4).optional(),
	category: z.array(z.enum(CRASH_CATEGORY)).max(3).optional(),
	source: z.array(z.enum(CRASH_SOURCE)).max(2).optional(),
	buildNumber: z.string().max(40).optional(),
	sort: z.enum(["newest", "oldest", "build"]).default("newest"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(100).default(25),
});
export type CrashReportListInput = z.infer<typeof crashReportListInput>;

/**
 * The operator's row: the report plus the two names an operator needs to answer by.
 *
 * Both nullable, and that is the difference from `AdminSupportTicketRow` — a crash belongs to
 * a person who may not exist any more and a shop that may never have been named, and a queue
 * that cannot draw those rows is the silent disappearance this table exists to avoid.
 */
export const crashReportRowSchema = crashReportSchema.extend({
	userName: z.string().nullable(),
	businessName: z.string().nullable(),
});
export type CrashReportRow = z.infer<typeof crashReportRowSchema>;

/**
 * Closing a crash, which is one note and one state change.
 *
 * `note` is required, and it is the thing the operator **writes**, not a separate column. The
 * reasoning is the one `adminSupportTicketResolveInput` already states: a resolution nobody
 * wrote is a ticket that closed itself, and the next person to see the same crash has nothing
 * to read. Here it is structural for the same reason — there is no thread on this table, so
 * the note is the only place the reasoning can live.
 *
 * Only the two terminal states, so no input can express a move the operator did not earn.
 */
export const crashReportResolveInput = z.object({
	id: z.string(),
	status: z.enum(["RESOLVED", "CLOSED"]),
	note: z.string().trim().min(1).max(2000),
});
export type CrashReportResolveInput = z.infer<typeof crashReportResolveInput>;

/**
 * Reading one crash.
 *
 * Its own input rather than a string, for the reason `supportTicketDetailInput` is its own: a
 * client that hand-assembled `{ id }` is a client that can also hand-assemble it wrong, and
 * the id is checked against the `crashReport` prefix on the way in.
 */
export const crashReportGetInput = z.object({
	id: z.string(),
});
export type CrashReportGetInput = z.infer<typeof crashReportGetInput>;
