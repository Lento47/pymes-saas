import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import type {
	DeliveryAction,
	DeliveryDetail,
	DeliveryStatus,
	DeliveryStop,
} from "@pymeshub/shared";
import { formatMoney } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Linking,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Button } from "@/components/button";
import {
	CircleIconButton,
	CourierWordmark,
	MerchantMark,
	SheetHandle,
} from "@/components/courier-motion";
import { DeliveryConfirmationSlider } from "@/components/delivery-confirmation-slider";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { isMapAvailable, MapView } from "@/components/map";
import { Pressable } from "@/components/pressable";
import { RatingInput, type RatingValue } from "@/components/rating-input";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import {
	actionFor,
	currentStop,
	etaMinutes,
	headlineKind,
	kmFromMeters,
} from "@/lib/courier-motion";
import {
	startCourierTracking,
	stopCourierTracking,
} from "@/lib/courier-tracking";
import { formatAtMostOneDecimal, formatClock } from "@/lib/format";
import { light, success, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import {
	courierMotionSpace,
	courierMotionTokens,
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	type,
	useTheme,
} from "@/theme";

const ACTION_KEYS: Record<DeliveryAction, MessageKey> = {
	START_TO_PICKUP: "delivery.action.startPickup",
	ARRIVE_PICKUP: "delivery.action.arrivePickup",
	CONFIRM_PICKUP: "delivery.action.confirmPickup",
	COMPLETE: "delivery.action.complete",
};

const POLL_MS = 5_000;

export default function CourierDeliveryDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return (
		<SignedIn>
			<CourierRun deliveryId={id} />
		</SignedIn>
	);
}

function CourierRun({ deliveryId }: { deliveryId: string }) {
	const { t, intlLocale } = useT();
	const { colors, scheme } = useTheme();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const trpc = useTRPC();
	const { session } = useSession();
	const cache = useQueryClient();
	const [rating, setRating] = useState<RatingValue>(0);
	const [comment, setComment] = useState("");
	const [refitNonce, setRefitNonce] = useState(0);
	const [offerDismissed, setOfferDismissed] = useState<string | null>(null);
	const query = useQuery(
		trpc.deliveries.byId.queryOptions(
			{ deliveryId },
			{ refetchInterval: POLL_MS },
		),
	);
	const completedDark = scheme === "dark" && query.data?.status === "DELIVERED";
	const motion = courierMotionTokens(
		completedDark ? "completed" : "active",
		colors,
		scheme,
	);
	const offers = useQuery(
		trpc.deliveries.offers.queryOptions(undefined, {
			refetchInterval: POLL_MS,
		}),
	);
	const mapAvailable = Boolean(
		query.data?.pickup.lat != null &&
			query.data.pickup.lng != null &&
			query.data.dropoff.lat != null &&
			query.data.dropoff.lng != null &&
			isMapAvailable(),
	);
	const tracking = useQuery(
		trpc.orders.track.queryOptions(
			{ id: query.data?.orderId ?? "" },
			{
				enabled: Boolean(query.data?.orderId && mapAvailable),
				refetchInterval: 15_000,
			},
		),
	);
	const waiting = useSkeletonHold(query.isPending);
	const announcedStatus = useRef<DeliveryStatus | null>(null);
	useEffect(() => {
		const status = query.data?.status;
		if (!status || announcedStatus.current === status) return;
		announcedStatus.current = status;
		const kind = headlineKind(status);
		const lead =
			kind === "pickup"
				? t("delivery.motion.headline.pickup")
				: t("delivery.motion.headline.dropoff");
		const trail =
			kind === "done"
				? t("delivery.motion.headline.done")
				: kind === "cancelled"
					? t("delivery.motion.headline.cancelled")
					: status === "AT_PICKUP"
						? t("delivery.motion.headline.atMerchant")
						: t("delivery.motion.headline.enRoute");
		AccessibilityInfo.announceForAccessibility(`${lead} ${trail}`);
	}, [query.data?.status, t]);
	const advance = useMutation(
		trpc.deliveries.advance.mutationOptions({
			onSuccess: async (updated, input) => {
				if (input.action === "COMPLETE") success();
				else light();
				if (
					input.action === "CONFIRM_PICKUP" &&
					updated.orderStatus === "OUT_FOR_DELIVERY" &&
					session?.userId
				) {
					await startCourierTracking(updated.orderId, session.userId);
				} else if (input.action === "COMPLETE") {
					await stopCourierTracking();
				}
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
			},
			onError: warning,
		}),
	);
	const rate = useMutation(
		trpc.deliveries.rate.mutationOptions({
			onSuccess: async () => {
				success();
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
			},
			onError: warning,
		}),
	);

	if (query.isError) {
		return (
			<SafeAreaView
				edges={["top", "bottom"]}
				style={[styles.fill, { backgroundColor: motion.canvas }]}
			>
				<ErrorState error={query.error} onRetry={() => void query.refetch()} />
			</SafeAreaView>
		);
	}
	if (waiting || !query.data) {
		return (
			<SafeAreaView
				edges={["top", "bottom"]}
				style={[styles.fill, { backgroundColor: motion.canvas }]}
			>
				<DeliverySkeleton label={t("state.loading")} />
			</SafeAreaView>
		);
	}

	const delivery = query.data;
	const action = actionFor(delivery.status);
	const actionError =
		advance.variables?.action === action ? advance.error : null;
	const waitingReady =
		action === "CONFIRM_PICKUP" &&
		delivery.orderStatus !== "READY" &&
		delivery.orderStatus !== "OUT_FOR_DELIVERY";
	const rated = delivery.ratings.courierToCustomer ?? rate.data;
	const pickupPoint =
		delivery.pickup.lat != null && delivery.pickup.lng != null
			? { lat: delivery.pickup.lat, lng: delivery.pickup.lng }
			: null;
	const dropoffPoint =
		delivery.dropoff.lat != null && delivery.dropoff.lng != null
			? { lat: delivery.dropoff.lat, lng: delivery.dropoff.lng }
			: null;
	const courier = tracking.data?.courier;
	const courierPosition =
		courier?.lat != null && courier.lng != null && courier.updatedAt != null
			? { lat: courier.lat, lng: courier.lng, at: courier.updatedAt }
			: null;
	const minutes = etaMinutes(delivery.routeDurationSeconds);
	const distanceKm = kmFromMeters(delivery.routeDistanceMeters);
	const kind = headlineKind(delivery.status);
	const destinationName =
		kind === "pickup" ? delivery.pickup.name : delivery.dropoff.name;
	const destinationArea =
		kind === "pickup"
			? [delivery.pickup.city, delivery.pickup.region]
					.filter(Boolean)
					.join(", ")
			: [delivery.dropoff.city, delivery.dropoff.region]
					.filter(Boolean)
					.join(", ");
	const concurrent = (offers.data ?? []).find(
		(row) => row.deliveryId !== delivery.id,
	);
	const showConcurrent =
		concurrent != null &&
		offerDismissed !== concurrent.id &&
		delivery.status !== "DELIVERED" &&
		delivery.status !== "CANCELLED";
	const sheetReserve = Math.round(height * 0.38);
	const contactPhone =
		kind === "pickup" ? delivery.business.phone : delivery.customer.phone;

	function runAction(next: DeliveryAction) {
		advance.mutate({ deliveryId, action: next });
	}

	return (
		<View style={[styles.fill, { backgroundColor: motion.canvas }]}>
			<StatusBar style={completedDark ? "light" : "dark"} />
			{mapAvailable && pickupPoint && dropoffPoint ? (
				<MapView
					coords={pickupPoint}
					route={{
						pickup: pickupPoint,
						destination: dropoffPoint,
						geometry: delivery.routeGeometry,
					}}
					marker={courierPosition}
					showUserLocation={false}
					fitPadding={{
						top: insets.top + 128,
						right: 56,
						bottom: sheetReserve,
						left: 24,
					}}
					refitNonce={refitNonce}
					accessibilityLabel={t(
						courierPosition ? "order.map.courier" : "delivery.map.label",
					)}
					style={styles.mapBleed}
				/>
			) : (
				<View style={[styles.mapBleed, { backgroundColor: motion.canvas }]} />
			)}
			{completedDark ? (
				<View
					pointerEvents="none"
					style={[styles.mapBleed, styles.completedMapScrim]}
				/>
			) : null}

			<SafeAreaView
				edges={["top"]}
				style={[styles.overlay, { paddingBottom: sheetReserve }]}
				pointerEvents="box-none"
			>
				<View style={styles.header} pointerEvents="box-none">
					<CourierWordmark color={motion.ink} />
					<CircleIconButton
						name="close-outline"
						label={t("delivery.board.title")}
						color={motion.ink}
						background={motion.sheet}
						border={motion.border}
						onPress={() => router.push("/delivery" as Href)}
					/>
				</View>

				<View style={styles.headline}>
					<Text
						variant="display"
						bold
						style={[styles.display, { color: motion.ink }]}
					>
						{kind === "pickup"
							? t("delivery.motion.headline.pickup")
							: t("delivery.motion.headline.dropoff")}
					</Text>
					<Text
						variant="display"
						style={[styles.displaySoft, { color: motion.muted }]}
					>
						{kind === "done"
							? t("delivery.motion.headline.done")
							: kind === "cancelled"
								? t("delivery.motion.headline.cancelled")
								: delivery.status === "AT_PICKUP"
									? t("delivery.motion.headline.atMerchant")
									: t("delivery.motion.headline.enRoute")}
					</Text>
					<View style={styles.metaRow}>
						<View style={styles.metaCopy}>
							<Text variant="heading" bold style={{ color: motion.ink }}>
								{destinationArea || destinationName}
							</Text>
							{minutes != null || distanceKm != null ? (
								<Text variant="caption" style={{ color: motion.muted }}>
									{[
										minutes != null
											? t("delivery.motion.eta.minutes", { count: minutes })
											: null,
										distanceKm != null
											? t("delivery.motion.distance.km", {
													value: formatAtMostOneDecimal(distanceKm, intlLocale),
												})
											: null,
									]
										.filter(Boolean)
										.join(" · ")}
								</Text>
							) : null}
						</View>
						<CircleIconButton
							name="arrow-forward"
							label={t("delivery.navigate")}
							color={motion.brandInk}
							background={motion.brand}
							border={motion.brand}
							onPress={() =>
								openDirections(
									kind === "pickup" ? delivery.pickup : delivery.dropoff,
								)
							}
						/>
					</View>
				</View>

				<View style={styles.mapGap} pointerEvents="box-none">
					<View style={styles.mapTools} pointerEvents="box-none">
						<CircleIconButton
							name="locate-outline"
							label={t("delivery.motion.recenter")}
							color={motion.ink}
							background={motion.sheet}
							border={motion.border}
							onPress={() => setRefitNonce((n) => n + 1)}
						/>
					</View>
					{minutes != null ? (
						<View
							style={[
								styles.etaChip,
								{ backgroundColor: motion.sheet, borderColor: motion.border },
							]}
						>
							<Text variant="caption" style={{ color: motion.muted }}>
								{t("delivery.motion.eta")}
							</Text>
							<Text variant="heading" bold style={{ color: motion.ink }}>
								{t("delivery.motion.eta.minutes", { count: minutes })}
							</Text>
						</View>
					) : null}
				</View>

				{showConcurrent && concurrent ? (
					<Pressable
						onPress={() => router.push("/delivery" as Href)}
						accessibilityRole="button"
						accessibilityLabel={t("delivery.motion.offer.concurrent")}
						style={[
							styles.concurrent,
							{ backgroundColor: motion.sheet, borderColor: motion.border },
						]}
					>
						<View style={styles.concurrentCopy}>
							<Text variant="body" bold style={{ color: motion.ink }}>
								{t("delivery.motion.offer.concurrent")}
							</Text>
							{concurrent.courierFeeMinor != null &&
							concurrent.courierFeeMinor > 0 ? (
								<Text variant="caption" tabular style={{ color: motion.muted }}>
									{formatMoney(
										concurrent.courierFeeMinor,
										concurrent.currency ?? "CRC",
										{ locale: intlLocale },
									)}
								</Text>
							) : null}
						</View>
						<Pressable
							onPress={() => setOfferDismissed(concurrent.id)}
							accessibilityRole="button"
							accessibilityLabel={t("action.close")}
						>
							<Ionicons
								name="close"
								size={icon.control}
								color={motion.muted}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</Pressable>
					</Pressable>
				) : null}
			</SafeAreaView>

			<View
				style={[
					styles.sheet,
					{
						backgroundColor: motion.sheet,
						paddingBottom: insets.bottom + space.md,
					},
				]}
			>
				<SheetHandle color={motion.handle} />
				<TaskSheet
					delivery={delivery}
					motion={motion}
					intlLocale={intlLocale}
					contactPhone={contactPhone}
					action={action}
					waitingReady={waitingReady}
					actionError={actionError}
					advancePending={advance.isPending}
					onAdvance={runAction}
					onRetry={() => {
						advance.reset();
						return query.refetch();
					}}
					rated={Boolean(rated)}
					rating={rating}
					comment={comment}
					onRating={setRating}
					onComment={setComment}
					ratePending={rate.isPending}
					rateError={rate.error}
					onRate={() => {
						if (rating === 0) return;
						rate.mutate({
							deliveryId,
							rating,
							comment: comment.trim() || undefined,
						});
					}}
				/>
			</View>
		</View>
	);
}

function TaskSheet({
	delivery,
	motion,
	intlLocale,
	contactPhone,
	action,
	waitingReady,
	actionError,
	advancePending,
	onAdvance,
	onRetry,
	rated,
	rating,
	comment,
	onRating,
	onComment,
	ratePending,
	rateError,
	onRate,
}: {
	delivery: DeliveryDetail;
	motion: ReturnType<typeof courierMotionTokens>;
	intlLocale: string;
	contactPhone: string | null;
	action: DeliveryAction | null;
	waitingReady: boolean;
	actionError: unknown;
	advancePending: boolean;
	onAdvance: (action: DeliveryAction) => void;
	onRetry: () => unknown;
	rated: boolean;
	rating: RatingValue;
	comment: string;
	onRating: (value: RatingValue) => void;
	onComment: (value: string) => void;
	ratePending: boolean;
	rateError: unknown;
	onRate: () => void;
}) {
	const { t } = useT();
	const picked =
		delivery.pickedUpAt != null
			? `${t("delivery.motion.picked")} · ${formatClock(delivery.pickedUpAt, intlLocale)}`
			: t("delivery.stop.pickup");

	return (
		<View style={styles.task}>
			<View style={styles.merchantRow}>
				<MerchantMark
					name={delivery.business.name}
					color={motion.sheetInk}
					background={motion.sheetControl}
				/>
				<View style={styles.merchantCopy}>
					<Text variant="heading" bold style={{ color: motion.sheetInk }}>
						{delivery.business.name}
					</Text>
					<Text variant="caption" style={{ color: motion.sheetMuted }}>
						{picked}
					</Text>
				</View>
				{delivery.courierFeeMinor != null && delivery.courierFeeMinor > 0 ? (
					<Text variant="label" bold tabular style={{ color: motion.sheetInk }}>
						{formatMoney(delivery.courierFeeMinor, delivery.currency, {
							locale: intlLocale,
						})}
					</Text>
				) : null}
			</View>

			{delivery.status === "CANCELLED" ? (
				<Text variant="body" style={{ color: motion.sheetMuted }}>
					{t("delivery.status.CANCELLED")}
				</Text>
			) : null}

			<RouteStops
				pickup={delivery.pickup}
				dropoff={delivery.dropoff}
				status={delivery.status}
				motion={motion}
			/>

			<View style={styles.contacts}>
				<ContactButton
					label={t("delivery.motion.call")}
					icon="call-outline"
					disabled={!contactPhone}
					motion={motion}
					onPress={() => {
						if (!contactPhone) return;
						void Linking.openURL(`tel:${contactPhone}`);
					}}
				/>
				<ContactButton
					label={t("delivery.motion.message")}
					icon="chatbubble-outline"
					disabled={!contactPhone}
					motion={motion}
					onPress={() => {
						if (!contactPhone) return;
						void Linking.openURL(`sms:${contactPhone}`);
					}}
				/>
			</View>

			{actionError ? (
				<ErrorState error={actionError} onRetry={onRetry} />
			) : null}

			{waitingReady ? (
				<Text variant="body" style={{ color: motion.sheetMuted }}>
					{t("delivery.waitingReady")}
				</Text>
			) : null}

			{action === "COMPLETE" ? (
				<DeliveryConfirmationSlider
					label={t("delivery.motion.slide")}
					accessibleLabel={t("delivery.motion.slide.a11y")}
					motion={motion}
					disabled={advancePending || waitingReady}
					loading={advancePending}
					onComplete={() => onAdvance("COMPLETE")}
				/>
			) : action ? (
				<Button
					label={t(ACTION_KEYS[action])}
					fullWidth
					size="lg"
					shape="pill"
					loading={advancePending}
					disabled={advancePending || waitingReady}
					onPress={() => onAdvance(action)}
				/>
			) : null}

			{delivery.status === "DELIVERED" ? (
				rated ? (
					<Text variant="body" style={{ color: motion.sheetMuted }}>
						{t("delivery.rateCustomer.thanks")}
					</Text>
				) : (
					<View style={styles.rate}>
						<Text variant="heading" bold style={{ color: motion.sheetInk }}>
							{t("delivery.rateCustomer.title")}
						</Text>
						<RatingInput
							value={rating}
							onChange={onRating}
							label={t("delivery.rateCustomer.title")}
							optionLabel={(value) =>
								t("review.stars", { count: value, stars: 5 })
							}
							disabled={ratePending}
						/>
						<Field
							label={t("review.comment")}
							value={comment}
							onChangeText={onComment}
							multiline
							maxLength={500}
							editable={!ratePending}
						/>
						{rateError ? (
							<ErrorState error={rateError} onRetry={onRate} />
						) : null}
						<Button
							label={t("delivery.rateCustomer.submit")}
							fullWidth
							loading={ratePending}
							disabled={rating === 0 || ratePending}
							onPress={onRate}
						/>
					</View>
				)
			) : null}
		</View>
	);
}

function ContactButton({
	label,
	icon: glyph,
	disabled,
	motion,
	onPress,
}: {
	label: string;
	icon: React.ComponentProps<typeof Ionicons>["name"];
	disabled: boolean;
	motion: ReturnType<typeof courierMotionTokens>;
	onPress: () => void;
}) {
	const { t } = useT();
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={
				disabled ? t("delivery.motion.contact.unavailable") : undefined
			}
			style={[
				styles.contact,
				{
					backgroundColor: motion.sheetControl,
					borderColor: motion.sheetBorder,
				},
			]}
		>
			<Ionicons
				name={glyph}
				size={icon.control}
				color={motion.sheetInk}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant="label" bold style={{ color: motion.sheetInk }}>
				{label}
			</Text>
		</Pressable>
	);
}

function stopStreet(stop: DeliveryStop) {
	return [stop.line1, stop.line2].filter(Boolean).join(", ");
}

function openDirections(stop: DeliveryStop) {
	const destination =
		stop.lat != null && stop.lng != null
			? `${stop.lat},${stop.lng}`
			: stopStreet(stop) || stop.city;
	const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
	void Linking.canOpenURL(url)
		.then((canOpen) => (canOpen ? Linking.openURL(url) : null))
		.catch(() => null);
}

export function RouteStops({
	pickup,
	dropoff,
	status,
	motion,
}: {
	pickup: DeliveryStop;
	dropoff: DeliveryStop;
	status: DeliveryStatus;
	motion: ReturnType<typeof courierMotionTokens>;
}) {
	const active = currentStop(status);
	return (
		<View style={styles.route}>
			<StopRow
				kind="pickup"
				stop={pickup}
				active={active === "pickup"}
				connect
				motion={motion}
			/>
			<StopRow
				kind="dropoff"
				stop={dropoff}
				active={active === "dropoff"}
				motion={motion}
			/>
		</View>
	);
}

function StopRow({
	kind,
	stop,
	active,
	connect = false,
	motion,
}: {
	kind: "pickup" | "dropoff";
	stop: DeliveryStop;
	active: boolean;
	connect?: boolean;
	motion: ReturnType<typeof courierMotionTokens>;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const label =
		kind === "pickup" ? t("delivery.stop.pickup") : t("delivery.stop.dropoff");
	const spokenTitle =
		kind === "pickup" ? t("delivery.pickup") : t("delivery.dropoff");
	const street = stopStreet(stop);
	const markColor = active ? colors.primary : motion.sheetMuted;
	const glyphColor = active ? colors.primaryForeground : motion.sheet;

	return (
		<View style={styles.stop}>
			<View style={styles.rail}>
				<View style={[styles.marker, { backgroundColor: markColor }]}>
					<Ionicons
						name={kind === "pickup" ? "storefront-outline" : "home-outline"}
						size={icon.inline}
						color={glyphColor}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</View>
				{connect ? (
					<View
						style={[styles.connector, { backgroundColor: motion.sheetBorder }]}
					/>
				) : null}
			</View>
			<View style={[styles.stopBody, connect ? styles.stopGap : null]}>
				<Text variant="caption" style={{ color: motion.sheetMuted }}>
					{label}
				</Text>
				<Text variant="body" bold style={{ color: motion.sheetInk }}>
					{kind === "dropoff" ? stop.city || stop.name : stop.name}
				</Text>
				{kind === "dropoff" ? (
					<Text variant="caption" style={{ color: motion.sheetMuted }}>
						{t("delivery.motion.customer")}
					</Text>
				) : street ? (
					<Text variant="caption" style={{ color: motion.sheetMuted }}>
						{street}
					</Text>
				) : null}
			</View>
			<Pressable
				onPress={() => openDirections(stop)}
				accessibilityRole="button"
				accessibilityLabel={`${t("delivery.navigate")}. ${spokenTitle}. ${stop.name}`}
				hitSlop={8}
				style={styles.navigate}
			>
				<Ionicons
					name="navigate-outline"
					size={icon.control}
					color={motion.sheetInk}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Pressable>
		</View>
	);
}

function DeliverySkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();
	const line = (variant: keyof typeof type) => ({
		height: Math.round(type[variant].lineHeight * fontScale),
	});
	return (
		<View style={styles.skeleton}>
			<Skeleton label={label} style={[styles.skeletonHero, line("display")]} />
			<Skeleton style={[styles.skeletonSheet, line("body")]} />
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	mapBleed: {
		...StyleSheet.absoluteFill,
		height: "100%",
		borderRadius: 0,
		borderWidth: 0,
	},
	completedMapScrim: { backgroundColor: "rgba(10, 16, 28, 0.68)" },
	overlay: {
		...StyleSheet.absoluteFill,
		paddingHorizontal: courierMotionSpace.gutter,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headline: { marginTop: space.lg, gap: 0 },
	mapGap: { flex: 1, justifyContent: "flex-end" },
	mapTools: {
		position: "absolute",
		right: 0,
		top: space.lg,
		gap: space.sm,
	},
	display: {
		fontSize: 34,
		lineHeight: 38,
		letterSpacing: -1,
	},
	displaySoft: {
		fontSize: 34,
		lineHeight: 38,
		letterSpacing: -1,
		fontWeight: "600",
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		marginTop: space.md,
	},
	metaCopy: { flex: 1, gap: 2 },
	etaChip: {
		alignSelf: "flex-end",
		marginBottom: space.md,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
	},
	concurrentCopy: { flex: 1, gap: 2 },
	concurrent: {
		marginTop: space.md,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
	},
	sheet: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: courierMotionSpace.sheetRadius,
		borderTopRightRadius: courierMotionSpace.sheetRadius,
		paddingHorizontal: courierMotionSpace.gutter,
		paddingTop: space.lg,
		elevation: 12,
		shadowColor: "#101827",
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.08,
		shadowRadius: 16,
	},
	task: { gap: space.md },
	merchantRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	merchantCopy: { flex: 1, gap: 2 },
	contacts: { flexDirection: "row", gap: space.sm },
	contact: {
		flex: 1,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.sm,
		paddingVertical: space.md,
	},
	rate: { gap: space.md },
	route: { gap: 0 },
	stop: { flexDirection: "row", alignItems: "stretch", gap: space.md },
	rail: { width: 28, alignItems: "center" },
	marker: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	connector: { width: 2, flex: 1, minHeight: 12, marginVertical: 4 },
	stopBody: { flex: 1, gap: 2 },
	stopGap: { paddingBottom: space.lg },
	navigate: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
	skeleton: { flex: 1, padding: space.xxl, justifyContent: "space-between" },
	skeletonHero: { height: space.huge * 3 },
	skeletonSheet: { height: space.huge * 6 },
});
