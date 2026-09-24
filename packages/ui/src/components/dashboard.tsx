import { Skeleton } from "@pymeshub/ui/components/skeleton";
import { cn } from "@pymeshub/ui/lib/utils";
import type * as React from "react";

/**
 * Reusable, server-safe dashboard layout primitives. They establish their own
 * container-query context so the same grids reflow correctly regardless of
 * where the dashboard is mounted — sidebar open or not.
 *
 * Compose them as:
 *   <DashboardSection title="Overview">
 *     <StatGroup>{stats}</StatGroup>
 *     <DashboardRow>{hero}{aside}</DashboardRow>
 *   </DashboardSection>
 */

/**
 * An elevated KPI strip: one bordered surface holding several {@link StatCard}s
 * separated by hairline dividers (stacked + horizontal on narrow widths, a
 * single divided row on wide). This is the premium alternative to a row of
 * standalone boxes — see the surfaces guideline.
 *
 * `overflow-hidden` is what lets `rounded-md` clip: the dividers are borders on the
 * children, so without the clip the corner cells would square off the rounded surface
 * they sit in. `docs/design.md` puts card-like surfaces in the `--radius-md` step, and
 * this strip is one — the same reason `CardContent` carries the radius and the
 * transparent `Card` wrapper does not.
 *
 * `columns` is the tile count, and the caller declares it rather than the strip inferring
 * it: a strip handed three tiles and told "four" leaves an empty cell *inside* the border,
 * which reads as a card that failed to load rather than as "there is no fourth number". A
 * caller that draws its fourth tile for some roles and not others therefore has to say so.
 * Three tiles stack on a phone rather than sitting two-up with a gap beside the third — the
 * two-up arrangement that works for four has no way to place an odd third, and half a row
 * of empty surface inside a border is worse than a taller strip.
 */
const STAT_GROUP_COLUMNS = {
	3: "grid-cols-1 @2xl/stats:grid-cols-3",
	4: "grid-cols-2 @2xl/stats:grid-cols-4",
} as const;

function StatGroup({
	className,
	columns = 4,
	children,
	...props
}: React.ComponentProps<"div"> & {
	columns?: keyof typeof STAT_GROUP_COLUMNS;
}) {
	return (
		<div
			data-slot="stat-group"
			className={cn("@container/stats overflow-hidden rounded-md border", className)}
			{...props}
		>
			<div
				className={cn(
					"grid",
					STAT_GROUP_COLUMNS[columns],
					"[&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t",
					"@2xl/stats:[&>*]:border-t-0 @2xl/stats:[&>*]:border-l @2xl/stats:[&>*:first-child]:border-l-0",
				)}
			>
				{children}
			</div>
		</div>
	);
}

const GRID_COLS = {
	2: "@md/dashboard:grid-cols-2",
	3: "@md/dashboard:grid-cols-2 @4xl/dashboard:grid-cols-3",
	4: "@md/dashboard:grid-cols-2 @4xl/dashboard:grid-cols-4",
} as const;

function DashboardGrid({
	className,
	columns = 4,
	...props
}: React.ComponentProps<"div"> & { columns?: keyof typeof GRID_COLS }) {
	return (
		<div className="@container/dashboard">
			<div
				data-slot="dashboard-grid"
				className={cn("grid grid-cols-1 gap-4", GRID_COLS[columns], className)}
				{...props}
			/>
		</div>
	);
}

/**
 * A 2-up content row that collapses to a single column on narrow widths.
 * By default the first child takes ~2/3 (the hero chart) and the second ~1/3
 * (an aside). Pass `split="even"` for a 1:1 layout.
 */
function DashboardRow({
	className,
	split = "hero",
	...props
}: React.ComponentProps<"div"> & { split?: "hero" | "even" }) {
	return (
		<div className="@container/dashboard">
			<div
				data-slot="dashboard-row"
				className={cn(
					"grid grid-cols-1 gap-4",
					split === "hero"
						? "@3xl/dashboard:grid-cols-[2fr_1fr]"
						: "@3xl/dashboard:grid-cols-2",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

/**
 * A bordered, subtly elevated surface for a single chart, with an optional
 * header (title / description / action) and footer. The body stretches so
 * sibling cards in a {@link DashboardRow} stay the same height. Pair with the
 * client chart wrappers in `dashboard-chart.tsx`.
 */
function ChartCard({
	className,
	title,
	description,
	action,
	footer,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
	footer?: React.ReactNode;
}) {
	return (
		<div
			data-slot="chart-card"
			className={cn("flex flex-col rounded-md border", className)}
			{...props}
		>
			{title || description || action ? (
				<div className="flex items-start justify-between gap-4 p-5 md:p-6">
					<div className="flex min-w-0 flex-col gap-1">
						{title ? (
							<h3 className="truncate font-medium text-sm">{title}</h3>
						) : null}
						{description ? (
							<p className="text-muted-foreground text-xs/relaxed">
								{description}
							</p>
						) : null}
					</div>
					{action ? <div className="shrink-0">{action}</div> : null}
				</div>
			) : null}
			<div className="flex flex-1 flex-col justify-center pb-5 md:pb-6">
				{children}
			</div>
			{footer ? (
				<div className="border-t px-5 py-3 text-muted-foreground text-xs md:px-6">
					{footer}
				</div>
			) : null}
		</div>
	);
}

function KpiCard({
	className,
	title,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
}) {
	return (
		<div
			data-slot="kpi-card"
			className={cn("flex flex-col gap-4 rounded-md border p-5 md:p-6", className)}
			{...props}
		>
			<h3 className="truncate font-medium text-muted-foreground text-sm">
				{title}
			</h3>
			{children}
		</div>
	);
}

function DashboardSection({
	className,
	title,
	description,
	action,
	children,
	...props
}: Omit<React.ComponentProps<"section">, "title"> & {
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
}) {
	const hasHeader = title || description || action;
	return (
		<section
			data-slot="dashboard-section"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		>
			{hasHeader ? (
				<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
					<div className="flex flex-col gap-1">
						{title ? (
							<h2 className="font-medium text-base tracking-tight">{title}</h2>
						) : null}
						{description ? (
							<p className="text-muted-foreground text-sm">{description}</p>
						) : null}
					</div>
					{action ? <div className="shrink-0">{action}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	);
}

/**
 * A layout-matched loading state for the default dashboard composition
 * (KPI strip + hero/aside chart row). Use as a `<Suspense>` fallback so the
 * page paints instantly while server data streams in.
 */
function DashboardSkeleton({
	stats = 4,
	className,
}: {
	stats?: number;
	className?: string;
}) {
	return (
		<div
			data-slot="dashboard-skeleton"
			className={cn("flex flex-col gap-6", className)}
			aria-hidden
		>
			<StatGroup>
				{Array.from({ length: stats }).map((_, i) => (
					<div key={i} className="flex flex-col gap-3 p-4 md:p-6">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-16" />
						<Skeleton className="h-3 w-28" />
					</div>
				))}
			</StatGroup>
			<DashboardRow>
				<div className="flex flex-col gap-4 rounded-md border p-5 md:p-6">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-[200px] w-full" />
				</div>
				<div className="flex flex-col items-center gap-4 rounded-md border p-5 md:p-6">
					<Skeleton className="h-4 w-32 self-start" />
					<Skeleton className="size-[200px] rounded-full" />
				</div>
			</DashboardRow>
		</div>
	);
}

export {
	ChartCard,
	DashboardGrid,
	DashboardRow,
	DashboardSection,
	DashboardSkeleton,
	KpiCard,
	StatGroup,
};
