import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import {
	type DashboardCommandId,
	type DashboardLayouts,
	type DashboardMetricId,
	type DashboardPreferences,
	type DashboardShortcutId,
	type DashboardWidgetId,
	DEFAULT_DASHBOARD_COMMAND_COLORS,
	DEFAULT_DASHBOARD_PREFERENCES,
	DEFAULT_DASHBOARD_WIDGETS,
	dashboardCommandIdSchema,
	dashboardMetricIdSchema,
	dashboardShortcutIdSchema,
	REQUIRED_DASHBOARD_WIDGETS,
	resolveDashboardPreferences,
	SIMPLE_DASHBOARD_PREFERENCES,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { type ComponentProps, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";

import {
	CustomizationRows,
	DashboardWidgetPreview,
	DensityToggle,
	PaletteChip,
	ProductCountPicker,
	PulseLayoutPicker,
	ThemeSwatchPicker,
	WidgetLayoutPicker,
	WidgetPaletteStrip,
} from "@/components/customization-rows";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { MerchantCommandRail } from "@/components/merchant-command-rail";
import { MerchantPulse } from "@/components/merchant-pulse";
import { MerchantShortcutRail } from "@/components/merchant-shortcut-rail";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import {
	businessThemeColors,
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	ThemeColorsOverrideProvider,
	useTheme,
} from "@/theme";

const LABELS: Record<DashboardWidgetId, MessageKey> = {
	shortcuts: "customize.shortcuts",
	pulse: "customize.metrics",
	insights: "customize.insights",
	attention: "customize.attention",
	queue: "customize.queue",
	commands: "customize.commands",
	catalog: "customize.catalog",
};
const METRIC_LABELS: Record<DashboardMetricId, MessageKey> = {
	net_sales: "customize.netSales",
	orders: "customize.orders",
	average_order: "customize.averageOrder",
	active_orders: "customize.activeOrders",
};
const SHORTCUT_LABELS: Record<DashboardShortcutId, MessageKey> = {
	orders: "biz.nav.orders",
	catalog: "biz.nav.products",
	promotions: "biz.promotions.title",
	analytics: "biz.analytics.title",
	team: "biz.more.team",
	payouts: "biz.more.payouts",
	hours: "biz.settings.hours",
	locations: "biz.locations.title",
	reviews: "biz.reviews.title",
};
const SHORTCUT_ICONS: Record<
	DashboardShortcutId,
	ComponentProps<typeof Ionicons>["name"]
> = {
	orders: "receipt-outline",
	catalog: "fast-food-outline",
	promotions: "ticket-outline",
	analytics: "stats-chart-outline",
	team: "people-outline",
	payouts: "cash-outline",
	hours: "time-outline",
	locations: "location-outline",
	reviews: "star-outline",
};
const COMMAND_LABELS: Record<DashboardCommandId, MessageKey> = {
	"add-product": "biz.products.add",
	promo: "biz.promotions.title",
	stock: "biz.products.stock",
	hours: "biz.settings.hours",
	pause: "biz.locations.pause",
};
const COMMAND_ICONS: Record<
	DashboardCommandId,
	ComponentProps<typeof Ionicons>["name"]
> = {
	"add-product": "add-outline",
	promo: "ticket-outline",
	stock: "cube-outline",
	hours: "time-outline",
	pause: "pause-outline",
};
const COMPACT_LAYOUTS: DashboardLayouts = {
	shortcuts: "grid",
	pulse: "cards",
	insights: "stack",
	attention: "chips",
	queue: "compact",
	commands: "wrap",
	catalog: "tiles",
};
const WIDGET_LAYOUTS: {
	[K in Exclude<DashboardWidgetId, "pulse">]: readonly {
		id: DashboardLayouts[K];
		label: MessageKey;
	}[];
} = {
	shortcuts: [
		{ id: "rail", label: "customize.layout.rail" },
		{ id: "grid", label: "customize.layout.grid" },
		{ id: "list", label: "customize.layout.list" },
	],
	insights: [
		{ id: "columns", label: "customize.layout.columns" },
		{ id: "stack", label: "customize.layout.stack" },
		{ id: "band", label: "customize.layout.band" },
	],
	attention: [
		{ id: "list", label: "customize.layout.list" },
		{ id: "chips", label: "customize.layout.chips" },
		{ id: "cards", label: "customize.layout.cards" },
	],
	queue: [
		{ id: "rows", label: "customize.layout.rows" },
		{ id: "compact", label: "customize.layout.compact" },
		{ id: "cards", label: "customize.layout.cards" },
	],
	commands: [
		{ id: "rail", label: "customize.layout.rail" },
		{ id: "wrap", label: "customize.layout.wrap" },
		{ id: "stack", label: "customize.layout.stack" },
	],
	catalog: [
		{ id: "rows", label: "customize.layout.rows" },
		{ id: "tiles", label: "customize.layout.tiles" },
		{ id: "rail", label: "customize.layout.rail" },
	],
};
const DETAILED_LAYOUTS: DashboardLayouts = {
	shortcuts: "rail",
	pulse: "band",
	insights: "columns",
	attention: "list",
	queue: "rows",
	commands: "rail",
	catalog: "rows",
};

function layoutsMatch(value: DashboardLayouts, target: DashboardLayouts) {
	return DEFAULT_DASHBOARD_WIDGETS.every((id) => value[id] === target[id]);
}

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
			{
				enabled: !!businessId,
				select: (data) => ({
					...data,
					configuration: resolveDashboardPreferences(data.configuration),
				}),
			},
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
	const [editor, setEditor] = useState<
		| { kind: "theme" }
		| { kind: "paintAll" }
		| { kind: "widget"; id: DashboardWidgetId }
		| null
	>(null);
	const [openCommand, setOpenCommand] = useState<DashboardCommandId | null>(
		null,
	);
	useEffect(() => {
		if (saved.data)
			setDraft(resolveDashboardPreferences(saved.data.configuration));
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
	const hidden = (id: DashboardWidgetId) => draft.hidden.includes(id);
	const previewColors = draft.themeId
		? businessThemeColors(draft.themeId, scheme)
		: deviceColors;
	const metricItems: DashboardMetricId[] = [
		...draft.metrics,
		...dashboardMetricIdSchema.options.filter(
			(id) => !draft.metrics.includes(id),
		),
	];
	const shortcutItems: DashboardShortcutId[] = [
		...draft.shortcutIds,
		...dashboardShortcutIdSchema.options.filter(
			(id) => !draft.shortcutIds.includes(id),
		),
	];
	const metricsValid = draft.metrics.length >= 1 && draft.metrics.length <= 3;
	const shortcutsValid = draft.shortcutIds.length >= 1;
	const dirty = saved.data
		? JSON.stringify(draft) !== JSON.stringify(saved.data.configuration)
		: false;
	const allCompact = layoutsMatch(draft.layouts, COMPACT_LAYOUTS);
	const allDetailed = layoutsMatch(draft.layouts, DETAILED_LAYOUTS);
	const paintValues = DEFAULT_DASHBOARD_WIDGETS.map(
		(id) => draft.widgetThemes[id],
	);
	const allPainted =
		paintValues.every((id) => id === paintValues[0]) &&
		draft.themeId === paintValues[0]
			? paintValues[0]
			: undefined;
	const paintedWidgets = (themeId: DashboardPreferences["themeId"]) =>
		Object.fromEntries(
			DEFAULT_DASHBOARD_WIDGETS.map((id) => [id, themeId]),
		) as DashboardPreferences["widgetThemes"];
	const sketch = (
		id: DashboardWidgetId,
		layout: DashboardLayouts[DashboardWidgetId] = draft.layouts[id],
	) => (
		<DashboardWidgetPreview
			id={id}
			layout={layout}
			metricCount={draft.metrics.length}
			productCount={draft.productPreviewCount}
			shortcutCount={draft.shortcutIds.length}
		/>
	);
	const closeEditor = () => {
		setEditor(null);
		setOpenCommand(null);
	};
	const widgetEditor = (id: DashboardWidgetId) => (
		<View style={styles.sheetBody}>
			<WidgetPaletteStrip
				label={t("customize.paint")}
				value={draft.widgetThemes[id]}
				scheme={scheme}
				onChange={(themeId) =>
					setDraft({
						...draft,
						widgetThemes: {
							...draft.widgetThemes,
							[id]: themeId as DashboardPreferences["themeId"],
						},
					})
				}
			/>
			{id === "queue" ? (
				<Text variant="caption" tone="muted">
					{t("customize.queueHelp")}
				</Text>
			) : null}
			{id === "pulse" ? (
				<PulseLayoutPicker
					value={draft.layouts.pulse}
					metricCount={draft.metrics.length}
					onChange={(pulse) =>
						setDraft({
							...draft,
							layouts: { ...draft.layouts, pulse },
						})
					}
				/>
			) : (
				<WidgetLayoutPicker
					value={draft.layouts[id]}
					options={WIDGET_LAYOUTS[id]}
					onChange={(next) =>
						setDraft({
							...draft,
							layouts: { ...draft.layouts, [id]: next },
						})
					}
					render={(layout) => sketch(id, layout)}
				/>
			)}
			{id === "shortcuts" ? (
				<View style={styles.inset}>
					<Text variant="caption" tone="muted">
						{t("customize.shortcutsHelp")}
					</Text>
					<CustomizationRows
						dense
						items={shortcutItems}
						hidden={dashboardShortcutIdSchema.options.filter(
							(item) => !draft.shortcutIds.includes(item),
						)}
						labels={SHORTCUT_LABELS}
						onReorder={(next) =>
							setDraft({
								...draft,
								shortcutIds: next.filter((item) =>
									draft.shortcutIds.includes(item),
								),
							})
						}
						onToggle={(item) => {
							if (draft.shortcutIds.includes(item)) {
								if (draft.shortcutIds.length <= 1) return;
								setDraft({
									...draft,
									shortcutIds: draft.shortcutIds.filter((one) => one !== item),
								});
								return;
							}
							setDraft({
								...draft,
								shortcutIds: [...draft.shortcutIds, item],
							});
						}}
					/>
				</View>
			) : null}
			{id === "pulse" ? (
				<View style={styles.inset}>
					<Text variant="caption" tone="muted">
						{t("customize.metricsWhich")}
					</Text>
					<Text variant="caption" tone="muted">
						{t("customize.metricsHelp")}
					</Text>
					<CustomizationRows
						dense
						items={metricItems}
						hidden={dashboardMetricIdSchema.options.filter(
							(item) => !draft.metrics.includes(item),
						)}
						labels={METRIC_LABELS}
						onReorder={(next) =>
							setDraft({
								...draft,
								metrics: next.filter((item) => draft.metrics.includes(item)),
							})
						}
						onToggle={(item) => {
							if (draft.metrics.includes(item)) {
								if (draft.metrics.length <= 1) return;
								setDraft({
									...draft,
									metrics: draft.metrics.filter((one) => one !== item),
								});
								return;
							}
							if (draft.metrics.length >= 3) return;
							setDraft({
								...draft,
								metrics: [...draft.metrics, item],
							});
						}}
					/>
					{metricsValid ? null : (
						<Text variant="caption" tone="destructive">
							{t("customize.metricsRange")}
						</Text>
					)}
				</View>
			) : null}
			{id === "catalog" ? (
				<View style={styles.inset}>
					<Text variant="caption" tone="muted">
						{t("customize.productCount")}
					</Text>
					<ProductCountPicker
						value={draft.productPreviewCount}
						onChange={(productPreviewCount) =>
							setDraft({ ...draft, productPreviewCount })
						}
					/>
				</View>
			) : null}
			{id === "commands" ? (
				<View style={styles.inset}>
					<Text variant="caption" tone="muted">
						{t("customize.paintCommand")}
					</Text>
					{dashboardCommandIdSchema.options.map((key, index, all) => (
						<View key={key}>
							<ListRow
								title={t(COMMAND_LABELS[key])}
								chevron
								leading={
									<Ionicons
										name={COMMAND_ICONS[key]}
										size={icon.action}
										color={previewColors.foreground}
									/>
								}
								divider={index < all.length - 1 && openCommand !== key}
								trailing={
									<PaletteChip
										themeId={draft.commandColors[key]}
										scheme={scheme}
										inheritFill={previewColors.primary}
									/>
								}
								onPress={() =>
									setOpenCommand((current) => (current === key ? null : key))
								}
							/>
							{openCommand === key ? (
								<View style={styles.commandPaint}>
									<WidgetPaletteStrip
										value={draft.commandColors[key]}
										scheme={scheme}
										onChange={(themeId) =>
											setDraft({
												...draft,
												commandColors: {
													...draft.commandColors,
													[key]: themeId as DashboardPreferences["themeId"],
												},
											})
										}
									/>
								</View>
							) : null}
						</View>
					))}
				</View>
			) : null}
		</View>
	);
	const editingWidget = editor?.kind === "widget" ? editor.id : null;
	return (
		<>
			<Screen
				title={t("customize.dashboard")}
				leading={<BackButton to="/(business)/customize" />}
				scroll
				bottomInset
				contentStyle={styles.page}
			>
				{saved.error ? (
					<ErrorState
						error={saved.error}
						onRetry={() => void saved.refetch()}
					/>
				) : null}
				<Card>
					<View style={styles.preset}>
						<Text variant="label" bold>
							{t("customize.simple")}
						</Text>
						<Text variant="caption" tone="muted">
							{t("customize.simpleDashboardHelp")}
						</Text>
						<Button
							variant="secondary"
							label={t("customize.useSimple")}
							onPress={() =>
								setDraft((current) => ({
									...SIMPLE_DASHBOARD_PREFERENCES,
									themeId: current.themeId,
									widgetThemes: current.widgetThemes,
									commandColors: current.commandColors,
								}))
							}
						/>
					</View>
				</Card>
				<Card>
					<ListRow
						title={t("customize.theme")}
						chevron
						trailing={
							<PaletteChip
								themeId={draft.themeId}
								scheme={scheme}
								inheritFill={deviceColors.primary}
							/>
						}
						onPress={() => setEditor({ kind: "theme" })}
					/>
					<ListRow
						title={t("customize.paintAll")}
						chevron
						divider={false}
						onPress={() => setEditor({ kind: "paintAll" })}
					/>
				</Card>
				<View style={styles.section}>
					<View style={styles.sectionCopy}>
						<Text variant="label" bold>
							{t("customize.density.all")}
						</Text>
					</View>
					<DensityToggle
						compactSelected={allCompact}
						detailedSelected={allDetailed}
						onCompact={() => setDraft({ ...draft, layouts: COMPACT_LAYOUTS })}
						onDetailed={() => setDraft({ ...draft, layouts: DETAILED_LAYOUTS })}
						compactPreview={
							<View style={styles.applySketch}>
								{[0, 1, 2].map((slot) => (
									<View
										key={slot}
										style={[
											styles.applyChip,
											{ backgroundColor: deviceColors.muted },
										]}
									/>
								))}
							</View>
						}
						detailedPreview={
							<View style={styles.applyStack}>
								{[0, 1, 2].map((slot) => (
									<View
										key={slot}
										style={[
											styles.applyBar,
											{ backgroundColor: deviceColors.border },
										]}
									/>
								))}
							</View>
						}
					/>
					{allCompact || allDetailed ? null : (
						<Text variant="caption" tone="muted">
							{t("customize.saved")}
						</Text>
					)}
				</View>
				<View style={styles.section}>
					<Text variant="caption" tone="muted">
						{t("customize.canvasHint")}
					</Text>
					<ThemeColorsOverrideProvider colors={previewColors}>
						<View
							style={[
								styles.canvas,
								{
									backgroundColor: previewColors.background,
									borderColor: previewColors.border,
								},
							]}
						>
							<View
								style={[
									styles.identity,
									{ backgroundColor: previewColors.foreground },
								]}
							>
								<View
									style={[
										styles.identityDot,
										{ backgroundColor: previewColors.background },
									]}
								/>
								<Text
									variant="caption"
									bold
									style={{ color: previewColors.background }}
								>
									{t("biz.dashboard.today")}
								</Text>
							</View>
							<CustomizationRows
								items={draft.widgets}
								hidden={draft.hidden}
								fixed={REQUIRED_DASHBOARD_WIDGETS}
								labels={LABELS}
								onPress={(id) => setEditor({ kind: "widget", id })}
								onReorder={(widgets) => setDraft({ ...draft, widgets })}
								canHide={(id) => !REQUIRED_DASHBOARD_WIDGETS.includes(id)}
								onToggle={(id) => {
									if (REQUIRED_DASHBOARD_WIDGETS.includes(id)) return;
									setDraft({
										...draft,
										hidden: hidden(id)
											? draft.hidden.filter((one) => one !== id)
											: [...draft.hidden, id],
									});
								}}
								renderChip={(id) => (
									<PaletteChip
										themeId={draft.widgetThemes[id]}
										scheme={scheme}
										inheritFill={previewColors.primary}
									/>
								)}
								renderPreview={(id) => {
									const widgetThemeId = draft.widgetThemes[id];
									const widgetColors = widgetThemeId
										? businessThemeColors(widgetThemeId, scheme)
										: previewColors;
									const painted = widgetThemeId != null;
									const preview =
										id === "shortcuts" ? (
											<MerchantShortcutRail
												layout={draft.layouts.shortcuts}
												paint={painted}
												shortcuts={draft.shortcutIds.slice(0, 6).map((key) => ({
													key,
													label: t(SHORTCUT_LABELS[key]),
													icon: SHORTCUT_ICONS[key],
													onPress: () => {},
												}))}
											/>
										) : id === "pulse" ? (
											<MerchantPulse
												data={home.data?.pulse ?? null}
												dateLabel={new Date().toLocaleDateString(intlLocale)}
												metrics={
													draft.metrics.length > 0
														? draft.metrics.slice(0, 3)
														: DEFAULT_DASHBOARD_PREFERENCES.metrics
												}
												layout={draft.layouts.pulse}
												paint={painted ? "accent" : "invert"}
											/>
										) : id === "commands" ? (
											<MerchantCommandRail
												layout={draft.layouts.commands}
												actions={dashboardCommandIdSchema.options.map(
													(key) => ({
														key,
														label: t(COMMAND_LABELS[key]),
														icon: COMMAND_ICONS[key],
														primary:
															key === "add-product" &&
															draft.commandColors[key] == null,
														accent: draft.commandColors[key],
														onPress: () => {},
													}),
												)}
											/>
										) : (
											sketch(id)
										);
									return (
										<ThemeColorsOverrideProvider colors={widgetColors}>
											{preview}
										</ThemeColorsOverrideProvider>
									);
								}}
							/>
						</View>
					</ThemeColorsOverrideProvider>
				</View>
				{save.error || restore.error ? (
					<ErrorState
						error={save.error ?? restore.error}
						onRetry={() => void saved.refetch()}
					/>
				) : null}
				<View style={styles.actions}>
					<Button
						label={t("customize.save")}
						disabled={
							!saved.data ||
							!dirty ||
							!metricsValid ||
							!shortcutsValid ||
							save.isPending
						}
						loading={save.isPending}
						onPress={() =>
							run(
								save.mutateAsync({
									businessId,
									revision,
									configuration: draft,
								}),
							)
						}
					/>
					<Button
						variant="secondary"
						label={t("customize.restore")}
						disabled={!saved.data || restore.isPending}
						onPress={() => run(restore.mutateAsync({ businessId, revision }))}
					/>
				</View>
			</Screen>
			<Sheet
				open={editor?.kind === "theme"}
				onClose={closeEditor}
				title={t("customize.theme")}
				closeLabel={t("action.close")}
				snapPoints={[0.55, 1]}
			>
				<ThemeSwatchPicker
					value={draft.themeId}
					scheme={scheme}
					onChange={(themeId) =>
						setDraft({
							...draft,
							themeId: themeId as DashboardPreferences["themeId"],
						})
					}
				/>
			</Sheet>
			<Sheet
				open={editor?.kind === "paintAll"}
				onClose={closeEditor}
				title={t("customize.paintAll")}
				closeLabel={t("action.close")}
			>
				<WidgetPaletteStrip
					value={allPainted}
					scheme={scheme}
					onChange={(themeId) =>
						setDraft({
							...draft,
							themeId: themeId as DashboardPreferences["themeId"],
							widgetThemes: paintedWidgets(
								themeId as DashboardPreferences["themeId"],
							),
							commandColors:
								themeId === null
									? DEFAULT_DASHBOARD_COMMAND_COLORS
									: draft.commandColors,
						})
					}
				/>
			</Sheet>
			<Sheet
				open={editingWidget != null}
				onClose={closeEditor}
				title={
					editingWidget ? t(LABELS[editingWidget]) : t("customize.dashboard")
				}
				closeLabel={t("action.close")}
				snapPoints={[0.7, 1]}
			>
				{editingWidget ? widgetEditor(editingWidget) : null}
			</Sheet>
		</>
	);
}

const styles = StyleSheet.create({
	page: { gap: space.xl },
	section: { gap: space.sm },
	sectionCopy: { gap: TEXT_STACK_GAP },
	actions: { gap: space.sm },
	preset: { gap: space.sm },
	applySketch: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
	},
	applyChip: {
		width: 28,
		height: 16,
		borderRadius: radius.full,
	},
	applyStack: {
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
		justifyContent: "center",
	},
	applyBar: { height: 8, borderRadius: radius.full },
	canvas: {
		borderWidth: 1,
		borderRadius: radius.lg,
		padding: space.lg,
		gap: space.lg,
	},
	identity: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		padding: space.sm,
		borderRadius: radius.md,
	},
	identityDot: {
		width: 22,
		height: 22,
		borderRadius: radius.full,
	},
	inset: { gap: space.md, paddingTop: space.md },
	commandPaint: { paddingTop: space.sm, paddingBottom: space.md },
	sheetBody: { gap: space.xl },
});
