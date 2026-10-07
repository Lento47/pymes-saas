import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONSOLE_TABS,
  defaultTab,
  isConsoleTab,
  resolveConsoleTab,
} from "../pages/admin/console-tabs";

/**
 * The console's tab list, its route vocabulary, and the panels it has to fill.
 *
 * Making tabs addressable split one thing into three that can disagree. A tab in the list
 * with no panel renders a strip you can click and nothing beneath it. A panel with no list
 * entry is unreachable by URL forever, because `isConsoleTab` refuses it and rewrites the
 * address. Both typecheck; both look like nothing at all until somebody is mid-task.
 *
 * ## Why most of this imports rather than reads
 *
 * The first version of this file parsed `CONSOLE_TABS` out of `console.tsx` with a regex and
 * documented at length why that was acceptable. It was not, and the argument was really
 * "exporting it would put a test-only reason on the module's API" — which is answered by
 * moving the list into `console-tabs.ts`, where it is importable because it is genuinely a
 * unit worth having its own file, not because a test wants it. The panel list still has to be
 * read out of the page, because a panel is markup and there is nothing to import.
 */

const CONSOLE_PATH = join(
  import.meta.dirname,
  "..",
  "pages",
  "admin",
  "console.tsx",
);
const APP_PATH = join(import.meta.dirname, "..", "App.tsx");
const TABLE_MODULE_PATH = join(
  import.meta.dirname,
  "..",
  "components",
  "ui",
  "table.tsx",
);

const consoleSource = readFileSync(CONSOLE_PATH, "utf-8");
const appSource = readFileSync(APP_PATH, "utf-8");
const tableModuleSource = readFileSync(TABLE_MODULE_PATH, "utf-8");

const tabValues = CONSOLE_TABS.map((tab) => tab.value);
/**
 * The rendered panels, read out of the page.
 *
 * **The pattern changed when the tab strip became a sidebar.** These were
 * `<TabsContent value="…">` elements; they are now `<Panel when={tab === "…"}>`, because Radix
 * `Tabs` would have had to stay alive purely to own "which destination is selected" — a second
 * source of truth for something the sidebar already owns, and one no test reaches.
 *
 * The three assertions that use this list are unchanged, and they are the point of the file: a
 * tab with no panel, and a panel no tab names, are both invisible in review and both fatal in
 * use. Only the syntax they are extracted from moved.
 */
const panels = [...consoleSource.matchAll(/<Panel when=\{tab === "([^"]+)"\}/g)]
  .map((match) => match[1])
  .filter((value): value is string => value !== undefined);

/**
 * The console's data tables, read out of the page.
 *
 * Every panel that lists rows now renders Arc's `SortableDataTable` rather than shadcn's
 * `<Table>` primitives. That is a real migration and it is the kind that leaves no trace: the
 * old tags typecheck, build, render a perfectly respectable table and pass lint, so a partial
 * revert shows up as nothing at all except one panel being subtly less good than its six
 * neighbours.
 *
 * The two assertions below are the guard, and both are negative on purpose. Counting the tables
 * would need the number updated whenever a panel is added — a nuisance that trains the next
 * person to bump it without looking. Asking instead that the old primitives are *absent* is
 * stable, and it is the assertion that actually encodes the intent: there is one table
 * component in this console, and it is the one with sorting.
 *
 * This cannot pass by matching nothing in the way `panels` had to be guarded against — a regex
 * that stops matching makes both of these pass more loudly, not less, because an absent
 * `<Table` is exactly what they assert.
 */
/**
 * The primitive names `components/ui/table.tsx` actually exports, read from that file.
 *
 * Derived rather than hard-coded, and the reason is a near miss: a regex matching `<Table[A-Z]…`
 * also matches the console's own `<TablePager>` and `<TableSort>`, so a guard written that way
 * either false-positives on two legitimate local components or — worse, and what the first
 * version did — silently depends on what happens to follow those names in the source. Reading
 * the export list means a new shadcn primitive is picked up automatically and a local component
 * named `TableSomething` never trips it.
 */
const shadcnTablePrimitives = [
  ...tableModuleSource.matchAll(/export \{([\s\S]*?)\}/g),
]
  .flatMap((match) => (match[1] ?? "").split(","))
  .map((name) => name.trim())
  .filter((name) => name.startsWith("Table"));

/** Every shadcn primitive used as a JSX element in the console, in source order. */
const primitiveTables = shadcnTablePrimitives.flatMap((name) =>
  [...consoleSource.matchAll(new RegExp(`<${name}[\\s/>]`, "g"))].map(
    () => name,
  ),
);

describe("console tab registry", () => {
  it("parses the panels rather than matching nothing", () => {
    // Everything below compares two lists, and two empty lists are equal. If the panel
    // pattern ever stops matching — a reformat, a rename — this is what notices.
    expect(panels.length).toBe(CONSOLE_TABS.length);
  });

  it("gives every tab a panel", () => {
    const orphaned = tabValues.filter((value) => !panels.includes(value));

    expect(orphaned).toEqual([]);
  });

  it("has no panel that no tab names", () => {
    // The other direction, and the one that matters more: an unreachable panel is dead code
    // that looks alive, because `isConsoleTab` refuses its route and quietly redirects.
    const unreachable = panels.filter((value) => !tabValues.includes(value));

    expect(unreachable).toEqual([]);
  });

  it("has no duplicate tab values", () => {
    expect(new Set(tabValues).size).toBe(tabValues.length);
  });

  it("labels every tab", () => {
    // A `value` with an empty label would render a trigger that is focusable, clickable and
    // announces nothing.
    expect(CONSOLE_TABS.filter((tab) => tab.label.trim().length === 0)).toEqual(
      [],
    );
  });

  it("keeps every tab value lowercase and route-safe", () => {
    // These values go into a path segment. A space or an accent would need encoding that
    // nothing here does, and would produce a link that silently fails to match the route.
    const unsafe = tabValues.filter(
      (value) => !/^[a-z][a-z0-9-]*$/.test(value),
    );

    expect(unsafe).toEqual([]);
  });

  it("mounts both console routes", () => {
    // `/admin/console` alone would render with no `:tab`; `/admin/console/:tab` alone would
    // break every bookmark and the sidebar link. Both are needed, and both are one line.
    expect(appSource).toContain('<Route path="/admin/console"');
    expect(appSource).toContain('<Route path="/admin/console/:tab"');
  });

  it("renders no shadcn table primitives", () => {
    // Read from the module's export list, so the failure names the primitive that came back
    // rather than a regex fragment.
    expect(primitiveTables).toEqual([]);
  });

  it("imports no shadcn table primitives", () => {
    // The tag assertion above cannot catch a leftover import, which is how an unused primitive
    // survives a migration and then gets used again six months later by whoever adds a table.
    expect(consoleSource).not.toMatch(/from "@\/components\/ui\/table"/);
  });

  it("found the primitives it was looking for", () => {
    // Two empty lists compare equal, so the negative assertions above are only meaningful while
    // the derivation still produces something. `TableCaption` and `TableFooter` were never used
    // here; the other six are the set the migration had to remove.
    expect(shadcnTablePrimitives.sort()).toEqual([
      "Table",
      "TableBody",
      "TableCaption",
      "TableCell",
      "TableFooter",
      "TableHead",
      "TableHeader",
      "TableRow",
    ]);
  });

  it("keeps a non-sortable column on every actions column", () => {
    // `SortableDataTable` treats `sortable` as defaulting to **true**, and a column keyed on
    // something the row does not have — every "Acciones" column, and the `businessRoles`
    // array — then renders a header button that announces "Sorted by Acciones, ascending" and
    // reorders nothing. Two empty or wrong lists compare equal, so the count is asserted too.
    const actionColumns = [
      ...consoleSource.matchAll(/key: "(?:actions|businessRoles|imageUrl)"/g),
    ];
    const disabled = [
      ...consoleSource.matchAll(
        /key: "(?:actions|businessRoles|imageUrl)",\n\s+label: "[^"]+",\n\s+sortable: false,/g,
      ),
    ];

    expect(actionColumns.length).toBe(disabled.length);
  });
});

describe("isConsoleTab", () => {
  it("accepts a real tab", () => {
    expect(isConsoleTab("billing")).toBe(true);
  });

  it("rejects nothing, nothingness and a tab that does not exist", () => {
    expect(isConsoleTab(undefined)).toBe(false);
    expect(isConsoleTab("")).toBe(false);
    expect(isConsoleTab("invoicing")).toBe(false);
  });

  it("rejects a value that merely starts with a real tab", () => {
    // Without the `===` this would pass, and a URL like `/admin/console/billing-old` would
    // render the billing panel under a name the strip cannot switch back from.
    expect(isConsoleTab("billing-old")).toBe(false);
  });
});

describe("defaultTab", () => {
  it("opens on the queue when there is one", () => {
    expect(defaultTab(true)).toBe("approvals");
  });

  it("opens on the business list otherwise", () => {
    expect(defaultTab(false)).toBe("businesses");
  });
});

describe("resolveConsoleTab", () => {
  it("uses the tab the URL names, and leaves the address alone", () => {
    expect(
      resolveConsoleTab("support", { pending: 3, couriers: 1 }, true),
    ).toEqual({
      tab: "support",
      needsRedirect: false,
    });
  });

  it("waits rather than guessing while the queue is still loading", () => {
    // The regression this function exists for. Written inline as
    // `isConsoleTab(routeTab) ? routeTab : defaultTab(hasQueue)`, the fallback ran on the
    // first paint with `hasQueue` still false, opened the console on `businesses`, and wrote
    // it into the URL — so the queue-aware default could never fire, on a console whose own
    // docblock says the queue "is the tab the route opens on".
    expect(
      resolveConsoleTab(undefined, { pending: 0, couriers: 0 }, false),
    ).toEqual({
      tab: null,
      needsRedirect: false,
    });
  });

  it("still lands on a tab once the queue has been counted and found empty", () => {
    expect(
      resolveConsoleTab(undefined, { pending: 0, couriers: 0 }, true),
    ).toEqual({
      tab: "businesses",
      needsRedirect: true,
    });
  });

  it.each([
    ["pending businesses", { pending: 2, couriers: 0 }],
    ["pending couriers", { pending: 0, couriers: 4 }],
  ])("opens on the queue for %s", (_label, queue) => {
    expect(resolveConsoleTab(undefined, queue, true)).toEqual({
      tab: "approvals",
      needsRedirect: true,
    });
  });

  it("redirects a tab that has been renamed", () => {
    // A bookmark naming a tab that no longer exists should land somewhere useful rather
    // than render a page with nothing in it.
    expect(
      resolveConsoleTab("support-tickets", { pending: 0, couriers: 0 }, true),
    ).toEqual({
      tab: "businesses",
      needsRedirect: true,
    });
  });

  it("prefers a real tab over the queue, whatever the queue says", () => {
    // Otherwise arrowing to "Cobros" from the queue tab would bounce the operator back.
    expect(
      resolveConsoleTab("billing", { pending: 5, couriers: 5 }, true),
    ).toEqual({
      tab: "billing",
      needsRedirect: false,
    });
  });
});
