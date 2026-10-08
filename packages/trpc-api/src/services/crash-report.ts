import { crashReport as crashReportTable } from "@pymeshub/db";
import {
	CRASH_SOURCE,
	CRASH_STATUS,
	type CrashCategory,
	type CrashReport,
	type CrashReportInput,
	type CrashReportListInput,
	type CrashReportResolveInput,
	type CrashReportRow,
	type CrashSeverity,
	type CrashSource,
	type CrashStatus,
	newId,
} from "@pymeshub/shared";
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	like,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { NotFoundError } from "../errors";
import { auditStatement } from "./audit";
import { likePattern, type UserContext } from "./helpers";

/**
 * A crash, as the console's queue works it.
 *
 * ## What implements the contract, and what does not
 *
 * The contract is `packages/shared/src/schemas/crash-report.ts`, written before this file. The
 * router validates against it, the console draws from it, and neither may invent a field this
 * does not answer — the same rule `services/support.ts` states about its own schema.
 *
 * **Unlike `support.ts`, nothing here reads an input id for a query.** Every merchant
 * procedure is `businessProcedure(...)`, which turns a `businessId` in the input into a
 * checked membership before the body runs. A crash report is the opposite case: a signed-in
 * user with no shop attached, or with a shop they are not a member of. There is no tenant to
 * check and therefore nothing to check, which is why `report` is `protectedProcedure` and not
 * `businessProcedure` — and why it is the only write in this Worker that takes no `businessId`.
 *
 * ## Why `business_id` is stored and never joined
 *
 * It is a filter, not an ownership claim: "crashes seen while this shop was on screen". There
 * is no foreign key on the column, so this service never joins `business` and never reads a
 * name from it — the queue's business name comes from a `leftJoin` in `list` so a report with
 * no shop is still a row rather than a hole.
 *
 * ## Why nothing here closes a crash
 *
 * `report` writes `OPEN` and returns. `RESOLVED` and `CLOSED` are the operator's, and they
 * live behind `adminProcedure`. The split is the contract's: a client that could close its own
 * crash would be a client that could hide it from the queue whose only job is to find it.
 */

/** The states a crash is listed in when the input asks for no particular one. */
const LIVE_STATUSES: readonly CrashStatus[] = ["OPEN", "WAITING"];

/**
 * A status outside the vocabulary is our bug, not the caller's.
 *
 * The column is text because SQLite has no enum, so this is the only thing standing between a
 * typo here and a queue that renders an empty state forever. It throws rather than falling
 * back to `OPEN`, and `services/support.ts:77` says the same thing about its own column for
 * the same reason.
 */
function assertKnownStatus(status: string): CrashStatus {
	if (!(CRASH_STATUS as readonly string[]).includes(status)) {
		throw new Error(`crash report has an unknown status: ${status}`);
	}
	return status as CrashStatus;
}

function assertKnownCategory(category: string): CrashCategory {
	const known = ["UNHANDLED_ERROR", "UNHANDLED_REJECTION", "USER_REPORT"];
	if (!known.includes(category)) {
		throw new Error(`crash report has an unknown category: ${category}`);
	}
	return category as CrashCategory;
}

function assertKnownSource(source: string): CrashSource {
	if (!(CRASH_SOURCE as readonly string[]).includes(source)) {
		throw new Error(`crash report has an unknown source: ${source}`);
	}
	return source as CrashSource;
}

function assertKnownSeverity(severity: string): CrashSeverity {
	const known = ["ERROR", "CRITICAL", "WARNING"];
	if (!known.includes(severity)) {
		throw new Error(`crash report has an unknown severity: ${severity}`);
	}
	return severity as CrashSeverity;
}

/** The row's own columns under the contract's names. */
function reportFields(row: typeof crashReportTable.$inferSelect): CrashReport {
	return {
		id: row.id,
		userId: row.userId,
		businessId: row.businessId,
		source: assertKnownSource(row.source),
		category: assertKnownCategory(row.category),
		severity: assertKnownSeverity(row.severity),
		title: row.title,
		message: row.message,
		stack: row.stack,
		route: row.route,
		appVersion: row.appVersion,
		buildNumber: row.buildNumber,
		context: row.contextJson ?? null,
		status: assertKnownStatus(row.status),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		resolvedAt: row.resolvedAt,
	};
}

/**
 * Write a crash.
 *
 * **`source` is a server-side decision, not an input.** `crashReportInput` has no `source`
 * field: the router sets it from the procedure the client called, so a caller cannot file a
 * mobile crash as a web one and skew the queue's first question — *is this our problem on this
 * platform*. Two procedures that both pass `MOBILE` is the shape; a client that picks its own
 * source is not.
 *
 * **`businessId` is the reporter's first shop when they have one, and `null` otherwise.**
 * Read from `ctx.memberships` — the list `context.ts` builds from D1 on every request — rather
 * than from the input, for the same reason `businessProcedure` puts a checked membership on
 * `ctx` instead of trusting the body: the client does not get to name whose screen it was on.
 *
 * The **first** membership and not a chosen one, because a reporter can belong to three shops
 * and there is no argument for which one they were looking at. A customer with no membership
 * writes `null`, which is a perfectly good row — it is the majority case, and a schema that
 * cannot hold it loses exactly the reports nobody else would file.
 */
export async function report(
	ctx: UserContext,
	source: CrashSource,
	input: CrashReportInput,
): Promise<{ id: string; createdAt: Date }> {
	const now = new Date();
	const id = newId("crashReport");

	await ctx.db.insert(crashReportTable).values({
		id,
		userId: ctx.user.id,
		businessId: ctx.memberships[0]?.businessId ?? null,
		source,
		category: input.category,
		severity: input.severity,
		title: input.title ?? null,
		message: input.message,
		stack: input.stack ?? null,
		route: input.route ?? null,
		appVersion: input.appVersion ?? null,
		buildNumber: input.buildNumber ?? null,
		contextJson: input.context ?? null,
		// Written here and never touched again by a client: see the module note.
		status: "OPEN",
		createdAt: now,
		updatedAt: now,
	});

	return { id, createdAt: now };
}

type OffsetCursor = { offset: number };

function offsetOf(cursor: string | undefined): number {
	if (!cursor) return 0;
	const decoded = JSON.parse(cursor) as OffsetCursor | null;
	if (decoded && Number.isFinite(decoded.offset) && decoded.offset >= 0) {
		return Math.trunc(decoded.offset);
	}
	const plain = Number(cursor);
	return Number.isFinite(plain) && plain >= 0 ? Math.trunc(plain) : 0;
}

/**
 * The operator's queue.
 *
 * **Both joins are `leftJoin`, and that is the whole point of this table.** The ticket list
 * inner-joins `business` and `user` (`admin-content.ts:479-481`), which is right for a ticket
 * and catastrophic for a crash: a report whose account was deleted has `user_id = NULL`, and
 * an inner join would drop the row *before it could be returned*. An operator would look at an
 * empty queue and conclude nothing had crashed — a silent disappearance, which is worse than a
 * missing feature. Both names are nullable in the contract for the same reason.
 *
 * No `status` passed means the live ones, matching `supportTicketListInput` and for the same
 * stated reason: a queue is the work still to do.
 */
export async function list(
	ctx: UserContext,
	input: CrashReportListInput,
): Promise<{ rows: CrashReportRow[]; total: number }> {
	const conditions: (SQL | undefined)[] = [];

	conditions.push(
		input.status?.length
			? inArray(crashReportTable.status, [...input.status])
			: inArray(crashReportTable.status, [...LIVE_STATUSES]),
	);
	if (input.category?.length) {
		conditions.push(inArray(crashReportTable.category, [...input.category]));
	}
	if (input.source?.length) {
		conditions.push(inArray(crashReportTable.source, [...input.source]));
	}
	if (input.buildNumber) {
		conditions.push(eq(crashReportTable.buildNumber, input.buildNumber));
	}
	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(
				like(crashReportTable.message, pattern),
				like(crashReportTable.title, pattern),
				like(crashReportTable.route, pattern),
				like(crashReportTable.stack, pattern),
			),
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const offset = offsetOf(input.cursor);

	// `newest` and `oldest` are the created-at sort; `build` groups a release's crashes
	// together, which is the question an operator asks when deciding whether to ship a fix.
	const sort =
		input.sort === "build"
			? sql`${crashReportTable.buildNumber} desc, ${crashReportTable.createdAt} desc`
			: input.sort === "oldest"
				? sql`${crashReportTable.createdAt} asc`
				: sql`${crashReportTable.createdAt} desc`;

	// The joins live in a helper because the rows query and the count query need the same
	// ones, and a count that joins differently from the page it counts is a total that
	// disagrees with the page above it.
	const from = () =>
		ctx.db
			.select({
				report: crashReportTable,
				userName: sql<
					string | null
				>`(select name from user where id = ${crashReportTable.userId})`,
				businessName: sql<
					string | null
				>`(select name from business where id = ${crashReportTable.businessId})`,
			})
			.from(crashReportTable);

	const [rows, counted] = await Promise.all([
		from()
			.where(where)
			// `id` breaks the tie for two same-millisecond rows, and ascending under every
			// direction: the sort the operator chose decides what is first, and the tiebreak
			// only has to be *stable*.
			.orderBy(sort, asc(crashReportTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(crashReportTable)
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			...reportFields(row.report),
			userName: row.userName ?? null,
			businessName: row.businessName ?? null,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}

/**
 * One crash, whole. The console's detail pane.
 *
 * A direct read rather than `list` filtered by id: the queue paginates and a crash an operator
 * bookmarked is routinely on page three, so paging to it would be a detail pane that depends
 * on where the crash happens to sort. The two correlated name subqueries are the same ones
 * `list` uses — `null` when the account or the shop is gone, which is the whole reason the
 * table can hold those rows at all.
 */
export async function get(
	ctx: UserContext,
	id: string,
): Promise<CrashReportRow | null> {
	const [row] = await ctx.db
		.select({
			report: crashReportTable,
			userName: sql<
				string | null
			>`(select name from user where id = ${crashReportTable.userId})`,
			businessName: sql<
				string | null
			>`(select name from business where id = ${crashReportTable.businessId})`,
		})
		.from(crashReportTable)
		.where(eq(crashReportTable.id, id))
		.limit(1);

	if (!row) return null;
	return {
		...reportFields(row.report),
		userName: row.userName ?? null,
		businessName: row.businessName ?? null,
	};
}

/**
 * Close a crash, which is one note and one state change.
 *
 * `note` is required and it is the thing the operator **writes**, not a separate column —
 * `crashReportResolveInput` gives the reason and it transfers verbatim from
 * `adminSupportTicketResolveInput`: a resolution nobody wrote is a ticket that closed itself.
 * Here it is structural rather than conventional, because **there is no thread on this table**,
 * so the note and the audit entry are the only two places the reasoning can live.
 *
 * `before` is the report's **previous** status, so the entry says what it moved from as well
 * as to. On a re-resolve that is `RESOLVED` again, which is the truthful reading: a second
 * answer was recorded on an already-closed crash.
 */
export async function resolve(
	ctx: UserContext,
	input: CrashReportResolveInput,
): Promise<{ id: string; status: CrashStatus; createdAt: Date }> {
	const now = new Date();

	const existing = await ctx.db.query.crashReport.findFirst({
		where: eq(crashReportTable.id, input.id),
	});
	if (!existing) throw new NotFoundError("Reporte no encontrado");

	// `??` and not a fresh stamp: a crash resolved twice keeps its first resolution date, the
	// same way `resolveTicket` does, so "when was this handled" has one answer.
	await ctx.db.batch([
		ctx.db
			.update(crashReportTable)
			.set({
				status: input.status,
				resolvedAt: existing.resolvedAt ?? now,
				updatedAt: now,
			})
			.where(eq(crashReportTable.id, input.id)),
		auditStatement(ctx, {
			action: "crash.resolve",
			targetType: "crash_report",
			targetId: input.id,
			before: { status: existing.status },
			// The note rides in `after`, not in a column, and it is the reason this entry exists:
			// an entry that says "closed at 14:02" without the reasoning is not checkable when
			// the next build crashes the same way.
			after: { status: input.status, note: input.note },
			reason: input.note,
			now,
		}),
	]);

	return { id: input.id, status: input.status, createdAt: now };
}
