import type { MessageKey } from "@pymeshub/i18n";
import { type BusinessAnalytics, formatMoney } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { MerchantLocationPicker } from "@/components/merchant-location-picker";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import {
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * The analytics tab: the shop's own numbers, over a window the owner builds.
 *
 * The read is `business.analytics` — here with a window the owner composes from
 * an amount and a unit (minutes, hours, days, years) instead of three hardcoded
 * day buttons, because a dashboard answers "how has it been going", and that
 * answer needs more than three windows. Every label is the dictionary's, the
 * units included: a bare `min`/`h`/`d`/`y` read from `unit.*` like every other
 * short unit in the app.
 *
 * The window is built with the UTC clock — the API's windows are UTC-bucketed,
 * so a day-unit window is whole UTC days and a sub-day one is exact to the
 * minute. A new window is a new query input, which is why `from`/`to` are
 * derived in one `useMemo` off the applied window rather than built at render:
 * react-query keys the cache on them. Typing is not applying: the box holds
 * keystrokes and the window moves on the keyboard's submit or on a unit tap,
 * so a half-typed "9" never reads a nine-minute window on its way to "90".
 *
 * The window is capped at two years. The chart samples one point per UTC day with
 * no server cap, so an uncapped window is an uncapped list — the cap is a
 * client guard around a read that has none, and the refusal names it.
 *
 * The hero is the pulse band's register (`./merchant-pulse`, §14): ink behind, ivory in
 * front, the palette's own two keys and no colour named here — the money is read in the
 * dark register everywhere the console shows it. The line below is quiet on purpose:
 * lime is the moment's one action (§6), and a chart is not an action, so the line draws
 * in `mutedForeground` and leaves the accent to the controls.
 *
 * A failed read is an `ErrorState` with its retry, not a red sentence: the screen can be
 * re-asked, and the state that says so is the one this app already draws everywhere.
 */

/** The units a window is built from, in the order the picker offers them. */
type RangeUnit = "minutes" | "hours" | "days" | "years";

const UNITS: readonly RangeUnit[] = ["minutes", "hours", "days", "years"];

/** The picker's words, read from the dictionary's short units. */
const UNIT_LABEL: Record<RangeUnit, MessageKey> = {
	minutes: "unit.minute",
	hours: "unit.hour",
	days: "unit.day",
	years: "unit.year",
};

/**
 * The widest window the screen will ask for, in milliseconds.
 *
 * Two years of UTC days is ~730 chart rows — the stride below already samples
 * the captions, and the rows themselves are the unbounded half. Past this the
 * box refuses with `biz.analytics.range.invalid` rather than asking.
 */
const MAX_WINDOW_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** A window, as the query takes it. `null` is a box the screen will not send. */
function windowOf(
	now: Date,
	amount: number,
	unit: RangeUnit,
): { from: Date; to: Date } | null {
	if (!Number.isInteger(amount) || amount < 1) return null;
	const to = new Date(now);
	const from = new Date(now);
	if (unit === "years") {
		from.setUTCFullYear(from.getUTCFullYear() - amount);
		from.setUTCHours(0, 0, 0, 0);
	} else if (unit === "days") {
		from.setUTCDate(from.getUTCDate() - amount);
		from.setUTCHours(0, 0, 0, 0);
	} else {
		from.setTime(
			from.getTime() - amount * (unit === "hours" ? 3_600_000 : 60_000),
		);
	}
	if (to.getTime() - from.getTime() > MAX_WINDOW_MS) return null;
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
	// The box the owner types in, and the window the queries read. Typing never
	// moves the window on its own: the unit settles it at once, the amount on
	// the keyboard's submit, and a refusal marks the box instead of reading.
	// A unit tap on a box that cannot apply keeps the old window — the list
	// behind it stays the answer to a question that was asked, not a blank.
	const applyAmount = (text: string, nextUnit: RangeUnit): void => {
		const amount = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
		const window =
			Number.isSafeInteger(amount) && amount >= 1
				? windowOf(new Date(), amount, nextUnit)
				: null;
		if (window === null) {
			setRefused(true);
			return;
		}
		setRefused(false);
		if (amount !== applied.amount || nextUnit !== applied.unit) selection();
		setApplied({ amount, unit: nextUnit });
	};
	const [amountText, setAmountText] = useState("7");
	const [unit, setUnit] = useState<RangeUnit>("days");
	const [applied, setApplied] = useState<{ amount: number; unit: RangeUnit }>({
		amount: 7,
		unit: "days",
	});
	const [refused, setRefused] = useState(false);
	const range = useMemo(() => {
		const window = windowOf(new Date(), applied.amount, applied.unit);
		// The box only ever applies what `windowOf` accepts, so a `null` here is
		// unreachable — and rendered rather than asserted, because the query
		// below is enabled on `businessId` and not on it.
		if (window === null) return null;
		return window;
	}, [applied]);
	const analytics = useQuery(
		trpc.business.analytics.queryOptions(
			{
				businessId,
				locationId,
				// The fallback dates never leave the device: the query below is
				// disabled while `range` is null, and `range` is null only where
				// the box refused to apply — which is the state the box itself
				// marks, not a window the API is asked about.
				from: range?.from ?? new Date(0),
				to: range?.to ?? new Date(),
			},
			{ enabled: enabled && range !== null },
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
				<AnalyticsSkeleton loadingLabel={t("state.loading")} />
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

	return (
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
			{/* The window, composed rather than picked: an amount box and a unit
			    rail beside it. The unit settles at once; the amount settles on
			    the keyboard's submit, so a half-typed box never reads. A refused
			    box marks itself and the list behind it stays put — the rows are
			    still the answer to the last window that was asked for. */}
			<View style={styles.rangeRow}>
				<View style={styles.amountBox}>
					<Field
						label={t("biz.analytics.customRange")}
						value={amountText}
						onChangeText={(value) => {
							setAmountText(value);
							setRefused(false);
						}}
						error={refused ? t("biz.analytics.range.invalid") : null}
						keyboardType="number-pad"
						onSubmitEditing={() => applyAmount(amountText, unit)}
						returnKeyType="done"
						maxLength={3}
					/>
				</View>
				<View style={styles.unitRail}>
					<Segmented
						label={t("biz.analytics.customRange")}
						value={unit}
						onChange={(value) => {
							const next = value as RangeUnit;
							setUnit(next);
							applyAmount(amountText, next);
						}}
						options={UNITS.map((one) => ({
							value: one,
							label: t(UNIT_LABEL[one]),
						}))}
					/>
				</View>
			</View>

			{/* The hero, in the band's two colours — `foreground` behind, `background` in
			    front, the same fold §14's #241922/#F6F2E9 pair takes on the home. */}
			<View style={[styles.hero, { backgroundColor: colors.foreground }]}>
				<Text tone="inverse" variant="label">
					{t("biz.analytics.netRevenue")}
				</Text>
				<Text tone="inverse" variant="display" bold tabular>
					{formatMoney(data.revenue.netMinor, data.currency, {
						locale: intlLocale,
					})}
				</Text>
				<View style={styles.heroMeta}>
					<Text tone="inverse" variant="caption">
						{t("biz.analytics.gross", {
							amount: formatMoney(data.revenue.grossMinor, data.currency, {
								locale: intlLocale,
							}),
						})}
					</Text>
				</View>
			</View>

			<View
				style={[
					styles.metrics,
					{ borderTopColor: colors.border, borderBottomColor: colors.border },
				]}
			>
				<Metric
					label={t("biz.analytics.orders")}
					value={String(data.orders.total)}
				/>
				<Metric
					label={t("biz.analytics.average")}
					value={
						data.averageOrderMinor === null
							? "—"
							: formatMoney(data.averageOrderMinor, data.currency, {
									locale: intlLocale,
								})
					}
				/>
				<Metric
					label={t("biz.analytics.customers")}
					value={String(data.customers.total)}
				/>
				<Metric
					label={t("biz.analytics.repeat")}
					value={String(data.customers.repeat)}
				/>
				<Metric
					label={t("biz.analytics.accepted")}
					value={String(data.orders.accepted)}
				/>
				<Metric
					label={t("biz.analytics.refunds")}
					value={formatMoney(data.sales.refunds_minor, data.currency, {
						locale: intlLocale,
					})}
				/>
				<Metric
					label={t("biz.analytics.discounts")}
					value={formatMoney(data.sales.discounts_minor, data.currency, {
						locale: intlLocale,
					})}
				/>
				<Metric
					label={t("biz.analytics.avgAccept")}
					value={
						data.operations.avg_accept_seconds === null
							? "—"
							: t("unit.minutes", {
									count: Math.round(data.operations.avg_accept_seconds / 60),
								})
					}
				/>
				<Metric
					label={t("biz.analytics.avgPreparation")}
					value={
						data.operations.avg_preparation_seconds === null
							? "—"
							: t("unit.minutes", {
									count: Math.round(
										data.operations.avg_preparation_seconds / 60,
									),
								})
					}
				/>
			</View>

			<SectionHeader title={t("biz.analytics.revenueByDay")} />
			<Card>
				{data.ordersByDay.length === 0 ? (
					<Text tone="muted">{t("biz.analytics.emptyOrders")}</Text>
				) : (
					<RevenueLineChart days={data.ordersByDay} currency={data.currency} />
				)}
			</Card>

			<SectionHeader title={t("biz.insight.topProduct")} />
			<Card>
				{data.topProducts.length === 0 ? (
					<Text tone="muted">{t("biz.analytics.emptyProducts")}</Text>
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
								{formatMoney(product.revenueMinor, data.currency, {
									locale: intlLocale,
								})}
							</Text>
						</View>
					))
				)}
			</Card>
		</Screen>
	);
}

const CHART_HEIGHT = 200;
const CHART_LINE_WIDTH = 2;
const CHART_POINT_SIZE = 6;
const CHART_POINT_INSET = CHART_POINT_SIZE / 2;
const CHART_GRID_RATIOS = [0, 0.25, 0.5, 0.75, 1] as const;

function RevenueLineChart({
	days,
	currency,
}: {
	days: BusinessAnalytics["ordersByDay"];
	currency: BusinessAnalytics["currency"];
}) {
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const [chartWidth, setChartWidth] = useState(0);
	const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

	const revenues = days.map((day) => day.revenueMinor);
	const minimum = Math.min(0, ...revenues);
	const maximum = Math.max(0, ...revenues);
	const range = maximum - minimum;
	const slotWidth = Math.max(chartWidth / days.length, 1);
	const plotWidth = Math.max(chartWidth - CHART_POINT_SIZE, 0);
	const xAt = (index: number) =>
		CHART_POINT_INSET +
		(days.length === 1
			? plotWidth / 2
			: (plotWidth * index) / (days.length - 1));
	const yAt = (revenueMinor: number) =>
		range === 0
			? CHART_HEIGHT / 2
			: CHART_POINT_INSET +
				((maximum - revenueMinor) / range) * (CHART_HEIGHT - CHART_POINT_SIZE);

	const segments = days.slice(1).map((day, index) => {
		const startIndex = index;
		const endIndex = index + 1;
		const x1 = xAt(startIndex);
		const x2 = xAt(endIndex);
		const y1 = yAt(revenues[startIndex] ?? day.revenueMinor);
		const y2 = yAt(day.revenueMinor);
		const width = Math.hypot(x2 - x1, y2 - y1);
		const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

		return {
			endIndex,
			style: {
				left: x1,
				top: (y1 + y2) / 2 - CHART_LINE_WIDTH / 2,
				width,
				transform: [{ rotate: `${angle}deg` }],
			},
		};
	});

	return (
		<View
			style={styles.chart}
			onLayout={({ nativeEvent }) => setChartWidth(nativeEvent.layout.width)}
		>
			{CHART_GRID_RATIOS.map((ratio) => (
				<View
					key={ratio}
					style={[
						styles.chartGridLine,
						{
							top: ratio * CHART_HEIGHT,
							backgroundColor: colors.border,
						},
					]}
				/>
			))}
			{chartWidth > 0 &&
				segments.map((segment) => (
					<View
						key={segment.endIndex}
						style={[
							styles.chartLine,
							segment.style,
							{ backgroundColor: colors.mutedForeground },
						]}
					/>
				))}
			{chartWidth > 0 &&
				days.map((day, index) => (
					<Pressable
						key={day.day}
						accessibilityLabel={t("biz.analytics.chartDay", {
							day: day.day,
							amount: formatMoney(day.revenueMinor, currency, {
								locale: intlLocale,
							}),
						})}
						accessibilityRole="button"
						accessibilityState={{ selected: selectedPoint === index }}
						onPress={() => setSelectedPoint(index)}
						style={[
							styles.chartPointTarget,
							{
								left: xAt(index) - slotWidth / 2,
								width: slotWidth,
							},
						]}
					>
						{selectedPoint === index ? (
							<View
								style={[
									styles.chartPoint,
									{ backgroundColor: colors.mutedForeground },
								]}
							/>
						) : null}
					</Pressable>
				))}
		</View>
	);
}

function RevenueChartSkeleton() {
	const { colors } = useTheme();

	return (
		<View style={styles.chart}>
			{CHART_GRID_RATIOS.map((ratio) => (
				<View
					key={ratio}
					style={[
						styles.chartGridLine,
						{
							top: ratio * CHART_HEIGHT,
							backgroundColor: colors.border,
						},
					]}
				/>
			))}
			<Skeleton style={styles.chartSkeleton} />
		</View>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.metric}>
			<Text variant="caption" tone="muted">
				{label}
			</Text>
			<Text variant="heading" bold tabular>
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
 * the band's own count; the chart has one line, not one stand-in per day.
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
 * The wait, in the loaded screen's own boxes: the range row, the hero's stack, the
 * nine-figure band, and the two cards under their own headers.
 *
 * The boxes are the screen's own styles — `rangeRow`, `amountBox`, `unitRail`,
 * `hero`, `heroMeta`, `metrics`,
 * `metric`, `chart`, `chartGridLine`, `chartSkeleton`, `product`, `productCopy` — composed
 * rather than restated, which is what keeps the wait and the page from disagreeing about
 * a padding or a gap: one number moved, both move. The section headings are the screen's
 * own copy — facts the read does not carry — so they are drawn real and only the figures
 * are grey, the way `./product-form`'s form skeleton draws its sections; `Skeleton`'s
 * `label` on the first line is the one announcement for the whole screen.
 *
 * The text heights are the one thing this block owns, and they go through
 * `./skeletons`' `line()` at the reader's `fontScale` — a height frozen at 100% metrics
 * is exact at 100% and short of the real screen at 200%, which is the one jump big
 * enough to see. The range row's box is `./button`'s own `sm`: the label's `heading`
 * line at the reader's scale, `space.sm` of vertical padding twice and the hairline
 * twice, over the `MIN_TOUCH_TARGET` floor — and the buttons' corner is the control's
 * `radius.sm`, not a pill.
 */
function AnalyticsSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	// The composer's own boxes, once: the amount box at its Field's height and
	// the four unit boxes beside it. `rangeButton` is `./button`'s own sum at
	// its `sm` size for the segments, and the amount box carries its label line
	// above it the way the real Field does.
	const rangeButton = Math.max(
		MIN_TOUCH_TARGET,
		HAIRLINE * 2 + space.sm * 2 + line("heading", fontScale).height,
	);

	// The wait's own column: the real screen spaces its blocks with each block's own
	// margin and no parent gap, and the grey column composes those same styles, so it
	// spaces itself the same way — a gap here would double every step.
	return (
		<View>
			<View style={styles.rangeRow}>
				<View style={styles.amountBox}>
					<Skeleton
						label={loadingLabel}
						style={[styles.skeletonMeta, line("label", fontScale)]}
					/>
					<Skeleton style={{ height: rangeButton }} />
				</View>
				<View style={styles.unitRail}>
					<Skeleton style={line("label", fontScale)} />
					<View style={styles.unitBoxes}>
						{UNITS.map((one) => (
							<Skeleton
								key={one}
								style={[styles.skeletonRangeButton, { height: rangeButton }]}
							/>
						))}
					</View>
				</View>
			</View>
			<View style={styles.hero}>
				<Skeleton style={[styles.skeletonLabel, line("label", fontScale)]} />
				<Skeleton style={[styles.skeletonFigure, line("display", fontScale)]} />
				<View style={styles.heroMeta}>
					<Skeleton style={[styles.skeletonMeta, line("caption", fontScale)]} />
					<Skeleton style={[styles.skeletonMeta, line("caption", fontScale)]} />
				</View>
			</View>
			<View style={styles.metrics}>
				{SKELETON_METRICS.map((metric) => (
					<View key={metric} style={styles.metric}>
						<Skeleton
							style={[styles.skeletonMeta, line("caption", fontScale)]}
						/>
						<Skeleton
							style={[styles.skeletonValue, line("heading", fontScale)]}
						/>
					</View>
				))}
			</View>
			<SectionHeader title={t("biz.analytics.revenueByDay")} />
			<Card>
				<RevenueChartSkeleton />
			</Card>
			<SectionHeader title={t("biz.insight.topProduct")} />
			<Card>
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
			</Card>
		</View>
	);
}

const styles = StyleSheet.create({
	skeletonRangeButton: { flex: 1, borderRadius: radius.sm },
	unitBoxes: { flexDirection: "row", gap: space.sm },
	skeletonLabel: { width: "40%" },
	skeletonFigure: { width: "60%" },
	skeletonMeta: { width: "35%" },
	skeletonValue: { width: "45%" },
	skeletonTitle: { width: "55%" },
	skeletonPrice: { width: "20%" },
	// The composer's own row: the amount box rides a quarter of the width and
	// the unit rail takes the rest, both at the foot of their labels.
	rangeRow: { flexDirection: "row", gap: space.md, marginBottom: space.lg },
	amountBox: { width: "25%" },
	unitRail: { flex: 1 },
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
		marginBottom: space.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	// The tile's anatomy is the console's `MetricCard`'s (`app/admin.tsx`): the muted
	// caption over the bold figure, at `space.sm` — one anatomy for every stat the app
	// draws, so a tile here reads like a card there.
	metric: { width: "33.333%", paddingVertical: space.md, gap: space.sm },
	chart: {
		height: CHART_HEIGHT,
		overflow: "hidden",
		position: "relative",
	},
	chartGridLine: {
		left: 0,
		right: 0,
		height: StyleSheet.hairlineWidth,
		position: "absolute",
	},
	chartLine: {
		borderRadius: CHART_LINE_WIDTH / 2,
		height: CHART_LINE_WIDTH,
		position: "absolute",
	},
	chartPointTarget: {
		alignItems: "center",
		bottom: 0,
		justifyContent: "center",
		position: "absolute",
		top: 0,
	},
	chartPoint: {
		borderRadius: CHART_POINT_SIZE / 2,
		height: CHART_POINT_SIZE,
		width: CHART_POINT_SIZE,
	},
	chartSkeleton: {
		borderRadius: CHART_LINE_WIDTH / 2,
		height: CHART_LINE_WIDTH,
		left: "8%",
		position: "absolute",
		right: "8%",
		top: CHART_HEIGHT * 0.45,
	},
	product: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: space.md,
		gap: space.md,
	},
	productCopy: { flex: 1, gap: TEXT_STACK_GAP },
});
