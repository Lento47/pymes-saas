import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The console's tabs are a route, a strip and a set of panels, and they have to agree.
 *
 * They used to be one thing — ten `TabsTrigger`s in the JSX — and moving them to
 * `/admin/console/:tab` split them into three that can disagree. A tab in the registry with
 * no panel renders a strip you can click and nothing beneath it. A panel with no registry
 * entry is unreachable by URL forever, because `isConsoleTab` rejects it and rewrites the
 * address. Both typecheck; both look like nothing at all until somebody is mid-task.
 *
 * So the three lists are compared rather than trusted.
 *
 * ## Why the registry is parsed out of the file
 *
 * `CONSOLE_TABS` is not exported, and exporting it purely so a test can import it would put
 * a test-only reason on a module-level export. Reading the source is also the only check
 * that would notice the *ordering* or the labels, which are two more things a person has to
 * mean. The parse is deliberately narrow — the array literal and one fixed shape per entry —
 * so a reformat that changes the source fails loudly here instead of silently matching
 * nothing, which is what `test("has tabs to check")` is guarding against.
 */

const CONSOLE_PATH = join(
  import.meta.dirname,
  "..",
  "pages",
  "admin",
  "console.tsx",
);
const APP_PATH = join(import.meta.dirname, "..", "App.tsx");

const source = readFileSync(CONSOLE_PATH, "utf-8");
const appSource = readFileSync(APP_PATH, "utf-8");

/** The `CONSOLE_TABS` array literal, and nothing after it. */
const registryBlock = source.match(
  /const CONSOLE_TABS = \[([\s\S]*?)\] as const;/,
)?.[1];

const entries = [...(registryBlock ?? "").matchAll(
  /\{\s*value:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*\}/g,
)].map(([, value, label]) => ({ value, label }));

const registryValues = entries.map((entry) => entry.value);
const panels = [...source.matchAll(/<TabsContent value="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value): value is string => value !== undefined);

describe("console tab registry", () => {
  it("parses the registry rather than matching nothing", () => {
    // Every other assertion here is a comparison between two lists, and two empty lists are
    // equal. If the parse ever stops matching — a reformat, a rename — this is what notices.
    expect(registryBlock).toBeDefined();
    expect(entries.length).toBe(10);
  });

  it("gives every tab a panel", () => {
    const orphaned = registryValues.filter((value) => !panels.includes(value));

    expect(orphaned).toEqual([]);
  });

  it("has no panel that no tab names", () => {
    // The other direction, and the one that matters more: an unreachable panel is dead code
    // that looks alive, because `isConsoleTab` refuses its route and quietly redirects.
    const unreachable = panels.filter((value) => !registryValues.includes(value));

    expect(unreachable).toEqual([]);
  });

  it("has no duplicate tab values", () => {
    const seen = new Set<string>();
    const duplicates = registryValues.filter((value) =>
      seen.has(value) ? true : (seen.add(value), false),
    );

    expect(duplicates).toEqual([]);
  });

  it("labels every tab", () => {
    // A `value` with an empty label would render a trigger that is focusable, clickable and
    // announces nothing.
    expect(entries.filter((entry) => entry.label.trim().length === 0)).toEqual([]);
  });

  it("is mounted as a route, both bare and with a tab", () => {
    // `/admin/console` alone would render with no `:tab`, which the component rewrites to
    // the default; `/admin/console/:tab` alone would break every bookmark and the sidebar
    // link. Both are needed, and both are one line each — which is exactly the kind of thing
    // that goes missing in a refactor.
    expect(appSource).toContain('<Route path="/admin/console"');
    expect(appSource).toContain('<Route path="/admin/console/:tab"');
  });

  it("keeps every tab value lowercase and route-safe", () => {
    // These values go into a path segment. A space or an accent would need encoding that
    // nothing here does, and would produce a link that silently fails to match the route.
    const unsafe = registryValues.filter((value) => !/^[a-z][a-z0-9-]*$/.test(value));

    expect(unsafe).toEqual([]);
  });
});
