export type SortDirection = "asc" | "desc";

/**
 * The contract between a list page's URL state and `DataTable`.
 *
 * The table renders the controls and reads the current values; it never owns
 * them — `query` is a prop, and the search, sort, page and facets arrive in it.
 * Where that state is *kept* is the app's business and not the design system's,
 * but the shape belongs next to the component that consumes it, so the two
 * cannot drift.
 *
 * This used to name that implementation `useTableQuery`. No such symbol exists
 * — nothing under `apps/` or `packages/` defines, imports or tests it — and
 * there is nothing in its place yet either: `DataTable` has no call site, and
 * the admin tables that do ship build their state with `useAdminList` in
 * `apps/web/components/admin/use-admin-list.ts`, whose `AdminListQuery` is a
 * different shape — no facets, no tabs, none of it in the URL. Whoever mounts
 * `DataTable` is the one who writes the `TableQueryState` half.
 */
export type TableQueryState = {
	q: string;
	sort: string;
	dir: SortDirection;
	page: number;
	pageSize: number;
	/** `"all"` when no tab is selected. */
	tab: string;
	tabId?: string;
	/** Facet id → selected value, `"all"` when unfiltered. */
	filters: Record<string, string>;
	setSearch: (value: string) => void;
	toggleSort: (id: string) => void;
	setSort: (id: string) => void;
	setDir: (dir: SortDirection) => void;
	setPage: (page: number) => void;
	setTab: (value: string) => void;
	setFilter: (id: string, value: string) => void;
};
