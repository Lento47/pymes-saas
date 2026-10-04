import { describe, expect, it } from "vitest";

import {
  ADMIN_PAGE_SIZE,
  isLastPage,
  nextOffset,
  pageCount,
  prevOffset,
  windowLabel,
} from "@/pages/admin/console-pagination";

/**
 * The console's paging arithmetic, asserted without mounting the console.
 *
 * Pure functions in their own module for the reason `console-tabs.ts` has one — a test that
 * has to mount a router and a query client to learn where the end of a list is, is a test
 * nobody writes.
 *
 * The assertions that matter are the **clamps**. Paging arithmetic is the kind of thing that
 * looks correct in review and then renders "mostrando 26–50 de 30", and the only way to know
 * is to write the awkward cases down first.
 */

describe("ADMIN_PAGE_SIZE", () => {
  it("is what the tables already showed", () => {
    // `adminListInput.limit` defaults to 25 and the console never overrode it, so this is a
    // statement of "nothing changes but the pager" rather than a preference.
    expect(ADMIN_PAGE_SIZE).toBe(25);
  });
});

describe("pageCount", () => {
  it("counts pages", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
    expect(pageCount(312)).toBe(13);
  });

  it("never returns zero, because an empty list still has a first page", () => {
    // A pager that renders "0 de 0" has to be special-cased by every caller that draws it.
    expect(pageCount(0)).toBeGreaterThan(0);
  });

  it("treats a negative total as empty", () => {
    // Defensive, and it is why this is not `Math.ceil` on the raw value.
    expect(pageCount(-5)).toBe(1);
  });
});

describe("windowLabel", () => {
  it("describes a full first page", () => {
    expect(windowLabel(0, 312)).toBe("mostrando 1–25 de 312");
  });

  it("clamps the end of a short last page", () => {
    // The case in the file's docblock. Without the clamp this reads "26–50 de 30".
    expect(windowLabel(25, 30)).toBe("mostrando 26–30 de 30");
  });

  it("clamps the start when the list has shrunk under the offset", () => {
    // An operator on page two, a filter narrows the list to 5, and the offset is now past
    // the end. `offset + 1` alone would claim to start at row 51 of 5.
    expect(windowLabel(50, 5)).toBe("mostrando 5–5 de 5");
  });

  it("says so plainly when there is nothing", () => {
    expect(windowLabel(0, 0)).toBe("sin resultados");
  });

  it("honours an explicit page size", () => {
    expect(windowLabel(50, 312, 50)).toBe("mostrando 51–100 de 312");
  });
});

describe("nextOffset", () => {
  it("steps one page forward", () => {
    expect(nextOffset(0)).toBe(25);
    expect(nextOffset(25)).toBe(50);
  });

  it("is not clamped — that is atLastPage's job", () => {
    // Kept separate on purpose: clamping here would need `total`, and a function that needs
    // the total to advance is a function that cannot be reasoned about from its inputs.
    expect(nextOffset(1_000, 25)).toBe(1_025);
  });
});

describe("prevOffset", () => {
  it("steps one page back", () => {
    expect(prevOffset(50)).toBe(25);
  });

  it("is a no-op on the first page rather than an error", () => {
    expect(prevOffset(0)).toBe(0);
    expect(prevOffset(10)).toBe(0);
  });
});

describe("isLastPage", () => {
  it("is true once the window covers everything left", () => {
    expect(isLastPage(0, 25)).toBe(true);
    expect(isLastPage(0, 26)).toBe(false);
    expect(isLastPage(25, 30)).toBe(true);
    expect(isLastPage(25, 312)).toBe(false);
  });

  it("is true on an empty list, so nothing looks pageable", () => {
    expect(isLastPage(0, 0)).toBe(true);
  });
});