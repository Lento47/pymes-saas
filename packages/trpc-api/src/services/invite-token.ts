import { newId } from "@pymeshub/shared";

/**
 * The invitation link's token, and the one direction it is allowed to travel.
 *
 * **This file exists because a token that is stored as itself is a token a database
 * dump hands over.** An invitation link arrives by email and is opened by somebody who
 * is not signed in yet, which makes it a bearer credential: whoever holds it can read
 * the shop's name and its invitation through `identity.invitationPreview`. That read
 * is deliberately small — no email address, no membership, no capability — but "small"
 * is not "free", and the digest is what keeps the cost of losing the database from
 * including every outstanding invitation on the platform.
 *
 * Two functions, and the asymmetry is the point: `hashInviteToken` is called on the
 * way in *and* on the way back, so a lookup is a lookup by digest, and the raw value
 * exists in exactly two places — the response that minted it and the mail that carried
 * it. Nothing in this package ever recovers it from a row.
 *
 * ## Why SHA-256 with no salt and no stretching
 *
 * A password hash needs a salt and a work factor because a password is guessable:
 * the attacker enumerates the input space, and the cost per guess is the defence. This
 * token is 256 bits from `crypto.getRandomValues`, so there is no input space to
 * enumerate — the only attack is a preimage on SHA-256, and no amount of stretching
 * changes whether that exists. A salt would additionally break the lookup: the digest
 * is the index, so a per-row salt would mean scanning every row to find the one whose
 * salt produces a match.
 *
 * ## Why the hash carries the prefix
 *
 * `newId("membership")` is not used for the token — the token is not an id and must
 * not be mistakable for one — but the digest is prefixed with `sha256:` anyway, so a
 * value read out of `membership.invite_token_hash` says what it is. The alternative is
 * a bare 64-character hex string that a future reader has to guess the provenance of,
 * and the guess that matters is "can I compare this to something a client sent me" —
 * which the prefix answers by making it obviously not the thing to compare.
 */

/** What every digest this module produces starts with. See the header. */
const DIGEST_PREFIX = "sha256:";

/** Bytes of entropy in a token. 32 is 256 bits, and the length is not a knob. */
const TOKEN_BYTES = 32;

/**
 * The digest of a token, in the one spelling both the writer and the reader use.
 *
 * `crypto.subtle` rather than `node:crypto`, because this runs in a Worker and in Bun
 * — the two runtimes the suite and production use — and `subtle` is the one API both
 * provide. It is async as a consequence, which is why every caller of it is too.
 */
export async function hashInviteToken(token: string): Promise<string> {
	const bytes = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	const hex = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `${DIGEST_PREFIX}${hex}`;
}

/**
 * A new token and its digest, together, because minting one without the other is a
 * bug in both directions: a token with no digest cannot be stored, and a digest with
 * no token cannot be sent.
 *
 * The token is URL-safe base64 of random bytes rather than hex: same entropy in 43
 * characters instead of 64, which matters because it rides in a link a person may
 * have to read off a screen. `+` and `/` are replaced and `=` dropped, so the value
 * needs no escaping in a query string or a path segment.
 */
export async function mintInviteToken(): Promise<{
	token: string;
	hash: string;
}> {
	const bytes = new Uint8Array(TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	const token = btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return { token, hash: await hashInviteToken(token) };
}

/**
 * The id a new invitation's `membership` row gets.
 *
 * Here rather than in `services/affiliations.ts` for the reason this module exists:
 * an invitation is a membership *plus a link*, and the two are minted in the same
 * breath so neither can be forgotten. The prefix is `membership`'s own — a pending
 * invitation **is** a membership row, and giving it a second prefix would let a reader
 * believe there are two tables.
 */
export function newInvitationId(): string {
	return newId("membership");
}
