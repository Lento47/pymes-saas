import type { MessageKey, TranslateParams } from "@pymeshub/i18n";
import { effectivePlan, formatMoney, PLAN_LIMITS } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { formatDay } from "@/lib/format";
import { selection, success, warning } from "@/lib/haptics";
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
	const options = useQuery(
		trpc.subscription.options.queryOptions({ businessId }, { enabled }),
	);
	const cache = useQueryClient();
	const toast = useToast();
	const changePlan = useMutation(
		trpc.subscription.changePlan.mutationOptions({
			onSuccess: async () => {
				success();
				toast.show(t("biz.subscription.updated"));
				await cache.invalidateQueries({
					queryKey: trpc.subscription.current.pathKey(),
				});
				await cache.invalidateQueries({
					queryKey: trpc.subscription.options.pathKey(),
				});
			},
			onError: () => warning(),
		}),
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
	/**
	 * Limits follow the **effective** tier, not the paid one.
	 *
	 * A shop past due is held to the floor's numbers even while its record still names the
	 * tier it bought, and rendering the paid tier's limits would promise a catalogue the
	 * API already refuses — see `effectivePlan` and `checkCount`.
	 */
	const limits = current
		? PLAN_LIMITS[effectivePlan(current.plan, current.status)]
		: null;
	const limitRows: { key: string; label: string; value: string }[] = limits
		? [
				{
					key: "products",
					label: t("biz.subscription.limit.products"),
					value: String(limits.products),
				},
				{
					key: "staffAccounts",
					label: t("biz.subscription.limit.staffAccounts"),
					value: String(limits.staffAccounts),
				},
				{
					key: "locations",
					label: t("biz.subscription.limit.locations"),
					value: String(limits.locations),
				},
				{
					key: "promotions",
					label: t("biz.subscription.limit.promotions"),
					// Zero promotions is a capability refusal wearing a count's clothes: the
					// free tier does not sell "up to none", it does not offer the feature.
					value:
						limits.activePromotions === 0
							? t("biz.subscription.limit.notIncluded")
							: String(limits.activePromotions),
				},
				{
					key: "images",
					label: t("biz.subscription.limit.images"),
					value: String(limits.imagesPerProduct),
				},
				{
					key: "storage",
					label: t("biz.subscription.limit.storage"),
					value: storageValue(t, limits.storageBytes),
				},
				{
					key: "history",
					label: t("biz.subscription.limit.history"),
					value: historyValue(t, limits.analyticsDays),
				},
				{
					key: "inventory",
					label: t("biz.subscription.limit.inventory"),
					value: limits.inventoryTracking
						? t("biz.subscription.limit.included")
						: t("biz.subscription.limit.notIncluded"),
				},
				{
					key: "express",
					label: t("biz.subscription.limit.express"),
					// `Infinity` is the top tier's "not a constraint", written as a number.
					value:
						limits.expressPerWeek === Infinity
							? t("biz.subscription.limit.unlimited")
							: String(limits.expressPerWeek),
				},
			]
		: [];
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
								{current.cadence ? (
									<Text tone="muted">
										{t("biz.subscription.cadence")}:{" "}
										{t(`biz.subscription.cadence.${current.cadence}`)}
									</Text>
								) : null}
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
				{/* What the effective tier permits, said as a list rather than a table: the
				    limits are a function of the tier alone, so they read as one card about
				    one plan. Absent while `current` is null, which is the empty state above. */}
				{limitRows.length > 0 ? (
					<Card>
						<View style={styles.limits}>
							<Text bold>{t("biz.subscription.limit.title")}</Text>
							{limitRows.map((row) => (
								<View key={row.key} style={styles.limitRow}>
									<Text tone="muted">{row.label}</Text>
									<Text bold tabular>
										{row.value}
									</Text>
								</View>
							))}
						</View>
					</Card>
				) : null}

				{/* What is on offer, not what they hold. `options` is the book's
				    current list of tiers; `current` is which of those this merchant has.
				    One row is a marker for the tier they already hold; the rest are
				    targets a one-tap change to. */}
				{options.data && options.data.options.length > 0 ? (
					<Card>
						<View style={styles.limits}>
							<Text bold>{t("biz.subscription.plans")}</Text>
							{options.data.options.map((option) => {
								const key = `${option.plan}-${option.cadence ?? "free"}`;
								return option.isCurrent ? (
									<View key={key} style={styles.limitRow}>
										<View style={styles.copy}>
											<Text bold>
												{t(`biz.subscription.plan.${option.plan}`)}
											</Text>
											{option.cadence ? (
												<Text tone="muted">
													{t(`biz.subscription.cadence.${option.cadence}`)}
												</Text>
											) : null}
											<Text tone="muted">
												{option.isFree
													? t("biz.subscription.plan.FREE")
													: formatMoney(
															option.priceMinor,
															current?.currency ?? "CRC",
															{
																locale: intlLocale,
															},
														)}
											</Text>
										</View>
										<Text tone="muted">{t("biz.subscription.current")}</Text>
									</View>
								) : (
									<Pressable
										key={key}
										disabled={changePlan.isPending}
										onPress={() => {
											selection();
											changePlan.mutate({
												businessId,
												plan: option.plan,
												cadence: option.cadence,
											});
										}}
										style={styles.limitRow}
									>
										<View style={styles.copy}>
											<Text bold>
												{t(`biz.subscription.plan.${option.plan}`)}
											</Text>
											{option.cadence ? (
												<Text tone="muted">
													{t(`biz.subscription.cadence.${option.cadence}`)}
												</Text>
											) : null}
											<Text tone="muted">
												{option.isFree
													? t("biz.subscription.plan.FREE")
													: formatMoney(
															option.priceMinor,
															current?.currency ?? "CRC",
															{
																locale: intlLocale,
															},
														)}
											</Text>
										</View>
										<Text tone="action">{t("biz.subscription.change")}</Text>
									</Pressable>
								);
							})}
						</View>
					</Card>
				) : null}
			</View>
		</Screen>
	);
}

/**
 * Storage in the units a merchant reasons in — gigabytes once there is at least one,
 * megabytes below. `600 MB` and `10 GB`, never `614400 KB`.
 */
function storageValue(
	t: (key: MessageKey, params?: TranslateParams) => string,
	bytes: number,
): string {
	const gigabytes = bytes / (1024 * 1024 * 1024);
	if (gigabytes >= 1) {
		return t("biz.subscription.limit.gigabytes", {
			value: Math.round(gigabytes * 10) / 10,
		});
	}
	return t("biz.subscription.limit.megabytes", {
		value: Math.round(bytes / (1024 * 1024)),
	});
}

/**
 * A history window as the coarsest unit that divides it exactly — `2 años` for 730 days
 * and `30 días` for 30, so a merchant reads a duration rather than doing the arithmetic.
 */
function historyValue(
	t: (key: MessageKey, params?: TranslateParams) => string,
	days: number,
): string {
	if (days % 365 === 0) {
		return t("biz.subscription.limit.years", { count: days / 365 });
	}
	return t("biz.subscription.limit.days", { count: days });
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
	limits: { gap: TEXT_STACK_GAP },
	limitRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
	},
});
