import type { MerchantLocation } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { radius, space, useTheme } from "@/theme";

type PauseDuration = 15 | 30 | 60 | undefined;

export default function MerchantLocations() {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const { colors } = useTheme();
	const scope = useMerchantScope();
	const [pauseTarget, setPauseTarget] = useState<MerchantLocation | null>(null);
	const [confirmDuration, setConfirmDuration] = useState<
		0 | 15 | 30 | 60 | null
	>(null);
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId },
			{ enabled: !!businessId, refetchInterval: 5_000 },
		),
	);
	const refresh = async () => {
		await cache.invalidateQueries({
			queryKey: trpc.business.locations.pathKey(),
		});
	};
	const pause = useMutation(
		trpc.business.pauseLocation.mutationOptions({
			onSuccess: async () => {
				light();
				toast.show(t("biz.locations.paused"));
				await refresh();
			},
			onError: () => warning(),
		}),
	);
	const resume = useMutation(
		trpc.business.resumeLocation.mutationOptions({
			onSuccess: async () => {
				light();
				toast.show(t("biz.locations.resumed"));
				await refresh();
			},
			onError: () => warning(),
		}),
	);
	const canManage = shop?.role === "OWNER" || shop?.role === "MANAGER";
	const chooseDuration = (duration: PauseDuration) => {
		setConfirmDuration(duration ?? 0);
	};
	const selectedDuration =
		confirmDuration === 0 || confirmDuration === null
			? undefined
			: confirmDuration;
	const failed = shops.error ?? locations.error;

	return (
		<>
			<Screen
				title={t("biz.locations.title")}
				leading={<BackButton to="/more" />}
				scroll
				bottomInset
			>
				{failed ? (
					<ErrorState
						error={failed}
						onRetry={() => {
							void shops.refetch();
							void locations.refetch();
						}}
					/>
				) : shops.isPending || (shop && locations.isPending) ? (
					<Text>{t("state.loading")}</Text>
				) : !shop ? (
					<Text>{t("biz.onboarding.notLive")}</Text>
				) : (
					<Card>
						{(locations.data ?? []).map((location, index) => {
							const paused =
								location.status === "paused_manual" ||
								location.status === "paused_capacity";
							const manageable = paused || location.status === "open";
							return (
								<View
									key={location.id}
									style={[
										styles.locationItem,
										index > 0 && styles.locationDivider,
										index > 0 && { borderTopColor: colors.border },
									]}
								>
									<View style={styles.locationIdentity}>
										<Text variant="heading" bold>
											{location.name}
										</Text>
										{location.city ? (
											<Text variant="label" tone="muted">
												{location.city}
											</Text>
										) : null}
									</View>
									<View style={styles.locationStatus}>
										<View
											style={[
												styles.statusDot,
												{
													backgroundColor:
														location.status === "open"
															? colors.success
															: paused
																? colors.warning
																: colors.mutedForeground,
												},
											]}
										/>
										<Text variant="label" bold>
											{t(`biz.locations.status.${location.status}`)}
										</Text>
										{location.resumeAt ? (
											<Text variant="caption" tone="muted">
												·{" "}
												{new Intl.DateTimeFormat(intlLocale, {
													hour: "numeric",
													minute: "2-digit",
												}).format(location.resumeAt)}
											</Text>
										) : null}
									</View>
									{canManage && manageable ? (
										<Button
											label={t(
												paused ? "biz.locations.resume" : "biz.locations.pause",
											)}
											variant="secondary"
											fullWidth
											disabled={pause.isPending || resume.isPending}
											onPress={() => {
												if (paused)
													resume.mutate({
														businessId,
														locationId: location.id,
													});
												else setPauseTarget(location);
											}}
										/>
									) : null}
								</View>
							);
						})}
					</Card>
				)}
				{pause.error || resume.error ? (
					<View style={styles.error}>
						<ErrorState error={pause.error ?? resume.error} />
					</View>
				) : null}
			</Screen>
			<Sheet
				open={!!pauseTarget && confirmDuration === null}
				onClose={() => setPauseTarget(null)}
				title={t("biz.locations.pause")}
				closeLabel={t("action.close")}
			>
				<Card>
					{([15, 30, 60] as const).map((minutes) => (
						<ListRow
							key={minutes}
							title={t("biz.locations.minutes", { count: minutes })}
							chevron
							onPress={() => chooseDuration(minutes)}
						/>
					))}
					<ListRow
						title={t("biz.locations.untilResumed")}
						divider={false}
						chevron
						onPress={() => chooseDuration(undefined)}
					/>
				</Card>
			</Sheet>
			<ConfirmSheet
				open={!!pauseTarget && confirmDuration !== null}
				onClose={() => {
					setPauseTarget(null);
					setConfirmDuration(null);
				}}
				title={t("biz.locations.pauseConfirm")}
				body={
					pauseTarget
						? `${pauseTarget.name} · ${selectedDuration ? t("biz.locations.minutes", { count: selectedDuration }) : t("biz.locations.untilResumed")}`
						: undefined
				}
				confirmLabel={t("biz.locations.pause")}
				onConfirm={() => {
					if (!pauseTarget) return;
					pause.mutate({
						businessId,
						locationId: pauseTarget.id,
						reason: "manual",
						durationMinutes: selectedDuration,
					});
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	error: { marginTop: space.lg },
	locationItem: { gap: space.sm },
	locationDivider: {
		borderTopWidth: StyleSheet.hairlineWidth,
		marginTop: space.lg,
		paddingTop: space.lg,
	},
	locationIdentity: { gap: space.xs },
	locationStatus: { flexDirection: "row", alignItems: "center", gap: space.sm },
	statusDot: { width: 8, height: 8, borderRadius: radius.full },
});
