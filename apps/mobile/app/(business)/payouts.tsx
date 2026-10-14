import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import {
	type Cadence,
	type Currency,
	formatMoney,
	PLAN_LIMITS,
	type Plan,
	type PlanOption,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { formatDay } from "@/lib/format";
import { selection, success, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import {
	optionForPlan,
	PLAN_CARD_HEADER,
	planFeatureRows,
	plansOnOffer,
	planTaglineKey,
} from "@/lib/payouts";
import { useTRPC } from "@/lib/trpc/context";
import { icon, radius, shadow, space, TEXT_STACK_GAP, useTheme } from "@/theme";

const SINPE_REFERENCE_MIN = 4;
const SINPE_REFERENCE_MAX = 80;

/**
 * A merchant's flat platform subscription.
 *
 * The route keeps its historical filename so installed deep links continue to open,
 * while its data comes from the subscription API that replaced settlement payouts.
 *
 * The catalogue is a stack of plan cards in the shape of OpenAI's business pricing
 * page: a colored header panel, the price, a CTA, then the tier's limits. Cadence is
 * a segment above the stack so each card is one tier, not a plan×period list.
 */
export default function SubscriptionScreen() {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const scope = useMerchantScope();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const owned = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		owned.find((one) => one.businessId === scope.businessId) ?? owned[0];
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
	const insets = useSafeAreaInsets();
	const [picked, setPicked] = useState<PlanOption | null>(null);
	const [reference, setReference] = useState("");
	const [referenceError, setReferenceError] = useState<string | undefined>();
	const [cadence, setCadence] = useState<Cadence>("MONTHLY");
	const cadenceSeeded = useRef(false);
	const changePlan = useMutation(
		trpc.subscription.changePlan.mutationOptions({
			onSuccess: async () => {
				success();
				setPicked(null);
				setReference("");
				setReferenceError(undefined);
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
	const payFailure = useApiFailure(changePlan.error);
	const waiting = useSkeletonHold(
		shops.isPending || (enabled && subscription.isPending),
	);
	const failed = shops.error ?? subscription.error;
	const current = subscription.data;

	useEffect(() => {
		if (cadenceSeeded.current) return;
		if (!current?.cadence) return;
		setCadence(current.cadence);
		cadenceSeeded.current = true;
	}, [current?.cadence]);

	const openOption = (option: PlanOption) => {
		selection();
		setReference("");
		setReferenceError(undefined);
		setPicked(option);
	};

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

	const offered = options.data ? plansOnOffer(options.data.options) : [];
	const currency = current?.currency ?? "CRC";

	return (
		<>
			<Screen
				title={t("biz.subscription.title")}
				subtitle={shop?.businessName}
				scroll
				bottomInset
			>
				<Text tone="muted">{t("biz.subscription.note")}</Text>
				{current ? (
					<View style={styles.status}>
						<Text bold>
							{t(`biz.subscription.plan.${current.plan}` as MessageKey)}
						</Text>
						<Text tone="muted">
							{t(`biz.subscription.status.${current.status}` as MessageKey)}
							{current.cadence
								? ` · ${t(`biz.subscription.cadence.${current.cadence}` as MessageKey)}`
								: ""}
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
				) : (
					<EmptyState
						title={t("biz.subscription.empty")}
						body={t("biz.subscription.empty.body")}
					/>
				)}
				<View style={styles.cadence}>
					<Segmented
						label={t("biz.subscription.cadence")}
						value={cadence}
						onChange={(value) => setCadence(value as Cadence)}
						options={[
							{
								value: "MONTHLY",
								label: t("biz.subscription.cadence.MONTHLY"),
							},
							{
								value: "YEARLY",
								label: t("biz.subscription.cadence.YEARLY"),
							},
						]}
					/>
				</View>
				<View style={styles.cards}>
					{offered.map((plan) => {
						const option = options.data
							? optionForPlan(options.data.options, plan, cadence)
							: undefined;
						if (!option) return null;
						return (
							<PlanCard
								key={plan}
								plan={plan}
								option={option}
								currency={currency}
								locale={intlLocale}
								busy={changePlan.isPending}
								onChoose={() => openOption(option)}
							/>
						);
					})}
				</View>
			</Screen>
			<ConfirmSheet
				open={picked?.isFree === true}
				onClose={() => setPicked(null)}
				title={t("biz.subscription.pay.free.title")}
				body={t("biz.subscription.pay.free.body")}
				confirmLabel={t("biz.subscription.pay.free.confirm")}
				confirmVariant="primary"
				onConfirm={() => {
					if (!picked?.isFree) return;
					changePlan.mutate({
						businessId,
						plan: picked.plan,
						cadence: picked.cadence,
					});
				}}
			/>
			<Sheet
				open={picked !== null && !picked.isFree}
				onClose={() => {
					if (changePlan.isPending) return;
					setPicked(null);
				}}
				variant="dialog"
				title={t("biz.subscription.pay.title")}
				closeLabel={t("action.close")}
				snapPoints={[1]}
				avoidKeyboard
				footer={
					<View
						style={[
							styles.sheetActions,
							{ paddingBottom: insets.bottom + space.md },
						]}
					>
						<Button
							label={t("biz.subscription.pay.submit")}
							variant="primary"
							size="lg"
							shape="pill"
							fullWidth
							loading={changePlan.isPending}
							disabled={changePlan.isPending}
							onPress={() => {
								if (!picked || picked.isFree) return;
								const trimmed = reference.trim();
								if (
									trimmed.length < SINPE_REFERENCE_MIN ||
									trimmed.length > SINPE_REFERENCE_MAX
								) {
									setReferenceError(
										t("biz.subscription.pay.reference.invalid"),
									);
									return;
								}
								const sinpePhone = options.data?.sinpePhone ?? null;
								if (!sinpePhone) {
									toast.show(t("biz.subscription.pay.sinpe.missing"));
									warning();
									return;
								}
								setReferenceError(undefined);
								changePlan.mutate({
									businessId,
									plan: picked.plan,
									cadence: picked.cadence,
									reference: trimmed,
								});
							}}
						/>
						<Button
							label={t("action.cancel")}
							variant="ghost"
							size="lg"
							shape="pill"
							fullWidth
							disabled={changePlan.isPending}
							onPress={() => setPicked(null)}
						/>
					</View>
				}
			>
				{picked && !picked.isFree ? (
					<View style={styles.payCopy}>
						<Text tone="muted">
							{t("biz.subscription.pay.body", {
								amount: formatMoney(
									picked.priceMinor,
									current?.currency ?? "CRC",
									{ locale: intlLocale },
								),
							})}
						</Text>
						<View style={styles.payFact}>
							<Text tone="muted">{t("biz.subscription.pay.amount")}</Text>
							<Text bold tabular>
								{formatMoney(picked.priceMinor, current?.currency ?? "CRC", {
									locale: intlLocale,
								})}
							</Text>
							<Text tone="muted">
								{t("biz.subscription.iva", {
									amount: formatMoney(
										picked.ivaMinor,
										current?.currency ?? "CRC",
										{
											locale: intlLocale,
										},
									),
								})}
							</Text>
						</View>
						<View style={styles.payFact}>
							<Text tone="muted">{t("biz.subscription.pay.sinpe")}</Text>
							{options.data?.sinpePhone ? (
								<Text bold selectable>
									{options.data.sinpePhone}
								</Text>
							) : (
								<Text tone="destructive">
									{t("biz.subscription.pay.sinpe.missing")}
								</Text>
							)}
						</View>
						<Field
							label={t("biz.subscription.pay.reference")}
							value={reference}
							onChangeText={(value) => {
								setReference(value);
								if (referenceError) setReferenceError(undefined);
							}}
							error={referenceError}
							help={t("biz.subscription.pay.reference.help")}
							autoCapitalize="none"
							autoCorrect={false}
							maxLength={SINPE_REFERENCE_MAX}
						/>
						{payFailure.message ? (
							<Text tone="destructive" accessibilityRole="alert">
								{payFailure.message}
							</Text>
						) : null}
					</View>
				) : null}
			</Sheet>
		</>
	);
}

function PlanCard({
	plan,
	option,
	currency,
	locale,
	busy,
	onChoose,
}: {
	plan: Plan;
	option: PlanOption;
	currency: Currency;
	locale: string;
	busy: boolean;
	onChoose: () => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const header = PLAN_CARD_HEADER[plan];
	const features = planFeatureRows(t, PLAN_LIMITS[plan]);
	const amount = option.isFree
		? t("biz.subscription.plan.FREE")
		: formatMoney(option.priceMinor, currency, { locale });
	const price = option.isFree
		? amount
		: option.cadence === "YEARLY"
			? t("biz.subscription.price.yearly", { amount })
			: t("biz.subscription.price.monthly", { amount });
	const ink = { color: colors[header.fg] };

	return (
		<View style={[styles.planLift, shadow.card]}>
			<View
				style={[
					styles.planCard,
					{ backgroundColor: colors.card, borderColor: colors.border },
				]}
			>
				<View
					style={[styles.planHeader, { backgroundColor: colors[header.bg] }]}
				>
					<Text variant="heading" bold style={ink}>
						{t(`biz.subscription.plan.${plan}` as MessageKey)}
					</Text>
					<Text variant="caption" style={ink}>
						{t(planTaglineKey(plan))}
					</Text>
					<Text variant="title" bold tabular style={ink}>
						{price}
					</Text>
				</View>
				<View style={styles.planBody}>
					{option.isCurrent ? (
						<Text tone="muted">{t("biz.subscription.current")}</Text>
					) : (
						<Button
							label={t("biz.subscription.choose")}
							variant="primary"
							size="md"
							shape="pill"
							fullWidth
							disabled={busy}
							onPress={onChoose}
						/>
					)}
					<Text bold>{t("biz.subscription.included")}</Text>
					{features.map((row) => (
						<View key={row.key} style={styles.feature}>
							<Ionicons
								name="checkmark"
								size={icon.control}
								color={colors.foreground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
							<Text style={styles.featureCopy}>
								{row.value} {row.label}
							</Text>
						</View>
					))}
				</View>
			</View>
		</View>
	);
}

function SubscriptionSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { colors } = useTheme();
	return (
		<View style={styles.cards}>
			<Skeleton label={loadingLabel} style={styles.skeletonNote} />
			<View
				style={[
					styles.planCard,
					{ backgroundColor: colors.card, borderColor: colors.border },
				]}
			>
				<Skeleton style={styles.skeletonHeader} />
				<View style={styles.planBody}>
					<Skeleton style={styles.skeletonTitle} />
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLine} />
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	skeletonNote: { width: "75%", height: 18 },
	skeletonTitle: { width: "55%", height: 18 },
	skeletonLine: { width: "65%", height: 18 },
	skeletonHeader: { width: "100%", height: 112 },
	status: { gap: TEXT_STACK_GAP, marginTop: space.lg },
	cadence: { marginTop: space.lg },
	cards: { gap: space.lg, marginTop: space.lg },
	planLift: { borderRadius: radius.lg },
	planCard: {
		borderRadius: radius.lg,
		borderWidth: 1,
		overflow: "hidden",
	},
	planHeader: {
		paddingHorizontal: space.lg,
		paddingVertical: space.xxl,
		gap: TEXT_STACK_GAP,
	},
	planBody: {
		padding: space.lg,
		gap: space.md,
	},
	feature: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.sm,
	},
	featureCopy: { flex: 1 },
	sheetActions: { paddingHorizontal: space.lg, gap: space.sm },
	payCopy: { gap: space.md },
	payFact: { gap: TEXT_STACK_GAP },
});
