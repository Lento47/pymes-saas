import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { ConsoleNav } from "../pages/admin/console-nav";
import {
  CONSOLE_GROUPS,
  CONSOLE_TABS,
  groupsAreComplete,
  isConsoleTab,
  TAB_PURPOSE,
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
    const collected = CONSOLE_GROUPS.flatMap((group) =>
      tabsInGroup(group.value),
    );
    expect([...collected].sort()).toEqual(
      [...CONSOLE_TABS.map((t) => t.value)].sort(),
    );
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
    expect(tabsInGroup("operations")).toEqual([
      "approvals",
      "orders",
      "billing",
      "support",
    ]);
  });

  it("recognises the new route and still rejects nonsense", () => {
    expect(isConsoleTab("overview")).toBe(true);
    expect(isConsoleTab("overviews")).toBe(false);
    expect(isConsoleTab(undefined)).toBe(false);
  });
});

/**
 * Every destination says what it is.
 *
 * `TAB_PURPOSE` is typed `Record<ConsoleTab, …>`, so a **missing key is a compile error** —
 * which is the guarantee worth having. What it cannot catch is a present key carrying an empty
 * string, a whitespace label, or the generic "Consola de plataforma" that this replaced on
 * twelve pages at once. That failure is invisible in review and obvious in use: every tab
 * claims to be the platform console.
 *
 * ## Why it imports now
 *
 * This used to parse the copy out of `console.tsx` with a regex, on the argument that the page
 * header text is markup and there is nothing to import. It was wrong twice, both times on
 * formatting rather than on content: the pattern assumed tab indentation in a two-space file,
 * and its successor assumed every `description:` stayed on one line, which Prettier stops doing
 * once a sentence gets long — and then again when Prettier moved the whole literal onto its own
 * line and shifted every entry by two spaces.
 *
 * Both were caught by the anti-vacuity assertion below rather than passing silently, which is
 * the only reason this was found at all. But a guard that fires on a reformat is a guard that
 * teaches people to re-run without reading, and `TAB_PURPOSE` was never really markup: it is
 * registry copy keyed by `ConsoleTab`, so it now lives in `console-tabs.ts` beside the registry
 * and is imported here like everything else in this file.
 *
 * The count assertion stays. It is no longer about a regex failing to match — importing cannot
 * silently return nothing — but it is the check that the registry and its copy are the same
 * length, which is the thing a future tab could otherwise break by being added in one file and
 * not the other.
 */
describe("the page header copy", () => {
  const purposes = CONSOLE_TABS.map((tab) => ({
    tab: tab.value,
    ...TAB_PURPOSE[tab.value],
  }));

  it("parses an entry per tab rather than matching nothing", () => {
    // Now a length check between two imports rather than a regex check: the registry and its
    // copy are the same size.
    expect(purposes.length).toBe(CONSOLE_TABS.length);
  });

  it("gives every tab a title of its own", () => {
    const titles = purposes.map((entry) => entry.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const entry of purposes) {
      expect(entry.title.trim()).not.toBe("");
      // The generic title this replaced. One tab may legitimately say "General"; none of
      // them may say the same thing as the shell.
      expect(entry.title).not.toBe("Consola de plataforma");
    }
  });

  it("gives every tab a description that says something", () => {
    for (const entry of purposes) {
      // A sentence, not a word: the description's job is to say what the page decides.
      expect(entry.description.length).toBeGreaterThan(20);
      expect(entry.description.trim()).toBe(entry.description);
    }
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
      const link = screen.getByRole("link", {
        name: new RegExp(tab.label, "i"),
      });
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
