/**
 * How the console's tables are ordered, and why the options differ per table.
 *
 * This is a separate file, with the reason `console-tabs.ts` is one: the decisions here are
 * pure and worth testing without mounting a router, a query client and a dozen tab
 * components. `console.tsx` holds the control that renders them; the rules live here.
 *
 * ## Why this exists at all
 *
 * Every list the console shows is already sortable **on the server** — `adminListInput`
 * carries `sort: newest | name | orders | revenue` and the console passed none of it. An
 * operator looking for the merchant with the most orders had no way to ask, because the
 * capability existed one layer down and no screen above it offered the question.
 *
 * The gap is visible in the file itself: `admin.subscriptions` has had a sort control since
 * it was written, and it is the only table that does. The other four were not missing the
 * feature so much as the control.
 *
 * ## The two tables that deliberately get nothing
 *
 * - **Repartidores** — `adminCourierListInput` has no `sort` field at all. There is nothing
 *   to send, so there is nothing to offer.
 * - **Auditoría** — `adminListInput` does carry `sort`, and `auditLogEntries` accepts it
 *   **without reading it**: the query orders by `createdAt` only. A control here would look
 *   like it worked, and an operator would trust an ordering that never happened. A missing
 *   feature is recoverable; a lying control is not.
 */

/** The four orderings `adminListInput` supports, shared by negocios, personas and órdenes. */
export type AdminListSort = "newest" | "name" | "orders" | "revenue";

/** The four the support queue supports, which are not the same four. */
export type TicketSort = "newest" | "oldest" | "activity" | "messages";

/**
 * The three the crash queue supports.
 *
 * **No `activity`, and that is the interesting absence.** The ticket queue's best ordering is
 * the computed `lastMessageAt`, and it exists because somebody may still be waiting on the
 * other end. A crash has no messages: the app writes `OPEN` and never touches the column
 * again. Its activity ordering is `createdAt`, which `newest` already is — so offering
 * `activity` here would be a control that looks like it does something.
 *
 * **`build` is the one that earns the list.** `crashReportListInput.sort` groups a release's
 * crashes together, which is the question an operator asks when deciding whether the fix landed.
 * A string `"13"` and a string `"9"` do not compare the way anybody expects, so the service
 * orders by `created_at` *within* a build rather than by the build itself — see
 * `services/crash-report.ts`.
 */
export type CrashSort = "newest" | "oldest" | "build";

export type SortOption<T extends string> = { value: T; label: string };

/**
 * Spanish, because the console has always been Spanish and an operator switching language
 * mid-task is not the problem this file has.
 */
export const LIST_SORT_OPTIONS: readonly SortOption<AdminListSort>[] = [
  { value: "newest", label: "Más recientes" },
  { value: "name", label: "Nombre" },
  { value: "orders", label: "Órdenes" },
  { value: "revenue", label: "Volumen" },
];

/**
 * `activity` is the one worth naming in the label rather than hiding behind "recientes".
 *
 * `admin.supportTickets`'s own docblock calls it *"the queue's own ordering and the one an
 * operator wants by default in spirit"* — it sorts on the computed `lastMessageAt`, so it
 * puts the ticket somebody spoke on last at the top, which is the one that might still be
 * waiting. It cannot use an index, which is why `newest` is the schema default and this is
 * a choice rather than an accident of column order. A label that said "recientes" for both
 * would make them indistinguishable and hide the better option.
 */
export const TICKET_SORT_OPTIONS: readonly SortOption<TicketSort>[] = [
  { value: "activity", label: "Actividad reciente" },
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "messages", label: "Mensajes" },
];

/**
 * "Por build", named rather than hidden behind "recientes", for the ticket list's reason: two
 * options whose labels read the same hide the one that answers a different question.
 */
export const CRASH_SORT_OPTIONS: readonly SortOption<CrashSort>[] = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "build", label: "Por build" },
];

/**
 * Orderings that read naturally largest-first, and which therefore start descending.
 *
 * `name` and `oldest` are absent, and both absences are deliberate: an operator scanning a
 * name column wants A→Z, and "más antiguos" wants the earliest ticket at the top. Starting
 * those two at Z→A would make the control feel broken on first use, before anyone has
 * pressed it.
 */
const DESCENDING_BY_DEFAULT = new Set<string>([
  "newest",
  "orders",
  "revenue",
  "activity",
  "messages",
]);

export type SortState<T extends string> = {
  sort: T;
  direction: "asc" | "desc";
};

/**
 * What the sort state becomes when the operator picks `chosen`.
 *
 * Two rules, and the second is the one that is easy to get wrong:
 *
 * 1. **Re-picking the current column flips the direction.** Otherwise there is no way to
 *    reverse a sort short of a separate control that does nothing else, and a table sorted
 *    the wrong way round is a dead end.
 * 2. **Switching columns starts at that column's natural direction**, not at the previous
 *    column's. Carrying the direction across is what makes a control feel arbitrary:
 *    someone who sorted orders descending, then switched to name, and got Z→A names, has no
 *    way to tell whether that was the table or the tool.
 *
 * Toggling twice returns to where it started, so a mis-click is undoable rather than
 * something an operator has to reason backwards out of.
 */
export function nextSort<T extends string>(
  current: SortState<T>,
  chosen: T,
): SortState<T> {
  if (chosen === current.sort) {
    return {
      sort: chosen,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return {
    sort: chosen,
    direction: DESCENDING_BY_DEFAULT.has(chosen) ? "desc" : "asc",
  };
}

/** The same state with only its direction replaced — the separate flip control. */
export function flipDirection<T extends string>(
  current: SortState<T>,
): SortState<T> {
  return {
    sort: current.sort,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

/** The word on the flip button, so the icon is never the only signal. */
export function directionLabel(direction: "asc" | "desc"): string {
  return direction === "asc" ? "Ascendente" : "Descendente";
}