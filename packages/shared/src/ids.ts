/**
 * Ids carry their kind as a prefix — `ord_…`, `prd_…` — because the alternative is
 * a debugging session that starts by looking up which table a `cuid` belongs to.
 * The prefix costs eight bytes and answers the question at a glance in a log line,
 * a queue message or a URL.
 *
 * Ids are minted **server-side only**. `newId` reads `globalThis.crypto`, which
 * exists in Workers and in Node but is not guaranteed in a React Native runtime
 * without a polyfill; rather than ship a client that half-works, the rule is that a
 * client sends an intent and the API decides the identity. A client-generated id
 * would also mean a client could choose a row's identity in a shared table, which
 * is a decision worth not delegating.
 */

export const ID_PREFIXES = {
	user: "usr",
	business: "biz",
	location: "loc",
	membership: "mem",
	address: "adr",
	category: "cat",
	product: "prd",
	variant: "var",
	optionGroup: "ogp",
	option: "opt",
	inventory: "inv",
	cart: "crt",
	cartItem: "cit",
	order: "ord",
	orderItem: "oit",
	orderEvent: "oev",
	event: "evt",
	outboxEvent: "obx",
	review: "rev",
	favorite: "fav",
	promotion: "prm",
	notification: "ntf",
	payout: "pay",
	auditLog: "aud",
	session: "ses",
	account: "acc",
	upload: "upl",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdKind];

const PREFIX_SET = new Set<string>(Object.values(ID_PREFIXES));

/** `newId("order")` → `"ord_0f8c1a3e-…"`. Server-side only. */
export function newId(kind: IdKind): string {
	return `${ID_PREFIXES[kind]}_${crypto.randomUUID()}`;
}

/** True when the id is well-formed and its prefix matches the expected kind. */
export function isIdOfKind(value: string, kind: IdKind): boolean {
	return value.startsWith(`${ID_PREFIXES[kind]}_`) && value.length > 5;
}

/**
 * The prefix an id carries, or null if it carries none. Used by the API's error
 * handler to say "expected an order id, got a product id" instead of the more
 * common and less useful "not found".
 */
export function idKindOf(value: string): IdPrefix | null {
	const separator = value.indexOf("_");
	if (separator <= 0) return null;
	const prefix = value.slice(0, separator);
	return PREFIX_SET.has(prefix) ? (prefix as IdPrefix) : null;
}

/**
 * A human-facing order reference: `PYM-8F3K2Q`. Short enough to read over a phone,
 * unambiguous enough to type back, and separate from the order's id because the
 * reference is printed on a receipt while the id stays internal.
 *
 * The alphabet excludes I, O, 0 and 1 — a customer reading a reference aloud is the
 * one case this has to survive.
 */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newOrderReference(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	const body = Array.from(
		bytes,
		(byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
	).join("");
	return `PYM-${body}`;
}

export function isOrderReference(value: string): boolean {
	return /^PYM-[2-9A-HJ-NP-Z]{6}$/.test(value);
}
