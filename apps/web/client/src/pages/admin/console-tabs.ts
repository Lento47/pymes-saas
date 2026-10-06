/**
 * The console's tabs: the list, the route vocabulary, and the one decision about which one
 * to open.
 *
 * This lives apart from `console.tsx` for three reasons, each of which cost something when
 * the code was inline:
 *
 * 1. **It is testable without the console.** `console.tsx` pulls in the trpc client, the
 *    query client and ten tab components, so a test that wanted to ask "which tab opens when
 *    the queue is still loading" had to mount all of it. Here it imports the function.
 * 2. **The page is 2,000 lines.** A list of ten strings and a pure function do not belong in
 *    the same file as a support thread, a payment dialog and an audit table.
 * 3. **A test that reads the source with a regex is a fourth thing to keep in sync.** The
 *    first version of the tab guard parsed `CONSOLE_TABS` out of `console.tsx` and documented
 *    at length why that was acceptable. It was not: exporting the list makes the guard
 *    stronger *and* simpler, because it compares the real thing against the real thing.
 *
 * ## Why the tab is a route segment and not a component state
 *
 * `AGENTS.md` requires pathname routing and forbids `#` fragments, and the sidebar already
 * links to sub-routes everywhere else (`/settings/members`). Tab state in a component meant
 * no tab could be linked, bookmarked or left with the back button.
 */

/**
 * The console's sections, in the order an operator meets them.
 *
 * ## Why grouping is data and not markup
 *
 * The sidebar draws five labelled groups, and the obvious implementation is five hardcoded
 * blocks in the nav component. That makes `CONSOLE_TABS` decorative — a list of routes with
 * no opinion about where they sit — and the two drift the moment somebody adds a tab, which is
 * exactly the "two lists have to agree" problem `console-tabs.test.ts` was written to kill.
 *
 * So the group is a **field on the tab**, and the nav groups by it. One list, one truth, and
 * adding a section means adding one row here.
 *
 * The groups are not decoration either. Eleven equal-weight items across a horizontal strip
 * gave every destination the same visual weight as every other, which is the "reads like a
 * prototype" symptom: nothing says what matters. Grouping says it structurally — *Operaciones*
 * is what you do, *Directorio* is what you look up, *Sistema* is what you check afterwards.
 */
export const CONSOLE_GROUPS = [
  { value: "general", label: "General" },
  { value: "operations", label: "Operaciones" },
  { value: "directory", label: "Directorio" },
  { value: "commerce", label: "Comercio" },
  { value: "system", label: "Sistema" },
] as const;

export type ConsoleGroup = (typeof CONSOLE_GROUPS)[number]["value"];

/**
 * The console's twelve tabs, grouped.
 *
 * `CONSOLE_TABS` is the single list: the sidebar is generated from it, the route validates
 * against it, and the tab test compares it to the rendered panels. So a renamed or moved tab
 * is one edit rather than four that have to agree.
 *
 * `label` is Spanish because the console has always been Spanish, and an operator switching
 * to English mid-task is not the problem this file has.
 *
 * **`overview` is a nav destination, not the default.** `defaultTab` still opens on the queue
 * when there is one, which is a decision this file already argues for and a test already
 * pins. Adding a summary page is not a reason to overrule it — an operator who opens the
 * console with two shops waiting is looking for the shops waiting, and making them click
 * "Overview" first to find out is a worse product.
 */
export const CONSOLE_TABS = [
  { value: "overview", label: "Resumen", group: "general" },
  { value: "approvals", label: "Aprobaciones", group: "operations" },
  { value: "orders", label: "Órdenes", group: "operations" },
  { value: "billing", label: "Cobros", group: "operations" },
  { value: "support", label: "Soporte", group: "operations" },
  { value: "businesses", label: "Negocios", group: "directory" },
  { value: "couriers", label: "Repartidores", group: "directory" },
  { value: "users", label: "Personas", group: "directory" },
  { value: "catalogue", label: "Catálogo", group: "commerce" },
  { value: "prices", label: "Planes", group: "commerce" },
  { value: "categories", label: "Categorías", group: "commerce" },
  { value: "audit", label: "Auditoría", group: "system" },
] as const;

export type ConsoleTab = (typeof CONSOLE_TABS)[number]["value"];

const TAB_VALUES: readonly string[] = CONSOLE_TABS.map((tab) => tab.value);
const GROUP_VALUES: readonly string[] = CONSOLE_GROUPS.map((group) => group.value);

/**
 * The tabs in one group, in list order.
 *
 * Derived rather than declared, so a tab cannot be added to `CONSOLE_TABS` with a group the
 * sidebar does not draw and vanish from the navigation — which is the failure a sidebar has
 * that a horizontal strip does not, because the strip rendered every entry unconditionally.
 */
export function tabsInGroup(group: ConsoleGroup): readonly ConsoleTab[] {
  return CONSOLE_TABS.filter((tab) => tab.group === group).map((tab) => tab.value);
}

/**
 * Whether every tab names a group the sidebar actually draws.
 *
 * Without this a typo in `group` typechecks fine — the field is inferred from the same
 * `CONSOLE_GROUPS` union — and the tab is simply missing from the nav with nothing to say so.
 */
export function groupsAreComplete(): string[] {
  return CONSOLE_TABS.filter((tab) => !GROUP_VALUES.includes(tab.group)).map(
    (tab) => tab.value,
  );
}

/**
 * Whether a `:tab` from the URL names a real tab.
 *
 * A route param is a string a person can edit, so an unknown one has to fall back rather
 * than render a page with nothing in it. Narrowing to `ConsoleTab` means the panels and the
 * strip cannot be given a value the registry does not contain.
 */
export function isConsoleTab(value: string | undefined): value is ConsoleTab {
  return !!value && TAB_VALUES.includes(value);
}

/**
 * The tab a bare `/admin/console` opens on.
 *
 * The queue when there is one, otherwise the business list. Kept from the component-state
 * version because it was right: an operator who opens the console with two shops waiting is
 * looking for the shops waiting.
 */
export function defaultTab(hasQueue: boolean): ConsoleTab {
  return hasQueue ? "approvals" : "businesses";
}

/**
 * Which tab to show, and whether the address has to be rewritten to say so.
 *
 * `tab: null` means **we do not know yet** — the URL named no tab and the queue has not been
 * counted, so any answer would be a guess. That third state is the whole point, and it exists
 * because of a bug: written inline as `isConsoleTab(routeTab) ? routeTab : defaultTab(hasQueue)`,
 * the fallback fired on the first paint, when `hasQueue` was still false because both queries
 * were in flight. The console then always opened on `businesses` *and wrote that into the
 * URL*, so the queue-aware default could never fire afterwards — on a console whose own
 * docblock says the queue "is the tab the route opens on".
 *
 * `queueKnown` is expected to be "has finished fetching", not "succeeded": a console whose
 * metrics endpoint is down must still land on a tab rather than sit on a spinner forever
 * with no way forward except the URL bar.
 */
export function resolveConsoleTab(
  routeTab: string | undefined,
  queue: { pending: number; couriers: number },
  queueKnown: boolean,
): { tab: ConsoleTab | null; needsRedirect: boolean } {
  if (isConsoleTab(routeTab)) return { tab: routeTab, needsRedirect: false };
  if (!queueKnown) return { tab: null, needsRedirect: false };
  return {
    tab: defaultTab(queue.pending + queue.couriers > 0),
    needsRedirect: true,
  };
}
