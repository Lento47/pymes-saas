import type { AuditLogEntry } from "@pymeshub/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListEnd } from "@/components/list-end";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { formatStamp } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

const PAGE_SIZE = 20;

export default function AuditHistoryScreen() {
	const trpc = useTRPC();
	const { t } = useT();
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
	const failed = shops.error ?? query.error;
	const waiting =
		shops.isPending || (enabled && query.isPending && !query.data);

	if (failed) {
		return (
			<Screen title={t("biz.more.auditHistory")}>
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
		<Screen title={t("biz.more.auditHistory")} scroll bottomInset>
			{waiting ? (
				<AuditHistorySkeleton />
			) : entries.length === 0 ? (
				<EmptyState
					icon="time-outline"
					title={t("biz.more.auditHistory")}
					body={t("biz.auditHistory.emptyState")}
				/>
			) : (
				entries.map((entry) => <AuditEntryCard key={entry.id} entry={entry} />)
			)}
			<ListEnd
				rows={entries.length}
				hasNextPage={query.hasNextPage}
				loading={query.isFetchingNextPage}
				onPress={() => void query.fetchNextPage()}
			/>
		</Screen>
	);
}

function AuditEntryCard({ entry }: { entry: AuditLogEntry }) {
	const { t, intlLocale } = useT();

	return (
		<Card style={styles.card}>
			<View style={styles.heading}>
				<View style={styles.headingText}>
					<Text variant="label" tone="muted">
						{t("biz.auditHistory.action")}
					</Text>
					<Text bold>{displayValue(entry.action, "—")}</Text>
				</View>
				<Text variant="caption" tone="muted" style={styles.timestamp}>
					{t("biz.auditHistory.timestamp")}:{" "}
					{formatStamp(entry.createdAt, intlLocale)}
				</Text>
			</View>
			<AuditDetail
				label={t("biz.auditHistory.actor")}
				value={displayValue(entry.actorName, "—")}
				secondary={entry.actorId}
			/>
			<AuditDetail
				label={t("biz.auditHistory.targetType")}
				value={displayValue(entry.targetType, "—")}
			/>
			<AuditDetail
				label={t("biz.auditHistory.targetId")}
				value={displayValue(entry.targetId, "—")}
			/>
			<AuditDetail
				label={t("biz.auditHistory.before")}
				value={displayValue(entry.before, t("biz.auditHistory.before"))}
			/>
			<AuditDetail
				label={t("biz.auditHistory.after")}
				value={displayValue(entry.after, t("biz.auditHistory.after"))}
			/>
			<AuditDetail
				label={t("biz.auditHistory.reason")}
				value={displayValue(entry.reason, "—")}
			/>
		</Card>
	);
}

function AuditDetail({
	label,
	value,
	secondary,
}: {
	label: string;
	value: string;
	secondary?: string;
}) {
	return (
		<View style={styles.detail}>
			<Text variant="label" tone="muted">
				{label}
			</Text>
			<Text>{value}</Text>
			{secondary ? (
				<Text variant="caption" tone="muted">
					{secondary}
				</Text>
			) : null}
		</View>
	);
}

function displayValue(value: unknown, unavailable: string): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "string") return value;

	try {
		return JSON.stringify(value) ?? unavailable;
	} catch {
		return unavailable;
	}
}

function AuditHistorySkeleton() {
	return (
		<View style={styles.skeletonList}>
			{[0, 1, 2].map((index) => (
				<Card key={index} style={styles.card}>
					<Skeleton style={styles.skeletonTitle} />
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLineShort} />
				</Card>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	card: { marginBottom: space.md, gap: space.sm },
	skeletonList: { gap: space.md },
	skeletonTitle: { width: "58%", height: 22, marginBottom: space.sm },
	skeletonLine: { height: 16, marginBottom: space.sm },
	skeletonLineShort: { width: "72%", height: 16 },
	heading: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: space.md,
	},
	headingText: { flex: 1, gap: space.xs },
	timestamp: { textAlign: "right" },
	detail: { gap: space.xs },
});
