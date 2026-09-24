/**
 * The domain's errors, and the single place they become tRPC codes.
 *
 * Services throw these; nothing downstream decides what status a failure has. That
 * separation is why `docs/api.md`'s "services know nothing about tRPC" survives the
 * move off Nest: the mapping — `TRPC_CODES` for the code, `HTTP_STATUS` for the
 * status — lives here, once, instead of in every procedure.
 *
 * A note on where that mapping is *applied*, because it is not here and it is not a
 * middleware: a service's error reaches tRPC as an unknown throw, and tRPC wraps it
 * into `INTERNAL_SERVER_ERROR` keeping the original as `cause`. A middleware cannot
 * fix that — an error thrown by an earlier middleware never reaches a later one — so
 * `trpc.ts`'s `errorFormatter`, which every response passes through, reads the cause
 * and corrects both the code and the status from the tables below.
 *
 * The one non-obvious choice is `notFound`'s message. "Not found" and "not yours"
 * deliberately return the *same* error, because a marketplace where a probe can
 * tell them apart hands anyone with an account a directory of which businesses
 * exist and which ids are real. `forbidden` is kept for the case where the caller
 * already knows the business exists — a staff member whose role is too low — since
 * hiding that from a member of the same business buys nothing and confuses them.
 */

export type ErrorCode =
	| "BAD_REQUEST"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "CONFLICT"
	| "TOO_MANY_REQUESTS"
	| "INTERNAL";

export const TRPC_CODES = {
	BAD_REQUEST: "BAD_REQUEST",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	CONFLICT: "CONFLICT",
	TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
	INTERNAL: "INTERNAL_SERVER_ERROR",
} as const satisfies Record<ErrorCode, string>;

export type TrpcCode = (typeof TRPC_CODES)[ErrorCode];

/**
 * The status each code answers with.
 *
 * tRPC derives this itself, but only from an error it classified; a `DomainError`
 * arriving as an unknown throw gets `INTERNAL_SERVER_ERROR` and a 500, which is how a
 * missing order and a typo in a slug both answered "something went wrong on our side".
 * `trpc.ts` reads this table to correct that at the one place every response passes
 * through.
 */
export const HTTP_STATUS = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	TOO_MANY_REQUESTS: 429,
	INTERNAL: 500,
} as const satisfies Record<ErrorCode, number>;

export class DomainError extends Error {
	readonly code: ErrorCode;
	/**
	 * Shown to the customer — in Spanish, because that is the product's language, or as a
	 * **message key** from `@pymeshub/i18n` when the refusal's words are the client's to
	 * choose.
	 *
	 * The second case is not a loophole in the first: a key is the honest spelling of a fact
	 * whose sentence exists in no dictionary this package can reach, and the client holds the
	 * translator. `orders.place`'s promotion refusal is the one that does it today — see
	 * `promotionFor` and `PROMOTION_ERROR_KEYS` in `@pymeshub/shared`. A reader that shows
	 * `message` to a customer must therefore resolve a known key before printing it;
	 * `apps/{web,mobile}/lib/api-error.ts` are those readers.
	 */
	readonly userMessage: string;
	/** Extra fields a client needs to act — which field failed, what the minimum is. */
	readonly details?: Record<string, unknown>;

	constructor(
		code: ErrorCode,
		userMessage: string,
		options: { cause?: unknown; details?: Record<string, unknown> } = {},
	) {
		super(userMessage, { cause: options.cause });
		this.name = "DomainError";
		this.code = code;
		this.userMessage = userMessage;
		this.details = options.details;
	}
}

/** The customer can fix this — an empty cart, an order under the minimum. */
export class ValidationError extends DomainError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("BAD_REQUEST", message, { details });
		this.name = "ValidationError";
	}
}

/**
 * No token, or one that did not verify.
 *
 * Also what an unconfigured install answers with, which is the fail-closed
 * behaviour `auth.ts` exists for: a Worker with no `AUTH_SECRET` builds no Better
 * Auth instance, so it cannot resolve a session and accepts nothing.
 */
export class UnauthorizedError extends DomainError {
	constructor(message = "Inicia sesión para continuar") {
		super("UNAUTHORIZED", message);
		this.name = "UnauthorizedError";
	}
}

/** Signed in, and not allowed. Not a member, or a role too low for the action. */
export class ForbiddenError extends DomainError {
	constructor(message = "No tienes acceso a este negocio") {
		super("FORBIDDEN", message);
		this.name = "ForbiddenError";
	}
}

/**
 * Missing, **or outside the caller's scope**. The caller cannot tell which, on
 * purpose — see the note at the top of this file.
 */
export class NotFoundError extends DomainError {
	constructor(message = "No encontramos lo que buscas") {
		super("NOT_FOUND", message);
		this.name = "NotFoundError";
	}
}

/** A state the caller can resolve by asking: the cart belongs elsewhere, the order moved. */
export class ConflictError extends DomainError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("CONFLICT", message, { details });
		this.name = "ConflictError";
	}
}

export class RateLimitError extends DomainError {
	constructor(message = "Demasiados intentos. Espera un momento.") {
		super("TOO_MANY_REQUESTS", message);
		this.name = "RateLimitError";
	}
}

/**
 * Our fault, and deliberately opaque to the caller.
 *
 * The message the customer sees is generic and the `requestId` is what makes it
 * traceable. A database error's own text can name a table, a column and a
 * constraint, which is a schema disclosure dressed as helpfulness.
 */
export class InternalError extends DomainError {
	constructor(cause?: unknown) {
		super("INTERNAL", "Algo salió mal de nuestro lado", { cause });
		this.name = "InternalError";
	}
}

/** A zod failure or a thrown non-domain error, funnelled into one shape. */
export function toDomainError(error: unknown): DomainError {
	if (error instanceof DomainError) return error;
	return new InternalError(error);
}
