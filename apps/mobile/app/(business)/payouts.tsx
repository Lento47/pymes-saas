import { formatMoney } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { formatDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space, TEXT_STACK_GAP } from "@/theme";

/**
 * A merchant's flat platform subscription.
 *
 * The route keeps its historical filename so installed deep links continue to open,
 * while its data comes from the subscription API that replaced settlement payouts.
 */
export default function SubscriptionScreen() {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop = (shops.data ?? []).find((one) => one.role !== "COURIER");
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const subscription = useQuery(
		trpc.subscription.current.queryOptions({ businessId }, { enabled }),
	);
	const waiting = useSkeletonHold(
		shops.isPending || (enabled && subscription.isPending),
	);
	const failed = shops.error ?? subscription.error;

	if (failed) {
		return (
			<Screen title={t("biz.subscription.title")}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void subscription.refetch();
					}}
				/>
			</Screen>
		);
	}

	if (waiting) {
		return (
			<Screen title={t("biz.subscription.title")}>
				<SubscriptionSkeleton loadingLabel={t("state.loading")} />
			</Screen>
		);
	}

	const current = subscription.data;
	return (
		<Screen
			title={t("biz.subscription.title")}
			subtitle={shop?.businessName}
			scroll
			bottomInset
		>
			<Text tone="muted">{t("biz.subscription.note")}</Text>
			<View style={styles.cards}>
				{current ? (
					<Card>
						<View style={styles.row}>
							<View style={styles.copy}>
								<Text bold>{t("biz.subscription.plan")}</Text>
								<Text>{t(`biz.subscription.plan.${current.plan}`)}</Text>
								<Text tone="muted">
									{t("biz.subscription.status")}:{" "}
									{t(`biz.subscription.status.${current.status}`)}
								</Text>
								{current.periodStart && current.periodEnd ? (
									<Text tone="muted">
										{t("biz.subscription.period", {
											from: formatDay(current.periodStart, intlLocale),
											to: formatDay(current.periodEnd, intlLocale),
										})}
									</Text>
								) : null}
								{current.lastPaidAt ? (
									<Text tone="muted">
										{t("biz.subscription.lastPaid", {
											date: formatDay(current.lastPaidAt, intlLocale),
										})}
									</Text>
								) : null}
							</View>
							{current.priceMinor !== null ? (
								<View style={styles.amount}>
									<Text tone="muted">{t("biz.subscription.price")}</Text>
									<Text bold tabular>
										{formatMoney(current.priceMinor, current.currency, {
											locale: intlLocale,
										})}
									</Text>
									{current.ivaMinor !== null ? (
										<Text tone="muted">
											{t("biz.subscription.iva", {
												amount: formatMoney(
													current.ivaMinor,
													current.currency,
													{
														locale: intlLocale,
													},
												),
											})}
										</Text>
									) : null}
								</View>
							) : null}
						</View>
					</Card>
				) : (
					<EmptyState
						title={t("biz.subscription.empty")}
						body={t("biz.subscription.empty.body")}
					/>
				)}
			</View>
		</Screen>
	);
}

function SubscriptionSkeleton({ loadingLabel }: { loadingLabel: string }) {
	return (
		<View style={styles.cards}>
			<Skeleton label={loadingLabel} style={styles.skeletonNote} />
			<Card>
				<View style={styles.row}>
					<View style={styles.copy}>
						<Skeleton style={styles.skeletonTitle} />
						<Skeleton style={styles.skeletonLine} />
						<Skeleton style={styles.skeletonLine} />
					</View>
					<Skeleton style={styles.skeletonAmount} />
				</View>
			</Card>
		</View>
	);
}

const styles = StyleSheet.create({
	skeletonNote: { width: "75%", height: 18 },
	skeletonTitle: { width: "55%", height: 18 },
	skeletonLine: { width: "65%", height: 18 },
	skeletonAmount: { width: "25%", height: 24 },
	cards: { gap: space.md, marginTop: space.lg },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	copy: { flex: 1, gap: TEXT_STACK_GAP },
	amount: { alignItems: "flex-end", gap: TEXT_STACK_GAP },
});
