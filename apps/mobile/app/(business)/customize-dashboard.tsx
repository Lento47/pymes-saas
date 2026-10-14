import Ionicons from "@expo/vector-icons/Ionicons";
import {
	type DashboardPreferences,
	DEFAULT_DASHBOARD_PREFERENCES,
	dashboardMetricIdSchema,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { CustomizationRows } from "@/components/customization-rows";
import { ErrorState } from "@/components/error-state";
import { MerchantPulse } from "@/components/merchant-pulse";
import { Screen, ScreenSection } from "@/components/screen";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import {
	businessThemeColors,
	businessThemeOrder,
	radius,
	space,
	ThemeColorsOverrideProvider,
	useTheme,
} from "@/theme";

const LABELS = {
	shortcuts: "customize.shortcuts",
	pulse: "customize.metrics",
	insights: "customize.insights",
	catalog: "customize.catalog",
} as const;
const METRIC_LABELS = {
	net_sales: "customize.netSales",
	orders: "customize.orders",
	average_order: "customize.averageOrder",
	active_orders: "customize.activeOrders",
} as const;

export default function CustomizeDashboard() {
	const { t, intlLocale } = useT();
	const { colors: deviceColors, scheme } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const scope = useMerchantScope();
	const params = useLocalSearchParams<{ businessId?: string }>();
	const businessId = params.businessId ?? scope.businessId ?? "";
	const saved = useQuery(
		trpc.business.dashboardPreferences.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);
	const locationId =
		locations.data?.find((location) => location.id === scope.locationId)?.id ??
		locations.data?.[0]?.id ??
		"";
	const home = useQuery(
		trpc.business.home.queryOptions(
			{ businessId, locationId },
			{ enabled: !!locationId },
		),
	);
	const save = useMutation(
		trpc.business.saveDashboardPreferences.mutationOptions(),
	);
	const restore = useMutation(
		trpc.business.restoreDashboardPreferences.mutationOptions(),
	);
	const [draft, setDraft] = useState<DashboardPreferences>(
		DEFAULT_DASHBOARD_PREFERENCES,
	);
	useEffect(() => {
		if (saved.data) setDraft(saved.data.configuration);
	}, [saved.data]);
	const refresh = async () => {
		await cache.invalidateQueries({
			queryKey: trpc.business.dashboardPreferences.queryKey({ businessId }),
		});
	};
	const revision = saved.data?.revision ?? 0;
	const run = (task: Promise<unknown>) => {
		void task.then(refresh).catch(() => {});
	};
	const hidden = (id: DashboardPreferences["widgets"][number]) =>
		draft.hidden.includes(id);
	const previewColors = draft.themeId
		? businessThemeColors(draft.themeId, scheme)
		: deviceColors;
	return (
		<Screen title={t("customize.dashboard")} scroll bottomInset>
			{saved.error ? (
				<ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
			) : null}
			<ScreenSection title={t("customize.dashboard")}>
				<Text variant="body" tone="muted">
					{t("customize.saved")}
				</Text>
				<CustomizationRows
					items={draft.widgets}
					hidden={draft.hidden}
					labels={LABELS}
					onReorder={(widgets) => setDraft({ ...draft, widgets })}
					onToggle={(id) =>
						setDraft({
							...draft,
							hidden: hidden(id)
								? draft.hidden.filter((one) => one !== id)
								: [...draft.hidden, id],
						})
					}
				/>
			</ScreenSection>
			<ScreenSection title={t("customize.metrics")}>
				<View style={{ gap: space.xs }}>
					{dashboardMetricIdSchema.options.map((id) => (
						<Button
							key={id}
							variant="secondary"
							label={t(METRIC_LABELS[id])}
							selected={draft.metrics.includes(id)}
							choiceRole="checkbox"
							onPress={() =>
								setDraft({
									...draft,
									metrics: draft.metrics.includes(id)
										? draft.metrics.filter((item) => item !== id)
										: [...draft.metrics, id],
								})
							}
						/>
					))}
				</View>
				{draft.metrics.length < 1 || draft.metrics.length > 3 ? (
					<Text variant="caption" tone="destructive">
						Choose one to three metrics / Elige de uno a tres números.
					</Text>
				) : null}
			</ScreenSection>
			<ScreenSection title={t("customize.productCount")}>
				<View style={{ flexDirection: "row", gap: space.xs }}>
					{([3, 6, 9] as const).map((count) => (
						<Button
							key={count}
							variant="secondary"
							label={String(count)}
							selected={draft.productPreviewCount === count}
							onPress={() => setDraft({ ...draft, productPreviewCount: count })}
						/>
					))}
				</View>
			</ScreenSection>
			<ScreenSection title={t("customize.theme")}>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
					<Button
						variant="secondary"
						label={t("customize.appTheme")}
						selected={draft.themeId === null}
						onPress={() => setDraft({ ...draft, themeId: null })}
					/>
					{businessThemeOrder().map((id) => (
						<Button
							key={id}
							variant="secondary"
							label={id}
							selected={draft.themeId === id}
							icon={
								<View
									style={{
										width: 16,
										height: 16,
										borderRadius: 8,
										backgroundColor: businessThemeColors(id, scheme).primary,
									}}
								/>
							}
							onPress={() => setDraft({ ...draft, themeId: id })}
						/>
					))}
				</View>
			</ScreenSection>
			<ScreenSection title={t("customize.preview")}>
				<ThemeColorsOverrideProvider colors={previewColors}>
					<Card>
						<Text variant="body" bold>
							{t("biz.dashboard.today")}
						</Text>
						{draft.widgets
							.filter((id) => !hidden(id))
							.map((id) => {
								if (id === "shortcuts")
									return (
										<View key={id} style={styles.shortcutRow}>
											{[
												{
													icon: "receipt-outline" as const,
													label: t("biz.nav.orders"),
												},
												{
													icon: "fast-food-outline" as const,
													label: t("biz.nav.products"),
												},
												{
													icon: "ticket-outline" as const,
													label: t("biz.promotions.title"),
												},
											].map((shortcut) => (
												<View key={shortcut.icon} style={styles.shortcut}>
													<Ionicons
														name={shortcut.icon}
														size={20}
														color={previewColors.foreground}
													/>
													<Text variant="caption" numberOfLines={1}>
														{shortcut.label}
													</Text>
												</View>
											))}
										</View>
									);
								if (id === "pulse")
									return (
										<MerchantPulse
											key={id}
											data={home.data?.pulse ?? null}
											dateLabel={new Date().toLocaleDateString(intlLocale)}
											metrics={
												draft.metrics.length > 0
													? draft.metrics.slice(0, 3)
													: DEFAULT_DASHBOARD_PREFERENCES.metrics
											}
										/>
									);
								if (id === "insights")
									return (
										<View key={id} style={styles.widget}>
											<Text variant="body" bold>
												{t("customize.insights")}
											</Text>
											{home.data?.insights.topProduct ? (
												<Text variant="body">
													{t("biz.dashboard.topProducts")}:{" "}
													{home.data.insights.topProduct}
												</Text>
											) : null}
										</View>
									);
								return (
									<View key={id} style={styles.widget}>
										<Text variant="body" bold>
											{t("biz.nav.menu")}
										</Text>
										{home.data?.catalog.products
											.slice(0, draft.productPreviewCount)
											.map((product) => (
												<Text key={product.id} variant="body" numberOfLines={1}>
													{product.title}
												</Text>
											))}
									</View>
								);
							})}
					</Card>
				</ThemeColorsOverrideProvider>
			</ScreenSection>
			{save.error || restore.error ? (
				<ErrorState
					error={save.error ?? restore.error}
					onRetry={() => void saved.refetch()}
				/>
			) : null}
			<Button
				label={t("customize.save")}
				disabled={
					!saved.data ||
					draft.metrics.length < 1 ||
					draft.metrics.length > 3 ||
					save.isPending
				}
				loading={save.isPending}
				onPress={() =>
					run(save.mutateAsync({ businessId, revision, configuration: draft }))
				}
			/>
			<Button
				variant="secondary"
				label={t("customize.restore")}
				disabled={!saved.data || restore.isPending}
				onPress={() => run(restore.mutateAsync({ businessId, revision }))}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	shortcutRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	shortcut: {
		minWidth: 78,
		maxWidth: 100,
		alignItems: "center",
		gap: space.xs,
	},
	widget: { gap: space.xs, borderRadius: radius.md, padding: space.sm },
});
