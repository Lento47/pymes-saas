import Ionicons from "@expo/vector-icons/Ionicons";
import { type CourierProfile, formatMoney } from "@pymeshub/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Linking,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	FadeInDown,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { ConfirmSheet } from "@/components/confirm-sheet";
import {
	ActiveZoneControl,
	CourierAvailabilityControl,
	CourierAvatarButton,
	CourierPerformanceMetrics,
	CourierSheetSecondary,
	CourierWordmark,
	EditorialDispatchHero,
	MerchantMark,
	OfferCountdown,
	OfferDestination,
	SheetHandle,
} from "@/components/courier-motion";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { toApiFailure, useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { remainingOfferMs } from "@/lib/courier-motion";
import {
	reconcileCourierTracking,
	type StartTrackingResult,
} from "@/lib/courier-tracking";
import { formatAtMostOneDecimal } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { duration, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { useTRPC } from "@/lib/trpc/context";
import {
	courierDisplay,
	courierMotionSpace,
	courierMotionTokens,
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	type,
	useTheme,
} from "@/theme";

const PAGE_SIZE = 20;
const BOARD_POLL_MS = 5000;
const OFFERS_POLL_MS = 15_000;

export default function DeliveryScreen() {
	return (
		<SignedIn>
			<Runs />
		</SignedIn>
	);
}

function Runs() {
	const { t } = useT();
	const trpc = useTRPC();
	const query = trpc.couriers.profile.queryOptions();
	const profile = useQuery(query);
	const waiting = useSkeletonHold(profile.isPending);
	const me = profile.data;

	if (profile.isError)
		return (
			<Screen title={t("delivery.board.title")} scroll bottomInset>
				<ErrorState
					error={profile.error}
					onRetry={() => void profile.refetch()}
				/>
			</Screen>
		);

	if (waiting)
		return (
			<Screen title={t("delivery.board.title")} scroll bottomInset>
				<RunsSkeleton label={t("state.loading")} />
			</Screen>
		);

	if (!me)
		return (
			<Screen title={t("delivery.board.title")} scroll bottomInset>
				<EmptyState
					icon="bicycle-outline"
					title={t("biz.courier.profileTitle")}
					body={t("biz.courier.profileRequired")}
					actionLabel={t("account.profile.title")}
					onAction={() => router.push("/courier-profile")}
				/>
			</Screen>
		);

	if (me.verificationStatus === "PENDING")
		return (
			<Screen title={t("delivery.board.title")} scroll bottomInset>
				<EmptyState
					icon="bicycle-outline"
					title={t("biz.courier.reviewPending")}
					body={t("biz.courier.reviewPending.body")}
					actionLabel={t("action.view")}
					onAction={() => router.push("/courier-profile")}
				/>
			</Screen>
		);

	if (me.verificationStatus === "REJECTED")
		return (
			<Screen title={t("delivery.board.title")} scroll bottomInset>
				<EmptyState
					icon="bicycle-outline"
					title={t("biz.courier.rejected")}
					body={t("biz.courier.rejected.next")}
					actionLabel={t("account.profile.title")}
					onAction={() => router.push("/courier-profile")}
				/>
			</Screen>
		);

	return <MotionBoard profile={me} />;
}

function MotionBoard({ profile }: { profile: CourierProfile }) {
	const { t, tp, intlLocale } = useT();
	const { colors, scheme } = useTheme();
	const motion = courierMotionTokens("waiting", colors, scheme);
	const reduceMotion = useReducedMotion();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { session } = useSession();
	const [offlineOpen, setOfflineOpen] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [peekHeight, setPeekHeight] = useState(188);
	const acceptingDeliveryId = useRef<string | null>(null);
	const me = useQuery(trpc.users.me.queryOptions());

	const available = profile.isAvailable;
	const hasZone =
		profile.zoneLat != null &&
		profile.zoneLng != null &&
		profile.zoneRadiusKm != null;

	const offers = useQuery(
		trpc.deliveries.offers.queryOptions(undefined, {
			refetchInterval: OFFERS_POLL_MS,
		}),
	);
	const mine = useQuery(
		trpc.deliveries.mine.queryOptions(undefined, {
			refetchInterval: OFFERS_POLL_MS,
		}),
	);
	const invites = useQuery(trpc.couriers.myInvites.queryOptions());
	const pendingInvites = (invites.data ?? []).filter(
		(one) => one.status === "PENDING",
	).length;
	const stats = useQuery(trpc.couriers.stats.queryOptions());
	const {
		coords,
		status: locationStatus,
		request: requestLocation,
	} = useDeviceLocation({
		preferCurrent: true,
		enabled: available && !hasZone,
	});
	const zoneDispatch = useMutation(
		trpc.deliveries.requestOffers.mutationOptions({
			onSuccess: () =>
				cache.invalidateQueries({
					queryKey: trpc.deliveries.offers.queryKey(),
				}),
		}),
	);
	const requestZoneOffers = zoneDispatch.mutate;
	useEffect(() => {
		if (!available || !hasZone) return;
		requestZoneOffers();
		const poll = setInterval(requestZoneOffers, 60_000);
		return () => clearInterval(poll);
	}, [available, hasZone, requestZoneOffers]);
	const presence = useMutation(
		trpc.deliveries.reportPresence.mutationOptions({
			onSuccess: () =>
				cache.invalidateQueries({
					queryKey: trpc.deliveries.offers.queryKey(),
				}),
		}),
	);
	const reportPresence = presence.mutate;
	useEffect(() => {
		if (!coords || !available) return;
		reportPresence({ lat: coords.lat, lng: coords.lng });
	}, [coords, available, reportPresence]);

	const availability = useMutation(
		trpc.couriers.saveProfile.mutationOptions({
			onError: () => warning(),
			onSuccess: (saved) =>
				cache.setQueryData<CourierProfile | null>(
					trpc.couriers.profile.queryKey(),
					saved,
				),
			onSettled: async () => {
				await Promise.all([
					cache.invalidateQueries({ queryKey: trpc.couriers.pathKey() }),
					cache.invalidateQueries({
						queryKey: trpc.deliveries.offers.queryKey(),
					}),
				]);
			},
		}),
	);
	const availabilityFailure = useApiFailure(availability.error);

	const accept = useMutation(
		trpc.deliveries.acceptOffer.mutationOptions({
			onSuccess: async (detail) => {
				setBusyId(null);
				acceptingDeliveryId.current = null;
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
				await cache.invalidateQueries({
					queryKey: trpc.orders.pathKey(),
				});
				router.push(`/delivery/${detail.id}` as Href);
			},
			onError: async (error) => {
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
				const failure = toApiFailure(error);
				if (failure.code === "CONFLICT" || failure.code === "NOT_FOUND") {
					const owned = await cache.fetchQuery(
						trpc.deliveries.mine.queryOptions(),
					);
					const active = owned.filter(
						(delivery) =>
							delivery.status !== "DELIVERED" &&
							delivery.status !== "CANCELLED",
					);
					const wanted = acceptingDeliveryId.current;
					const target =
						active.find((delivery) => delivery.id === wanted) ??
						(active.length === 1 ? active[0] : undefined);
					if (target) {
						setBusyId(null);
						acceptingDeliveryId.current = null;
						router.push(`/delivery/${target.id}` as Href);
						queueMicrotask(() => accept.reset());
						return;
					}
				}
				setBusyId(null);
			},
		}),
	);
	const decline = useMutation(
		trpc.deliveries.declineOffer.mutationOptions({
			onSuccess: async () => {
				setBusyId(null);
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
			},
			onError: async () => {
				setBusyId(null);
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
			},
		}),
	);

	const orders = useInfiniteQuery(
		trpc.orders.list.infiniteQueryOptions(
			{
				role: "BUSINESS",
				assignedToMe: true,
				activeOnly: true,
				limit: PAGE_SIZE,
			},
			{
				refetchInterval: BOARD_POLL_MS,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);
	const assigned = useMemo(
		() => orders.data?.pages.flatMap((page) => page.items) ?? [],
		[orders.data],
	);
	const [trackingResult, setTrackingResult] =
		useState<StartTrackingResult | null>(null);

	const pending = offers.data ?? [];
	const activeDeliveries = (mine.data ?? []).filter(
		(delivery) =>
			delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED",
	);
	const history = (mine.data ?? []).filter(
		(delivery) => delivery.status === "DELIVERED",
	);
	const offer = pending[0] ?? null;
	const offerExpired = offer
		? remainingOfferMs(offer.expiresAt, Date.now()) <= 0
		: false;
	const responding = accept.isPending || decline.isPending;
	const failure = accept.error ?? decline.error;
	const ridingId =
		assigned.find((order) => order.status === "OUT_FOR_DELIVERY")?.id ??
		activeDeliveries.find(
			(delivery) => delivery.orderStatus === "OUT_FOR_DELIVERY",
		)?.orderId;

	useEffect(() => {
		if (!session?.userId || !orders.isSuccess || !mine.isSuccess) return;
		let cancelled = false;
		void reconcileCourierTracking(ridingId, session.userId).then((result) => {
			if (!cancelled) setTrackingResult(result);
		});
		return () => {
			cancelled = true;
		};
	}, [ridingId, session?.userId, orders.isSuccess, mine.isSuccess]);

	const offerId = offer?.id;
	useEffect(() => {
		if (!offerId || offerExpired) return;
		AccessibilityInfo.announceForAccessibility(
			t("delivery.motion.offer.title"),
		);
	}, [offerId, offerExpired, t]);

	const dash = t("delivery.motion.metric.none");
	const monthValue = stats.data ? String(stats.data.deliveredLast30Days) : dash;
	const ratingValue =
		stats.data?.ratingAverage != null && stats.data.ratingCount > 1
			? stats.data.ratingAverage.toFixed(1)
			: dash;
	const deliveriesValue = stats.data ? String(stats.data.deliveredTotal) : dash;
	const zoneLabel =
		profile.serviceArea.trim() || t("delivery.motion.zone.unset");

	function saveAvailability(next: boolean) {
		light();
		availability.mutate({
			displayName: profile.displayName,
			serviceArea: profile.serviceArea,
			bio: profile.bio ?? undefined,
			vehicleName: profile.vehicleName ?? undefined,
			vehiclePlate: profile.vehiclePlate ?? undefined,
			vehiclePhotoUrl: profile.vehiclePhotoUrl ?? undefined,
			isAvailable: next,
		});
	}

	return (
		<SafeAreaView
			edges={["top", "bottom"]}
			style={[styles.canvas, { backgroundColor: motion.canvas }]}
		>
			<StatusBar style="light" />
			<ScrollView
				style={styles.top}
				contentContainerStyle={[
					styles.topContent,
					{ paddingBottom: peekHeight + space.lg },
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<View style={styles.headerLead}>
						<CourierWordmark color={motion.ink} />
					</View>
					<CourierAvatarButton
						name={me.data?.name ?? profile.displayName}
						uri={me.data?.image ?? null}
						motion={motion}
						onPress={() => router.push("/(delivery)/account" as Href)}
					/>
				</View>
				<EditorialDispatchHero motion={motion} />
				<CourierPerformanceMetrics
					month={monthValue}
					rating={ratingValue}
					deliveries={deliveriesValue}
					motion={motion}
				/>
				<CourierAvailabilityControl
					available={available}
					motion={motion}
					disabled={availability.isPending}
					onPress={() => {
						if (available) setOfflineOpen(true);
						else saveAvailability(true);
					}}
				/>
				{availabilityFailure.message ? (
					<Text variant="caption" tone="destructive" accessibilityRole="alert">
						{availabilityFailure.message}
					</Text>
				) : null}
				<ActiveZoneControl
					label={zoneLabel}
					motion={motion}
					onPress={() => router.push("/courier-profile")}
				/>
				{locationStatus === "denied" ? (
					<Banner
						title={t("delivery.presence.denied")}
						body={t("delivery.board.presence.body")}
						action={t("delivery.board.presence.action")}
						onAction={() => void Linking.openSettings()}
						motion={motion}
					/>
				) : null}
				{available && locationStatus === "unavailable" ? (
					<Banner
						title={t("delivery.board.locationUnavailable")}
						action={t("action.retry")}
						onAction={requestLocation}
						motion={motion}
					/>
				) : null}
				{available && coords && presence.isError ? (
					<Banner
						title={t("delivery.board.presenceFailed")}
						action={t("action.retry")}
						onAction={() =>
							reportPresence({ lat: coords.lat, lng: coords.lng })
						}
						motion={motion}
					/>
				) : null}
				{available && hasZone && zoneDispatch.isError ? (
					<Banner
						title={t("delivery.board.zoneDispatchFailed")}
						action={t("action.retry")}
						onAction={() => requestZoneOffers()}
						motion={motion}
					/>
				) : null}
				{ridingId && trackingResult && trackingResult !== "started" ? (
					<Banner
						title={t("biz.courier.location.title")}
						body={t("biz.courier.location.unavailable")}
						action={t("biz.courier.location.action")}
						onAction={() => void Linking.openSettings()}
						motion={motion}
					/>
				) : null}
				{activeDeliveries.map((delivery) => (
					<PressRow
						key={delivery.id}
						title={t("delivery.motion.continue")}
						motion={motion}
						onPress={() => router.push(`/delivery/${delivery.id}` as Href)}
					/>
				))}
			</ScrollView>

			<BoardSlice
				motion={motion}
				reduced={reduceMotion}
				peekHeight={peekHeight}
				onPeekHeight={setPeekHeight}
				history={history}
				historyLabel={t("delivery.board.history")}
				expandLabel={t("delivery.motion.slice.expand")}
				collapseLabel={t("delivery.motion.slice.collapse")}
				emptyLabel={t("delivery.motion.slice.empty")}
				onOpenDelivery={(id) =>
					router.push(`/delivery/${id}?completed=1` as Href)
				}
				orderLabel={(code) => t("order.number", { code })}
			>
				{offers.isError ? (
					<ErrorState
						error={offers.error}
						onRetry={() => void offers.refetch()}
					/>
				) : offer ? (
					<Animated.View
						key={offer.id}
						entering={
							reduceMotion ? undefined : FadeInDown.duration(duration.entering)
						}
						style={styles.offer}
					>
						<View style={styles.offerHead}>
							<Text
								variant="caption"
								bold
								style={[styles.offerEyebrow, { color: motion.sheetMuted }]}
							>
								{t("delivery.motion.offer.title")}
							</Text>
							<OfferCountdown
								expiresAt={offer.expiresAt}
								color={motion.sheetInk}
							/>
						</View>
						<View style={styles.merchantRow}>
							<MerchantMark
								name={offer.businessName}
								color={motion.sheetInk}
								background={motion.sheetControl}
							/>
							<View style={styles.merchantCopy}>
								<Text variant="heading" bold style={{ color: motion.sheetInk }}>
									{offer.businessName}
								</Text>
								{offer.distanceToPickupKm != null ? (
									<Text variant="caption" style={{ color: motion.sheetMuted }}>
										{[
											t("delivery.motion.distance.km", {
												value: formatAtMostOneDecimal(
													offer.distanceToPickupKm,
													intlLocale,
												),
											}),
											offer.pickup.city,
										]
											.filter(Boolean)
											.join(" · ")}
									</Text>
								) : offer.pickup.city ? (
									<Text variant="caption" style={{ color: motion.sheetMuted }}>
										{offer.pickup.city}
									</Text>
								) : null}
							</View>
							{offer.courierFeeMinor != null && offer.courierFeeMinor > 0 ? (
								<Text
									variant="title"
									bold
									tabular
									style={{ color: motion.sheetInk }}
								>
									{formatMoney(offer.courierFeeMinor, offer.currency ?? "CRC", {
										locale: intlLocale,
									})}
								</Text>
							) : null}
						</View>
						<OfferDestination
							area={offer.dropoffArea || t("location.pinned")}
							motion={motion}
						/>
						{offerExpired ? (
							<Text variant="body" style={{ color: motion.sheetMuted }}>
								{t("delivery.motion.offer.expired")}
							</Text>
						) : (
							<>
								<Button
									label={t("delivery.motion.offer.accept")}
									fullWidth
									size="lg"
									shape="pill"
									loading={busyId === offer.id && accept.isPending}
									disabled={responding}
									style={{ minHeight: courierMotionSpace.control }}
									icon={
										<Ionicons
											name="arrow-forward"
											size={icon.control}
											color={colors.primaryForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									}
									onPress={() => {
										setBusyId(offer.id);
										acceptingDeliveryId.current = offer.deliveryId;
										accept.mutate({ offerId: offer.id });
									}}
								/>
								<CourierSheetSecondary
									label={t("delivery.offer.decline")}
									loading={busyId === offer.id && decline.isPending}
									disabled={responding}
									motion={motion}
									onPress={() => {
										setBusyId(offer.id);
										decline.mutate({ offerId: offer.id });
									}}
								/>
							</>
						)}
					</Animated.View>
				) : available ? (
					<View style={styles.waiting}>
						<Text
							variant="title"
							bold
							style={[styles.waitingTitle, { color: motion.sheetInk }]}
						>
							{t("delivery.motion.offer.waiting")}
						</Text>
						<Text variant="body" style={{ color: motion.sheetMuted }}>
							{activeDeliveries.length > 0
								? t("delivery.board.offers.busy")
								: t("delivery.board.empty.body")}
						</Text>
					</View>
				) : (
					<View style={styles.waiting}>
						<Text
							variant="title"
							bold
							style={[styles.waitingTitle, { color: motion.sheetInk }]}
						>
							{t("delivery.board.receiving.off")}
						</Text>
						<Text variant="body" style={{ color: motion.sheetMuted }}>
							{t("delivery.motion.availability.offline.body")}
						</Text>
					</View>
				)}

				{failure ? (
					<ErrorState
						error={failure}
						overrides={{
							CONFLICT: "delivery.board.offers.busy",
							NOT_FOUND: "delivery.offer.unavailable",
						}}
						onRetry={() => {
							if (busyId && accept.error) accept.mutate({ offerId: busyId });
							else if (busyId && decline.error)
								decline.mutate({ offerId: busyId });
						}}
					/>
				) : null}

				{invites.data?.length ? (
					<CourierSheetSecondary
						label={
							pendingInvites > 0
								? `${t("biz.courier.invites")} · ${tp("biz.courier.invites.pending", pendingInvites)}`
								: t("biz.courier.invites")
						}
						motion={motion}
						onPress={() => router.push("/courier-invites" as Href)}
					/>
				) : null}
			</BoardSlice>

			<ConfirmSheet
				open={offlineOpen}
				onClose={() => setOfflineOpen(false)}
				title={t("delivery.motion.availability.goOffline")}
				body={t("delivery.motion.availability.pauseConfirm")}
				confirmLabel={t("delivery.motion.availability.goOffline")}
				confirmVariant="primary"
				onConfirm={() => saveAvailability(false)}
			/>
		</SafeAreaView>
	);
}

const SLICE_THROW = 800;

function BoardSlice({
	motion,
	reduced,
	peekHeight,
	onPeekHeight,
	history,
	historyLabel,
	expandLabel,
	collapseLabel,
	emptyLabel,
	onOpenDelivery,
	orderLabel,
	children,
}: {
	motion: ReturnType<typeof courierMotionTokens>;
	reduced: boolean;
	peekHeight: number;
	onPeekHeight: (height: number) => void;
	history: { id: string; orderReference: string }[];
	historyLabel: string;
	expandLabel: string;
	collapseLabel: string;
	emptyLabel: string;
	onOpenDelivery: (id: string) => void;
	orderLabel: (code: string) => string;
	children: ReactNode;
}) {
	const { height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [expanded, setExpanded] = useState(false);
	const expandedH = Math.round(
		Math.min(height * 0.78, height - insets.top - 56),
	);
	const maxTravel = Math.max(0, expandedH - peekHeight);
	const y = useSharedValue(maxTravel);
	const startY = useSharedValue(maxTravel);
	const maxY = useSharedValue(maxTravel);

	useEffect(() => {
		maxY.value = maxTravel;
		const target = expanded ? 0 : maxTravel;
		y.value = reduced ? target : withSpring(target, spring.sheet);
	}, [maxTravel, expanded, reduced, maxY, y]);

	function settle(collapse: boolean) {
		setExpanded(!collapse);
		light();
		AccessibilityInfo.announceForAccessibility(
			collapse ? expandLabel : collapseLabel,
		);
	}

	const pan = Gesture.Pan()
		.activeOffsetY([-10, 10])
		.onStart(() => {
			startY.value = y.value;
		})
		.onUpdate((event) => {
			const next = startY.value + event.translationY;
			y.value = Math.min(maxY.value, Math.max(0, next));
		})
		.onEnd((event) => {
			const thrownDown = event.velocityY > SLICE_THROW;
			const thrownUp = event.velocityY < -SLICE_THROW;
			const collapse = thrownDown || (!thrownUp && y.value > maxY.value / 2);
			const target = collapse ? maxY.value : 0;
			if (reduced) y.value = target;
			else y.value = withSpring(target, spring.sheet);
			runOnJS(settle)(collapse);
		});

	const sheetStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: y.value }],
	}));

	return (
		<Animated.View
			style={[
				styles.sheet,
				{ height: expandedH, backgroundColor: motion.sheet },
				sheetStyle,
			]}
		>
			<View
				onLayout={(event) => {
					const next = Math.round(event.nativeEvent.layout.height);
					if (Math.abs(next - peekHeight) > 4) onPeekHeight(next);
				}}
			>
				<GestureDetector gesture={pan}>
					<Pressable
						onPress={() => settle(expanded)}
						ripple={false}
						accessibilityRole="button"
						accessibilityLabel={expanded ? collapseLabel : expandLabel}
						style={styles.sliceHandle}
					>
						<SheetHandle color={motion.handle} />
						<View style={styles.sliceHint}>
							<Text variant="caption" bold style={{ color: motion.sheetMuted }}>
								{historyLabel}
							</Text>
							<Ionicons
								name={expanded ? "chevron-down" : "chevron-up"}
								size={icon.inline}
								color={motion.sheetMuted}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</View>
					</Pressable>
				</GestureDetector>
				{children}
			</View>
			<ScrollView
				style={styles.historyList}
				contentContainerStyle={styles.historyContent}
				showsVerticalScrollIndicator={false}
			>
				{history.length === 0 ? (
					<Text variant="body" style={{ color: motion.sheetMuted }}>
						{emptyLabel}
					</Text>
				) : (
					history.map((delivery) => (
						<CourierSheetSecondary
							key={delivery.id}
							label={orderLabel(delivery.orderReference)}
							motion={motion}
							onPress={() => onOpenDelivery(delivery.id)}
						/>
					))
				)}
			</ScrollView>
		</Animated.View>
	);
}

function Banner({
	title,
	body,
	action,
	onAction,
	motion,
}: {
	title: string;
	body?: string;
	action: string;
	onAction: () => void;
	motion: ReturnType<typeof courierMotionTokens>;
}) {
	return (
		<View style={[styles.banner, { borderColor: motion.border }]}>
			<Text variant="body" bold style={{ color: motion.ink }}>
				{title}
			</Text>
			{body ? (
				<Text variant="caption" style={{ color: motion.muted }}>
					{body}
				</Text>
			) : null}
			<Button label={action} variant="secondary" onPress={onAction} />
		</View>
	);
}

function PressRow({
	title,
	onPress,
	motion,
	ink = false,
}: {
	title: string;
	onPress: () => void;
	motion?: ReturnType<typeof courierMotionTokens>;
	ink?: boolean;
}) {
	return (
		<Button
			label={title}
			variant={ink ? "secondary" : "ghost"}
			fullWidth
			onPress={onPress}
			style={
				motion
					? { borderColor: motion.border, backgroundColor: motion.elevated }
					: undefined
			}
		/>
	);
}

function RunsSkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();
	const lineHeight = Math.round(type.body.lineHeight * fontScale);
	return (
		<View style={styles.skeleton}>
			<Skeleton label={label} style={{ height: lineHeight }} />
			<Skeleton style={{ height: lineHeight }} />
			<Skeleton style={{ height: space.huge * 3 }} />
		</View>
	);
}

const styles = StyleSheet.create({
	canvas: { flex: 1 },
	top: { flex: 1 },
	topContent: {
		flexGrow: 1,
		paddingHorizontal: courierMotionSpace.gutter,
		paddingBottom: space.lg,
		gap: 0,
	},
	header: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: space.md,
		paddingTop: space.xs,
	},
	headerLead: { flex: 1, gap: 10 },
	sheet: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: courierMotionSpace.sheetRadius,
		borderTopRightRadius: courierMotionSpace.sheetRadius,
		paddingHorizontal: courierMotionSpace.gutter,
		paddingTop: space.md,
		paddingBottom: space.xl,
		overflow: "hidden",
		elevation: 3,
		shadowColor: "#101827",
		shadowOffset: { width: 0, height: -3 },
		shadowOpacity: 0.06,
		shadowRadius: 14,
	},
	sliceHandle: {
		alignItems: "center",
		minHeight: MIN_TOUCH_TARGET,
		paddingBottom: space.sm,
		gap: space.xs,
	},
	sliceHint: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	historyList: { flex: 1, marginTop: space.md },
	historyContent: { gap: space.sm, paddingBottom: space.lg },
	offer: { gap: space.lg },
	offerEyebrow: { ...courierDisplay.eyebrow },
	offerHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	merchantRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	merchantCopy: { flex: 1, gap: 2 },
	waiting: { gap: space.sm, paddingVertical: space.sm },
	waitingTitle: { ...courierDisplay.sheetTitle },
	banner: {
		gap: space.sm,
		padding: space.md,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
	},
	skeleton: { gap: space.lg },
});
