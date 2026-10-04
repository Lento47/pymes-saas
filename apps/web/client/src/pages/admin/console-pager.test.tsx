import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TablePager } from "@/pages/admin/console-pager";

/**
 * The pager, rendered.
 *
 * `console-pagination.test.ts` proves the arithmetic. This proves the control draws it
 * honestly, and pins the one claim in `console-pager.tsx` that would otherwise be only a
 * comment: **the page buttons are `<button>`, not `<a>`**.
 *
 * That claim is not pedantry. The shadcn `PaginationLink` renders an anchor, and this
 * console has no URL for a page of a table — the offset is component state, and `AGENTS.md`
 * forbids `#` fragments in routes, so there is nothing to point an anchor at. An `<a>` with
 * no `href` is not focusable and is not announced as a control: the pager would look perfect
 * on screen, be unreachable by keyboard, and be invisible to a screen reader. Asserting
 * `tagName` is the only way that stays true after the next person "simplifies" it back to
 * `PaginationLink`.
 */
function renderPager(overrides: Partial<Parameters<typeof TablePager>[0]> = {}) {
  return render(
    <TablePager
      offset={0}
      total={312}
      pageSize={25}
      atFirstPage
      atLastPage={false}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      label="negocios"
      {...overrides}
    />,
  );
}

describe("TablePager", () => {
  it("renders real buttons, not anchors", () => {
    renderPager();

    const anterior = screen.getByRole("button", { name: /anterior/i });
    const siguiente = screen.getByRole("button", { name: /siguiente/i });

    // The whole point of not using `PaginationLink`.
    expect(anterior.tagName).toBe("BUTTON");
    expect(siguiente.tagName).toBe("BUTTON");
  });

  it("offers no page numbers, because the cursor is an offset", () => {
    renderPager();

    // A row range is a fact about the screen; a page number is a promise the API
    // disclaims, since a business adding an order mid-scroll shifts every later row.
    expect(screen.queryByRole("button", { name: /^2$/ })).toBeNull();
    expect(screen.getByText("mostrando 1–25 de 312")).toBeTruthy();
  });

  it("announces the range politely, because it changes without a navigation", () => {
    renderPager();

    const range = screen.getByText("mostrando 1–25 de 312");
    expect(range.getAttribute("aria-live")).toBe("polite");
    expect(range.getAttribute("aria-atomic")).toBe("true");
  });

  it("names what is being paged, in the navigation's accessible name", () => {
    renderPager();

    expect(screen.getByRole("navigation", { name: "Paginación de negocios" })).toBeTruthy();
  });

  it("disables previous on the first page and next on the last", () => {
    const first = renderPager({ offset: 0, atFirstPage: true, atLastPage: false });
    expect(screen.getByRole("button", { name: /anterior/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /siguiente/i }).hasAttribute("disabled")).toBe(false);
    first.unmount();

    renderPager({ offset: 275, atFirstPage: false, atLastPage: true });
    expect(screen.getByRole("button", { name: /siguiente/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /anterior/i }).hasAttribute("disabled")).toBe(false);
  });

  it("calls through", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    // Middle of the list, so neither button is disabled. The previous case proved a
    // disabled button does not fire, which is the other half of this.
    renderPager({ offset: 25, atFirstPage: false, atLastPage: false, onNext, onPrevious });

    screen.getByRole("button", { name: /siguiente/i }).click();
    screen.getByRole("button", { name: /anterior/i }).click();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("does not call through from a disabled end", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    renderPager({ offset: 0, atFirstPage: true, atLastPage: false, onNext, onPrevious });

    screen.getByRole("button", { name: /anterior/i }).click();

    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("renders nothing when there is nothing to page", () => {
    // A control offering "siguiente" on a table of four rows tells the operator something
    // false about their own screen.
    const empty = renderPager({ total: 0 });
    expect(screen.queryByRole("navigation")).toBeNull();
    empty.unmount();

    renderPager({ total: 18, atLastPage: true });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("clamps the end of a short last page", () => {
    // The arithmetic is tested in `console-pagination.test.ts`; this pins that the control
    // actually shows the clamped string, so the two cannot drift apart.
    renderPager({ offset: 25, total: 30, atFirstPage: false, atLastPage: true });

    expect(screen.getByText("mostrando 26–30 de 30")).toBeTruthy();
  });
});