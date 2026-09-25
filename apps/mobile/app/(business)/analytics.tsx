import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import {
	type BusinessAnalytics,
	formatMoney,
	MARKET_TIME_ZONE,
	shiftMarketMonths,
	shiftMarketYears,
	startOfMarketDay,
} from "@pymeshub/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { MerchantLocationPicker } from "@/components/merchant-location-picker";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { Sheet } from "@/components/sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	shadow,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * The analytics tab: the shop's own numbers, over a window the owner picks.
 *
 * The read is `business.analytics`; the surface around it is deliberately an operator's
 * console rather than a wall of cards. Exactly one strong card exists — the net-revenue
 * hero — and everything else takes its structure from type, alignment and hairlines:
 *
 * - the nine figures sit in a 3×3 matrix divided by internal rules, not nine tiles;
 * - the plot is bare: three gridlines, bars, axis labels, and no container around it;
 * - best sellers are a bordered list, and an empty section takes *less* height than a
 *   populated one, so a quiet shop's dashboard reads as quiet rather than broken.
 *
 * The period control is one button that opens a sheet of the four units the API buckets
 * at — hours, days, months, years — rather than three hardcoded day pills. There is no
 * text field: "30" typed into a box is the same choice with a worse keyboard, and the
 * sheet keeps the whole decision one tap. A new period keeps the current figures on
 * screen (`placeholderData: keepPreviousData`) and each block then remounts under
 * `AnimateIn`, so the page crossfades in place: section geometry never moves, and the
 * reader's thumb keeps its place over the plot.
 */

/** The windows the picker offers — minutes are gone, months join the set. */
type RangeUnit = "hours" | "days" | "months" | "years";
type AnalyticsRange = { amount: number; unit: RangeUnit };
/** The API's bucket width, derived from the range rather than chosen by hand. */
type Granularity = "hour" | "day" | "month";

const RANGE_OPTIONS: AnalyticsRange[] = [
	{ amount: 6, unit: "hours" },
	{ amount: 24, unit: "hours" },
	{ amount: 7, unit: "days" },
	{ amount: 30, unit: "days" },
	{ amount: 90, unit: "days" },
	{ amount: 3, unit: "months" },
	{ amount: 6, unit: "months" },
	{ amount: 1, unit: "years" },
	{ amount: 2, unit: "years" },
];

const DEFAULT_RANGE: AnalyticsRange = { amount: 30, unit: "days" };

/**
 * Each unit's plural-safe key pair. Typed `satisfies` rather than annotated, so the
 * literals stay exact: `tp` only accepts a key whose `_plural` sibling exists, and the
 * lookup `UNIT_KEYS[value.unit]` has to stay inside that set for every unit.
 */
const UNIT_KEYS = {
	hours: "biz.analytics.unit.hours",
	days: "biz.analytics.unit.days",
	months: "biz.analytics.unit.months",
	years: "biz.analytics.unit.years",
} as const satisfies Record<RangeUnit, MessageKey>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The bucket width a window is read at.
 *
 * The plot's job is one readable column per unit, so the answer follows the window: an
 * hours-wide read splits hourly, five weeks of days stay daily (that is the densest
 * series a phone reads as columns), and everything wider — ninety days, six months, two
 * years — comes back monthly rather than as seven hundred daily slivers. Weeks would be
 * a fourth unit nobody asked for, and a month bucket is the one an owner already thinks
 * in at that span.
 */
function granularityOf(amount: number, unit: RangeUnit): Granularity {
	if (unit === "hours") return "hour";
	if (unit === "days") return amount <= 35 ? "day" : "month";
	return "month";
}

/** The chart's section title follows the buckets the read came back in. */
function chartTitleKey(granularity: Granularity): MessageKey {
	return granularity === "hour"
		? "biz.analytics.revenueByHour"
		: granularity === "month"
			? "biz.analytics.revenueByMonth"
			: "biz.analytics.revenueByDay";
}

/** A window, as the query takes it. Months and years snap to the market's midnight. */
function windowOf(
	now: Date,
	amount: number,
	unit: RangeUnit,
): { from: Date; to: Date } {
	const to = new Date(now);
	const from =
		unit === "years"
			? startOfMarketDay(shiftMarketYears(to, -amount))
			: unit === "months"
				? startOfMarketDay(shiftMarketMonths(to, -amount))
				: unit === "days"
					? startOfMarketDay(new Date(to.getTime() - (amount - 1) * DAY_MS))
					: new Date(to.getTime() - amount * 3_600_000);
	return { from, to };
}

export default function AnalyticsScreen() {
	const trpc = useTRPC();
	const { colors } = useTheme();
	const { t, tp, intlLocale } = useT();
	const scope = useMerchantScope();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);
	const selectedLocation =
		locations.data?.find((location) => location.id === scope.locationId) ??
		locations.data?.find((location) => location.isDefault) ??
		locations.data?.[0];
	const locationId = selectedLocation?.id ?? "";
	const canReadAnalytics = shop?.role === "OWNER" || shop?.role === "MANAGER";
	const enabled = !!businessId && !!locationId && canReadAnalytics;
	const [rangeOpen, setRangeOpen] = useState(false);
	const [selectedRange, setSelectedRange] =
		useState<AnalyticsRange>(DEFAULT_RANGE);
	const granularity = granularityOf(selectedRange.amount, selectedRange.unit);
	const range = useMemo(
		() => windowOf(new Date(), selectedRange.amount, selectedRange.unit),
		[selectedRange],
	);
	// A period reads as words — "Last 30 days", never "Period: 30 d": the colon made a
	// database filter out of the control that scopes the whole page.
	const rangeUnitLabel = (value: AnalyticsRange): string =>
		tp(UNIT_KEYS[value.unit], value.amount);
	const rangeLabel = (value: AnalyticsRange): string =>
		t("biz.analytics.period", {
			unit: rangeUnitLabel(value),
		});
	const chooseRange = (next: AnalyticsRange): void => {
		if (
			next.amount !== selectedRange.amount ||
			next.unit !== selectedRange.unit
		) {
			selection();
		}
		setSelectedRange(next);
		setRangeOpen(false);
	};
	const analytics = useQuery(
		trpc.business.analytics.queryOptions(
			{
				businessId,
				locationId,
				from: range.from,
				to: range.to,
				timezone: MARKET_TIME_ZONE,
				granularity,
			},
			{
				enabled,
				// The store screen's contract (see `app/(customer)/store/[slug].tsx`):
				// choosing a new period keeps the current figures on screen until the new
				// ones land, so the page crossfades instead of falling back to the
				// skeleton on every choice. The figures shown are true for the window
				// they name; `isPlaceholderData` is deliberately not treated as a wait.
				placeholderData: keepPreviousData,
			},
		),
	);
	const data = analytics.data;
	const subtitle = [
		shop?.businessName,
		selectedLocation?.name === shop?.businessName
			? selectedLocation?.city
			: selectedLocation?.name,
	]
		.filter(Boolean)
		.join(" · ");
	// `enabled` rides the gate: a disabled query stays `pending` forever, so an owner whose
	// membership read has not landed yet would hold the skeleton past the end of the wait.
	const waiting = useSkeletonHold(
		shops.isPending ||
			(!!businessId && locations.isPending) ||
			(enabled && analytics.isPending),
	);
	const failed = shops.error ?? locations.error ?? analytics.error;

	if (waiting) {
		return (
			<Screen title={t("biz.analytics.title")}>
				<AnalyticsSkeleton
					loadingLabel={t("state.loading")}
					chartTitle={t(chartTitleKey(granularity))}
				/>
			</Screen>
		);
	}
	if (shop && !canReadAnalytics) {
		return (
			<Screen title={t("biz.analytics.title")}>
				<EmptyState
					icon="lock-closed-outline"
					title={t("biz.permission.title")}
					body={t("biz.permission.body")}
				/>
			</Screen>
		);
	}

	if (!failed && locations.data && locations.data.length === 0) {
		return (
			<Screen title={t("biz.analytics.title")}>
				<EmptyState
					icon="location-outline"
					title={t("biz.locations.title")}
					body={t("biz.locations.subtitle")}
				/>
			</Screen>
		);
	}

	if (failed || !data) {
		return (
			<Screen title={t("biz.analytics.title")}>
				<ErrorState
					error={failed}
					title={t("biz.analytics.loadError")}
					onRetry={() => {
						void shops.refetch();
						void locations.refetch();
						void analytics.refetch();
					}}
				/>
			</Screen>
		);
	}

	const money = (minor: number): string =>
		formatMoney(minor, data.currency, { locale: intlLocale });
	// The figures' identity, for entrance purposes: when a fresh window lands, each block
	// remounts under `AnimateIn` and crossfades where it stands. The chrome above — the
	// picker and the period button — is outside every keyed block, so a period change is
	// a value change and never a page change.
	const figuresKey = `${data.from.getTime()}:${data.to.getTime()}`;
	const metrics: { key: string; label: string; value: string }[] = [
		{
			key: "orders",
			label: t("biz.analytics.orders"),
			value: String(data.orders.total),
		},
		{
			key: "average",
			label: t("biz.analytics.average"),
			value:
				data.averageOrderMinor === null ? "—" : money(data.averageOrderMinor),
		},
		{
			key: "customers",
			label: t("biz.analytics.customers"),
			value: String(data.customers.total),
		},
		{
			key: "repeat",
			label: t("biz.analytics.repeat"),
			value: String(data.customers.repeat),
		},
		{
			key: "accepted",
			label: t("biz.analytics.accepted"),
			value: String(data.orders.accepted),
		},
		{
			key: "refunds",
			label: t("biz.analytics.refunds"),
			value: money(data.sales.refunds_minor),
		},
		{
			key: "discounts",
			label: t("biz.analytics.discounts"),
			value: money(data.sales.discounts_minor),
		},
		{
			key: "avgAccept",
			label: t("biz.analytics.avgAccept"),
			value:
				data.operations.avg_accept_seconds === null
					? "—"
					: t("unit.minutes", {
							count: Math.round(data.operations.avg_accept_seconds / 60),
						}),
		},
		{
			key: "avgPrep",
			label: t("biz.analytics.avgPreparation"),
			value:
				data.operations.avg_preparation_seconds === null
					? "—"
					: t("unit.minutes", {
							count: Math.round(data.operations.avg_preparation_seconds / 60),
						}),
		},
	];

	return (
		<>
			<Screen
				title={t("biz.analytics.title")}
				subtitle={subtitle}
				scroll
				bottomInset
			>
				{(locations.data?.length ?? 0) > 1 ? (
					<MerchantLocationPicker
						locations={locations.data ?? []}
						selectedId={locationId}
						onPick={(nextLocationId) =>
							scope.selectLocation(businessId, nextLocationId)
						}
					/>
				) : null}
				{/* One control, not a permanent picker: the current window is named
			        on the button and the choices live in the sheet it opens. */}
				<Button
					label={rangeLabel(selectedRange)}
					onPress={() => setRangeOpen(true)}
					variant="ghost"
					size="sm"
					icon={
						<Ionicons
							name="calendar-outline"
							size={icon.control}
							color={colors.foreground}
						/>
					}
					style={styles.rangeButton}
				/>

				{/* The one strong card on the page, in the band's two colours —
			    `foreground` behind, `background` in front, the same fold §14's
			    #241922/#F6F2E9 pair takes on the home. */}
				<AnimateIn key={`${figuresKey}:hero`} index={0}>
					<View style={[styles.hero, { backgroundColor: colors.foreground }]}>
						{/* The eyebrow's +0.3 tracking is spec §5's: a step the type
					    scale has no token for, stated where it is used rather than
					    invented as a second scale. */}
						<Text
							variant="caption"
							bold
							style={{
								color: colors.background,
								letterSpacing: 0.3,
							}}
						>
							{t("biz.analytics.netRevenue")}
						</Text>
						<Text
							variant="display"
							bold
							tabular
							style={{ color: colors.background }}
						>
							{money(data.revenue.netMinor)}
						</Text>
						{/* The secondary line at 70%: it is context for the figure above,
					    not a figure of its own, and ivory at 70% on the ink band still
					    clears every contrast bar the palette is measured against. */}
						<View style={styles.heroMeta}>
							<Text
								variant="caption"
								style={{ color: colors.background, opacity: 0.7 }}
							>
								{t("biz.analytics.gross", {
									amount: money(data.revenue.grossMinor),
								})}
							</Text>
						</View>
					</View>
				</AnimateIn>

				{/* The matrix: nine cells, two internal rules each way, no outer card —
			    a financial operating panel, not nine tiles floating in whitespace. */}
				<AnimateIn key={`${figuresKey}:metrics`} index={1}>
					<View
						style={[
							styles.metrics,
							{
								borderTopColor: colors.border,
								borderBottomColor: colors.border,
							},
						]}
					>
						{metrics.map((cell, index) => (
							<Metric
								key={cell.key}
								label={cell.label}
								value={cell.value}
								column={index % 3}
								row={Math.floor(index / 3)}
								borderColor={colors.border}
							/>
						))}
					</View>
				</AnimateIn>

				<AnimateIn
					key={`${figuresKey}:chart`}
					index={2}
					style={styles.chartSection}
				>
					<SectionHeader
						title={t(chartTitleKey(granularity))}
						style={styles.sectionToContent}
					/>
					{data.ordersByDay.length === 0 ? (
						<EmptyRevenuePlot message={t("biz.analytics.emptyOrders")} />
					) : (
						<RevenueBars
							buckets={data.ordersByDay}
							currency={data.currency}
							granularity={granularity}
						/>
					)}
				</AnimateIn>

				<AnimateIn key={`${figuresKey}:products`} index={3}>
					<SectionHeader
						title={t("biz.insight.topProduct")}
						style={styles.sectionToContent}
					/>
					<View
						style={[
							styles.productList,
							{
								borderTopColor: colors.border,
								borderBottomColor: colors.border,
							},
						]}
					>
						{data.topProducts.length === 0 ? (
							// The absence of data occupies less space than data: one muted
							// row at the height the lightest real row would take.
							<View style={styles.productEmpty}>
								<Text tone="muted">
									{`—   ${t("biz.analytics.emptyProducts")}`}
								</Text>
							</View>
						) : (
							data.topProducts.map((product, index) => (
								<View
									key={product.productId}
									style={[
										styles.product,
										index > 0 && {
											borderTopWidth: StyleSheet.hairlineWidth,
											borderTopColor: colors.border,
										},
									]}
								>
									<View style={styles.productCopy}>
										<Text bold>{product.name}</Text>
										<Text variant="caption" tone="muted">
											{tp("biz.analytics.sold", product.quantity)}
										</Text>
									</View>
									<Text tabular bold>
										{money(product.revenueMinor)}
									</Text>
								</View>
							))
						)}
					</View>
				</AnimateIn>
			</Screen>

			<Sheet
				open={rangeOpen}
				onClose={() => setRangeOpen(false)}
				title={t("biz.analytics.customRange")}
				closeLabel={t("action.close")}
				snapPoints={[1]}
			>
				<Card>
					{RANGE_OPTIONS.map((option, index) => {
						const selected =
							option.amount === selectedRange.amount &&
							option.unit === selectedRange.unit;
						return (
							<ListRow
								key={`${option.amount}-${option.unit}`}
								title={rangeUnitLabel(option)}
								divider={index < RANGE_OPTIONS.length - 1}
								state={selected ? t("biz.new.selected") : undefined}
								onPress={() => chooseRange(option)}
							/>
						);
					})}
				</Card>
			</Sheet>
		</>
	);
}

/* The plot's geometry. Every number here is a measurement of the plot rather than of
   the data, so a series that arrives does not move the section it lands in. */
const PLOT_HEIGHT = 180;
/** Spec §12's restraint: an empty plot still reads as *the plot*, but takes less room. */
const EMPTY_PLOT_HEIGHT = 140;
const AXIS_LABELS_HEIGHT = 20;
/** Three horizontal gridlines — top, middle, baseline. No vertical rules. */
const GRID_RATIOS = [0, 0.5, 1] as const;
const BAR_GAP = 4;
/**
 * A chart mark is sized against the plot, not against the radius scale: at four-to-eight
 * points wide, `radius.sm` (6) would round a bar into a capsule, which is a pill and not
 * a data point. This is the one off-scale corner in the file, and it is a mark.
 */
const BAR_CORNER = 2;
/** Wide enough for "sep 23" over a formatted figure, narrow enough to clamp in 350pt. */
const TOOLTIP_WIDTH = 150;

/**
 * The revenue series, as bars.
 *
 * Bars and not a smoothed line, because each bucket is a *discrete total* for its period:
 * a line implies the value between two days means something, and between two days there
 * is nothing to mean. Each column — the full plot height, not just the bar — is the touch
 * target, so scrubbing across the plot aims at the day rather than at its bar; a tap
 * draws the selection line, fills the bar in ink and lifts a tooltip with the bucket's
 * long label and figure.
 *
 * Unselected bars are `mutedForeground` and the selected one is `foreground`: ink is
 * spent on the one column being read, and the chart stays an action-free surface
 * everywhere else — the palette's lime has no business here.
 */
function RevenueBars({
	buckets,
	currency,
	granularity,
}: {
	buckets: BusinessAnalytics["ordersByDay"];
	currency: BusinessAnalytics["currency"];
	granularity: Granularity;
}) {
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const [width, setWidth] = useState(0);
	const [selected, setSelected] = useState<number | null>(null);

	const peak = buckets.reduce(
		(max, bucket) => Math.max(max, bucket.revenueMinor),
		0,
	);
	const slot = buckets.length > 0 ? width / buckets.length : 0;
	const centreAt = (index: number): number => slot * index + slot / 2;
	const active = selected === null ? null : (buckets[selected] ?? null);

	return (
		<View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
			<View style={styles.plot}>
				{GRID_RATIOS.map((ratio) => (
					<View
						key={ratio}
						style={[
							styles.gridLine,
							ratio === 1 ? { bottom: 0 } : { top: ratio * PLOT_HEIGHT },
							// Spec §11's grid: the ink itself at 8%, which lands the line
							// between the border token and nothing — subordinate to the bars
							// by construction rather than by a second grey to maintain.
							{
								backgroundColor: colors.foreground,
								opacity: 0.08,
							},
						]}
					/>
				))}
				{width > 0 ? (
					<View style={styles.bars}>
						{buckets.map((bucket, index) => {
							const height =
								peak === 0 || bucket.revenueMinor === 0
									? 0
									: Math.max(
											2,
											Math.round(
												(bucket.revenueMinor / peak) * (PLOT_HEIGHT - BAR_GAP),
											),
										);
							const isSelected = selected === index;
							return (
								<Pressable
									key={bucket.day}
									accessibilityLabel={t("biz.analytics.chartDay", {
										day: bucketLabel(
											bucket.day,
											"long",
											granularity,
											intlLocale,
										),
										amount: formatMoney(bucket.revenueMinor, currency, {
											locale: intlLocale,
										}),
									})}
									accessibilityRole="button"
									accessibilityState={{ selected: isSelected }}
									onPress={() => setSelected(isSelected ? null : index)}
									style={styles.barSlot}
								>
									{height > 0 ? (
										<View
											style={[
												styles.bar,
												{
													height,
													backgroundColor: isSelected
														? colors.foreground
														: colors.mutedForeground,
												},
											]}
										/>
									) : null}
								</Pressable>
							);
						})}
					</View>
				) : null}
				{active && slot > 0 && selected !== null ? (
					<>
						<View
							style={[
								styles.selectionLine,
								{
									left: centreAt(selected),
									backgroundColor: colors.foreground,
								},
							]}
						/>
						{/* The one overlay on the page that earns a shadow (spec §21): it
					    floats above the plot, and it is clamped to the plot's own width
					    so the last column's tooltip stops at the edge instead of running
					    off the screen. */}
						<View
							style={[
								styles.tooltip,
								shadow.card,
								{
									backgroundColor: colors.card,
									borderColor: colors.border,
									left: Math.min(
										Math.max(centreAt(selected) - TOOLTIP_WIDTH / 2, 0),
										Math.max(width - TOOLTIP_WIDTH, 0),
									),
								},
							]}
						>
							<Text variant="caption" tone="muted">
								{bucketLabel(active.day, "long", granularity, intlLocale)}
							</Text>
							<Text variant="label" bold tabular>
								{formatMoney(active.revenueMinor, currency, {
									locale: intlLocale,
								})}
							</Text>
						</View>
					</>
				) : null}
			</View>
			<View style={styles.axisLabels}>
				{width > 0
					? buckets.map((bucket, index) => (
							<View key={bucket.day} style={styles.axisSlot}>
								{index % axisStride(buckets.length) === 0 ? (
									<Text variant="caption" tone="muted">
										{bucketLabel(bucket.day, "axis", granularity, intlLocale)}
									</Text>
								) : null}
							</View>
						))
					: null}
			</View>
		</View>
	);
}

/** Label every stride-th bucket: six dates a scan can hold, not thirty. */
function axisStride(count: number): number {
	return Math.max(1, Math.ceil(count / 6));
}

/**
 * The plot's own frame, holding no data.
 *
 * The gridlines and the baseline stay — an empty state that removes the plot entirely
 * makes the section look broken — and the message sits where the bars would. No card,
 * no shadow, no illustration: a quiet dashboard is the product working, not a failure
 * to decorate.
 */
function EmptyRevenuePlot({ message }: { message: string }) {
	const { colors } = useTheme();

	return (
		<View style={[styles.plot, styles.emptyPlot]}>
			{GRID_RATIOS.map((ratio) => (
				<View
					key={ratio}
					style={[
						styles.gridLine,
						ratio === 1 ? { bottom: 0 } : { top: ratio * EMPTY_PLOT_HEIGHT },
						{ backgroundColor: colors.foreground, opacity: 0.08 },
					]}
				/>
			))}
			<View style={styles.emptyPlotCopy}>
				<Text variant="label" tone="muted">
					{message}
				</Text>
			</View>
		</View>
	);
}

/**
 * The bucket keys arrive in the shape the API bucketed them — Costa Rica wall time in
 * `YYYY-MM-DD HH:00`, `YYYY-MM-DD` or `YYYY-MM` — and are parsed by slicing rather than
 * by `new Date(string)`, whose treatment of a bare `YYYY-MM` as *UTC midnight* would
 * print the previous day to a reader in Costa Rica. The parsed fields are then rebuilt
 * as UTC wall time and formatted with `timeZone: "UTC"`, so the device's own zone cannot
 * move a date the market already counted.
 *
 * One formatter per shape per locale, cached for the life of the module — the same
 * reason `lib/format.ts` caches: constructing an `Intl.DateTimeFormat` is the expensive
 * half of using one, and a thirty-column plot builds thirty labels per interaction. A
 * construction failure answers `null` and the raw key prints instead: a bucket key is an
 * honest fallback and a thrown `RangeError` mid-render is not.
 */
type BucketLabelKind = "axis" | "long";

const BUCKET_DATE_OPTIONS: Record<
	Granularity,
	{ axis: Intl.DateTimeFormatOptions; long: Intl.DateTimeFormatOptions }
> = {
	hour: {
		axis: { hour: "2-digit", timeZone: "UTC" },
		long: {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZone: "UTC",
		},
	},
	day: {
		axis: { day: "2-digit", timeZone: "UTC" },
		long: { month: "short", day: "numeric", timeZone: "UTC" },
	},
	month: {
		axis: { month: "short", timeZone: "UTC" },
		long: { month: "short", year: "numeric", timeZone: "UTC" },
	},
};

const BUCKET_FORMATTERS = new Map<string, Intl.DateTimeFormat | null>();

function bucketFormatter(
	kind: BucketLabelKind,
	granularity: Granularity,
	intlLocale: string,
): Intl.DateTimeFormat | null {
	const key = `${granularity}|${kind}|${intlLocale}`;
	const cached = BUCKET_FORMATTERS.get(key);
	if (cached !== undefined) return cached;

	let built: Intl.DateTimeFormat | null = null;
	try {
		built = new Intl.DateTimeFormat(
			intlLocale,
			BUCKET_DATE_OPTIONS[granularity][kind],
		);
	} catch {
		built = null;
	}
	BUCKET_FORMATTERS.set(key, built);
	return built;
}

function bucketLabel(
	bucket: string,
	kind: BucketLabelKind,
	granularity: Granularity,
	intlLocale: string,
): string {
	const year = Number(bucket.slice(0, 4));
	const month = Number(bucket.slice(5, 7)) - 1;
	const day = Number(bucket.slice(8, 10)) || 1;
	const hour = granularity === "hour" ? Number(bucket.slice(11, 13)) : 0;
	const at = new Date(Date.UTC(year, month, day, hour));
	return bucketFormatter(kind, granularity, intlLocale)?.format(at) ?? bucket;
}

/**
 * The matrix's internal rules for the cell at (column, row): a vertical hairline after
 * the first two columns, a horizontal one under the first two rows. One function because
 * the loaded screen and its skeleton have to draw the *same* grid — a grid that differs
 * while loading would jump exactly the way a skeleton exists to prevent.
 */
function metricRules(column: number, row: number, borderColor: string) {
	return [
		column < 2
			? {
					borderRightWidth: StyleSheet.hairlineWidth,
					borderRightColor: borderColor,
				}
			: null,
		row < 2
			? {
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: borderColor,
				}
			: null,
	];
}

/** One cell: the muted caption over the figure — the anatomy every stat in the app uses. */
function Metric({
	label,
	value,
	column,
	row,
	borderColor,
}: {
	label: string;
	value: string;
	/** 0–2, which decides the cell's indent and its right rule. */
	column: number;
	/** 0–2, which decides the cell's bottom rule. */
	row: number;
	borderColor: string;
}) {
	return (
		<View
			style={[
				styles.metric,
				column > 0 && styles.metricIndented,
				...metricRules(column, row, borderColor),
			]}
		>
			<Text variant="caption" tone="muted">
				{label}
			</Text>
			{/* Never wraps: a figure that breaks across two lines turns a scan into a
			    parse. It shrinks inside the cell instead (iOS; Android holds the line
			    and ellipsizes — both beat a wrap). */}
			<Text
				variant="heading"
				bold
				tabular
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.75}
			>
				{value}
			</Text>
		</View>
	);
}

/**
 * The hairline `./button` draws on every variant, at `borderWidth: 1` — the same two
 * points `./skeletons`' own `HAIRLINE` counts into the control boxes it mirrors. It is
 * restated here because that constant is private to that file, and this screen's wait
 * counts the same two points in the same box; when `./skeletons` exports the constant,
 * this is the line to retire.
 */
const HAIRLINE = 1;

/**
 * The stand-ins' counts, named after the figures they stand in for — the rule
 * `app/admin.tsx`'s `SKELETON_CARDS` states: a skeleton keyed by array position is a
 * block that gets reused for a different figure the moment one is added. Nine metrics is
 * the matrix's own count; the chart's answer is the bars, so the wait draws the plot's
 * *frame* — gridlines and a baseline band — rather than a count of bars it cannot know.
 */
const SKELETON_METRICS = [
	"orders",
	"average",
	"customers",
	"repeat",
	"accepted",
	"refunds",
	"discounts",
	"avgAccept",
	"avgPrep",
] as const;
const SKELETON_PRODUCTS = ["first", "second", "third"] as const;

/**
 * The wait, in the loaded screen's own boxes: the range row, the dark hero, the
 * nine-cell matrix with its rules, the plot's frame, and the product list under its
 * own borders.
 *
 * The boxes are the screen's own styles — `rangeButton`, `hero`, `heroMeta`, `metrics`,
 * `metric`, `plot`, `gridLine`, `productList`, `product`, `productCopy` — composed
 * rather than restated, which is what keeps the wait and the page from disagreeing about
 * a padding or a rule: one number moved, both move. The section headings are drawn real
 * and only the figures are grey, the way `./product-form`'s form skeleton draws its
 * sections; `Skeleton`'s `label` on the first line is the one announcement for the whole
 * screen, and `chartTitle` comes in as a prop because the wait has no data to derive the
 * bucket width from — the range the reader already chose is what names it.
 *
 * The text heights are the one thing this block owns, and they go through
 * `./skeletons`' `line()` at the reader's `fontScale` — a height frozen at 100% metrics
 * is exact at 100% and short of the real screen at 200%, which is the one jump big
 * enough to see. The hero's band is the loaded hero's own fill, so the swap from wait to
 * figures changes what is *on* the card and not the card.
 */
function AnalyticsSkeleton({
	loadingLabel,
	chartTitle,
}: {
	loadingLabel: string;
	chartTitle: string;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const { fontScale } = useWindowDimensions();

	// The one control's own box, once. `rangeButton` is `./button`'s sum at its
	// `sm` size, so the wait grows with the reader's text just as the control does.
	const rangeButton = Math.max(
		MIN_TOUCH_TARGET,
		HAIRLINE * 2 + space.sm * 2 + line("heading", fontScale).height,
	);

	// The wait's own column: the real screen spaces its blocks with each block's own
	// margin and no parent gap, and the grey column composes those same styles, so it
	// spaces itself the same way — a gap here would double every step.
	return (
		<View>
			<Skeleton
				label={loadingLabel}
				style={[
					styles.skeletonRangeButton,
					{ height: rangeButton },
					line("heading", fontScale),
				]}
			/>
			<View style={[styles.hero, { backgroundColor: colors.foreground }]}>
				<Skeleton style={[styles.skeletonLabel, line("caption", fontScale)]} />
				<Skeleton style={[styles.skeletonFigure, line("display", fontScale)]} />
				<View style={styles.heroMeta}>
					<Skeleton style={[styles.skeletonMeta, line("caption", fontScale)]} />
				</View>
			</View>
			<View
				style={[
					styles.metrics,
					{
						borderTopColor: colors.border,
						borderBottomColor: colors.border,
					},
				]}
			>
				{SKELETON_METRICS.map((metric, index) => (
					<View
						key={metric}
						style={[
							styles.metric,
							index % 3 > 0 && styles.metricIndented,
							...metricRules(index % 3, Math.floor(index / 3), colors.border),
						]}
					>
						<Skeleton
							style={[styles.skeletonMeta, line("caption", fontScale)]}
						/>
						<Skeleton
							style={[styles.skeletonValue, line("heading", fontScale)]}
						/>
					</View>
				))}
			</View>
			<SectionHeader title={chartTitle} style={styles.sectionToContent} />
			<View style={styles.plot}>
				{GRID_RATIOS.map((ratio) => (
					<View
						key={ratio}
						style={[
							styles.gridLine,
							ratio === 1 ? { bottom: 0 } : { top: ratio * PLOT_HEIGHT },
							{ backgroundColor: colors.border },
						]}
					/>
				))}
				<Skeleton style={styles.skeletonPlotBand} />
			</View>
			<View style={styles.axisLabels} />
			<SectionHeader
				title={t("biz.insight.topProduct")}
				style={styles.sectionToContent}
			/>
			<View
				style={[
					styles.productList,
					{
						borderTopColor: colors.border,
						borderBottomColor: colors.border,
					},
				]}
			>
				{SKELETON_PRODUCTS.map((product) => (
					<View key={product} style={styles.product}>
						<View style={styles.productCopy}>
							<Skeleton
								style={[styles.skeletonTitle, line("body", fontScale)]}
							/>
							<Skeleton
								style={[styles.skeletonMeta, line("caption", fontScale)]}
							/>
						</View>
						<Skeleton style={[styles.skeletonPrice, line("body", fontScale)]} />
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	skeletonRangeButton: {
		width: 150,
		borderRadius: radius.sm,
		marginBottom: space.lg,
	},
	skeletonLabel: { width: "40%" },
	skeletonFigure: { width: "60%" },
	skeletonMeta: { width: "35%" },
	skeletonValue: { width: "45%" },
	skeletonTitle: { width: "55%" },
	skeletonPrice: { width: "20%" },
	// The plot's stand-in: a band along the baseline, where the bars will stand. The
	// count of bars is the answer, so the wait draws only the frame they rise from.
	skeletonPlotBand: {
		borderRadius: radius.sm,
		bottom: 0,
		height: space.xxl,
		left: 0,
		position: "absolute",
		right: 0,
	},
	rangeButton: { alignSelf: "flex-start", marginBottom: space.lg },
	hero: {
		borderRadius: radius.md,
		padding: space.lg,
		marginBottom: space.lg,
		gap: space.xs,
	},
	// No margin of its own: the hero's `gap` is already the step between the figure
	// and this row, and a margin here stacked onto that gap into a 12 the scale does
	// not have.
	heroMeta: { flexDirection: "row", gap: space.lg },
	metrics: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginBottom: space.xxl,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	// The cell's anatomy is the console's `MetricCard`'s (`app/admin.tsx`): the muted
	// caption over the bold figure. Tighter than a card's padding — a matrix cell is a
	// ruled slot, not a surface — and the first column keeps a zero indent so every
	// major edge lands on the screen's own inset.
	metric: {
		width: "33.333%",
		paddingVertical: space.sm,
		paddingRight: space.sm,
		gap: space.xs,
	},
	metricIndented: { paddingLeft: space.md },
	// 24 points before the chart section: the rhythm spec §26 states between major
	// sections, kept by the block rather than by a parent gap so each section can move
	// without renegotiating its neighbours.
	chartSection: { marginBottom: space.xxl },
	// Title to content, denser than the storefront's `space.md`: this is the plot's own
	// lead-in, and the gap it tightens is four points on one screen.
	sectionToContent: { marginBottom: space.sm },
	plot: {
		height: PLOT_HEIGHT,
		position: "relative",
		marginBottom: space.xs,
	},
	emptyPlot: {
		height: EMPTY_PLOT_HEIGHT,
		justifyContent: "center",
		alignItems: "center",
	},
	emptyPlotCopy: { paddingHorizontal: space.lg },
	gridLine: {
		left: 0,
		right: 0,
		height: StyleSheet.hairlineWidth,
		position: "absolute",
	},
	bars: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		flexDirection: "row",
		columnGap: BAR_GAP,
	},
	// The whole column is the target: full plot height, so scrubbing aims at the day
	// rather than at the few points of bar the day happens to have drawn.
	barSlot: {
		flex: 1,
		height: "100%",
		alignItems: "center",
		justifyContent: "flex-end",
	},
	bar: {
		width: "100%",
		borderRadius: BAR_CORNER,
	},
	selectionLine: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: StyleSheet.hairlineWidth,
	},
	tooltip: {
		position: "absolute",
		top: 0,
		width: TOOLTIP_WIDTH,
		minHeight: 40,
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.sm,
		borderWidth: StyleSheet.hairlineWidth,
		gap: space.xs,
	},
	axisLabels: {
		height: AXIS_LABELS_HEIGHT,
		flexDirection: "row",
		columnGap: BAR_GAP,
	},
	axisSlot: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	// Bordered top and bottom, never a card: a list of facts under a heading, with the
	// hairlines doing the grouping a rounded box used to do.
	productList: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
		marginBottom: space.huge,
	},
	// The empty state is one row tall — less space than the data it stands in for.
	productEmpty: {
		minHeight: 56,
		justifyContent: "center",
		paddingHorizontal: space.xs,
	},
	product: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: space.md,
		paddingHorizontal: space.xs,
		gap: space.md,
	},
	productCopy: { flex: 1, gap: TEXT_STACK_GAP },
});
