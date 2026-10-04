import { describe, expect, it } from "vitest";

import {
  directionLabel,
  flipDirection,
  LIST_SORT_OPTIONS,
  nextSort,
  type SortState,
  TICKET_SORT_OPTIONS,
} from "@/pages/admin/console-sort";

/**
 * The console's sort rules, asserted without mounting the console.
 *
 * Pure functions in their own module for exactly this reason — same split as
 * `console-tabs.ts`, and the same reason that file documents: a test that has to mount a
 * router, a query client and a dozen tabs to learn which way a list sorts is a test nobody
 * will add.
 *
 * These assertions exist because the rules are the kind that look obvious and are not. The
 * one that matters most is **switching columns resets the direction**: carrying it across is
 * the defect that makes a sort control feel arbitrary, and it is invisible until an operator
 * has already lost their place.
 */

const NEWEST_FIRST: SortState<"newest"> = { sort: "newest", direction: "desc" };

describe("LIST_SORT_OPTIONS", () => {
  it("offers exactly the four orderings adminListInput accepts", () => {
    // A fifth option here would be refused by the schema at the wire, and the console would
    // render a control that fails on click.
    expect(LIST_SORT_OPTIONS.map((option) => option.value)).toEqual([
      "newest",
      "name",
      "orders",
      "revenue",
    ]);
  });

  it("labels every option", () => {
    // A `SelectItem` with no children renders blank, and a blank row in a dropdown is
    // indistinguishable from a broken one.
    for (const option of LIST_SORT_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("TICKET_SORT_OPTIONS", () => {
  it("offers exactly the four the support queue accepts", () => {
    expect(TICKET_SORT_OPTIONS.map((option) => option.value)).toEqual([
      "activity",
      "newest",
      "oldest",
      "messages",
    ]);
  });

  it("distinguishes activity from newest in the label", () => {
    // Both order by a date. If they were both called "recientes" the better one — the one
    // the service's own docblock says an operator wants — would be unselectable by name.
    const activity = TICKET_SORT_OPTIONS.find((o) => o.value === "activity");
    const newest = TICKET_SORT_OPTIONS.find((o) => o.value === "newest");
    expect(activity?.label).not.toBe(newest?.label);
  });
});

describe("nextSort", () => {
  it("starts a freshly chosen column in its natural direction", () => {
    // Largest-first for aggregates, A→Z for names: the two directions an operator expects
    // without being told.
    expect(nextSort(NEWEST_FIRST, "orders").direction).toBe("desc");
    expect(nextSort(NEWEST_FIRST, "revenue").direction).toBe("desc");
    expect(nextSort(NEWEST_FIRST, "name").direction).toBe("asc");
  });

  it("resets the direction when the column changes", () => {
    // The rule worth a file. Sorted orders descending, switched to name, and got Z→A names
    // with no way to tell whether the table or the tool did it.
    const current: SortState<"newest" | "name"> = { sort: "newest", direction: "desc" };
    expect(nextSort(current, "name")).toEqual({ sort: "name", direction: "asc" });
  });

  it("flips when the current column is re-picked", () => {
    expect(nextSort(NEWEST_FIRST, "newest")).toEqual({
      sort: "newest",
      direction: "asc",
    });
  });

  it("returns to where it started after two presses", () => {
    // A mis-click has to be undoable, not something to reason backwards out of.
    const once = nextSort(NEWEST_FIRST, "newest");
    expect(nextSort(once, "newest")).toEqual(NEWEST_FIRST);
  });

  it("starts 'oldest' ascending", () => {
    // It means the opposite of 'newest', so it must not also start descending — that would
    // be newest-first under a name that says otherwise.
    const current: SortState<"newest" | "oldest"> = {
      sort: "newest",
      direction: "desc",
    };
    expect(nextSort(current, "oldest")).toEqual({
      sort: "oldest",
      direction: "asc",
    });
  });

  it("keeps the previous direction when the same column is pressed, whatever it was", () => {
    const ascending: SortState<"name"> = { sort: "name", direction: "asc" };
    expect(nextSort(ascending, "name")).toEqual({
      sort: "name",
      direction: "desc",
    });
  });
});

describe("flipDirection", () => {
  it("reverses without touching the column", () => {
    expect(flipDirection({ sort: "orders", direction: "desc" })).toEqual({
      sort: "orders",
      direction: "asc",
    });
    expect(flipDirection({ sort: "orders", direction: "asc" })).toEqual({
      sort: "orders",
      direction: "desc",
    });
  });
});

describe("directionLabel", () => {
  it("names both directions", () => {
    // The icon is never the only signal; this is the text that carries it.
    expect(directionLabel("asc")).toBe("Ascendente");
    expect(directionLabel("desc")).toBe("Descendente");
  });
});