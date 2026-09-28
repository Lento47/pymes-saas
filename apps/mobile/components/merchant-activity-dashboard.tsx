import Ionicons from "@expo/vector-icons/Ionicons";
import {
	formatMoney,
	marketDayKey,
	type OrderStatus,
	type OrderSummary,
} from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import type { ManagementScope } from "@/components/merchant-management-frame";
import { SectionHeader } from "@/components/section-header";
import { Sheet } from "@/components/sheet";
import { Skeleton } from "@/components/skeleton";
import {
	StatusBadge,
	statusForeground,
	statusKey,
} from "@/components/status-badge";
import { Text } from "@/components/text";
import { formatDay, formatMarketDayMonth } from "@/lib/format";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

const ACTIVITY_LIMITS = [10, 20, 50] as const;
type ActivityLimit = (typeof ACTIVITY_LIMITS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_DAYS = 7;
const STATUS_ORDER: readonly OrderStatus[] = [
	"PENDING",
	"ACCEPTED",
	"PREPARING",
	"READY",
	"OUT_FOR_DELIVERY",
	"COMPLETED",
	"CANCELLED",
	"REJECTED",
];
const OPEN_STATUSES = new Set<OrderStatus>([
	"PENDING",
	"ACCEPTED",
	"PREPARING",
	"READY",
	"OUT_FOR_DELIVERY",
]);

/**
 * Bitácora is a small operating dashboard, not a second order board.
 *
 * The order read stays the source of truth. The figures describe the rows currently in
 * view, the seven-day bars show their shape, and the feed keeps the order itself one tap
 * away. Nothing here invents a settlement, an audit event, or a status the API did not
 * return.
 */
export function ActivityDashboard({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const { colors } = useTheme();
	const { t, tp, intlLocale } = useT();
	const [limit, setLimit] = useState<ActivityLimit>(20);
	const [rangeOpen, setRangeOpen] = useState(false);

	const orders = useQuery(
		trpc.orders.list.queryOptions(
			{
				role: "BUSINESS",
				businessId: scope.businessId,
				activeOnly: false,
				limit,
				...(scope.locationId ? { locationId: scope.locationId } : {}),
			},
			{ enabled: !!scope.businessId },
		),
	);
	const settings = useQuery(
		trpc.business.settings.queryOptions({ businessId: scope.businessId }),
	);

	if (orders.error) {
		return (
			<ActivityError
				onRetry={() => {
					void orders.refetch();
					void settings.refetch();
				}}
			/>
		);
	}
	if (orders.isPending || settings.isPending) {
		return <ActivitySkeleton loadingLabel={t("state.loading")} />;
	}

	const rows = orders.data?.items ?? [];
	const currency = settings.data?.currency ?? rows[0]?.currency;
	const totalMinor = rows
		.filter((order) => order.currency === currency)
		.reduce((sum, order) => sum + order.totalMinor, 0);
	const completed = rows.filter((order) => order.status === "COMPLETED").length;
	const open = rows.filter((order) => OPEN_STATUSES.has(order.status)).length;
	const attention = rows.filter((order) => order.status === "PENDING").length;
	const average = rows.length > 0 ? Math.round(totalMinor / rows.length) : null;
	const money = (value: number | null): string =>
		currency && value !== null
			? formatMoney(value, currency, { locale: intlLocale })
			: "—";
	const groups = groupOrders(rows);
	const chart = chartDays(rows);
	const statusCounts = STATUS_ORDER.map((status) => ({
		status,
		count: rows.filter((order) => order.status === status).length,
	})).filter((entry) => entry.count > 0);

	const metrics = [
		{ label: t("biz.manage.activityVolume"), value: money(totalMinor) },
		{ label: t("biz.manage.activityAverage"), value: money(average) },
		{ label: t("biz.manage.activityOpen"), value: String(open) },
		{
			label: t("biz.manage.activityCompleted"),
			value: String(completed),
		},
	];

	return (
		<>
			<View style={styles.dashboard}>
				<Button
					label={tp("biz.manage.activityWindow", limit)}
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

				<View style={[styles.hero, { backgroundColor: colors.foreground }]}>
					<Text
						variant="caption"
						bold
						style={{ color: colors.background, letterSpacing: 0.3 }}
					>
						{t("biz.manage.activityOrders")}
					</Text>
					<Text
						variant="display"
						bold
						tabular
						style={{ color: colors.background }}
					>
						{rows.length}
					</Text>
					<Text
						variant="caption"
						style={{ color: colors.background, opacity: 0.7 }}
					>
						{tp("biz.manage.activityWindow", limit)}
					</Text>
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
					{metrics.map((metric, index) => (
						<ActivityMetric
							key={metric.label}
							label={metric.label}
							value={metric.value}
							column={index % 2}
							row={Math.floor(index / 2)}
							borderColor={colors.border}
						/>
					))}
				</View>

				<View style={styles.section}>
					<SectionHeader
						title={t("biz.manage.activityStatus")}
						style={styles.sectionToContent}
					/>
					<View style={styles.statusPanel}>
						<View style={styles.statusSummary}>
							<Text variant="display" bold tabular>
								{open}
							</Text>
							<Text variant="label" tone="muted">
								{t("biz.manage.activityOpen")}
							</Text>
							{attention > 0 ? (
								<View
									style={[
										styles.attentionPill,
										{ backgroundColor: colors.warning },
									]}
								>
									<Text variant="caption" bold tone="inverse">
										{t("biz.manage.activityAttention")} · {attention}
									</Text>
								</View>
							) : null}
						</View>
						<View style={styles.statusBar}>
							{statusCounts.length > 0 ? (
								statusCounts.map((entry) => (
									<View
										key={entry.status}
										style={{
											backgroundColor: colors[statusForeground(entry.status)],
											flex: entry.count,
										}}
									/>
								))
							) : (
								<View style={{ backgroundColor: colors.border, flex: 1 }} />
							)}
						</View>
						<View style={styles.statusList}>
							{statusCounts.map((entry, index) => (
								<View
									key={entry.status}
									style={[
										styles.statusRow,
										index < statusCounts.length - 1 && {
											borderBottomWidth: StyleSheet.hairlineWidth,
											borderBottomColor: colors.border,
										},
									]}
								>
									<StatusBadge status={entry.status} size="dot" />
									<Text
										variant="heading"
										bold
										tabular
										style={styles.statusCount}
									>
										{entry.count}
									</Text>
									<Text variant="caption" tone="muted">
										{Math.round((entry.count / Math.max(rows.length, 1)) * 100)}
										%
									</Text>
								</View>
							))}
							{statusCounts.length === 0 ? (
								<Text variant="label" tone="muted" style={styles.noStatus}>
									{t("biz.manage.noActivity")}
								</Text>
							) : null}
						</View>
					</View>
				</View>

				<View style={styles.section}>
					<SectionHeader
						title={t("biz.manage.activityByDay")}
						style={styles.sectionToContent}
					/>
					<ActivityChart
						days={chart}
						intlLocale={intlLocale}
						label={t("biz.manage.activityByDay")}
						emptyMessage={t("biz.manage.activityNoChart")}
					/>
				</View>

				<View style={styles.section}>
					<SectionHeader
						title={t("biz.manage.activityFeed")}
						action={{
							label: t("biz.manage.activityViewAll"),
							onPress: () => router.push("/business"),
						}}
						style={styles.sectionToContent}
					/>
					<View
						style={[
							styles.feed,
							{
								borderTopColor: colors.border,
								borderBottomColor: colors.border,
							},
						]}
					>
						{groups.length > 0 ? (
							groups.map((group) => (
								<View key={group.key} style={styles.feedGroup}>
									<View style={styles.dayHeader}>
										<Text variant="label" bold>
											{formatMarketDayMonth(group.date, intlLocale)}
										</Text>
										<Text variant="caption" tone="muted">
											{tp("biz.manage.activityItems", group.orders.length)}
										</Text>
									</View>
									{group.orders.map((order, index) => (
										<ActivityOrderRow
											key={order.id}
											order={order}
											divider={index < group.orders.length - 1}
											intlLocale={intlLocale}
											money={money(order.totalMinor)}
											dotColor={colors[statusForeground(order.status)]}
										/>
									))}
								</View>
							))
						) : (
							<View style={styles.emptyFeed}>
								<Text bold>{t("biz.manage.noActivity")}</Text>
								<Text variant="label" tone="muted">
									{t("biz.board.empty.body")}
								</Text>
							</View>
						)}
					</View>
				</View>
			</View>

			<Sheet
				open={rangeOpen}
				onClose={() => setRangeOpen(false)}
				title={t("biz.manage.activityWindowTitle")}
				closeLabel={t("action.close")}
				snapPoints={[1]}
			>
				<Card>
					{ACTIVITY_LIMITS.map((option, index) => {
						const selected = option === limit;
						return (
							<ListRow
								key={option}
								title={tp("biz.manage.activityWindow", option)}
								state={selected ? t("biz.new.selected") : undefined}
								divider={index < ACTIVITY_LIMITS.length - 1}
								onPress={() => {
									if (!selected) selection();
									setLimit(option);
									setRangeOpen(false);
								}}
							/>
						);
					})}
				</Card>
			</Sheet>
		</>
	);
}

function ActivityMetric({
	label,
	value,
	column,
	row,
	borderColor,
}: {
	label: string;
	value: string;
	column: number;
	row: number;
	borderColor: string;
}) {
	return (
		<View
			style={[
				styles.metric,
				column > 0 && styles.metricIndented,
				column < 1 && {
					borderRightWidth: StyleSheet.hairlineWidth,
					borderRightColor: borderColor,
				},
				row < 1 && {
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: borderColor,
				},
			]}
		>
			<Text variant="caption" tone="muted">
				{label}
			</Text>
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

function ActivityChart({
	days,
	intlLocale,
	label,
	emptyMessage,
}: {
	days: { key: string; date: Date; count: number }[];
	intlLocale: string;
	label: string;
	emptyMessage: string;
}) {
	const { colors } = useTheme();
	const peak = Math.max(1, ...days.map((day) => day.count));
	return (
		<View
			style={styles.chart}
			accessible
			accessibilityRole="image"
			accessibilityLabel={label}
		>
			<View style={styles.chartPlot}>
				{[0, 0.5, 1].map((ratio) => (
					<View
						key={ratio}
						style={[
							styles.chartGrid,
							ratio === 1 ? { bottom: 0 } : { top: `${ratio * 100}%` },
							{ backgroundColor: colors.border },
						]}
					/>
				))}
				<View style={styles.chartBars}>
					{days.map((day) => (
						<View key={day.key} style={styles.chartColumn}>
							<View
								style={[
									styles.chartBar,
									{
										height:
											day.count > 0
												? `${Math.max(4, Math.round((day.count / peak) * 100))}%`
												: "0%",
										backgroundColor:
											day.count > 0 ? colors.foreground : "transparent",
									},
								]}
							/>
						</View>
					))}
				</View>
				{days.every((day) => day.count === 0) ? (
					<View style={styles.chartEmpty}>
						<Text variant="label" tone="muted">
							{emptyMessage}
						</Text>
					</View>
				) : null}
			</View>
			<View style={styles.chartLabels}>
				{days.map((day) => (
					<View key={day.key} style={styles.chartLabelSlot}>
						<Text variant="caption" tone="muted">
							{formatMarketDayMonth(day.date, intlLocale)}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}

function ActivityOrderRow({
	order,
	divider,
	intlLocale,
	money,
	dotColor,
}: {
	order: OrderSummary;
	divider: boolean;
	intlLocale: string;
	money: string;
	dotColor: string;
}) {
	const { t } = useT();
	return (
		<ListRow
			title={t("biz.order.title", { reference: order.reference })}
			subtitle={`${order.headline} · ${formatDay(order.placedAt, intlLocale)}`}
			state={t(statusKey(order.status))}
			trailing={
				<View style={styles.orderTrailing}>
					<View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
					<Text variant="label" bold tabular>
						{money}
					</Text>
				</View>
			}
			divider={divider}
			chevron
			onPress={() =>
				router.push({
					pathname: "/merchant-order/[id]",
					params: { id: order.id },
				})
			}
		/>
	);
}

function groupOrders(orders: OrderSummary[]) {
	const groups = new Map<string, OrderSummary[]>();
	for (const order of orders) {
		const key = marketDayKey(order.placedAt);
		const current = groups.get(key) ?? [];
		current.push(order);
		groups.set(key, current);
	}
	return [...groups.entries()].map(([key, rows]) => ({
		key,
		date: rows[0]?.placedAt ?? new Date(),
		orders: rows,
	}));
}

function chartDays(orders: OrderSummary[]) {
	const now = new Date();
	return Array.from({ length: CHART_DAYS }, (_, index) => {
		const date = new Date(now.getTime() - (CHART_DAYS - index - 1) * DAY_MS);
		const key = marketDayKey(date);
		return {
			key,
			date,
			count: orders.filter((order) => marketDayKey(order.placedAt) === key)
				.length,
		};
	});
}

function ActivitySkeleton({ loadingLabel }: { loadingLabel: string }) {
	return (
		<View style={styles.dashboard}>
			<Skeleton label={loadingLabel} style={styles.skeletonButton} />
			<View style={styles.skeletonHero}>
				<Skeleton style={styles.skeletonLabel} />
				<Skeleton style={styles.skeletonNumber} />
			</View>
			<View style={styles.skeletonMetrics}>
				{["first", "second", "third", "fourth"].map((item) => (
					<Skeleton key={item} style={styles.skeletonMetric} />
				))}
			</View>
			<Skeleton style={styles.skeletonChart} />
			<Skeleton style={styles.skeletonFeed} />
		</View>
	);
}

function ActivityError({ onRetry }: { onRetry: () => void }) {
	const { t } = useT();
	return (
		<View style={styles.error}>
			<Text tone="destructive" bold accessibilityRole="alert">
				{t("biz.manage.errorTitle")}
			</Text>
			<Text variant="label" tone="muted">
				{t("biz.manage.errorBody")}
			</Text>
			<Button label={t("action.retry")} onPress={onRetry} variant="secondary" />
		</View>
	);
}

const styles = StyleSheet.create({
	dashboard: { gap: space.xxl },
	rangeButton: { alignSelf: "flex-start" },
	hero: {
		borderRadius: radius.md,
		padding: space.lg,
		gap: space.xs,
	},
	metrics: {
		flexDirection: "row",
		flexWrap: "wrap",
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	metric: {
		width: "50%",
		paddingVertical: space.sm,
		paddingRight: space.sm,
		gap: space.xs,
	},
	metricIndented: { paddingLeft: space.md },
	section: { gap: space.sm },
	sectionToContent: { marginBottom: 0 },
	statusPanel: { gap: space.md },
	statusSummary: {
		alignItems: "baseline",
		flexDirection: "row",
		gap: space.sm,
	},
	attentionPill: {
		borderRadius: radius.full,
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
		marginLeft: "auto",
	},
	statusBar: {
		height: 10,
		flexDirection: "row",
		borderRadius: radius.full,
		overflow: "hidden",
	},
	statusList: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	statusRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: space.sm,
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.sm,
	},
	statusCount: { marginLeft: "auto" },
	noStatus: { paddingVertical: space.md },
	chart: { gap: space.xs },
	chartPlot: { height: 150, position: "relative" },
	chartGrid: {
		left: 0,
		right: 0,
		height: StyleSheet.hairlineWidth,
		position: "absolute",
	},
	chartBars: {
		bottom: 0,
		flexDirection: "row",
		gap: space.sm,
		left: 0,
		position: "absolute",
		right: 0,
		top: 0,
	},
	chartColumn: { flex: 1, justifyContent: "flex-end" },
	chartBar: { borderRadius: 2, width: "100%" },
	chartEmpty: {
		alignItems: "center",
		justifyContent: "center",
		left: 0,
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 0,
	},
	chartLabels: { flexDirection: "row", gap: space.sm },
	chartLabelSlot: { flex: 1, alignItems: "center" },
	feed: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	feedGroup: { paddingTop: space.sm },
	dayHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: space.xs,
		paddingVertical: space.sm,
	},
	orderTrailing: { alignItems: "flex-end", gap: space.xs },
	timelineDot: { borderRadius: radius.full, height: 8, width: 8 },
	emptyFeed: { gap: TEXT_STACK_GAP, padding: space.lg },
	error: { gap: TEXT_STACK_GAP, paddingVertical: space.xl },
	skeletonButton: { height: MIN_TOUCH_TARGET, width: 150 },
	skeletonHero: { gap: space.sm, minHeight: 132, padding: space.lg },
	skeletonLabel: { width: "40%" },
	skeletonNumber: { height: 56, width: "35%" },
	skeletonMetrics: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
	skeletonMetric: { height: 54, width: "46%" },
	skeletonChart: { height: 150, width: "100%" },
	skeletonFeed: { height: 180, width: "100%" },
});
