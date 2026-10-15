import {
	invitationPreviewInput,
	myIdentityInput,
	publicProfileInput,
} from "@pymeshub/shared";

import * as affiliations from "../services/affiliations";
import * as identity from "../services/identity";
import { protectedProcedure, publicProcedure, router } from "../trpc";
/**
 * Who somebody is — the fourth router that answers a question about an account rather than
 * about a shop's inventory, and the only one with public procedures.
 *
 * ## Why this is a namespace of its own rather than three more on `business`
 *
 * `business.*` is the merchant's dashboard: every procedure on it names a `businessId` and is
 * checked against a membership before the body runs. Two of the three reads here name a
 * **person** and have no tenant to check — `identity.profile` is asked by a stranger about a
 * shop, and `identity.mine` is asked by a person about themselves — so putting them on
 * `business` would mean three procedures exempted from that router's one invariant. The
 * invariant is worth more than the convenience: a router where every procedure is a
 * `businessProcedure` except some is a router where the exception is invisible.
 *
 * ## The two public reads, and why neither is rate-limited
 *
 * `identity.profile` answers a slug, and `identity.invitationPreview` answers a token. Both
 * are reachable without a session, and neither has a limiter — which is a decision, not an
 * omission:
 *
 * - **`identity.profile` returns public data.** It is the same shop, verified the same way,
 *   that `business.bySlug` and the catalog already return to anybody. A limiter on it would
 *   protect nothing, and slugs are short enough that a limiter would be the only thing
 *   standing between a scraper and information the storefront hands out on purpose.
 * - **`identity.invitationPreview` is a lookup by a 256-bit digest.** There is no input space
 *   to enumerate: `hashInviteToken` maps a guessed string to one of 2^256 digests, and the
 *   lookup is an index hit on the result. The limiters elsewhere in this Worker exist where a
 *   caller can ask a **yes/no question about a value they can guess** — an email address in
 *   `inviteStaff`, an order id in `orders.byId` — and no such question exists here. The
 *   response is also written for a stranger: a shop name, a role, an inviter's name, and
 *   whether the window is open. Nothing in it is worth an attempt, because an attempt cannot
 *   succeed.
 *
 * The third procedure is `protectedProcedure`, and it is the one that could not be public
 * under any spelling: it answers with the caller's own memberships.
 */
export const identityRouter = router({
	/**
	 * A shop's public profile, by slug.
	 *
	 * Public on purpose: this is what a badge deep-links to, and a link that demanded a
	 * session would be a link nobody could follow from a storefront. The rules about *who* may
	 * be looked up (only a shop in a public status) and *what* comes back (the collapsed
	 * verification, no affiliation) are in `services/identity.ts`, where every other badge
	 * rule lives.
	 */
	profile: publicProcedure
		.input(publicProfileInput)
		.query(({ ctx, input }) =>
			identity.resolveProfileBySlug(ctx.db, input.slug),
		),

	/**
	 * What an invitation link is, for somebody who is not signed in yet.
	 *
	 * The link's landing page needs a shop name and a role before it can decide whether to
	 * ask the visitor to sign in, and this is that answer. It cannot accept anything: the
	 * accept path is `affiliations.accept`, it is authenticated, and it reads the membership
	 * by the caller's own user id. Holding the link is not being the invitee.
	 *
	 * A token that names nothing, and a token whose relationship is over, both answer
	 * `NOT_FOUND` — the difference would tell a prober which of their guesses was real.
	 */
	invitationPreview: publicProcedure
		.input(invitationPreviewInput)
		.query(({ ctx, input }) => affiliations.invitationPreview(ctx.db, input)),

	/**
	 * The caller: their profile, the shops they may act for, and their invitations.
	 *
	 * `scopeBusinessId` is the shop selected in the switcher, and it is honoured only when it
	 * names an `ACTIVE` membership — the condition is inside the `where` in
	 * `services/identity.ts`, so naming a shop the caller was removed from yields no
	 * affiliation rather than an affiliation with a status attached.
	 */
	mine: protectedProcedure
		.input(myIdentityInput)
		.query(({ ctx, input }) =>
			identity.myIdentity(ctx, { scopeBusinessId: input?.scopeBusinessId }),
		),
});
