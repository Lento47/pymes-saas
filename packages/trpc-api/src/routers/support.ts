import {
	supportTicketCreateInput,
	supportTicketDetailInput,
	supportTicketListInput,
	supportTicketReplyInput,
	supportTicketSetWaitingInput,
} from "@pymeshub/shared";

import { rateLimit } from "../context";
import * as support from "../services/support";
import { businessProcedure, router } from "../trpc";

/**
 * Five a shop an hour: somebody whose app is broken may file three — "the list is empty",
 * "the prices are wrong", "the order button does nothing" — and are not finished. Ten an
 * hour is past the point where the limit is helping anybody, since past that point the
 * person is not describing a problem, they are trying to get attention.
 */
const CREATE_LIMIT = 5;
const CREATE_WINDOW_SECONDS = 60 * 60;

/**
 * Thirty an hour against a thread that holds one problem and its answers. Generous on
 * purpose: this is the endpoint that should never be the reason a merchant's question goes
 * unanswered, and the ceiling exists to stop a loop, not to ration talking.
 */
const REPLY_LIMIT = 30;
const REPLY_WINDOW_SECONDS = 60 * 60;

/**
 * A shop's support desk: one question they raised, and the thread under it.
 *
 * The contract for all of this is `packages/shared/src/schemas/support.ts`, written before
 * this router. Nothing below extends it; where a shape is missing it is added there rather
 * than improvised here, so the phone and the Worker cannot drift.
 *
 * ## Why `orders:read`
 *
 * `RoleCapability` has no `support:*` entry, and this file does not add one. `reviews.ts`
 * already settled the same question — reading reviews is STAFF+ and answering one is
 * MANAGER+, which is `orders:read` plus an `assertRole` — on the grounds that a fifth
 * capability name would not say anything the existing set does not. A support ticket is
 * closer still: every one of the four roles can raise one, because the person who notices
 * the prices are wrong is whoever is at the till, not necessarily the owner. So the gate is
 * the capability all roles hold, and nothing here narrows it further.
 *
 * ## Why nothing here closes a ticket
 *
 * `create`, `reply` and `setWaiting` are the merchant's three moves. `RESOLVED` and `CLOSED`
 * are the platform's, and they live behind `adminProcedure` in `routers/admin.ts`. The split
 * is the contract's, and it is the reason this router has no procedure that takes a status
 * it did not earn: an endpoint that could close a ticket would let a merchant close their
 * own question, and a closed question is a question nobody reads.
 */
export const supportRouter = router({
	/**
	 * The shop's live questions, newest first. The screen's default view — see
	 * `supportTicketListInput` for why an absent `status` means open-and-waiting rather
	 * than all four states.
	 */
	list: businessProcedure("orders:read")
		.input(supportTicketListInput)
		.query(({ ctx, input }) => support.list(ctx, input)),

	/** One ticket and its whole thread, oldest first. */
	get: businessProcedure("orders:read")
		.input(supportTicketDetailInput)
		.query(({ ctx, input }) => support.get(ctx, input.ticketId)),

	create: businessProcedure("orders:read")
		.input(supportTicketCreateInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"support:create",
				ctx.user.id,
				CREATE_LIMIT,
				CREATE_WINDOW_SECONDS,
			);
			return support.create(ctx, input);
		}),

	/**
	 * Adding to the thread. Replying to a resolved ticket reopens it — see `services/support.ts`
	 * for why, and why that is not the same as undoing an answer.
	 */
	reply: businessProcedure("orders:read")
		.input(supportTicketReplyInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"support:reply",
				ctx.user.id,
				REPLY_LIMIT,
				REPLY_WINDOW_SECONDS,
			);
			return support.reply(ctx, input);
		}),

	/**
	 * The one status a merchant moves themselves, and the only one this router can set.
	 * A ticket that is already resolved or closed stays that way.
	 */
	setWaiting: businessProcedure("orders:read")
		.input(supportTicketSetWaitingInput)
		.mutation(({ ctx, input }) => support.setWaiting(ctx, input)),
});
