import { Ionicons } from "@expo/vector-icons";
import { type MessageKey, MOVE_LABELS } from "@pymeshub/i18n";
import {
	type DashboardPreferences,
	DEFAULT_DASHBOARD_PREFERENCES,
	type FulfilmentKind,
	formatMoney,
	MARKET_TIME_ZONE,
	MAX_LINE_QUANTITY,
	type MerchantAlertAction,
	type MerchantAlertType,
	type MerchantHome as MerchantHomeData,
	nextStatuses,
	ORDER_STATUSES,
	type OrderStatus,
	type ProductCard,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useIsFocused } from "expo-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { MerchantGuide } from "@/components/merchant-guide";
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
import { MerchantShortcutRail } from "@/components/merchant-shortcut-rail";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { Sheet } from "@/components/sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { statusKey } from "@/components/status-badge";
import { useTabBarClearance } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { messageFor, toApiFailure, useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { formatClock, formatDayMonth, formatRelative } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { hasSeenMerchantGuide } from "@/lib/merchant-guide";
import { useMerchantScope } from "@/lib/merchant-scope";
import { NO_VALUE } from "@/lib/no-value";
import { useTRPC } from "@/lib/trpc/context";
import {
	businessThemeColors,
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	ThemeColorsOverrideProvider,
	type as typeScale,
	useTheme,
} from "@/theme";

/**
 * The merchant home: what needs attention, and the doors to the work.
 *
 * Bands, not cards (┬º4, ┬º62): the identity header, the pulse band (┬º14), the
 * orders-now section (┬º17) and the command rail (┬º25). The doors card this screen
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

type Attention = MerchantHomeData["attention"][number];
type AttentionGroup = Attention & { count: number };

/**
 * One label per alert type, over the closed union the API ships.
 *
 * `satisfies` rather than `as Record<…>` for the reason the comment repeats
 * three times below: the table has to stay *complete*, and a cast would let a
 * ninth type arrive labelled by whatever fell through. The two the Worker emits
 * today (`new_order`, `inventory_zero`) reuse the keys this section has always
 * used, so nothing that already read "Pedidos por confirmar" changes its words;
 * the other six are here so the six are *right* rather than absent the day the
 * API starts sending them.
 */
const ATTENTION_LABEL_KEYS = {
	new_order: "biz.home.newOrders",
	order_delay: "biz.home.alert.order_delay",
	inventory_low: "biz.home.alert.inventory_low",
	inventory_zero: "biz.home.outOfStock",
	store_offline: "biz.home.alert.store_offline",
	payment_issue: "biz.home.alert.payment_issue",
	settlement_issue: "biz.home.alert.settlement_issue",
	catalog_issue: "biz.home.alert.catalog_issue",
} satisfies Record<MerchantAlertType, MessageKey>;

/**
 * The door each alert action offers, in words.
 *
 * The row used to decide this with a ternary chain that sent anything it did not
 * recognise to `/more` — the catch-all, which is a real screen and the wrong
 * answer for three of the seven. A chevron on its own asks the reader to infer
 * the destination from the words, which is work the dictionary has already done.
 */
const ATTENTION_ACTION_KEYS = {
	open_orders: "biz.home.alertAction.open_orders",
	open_catalog: "biz.home.alertAction.open_catalog",
	open_inventory: "biz.home.alertAction.open_inventory",
	open_settings: "biz.home.alertAction.open_settings",
	open_payouts: "biz.home.alertAction.open_payouts",
	retry_payment: "biz.home.alertAction.retry_payment",
	contact_support: "biz.home.alertAction.contact_support",
} satisfies Record<MerchantAlertAction, MessageKey>;

/** One glyph per kind of problem, so the rail of rows is scannable by shape. */
const ATTENTION_ICONS = {
	new_order: "receipt-outline",
	order_delay: "time-outline",
	inventory_low: "cube-outline",
	inventory_zero: "alert-circle-outline",
	store_offline: "cloud-offline-outline",
	payment_issue: "card-outline",
	settlement_issue: "cash-outline",
	catalog_issue: "list-outline",
} satisfies Record<
	MerchantAlertType,
	React.ComponentProps<typeof Ionicons>["name"]
>;

type RouterTarget =
	| { pathname: string; params?: Record<string, string> }
	| string;

/**
 * Where each alert action leads, as a thunk over the screen's own `businessId`.
 *
 * A thunk rather than a string because four of these routes take `businessId` as
 * a param, and a flat table would have to drop it — sending an OWNER to a screen
 * that cannot then name their shop.
 */
const ALERT_ROUTES = {
	open_orders: () => ({ pathname: "/(business)/business" }),
	open_catalog: () => ({ pathname: "/(business)/products" }),
	// Stock is edited on each product's own form, so "inventory" opens the
	// catalogue that lists them rather than a screen that does not exist.
	open_inventory: () => ({ pathname: "/(business)/products" }),
	open_settings: (businessId: string) => ({
		pathname: "/(business)/locations",
		params: { businessId },
	}),
	open_payouts: (businessId: string) => ({
		pathname: "/(business)/payouts",
		params: { businessId },
	}),
	// Neither of the last two is a destination in this tree: retrying a payment
	// and contacting support are both jobs on the inbox, which is the one screen
	// that lists each alert with its own retry and reply affordances.
	retry_payment: () => ({ pathname: "/inbox" }),
	contact_support: () => ({ pathname: "/inbox" }),
} satisfies Record<MerchantAlertAction, (businessId: string) => RouterTarget>;
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

function _withAvailability(
	product: ProductCard,
	quantity: number,
): ProductCard {
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
	const { t, tp, intlLocale } = useT();
	const { status } = useSession();
	const cache = useQueryClient();
	const toast = useToast();
	const { colors: deviceColors, scheme } = useTheme();
	const scope = useMerchantScope();
	const focused = useIsFocused();
	const [locationPickerOpen, setLocationPickerOpen] = useState(false);
	const [guideBusinessId, setGuideBusinessId] = useState<string | null>(null);
	const guideChecked = useRef(new Set<string>());
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
	const dashboardPreferences = useQuery(
		trpc.business.dashboardPreferences.queryOptions(
			{ businessId: businessId ?? "" },
			{ enabled: signedIn && !!businessId },
		),
	);
	const configuration =
		dashboardPreferences.data?.configuration ?? DEFAULT_DASHBOARD_PREFERENCES;
	const colors = configuration.themeId
		? businessThemeColors(configuration.themeId, scheme)
		: deviceColors;
	const subscription = useQuery(
		trpc.subscription.current.queryOptions(
			{ businessId: businessId ?? "" },
			{ enabled: signedIn && !!businessId },
		),
	);
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
	const failed = shops.error ?? locations.error ?? home.error;
	const guideReady = signedIn && !waiting && !failed && !!shop && !!home.data;
	useEffect(() => {
		if (
			!focused ||
			!guideReady ||
			!businessId ||
			guideChecked.current.has(businessId)
		)
			return;
		let active = true;
		void hasSeenMerchantGuide(businessId).then((seen) => {
			if (!active) return;
			guideChecked.current.add(businessId);
			if (!seen) setGuideBusinessId(businessId);
		});
		return () => {
			active = false;
		};
	}, [businessId, focused, guideReady]);

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
	 * came from — both honest numbers, neither invented.
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

	// The bell's number: every attention the board already groups, summed. A
	// derived count, never stored — and no badge at zero, because a dot with
	// nothing behind it is decoration applying for a job.
	const attentionTotal = attention.reduce((sum, group) => sum + group.count, 0);

	const orders = home.data?.orders ?? [];

	/**
	 * The queue's real size against the slice of it this screen draws.
	 *
	 * `business.home` asks `orders.queue` for **five** rows and that is all the
	 * home carries, so `orders.length` is the preview's height rather than the
	 * shop's backlog. `pulse.active` is the honest total: every order at this
	 * location that has not reached COMPLETED, CANCELLED or REJECTED.
	 *
	 * The line this feeds is the one thing on this screen that reports a backlog.
	 * A strip of counts above the pulse used to carry the same number, and it was
	 * cut: four figures between the header and the day's figures read as a
	 * dashboard, and on a shop with nothing pending it was a row of zeroes above
	 * the only three numbers that matter.
	 */
	const openOrders = pulse?.active ?? null;
	const queueIsTruncated = openOrders !== null && openOrders > orders.length;

	/**
	 * How much of the catalog the three-row preview left out.
	 *
	 * `home.catalog.products` is `limit: 3` of the ACTIVE products and `active` +
	 * `draft` is every unarchived product the shop has. `outOfStock` is left out of
	 * that sum on purpose: a sold-out product is already inside `active`, and the
	 * preview would have drawn it.
	 */
	const catalogHidden = home.data
		? Math.max(
				0,
				home.data.catalog.active +
					home.data.catalog.draft -
					Math.min(
						configuration.productPreviewCount,
						home.data.catalog.products.length,
					),
			)
		: null;

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

	/**
	 * Publishing the shop: DRAFT to ACTIVE, OWNER only, no confirm.
	 *
	 * The button draws only for the OWNER reading their own DRAFT: `setStatus`
	 * asserts the role server-side, so a manager's button would be a control
	 * whose only answer is a refusal. No confirm sheet: going live is reversible
	 * (`setStatus` CLOSED is the way back) and the interface contract's
	 * confirm list (┬º47) names pausing, closing, deleting and rejecting — not
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
				// ┬º46's trailing Undo — see `./locations`, which draws the same pair for the same
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
	/**
	 * The pause's clock, as one caption line, or nothing.
	 *
	 * `paused_platform` is in this set and `locationPaused` is not, and the
	 * difference is deliberate: `locationPaused` answers "can *this* merchant tap
	 * Resume?", which is the OWNER's call and not the platform's. A platform pause
	 * still has a start and often an end, and "Pausado por la plataforma" with no
	 * second line leaves the reader unable to tell a five-minute capacity hold
	 * from a suspension that lasts until someone else acts — so it shows the same
	 * clock, and offers no button.
	 *
	 * Relative rather than a clock, because `formatRelative` already carries the
	 * direction in both languages ("en 8 min" / "in 8 min") and "en 8 min" is the
	 * actionable half: should this operator wait, or call someone?
	 */
	const pauseCaption = useMemo(() => {
		const status = selectedLocation?.status;
		if (!selectedLocation || !status?.startsWith("paused")) return null;
		const { pausedAt, resumeAt } = selectedLocation;
		// A pause with neither timestamp says only "Paused", which the status row
		// above already says — no second line repeating the same words.
		if (!pausedAt && !resumeAt) return null;
		const stamp = resumeAt ?? pausedAt;
		if (!stamp) return null;
		const relative = formatRelative(stamp, intlLocale);
		if (!relative) return null;
		return resumeAt
			? t("biz.home.pauseResumesIn", { relative })
			: t("biz.home.pauseSince", { relative });
	}, [selectedLocation, intlLocale, t]);
	const canManageOperatingState =
		!!selectedLocation &&
		canManage &&
		(locationPaused || selectedLocation.status === "open");
	const selectedPauseDuration =
		pauseDuration === undefined ? undefined : pauseDuration;
	const tabClearance = useTabBarClearance();

	const renderWidget = (id: DashboardPreferences["widgets"][number]) => {
		switch (id) {
			case "shortcuts":
				return (
					<MerchantShortcutRail
						shortcuts={[
							{
								key: "orders",
								label: t("biz.nav.orders"),
								icon: "receipt-outline",
								onPress: () => router.push("/(business)/business"),
							},
							{
								key: "catalog",
								label: t("biz.nav.products"),
								icon: "fast-food-outline",
								onPress: () => router.push("/(business)/products"),
							},
							{
								key: "promotions",
								label: t("biz.promotions.title"),
								icon: "ticket-outline",
								onPress: () => router.push("/(business)/promotions"),
							},
							{
								key: "analytics",
								label: t("biz.analytics.title"),
								icon: "stats-chart-outline",
								onPress: () => router.push("/(business)/analytics"),
							},
							{
								key: "team",
								label: t("biz.more.team"),
								icon: "people-outline",
								onPress: () =>
									router.push({
										pathname: "/(business)/team",
										params: { businessId },
									}),
							},
							{
								key: "payouts",
								label: t("biz.more.payouts"),
								icon: "cash-outline",
								onPress: () =>
									router.push({
										pathname: "/(business)/payouts",
										params: { businessId },
									}),
							},
							{
								key: "hours",
								label: t("biz.settings.hours"),
								icon: "time-outline",
								onPress: () =>
									router.push({
										pathname: "/(business)/shop-hours",
										params: { businessId },
									}),
							},
							{
								key: "locations",
								label: t("biz.locations.title"),
								icon: "location-outline",
								onPress: () =>
									router.push({
										pathname: "/(business)/locations",
										params: { businessId },
									}),
							},
							{
								key: "reviews",
								label: t("biz.reviews.title"),
								icon: "star-outline",
								onPress: () =>
									router.push({
										pathname: "/(business)/reviews",
										params: { businessId },
									}),
							},
						]}
					/>
				);
			case "pulse":
				return (
					<MerchantPulse
						data={pulse}
						dateLabel={dateLabel}
						metrics={configuration.metrics}
					/>
				);
			case "insights":
				return (
					<>
						{analytics.error ? (
							<ErrorState
								error={analytics.error}
								onRetry={() => void analytics.refetch()}
							/>
						) : analytics.data ? (
							<MerchantInsight
								items={[
									{
										label: t("biz.dashboard.topProducts"),
										value: analytics.data.topProducts[0]
											? `${analytics.data.topProducts[0].name} · ${tp(
													"biz.analytics.sold",
													analytics.data.topProducts[0].quantity,
												)}`
											: null,
									},
									{
										label: t("biz.insight.avgPreparation"),
										value:
											analytics.data.operations.avg_preparation_seconds == null
												? null
												: t("unit.minutes", {
														count: Math.round(
															analytics.data.operations
																.avg_preparation_seconds / 60,
														),
													}),
									},
									{
										label: t("biz.insight.avgOrder"),
										value:
											analytics.data.averageOrderMinor == null
												? null
												: formatMoney(
														analytics.data.averageOrderMinor,
														analytics.data.currency,
														{ locale: intlLocale },
													),
									},
								]}
							/>
						) : null}
					</>
				);
			case "catalog":
				return (
					<>
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
									{t("biz.locations.sharedCatalog")}
								</Text>
								<Text variant="caption" tone="muted" tabular>
									{t("biz.home.catalogSummary", {
										active: home.data.catalog.active,
										draft: home.data.catalog.draft,
										outOfStock: home.data.catalog.outOfStock,
									})}
								</Text>
								{/* What the three-row preview left out. Derived from the
								    reads above, so it cannot disagree with the summary
								    printed directly over it, and said as a count of
								    products rather than of alerts. */}
								{catalogHidden !== null && catalogHidden > 0 ? (
									<Text variant="caption" tone="muted" tabular>
										{t("biz.products.moreCount", { count: catalogHidden })}
									</Text>
								) : null}
								{home.data.catalog.products.length === 0 ? (
									<Text variant="body" tone="muted">
										{t("biz.products.empty.title")}
									</Text>
								) : (
									home.data.catalog.products
										.slice(0, configuration.productPreviewCount)
										.map((product) => (
											<BusinessProductRow
												key={product.id}
												product={product}
												onPress={() =>
													router.push({
														pathname: "/product-form",
														params: { businessId, id: product.id },
													})
												}
											/>
										))
								)}
							</View>
						) : null}
					</>
				);
		}
	};

	return (
		<>
			<ThemeColorsOverrideProvider colors={colors}>
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
						<ErrorState
							error={failed}
							onRetry={() => void refreshDashboard()}
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
								<View style={styles.headerContent}>
									{/* 52 identity: the initial, or the photograph clipped to r16. */}
									<Image
										uri={home.data?.location.logoUrl}
										radiusToken="full"
										style={[
											styles.identity,
											{ borderColor: colors.border },
											home.data?.location.logoUrl ? styles.identityPhoto : null,
										]}
										accessibilityElementsHidden
									>
										{home.data?.location.logoUrl ? null : (
											<Text variant="title" bold>
												{shop.businessName.trim().charAt(0).toUpperCase()}
											</Text>
										)}
									</Image>
									<View style={styles.identityCopy}>
										<Text variant="title" bold numberOfLines={1}>
											{shop.businessName}
										</Text>
										<Pressable
											onPress={() =>
												router.push({
													pathname: "/(business)/payouts",
													params: { businessId },
												})
											}
											accessibilityRole="button"
											accessibilityLabel={`${t("biz.subscription.title")}: ${subscription.data ? t(`biz.subscription.plan.${subscription.data.plan}`) : t("biz.more.subscriptionEmpty")}`}
											accessibilityHint={t("biz.subscription.change")}
											style={styles.planLink}
										>
											<Text variant="caption" tone="muted" numberOfLines={1}>
												{t("biz.subscription.title")} ·{" "}
												{subscription.data
													? t(`biz.subscription.plan.${subscription.data.plan}`)
													: t("biz.more.subscription")}
											</Text>
											<Ionicons
												name="chevron-forward"
												size={12}
												color={colors.mutedForeground}
											/>
										</Pressable>
									</View>
								</View>
								<View style={styles.headerRows}>
									{/* Order-taking state and its next action stay together. */}
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
												styles.statusRow,
												{ borderTopColor: colors.border },
											]}
										>
											<View style={styles.headerRowCopy}>
												<Text variant="caption" tone="muted">
													{t("biz.nav.orders")}
												</Text>
												<Text variant="body" bold>
													{t(`biz.locations.status.${selectedLocation.status}`)}
												</Text>
												{/* The pause's clock, and only while there is one. A third
											    line in a row whose floor is 64 — it grows at 200%
											    text rather than clipping, which is what the floor is
											    for. This row is the only place on the screen that
											    names the shop's operating state, so the state an
											    owner may have to wait on belongs here, under the
											    word that says there is one. */}
												{pauseCaption ? (
													<Text variant="caption" tone="muted" tabular>
														{pauseCaption}
													</Text>
												) : null}
											</View>
											{canManageOperatingState ? (
												<View style={styles.rowAction}>
													<Text variant="label" tone="action" bold>
														{t(
															locationPaused
																? "biz.locations.resume"
																: "biz.locations.pause",
														)}
													</Text>
													<Ionicons
														name="chevron-forward"
														size={16}
														color={colors.action}
													/>
												</View>
											) : null}
										</Pressable>
									) : null}
									{/* One branch opens its pickup map; multiple branches keep the selector. */}
									{selectedLocation ? (
										<Pressable
											onPress={() => {
												if ((locations.data?.length ?? 0) > 1)
													setLocationPickerOpen(true);
												else if (canManage && selectedLocation.isDefault)
													router.push("/(business)/shop-location");
											}}
											disabled={
												(locations.data?.length ?? 0) < 2 &&
												(!canManage || !selectedLocation.isDefault)
											}
											disabledOpacity={1}
											accessibilityRole="button"
											accessibilityLabel={`${selectedLocation.name}, ${selectedLocation.city ?? ""}`}
											accessibilityHint={
												(locations.data?.length ?? 0) > 1
													? t("biz.locations.select")
													: canManage && selectedLocation.isDefault
														? t("biz.order.dispatch.setPickupPin")
														: undefined
											}
											style={[
												styles.locationRow,
												{ borderBottomColor: colors.border },
											]}
										>
											<Ionicons
												name="location-outline"
												size={20}
												color={colors.mutedForeground}
												accessibilityElementsHidden
												importantForAccessibility="no"
											/>
											<View style={styles.headerRowCopy}>
												<Text variant="caption" tone="muted">
													{t("biz.locations.title")}
												</Text>
												<Text variant="body" bold numberOfLines={1}>
													{selectedLocation.name}
												</Text>
											</View>
											<Ionicons
												name="chevron-forward"
												size={16}
												color={colors.mutedForeground}
											/>
										</Pressable>
									) : null}
								</View>
								{/* Bell, with its count where the count belongs. */}
								<Pressable
									onPress={() => router.push("/inbox")}
									accessibilityRole="button"
									accessibilityLabel={
										attentionTotal > 0
											? `${t("account.inbox")} · ${tp("biz.home.attentionCount", attentionTotal)}`
											: t("account.inbox")
									}
									accessibilityHint={t("account.inbox.help")}
									style={styles.bell}
								>
									<Ionicons
										name="notifications-outline"
										size={icon.action}
										color={colors.foreground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
									{attentionTotal > 0 ? (
										<View
											style={[
												styles.bellBadge,
												{ backgroundColor: colors.destructive },
											]}
										>
											{/* The destructive pair, not `inverse`: the merchant
									    palette spends `primaryForeground` on ink, which
									    on this fill would be a dark-on-dark count. */}
											<Text
												variant="caption"
												bold
												tabular
												style={{ color: colors.destructiveForeground }}
											>
												{attentionTotal > 99 ? "99+" : String(attentionTotal)}
											</Text>
										</View>
									) : null}
								</Pressable>
								{/* Quiet metadata under the rail: cloud, sentence, refresh. No
							    card, no rules — a 20pt line the eye crosses without stopping. */}
								<View style={styles.syncMeta} accessibilityLiveRegion="polite">
									<Ionicons
										name={syncing ? "sync-outline" : "cloud-done-outline"}
										size={14}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
									<Text
										variant="caption"
										tone="muted"
										style={styles.syncMetaLabel}
									>
										{freshnessLabel}
									</Text>
									<Pressable
										onPress={refreshDashboard}
										accessibilityRole="button"
										accessibilityLabel={t("biz.dashboard.refresh")}
										accessibilityHint={t("biz.dashboard.refreshHelp")}
										hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
										style={styles.refreshTarget}
									>
										<Ionicons
											name="refresh"
											size={18}
											color={syncing ? colors.action : colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									</Pressable>
								</View>
							</View>
							{/* Destination carousel: the More doors a thumb reaches by sliding.
						    None of these tiles takes the lime fill — the command rail below
						    holds the moment's action. */}
							{configuration.widgets
								.slice(0, 1)
								.filter((id) => !configuration.hidden.includes(id))
								.map((id) => (
									<Fragment key={id}>{renderWidget(id)}</Fragment>
								))}
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
							{configuration.widgets
								.slice(1, 3)
								.filter((id) => !configuration.hidden.includes(id))
								.map((id) => (
									<Fragment key={id}>{renderWidget(id)}</Fragment>
								))}

							{attention.length > 0 ? (
								<View style={styles.pad}>
									<SectionHeader title={t("biz.home.attention")} />
									{/* All but the last row drop the trailing hairline the row's own
						    default draws — the rhythm the board's rows keep with `last`, so
						    a card of rows never ends in a line for nobody. */}
									{attention.map((alert, index) => (
										// The whole row opens the alert's destination, and the
										// labelled button at the end says which one — see
										// `AttentionRow` for why the row is a plain report
										// rather than a button when the alert carries no
										// action at all.
										<AttentionRow
											key={`${alert.type}:${alert.action ?? ""}`}
											label={t(ATTENTION_LABEL_KEYS[alert.type])}
											count={alert.count}
											severity={alert.severity}
											icon={ATTENTION_ICONS[alert.type]}
											// `action` is optional on the wire, so this is a
											// question with a real `undefined` behind it rather
											// than a branch that cannot fail.
											actionLabel={
												alert.action
													? t(ATTENTION_ACTION_KEYS[alert.action])
													: null
											}
											last={index === attention.length - 1}
											onPress={() => {
												const route =
													alert.action && ALERT_ROUTES[alert.action];
												// `businessId` is optional here. This JSX lives
												// inside the branch that already proved one
												// exists, but the closure does not know that,
												// and an OWNER tapping an alert must not reach a
												// screen with an empty shop id.
												if (route && businessId) router.push(route(businessId));
											}}
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
								{/* The preview holds at most five rows and the shop may
							    hold far more, so the shortfall is said rather than
							    implied — and only when the two numbers differ.
							    "5 open · showing 5" is a fact about the screen
							    rather than about the shop, and printing it would
							    teach the reader that a number which changes with
							    the preview's width is a business fact. */}
								{queueIsTruncated && openOrders !== null ? (
									<Text
										variant="caption"
										tone="muted"
										tabular
										style={styles.queueSummary}
									>
										{t("biz.board.queueSummary", {
											open: openOrders,
											shown: orders.length,
										})}
									</Text>
								) : null}
							</View>
							{orders.length === 0 ? (
								<View style={styles.pad}>
									<View
										style={[
											styles.emptyOrders,
											{ backgroundColor: colors.muted },
										]}
									>
										<Ionicons
											name="checkmark-circle-outline"
											size={icon.back}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
										<View style={styles.emptyOrdersCopy}>
											<Text variant="body" bold>
												{t("biz.board.caughtUp")}
											</Text>
											<Text variant="caption" tone="muted">
												{t("biz.board.empty.body")}
											</Text>
										</View>
									</View>
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
											//
											// `waitLabel` is how long this order has been standing. The
											// row already had a slot for it and nothing was putting one
											// there, which left the oldest order on the board drawn
											// exactly like the newest — and age is the fact that
											// decides which row to take first. Past a day
											// `formatRelative` hands over to the clock, so this never
											// reads as a count of days on a screen whose job is to
											// say how far along it is.
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
												waitLabel={
													formatRelative(order.placedAt, intlLocale) ??
													undefined
												}
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
						    command moves to — `./switch`'s contract — so the same slot reads
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
											// confirmation — a duration, then a `ConfirmSheet`.
											setPauseDuration(undefined);
											setPauseStage("duration");
										},
									},
								]}
							/>

							{configuration.widgets
								.slice(3)
								.filter((id) => !configuration.hidden.includes(id))
								.map((id) => (
									<Fragment key={id}>{renderWidget(id)}</Fragment>
								))}
						</>
					)}
				</Screen>
			</ThemeColorsOverrideProvider>
			{businessId ? (
				<MerchantGuide
					open={focused && guideBusinessId === businessId}
					businessId={businessId}
					onClose={() => setGuideBusinessId(null)}
				/>
			) : null}
			<Sheet
				open={locationPickerOpen}
				onClose={() => setLocationPickerOpen(false)}
				title={t("biz.locations.select")}
				closeLabel={t("action.close")}
			>
				{canManage && selectedLocation?.isDefault ? (
					<Button
						label={t("biz.order.dispatch.setPickupPin")}
						variant="secondary"
						fullWidth
						onPress={() => {
							setLocationPickerOpen(false);
							router.push("/(business)/shop-location");
						}}
					/>
				) : null}
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
				footer={<View style={{ height: tabClearance }} />}
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
				bottomClearance={tabClearance}
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
					accessibilityLabel={`${item.label}: ${item.value ?? NO_VALUE}`}
				>
					<Text variant="caption" tone="muted" numberOfLines={2}>
						{item.label}
					</Text>
					<Text variant="body" bold numberOfLines={2}>
						{item.value ?? NO_VALUE}
					</Text>
				</View>
			))}
		</View>
	);
}

/**
 * One attention item: the rail that says how urgent, the words that say what,
 * and — when the alert knows where it wants to send this reader — the label that
 * says where.
 *
 * ## The destination is written out, not drawn as a chevron
 *
 * This row used to end in a bare chevron, which asks the reader to work out where
 * "Productos agotados 4" goes from the shape of an arrow. `actionLabel` is that
 * same answer in words, in the merchant's `action` ink, so the row is legible at a
 * glance and the one affordance on it is the one that matters.
 *
 * It is `action` tone rather than the pulse's lime on purpose: the merchant
 * palette reserves its brightest ink for the single thing asking the operator to
 * act right now, and the command rail below spends it on adding a product. Four
 * rows each wearing it would spend it four times.
 *
 * ## A row with no action is a report, not a dead button
 *
 * `merchantAlertSchema.action` is optional, so `actionLabel` can be `null`. Then
 * the row drops `accessibilityRole="button"`, stops taking the pressed fill, and
 * draws no chevron: a reader who taps everything should be right to, and a row
 * that looks pressable and goes nowhere is how a screen teaches distrust.
 */
function AttentionRow({
	label,
	count,
	severity,
	icon,
	actionLabel,
	last,
	onPress,
}: {
	label: string;
	count: number;
	severity: Attention["severity"];
	icon: React.ComponentProps<typeof Ionicons>["name"];
	actionLabel?: string | null;
	last: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	const semantic =
		severity === "critical" ? colors.destructive : colors.warning;
	const pressable = actionLabel !== null;

	return (
		<Pressable
			accessibilityRole={pressable ? "button" : undefined}
			accessibilityLabel={`${label}: ${count}`}
			accessibilityState={{ disabled: !pressable }}
			disabled={!pressable}
			onPress={onPress}
			style={({ pressed }) => [
				styles.attentionRow,
				{ borderBottomColor: colors.border },
				last ? null : styles.attentionDivider,
				pressed && pressable ? { backgroundColor: colors.muted } : null,
			]}
		>
			<View style={[styles.attentionRail, { backgroundColor: semantic }]} />
			<Ionicons
				name={icon}
				size={20}
				color={semantic}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text style={styles.attentionCopy}>
				{label} <Text bold>{count}</Text>
			</Text>
			{pressable && actionLabel ? (
				<View style={styles.attentionAction}>
					<Text variant="label" tone="action" bold numberOfLines={1}>
						{actionLabel}
					</Text>
					<Ionicons
						name="chevron-forward"
						size={16}
						color={colors.action}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</View>
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
			<View style={styles.headerSkeleton}>
				<Skeleton style={styles.skeletonIdentityBox} radiusToken="full" />
				<View style={styles.skeletonIdentityCopy}>
					<Skeleton style={[styles.skeletonMeta, line("heading", fontScale)]} />
					<Skeleton style={[styles.skeletonMeta, line("caption", fontScale)]} />
				</View>
				<Skeleton style={styles.skeletonBell} radiusToken="full" />
			</View>
			<View style={styles.headerSkeletonRows}>
				<Skeleton style={styles.skeletonHeaderRow} />
				<Skeleton style={styles.skeletonHeaderRow} />
			</View>
			<Skeleton style={[styles.skeletonMeta, line("caption", fontScale)]} />
			{/* The pulse module's stand-in: inset and cornered like the module,
			    at the module's own height, scaled where the module scales. The
			    measure is `./merchant-pulse`'s own — the wait and the arrival
			    cannot disagree about it without that file saying so. */}
			<Skeleton
				style={{
					minHeight: pulseBandHeight(fontScale),
					marginHorizontal: space.lg,
					borderRadius: radius.xl,
				}}
			/>
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
	// Quiet metadata under the rail: cloud, sentence, refresh — a 20pt
	// line with no card and no rules. Lime lives only on the refresh
	// glyph while it is actually refreshing.
	syncMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		paddingHorizontal: space.lg,
		minHeight: 20,
		marginTop: space.sm,
	},
	syncMetaLabel: { flex: 1 },
	// Visible 18-point glyph; the 44-point target arrives as hitSlop so
	// the row stays quiet.
	refreshTarget: { alignItems: "center", justifyContent: "center" },
	body: { gap: space.lg },
	pad: { paddingHorizontal: space.lg },
	emptyOrders: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		padding: space.md,
		borderRadius: radius.md,
	},
	emptyOrdersCopy: { flex: 1, gap: space.xs },
	// Identity first, then the branch and order controls as full-width rows.
	merchantHeader: { paddingTop: 10 },
	headerContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		paddingHorizontal: space.lg,
	},
	headerRows: { marginHorizontal: space.lg, marginTop: space.md },
	identityCopy: { flex: 1, minWidth: 0, marginRight: 52, gap: space.xs },
	planLink: {
		minHeight: 24,
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: space.xs,
	},
	headerRowCopy: { flex: 1, minWidth: 0, gap: space.xs / 2 },
	rowAction: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		flexShrink: 1,
	},
	statusRow: {
		width: "100%",
		minHeight: 64,
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingVertical: space.sm,
	},
	locationRow: {
		width: "100%",
		minHeight: 64,
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingVertical: space.sm,
	},
	identity: {
		width: 52,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
	},
	// r16 when the shop has a photograph; the full circle keeps the initial.
	identityPhoto: { borderRadius: 16 },
	// The bell's count, pinned over the glyph's corner. No fixed height: the
	// padding wraps the `caption` line the way `./status-badge`'s compact dot
	// does, so the disc grows with the reader instead of clipping at 200%.
	bellBadge: {
		position: "absolute",
		top: 2,
		right: 2,
		minWidth: typeScale.label.lineHeight,
		paddingHorizontal: space.xs,
		paddingVertical: space.xs / 2,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	// The bell stays at the right edge of the identity row.
	bell: {
		position: "absolute",
		top: 4,
		right: space.lg,
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	headerSkeleton: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.lg,
	},
	skeletonIdentityCopy: { flex: 1, gap: space.xs },
	skeletonBell: { width: 44, height: 44 },
	headerSkeletonRows: {
		gap: space.sm,
		marginHorizontal: space.lg,
		marginTop: space.md,
	},
	skeletonHeaderRow: { minHeight: 64 },
	skeletonIdentityBox: { width: 52, height: 52 },
	skeletonMeta: { width: "40%" },
	insight: {
		flexDirection: "row",
		gap: space.md,
		paddingHorizontal: space.xl,
		paddingVertical: space.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	insightItem: { flex: 1, minWidth: 0, gap: space.xs },
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
	/**
	 * The row's own affordance: the word plus the chevron, as one inseparable unit.
	 *
	 * `flexShrink: 0` because the *label* is what must give way, not this — the copy
	 * above already carries `flex: 1` and shrinks first, so a long alert name at
	 * 200% text pushes "Reponer stock" out rather than wrapping the chevron onto a
	 * line of its own. `gap: space.xs` because the two are one thing said twice (the
	 * destination, and the mark that means "go there") rather than two independent
	 * items competing for the row's tail.
	 */
	attentionAction: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		flexShrink: 0,
	},
	/**
	 * The queue's own size, under the section header.
	 *
	 * `marginTop: space.xs` rather than a `gap` from the header above: this line is a
	 * caption attached to that header, not a section of its own, so the two belong
	 * together at one step rather than at the page's `space.lg`.
	 */
	queueSummary: { marginTop: space.xs },
});
