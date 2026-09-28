import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useT } from "@/lib/i18n";
import { radius, space, TEXT_STACK_GAP, useTheme } from "@/theme";

import { Card } from "./card";
import { Text } from "./text";

type Tone = "neutral" | "positive" | "warning" | "destructive";

export function ManagementSection({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<View style={styles.section}>
			<View style={styles.sectionHeading}>
				<Text variant="heading" bold>
					{title}
				</Text>
				{action}
			</View>
			<Card>{children}</Card>
		</View>
	);
}

export function MetricGrid({
	metrics,
}: {
	metrics: { label: string; value: string; tone?: Tone }[];
}) {
	return (
		<View style={styles.metricGrid}>
			{metrics.map((metric) => (
				<View key={metric.label} style={styles.metric}>
					<Text variant="caption" tone="muted" bold>
						{metric.label}
					</Text>
					<Text
						variant="heading"
						bold
						tone={metric.tone === "destructive" ? "destructive" : undefined}
					>
						{metric.value}
					</Text>
				</View>
			))}
		</View>
	);
}

export function KeyValue({
	label,
	value,
	tone,
}: {
	label: string;
	value: ReactNode;
	tone?: Tone;
}) {
	return (
		<View style={styles.keyValue}>
			<Text variant="label" tone="muted">
				{label}
			</Text>
			<Text bold tone={tone === "destructive" ? "destructive" : undefined}>
				{value}
			</Text>
		</View>
	);
}

export function StatusChip({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: Tone;
}) {
	const { colors } = useTheme();
	const backgroundColor =
		tone === "positive"
			? colors.success
			: tone === "warning"
				? colors.warning
				: tone === "destructive"
					? colors.destructive
					: colors.muted;
	const foreground =
		tone === "neutral" ? colors.mutedForeground : colors.primaryForeground;
	return (
		<View style={[styles.status, { backgroundColor }]}>
			<Text
				variant="caption"
				bold
				tone={tone === "neutral" ? "muted" : "inverse"}
				style={{ color: foreground }}
			>
				{label}
			</Text>
		</View>
	);
}

export function TableHeader({ columns }: { columns: string[] }) {
	return (
		<View style={styles.tableHeader}>
			{columns.map((column) => (
				<Text
					key={column}
					variant="caption"
					tone="muted"
					bold
					style={styles.tableCell}
				>
					{column}
				</Text>
			))}
		</View>
	);
}

type TableCell = {
	key: string;
	content: ReactNode;
};

export function TableRow({
	cells,
	actions,
}: {
	cells: TableCell[];
	actions?: ReactNode;
}) {
	return (
		<View style={styles.tableRow}>
			{cells.map((cell) => (
				<View key={cell.key} style={styles.tableCell}>
					{cell.content}
				</View>
			))}
			{actions ? <View style={styles.tableActions}>{actions}</View> : null}
		</View>
	);
}

export function ManagementEmpty({
	title,
	body,
}: {
	title: string;
	body: string;
}) {
	return (
		<View style={styles.empty}>
			<Text bold>{title}</Text>
			<Text variant="label" tone="muted">
				{body}
			</Text>
		</View>
	);
}

export function ManagementError({ error }: { error: unknown }) {
	const { t } = useT();
	return (
		<View style={styles.empty}>
			<Text tone="destructive" bold accessibilityRole="alert">
				{t("biz.manage.errorTitle")}
			</Text>
			<Text variant="label" tone="muted">
				{error instanceof Error ? error.message : t("biz.manage.errorBody")}
			</Text>
		</View>
	);
}

export const managementRowStyle: ViewStyle = {
	borderTopWidth: StyleSheet.hairlineWidth,
};

const styles = StyleSheet.create({
	section: { marginTop: space.xl, gap: space.md },
	sectionHeading: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		gap: space.md,
	},
	metricGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.md,
		paddingVertical: space.sm,
	},
	metric: {
		flexBasis: "30%",
		flexGrow: 1,
		gap: space.xs,
	},
	keyValue: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		gap: space.md,
		paddingVertical: space.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	status: {
		alignSelf: "flex-start",
		borderRadius: radius.full,
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
	},
	tableHeader: {
		flexDirection: "row",
		gap: space.sm,
		paddingBottom: space.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	tableRow: {
		alignItems: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.sm,
		paddingVertical: space.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	tableCell: { flexBasis: 120, flexGrow: 1, flexShrink: 1 },
	tableActions: { flexDirection: "row", gap: space.xs, marginLeft: "auto" },
	empty: {
		alignItems: "flex-start",
		gap: TEXT_STACK_GAP,
		paddingVertical: space.lg,
	},
});
