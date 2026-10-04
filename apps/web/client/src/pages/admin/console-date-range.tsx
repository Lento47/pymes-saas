import { useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * The date range a table is filtered to.
 *
 * ## A capability that has been on the server since it was written
 *
 * `adminListInput` has carried `from` and `to` since the beginning — `gte(createdAt, from)`
 * and `lte(createdAt, to)` in four different queries — and **no tab ever sent either**. An
 * operator who wanted "which shops joined this month" or "what did we touch in March" had no
 * way to ask, on four of the six paged tables, with the query already written and the index
 * already usable.
 *
 * So this is not a new feature so much as a control that was missing over an existing one.
 *
 * ## Why two plain date inputs and not a range picker
 *
 * Two `<input type="date">` fields are keyboard-operable, screen-reader-announced, need no
 * popover, and work on every platform's own date UI. A range picker is the better answer on
 * a desktop with a mouse and the worse answer on the two inputs an operator actually wants to
 * type into: an exact day, and a month boundary. It would also be a fourth visual language
 * next to the shadcn `Sheet`s and the console's own controls.
 *
 * ## The end-of-day bug, and why the label says what it filters
 *
 * `<input type="date">` gives `YYYY-MM-DD`, and `new Date("2026-10-04")` is **UTC midnight**.
 * In Costa Rica that is the *previous* evening, so a range ending on the 4th would silently
 * exclude the whole 4th unless the end is pushed to the end of that day.
 *
 * Hence `endOfDay`: the end bound is the last millisecond of the chosen day, not its first.
 * That is the single most common way a date filter quietly lies, and it is why the two
 * tables whose date column is not `createdAt` say so in their label — *Órdenes* filters on
 * `placedAt`, everything else on `createdAt`, and a control that does not name its column
 * cannot be trusted to name the right one.
 */
function endOfDay(iso: string): Date | undefined {
  return iso ? new Date(`${iso}T23:59:59.999Z`) : undefined;
}

/** The start of the chosen day, in UTC, so the two ends agree about what a day is. */
function startOfDay(iso: string): Date | undefined {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : undefined;
}

export function useDateRange() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return {
    from,
    to,
    /** The wire shape: ISO dates, or `undefined` for an untouched bound. */
    range: { from: startOfDay(from), to: endOfDay(to) },
    isActive: from !== "" || to !== "",
    setFrom,
    setTo,
    clear: () => {
      setFrom("");
      setTo("");
    },
  };
}

export type DateRange = ReturnType<typeof useDateRange>;

export function DateRangeFilter({
  range,
  onChange,
  /** Names the column being filtered, so the control cannot be read as "the other date". */
  column,
}: {
  range: DateRange;
  /** Called after the input changes, so the caller can reset its page. */
  onChange: () => void;
  column: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <label htmlFor={`from-${column}`} className="text-xs text-muted-foreground">
          {column} desde
        </label>
        <Input
          id={`from-${column}`}
          type="date"
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => {
            range.setFrom(e.target.value);
            onChange();
          }}
          className="mt-1 h-8 w-36 text-xs"
        />
      </div>
      <div>
        <label htmlFor={`to-${column}`} className="text-xs text-muted-foreground">
          hasta
        </label>
        <Input
          id={`to-${column}`}
          type="date"
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => {
            range.setTo(e.target.value);
            onChange();
          }}
          className="mt-1 h-8 w-36 text-xs"
        />
      </div>
      {range.isActive ? (
        <button
          type="button"
          onClick={() => {
            range.clear();
            onChange();
          }}
          className="h-8 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Quitar fechas
        </button>
      ) : null}
    </div>
  );
}