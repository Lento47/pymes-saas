import {
	type MembershipRole,
	type RoleCapability,
	roleCan,
} from "@pymeshub/shared";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import { type Context, requireAuthed } from "./context";
import {
	DomainError,
	ForbiddenError,
	HTTP_STATUS,
	InternalError,
	TRPC_CODES,
} from "./errors";

/**
 * The tRPC instance, and the four procedures every router is built from.
 *
 * The whole authorisation model is in this file, which is the point: a router that
 * imports `protectedProcedure` cannot be written without a session, and one that
 * imports `businessProcedure` cannot be written without a membership *for the
 * business the caller asked about*. There is no other guard in the codebase — no
 * decorator to forget, no middleware list to keep in step with a route table.
 */

const t = initTRPC.context<Context>().create({
	/**
	 * `Date` and `Map` survive the wire, and `undefined` survives being absent.
	 *
	 * Not decoration: almost every shape in this API carries a timestamp
	 * (`createdAt`, `estimatedReadyAt`, `suspendedAt`), and the default
	 * transformer turns a `Date` into a string that a client then has to know to
	 * parse. That knowledge, spread across three clients, is how a phone ends up
	 * formatting an ISO string as a day name.
	 */
	transformer: superjson,

	/**
	 * A zod failure on the *input* needs no special case here, and gets none: tRPC parses
	 * `input` before any resolver runs and refuses it as `BAD_REQUEST`, so a malformed
	 * request never reaches a procedure.
	 *
	 * What a client actually receives for one is thinner than this note used to claim. It
	 * said the offending paths arrive in `data.zodError`, which is a field this version of
	 * tRPC does not emit — `zodError` appears nowhere in `@trpc/server@11.19.0`'s dist —
	 * and one this formatter never adds either: `details` below is filled from a
	 * `DomainError`'s own options and stays `null` for a parse failure, `domainCode` is
	 * `null` beside it, and the zod sentence is all that arrives, in `message`. A client
	 * that wants to mark the offending field has to validate with the schema in
	 * `packages/shared` before sending it, which is what
	 * `apps/web/app/business/settings/page.tsx` does.
	 *
	 * A zod parse *inside* a resolver is a different thing — that one is our own bug and
	 * arrives as `INTERNAL_SERVER_ERROR`, which is correct: the customer was not asked for
	 * it.
	 */
	errorFormatter({ shape, error, ctx }) {
		// One place decides what a client may see. A domain error's message was
		// written for a customer; anything else is a bug on our side and gets the
		// generic sentence plus the id that makes it findable in the logs.
		const domain = error.cause instanceof DomainError ? error.cause : null;
		const isInternal = error.code === "INTERNAL_SERVER_ERROR";

		/**
		 * A domain error's code and status, restored here rather than in a middleware.
		 *
		 * tRPC does not know `DomainError`, so a service's `ValidationError` arrives as
		 * an unknown throw wrapped into `INTERNAL_SERVER_ERROR` — which is how a slug
		 * that does not exist answered 500, and how a client that branches on
		 * `data.code` treated "we could not find your order" as "we are broken". A
		 * middleware cannot put this right: the refusal often comes from a *previous*
		 * middleware (`protectedProcedure`, `businessProcedure`), and an error thrown
		 * before a middleware runs never passes through it. The formatter is the one
		 * function every response passes through, so the correction belongs here.
		 *
		 * Anything that is not a `DomainError` keeps tRPC's own classification: an
		 * unexpected throw really is a 500, and calling it anything else would hide a
		 * bug behind a plausible status.
		 */
		const code = domain ? TRPC_CODES[domain.code] : shape.data.code;

		/**
		 * **The top-level `code` is left exactly as tRPC made it, and that is not an
		 * oversight.**
		 *
		 * tRPC's error shape carries the code twice, and the two are different types:
		 * `shape.code` is the **numeric** JSON-RPC code (`TRPC_ERROR_CODES_BY_KEY`), and
		 * `shape.data.code` is the **string** key (`"NOT_FOUND"`). The client validates
		 * the numeric one — `transformResult` in `@trpc/server`'s `transformer.ts` throws
		 * `TransformResultError` unless `typeof error.error.code === "number"` — and that
		 * throw surfaces as `TRPCClientError: Unable to transform response from server`
		 * with `data` undefined, i.e. **no message, no domain code, no request id**.
		 *
		 * This formatter used to overwrite it with `TRPC_CODES[domain.code]`, a string.
		 * Every domain error in the API was therefore unreadable by every client: a
		 * mistyped slug, a suspended shop and a genuinely broken Worker all arrived as
		 * the same opaque sentence, which is the exact failure §"a note on where that
		 * mapping is applied" in `errors.ts` set out to prevent. The `data` fields below
		 * are what a client reads; `data.code` carries the string, so nothing is lost.
		 */
		return {
			...shape,
			message:
				domain?.userMessage ??
				(isInternal ? "Algo salió mal de nuestro lado" : shape.message),
			data: {
				...shape.data,
				code,
				httpStatus: domain ? HTTP_STATUS[domain.code] : shape.data.httpStatus,
				requestId: ctx?.requestId ?? null,
				domainCode: domain?.code ?? (isInternal ? "INTERNAL" : null),
				details: domain?.details ?? null,
				// The stack is a development aid and a disclosure in production: it
				// names files, and a bundled Worker's frames name our module layout.
				stack:
					ctx?.env.ENVIRONMENT === "production" ? undefined : shape.data.stack,
			},
		};
	},
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/**
 * Anything that needs a session.
 *
 * `requireAuthed` throws `UnauthorizedError` rather than a bare `TRPCError`, so the
 * failure goes through the same formatter as every other domain error and carries the
 * same Spanish sentence — one code path for "who are you", whether the refusal came
 * from here or from a service.
 */
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
	const authed = requireAuthed(ctx);
	return next({ ctx: authed });
});

/**
 * A session, plus a role inside the business named in the input.
 *
 * Reads `getRawInput()` deliberately: the check has to run **before** the procedure's
 * own input schema, because a schema that rejects the request would otherwise answer
 * a non-member with a validation message about a business they may not know exists.
 * The `businessId` is read leniently here and validated by the procedure afterwards —
 * this middleware's only job is to answer "is this caller allowed near this tenant".
 *
 * The role comparison uses `roleCan` from `@pymeshub/shared` rather than a table of
 * its own, so the capability a procedure asks for is the same string the UI reads to
 * decide whether to render the button. A separate server-side role table is how a
 * hidden button becomes a working endpoint.
 */
export function businessProcedure(capability: RoleCapability) {
	return protectedProcedure.use(async ({ ctx, getRawInput, next }) => {
		const input = (await getRawInput()) as { businessId?: unknown } | undefined;
		const businessId =
			typeof input?.businessId === "string" ? input.businessId : null;

		if (!businessId) {
			// A procedure that needs a tenant and was not told which one is our bug, so
			// it fails loudly here rather than reading across every business the caller
			// belongs to. `docs/api-surface.md` states that every business procedure
			// takes `businessId`.
			throw new InternalError(
				new Error(`${capability}: procedure is missing its businessId input`),
			);
		}

		const membership = ctx.memberships.find(
			(entry) => entry.businessId === businessId,
		);
		if (!membership) {
			// The caller is signed in and the business is not theirs. Deliberately
			// `forbidden` rather than `not found`: they already know it exists — they
			// typed its id or tapped its card — and a 404 would read as a bug in our
			// app rather than as a permission.
			throw new ForbiddenError();
		}

		if (!roleCan(membership.role as MembershipRole, capability)) {
			throw new ForbiddenError("Tu rol no permite esta acción");
		}

		return next({
			ctx: { ...ctx, membership: { businessId, role: membership.role } },
		});
	});
}

/** Platform operators. `isAdmin` is set in SQL and never granted through the API surface. */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.user.isAdmin)
		throw new ForbiddenError("Solo el equipo de PymesHub puede hacer esto");
	return next({ ctx });
});
