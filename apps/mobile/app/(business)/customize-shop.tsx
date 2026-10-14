import {
	brandAccentCheck,
	DEFAULT_STOREFRONT_APPEARANCE,
	type StorefrontAppearance,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { CustomizationRows } from "@/components/customization-rows";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { ShopCustomizationSections } from "@/components/shop-customization-sections";
import { Text } from "@/components/text";
import { bandAnchor } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { space, useTheme } from "@/theme";

const LABELS = {
	information: "customize.shopInfo",
	offers: "customize.offers",
	featured: "customize.featured",
} as const;

export default function CustomizeShop() {
	const { t } = useT();
	const { colors } = useTheme();
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
		<Screen title={t("customize.shop")} scroll bottomInset>
			{saved.error || storefront.error ? (
				<ErrorState
					error={saved.error ?? storefront.error}
					onRetry={() => {
						void saved.refetch();
						void storefront.refetch();
					}}
				/>
			) : null}
			<Text variant="body" tone="muted">
				{t("customize.draft")}
			</Text>
			<ScreenSection title={t("customize.shop")}>
				<View style={{ gap: space.sm }}>
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
					<Button
						variant="secondary"
						label={t("customize.cover")}
						selected={draft.header === "cover"}
						onPress={() => setDraft({ ...draft, header: "cover" })}
					/>
					<Button
						variant="secondary"
						label={t("customize.compact")}
						selected={draft.header === "compact"}
						onPress={() => setDraft({ ...draft, header: "compact" })}
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
							label={accent.suggested}
							onPress={() =>
								setDraft({ ...draft, accentColor: accent.suggested })
							}
						/>
					) : null}
				</View>
			</ScreenSection>
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
				/>
			</ScreenSection>
			<ScreenSection title={t("customize.preview")}>
				<Card>
					{storefront.data ? (
						<View style={{ gap: space.md }}>
							{draft.header === "cover" && storefront.data.card.coverUrl ? (
								<Image
									source={{ uri: storefront.data.card.coverUrl }}
									style={{ width: "100%", height: 150, borderRadius: 12 }}
									accessibilityIgnoresInvertColors
								/>
							) : null}
							<Text
								variant="title"
								bold
								style={{
									color:
										draft.accentColor && accent?.valid
											? bandAnchor(draft.accentColor, colors.card)
											: colors.foreground,
								}}
							>
								{storefront.data.card.name}
							</Text>
							<Text variant="body">
								{storefront.data.isOpen ? t("store.open") : t("store.closed")}
							</Text>
							<Text variant="body" tone="muted">
								{t("search.title")} · {t("nav.cart")}
							</Text>
							<ShopCustomizationSections
								appearance={draft}
								card={storefront.data.card}
								hours={storefront.data.hours}
								isOpen={storefront.data.isOpen}
								preview
							/>
							<Text variant="body" bold>
								{t("biz.nav.products")}
							</Text>
							{storefront.data.categories.map((category) => (
								<Text key={category.id} variant="caption" tone="muted">
									{category.name}
								</Text>
							))}
							{products.data?.items.map((product) => (
								<Text key={product.id} variant="body">
									{product.title}
								</Text>
							))}
							<Text variant="body" tone="muted">
								{t("biz.reviews.title")} · {storefront.data.card.ratingCount}
							</Text>
						</View>
					) : null}
				</Card>
			</ScreenSection>
			{failure ? (
				<ErrorState error={failure} onRetry={() => void saved.refetch()} />
			) : null}
			<Button
				label={t("customize.save")}
				disabled={
					!saved.data || !dirty || (!!accent && !accent.valid) || save.isPending
				}
				loading={save.isPending}
				onPress={() =>
					run(save.mutateAsync({ businessId, revision, configuration: draft }))
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
		</Screen>
	);
}
