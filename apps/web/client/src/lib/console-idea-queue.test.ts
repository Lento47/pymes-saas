import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ideaListInput } from "@pymeshub/shared";
import { describe, expect, it } from "vitest";
import { CONSOLE_TABS } from "../pages/admin/console-tabs";
import { IDEA_SORT_OPTIONS } from "../pages/admin/console-sort";

/**
 * The ideas queue inside the support tab.
 *
 * Same placement argument as crashes: a thirteenth tab is the wrong product, and
 * `CONSOLE_TABS.length` is the whole cost of the guard.
 */
const consoleSource = readFileSync(
  join(import.meta.dirname, "..", "pages", "admin", "console.tsx"),
  "utf-8",
);

const supportPanel = consoleSource.slice(
  consoleSource.indexOf('<Panel when={tab === "support"}>'),
);

const hasIdeaQueue = consoleSource.includes("function IdeaQueue()");
const hasSwitcher = consoleSource.includes("function SupportTab()");

describe("the ideas queue is a third queue, not a thirteenth tab", () => {
  it("the tab list is still twelve destinations", () => {
    expect(CONSOLE_TABS).toHaveLength(12);
    expect(CONSOLE_TABS.map((tab) => tab.value)).not.toContain("ideas");
  });

  it("the support tab renders three queues and picks one", () => {
    expect(consoleSource.includes("function TicketQueue()")).toBe(true);
    expect(consoleSource.includes("function CrashQueue()")).toBe(true);
    expect(hasIdeaQueue).toBe(true);
    expect(hasSwitcher).toBe(true);

    const supportTab = consoleSource.slice(
      consoleSource.indexOf("function SupportTab()"),
      consoleSource.indexOf("function SupportTab()") + 2500,
    );
    expect(supportTab).toContain(
      'queue === "tickets" ? <TicketQueue /> : queue === "crashes" ? <CrashQueue /> : <IdeaQueue />',
    );
    expect(supportTab).toContain('{ value: "ideas", label: "Ideas" }');
  });

  it("and the panel that hosts it is still the support panel", () => {
    expect(supportPanel).toContain("<SupportTab />");
  });
});

describe("the pane answers the question the queue exists for", () => {
  const thread = consoleSource.slice(
    consoleSource.indexOf("function IdeaThread("),
    consoleSource.indexOf("function IdeaQueue()"),
  );

  it("the subject and body are in the pane", () => {
    expect(thread).toContain("data.subject");
    expect(thread).toContain("data.body");
    expect(thread).toContain("data.roleAtSubmit");
  });

  it("a missing reporter and a missing shop are drawn as facts, not as blanks", () => {
    expect(thread).toContain('data.userName ?? "Sin cuenta"');
    expect(thread).toContain('data.businessName ?? "Sin comercio"');
  });

  it("closing asks for a note, and the button refuses without one", () => {
    expect(thread).toContain("note.trim().length === 0");
    expect(thread).toContain("disabled={note.trim().length === 0");
    expect(thread).toContain(
      'adminApi.resolveIdea({ id: ideaId, status: "CLOSED", note: note.trim() })',
    );
    expect(thread).not.toContain('setClosing("OPEN")');
  });

  it("a closed idea cannot be closed again", () => {
    expect(thread).toContain('const terminal = data.status === "CLOSED"');
    expect(thread).toContain("{terminal ? (");
    expect(thread).toContain("quedó en la auditoría");
  });
});

describe("the sort vocabulary is the contract's, not the console's", () => {
  it("offers exactly what `ideaListInput` accepts", () => {
    const accepted = ideaListInput.shape.sort.unwrap().options;
    expect(IDEA_SORT_OPTIONS.map((option) => option.value).sort()).toEqual(
      [...accepted].sort(),
    );
  });

  it("has no `activity` and no `build`", () => {
    expect(IDEA_SORT_OPTIONS.map((option) => option.value)).not.toContain("activity");
    expect(IDEA_SORT_OPTIONS.map((option) => option.value)).not.toContain("build");
  });

  it("no direction button, because `oldest` already says the other way", () => {
    const queue = consoleSource.slice(
      consoleSource.indexOf("function IdeaQueue()"),
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
    expect(adminApi).toContain("trpc.idea.list.query");
    expect(adminApi).toContain("trpc.idea.get.query");
    expect(adminApi).toContain("trpc.idea.resolve.mutate");
    expect(adminApi).toContain("protectedProcedure");
  });
});
