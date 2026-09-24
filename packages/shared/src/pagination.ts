/**
 * Two pagination shapes, because the product has two kinds of list and pretending
 * otherwise makes one of them wrong.
 *
 * - An **admin table** wants a page number and a total: somebody is going to page
 *   through it, sort it, and read "1–20 of 431".
 * - A **feed** wants a cursor: the home screen appends while the customer scrolls,
 *   and an offset-paginated feed duplicates and skips rows the moment a business
 *   adds a product while they are scrolling.
 *
 * Filtering, sorting and slicing happen in SQL in both cases. A procedure that
 * returns a whole table for the browser to filter is the thing this file exists to
 * make unnecessary.
 */

import { z } from "zod";

export const MAX_PAGE_SIZE = 100;
export const MAX_CURSOR_LIMIT = 50;

const sortDirection = z.enum(["asc", "desc"]);

export const pageInput = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
	sort: z.string().min(1).max(40).optional(),
	direction: sortDirection.default("desc"),
	search: z.string().trim().min(1).max(120).optional(),
});
export type PageInput = z.infer<typeof pageInput>;

/**
 * The base shape of a cursor feed's input.
 *
 * `cursor` is spelled that way because it is a **reserved key**: an infinite query built by
 * `@trpc/tanstack-react-query` fills `cursor` from the page param, and it also writes
 * `direction` itself — `"forward"` or `"backward"`. A feed input may therefore never name a
 * field `direction`; a sort direction on a feed is `sortDirection`. This comment is here
 * rather than on the feeds because this is the file someone reads before writing the next
 * one — the reserved names belong to the transport, not to any one list.
 */
export const cursorInput = z.object({
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(MAX_CURSOR_LIMIT).default(20),
});
export type CursorInput = z.infer<typeof cursorInput>;

/**
 * `facetCounts` is part of the page shape rather than a separate procedure because
 * a filter sidebar and the rows it filters must come from one query's worth of
 * truth. Two round trips is how a filter shows 12 results on a tab that says 8.
 */
export function listResult<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		rows: z.array(item),
		total: z.number().int().min(0),
		facetCounts: z.record(z.string(), z.number().int().min(0)).optional(),
	});
}

export function cursorResult<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		items: z.array(item),
		nextCursor: z.string().nullable(),
	});
}

/**
 * Resolve a client-supplied sort key against the columns a module allows.
 *
 * The rule that matters: **the sort key is never interpolated into SQL**. A caller
 * sends `"price"`, this returns the column the module mapped it to, and an unknown
 * key falls back to the module's default rather than erroring — a stale bookmark
 * with `?sort=relevance` should render the list, not a validation failure.
 */
export function resolveOrderBy<const T extends Record<string, string>>(
	allowed: T,
	requested: string | undefined,
	direction: "asc" | "desc" = "desc",
	fallback?: keyof T,
): { column: T[keyof T]; direction: "asc" | "desc" } {
	const key = requested && requested in allowed ? requested : fallback;
	const column = (key ? allowed[key] : undefined) ?? Object.values(allowed)[0];
	return { column: column as T[keyof T], direction };
}

/**
 * Encode and decode an opaque cursor. It is base64 of a JSON tuple rather than a
 * bare id because most feeds page on `(placedAt, id)` — paging on `id` alone sorts
 * by a random uuid and hands the customer a shuffled list.
 */
export function encodeCursor(value: Record<string, string | number>): string {
	return btoa(JSON.stringify(value));
}

export function decodeCursor<T extends Record<string, string | number>>(
	cursor: string | undefined,
): T | null {
	if (!cursor) return null;
	try {
		return JSON.parse(atob(cursor)) as T;
	} catch {
		// A malformed cursor is a stale link, not an attack. Returning null gives the
		// caller the first page, which is what the person expected to see anyway.
		return null;
	}
}
