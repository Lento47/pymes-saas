import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { ConsoleNav } from "../pages/admin/console-nav";
import {
  CONSOLE_GROUPS,
  CONSOLE_TABS,
  groupsAreComplete,
  isConsoleTab,
  tabsInGroup,
} from "../pages/admin/console-tabs";

/**
 * The sidebar, which replaced a horizontal strip of eleven equally-weighted tabs.
 *
 * ## Why the grouping needs its own tests
 *
 * A hand-written sidebar is a **second list of routes** that has to agree with
 * `CONSOLE_TABS`, and the failure is invisible in review: the tab exists, the route validates,
 * and the destination is simply unreachable from the navigation. The tests below are mostly
 * about the registry rather than the markup, because the registry is where that goes wrong.
 *
 * The rendering tests exist for the thing a registry test cannot see — that every entry is a
 * real link, that the badge carries the number it was given, and that nothing renders an empty
 * group heading.
 */
describe("console groups", () => {
  it("gives every tab a group the sidebar actually draws", () => {
    // Without this, a typo in `group` typechecks fine — the field is inferred from the same
    // union — and the tab is silently absent from the navigation with nothing to say so.
    expect(groupsAreComplete()).toEqual([]);
  });

  it("puts every tab in exactly one group, and loses none", () => {
    const collected = CONSOLE_GROUPS.flatMap((group) => tabsInGroup(group.value));
    expect([...collected].sort()).toEqual([...CONSOLE_TABS.map((t) => t.value)].sort());
  });

  it("never leaves a group empty", () => {
    // An empty group renders a heading over nothing, which reads as a broken sidebar rather
    // than as "there is nothing here yet".
    for (const group of CONSOLE_GROUPS) {
      expect(tabsInGroup(group.value).length).toBeGreaterThan(0);
    }
  });

  it("keeps Overview in General, alone", () => {
    // Overview is a summary of the platform, and mixing it into "Operaciones" would imply it
    // is a queue you work through rather than a page you read.
    expect(tabsInGroup("general")).toEqual(["overview"]);
  });

  it("puts the two queues where an operator looks for them", () => {
    expect(tabsInGroup("operations")).toEqual(["approvals", "orders", "billing", "support"]);
  });

  it("recognises the new route and still rejects nonsense", () => {
    expect(isConsoleTab("overview")).toBe(true);
    expect(isConsoleTab("overviews")).toBe(false);
    expect(isConsoleTab(undefined)).toBe(false);
  });
});

/**
 * `ConsoleNav` under the provider it requires.
 *
 * shadcn's `<Sidebar>` reads `SidebarContext`, and `useSidebar` throws outside a
 * `SidebarProvider` — so the wrapper is not ceremony, it is the component's contract. The first
 * version of this file rendered the nav bare and failed with a null-context error, which looked
 * like the nested-React problem this suite had just been unblocked from and was not: it was the
 * sidebar correctly refusing to render outside its provider.
 */
function renderNav(pending: number) {
  return render(
    <SidebarProvider>
      <ConsoleNav pending={pending} />
    </SidebarProvider>,
  );
}

describe("ConsoleNav", () => {
  it("renders every tab as a link to its route", () => {
    renderNav(3);

    for (const tab of CONSOLE_TABS) {
      const link = screen.getByRole("link", { name: new RegExp(tab.label, "i") });
      expect(link.getAttribute("href")).toBe(`/admin/console/${tab.value}`);
    }
  });

  it("renders one link per tab and nothing more", () => {
    // Catches a hand-written entry that duplicates a registry row — the two-lists problem in
    // its smallest form, and the reason this list is generated rather than written.
    renderNav(0);
    expect(screen.getAllByRole("link")).toHaveLength(CONSOLE_TABS.length);
  });

  it("shows the pending count on Aprobaciones", () => {
    renderNav(7);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("shows no badge at all when nothing is pending", () => {
    // A "0" badge is noise: it occupies the slot that is empty on every other row and tells an
    // operator nothing they cannot already see from the absence of a number.
    const { container } = renderNav(0);
    expect(container.textContent).not.toContain("0");
  });

  it("draws every group heading", () => {
    renderNav(0);
    for (const group of CONSOLE_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
    }
  });
});
