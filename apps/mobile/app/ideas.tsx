import Ionicons from "@expo/vector-icons/Ionicons";
import type { Idea } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, space, TEXT_STACK_GAP, useTheme } from "@/theme";

/**
 * The submitter's own ideas.
 *
 * There is no thread and no public board. The list is this person's rows, and
 * sending a new one is the only write. Closing is the operator's, on the console.
 *
 * The description lives under the row, not in it. A 2000-character body as a
 * subtitle would turn every line into the essay, so tapping one idea opens a
 * slice and closes any other — the same accordion the audit log uses.
 */
export default function Ideas() {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const { status: sessionStatus } = useSession();
	const signedIn = sessionStatus === "signed-in";
	const [openId, setOpenId] = useState<string | null>(null);

	const mine = useQuery(
		trpc.idea.listMine.queryOptions({ limit: 50 }, { enabled: signedIn }),
	);
	const waiting = useSkeletonHold(
		sessionStatus === "loading" || (signedIn && mine.isPending),
	);
	const rows = waiting || mine.isError ? [] : (mine.data?.rows ?? []);

	return (
		<View style={{ flex: 1 }}>
			<Screen
				title={t("ideas.title")}
				leading={<BackButton to="/account" />}
				scroll
			>
				{!signedIn ? (
					<EmptyState
						icon="person-outline"
						title={t("auth.signIn.title")}
						body={t("auth.signIn.subtitle")}
						actionLabel={t("action.signIn")}
						onAction={() => router.push("/sign-in")}
					/>
				) : mine.isError ? (
					<ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
				) : waiting ? (
					<Skeleton />
				) : rows.length === 0 ? (
					<EmptyState
						icon="bulb-outline"
						title={t("ideas.empty.title")}
						body={t("ideas.empty.body")}
					/>
				) : (
					<Card>
						{rows.map((row, index) => {
							const expanded = openId === row.id;
							const last = index === rows.length - 1;
							const when = formatRelative(row.createdAt, intlLocale);
							return (
								<View key={row.id}>
									<ListRow
										title={row.subject}
										subtitle={when ?? undefined}
										state={
											row.status === "CLOSED"
												? t("ideas.status.CLOSED")
												: t("ideas.status.OPEN")
										}
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
										accessibilityHint={
											expanded
												? t("ideas.rowHint.hide")
												: t("ideas.rowHint.show")
										}
										onPress={() => {
											selection();
											setOpenId((current) =>
												current === row.id ? null : row.id,
											);
										}}
									/>
									{expanded ? (
										<IdeaBodySlice
											idea={row}
											last={last}
											borderColor={colors.border}
										/>
									) : null}
								</View>
							);
						})}
					</Card>
				)}
			</Screen>
			{signedIn && !mine.isError ? (
				<ActionBar
					docked
					primary={{
						label: t("ideas.new"),
						onPress: () => router.push("/ideas/new"),
					}}
				/>
			) : null}
		</View>
	);
}

function IdeaBodySlice({
	idea,
	last,
	borderColor,
}: {
	idea: Idea;
	last: boolean;
	borderColor: string;
}) {
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
			<Text selectable>{idea.body}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	slice: {
		paddingBottom: space.md,
		gap: TEXT_STACK_GAP,
	},
});
