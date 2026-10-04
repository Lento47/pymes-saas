/**
 * The console's paging arithmetic, as pure functions.
 *
 * Split out for the reason `console-tabs.ts` is: the decisions here are pure and worth
 * testing without mounting a router, a query client and a dozen tab components. The hook
 * that *uses* them is `use-admin-page.ts`; the control that draws them is `console-pager.tsx`.
 *
 * ## Why the copy says "mostrando 26–50 de 312" and never "página 2"
 *
 * The admin cursor is an **offset**, not a keyset. `offsetOf` in
 * `packages/trpc-api/src/services/admin.ts` decodes it and falls back to `Number(cursor)`,
 * which is what lets the console hold a plain integer rather than an opaque token.
 *
 * The cost of an offset is that it is a position in a *moving* list. A business adds an
 * order mid-scroll, every later row shifts down one, and "page 3" becomes a description of
 * a moment that has already passed. The service documents this outright — *"a business
 * adding an order mid-scroll can shift a row between pages; that is a table refreshing, not
 * a feed duplicating"* — so the UI must not promise a stability the API has explicitly
 * disclaimed. A row range is a fact about what is on screen; a page number is a promise.
 *
 * It also means the last page is usually short, and **the end of the window is clamped**:
 * with 30 rows at 25 per page, page two is rows 26–30, not 26–50. That clamp is the whole
 * reason this is a function with a test rather than arithmetic inlined at the call site.
 */

/**
 * Rows per page.
 *
 * 25 is what every admin table already showed, because `adminListInput.limit` defaults to
 * it and the console never overrode it. Keeping it means the pager is the only thing that
 * changes — no table silently doubles its payload, and `adminCourierListInput.limit` caps
 * at 50, so anything above 50 would be refused on the courier list alone.
 */
export const ADMIN_PAGE_SIZE = 25;

/**
 * How many pages a list has.
 *
 * **Never zero.** An empty list still has a first page — the one showing nothing — and a
 * pager that renders "0 de 0" and offers no previous button is a pager that has to be
 * special-cased by every caller that draws it.
 */
export function pageCount(total: number, size: number = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, size)));
}

/**
 * The row range currently on screen, in words.
 *
 * Both ends are clamped against `total`, and the **first** one is `Math.min(offset + 1,
 * total)` rather than `offset + 1`: an offset left over from a list that has since shrunk
 * would otherwise claim to start past the end.
 */
export function windowLabel(
  offset: number,
  total: number,
  size: number = ADMIN_PAGE_SIZE,
): string {
  if (total <= 0) return "sin resultados";
  const first = Math.min(offset + 1, total);
  const last = Math.min(offset + size, total);
  return `mostrando ${first}–${last} de ${total}`;
}

/** One page forward. Unclamped: the last page is `atLastPage`'s job, not this function's. */
export function nextOffset(offset: number, size: number = ADMIN_PAGE_SIZE): number {
  return offset + size;
}

/** One page back, never below zero — "previous" on the first page is not an error, it is a no-op. */
export function prevOffset(offset: number, size: number = ADMIN_PAGE_SIZE): number {
  return Math.max(0, offset - size);
}

/**
 * Whether the current page is the last one.
 *
 * True on an empty list (`total` of 0), which is deliberate: with nothing to page, nothing
 * should look pageable, so both directions read as unavailable.
 */
export function isLastPage(
  offset: number,
  total: number,
  size: number = ADMIN_PAGE_SIZE,
): boolean {
  return offset + size >= total;
}