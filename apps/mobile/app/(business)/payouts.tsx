import { formatMoney, roleCan } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { formatDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { space, TEXT_STACK_GAP } from "@/theme";

export default function PayoutsScreen() {
	const trpc = useTRPC();
	const { t, tp, intlLocale } = useT();
	const merchantScope = useMerchantScope();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop =
		(shops.data ?? []).find(
			(one) =>
				one.role !== "COURIER" && one.businessId === merchantScope.businessId,
		) ?? (shops.data ?? []).find((one) => one.role !== "COURIER");
	const businessId = shop?.businessId ?? "";
	const canRead = !!shop && roleCan(shop.role, "payouts:read");
	const enabled = !!businessId && canRead;
	const payouts = useQuery(
		trpc.payouts.list.queryOptions({ businessId }, { enabled }),
	);
	const waiting = useSkeletonHold(
		shops.isPending || (enabled && payouts.isPending),
	);
	const failed = shops.error ?? payouts.error;

	if (failed) {
		return (
			<Screen title={t("biz.payouts.title")}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void payouts.refetch();
					}}
				/>
			</Screen>
		);
	}

	if (waiting) {
		return (
			<Screen title={t("biz.payouts.title")}>
				<PayoutsSkeleton loadingLabel={t("state.loading")} />
			</Screen>
		);
	}

	if (!shop) {
		return (
			<Screen title={t("biz.payouts.title")}>
				<Text tone="muted">{t("state.empty")}</Text>
			</Screen>
		);
	}

	if (!canRead) {
		return (
			<Screen
				title={t("biz.payouts.title")}
				subtitle={shop.businessName}
				scroll
			>
				<EmptyState
					icon="wallet-outline"
					title={t("biz.permission.title")}
					body={t("biz.permission.body")}
				/>
			</Screen>
		);
	}

	return (
		<Screen
			title={t("biz.payouts.title")}
			subtitle={shop?.businessName}
			scroll
			bottomInset
		>
			<Text tone="muted">{t("biz.payouts.note")}</Text>
			<View style={styles.cards}>
				{payouts.data?.length ? (
					payouts.data.map((payout) => (
						<Card key={payout.id}>
							<View style={styles.row}>
								<View style={styles.copy}>
									<Text bold>
										{t("biz.payouts.period", {
											from: formatDay(payout.periodStart, intlLocale),
											to: formatDay(payout.periodEnd, intlLocale),
										})}
									</Text>
									<Text tone="muted">
										{tp("biz.payouts.orders", payout.orderCount)}
									</Text>
									<Text>{t(`biz.payouts.status.${payout.status}`)}</Text>
									{payout.paidAt ? (
										<Text tone="muted">
											{t("biz.payouts.paidAt", {
												date: formatDay(payout.paidAt, intlLocale),
											})}
										</Text>
									) : null}
									{payout.reference ? (
										<View style={styles.reference}>
											<Text tone="muted">{t("biz.payouts.reference")}</Text>
											<Text>{payout.reference}</Text>
										</View>
									) : null}
								</View>
								<Text bold tabular>
									{formatMoney(payout.amountMinor, payout.currency, {
										locale: intlLocale,
									})}
								</Text>
							</View>
						</Card>
					))
				) : (
					<EmptyState title={t("biz.payouts.empty")} />
				)}
			</View>
		</Screen>
	);
}

/** Three grey cards, named so a key never falls to array position. */
const SKELETON_PAYOUTS = ["first", "second", "third"] as const;

/**
 * The payouts' wait: the note line, then three payout cards.
 *
 * One card is the copy stack the loaded card draws — the period's line, the orders
 * count, the status and the paid-at line beside the amount's line — inside the `Card`'s
 * own padding and beside the amounts, composed rather than restated: the `row` and
 * `copy` boxes are this screen's own styles. Four lines is the common shape rather than
 * the floor — most payouts in the ledger carry their `paidAt` — and every text height
 * goes through `./skeletons`' `line()` at the reader's `fontScale`, because a height
 * frozen at 100% metrics is exact at 100% and short of the real card at 200% by the
 * growth of its own lines. `Skeleton`'s `label` on the note line is the one
 * announcement for the whole wait.
 */
function PayoutsSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View>
			<Skeleton
				label={loadingLabel}
				style={[styles.skeletonNote, line("body", fontScale)]}
			/>
			<View style={styles.cards}>
				{SKELETON_PAYOUTS.map((payout) => (
					<Card key={payout}>
						<View style={styles.row}>
							<View style={styles.copy}>
								<Skeleton
									style={[styles.skeletonTitle, line("body", fontScale)]}
								/>
								<Skeleton
									style={[styles.skeletonLine, line("body", fontScale)]}
								/>
								<Skeleton
									style={[styles.skeletonLine, line("body", fontScale)]}
								/>
								<Skeleton
									style={[styles.skeletonLine, line("body", fontScale)]}
								/>
							</View>
							<Skeleton
								style={[styles.skeletonAmount, line("body", fontScale)]}
							/>
						</View>
					</Card>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// Widths, not measures: the words they stand in for arrive with the read. The
	// heights come from `line()` in the component — a line height cannot live down
	// here.
	skeletonNote: { width: "75%" },
	skeletonTitle: { width: "55%" },
	skeletonLine: { width: "45%" },
	skeletonAmount: { width: "25%" },
	cards: { gap: space.md, marginTop: space.lg },
	// The amount sits centred against the copy it prices, the way every trailing money
	// in the app does (`./list-row`'s row, the analytics screen's product row both
	// centre) — `flex-start` would pin it to the first line of a copy stack that grows
	// at 200% text.
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	// The card's lines — period, orders count, status, paid-at — are one text stack, so
	// the gap inside it is `TEXT_STACK_GAP`, not a `space` step (`theme/tokens.ts`).
	copy: { flex: 1, gap: TEXT_STACK_GAP },
	reference: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
