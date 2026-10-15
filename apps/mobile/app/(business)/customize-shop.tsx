import {
	brandAccentCheck,
	DEFAULT_STOREFRONT_APPEARANCE,
	SIMPLE_STOREFRONT_APPEARANCE,
	type StorefrontAppearance,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import {
	CustomizationRows,
	HeaderStylePicker,
	ShopSectionPreview,
	WidgetPaletteStrip,
} from "@/components/customization-rows";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { ShopCustomizationPreview } from "@/components/shop-customization-preview";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import {
	type BusinessThemeId,
	businessThemeColors,
	businessThemeOrder,
	space,
	useTheme,
} from "@/theme";

const LABELS = {
	information: "customize.shopInfo",
	offers: "customize.offers",
	featured: "customize.featured",
} as const;

/** The swatch a shop owner taps, stored as the hex the storefront already reads. */
function shopAccentHex(id: BusinessThemeId): string {
	const primary = businessThemeColors(id, "light").primary.toUpperCase();
	const check = brandAccentCheck(primary);
	return (check.valid ? primary : (check.suggested ?? primary)).toUpperCase();
}

function shopAccentId(accent: string | null): BusinessThemeId | null {
	if (!accent) return null;
	const upper = accent.toUpperCase();
	for (const id of businessThemeOrder()) {
		if (shopAccentHex(id) === upper) return id;
		if (businessThemeColors(id, "light").primary.toUpperCase() === upper)
			return id;
	}
	return null;
}

export default function CustomizeShop() {
	const { t } = useT();
	const { scheme } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const scope = useMerchantScope();
	const params = useLocalSearchParams<{ businessId?: string }>();
	const businessId = params.businessId ?? scope.businessId ?? "";
	const saved = useQuery(
		trpc.business.shopAppearance.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);
	const storefront = useQuery(
		trpc.business.shopPreview.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);
	const products = useQuery(
		trpc.products.list.queryOptions(
			{ businessId, limit: 3 },
			{ enabled: !!businessId },
		),
	);
	const save = useMutation(trpc.business.saveShopDraft.mutationOptions());
	const publish = useMutation(trpc.business.publishShopDraft.mutationOptions());
	const discard = useMutation(trpc.business.discardShopDraft.mutationOptions());
	const restore = useMutation(
		trpc.business.restoreShopDefault.mutationOptions(),
	);
	const [draft, setDraft] = useState<StorefrontAppearance>(
		DEFAULT_STOREFRONT_APPEARANCE,
	);
	useEffect(() => {
		if (saved.data) setDraft(saved.data.draft ?? saved.data.published);
	}, [saved.data]);
	const refresh = async () => {
		await cache.invalidateQueries({
			queryKey: trpc.business.shopAppearance.queryKey({ businessId }),
		});
		await cache.invalidateQueries({
			queryKey: trpc.business.shopPreview.queryKey({ businessId }),
		});
	};
	const revision = saved.data?.revision ?? 0;
	const accent = draft.accentColor ? brandAccentCheck(draft.accentColor) : null;
	const dirty = saved.data
		? JSON.stringify(draft) !==
			JSON.stringify(saved.data.draft ?? saved.data.published)
		: false;
	const failure = save.error ?? publish.error ?? discard.error ?? restore.error;
	const run = (task: Promise<unknown>) => {
		void task.then(refresh).catch(() => {});
	};
	return (
		<Screen
			title={t("customize.shop")}
			leading={<BackButton to="/(business)/customize" />}
			scroll
			bottomInset
			contentStyle={{ gap: space.xl }}
		>
			{saved.error || storefront.error ? (
				<ErrorState
					error={saved.error ?? storefront.error}
					onRetry={() => {
						void saved.refetch();
						void storefront.refetch();
					}}
				/>
			) : null}
			<Card>
				<View style={{ gap: space.sm }}>
					<Text variant="label" bold>
						{t("customize.simple")}
					</Text>
					<Text variant="caption" tone="muted">
						{t("customize.simpleShopHelp")}
					</Text>
					<Button
						variant="secondary"
						label={t("customize.useSimple")}
						onPress={() =>
							setDraft((current) => ({
								...SIMPLE_STOREFRONT_APPEARANCE,
								accentColor: current.accentColor,
							}))
						}
					/>
				</View>
			</Card>
			<Text variant="caption" tone="muted">
				{t("customize.draft")}
			</Text>
			<View style={{ gap: space.lg }}>
				<ListRow
					title={t("customize.photos")}
					chevron
					onPress={() =>
						router.push({
							pathname: "/(business)/shop-settings",
							params: { businessId },
						})
					}
				/>
				<Text variant="caption" tone="muted">
					{t("customize.headerStyle")}
				</Text>
				<HeaderStylePicker
					value={draft.header}
					onChange={(header) => setDraft({ ...draft, header })}
				/>
				<WidgetPaletteStrip
					label={t("customize.color")}
					value={shopAccentId(draft.accentColor)}
					scheme={scheme}
					onChange={(themeId) =>
						setDraft({
							...draft,
							accentColor: themeId
								? shopAccentHex(themeId as BusinessThemeId)
								: null,
						})
					}
				/>
				<Field
					label={t("customize.color")}
					value={draft.accentColor ?? ""}
					autoCapitalize="characters"
					maxLength={7}
					onChangeText={(value) =>
						setDraft({ ...draft, accentColor: value.trim() ? value : null })
					}
					error={accent && !accent.valid ? t("customize.colorError") : null}
				/>
				{accent && !accent.valid && accent.suggested ? (
					<Button
						variant="secondary"
						label={t("customize.useSuggestedShade", {
							color: accent.suggested,
						})}
						onPress={() =>
							setDraft({ ...draft, accentColor: accent.suggested })
						}
					/>
				) : null}
			</View>
			<ScreenSection title={t("customize.shopInfo")}>
				<CustomizationRows
					items={draft.sections}
					hidden={draft.hidden}
					labels={LABELS}
					onReorder={(sections) => setDraft({ ...draft, sections })}
					onToggle={(id) =>
						setDraft({
							...draft,
							hidden: draft.hidden.includes(id)
								? draft.hidden.filter((one) => one !== id)
								: [...draft.hidden, id],
						})
					}
					renderPreview={(id) => <ShopSectionPreview id={id} />}
				/>
			</ScreenSection>
			<ScreenSection title={t("customize.preview")}>
				{storefront.data ? (
					<ShopCustomizationPreview
						storefront={storefront.data}
						appearance={draft}
						products={products.data?.items ?? []}
					/>
				) : null}
			</ScreenSection>
			{failure ? (
				<ErrorState error={failure} onRetry={() => void saved.refetch()} />
			) : null}
			<View style={{ gap: space.sm }}>
				<Button
					label={t("customize.save")}
					disabled={
						!saved.data ||
						!dirty ||
						(!!accent && !accent.valid) ||
						save.isPending
					}
					loading={save.isPending}
					onPress={() =>
						run(
							save.mutateAsync({ businessId, revision, configuration: draft }),
						)
					}
				/>
				<Button
					label={t("customize.publish")}
					disabled={!saved.data?.draft || dirty || publish.isPending}
					loading={publish.isPending}
					accessibilityHint={dirty ? t("customize.saveFirst") : undefined}
					onPress={() => run(publish.mutateAsync({ businessId, revision }))}
				/>
				<Button
					variant="secondary"
					label={t("customize.discard")}
					disabled={!saved.data?.draft || discard.isPending}
					onPress={() => run(discard.mutateAsync({ businessId, revision }))}
				/>
				<Button
					variant="secondary"
					label={t("customize.restore")}
					disabled={restore.isPending}
					onPress={() => run(restore.mutateAsync({ businessId, revision }))}
				/>
			</View>
		</Screen>
	);
}
