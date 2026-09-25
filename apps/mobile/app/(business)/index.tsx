import Ionicons from "@expo/vector-icons/Ionicons";
import {
	formatMoney,
	MAX_LINE_QUANTITY,
	type MerchantHome as MerchantHomeData,
	type ProductCard,
} from "@pymeshub/shared";
import {
	type InfiniteData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { BusinessProductRow } from "@/components/business-product-row";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Image } from "@/components/image";
import { ListRow } from "@/components/list-row";
import {
	ITEM_TRACK_HEIGHT,
	MerchantCommandRail,
} from "@/components/merchant-command-rail";
import {
	MerchantOrderRow,
	ROW_MIN_HEIGHT,
} from "@/components/merchant-order-row";
import { MerchantPulse, pulseBandHeight } from "@/components/merchant-pulse";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { Sheet } from "@/components/sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { statusKey } from "@/components/status-badge";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { messageFor, toApiFailure, useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { formatMarketDayMonth, formatMinuteOfDay } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * The merchant home: what needs attention, and the doors to the work.
 *
 * Bands, not cards (§4, §62): the identity header, the pulse band (§14), the
 * orders-now section (§17) and the command rail (§25). The doors card this screen
 * used to draw is gone — the rail is the doors, and a card repeating them would be
 * the second surface for one job.
 *
 * The screen gives up the gutter (`padded={false}`) because two of those bands are
 * full-bleed by construction — the pulse (`./merchant-pulse`) and the command rail
 * (`./merchant-command-rail`) draw edge to edge — and a screen gutter around them
 * would contradict both files' own docblocks. Every padded block carries its own
 * `styles.pad` instead, so `space.lg` is the single gutter, the same shape
 * `app/(business)/products.tsx` asks for.
 *
 * Every figure is a read, and every missing one is a dash rather than a zero:
 *
 * `business.home` supplies the location, today's pulse, attention counts, active
 * orders and catalog preview. The pulse's comparison stays absent until the API
 * can provide one. Order actions remain on the board; product rows open their form.
 *
 * The shop is the first non-courier membership, the same rule every owner screen
 * reads: the board owns shop switching, and a second switcher here would be a
 * second truth about which shop is on screen.
 */

type ProductListPage = {
	items: ProductCard[];
	nextCursor: string | null;
};
type ProductListData = InfiniteData<ProductListPage>;
type Attention = MerchantHomeData["attention"][number];
type PauseDuration = 15 | 30 | 60 | undefined;
type PauseStage = "duration" | "confirm" | null;

function withInventory<T extends object>(
	inventory: T,
	quantity: number,
	maxOrderQuantity: number,
): T {
	return {
		...inventory,
		...("quantity" in inventory ? { quantity } : {}),
		...("stockQuantity" in inventory ? { stockQuantity: quantity } : {}),
		...("maxOrderQuantity" in inventory ? { maxOrderQuantity } : {}),
	} as T;
}

function withAvailability(product: ProductCard, quantity: number): ProductCard {
	const maxOrderQuantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, quantity));
	const inventory = (product.availability as { inventory?: object }).inventory;
	return {
		...product,
		availability: {
			...product.availability,
			inStock: quantity > 0,
			quantity,
			maxOrderQuantity,
			...(inventory
				? { inventory: withInventory(inventory, quantity, maxOrderQuantity) }
				: {}),
		} as ProductCard["availability"],
	};
}

function productNameOf(product: unknown): string | null {
	if (typeof product === "string") return product;
	if (
		product &&
		typeof product === "object" &&
		"name" in product &&
		typeof product.name === "string"
	) {
		return product.name;
	}
	return null;
}

function alertRoute(action: Attention["action"]) {
	switch (action) {
		case "open_orders":
			return "/business" as const;
		case "open_catalog":
		case "open_inventory":
			return "/products" as const;
		case "open_settings":
			return "/(business)/merchant-settings" as const;
		case "open_payouts":
			return "/(business)/payouts" as const;
		case "retry_payment":
			return "/(business)/payments" as const;
		case "contact_support":
			return "/(business)/support" as const;
		default:
			return null;
	}
}

function alertIcon(alert: Attention) {
	switch (alert.type) {
		case "new_order":
		case "order_delay":
			return "receipt-outline" as const;
		case "inventory_low":
		case "inventory_zero":
			return "cube-outline" as const;
		case "store_offline":
			return "storefront-outline" as const;
		case "payment_issue":
			return "card-outline" as const;
		case "settlement_issue":
			return "cash-outline" as const;
		case "catalog_issue":
			return "pricetag-outline" as const;
		default:
			return "alert-circle-outline" as const;
	}
}

export default function MerchantHome() {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const { status } = useSession();
	const cache = useQueryClient();
	const toast = useToast();
	const { colors } = useTheme();
	const scope = useMerchantScope();
	const [locationPickerOpen, setLocationPickerOpen] = useState(false);
	const [statusSheetOpen, setStatusSheetOpen] = useState(false);
	const [pauseStage, setPauseStage] = useState<PauseStage>(null);
	const [pauseDuration, setPauseDuration] = useState<PauseDuration>();

	const signedIn = status === "signed-in";
	const shops = useQuery(
		trpc.business.myBusinesses.queryOptions(undefined, {
			enabled: signedIn,
		}),
	);
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId;
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId: businessId ?? "" },
			{ enabled: signedIn && !!businessId, refetchInterval: 5_000 },
		),
	);
	const selectedLocation =
		locations.data?.find((location) => location.id === scope.locationId) ??
		locations.data?.find((location) => location.isDefault) ??
		locations.data?.[0];
	const locationId = selectedLocation?.id;
	const home = useQuery(
		trpc.business.home.queryOptions(
			{ businessId: businessId ?? "", locationId: locationId ?? "" },
			{
				enabled: signedIn && !!businessId && !!locationId,
				refetchInterval: 5_000,
			},
		),
	);

	const waiting = useSkeletonHold(
		status === "loading" ||
			(signedIn &&
				(shops.isPending ||
					(!!businessId && (locations.isPending || home.isPending)))),
	);
	const failed = shops.error ?? locations.error ?? home.error;

	const dateLabel = formatMarketDayMonth(new Date(), intlLocale);

	const pulse = home.data?.pulse ?? null;

	const orders = home.data?.orders ?? [];

	const setStock = useMutation(
		trpc.products.setStock.mutationOptions({
			onMutate: async ({ id, quantity }) => {
				const listKey = trpc.products.list.pathKey();
				const homeKey = trpc.business.home.pathKey();

				await Promise.all([
					cache.cancelQueries({ queryKey: listKey }),
					cache.cancelQueries({ queryKey: homeKey }),
				]);

				const previousLists = cache.getQueriesData<ProductListData>({
					queryKey: listKey,
				});
				const previousHome = cache.getQueriesData<MerchantHomeData>({
					queryKey: homeKey,
				});

				cache.setQueriesData<ProductListData>(
					{ queryKey: listKey },
					(current) =>
						current && {
							...current,
							pages: current.pages.map((page) => ({
								...page,
								items: page.items.map((product) =>
									product.id === id
										? withAvailability(product, quantity)
										: product,
								),
							})),
						},
				);
				cache.setQueriesData<MerchantHomeData>(
					{ queryKey: homeKey },
					(current) =>
						current && {
							...current,
							catalog: {
								...current.catalog,
								products: current.catalog.products.map((product) =>
									product.id === id
										? withAvailability(product, quantity)
										: product,
								),
							},
						},
				);

				return { previousLists, previousHome };
			},
			onError: (_error, _input, context) => {
				for (const [queryKey, data] of context?.previousLists ?? []) {
					cache.setQueryData(queryKey, data);
				}
				for (const [queryKey, data] of context?.previousHome ?? []) {
					cache.setQueryData(queryKey, data);
				}
			},
			onSettled: async () => {
				await Promise.all([
					cache.invalidateQueries({
						queryKey: trpc.products.pathKey(),
					}),
					cache.invalidateQueries({
						queryKey: trpc.business.home.pathKey(),
					}),
				]);
			},
		}),
	);

	/**
	 * Publishing the shop: DRAFT to ACTIVE, OWNER only, no confirm.
	 *
	 * The button draws only for the OWNER reading their own DRAFT: `setStatus`
	 * asserts the role server-side, so a manager's button would be a control
	 * whose only answer is a refusal. No confirm sheet: going live is reversible
	 * (`setStatus` CLOSED is the way back) and the interface contract's
	 * confirm list (§47) names pausing, closing, deleting and rejecting — not
	 * publishing — and the sheet's red confirm would dress a constructive act
	 * as a destructive one. Landing invalidates the business reads rather than
	 * refetching one: the status word, the pulse and the board's own header all
	 * draw it.
	 */
	const publish = useMutation(
		trpc.business.setStatus.mutationOptions({
			onSuccess: async () => {
				light();
				toast.show(t("biz.onboarding.step.done"));
				await cache.invalidateQueries({
					queryKey: trpc.business.pathKey(),
				});
				await home.refetch();
			},
			onError: (error) => {
				warning();
				if (Platform.OS !== "ios") return;
				const sentence = messageFor(toApiFailure(error));
				AccessibilityInfo.announceForAccessibility(
					t(sentence.key, sentence.params),
				);
			},
		}),
	);
	const publishFailure = useApiFailure(publish.error);

	const refreshOperatingState = async () => {
		await Promise.all([locations.refetch(), home.refetch()]);
	};
	const pause = useMutation(
		trpc.business.pauseLocation.mutationOptions({
			onMutate: () => {
				warning();
				setPauseStage(null);
				setPauseDuration(undefined);
			},
			onSuccess: async () => {
				light();
				toast.show(t("biz.locations.paused"));
				await refreshOperatingState();
			},
			onError: () => setPauseStage(null),
		}),
	);
	const resume = useMutation(
		trpc.business.resumeLocation.mutationOptions({
			onSuccess: async () => {
				light();
				toast.show(t("biz.locations.resumed"));
				await refreshOperatingState();
			},
			onError: () => warning(),
		}),
	);

	const canPublish =
		shop?.role === "OWNER" && home.data?.location.status === "DRAFT";
	const canManage = shop?.role === "OWNER" || shop?.role === "MANAGER";
	const locationPaused =
		selectedLocation?.status === "paused_manual" ||
		selectedLocation?.status === "paused_capacity";
	const canManageOperatingState =
		!!selectedLocation &&
		canManage &&
		(locationPaused || selectedLocation.status === "open");
	const selectedPauseDuration =
		pauseDuration === undefined ? undefined : pauseDuration;
	const locationLabel = selectedLocation
		? selectedLocation.name === shop?.businessName
			? (selectedLocation.city ??
				((locations.data?.length ?? 0) > 1 ? t("biz.locations.title") : null))
			: [selectedLocation.name, selectedLocation.city]
					.filter(Boolean)
					.join(" · ")
		: null;

	return (
		<>
			<Screen
				// Edge-to-edge body: the pulse band and the command rail are full-bleed by
				// construction, so the padded blocks below pay their own `styles.pad`.
				padded={false}
				scroll
				contentStyle={styles.body}
				onRefresh={async () => {
					// Refresh the membership and the dashboard it scopes.
					await Promise.all([
						shops.refetch(),
						locations.refetch(),
						home.refetch(),
					]);
				}}
			>
				{/* The failure, tested before the absence of data: a `myBusinesses` read that
		    failed leaves no `shops.data` behind, so the skeleton branch would hold the
		    screen forever with nothing to say. */}
				{failed ? (
					<ErrorState
						error={failed}
						onRetry={() => {
							void shops.refetch();
							void locations.refetch();
							void home.refetch();
						}}
					/>
				) : waiting || !shops.data ? (
					<HomeSkeleton loadingLabel={t("state.loading")} />
				) : !shop || !businessId ? (
					<EmptyState
						icon="storefront-outline"
						title={t("biz.onboarding.title")}
						body={t("biz.onboarding.notLive")}
						actionLabel={t("biz.onboarding.create")}
						onAction={() => router.push("/new-business")}
					/>
				) : (
					<>
						<View style={styles.merchantHeader}>
							<View style={styles.merchantBrand}>
								<Image
									uri={home.data?.location.logoUrl}
									style={[styles.merchantLogo, { borderColor: colors.border }]}
									radiusToken="md"
									accessibilityElementsHidden
								>
									{home.data?.location.logoUrl ? null : (
										<Text variant="title" bold>
											{shop.businessName.trim().charAt(0).toUpperCase()}
										</Text>
									)}
								</Image>
								<View style={styles.merchantIdentity}>
									<Text variant="title" bold numberOfLines={1}>
										{shop.businessName}
									</Text>
									{selectedLocation && locationLabel ? (
										<Pressable
											onPress={() => setLocationPickerOpen(true)}
											disabled={(locations.data?.length ?? 0) < 2}
											disabledOpacity={1}
											accessibilityRole="button"
											accessibilityLabel={`${selectedLocation.name}, ${selectedLocation.city ?? ""}`}
											accessibilityHint={
												(locations.data?.length ?? 0) > 1
													? t("biz.locations.select")
													: undefined
											}
											style={styles.locationLine}
										>
											<Ionicons
												name="location-outline"
												size={icon.inline}
												color={colors.mutedForeground}
											/>
											<Text variant="label" tone="muted" numberOfLines={1}>
												{locationLabel}
											</Text>
											{(locations.data?.length ?? 0) > 1 ? (
												<Ionicons
													name="chevron-down"
													size={icon.inline}
													color={colors.mutedForeground}
												/>
											) : null}
										</Pressable>
									) : null}
								</View>
							</View>
							{selectedLocation ? (
								<View style={styles.operatingState}>
									<Pressable
										onPress={() => setStatusSheetOpen(true)}
										disabled={pause.isPending || resume.isPending}
										disabledOpacity={1}
										accessibilityRole="button"
										accessibilityLabel={t(
											`biz.locations.status.${selectedLocation.status}`,
										)}
										style={[
											styles.statusControl,
											{
												backgroundColor: colors.muted,
												borderColor: colors.border,
											},
										]}
									>
										<View style={styles.statusLine}>
											<View
												style={[
													styles.statusDot,
													{
														backgroundColor:
															selectedLocation.status === "open"
																? colors.success
																: locationPaused
																	? colors.warning
																	: colors.mutedForeground,
													},
												]}
											/>
											<Text variant="label" bold>
												{t(`biz.locations.status.${selectedLocation.status}`)}
											</Text>
										</View>
										<Ionicons
											name="chevron-forward"
											size={icon.control}
											color={colors.mutedForeground}
										/>
									</Pressable>
								</View>
							) : null}
						</View>
						{pause.error || resume.error ? (
							<View style={styles.pad}>
								<ErrorState error={pause.error ?? resume.error} />
							</View>
						) : null}

						{/* A shop that has never opened: the word above says Borrador,
					    and this is the way out of it. Above the pulse, because a
					    closed shop's day has no figures worth leading with. */}
						{canPublish ? (
							<View style={styles.pad}>
								<Card>
									<Text variant="body" bold>
										{t("biz.onboarding.notLive")}
									</Text>
									<Button
										// Secondary, not the filled variant: the moment's one lime is
										// the rail's item below, and a DRAFT shop would otherwise
										// spend the accent twice on one view (§6).
										variant="secondary"
										label={t("biz.dashboard.openToggle")}
										onPress={() => {
											if (!businessId || publish.isPending) return;
											publish.mutate({ businessId, status: "ACTIVE" });
										}}
										loading={publish.isPending}
										disabled={publish.isPending}
										accessibilityHint={t("biz.onboarding.notLive")}
									/>
									{publishFailure.message ? (
										<Text
											variant="body"
											tone="destructive"
											accessibilityRole="alert"
											accessibilityLiveRegion="assertive"
										>
											{publishFailure.message}
										</Text>
									) : null}
								</Card>
							</View>
						) : null}

						{/* Full-bleed by construction: the band draws edge to edge, and the
					    screen's `padded={false}` is what lets it. */}
						<MerchantPulse data={pulse} dateLabel={dateLabel} />

						<MerchantInsight
							items={[
								{
									label: t("biz.insight.estimatedMargin"),
									value:
										home.data?.insights.estimatedMarginPercent == null
											? null
											: `${home.data.insights.estimatedMarginPercent}%`,
								},
								{
									label: t("biz.insight.topProduct"),
									value: productNameOf(home.data?.insights.topProduct),
								},
								{
									label: t("biz.insight.avgPreparation"),
									value:
										home.data?.insights.averagePreparationMinutes == null
											? null
											: t("unit.minutes", {
													count: home.data.insights.averagePreparationMinutes,
												}),
								},
								{
									label: t("biz.payouts.net"),
									value:
										home.data?.insights.projectedPayoutMinor == null
											? null
											: formatMoney(
													home.data.insights.projectedPayoutMinor,
													home.data.location.currency,
													{ locale: intlLocale },
												),
								},
							]}
						/>

						{home.data && home.data.attention.length > 0 ? (
							<View style={styles.pad}>
								<SectionHeader title={t("biz.home.attention")} />
								{/* All but the last row drop the trailing hairline the row's own
						    default draws — the rhythm the board's rows keep with `last`, so
								a card of rows never ends in a line for nobody. */}
								{home.data.attention.map((alert, index) => (
									<AttentionRow
										key={alert.id}
										alert={alert}
										last={index === home.data.attention.length - 1}
									/>
								))}
							</View>
						) : null}

						<View style={styles.pad}>
							<SectionHeader
								title={t("biz.board.sectionTitle")}
								action={{
									label: t("action.viewAll"),
									onPress: () => router.push("/business"),
									accessibilityHint: t("biz.dashboard.viewBoard"),
								}}
							/>
						</View>
						{orders.length === 0 ? (
							<View style={styles.pad}>
								<EmptyState
									icon="receipt-outline"
									title={t("biz.board.caughtUp")}
									body={t("biz.board.empty.body")}
								/>
							</View>
						) : (
							<View>
								{orders.map((order, index) => (
									// Full-bleed, like the board's queue: the row pays its own
									// gutters (`merchant-order-row`'s `main`/`aside`), so a `pad`
									// wrapper here would double them and put the ink at 48 points
									// under a section title sitting at 24.
									<MerchantOrderRow
										key={order.id}
										onPress={() =>
											router.push({
												pathname: "/merchant-order/[id]",
												params: { id: order.id },
											})
										}
										reference={order.reference}
										headline={order.headline}
										fulfilmentLabel={t(
											order.fulfilment === "PICKUP"
												? "order.pickup"
												: "order.delivery",
										)}
										status={order.status}
										statusLabel={t(statusKey(order.status))}
										totalLabel={formatMoney(order.totalMinor, order.currency, {
											locale: intlLocale,
										})}
										urgent={order.status === "PENDING" ? "new" : null}
										last={index === orders.length - 1}
									/>
								))}
							</View>
						)}

						{/* The doors, as the rail (§25) rather than the card it replaces:
					    every destination is a route in this tree, so no action leads
					    nowhere. Adding a product is the moment's one filled control. */}
						<MerchantCommandRail
							actions={[
								{
									key: "add-product",
									label: t("biz.products.add"),
									icon: "add-outline",
									primary: true,
									onPress: () =>
										router.push({
											pathname: "/product-form",
											params: { businessId },
										}),
								},
								{
									key: "orders",
									label: t("biz.nav.orders"),
									icon: "receipt-outline",
									onPress: () => router.push("/business"),
								},
								{
									key: "menu",
									label: t("biz.nav.menu"),
									icon: "fast-food-outline",
									onPress: () => router.push("/products"),
								},
							]}
						/>

						{home.data ? (
							<View style={styles.pad}>
								<SectionHeader
									title={t("biz.nav.menu")}
									action={{
										label: t("action.viewAll"),
										onPress: () => router.push("/products"),
									}}
								/>
								<Text variant="caption" tone="muted">
									{t("biz.locations.allBusiness")}
								</Text>
								<Text variant="caption" tone="muted" tabular>
									{t("biz.home.catalogSummary", {
										active: home.data.catalog.active,
										draft: home.data.catalog.draft,
										outOfStock: home.data.catalog.outOfStock,
									})}
								</Text>
								{home.data.catalog.products.length === 0 ? (
									<Text variant="body" tone="muted">
										{t("biz.products.empty.title")}
									</Text>
								) : (
									home.data.catalog.products.map((product) => (
										<BusinessProductRow
											key={product.id}
											product={product}
											onPress={() =>
												router.push({
													pathname: "/product-form",
													params: { businessId, id: product.id },
												})
											}
											onAvailabilityChange={(quantity) => {
												if (!businessId) return;
												setStock.mutate({
													businessId,
													id: product.id,
													quantity,
												});
											}}
											availabilityPending={
												setStock.isPending &&
												setStock.variables?.id === product.id
											}
										/>
									))
								)}
							</View>
						) : null}
					</>
				)}
			</Screen>
			<Sheet
				open={locationPickerOpen}
				onClose={() => setLocationPickerOpen(false)}
				title={t("biz.locations.select")}
				closeLabel={t("action.close")}
			>
				<Card>
					{(locations.data ?? []).map((location, index, all) => (
						<ListRow
							key={location.id}
							title={location.name}
							subtitle={[
								location.city,
								t(`biz.locations.status.${location.status}`),
							]
								.filter(Boolean)
								.join(" · ")}
							state={
								location.id === locationId
									? t("biz.locations.current")
									: undefined
							}
							divider={index < all.length - 1}
							onPress={() => {
								if (businessId) scope.selectLocation(businessId, location.id);
								setLocationPickerOpen(false);
							}}
						/>
					))}
				</Card>
			</Sheet>
			<Sheet
				open={statusSheetOpen}
				onClose={() => setStatusSheetOpen(false)}
				title={t("biz.locations.status.title")}
				closeLabel={t("action.close")}
			>
				<Card>
					<View style={styles.statusSheetState}>
						<View style={styles.statusLine}>
							<View
								style={[
									styles.statusDot,
									{
										backgroundColor:
											selectedLocation?.status === "open"
												? colors.success
												: locationPaused
													? colors.warning
													: colors.mutedForeground,
									},
								]}
							/>
							<Text variant="label" bold>
								{selectedLocation
									? t(`biz.locations.status.${selectedLocation.status}`)
									: null}
							</Text>
						</View>
						{selectedLocation?.todayHours ? (
							<Text variant="caption" tone="muted">
								{t("biz.dashboard.today")} ·{" "}
								{formatMinuteOfDay(
									selectedLocation.todayHours.opensMinute,
									intlLocale,
								)}
								–
								{formatMinuteOfDay(
									selectedLocation.todayHours.closesMinute,
									intlLocale,
								)}
							</Text>
						) : null}
					</View>
					{canManageOperatingState && businessId && selectedLocation ? (
						<ListRow
							title={t(
								locationPaused ? "biz.locations.resume" : "biz.locations.pause",
							)}
							chevron
							divider={false}
							onPress={() => {
								setStatusSheetOpen(false);
								if (locationPaused) {
									resume.mutate({
										businessId,
										locationId: selectedLocation.id,
									});
									return;
								}
								setPauseDuration(undefined);
								setPauseStage("duration");
							}}
						/>
					) : null}
				</Card>
			</Sheet>
			<Sheet
				open={pauseStage === "duration"}
				onClose={() => {
					setPauseStage(null);
					setPauseDuration(undefined);
				}}
				title={t("biz.locations.pause")}
				closeLabel={t("action.close")}
			>
				<Card>
					{([15, 30, 60] as const).map((minutes) => (
						<ListRow
							key={minutes}
							title={t("biz.locations.minutes", { count: minutes })}
							chevron
							onPress={() => {
								setPauseDuration(minutes);
								setPauseStage("confirm");
							}}
						/>
					))}
					<ListRow
						title={t("biz.locations.untilResumed")}
						divider={false}
						chevron
						onPress={() => {
							setPauseDuration(undefined);
							setPauseStage("confirm");
						}}
					/>
				</Card>
			</Sheet>
			<ConfirmSheet
				open={pauseStage === "confirm"}
				onClose={() => {
					setPauseStage(null);
					setPauseDuration(undefined);
				}}
				title={t("biz.locations.pauseConfirm")}
				body={
					selectedLocation
						? `${selectedLocation.name} · ${
								selectedPauseDuration
									? t("biz.locations.minutes", {
											count: selectedPauseDuration,
										})
									: t("biz.locations.untilResumed")
							}`
						: undefined
				}
				confirmLabel={t("biz.locations.pause")}
				onConfirm={() => {
					if (!businessId || !selectedLocation) return;
					pause.mutate({
						businessId,
						locationId: selectedLocation.id,
						reason: "capacity",
						durationMinutes: selectedPauseDuration,
					});
				}}
			/>
		</>
	);
}

function MerchantInsight({
	items,
}: {
	items: { value: string | null; label: string }[];
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.insight,
				{
					borderTopColor: colors.border,
					borderBottomColor: colors.border,
				},
			]}
		>
			{items.map((item) => (
				<View
					key={item.label}
					style={styles.insightItem}
					accessible
					accessibilityRole="text"
					accessibilityLabel={`${item.label}: ${item.value ?? "—"}`}
				>
					<Text variant="caption" tone="muted">
						{item.label}
					</Text>
					<Text variant="body" bold>
						{item.value ?? "—"}
					</Text>
				</View>
			))}
		</View>
	);
}

function AttentionRow({ alert, last }: { alert: Attention; last: boolean }) {
	const { colors } = useTheme();
	const route = alertRoute(alert.action);
	const semantic =
		alert.severity === "critical"
			? colors.destructive
			: alert.severity === "warning"
				? colors.warning
				: colors.primary;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={alert.title}
			accessibilityHint={alert.description}
			onPress={route ? () => router.push(route) : undefined}
			style={({ pressed }) => [
				styles.attentionRow,
				{ borderBottomColor: colors.border },
				last ? null : styles.attentionDivider,
				pressed ? { backgroundColor: colors.muted } : null,
			]}
		>
			<View style={[styles.attentionRail, { backgroundColor: semantic }]} />
			<Ionicons name={alertIcon(alert)} size={20} color={semantic} />
			<Text style={styles.attentionCopy}>{alert.title}</Text>
			{route ? (
				<Ionicons
					name="chevron-forward"
					size={20}
					color={colors.mutedForeground}
				/>
			) : null}
		</Pressable>
	);
}

/** The header, the band, the rows and the rail, in grey. */
function HomeSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={loadingLabel}
		>
			<View style={styles.merchantHeader}>
				<View style={styles.merchantBrand}>
					<Skeleton style={styles.skeletonLogo} />
					<View style={styles.skeletonIdentity}>
						<Skeleton style={[styles.skeletonName, line("title", fontScale)]} />
						<Skeleton style={[styles.skeletonMeta, line("label", fontScale)]} />
					</View>
				</View>
				<Skeleton style={styles.skeletonStatus} />
			</View>
			{/* The pulse band's stand-in: full-bleed, at the band's own height, scaled where
			    the band scales. The measure is `./merchant-pulse`'s own — the wait and the
			    arrival cannot disagree about it without that file saying so. */}
			<Skeleton style={{ minHeight: pulseBandHeight(fontScale) }} />
			<View style={styles.pad}>
				<Skeleton style={[styles.skeletonMeta, line("heading", fontScale)]} />
				<Skeleton style={{ minHeight: ROW_MIN_HEIGHT * fontScale }} />
			</View>
			<View style={styles.pad}>
				<Skeleton style={[styles.skeletonMeta, line("heading", fontScale)]} />
			</View>
			{SKELETON_ROWS.map((row) => (
				<View key={row} style={styles.pad}>
					{/* One dense queue row, at the row's own floor, scaled with the text. */}
					<Skeleton style={{ minHeight: ROW_MIN_HEIGHT * fontScale }} />
				</View>
			))}
			{/* The command rail's stand-in, at the rail's own track, scaled with the text. */}
			<Skeleton style={{ minHeight: ITEM_TRACK_HEIGHT * fontScale }} />
			<View style={styles.pad}>
				<Skeleton style={[styles.skeletonMeta, line("heading", fontScale)]} />
				{SKELETON_ROWS.map((row) => (
					<Skeleton
						key={row}
						style={{ minHeight: ROW_MIN_HEIGHT * fontScale }}
					/>
				))}
			</View>
		</View>
	);
}

const SKELETON_ROWS = [0, 1, 2] as const;

const styles = StyleSheet.create({
	body: { gap: space.lg },
	pad: { paddingHorizontal: space.lg },
	merchantHeader: {
		minHeight: 124,
		gap: space.sm,
		paddingHorizontal: space.xl,
		paddingTop: space.md,
		paddingBottom: space.sm,
	},
	merchantBrand: { flexDirection: "row", alignItems: "center", gap: space.md },
	merchantLogo: { width: 56, height: 56, borderWidth: 1 },
	merchantIdentity: { flex: 1, alignItems: "flex-start", gap: TEXT_STACK_GAP },
	locationLine: { flexDirection: "row", alignItems: "center", gap: space.xs },
	operatingState: { alignSelf: "flex-start" },
	statusControl: {
		minHeight: MIN_TOUCH_TARGET,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		borderWidth: 1,
		borderRadius: radius.md,
		paddingHorizontal: space.md,
	},
	statusLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
	statusDot: { width: 8, height: 8, borderRadius: radius.full },
	statusSheetState: {
		gap: space.xs,
		paddingHorizontal: space.md,
		paddingVertical: space.md,
	},
	skeletonLogo: { width: 56, height: 56 },
	skeletonIdentity: { flex: 1, gap: TEXT_STACK_GAP },
	skeletonStatus: { minHeight: MIN_TOUCH_TARGET },
	skeletonName: { width: "55%" },
	skeletonMeta: { width: "40%" },
	insight: {
		flexDirection: "row",
		gap: space.md,
		paddingHorizontal: space.xl,
		paddingVertical: space.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	insightItem: { flex: 1, gap: space.xs },
	attentionRow: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		paddingVertical: space.sm,
	},
	attentionDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
	attentionRail: { width: 4, alignSelf: "stretch" },
	attentionCopy: { flex: 1 },
});
