import {
	crashReportGetInput,
	crashReportInput,
	crashReportListInput,
	crashReportResolveInput,
} from "@pymeshub/shared";

import { rateLimit } from "../context";
import { NotFoundError } from "../errors";
import * as crashReport from "../services/crash-report";
import { adminProcedure, protectedProcedure, router } from "../trpc";

/**
 * Crashes, as a queue an operator works.
 *
 * ## Why `protectedProcedure` and not `businessProcedure`
 *
 * Every merchant route in this Worker is `businessProcedure(...)`, which turns a `businessId`
 * in the input into a checked membership before the body runs. A crash report has no such
 * tenant to check: the phone that crashed was a customer's, with no shop attached at all, and
 * the crashes that matter most happen before anyone is signed in.
 *
 * So `report` is the one write in this Worker that a signed-in user performs with no business
 * involved, and that asymmetry is the reason it is its own file rather than three lines in
 * `routers/support.ts`. A merchant asking a question about their shop and a customer's phone
 * throwing are different acts with different constraints, and the guard is where that shows.
 *
 * ## Why `source` is not an input
 *
 * `crashReportInput` has no `source` field; each procedure passes its own constant. A client
 * that could name its own source could file a mobile crash as a web one, and the queue's
 * second question — *is this our problem on this platform* — would answer itself.
 */

/**
 * Thirty an hour against a table that only ever wants to hear about bugs.
 *
 * Deliberately not tight: the threat this guards is a client in a retry loop, and the cost of
 * refusing is losing the report of the crash that is actually happening. The limiter is a
 * Durable Object (`RATE_LIMIT_ROOM`, bound in every environment) and `rateLimit` **fails
 * open** — `context.ts:366-371` returns rather than throwing on any object fault — so a
 * limiter problem can never take the reporter down with it.
 */
const REPORT_LIMIT = 30;
const REPORT_WINDOW_SECONDS = 60 * 60;

export const crashReportRouter = router({
	/**
	 * File a crash. The only thing a client may write.
	 *
	 * It sets `status` to `OPEN` and nothing else: a client that could resolve its own crash
	 * could hide it from the queue whose entire job is to find it.
	 */
	report: protectedProcedure
		.input(crashReportInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"crash:report",
				ctx.user.id,
				REPORT_LIMIT,
				REPORT_WINDOW_SECONDS,
			);
			return crashReport.report(ctx, "MOBILE", input);
		}),

	/** The operator's queue, live crashes by default. */
	list: adminProcedure
		.input(crashReportListInput)
		.query(({ ctx, input }) => crashReport.list(ctx, input)),

	/** One crash, whatever state it is in — a closed one is still the one somebody bookmarked. */
	get: adminProcedure
		.input(crashReportGetInput)
		.query(async ({ ctx, input }) => {
			const report = await crashReport.get(ctx, input.id);
			if (!report) throw new NotFoundError("Reporte no encontrado");
			return report;
		}),

	/**
	 * Closing a crash, which is a note and a state change in one batch.
	 *
	 * The note is required and it is written into the audit entry, not a column, because there
	 * is no thread on this table for it to live in. Audited as `crash.resolve`, and
	 * `REASON_REQUIRED_ACTIONS` carries it for the same reason `support.resolve` does: an entry
	 * that says "closed at 14:02" without the reasoning is not checkable when the next build
	 * crashes the same way, which is the only thing anyone wants from this table.
	 */
	resolve: adminProcedure
		.input(crashReportResolveInput)
		.mutation(({ ctx, input }) => crashReport.resolve(ctx, input)),
});
