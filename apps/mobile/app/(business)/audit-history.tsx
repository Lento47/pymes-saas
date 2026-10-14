import Ionicons from "@expo/vector-icons/Ionicons";
import type { AuditLogEntry } from "@pymeshub/shared";
import { marketDayKey } from "@pymeshub/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListEnd } from "@/components/list-end";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import {
	auditActionKey,
	auditTargetKey,
	formatAuditValue,
	groupAuditEntriesByDay,
	prettifyAuditToken,
} from "@/lib/audit-history";
import { formatClock, formatDay, formatStamp } from "@/lib/format";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

const PAGE_SIZE = 20;

/**
 * The shop's audit trail as an operator log.
 *
 * The read is still `business.auditHistory`. The surface is a dashboard of that payload:
 * a two-cell strip of `total` and the newest stamp, then a hairline feed grouped by Costa
 * Rica day. Tapping a row opens a slice under it — target id, and before/after/reason when
 * the payload has them — so the log never leaves the list.
 */
export default function AuditHistoryScreen() {
	const trpc = useTRPC();
	const { t, tp, intlLocale } = useT();
	const { colors } = useTheme();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop = (shops.data ?? []).find((one) => one.role !== "COURIER");
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const query = useInfiniteQuery(
		trpc.business.auditHistory.infiniteQueryOptions(
			{ businessId, offset: 0, limit: PAGE_SIZE },
			{
				enabled,
				getNextPageParam: (lastPage, pages) => {
					const nextOffset = pages.reduce(
						(total, page) => total + page.rows.length,
						0,
					);
					return nextOffset < lastPage.total ? nextOffset : undefined;
				},
			},
		),
	);
	const entries = query.data?.pages.flatMap((page) => page.rows) ?? [];
	const total = query.data?.pages[0]?.total ?? entries.length;
	const waiting = useSkeletonHold(
		shops.isPending || (enabled && query.isPending && !query.data),
	);
	const failed = shops.error ?? query.error;
	const [openId, setOpenId] = useState<string | null>(null);
	const groups = useMemo(() => groupAuditEntriesByDay(entries), [entries]);
	const todayKey = marketDayKey(new Date());
	const newest = entries[0]?.createdAt;

	const actionTitle = (action: string): string => {
		const key = auditActionKey(action);
		return key ? t(key) : prettifyAuditToken(action);
	};
	const targetLabel = (targetType: string): string => {
		const key = auditTargetKey(targetType);
		return key ? t(key) : prettifyAuditToken(targetType);
	};
	const actorName = (entry: AuditLogEntry): string =>
		entry.actorName?.trim() || t("biz.auditHistory.actorUnknown");

	if (failed) {
		return (
			<Screen
				title={t("biz.more.auditHistory")}
				leading={<BackButton to="/(business)/menu" />}
			>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void query.refetch();
					}}
				/>
			</Screen>
		);
	}

	return (
		<Screen
			title={t("biz.more.auditHistory")}
			leading={<BackButton to="/(business)/menu" />}
			scroll
			bottomInset
		>
			{waiting ? (
				<AuditHistorySkeleton />
			) : entries.length === 0 ? (
				<EmptyState
					icon="time-outline"
					title={t("biz.more.auditHistory")}
					body={t("biz.auditHistory.emptyState")}
				/>
			) : (
				<>
					<StatRow
						cells={[
							{
								key: "events",
								label: t("biz.auditHistory.changes"),
								value: String(total),
								accessibilityLabel: tp("biz.auditHistory.events", total),
							},
							{
								key: "latest",
								label: t("biz.auditHistory.latest"),
								value: newest ? formatStamp(newest, intlLocale) : "—",
							},
						]}
						borderColor={colors.border}
					/>
					{groups.map((group, groupIndex) => (
						<View
							key={group.key}
							style={groupIndex > 0 ? styles.dayGroup : undefined}
						>
							<SectionHeader
								title={
									group.key === todayKey
										? t("biz.dashboard.today")
										: formatDay(group.date, intlLocale)
								}
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
								{group.entries.map((entry, index) => {
									const expanded = openId === entry.id;
									const last = index === group.entries.length - 1;
									return (
										<View key={entry.id}>
											<ListRow
												title={actionTitle(entry.action)}
												subtitle={`${actorName(entry)} · ${formatClock(entry.createdAt, intlLocale)}`}
												state={targetLabel(entry.targetType)}
												chevron={false}
												trailing={
													<Ionicons
														name={expanded ? "chevron-up" : "chevron-down"}
														size={icon.control}
														color={colors.mutedForeground}
														accessibilityElementsHidden
														importantForAccessibility="no"
													/>
												}
												divider={!expanded && !last}
												accessibilityHint={t("biz.auditHistory.rowHint")}
												onPress={() => {
													selection();
													setOpenId((current) =>
														current === entry.id ? null : entry.id,
													);
												}}
											/>
											{expanded ? (
												<AuditDetailSlice
													entry={entry}
													last={last}
													borderColor={colors.border}
												/>
											) : null}
										</View>
									);
								})}
							</View>
						</View>
					))}
				</>
			)}
			<ListEnd
				rows={entries.length}
				hasNextPage={query.hasNextPage}
				loading={query.isFetchingNextPage}
				onPress={() => void query.fetchNextPage()}
				style={styles.listEnd}
			/>
		</Screen>
	);
}

function AuditDetailSlice({
	entry,
	last,
	borderColor,
}: {
	entry: AuditLogEntry;
	last: boolean;
	borderColor: string;
}) {
	const { t } = useT();
	const before = formatAuditValue(entry.before);
	const after = formatAuditValue(entry.after);
	const reason = formatAuditValue(entry.reason);
	const fields: { label: string; value: string }[] = [
		{ label: t("biz.auditHistory.targetId"), value: entry.targetId },
	];
	if (before) {
		fields.push({ label: t("biz.auditHistory.before"), value: before });
	}
	if (after) {
		fields.push({ label: t("biz.auditHistory.after"), value: after });
	}
	if (reason) {
		fields.push({ label: t("biz.auditHistory.reason"), value: reason });
	}

	return (
		<View
			style={[
				styles.slice,
				{
					borderBottomColor: borderColor,
					borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
				},
			]}
		>
			{fields.map((field) => (
				<View key={field.label} style={styles.detailField}>
					<Text variant="label" tone="muted">
						{field.label}
					</Text>
					<Text selectable>{field.value}</Text>
				</View>
			))}
		</View>
	);
}

function StatRow({
	cells,
	borderColor,
}: {
	cells: {
		key: string;
		label: string;
		value: string;
		accessibilityLabel?: string;
	}[];
	borderColor: string;
}) {
	return (
		<View
			style={[
				styles.statRow,
				{ borderTopColor: borderColor, borderBottomColor: borderColor },
			]}
		>
			{cells.map((cell, index) => (
				<View
					key={cell.key}
					accessible
					accessibilityLabel={
						cell.accessibilityLabel ?? `${cell.label}, ${cell.value}`
					}
					style={[
						styles.metric,
						index > 0 && styles.metricIndented,
						index < cells.length - 1
							? {
									borderRightWidth: StyleSheet.hairlineWidth,
									borderRightColor: borderColor,
								}
							: null,
					]}
				>
					<Text variant="caption" tone="muted">
						{cell.label}
					</Text>
					<Text
						variant="heading"
						bold
						tabular
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.75}
					>
						{cell.value}
					</Text>
				</View>
			))}
		</View>
	);
}

function AuditHistorySkeleton() {
	const { t } = useT();
	const { colors } = useTheme();
	const { fontScale } = useWindowDimensions();

	return (
		<View>
			<View
				style={[
					styles.statRow,
					{
						borderTopColor: colors.border,
						borderBottomColor: colors.border,
					},
				]}
			>
				{["events", "latest"].map((cell, index) => (
					<View
						key={cell}
						style={[
							styles.metric,
							index > 0 && styles.metricIndented,
							index < 1
								? {
										borderRightWidth: StyleSheet.hairlineWidth,
										borderRightColor: colors.border,
									}
								: null,
						]}
					>
						<Skeleton
							label={index === 0 ? t("state.loading") : undefined}
							style={[styles.skeletonMeta, line("caption", fontScale)]}
						/>
						<Skeleton
							style={[styles.skeletonValue, line("heading", fontScale)]}
						/>
					</View>
				))}
			</View>
			<View style={styles.skeletonHeading}>
				<Skeleton style={line("heading", fontScale)} />
			</View>
			<View
				style={[
					styles.feed,
					{
						borderTopColor: colors.border,
						borderBottomColor: colors.border,
					},
				]}
			>
				{[0, 1, 2, 3, 4].map((index) => (
					<View
						key={index}
						style={[
							styles.skeletonRow,
							{
								borderBottomColor: colors.border,
								borderBottomWidth: index < 4 ? StyleSheet.hairlineWidth : 0,
							},
						]}
					>
						<View style={styles.skeletonRowCopy}>
							<Skeleton
								style={[styles.skeletonTitle, line("body", fontScale)]}
							/>
							<Skeleton
								style={[styles.skeletonMeta, line("label", fontScale)]}
							/>
						</View>
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	statRow: {
		flexDirection: "row",
		marginBottom: space.xxl,
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
	sectionToContent: { marginBottom: space.sm },
	dayGroup: { marginTop: space.xxl },
	feed: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	listEnd: { paddingHorizontal: 0 },
	slice: {
		paddingBottom: space.md,
		gap: space.sm,
	},
	detailField: { gap: TEXT_STACK_GAP },
	skeletonHeading: { marginBottom: space.sm, width: "28%" },
	skeletonRow: {
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.md,
		justifyContent: "center",
	},
	skeletonRowCopy: { gap: TEXT_STACK_GAP, flex: 1 },
	skeletonTitle: { width: "62%" },
	skeletonMeta: { width: "40%" },
	skeletonValue: { width: "55%" },
});
