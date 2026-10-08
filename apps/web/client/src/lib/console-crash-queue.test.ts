import { readFileSync } from "node:fs";
import { join } from "node:path";

import { crashReportListInput } from "@pymeshub/shared";
import { describe, expect, it } from "vitest";
import { CRASH_SORT_OPTIONS } from "../pages/admin/console-sort";
import { CONSOLE_TABS } from "../pages/admin/console-tabs";

/**
 * The crash queue inside the support tab.
 *
 * `console-tabs.test.ts` already proves every tab in `CONSOLE_TABS` has a panel and every panel
 * has a tab. This asks the questions that file cannot: that the crash queue arrived as a
 * **second queue in one tab** rather than a thirteenth destination, and that the pieces an
 * operator needs to act are actually in the pane.
 *
 * ## Why "twelve tabs" is an assertion and not a comment
 *
 * The design argument is written out twice already — once in this file's neighbour and once in
 * `routers/support.ts:39-45`, which refuses a fifth capability name "because a fifth capability
 * name would not say anything the existing set does not". Both are arguments, and arguments do
 * not stop a thirteenth tab from being added at 6pm on a Friday by somebody who has read
 * neither. `CONSOLE_TABS.length` is the whole cost of the guard.
 *
 * ## Why most of this reads the source
 *
 * A panel is markup and there is nothing to import, so `console-tabs.test.ts` reads it out of
 * the page and this follows the convention rather than inventing a second one. Where something
 * *is* importable — `CONSOLE_TABS`, `CRASH_SORT_OPTIONS` — this imports it, for the reason that
 * file's own docblock gives: comparing the real thing against the real thing is a stronger and
 * simpler guard than a regex.
 */
const consoleSource = readFileSync(
  join(import.meta.dirname, "..", "pages", "admin", "console.tsx"),
  "utf-8",
);

const supportPanel = consoleSource.slice(
  consoleSource.indexOf('<Panel when={tab === "support"}>'),
);

/** The two halves, by the only thing about them that is unambiguous. */
const hasTicketQueue = consoleSource.includes("function TicketQueue()");
const hasCrashQueue = consoleSource.includes("function CrashQueue()");
const hasSwitcher = consoleSource.includes("function SupportTab()");

describe("the crash queue is a second queue, not a thirteenth tab", () => {
  it("the tab list is still twelve destinations", () => {
    // The claim the whole placement rests on. A `crashes` entry here would satisfy every other
    // test in `console-tabs.test.ts` and still be the wrong product.
    expect(CONSOLE_TABS).toHaveLength(12);
    expect(CONSOLE_TABS.map((tab) => tab.value)).not.toContain("crashes");
  });

  it("the support tab renders both queues and picks one", () => {
    expect(hasTicketQueue).toBe(true);
    expect(hasCrashQueue).toBe(true);
    expect(hasSwitcher).toBe(true);

    const supportTab = consoleSource.slice(
      consoleSource.indexOf("function SupportTab()"),
      consoleSource.indexOf("function SupportTab()") + 2000,
    );
    // One of them, not both stacked: two queues rendered at once on a 13-column-wide console
    // is not "grouping", it is two pages fighting for the fold.
    expect(supportTab).toContain('queue === "tickets" ? <TicketQueue /> : <CrashQueue />');
  });

  it("and the panel that hosts it is still the support panel", () => {
    expect(supportPanel).toContain("<SupportTab />");
  });
});

describe("the pane answers the question the queue exists for", () => {
  /** The `CrashThread` component, which is the pane. */
  const thread = consoleSource.slice(
    consoleSource.indexOf("function CrashThread("),
    consoleSource.indexOf("function CrashQueue()"),
  );

  it("the version and the build are in the pane, not a footnote", () => {
    // "Which version broke this" decides what you do next, and it is answerable from the
    // report whether or not anybody scrolls. A stack trace with no version beside it cannot be
    // matched to a release, and a crash that cannot be matched to a release does not get fixed.
    expect(thread).toContain("data.appVersion");
    expect(thread).toContain("data.buildNumber");
    // ...and both appear **before** the stack in the markup, so they are above the fold of a
    // pane whose whole content is a stack trace.
    expect(thread.indexOf("data.buildNumber")).toBeLessThan(thread.indexOf("data.stack"));
  });

  it("the stack is shown, not summarised", () => {
    expect(thread).toContain("data.stack");
    expect(thread).toContain("data.context");
    expect(thread).toContain("data.route");
  });

  it("a missing reporter and a missing shop are drawn as facts, not as blanks", () => {
    // `crash_report.user_id` is `SET NULL` and `business_id` carries no foreign key at all, so
    // a crash routinely outlives both. An empty cell would read as a half-loaded row and an
    // operator would distrust the whole queue.
    expect(thread).toContain('data.userName ?? "Sin cuenta"');
    expect(thread).toContain('data.businessName ?? "Sin comercio"');
  });

  it("closing asks for a note, and the button refuses without one", () => {
    // There is no thread on `crash_report`, so the note and the audit entry are the only two
    // places the reasoning can live. A resolution nobody wrote is a crash that closed itself.
    expect(thread).toContain("note.trim().length === 0");
    expect(thread).toContain("disabled={note.trim().length === 0");
    // ...and the note is *sent*, trimmed, rather than the console deciding it needed one. The
    // first draft of this test asserted `status: input.status` — which is the service's line,
    // not the console's. What the console owes is that the operator's words reach the mutation.
    expect(thread).toContain(
      "adminApi.resolveCrash({ id: reportId, status, note: note.trim() })",
    );
    // The one input the console must not offer: a crash nobody may resolve but an operator.
    expect(thread).not.toContain('setClosing("OPEN")');
  });

  it("a terminal crash cannot be closed again", () => {
    // `terminal` gates the two buttons off, so a second close cannot overwrite the first note —
    // and the pane says where that note went instead.
    expect(thread).toContain(
      'const terminal = data.status === "RESOLVED" || data.status === "CLOSED"',
    );
    expect(thread).toContain("{terminal ? (");
    expect(thread).toContain("quedó en la auditoría");
  });
});

describe("the sort vocabulary is the contract's, not the console's", () => {
  it("offers exactly what `crashReportListInput` accepts", () => {
    // A control offering a sort the service does not implement looks like it worked, and an
    // operator would trust an ordering that never happened — `console-sort.ts`'s own note on
    // the audit log says a missing feature is recoverable and a lying control is not.
    const accepted = crashReportListInput.shape.sort.unwrap().options;
    expect(CRASH_SORT_OPTIONS.map((option) => option.value).sort()).toEqual(
      [...accepted].sort(),
    );
  });

  it("has no `activity`, because a crash has nothing to be active on", () => {
    // The ticket queue's best ordering is the computed `lastMessageAt`, and it earns its place
    // because somebody may still be waiting on the other end. A crash has no messages: the app
    // writes `OPEN` and never touches the column again.
    expect(CRASH_SORT_OPTIONS.map((option) => option.value)).not.toContain("activity");
    expect(CRASH_SORT_OPTIONS.map((option) => option.value)).toContain("build");
  });

  it("no direction button, because `oldest` already says the other way", () => {
    // The ticket queue's own comment gives this reasoning; a flip control here would promise an
    // ordering the service cannot produce.
    const queue = consoleSource.slice(
      consoleSource.indexOf("function CrashQueue()"),
      consoleSource.indexOf("function SupportTab()"),
    );
    expect(queue).toContain("showDirection={false}");
  });
});

describe("the client reads a router the ticket queue does not", () => {
  it("and the reason is written down where somebody would want to change it", () => {
    const adminApi = readFileSync(
      join(import.meta.dirname, "..", "lib", "admin.ts"),
      "utf-8",
    );
    // `trpc.crashReport.*`, not `trpc.admin.*`. Every other call in that file is the latter and
    // this one being different is the kind of thing a later reader "tidies up" without knowing.
    expect(adminApi).toContain("trpc.crashReport.list.query");
    expect(adminApi).toContain("trpc.crashReport.get.query");
    expect(adminApi).toContain("trpc.crashReport.resolve.mutate");
    expect(adminApi).toContain("protectedProcedure");
  });
});