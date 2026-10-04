import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import type { Page } from "@/lib/admin";

import { ADMIN_PAGE_SIZE, isLastPage, nextOffset, prevOffset } from "./console-pagination";

/**
 * One page of an admin table, and the two controls that move it.
 *
 * ## Why one hook and not six copies
 *
 * Every list in the console is paged by the same three lines of state, and the file's own
 * docblocks complain repeatedly about duplicated observers — `useAdminMetrics` exists
 * because the metrics query used to be declared twice under one key, each observer with its
 * own `refetchInterval`. Six hand-written pagers is that same shape six times over, and the
 * first bug it produces is always the same: a search box that leaves you on page five of a
 * result set you have just changed.
 *
 * ## The two behaviours that are not optional
 *
 * **Search or filter changes must call `reset()`.** The offset is meaningless against a new
 * result set: narrowing "Tienda" to "Ferretería" on page four leaves an operator looking at
 * an empty table that is not empty. The hook cannot do this itself, because it does not know
 * what a filter is — so `reset` is returned and the caller wires it to the inputs that change
 * the result set. See the call sites in `console.tsx`.
 *
 * **An empty page above the first steps back.** The cursor is an offset, so a list that
 * shrinks between two page loads lands the operator past the end. Verified against the
 * service: `cursor: "999"` on a 30-row list returns `{ rows: [], total: 30 }` — an empty
 * page, not an error. Without the step-back that renders as "No hay negocios en esta lista",
 * which is a lie: there are thirty of them.
 *
 * The effect below terminates — the offset strictly decreases and is floored at zero — so it
 * cannot loop, and `isSettling` lets the caller draw a skeleton during the step rather than
 * flash the empty state on the way past it.
 */
export function useAdminPage<T>(options: {
  /**
   * Everything that changes *which rows* come back, except the page itself.
   *
   * The offset is appended by the hook. Anything that changes the result set belongs here,
   * so two different searches are two different queries rather than one query re-fetched.
   */
  queryKey: readonly unknown[];
  /**
   * Fetches one page. Receives the wire cursor — `undefined` on the first page, the offset
   * as a string after that — **and the limit**.
   *
   * `limit` is passed rather than left to each schema's default, and that is not tidiness.
   * The hook is what draws "mostrando 26–50 de 312", so if it labelled a window of 50 while
   * the request asked for the schema's default of 25, the count on screen would be a
   * statement about nothing. `ADMIN_PAGE_SIZE` happens to equal every schema's default
   * today; a hook that relies on that coincidence is a hook that breaks silently when
   * somebody changes one of them.
   *
   * The admin cursor is an offset and `offsetOf` falls back to `Number(cursor)`, so the
   * console sends a bare integer rather than encoding a token. Verified: 30 rows at 25 per
   * page, page two returns the remaining 5.
   */
  queryFn: (page: { cursor: string | undefined; limit: number }) => Promise<Page<T>>;
  pageSize?: number;
}) {
  const size = options.pageSize ?? ADMIN_PAGE_SIZE;
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: [...options.queryKey, "page", offset, size],
    queryFn: () =>
      options.queryFn({
        cursor: offset === 0 ? undefined : String(offset),
        limit: size,
      }),
  });

  const data = query.data;
  const total = data?.total ?? 0;
  const rows = data?.rows;

  useEffect(() => {
    if (rows && rows.length === 0 && offset > 0) {
      setOffset((current) => Math.max(0, current - size));
    }
  }, [rows, offset, size]);

  const next = useCallback(() => setOffset((current) => nextOffset(current, size)), [size]);
  const previous = useCallback(
    () => setOffset((current) => prevOffset(current, size)),
    [size],
  );
  /** Call this from every input that changes the result set — a search box, a filter. */
  const reset = useCallback(() => setOffset(0), []);

  return {
    ...query,
    rows: rows ?? [],
    offset,
    pageSize: size,
    total,
    atFirstPage: offset === 0,
    atLastPage: isLastPage(offset, total, size),
    /**
     * True while the hook is stepping back off an empty page.
     *
     * Callers add this to their `isPending` branch. Without it, one render draws the empty
     * state — "No hay negocios en esta lista" — for a list that has thirty rows, and the
     * step-back lands a frame later.
     */
    isSettling: rows !== undefined && rows.length === 0 && offset > 0,
    next,
    previous,
    reset,
  };
}