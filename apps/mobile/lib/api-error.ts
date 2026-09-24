import type { MessageKey, TranslateParams } from "@pymeshub/i18n";
import { TRPCClientError } from "@trpc/client";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { useT } from "@/lib/i18n";

/**
 * What the Worker said when it refused, in the shape it said it.
 *
 * The API's `errorFormatter` puts five things on `error.data`, and this reads exactly
 * those: the tRPC `code` (`UNAUTHORIZED`, `NOT_FOUND`, …), the `httpStatus`, the
 * `domainCode` when the procedure named one, `requestId`, and `details`. Reading them
 * rather than parsing `error.message` is the difference between "the code says
 * UNAUTHORIZED" and "the string contains 401" — the first survives a tRPC upgrade, the
 * second is a regular expression over a sentence somebody will reword.
 *
 * `NOT_FOUND` is deliberately one code for two situations: an order that does not exist
 * and an order that is somebody else's. The API answers the same way to both so that a
 * client cannot be used to discover which ids are real. This layer preserves that — it
 * never turns a 404 into "not yours", because it does not know and must not guess.
 */
export type ApiFailure = {
	/** tRPC's own code: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`. */
	code: string | null;
	httpStatus: number | null;
	/** The API's own name for a specific refusal, when it has one. */
	domainCode: string | null;
	/** The code to quote to support. The only part of an error worth showing a customer. */
	requestId: string | null;
	details: unknown;
	/** The server's text. For a log line, never for a screen. */
	serverMessage: string;
};

const EMPTY_FAILURE: ApiFailure = {
	code: null,
	httpStatus: null,
	domainCode: null,
	requestId: null,
	details: null,
	serverMessage: "",
};

/**
 * Anything tRPC threw, flattened into the five fields above.
 *
 * Total on purpose: a thrown string, a `TypeError` from a bad `fetch` and a batch whose
 * individual error was dropped all arrive here as *something*, and a screen that renders
 * a failure has to have something to render. The fallback is "we don't know what
 * happened", which is honest, rather than a crash inside the error path.
 */
export function toApiFailure(error: unknown): ApiFailure {
	if (!error) return EMPTY_FAILURE;

	if (error instanceof TRPCClientError) {
		const data = error.data as Record<string, unknown> | undefined;
		return {
			code: text(error.data?.code) ?? null,
			httpStatus: number(data?.httpStatus),
			domainCode: text(data?.domainCode),
			requestId: text(data?.requestId),
			details: data?.details ?? null,
			serverMessage: error.message,
		};
	}

	if (error instanceof Error) {
		return { ...EMPTY_FAILURE, serverMessage: error.message };
	}
	return { ...EMPTY_FAILURE, serverMessage: String(error) };
}

/**
 * A sentence for a code: the key, and — when the copy has a placeholder — the values to
 * fill it with.
 *
 * The object form is not a convenience. `biz.board.conflict.body` reads "Ya está en
 * {status}. Actualizamos el tablero con lo último.", and the status it names is a fact the
 * *screen* has (it holds the refreshed board) and this layer does not: a failure carries
 * `code`, `domainCode`, `requestId` and `details`, and none of them is the order's status.
 * A key passed as a bare string therefore could only ever print `{status}` at the reader,
 * which is why the board's conflict sentence was unreachable until the override could carry
 * parameters — see the note at its call site.
 */
export type FailureMessage =
	| MessageKey
	| { key: MessageKey; params?: TranslateParams };

/**
 * Per-screen sentences for the codes whose meaning depends on the call.
 *
 * Keyed by the code it answers, which is either a tRPC code (`CONFLICT`) or the API's own
 * `domainCode` (`PROMOTION_EXPIRED`) — the lookup below tries both.
 */
export type FailureOverrides = Partial<Record<string, FailureMessage>>;

/**
 * The sentences this layer has of its own, by code.
 *
 * Short because the vocabulary is short. Anything not in it falls to `state.error.body` —
 * the generic "it is on our side, not yours", which is true for every code that has no
 * better sentence and is a worse sentence than none only if it hides something the customer
 * could act on. The codes that *are* actionable (`TOO_MANY_REQUESTS`, an expired session) do
 * have their own.
 */
const DEFAULT_KEYS: Partial<Record<string, MessageKey>> = {
	// An expired token is the one 401 a customer can do something about, and the sentence
	// says what: sign in again.
	UNAUTHORIZED: "auth.session.expired",
	// "Demasiados intentos seguidos. Espera un minuto." — already written for sign-in, and
	// the API's limiter is the same shape of fact.
	TOO_MANY_REQUESTS: "auth.error.rateLimited",
	// Nothing here. A product pulled from the menu is `state.empty`'s business and the
	// storefront screen renders it; there is no shared word for "gone" yet, which is why this
	// falls through to the generic body. There is no list to consult and this used to point at
	// one ("the report's i18n gap list") — the sentence a reader needs is in the screen that
	// knows *what* is missing, not in a classifier that only knows *which status* came back.
	NOT_FOUND: "state.error.body",
	FORBIDDEN: "state.error.body",
	BAD_REQUEST: "state.error.body",
	CONFLICT: "state.error.body",
	INTERNAL_SERVER_ERROR: "state.error.body",
};

/**
 * Which sentence to put on the screen, and what to fill into it.
 *
 * The call site's override is consulted before the table, and it is not a nicety — it is the
 * only correct design here. `CONFLICT` from `cart.addItem` means "this cart belongs to a
 * different business" and has a screen with a button on it; `CONFLICT` from `orders.place`
 * means the order was already placed and there is nothing to show. The API cannot tell this
 * layer which screen called it, so the screen says.
 */
function resolveMessage(
	failure: ApiFailure,
	overrides?: FailureOverrides,
): FailureMessage {
	// The domain code is consulted first and wins over the tRPC code, because it is the
	// more specific statement: `PROMOTION_EXPIRED` is a sentence a customer can act on,
	// `BAD_REQUEST` is not.
	const byDomain = failure.domainCode
		? (overrides?.[failure.domainCode] ?? DEFAULT_KEYS[failure.domainCode])
		: undefined;
	if (byDomain) return byDomain;

	if (failure.code) {
		const byCode = overrides?.[failure.code] ?? DEFAULT_KEYS[failure.code];
		if (byCode) return byCode;
	}
	return "state.error.body";
}

/**
 * The sentence a screen renders, as a key plus the parameters that key needs.
 *
 * `t()` is called with both, which is what makes an override whose copy has a placeholder
 * render as a sentence rather than with `{status}` still in it.
 */
export function messageFor(
	failure: ApiFailure,
	overrides?: FailureOverrides,
): { key: MessageKey; params?: TranslateParams } {
	const resolved = resolveMessage(failure, overrides);
	return typeof resolved === "string" ? { key: resolved } : resolved;
}

/**
 * The key alone, for a caller that resolves it into words itself.
 *
 * `lib/favorites.ts` is that caller: it puts the sentence in an `Alert`, which takes a string
 * rather than a key and has no place for an override, so it reads the key and nothing else.
 * A caller that can carry parameters wants `messageFor` — this drops them, and a key with a
 * placeholder rendered through `t(key)` on its own prints the placeholder.
 */
export function messageKeyFor(
	failure: ApiFailure,
	overrides?: FailureOverrides,
): MessageKey {
	return messageFor(failure, overrides).key;
}

export function isUnauthorized(failure: ApiFailure): boolean {
	return failure.code === "UNAUTHORIZED" || failure.httpStatus === 401;
}

/**
 * A failure, ready to render.
 *
 * Returns the sentence, and — separately — the support line, because they belong in
 * different places: the sentence is the screen's error state, the code is a smaller line
 * underneath it that nobody reads unless they are about to contact somebody. `null` when
 * the API did not give a code, rather than an empty line under a real error.
 *
 * The `refresh()` is the point of the hook. A 401 means the token in hand is no longer
 * good — it expired without a background refresh landing, or it was revoked — and the
 * only useful response is to go and look. It is called here, at the point where the
 * failure is actually shown, because that is the moment somebody is looking at the
 * screen: refreshing on a failure nobody rendered spends a network round trip to update
 * a cache entry that is about to be refetched anyway.
 */
export function useApiFailure(
	error: unknown,
	overrides?: FailureOverrides,
): {
	failure: ApiFailure;
	message: string;
	/** "Si vuelve a pasar, menciónale este código a soporte: {requestId}", or `null`. */
	supportLine: string | null;
} {
	const { t } = useT();
	const { refresh } = useSession();
	const failure = toApiFailure(error);
	const unauthorized = isUnauthorized(failure);
	// The key and the parameters its copy needs are resolved together, so the `t()` below
	// cannot end up with a key whose placeholder has nothing to fill it with.
	const sentence = messageFor(failure, overrides);

	useEffect(() => {
		if (unauthorized) void refresh();
	}, [unauthorized, refresh]);

	return {
		failure,
		message: error ? t(sentence.key, sentence.params) : "",
		supportLine: failure.requestId
			? t("state.error.requestId", { requestId: failure.requestId })
			: null,
	};
}

function text(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}
