import { Ionicons } from "@expo/vector-icons";
import { type MessageKey, MOVE_LABELS } from "@pymeshub/i18n";
import {
	type FulfilmentKind,
	formatMoney,
	MARKET_TIME_ZONE,
	MAX_LINE_QUANTITY,
	type MerchantHome as MerchantHomeData,
	nextStatuses,
	ORDER_STATUSES,
	type OrderStatus,
	type ProductCard,
} from "@pymeshub/shared";
import {
	type InfiniteData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
	type MerchantRowAction,
	ROW_MIN_HEIGHT,
} from "@/components/merchant-order-row";
import {
	MerchantPulse,
	type MerchantPulseData,
	pulseBandHeight,
} from "@/components/merchant-pulse";
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
import {
	formatClock,
	formatDayMonth,
	formatMinuteOfDay,
	formatRelative,
} from "@/lib/format";
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
 * Bands, not cards (┬º4, ┬º62): the identity header, the pulse band (┬º14), the
 * orders-now section (┬º17) and the command rail (┬º25). The doors card this screen
 * used to draw is gone ΓÇö the rail is the doors, and a card repeating them would be
 * the second surface for one job.
 *
 * The screen gives up the gutter (`padded={false}`) because two of those bands are
 * full-bleed by construction ΓÇö the pulse (`./merchant-pulse`) and the command rail
 * (`./merchant-command-rail`) draw edge to edge ΓÇö and a screen gutter around them
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
type AttentionGroup = Attention & { count: number };
type PauseDuration = 15 | 30 | 60 | undefined;
type PauseStage = "duration" | "confirm" | null;
type CachedOrder = MerchantHomeData["orders"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isCachedOrder(value: unknown): value is CachedOrder {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.status === "string" &&
		(ORDER_STATUSES as readonly string[]).includes(value.status)
	);
}

function findCachedOrder(
	value: unknown,
	orderId: string,
): CachedOrder | undefined {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const order = findCachedOrder(entry, orderId);
			if (order) return order;
		}
		return undefined;
	}

	if (!isRecord(value)) return undefined;
	if (isCachedOrder(value) && value.id === orderId) return value;

	const record = value as Record<string, unknown>;
	for (const key of ["orders", "items", "pages"]) {
		const order = findCachedOrder(record[key], orderId);
		if (order) return order;
	}

	return undefined;
}

function replaceCachedOrderStatus<T>(
	value: T,
	orderId: string,
	status: OrderStatus,
): T {
	if (Array.isArray(value)) {
		let changed = false;
		const next = value.map((entry) => {
			const replacement = replaceCachedOrderStatus(entry, orderId, status);
			if (replacement !== entry) changed = true;
			return replacement;
		});
		return changed ? (next as T) : value;
	}

	if (!isRecord(value)) return value;
	if (isCachedOrder(value) && value.id === orderId) {
		return { ...value, status } as T;
	}

	let changed = false;
	const next: Record<string, unknown> = { ...value };
	for (const key of ["orders", "items", "pages"]) {
		if (!(key in next)) continue;
		const replacement = replaceCachedOrderStatus(next[key], orderId, status);
		if (replacement !== next[key]) {
			next[key] = replacement;
			changed = true;
		}
	}

	return changed ? (next as T) : value;
}

function moveLabelKey(to: OrderStatus, fulfilment: FulfilmentKind): MessageKey {
	if (to === "COMPLETED") {
		return fulfilment === "PICKUP"
			? "biz.board.markPickedUp"
			: "biz.board.markDelivered";
	}
	return MOVE_LABELS[to];
}

function withAvailability(product: ProductCard, quantity: number): ProductCard {
	return {
		...product,
		availability: {
			...product.availability,
			inStock: quantity > 0,
			quantity,
			maxOrderQuantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, quantity)),
		},
	};
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
	const analyticsRange = useMemo(() => {
		const to = new Date();
		const from = new Date(to);
		from.setUTCHours(0, 0, 0, 0);
		return { from, to };
	}, []);
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
	const analytics = useQuery(
		trpc.business.analytics.queryOptions(
			{
				businessId: businessId ?? "",
				locationId: locationId ?? "",
				timezone: MARKET_TIME_ZONE,
				from: analyticsRange.from,
				to: analyticsRange.to,
			},
			{
				enabled:
					signedIn &&
					!!businessId &&
					!!locationId &&
					(shop?.role === "OWNER" || shop?.role === "MANAGER"),
				refetchInterval: 5_000,
			},
		),
	);

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
	const failed =
		shops.error ?? locations.error ?? home.error ?? analytics.error;

	const dateLabel = formatDayMonth(new Date(), intlLocale);
	const dashboardQueries = [shops, locations, home, analytics];
	const latestUpdate = Math.max(
		...dashboardQueries.map((query) => query.dataUpdatedAt),
	);
	const syncing = dashboardQueries.some((query) => query.isFetching);
	const updateAge = Date.now() - latestUpdate;
	const relativeUpdate = latestUpdate
		? formatRelative(latestUpdate, intlLocale)
		: null;
	const updateClock = latestUpdate
		? formatClock(latestUpdate, intlLocale)
		: null;
	const updateDescription = relativeUpdate ?? updateClock;
	const isStale = updateAge >= 5 * 60_000;
	const freshnessLabel = syncing
		? t("biz.dashboard.syncing")
		: updateAge < 60_000
			? t("biz.dashboard.updatedJustNow")
			: isStale
				? t("biz.dashboard.updatedStale", {
						relative: updateDescription ?? "",
					})
				: t("biz.dashboard.updatedRelative", {
						relative: updateDescription ?? "",
					});

	/**
	 * The pulse's three figures, from the reads above and nothing else. The money
	 * entry is matched on the shop's own currency: a repriced shop whose today
	 * revenue arrived in another code draws dashes, not another currency's figure
	 * under this one's label. The orders column counts every order placed today;
	 * the average divides the completed revenue by the completed count, the set it
	 * came from ΓÇö both honest numbers, neither invented.
	 */
	const pulse: MerchantPulseData | null = home.data?.pulse ?? null;
	const attention = useMemo<AttentionGroup[]>(() => {
		const grouped = new Map<string, AttentionGroup>();
		for (const alert of home.data?.attention ?? []) {
			const key = `${alert.type}:${alert.action ?? ""}`;
			const current = grouped.get(key);
			grouped.set(
				key,
				current
					? { ...current, count: current.count + 1 }
					: { ...alert, count: 1 },
			);
		}
		return [...grouped.values()];
	}, [home.data?.attention]);

	const orders = home.data?.orders ?? [];

	const advance = useMutation(
		trpc.orders.advance.mutationOptions({
			onMutate: async ({ orderId, to }) => {
				const homeKey = trpc.business.home.pathKey();
				const previousHome = cache.getQueriesData<MerchantHomeData>({
					queryKey: homeKey,
				});
				await cache.cancelQueries({ queryKey: homeKey });
				cache.setQueriesData<MerchantHomeData>(
					{ queryKey: homeKey },
					(current) =>
						current ? replaceCachedOrderStatus(current, orderId, to) : current,
				);
				return { previousHome };
			},
			onError: async (error, _variables, context) => {
				for (const [queryKey, data] of context?.previousHome ?? []) {
					cache.setQueryData(queryKey, data);
				}
				warning();

				if (toApiFailure(error).code !== "CONFLICT") {
					toast.show(t("biz.board.moveFailed"));
					return;
				}

				await cache.invalidateQueries({
					queryKey: trpc.orders.pathKey(),
				});
				let refreshed: CachedOrder | undefined;
				for (const [, data] of cache.getQueriesData<unknown>({
					queryKey: trpc.orders.pathKey(),
				})) {
					refreshed ??= findCachedOrder(data, _variables.orderId);
					if (refreshed) break;
				}

				toast.show(
					refreshed
						? t("biz.board.conflict.body", {
								status: t(statusKey(refreshed.status)),
							})
						: t("biz.board.conflict.title"),
				);
			},
			onSuccess: async (_data, variables) => {
				light();
				toast.show(
					t("biz.board.movedTo", {
						status: t(statusKey(variables.to)),
					}),
				);
				await cache.invalidateQueries({
					queryKey: trpc.orders.pathKey(),
				});
			},
		}),
	);

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
	 * confirm list (┬º47) names pausing, closing, deleting and rejecting ΓÇö not
	 * publishing ΓÇö and the sheet's red confirm would dress a constructive act
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
	const refreshDashboard = async () => {
		await Promise.all([
			shops.refetch(),
			locations.refetch(),
			home.refetch(),
			analytics.refetch(),
		]);
	};
	const pause = useMutation(
		trpc.business.pauseLocation.mutationOptions({
			onMutate: () => {
				warning();
				setPauseStage(null);
				setPauseDuration(undefined);
			},
			onSuccess: async (_data, variables) => {
				light();
				// ┬º46's trailing Undo ΓÇö see `./locations`, which draws the same pair for the same
				// write, and `components/toast` for why the sentence and the button are siblings.
				toast.show(t("biz.locations.paused"), () => {
					resume.mutate({
						businessId: variables.businessId,
						locationId: variables.locationId,
					});
				});
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

	return (
		<>
			<Screen
				// Edge-to-edge body: the pulse band and the command rail are full-bleed by
				// construction, so the padded blocks below pay their own `styles.pad`.
				padded={false}
				scroll
				contentStyle={styles.body}
				onRefresh={refreshDashboard}
			>
				{/* The failure, tested before the absence of data: a `myBusinesses` read that
		    failed leaves no `shops.data` behind, so the skeleton branch would hold the
		    screen forever with nothing to say. */}
				{failed ? (
					<ErrorState error={failed} onRetry={() => void refreshDashboard()} />
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
								{selectedLocation ? (
									<View style={styles.operatingState}>
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
												size={14}
												color={colors.mutedForeground}
											/>
											<Text variant="label" tone="muted" numberOfLines={1}>
												{(locations.data?.length ?? 0) === 1 &&
												selectedLocation.name === shop.businessName
													? (selectedLocation.city ?? selectedLocation.name)
													: [selectedLocation.name, selectedLocation.city]
															.filter(Boolean)
															.join(" ┬╖ ")}
											</Text>
											{(locations.data?.length ?? 0) > 1 ? (
												<Ionicons
													name="chevron-down"
													size={14}
													color={colors.mutedForeground}
												/>
											) : null}
										</Pressable>
										{selectedLocation.todayHours ? (
											<Text variant="caption" tone="muted">
												{t("biz.dashboard.today")} ┬╖{" "}
												{formatMinuteOfDay(
													selectedLocation.todayHours.opensMinute,
													intlLocale,
												)}
												ΓÇô
												{formatMinuteOfDay(
													selectedLocation.todayHours.closesMinute,
													intlLocale,
												)}
											</Text>
										) : null}
									</View>
								) : null}
								{selectedLocation ? (
									<Pressable
										onPress={() => {
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
										disabled={
											!canManageOperatingState ||
											pause.isPending ||
											resume.isPending
										}
										disabledOpacity={1}
										accessibilityRole="button"
										accessibilityLabel={t(
											`biz.locations.status.${selectedLocation.status}`,
										)}
										accessibilityHint={
											canManageOperatingState
												? t(
														locationPaused
															? "biz.locations.resume"
															: "biz.locations.pause",
													)
												: undefined
										}
										style={[
											styles.statusControl,
											{ backgroundColor: colors.muted },
										]}
									>
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
										{canManageOperatingState ? (
											<Ionicons
												name={locationPaused ? "play-outline" : "chevron-down"}
												size={16}
												color={colors.foreground}
											/>
										) : null}
									</Pressable>
								) : null}
							</View>
							{/* ┬º12's third column. The layout it draws is `logo | identity |
						    controls (notification, profile)`, and the first two were already
						    here: this is the pair on the right, top-aligned with the logo so it
						    answers the *title* rather than floating in the middle of a header
						    that grows at 200% text.

						    Both doors leave the business tree, and both already exist as root
						    screens of their own ΓÇö `app/inbox` is the bell's whole job ("What the
						    shop has told you: the bell, as a list") and `app/profile` is the
						    fields `./more` already links to. One bell rather than a second
						    notifications screen, for the reason `components/home-header` has one
						    avatar. The profile is an icon and not `home-header`'s initials because
						    this screen reads the shop and not `users.me`, and a header that drew a
						    name it never fetched would be the file's own "a control for something
						    the API has not confirmed" one step earlier. */}
							<View style={styles.merchantControls}>
								<Pressable
									onPress={() => router.push("/inbox")}
									accessibilityRole="button"
									accessibilityLabel={t("account.inbox")}
									accessibilityHint={t("account.inbox.help")}
									style={styles.headerControl}
								>
									<Ionicons
										name="notifications-outline"
										size={icon.action}
										color={colors.foreground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								</Pressable>
								<Pressable
									onPress={() => router.push("/profile")}
									accessibilityRole="button"
									accessibilityLabel={t("account.profile.title")}
									style={styles.headerControl}
								>
									<Ionicons
										name="person-circle-outline"
										size={icon.action}
										color={colors.foreground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								</Pressable>
							</View>
						</View>
						<View style={styles.syncRow}>
							<View style={styles.syncStatus} accessibilityLiveRegion="polite">
								<Ionicons
									name={syncing ? "sync-outline" : "cloud-done-outline"}
									size={20}
									color={syncing ? colors.primary : colors.mutedForeground}
									importantForAccessibility="no-hide-descendants"
									accessibilityElementsHidden
								/>
								<Text style={styles.syncLabel}>{freshnessLabel}</Text>
							</View>
							<Pressable
								onPress={refreshDashboard}
								accessibilityRole="button"
								accessibilityLabel={t("biz.dashboard.refresh")}
								accessibilityHint={t("biz.dashboard.refreshHelp")}
								style={({ pressed }) => [
									styles.syncControl,
									pressed ? { backgroundColor: colors.muted } : null,
									syncing ? { opacity: 0.6 } : null,
								]}
							>
								<Ionicons name="refresh" size={24} color={colors.primary} />
							</Pressable>
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
										// spend the accent twice on one view (┬º6).
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
									label: t("biz.dashboard.topProducts"),
									value: analytics.data?.topProducts[0]?.name ?? null,
								},
								{
									label: t("biz.insight.avgPreparation"),
									value:
										analytics.data?.operations.avg_preparation_seconds == null
											? null
											: t("unit.minutes", {
													count: Math.round(
														analytics.data.operations.avg_preparation_seconds /
															60,
													),
												}),
								},
								{
									label: t("biz.insight.avgOrder"),
									value:
										analytics.data?.averageOrderMinor == null
											? null
											: formatMoney(
													analytics.data.averageOrderMinor,
													analytics.data.currency,
													{ locale: intlLocale },
												),
								},
							]}
						/>

						{attention.length > 0 ? (
							<View style={styles.pad}>
								<SectionHeader title={t("biz.home.attention")} />
								{/* All but the last row drop the trailing hairline the row's own
						    default draws ΓÇö the rhythm the board's rows keep with `last`, so
						    a card of rows never ends in a line for nobody. */}
								{attention.map((alert, index) => (
									<AttentionRow
										key={`${alert.type}:${alert.action ?? ""}`}
										label={t(
											alert.type === "new_order"
												? "biz.home.newOrders"
												: "biz.home.outOfStock",
										)}
										count={alert.count}
										severity={alert.severity}
										icon={
											alert.type === "new_order"
												? "receipt-outline"
												: "alert-circle-outline"
										}
										last={index === attention.length - 1}
										onPress={() =>
											router.push(
												alert.action === "open_orders"
													? "/business"
													: alert.action === "open_inventory" ||
															alert.action === "open_catalog"
														? "/products"
														: "/more",
											)
										}
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
								{orders.map((order, index) => {
									const actions: MerchantRowAction[] = nextStatuses(
										order.status,
										"BUSINESS",
										order.fulfilment,
									)
										.slice(0, 2)
										.map((to, actionIndex) => ({
											label: t(moveLabelKey(to, order.fulfilment)),
											onPress: () =>
												advance.mutate({
													orderId: order.id,
													to,
													expectedStatus: order.status,
												}),
											pending: advance.variables?.orderId === order.id,
											kind: actionIndex === 0 ? "primary" : "secondary",
										}));

									return (
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
											totalLabel={formatMoney(
												order.totalMinor,
												order.currency,
												{
													locale: intlLocale,
												},
											)}
											urgent={order.status === "PENDING" ? "new" : null}
											last={index === orders.length - 1}
											actions={actions.length ? actions : undefined}
										/>
									);
								})}
							</View>
						)}

						{/* The doors, as the rail (┬º25) rather than the card it replaces:
						    every destination is a route in this tree, so no action leads
						    nowhere. Adding a product is the moment's one filled control.

						    The five are ┬º25's own list. `orders` and `menu` used to sit here
						    and were the tab bar's destinations said again in different words;
						    ┬º25 names the *jobs* instead, which is why `Stock` opens the
						    catalogue the steppers live on and `Pause` gives the order the
						    header's status chip also gives. The label names the state the
						    command moves to ΓÇö `./switch`'s contract ΓÇö so the same slot reads
						    "Pausar pedidos" and "Reanudar pedidos" without a second item. */}
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
									key: "promo",
									label: t("biz.promotions.title"),
									icon: "ticket-outline",
									onPress: () => router.push("/(business)/promotions"),
								},
								{
									key: "stock",
									label: t("biz.products.stock"),
									icon: "cube-outline",
									onPress: () => router.push("/products"),
								},
								{
									key: "hours",
									label: t("biz.settings.hours"),
									icon: "time-outline",
									onPress: () => router.push("/(business)/shop-hours"),
								},
								{
									key: "pause",
									label: locationPaused
										? t("biz.locations.resume")
										: t("biz.locations.pause"),
									icon: locationPaused ? "play-outline" : "pause-outline",
									disabled:
										!canManageOperatingState ||
										pause.isPending ||
										resume.isPending,
									onPress: () => {
										if (!selectedLocation) return;
										if (locationPaused) {
											resume.mutate({
												businessId,
												locationId: selectedLocation.id,
											});
											return;
										}
										// ┬º47 names "pause all orders" as one of the writes that
										// gets a confirmation, and `pauseStage`'s own flow is that
										// confirmation ΓÇö a duration, then a `ConfirmSheet`.
										setPauseDuration(undefined);
										setPauseStage("duration");
									},
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
								.join(" ┬╖ ")}
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
						? `${selectedLocation.name} ┬╖ ${
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
					accessibilityLabel={`${item.label}: ${item.value ?? "ΓÇö"}`}
				>
					<Text variant="caption" tone="muted">
						{item.label}
					</Text>
					<Text variant="body" bold>
						{item.value ?? "ΓÇö"}
					</Text>
				</View>
			))}
		</View>
	);
}

function AttentionRow({
	label,
	count,
	severity,
	icon,
	last,
	onPress,
}: {
	label: string;
	count: number;
	severity: Attention["severity"];
	icon: "receipt-outline" | "alert-circle-outline";
	last: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	const semantic =
		severity === "critical" ? colors.destructive : colors.warning;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}: ${count}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.attentionRow,
				{ borderBottomColor: colors.border },
				last ? null : styles.attentionDivider,
				pressed ? { backgroundColor: colors.muted } : null,
			]}
		>
			<View style={[styles.attentionRail, { backgroundColor: semantic }]} />
			<Ionicons name={icon} size={20} color={semantic} />
			<Text style={styles.attentionCopy}>
				{label} <Text bold>{count}</Text>
			</Text>
			<Ionicons
				name="chevron-forward"
				size={20}
				color={colors.mutedForeground}
			/>
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
				<Skeleton style={styles.skeletonLogo} />
				<View style={styles.skeletonIdentity}>
					<Skeleton style={[styles.skeletonName, line("title", fontScale)]} />
					<Skeleton style={[styles.skeletonMeta, line("label", fontScale)]} />
					<Skeleton style={styles.skeletonStatus} />
				</View>
			</View>
			{/* The pulse band's stand-in: full-bleed, at the band's own height, scaled where
			    the band scales. The measure is `./merchant-pulse`'s own ΓÇö the wait and the
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
	syncRow: {
		minHeight: 64,
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		paddingHorizontal: space.xl,
		paddingVertical: space.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	syncStatus: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	syncLabel: { flexShrink: 1 },
	syncControl: {
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.sm,
	},
	body: { gap: space.lg },
	pad: { paddingHorizontal: space.lg },
	merchantHeader: {
		minHeight: 124,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 14,
		paddingHorizontal: space.xl,
		paddingTop: space.md,
		paddingBottom: space.lg,
	},
	merchantLogo: { width: 56, height: 56, borderWidth: 1 },
	merchantIdentity: { flex: 1, alignItems: "flex-start", gap: TEXT_STACK_GAP },
	// ┬º12's controls, in a row of their own and top-aligned: they belong to the title,
	// the same rule `./home-header` writes for the avatar beside its own.
	merchantControls: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.xs,
	},
	/**
	 * ┬º28's icon button. The box is 48 rather than `MIN_TOUCH_TARGET`'s 44 because ┬º28
	 * asks for 48 on both platforms ΓÇö "Android's current accessibility guidance explicitly
	 * calls for at least 48dp interactive targets", and its own note is to make both 48 for
	 * parity. The glyph inside is `icon.action` (20), the middle of ┬º28's 20ΓÇô22; the drawn
	 * container *is* the target here, so there is no `hitSlop` to inflate it with.
	 */
	headerControl: {
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
	},
	locationLine: { flexDirection: "row", alignItems: "center", gap: space.xs },
	operatingState: { alignItems: "flex-start", gap: space.xs },
	statusControl: {
		minHeight: MIN_TOUCH_TARGET,
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: space.sm,
		paddingHorizontal: space.md,
		borderRadius: radius.sm,
	},
	statusDot: { width: 8, height: 8, borderRadius: radius.full },
	skeletonLogo: { width: 56, height: 56 },
	skeletonIdentity: { flex: 1, gap: TEXT_STACK_GAP },
	skeletonStatus: { width: 100, minHeight: MIN_TOUCH_TARGET },
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
