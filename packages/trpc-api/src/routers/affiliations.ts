import {
	affiliationAcceptInput,
	affiliationDeclineInput,
	affiliationLeaveInput,
} from "@pymeshub/shared";

import * as affiliations from "../services/affiliations";
import { protectedProcedure, router } from "../trpc";

/**
 * The invitee's half of an affiliation: answering an invitation, and leaving.
 *
 * ## Why these three are not on `business`
 *
 * Every procedure on `business` is a `businessProcedure(capability)`, which resolves a
 * `businessId` in the input against the caller's `ACTIVE` memberships **before** the body
 * runs. All three procedures here are the ones that cannot satisfy that, for two different
 * reasons:
 *
 * - **`accept` and `decline`** act on a membership that is `PENDING_USER_ACCEPTANCE`, which is
 *   by definition absent from `ctx.memberships` - the gating chokepoint filters it out, and it
 *   must, because a pending row confers nothing. There is no `businessId` to check against a
 *   membership, because the membership is the thing being created.
 * - **`leave`** acts on the caller's *own* membership, which no capability describes. The gate
 *   it carried was `businessProcedure("orders:read")`, chosen because every role holds it -
 *   which made an orders permission stand in for "any member of this shop". See
 *   `services/affiliations.ts`'s `leaveBusiness` for why that was wrong rather than merely
 *   indirect.
 *
 * So all three are `protectedProcedure`s whose authorization is *the caller's own user id
 * inside the `where`*: the row is read by `user_id = ctx.user.id` - and, for `leave`, by the
 * `businessId` the caller named - together with the status the act requires. `orNotFound` is
 * what turns a miss into an answer, so a row that is not there and a row that is somebody
 * else's are the same `NOT_FOUND`.
 *
 * ## No rate limit on any of the three
 *
 * The limiters in this Worker exist where a caller can ask a yes/no question about a value
 * they can guess — an email address, an order id — and each of these three is addressed by a
 * `membershipId` the caller must already own. `accept` and `decline` read the row by
 * `user_id`, so a guess that is not the caller's own invitation answers `NOT_FOUND` whether or
 * not the id exists; and a caller cannot "guess" their own invitations, because they can only
 * act on the ones they have. `leave` is scoped to the caller's own membership.
 */
export const affiliationsRouter = router({
	/**
	 * The invited person accepts. The only path from pending to active.
	 *
	 * Answers the shop and the membership rather than `{ ok: true }`, because the client's next
	 * move is to switch into it: a screen that had to call `business.myBusinesses` again to
	 * learn what it had just joined would show the switcher one row short for a frame, which is
	 * the frame the person is looking at.
	 *
	 * A lapsed invitation is refused **and marked `EXPIRED`** on the way past — see
	 * `services/affiliations.ts` for why a refusal that writes is the right shape here.
	 */
	accept: protectedProcedure
		.input(affiliationAcceptInput)
		.mutation(({ ctx, input }) => affiliations.acceptInvitation(ctx, input)),

	/**
	 * The invited person declines.
	 *
	 * The row is kept, not deleted: a shop's ledger should be able to say that somebody was
	 * asked and said no, which is a different fact from never having asked. No reason is
	 * required — it is the person's own decision about their own access.
	 */
	decline: protectedProcedure
		.input(affiliationDeclineInput)
		.mutation(({ ctx, input }) => affiliations.declineInvitation(ctx, input)),

	/**
	 * Somebody resigns from a shop.
	 *
	 * The guard is the caller's own `ACTIVE` membership, read in the service, and it has to be
	 * that rather than a role: the person leaving may be the shop's owner. The last-owner guard
	 * is what stops the shop being left with nobody who can administer it, and it is the same
	 * function `removeStaff` uses.
	 *
	 * Distinct from `business.revokeAffiliation`, which is the shop removing somebody and is
	 * OWNER-only. The two write the same columns and different audit actions, which is what
	 * lets a ledger say "se fue" and "lo sacaron" as two things.
	 */
	leave: protectedProcedure
		.input(affiliationLeaveInput)
		.mutation(({ ctx, input }) => affiliations.leaveBusiness(ctx, input)),
});
