import {
	business as businessTable,
	category as categoryTable,
} from "@pymeshub/db";
import {
	type BusinessHoursEntry,
	MEMBERSHIP_ROLES,
	type MembershipRole,
} from "@pymeshub/shared";
import { eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import type { AuthedContext, Context } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";

/**
 * The pieces every service needs, and the two kinds of context they run in.
 *
 * Nothing here reads a table. It is the vocabulary the rest of `services/` is
 * written in: what a business context is, how a role refusal is expressed, and what
 * "open now" means.
 */

/** What a `businessProcedure` body is guaranteed to have. */
export type BusinessContext = AuthedContext & {
	membership: { businessId: string; role: MembershipRole };
};

/** A `protectedProcedure` body, narrowed the way `protectedProcedure` narrows it. */
export type UserContext = AuthedContext;

/**
 * Refuse a member whose role is too low for this particular action.
 *
 * `businessProcedure(capability)` already answered "is this caller allowed near this
 * tenant" and, for most procedures, "is their role high enough" — the capability
 * table in `@pymeshub/shared` covers STAFF/MANAGER/OWNER for the things it names.
 * What it cannot express is a *distinction inside* a capability: `staff:manage`
 * belongs to MANAGER and OWNER, while changing somebody's role and removing the last
 * owner are OWNER's alone, and `products:write` belongs to STAFF and OWNER alike
 * while archiving is a manager's decision.
 *
 * So the coarse gate stays in the middleware, where it cannot be forgotten, and this
 * is the narrow one, written next to the rule it enforces.
 */
export function assertRole(
	ctx: { membership: { role: MembershipRole } },
	...allowed: readonly MembershipRole[]
): MembershipRole {
	const role = ctx.membership.role;
	if (!allowed.includes(role))
		throw new ForbiddenError("Tu rol no permite esta acción");
	return role;
}

/** Every role, spelled out where a procedure means "anybody on the team". */
export const ANY_ROLE: readonly MembershipRole[] = MEMBERSHIP_ROLES;

/**
 * The statuses a customer may see.
 *
 * `DRAFT` is a business that has not opened and `SUSPENDED` is one the platform has
 * closed; both are invisible to the marketplace, and both must be filtered the same
 * way in every public read. Three copies of `status in ('ACTIVE','CLOSED')` is how a
 * suspended shop stays on the home screen in the one query somebody forgot.
 */
export const PUBLIC_BUSINESS_STATUSES = ["ACTIVE", "CLOSED"] as const;

export function isPublicBusiness(status: string): boolean {
	return (PUBLIC_BUSINESS_STATUSES as readonly string[]).includes(status);
}

/**
 * The `where` clause every public read of a business carries.
 *
 * One expression rather than the same `inArray` typed into four queries — a status
 * added to `BUSINESS_STATUSES` later has to be classified once, here, instead of being
 * remembered in each list. It lives next to the list it reads rather than in
 * `catalog.ts`, where it was written first, because `products.ts` needs it too and a
 * helper that only one service may import is how the second service ends up with a
 * copy.
 */
export function publicBusiness() {
	return inArray(businessTable.status, [...PUBLIC_BUSINESS_STATUSES]);
}

/**
 * A category filter that means the categories *under* the one it names, as well as the one.
 *
 * The taxonomy is two levels — a sector and the categories it holds — and the id a client
 * sends is whichever level the customer tapped. `eq(category_id, sectorId)` is true of no row
 * at all, because a product is filed under a leaf: tapping "Food & Beverage" on the home rail
 * answered an empty list over a stocked catalogue. `0006_category_taxonomy.sql` is where the
 * second level came from; before it every category was a leaf and the equality was right.
 *
 * The subquery is written column by column rather than with an interpolated table, and the
 * names do not collide: the inner scope has `id` and `parent_id`, the outer one the
 * `category_id` this is handed, so a bare name resolves to the table that owns it. The two
 * lists that filter by category — `products.list` and `businesses.list` — read this rather
 * than the same `or` twice, because the second copy is the one that keeps the equality after
 * the first is fixed.
 */
export function inCategory(
	column: AnySQLiteColumn,
	categoryId: string,
): SQL<unknown> {
	return or(
		eq(column, categoryId),
		sql`${column} in (select ${categoryTable.id} from ${categoryTable} where ${categoryTable.parentId} = ${categoryId})`,
	) as SQL<unknown>;
}

/**
 * Read one row, or answer exactly as though nothing were there.
 *
 * The point is what it does *not* distinguish: a row that does not exist and a row
 * that belongs to somebody else produce the same error, so a probe cannot use the
 * difference to learn which ids are real. That is why every caller of this function
 * has already put the tenant or the owner in the `where` clause rather than checking
 * it after the read — the check and the lookup are one statement, and a version that
 * reads first and compares afterwards is the bug this whole design exists to
 * prevent.
 */
export function orNotFound<T>(row: T | undefined): T {
	if (!row) throw new NotFoundError();
	return row;
}

/**
 * Costa Rica is UTC−6 all year: the country has had no daylight saving since 1992,
 * and the marketplace's first and largest market is San José. A business's hours are
 * local wall-clock minutes, so something has to say *whose* clock, and this constant
 * is that answer in one place.
 *
 * When a second market with a real DST rule arrives, this becomes a column on
 * `business` — not a branch here.
 */
const MARKET_UTC_OFFSET_MINUTES = -6 * 60;

/** The business's local weekday and minute-of-day, from an instant. */
export function localDayAndMinute(at: Date): {
	day: number;
	minuteOfDay: number;
} {
	const shifted = new Date(at.getTime() + MARKET_UTC_OFFSET_MINUTES * 60_000);
	return {
		day: shifted.getUTCDay(),
		minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
	};
}

/**
 * Whether a business is open, from its own hours and the current instant.
 *
 * Computed on the server rather than in a client, and not out of laziness: a phone in
 * another timezone would need the business's offset and its hours to reach the same
 * answer, and the first of those is exactly what a client does not have.
 *
 * A business with no hours recorded is treated as open — an owner who has not filled
 * the opening-hours form in yet must not have their storefront read as closed to
 * every customer in the meantime. It is the one place in this product where "we do
 * not know" resolves to "yes", and it resolves that way because the alternative is a
 * shop that cannot take an order until a settings screen is filled in.
 */
export function isOpenAt(
	hours: BusinessHoursEntry[] | null,
	at: Date,
): boolean {
	if (!hours || hours.length === 0) return true;

	const { day, minuteOfDay } = localDayAndMinute(at);
	const today = hours.find((entry) => entry.day === day);
	if (!today || today.isClosed) return false;

	return minuteOfDay >= today.opensMinute && minuteOfDay < today.closesMinute;
}

/** `YYYY-MM-DD`, in UTC. The day key every series in this API is grouped by. */
export function dayKey(at: Date): string {
	return at.toISOString().slice(0, 10);
}

/** Midnight UTC, `days` before `at`. */
export function startOfUtcDay(at: Date): Date {
	return new Date(
		Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
	);
}

/** A `LIKE` pattern that cannot be widened by what the customer typed. */
export function likePattern(term: string): string {
	return `%${term.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
}

/** Two decimals, without `100` appearing anywhere. For distances, never for money. */
export function roundKm(km: number): number {
	return Math.round(km * 100) / 100;
}

/**
 * A non-empty statement list for `db.batch`.
 *
 * D1 refuses `begin`/`commit`, so `batch` is the only transaction this database has —
 * and it takes a non-empty *tuple*, not an array, because a batch with nothing in it
 * is not atomic, it is nothing. A list assembled with `push` widens to `T[]`, which
 * the overload rejects, so the tuple is asserted here once rather than at each call
 * site that wants a write and its audit row in one trip.
 */
export function batchOf<T>(statements: T[]): [T, ...T[]] {
	return statements as [T, ...T[]];
}

/** A `Context` for the code paths that run outside a request — tests, mostly. */
export type AnyContext = Context;
