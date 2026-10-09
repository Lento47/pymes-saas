import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import type {
	DeliveryAction,
	DeliveryStatus,
	DeliveryStop,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
	Linking,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { isMapAvailable, MapView } from "@/components/map";
import { useRefreshControl } from "@/components/pull-refresh";
import { RatingInput, type RatingValue } from "@/components/rating-input";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import {
	startCourierTracking,
	stopCourierTracking,
} from "@/lib/courier-tracking";
import { formatClock } from "@/lib/format";
import { light, success, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, space, type, useTheme } from "@/theme";

const STATUS_KEYS: Record<DeliveryStatus, MessageKey> = {
	SEARCHING: "delivery.status.SEARCHING",
	OFFERED: "delivery.status.OFFERED",
	ACCEPTED: "delivery.status.ACCEPTED",
	TO_PICKUP: "delivery.status.TO_PICKUP",
	AT_PICKUP: "delivery.status.AT_PICKUP",
	PICKED_UP: "delivery.status.PICKED_UP",
	DELIVERED: "delivery.status.DELIVERED",
	CANCELLED: "delivery.status.CANCELLED",
};

const ACTION_KEYS: Record<DeliveryAction, MessageKey> = {
	START_TO_PICKUP: "delivery.action.startPickup",
	ARRIVE_PICKUP: "delivery.action.arrivePickup",
	CONFIRM_PICKUP: "delivery.action.confirmPickup",
	COMPLETE: "delivery.action.complete",
};

const POLL_MS = 5_000;

export default function CourierDeliveryDetailScreen() {
	const { t } = useT();
	const { id } = useLocalSearchParams<{ id: string }>();

	return (
		<Screen
			title={t("delivery.detail.title")}
			leading={<BackButton to="/delivery" />}
			bottomInset
			padded={false}
			contentStyle={styles.screenBody}
		>
			<SignedIn>
				<DeliveryDetail deliveryId={id} />
			</SignedIn>
		</Screen>
	);
}

function DeliveryDetail({ deliveryId }: { deliveryId: string }) {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const { session } = useSession();
	const cache = useQueryClient();
	const [completeOpen, setCompleteOpen] = useState(false);
	const [rating, setRating] = useState<RatingValue>(0);
	const [comment, setComment] = useState("");
	const query = useQuery(
		trpc.deliveries.byId.queryOptions(
			{ deliveryId },
			{ refetchInterval: POLL_MS },
		),
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
	const refreshControl = useRefreshControl(async () => {
		await query.refetch();
		if (query.data?.orderId && mapAvailable) await tracking.refetch();
	});
	const waiting = useSkeletonHold(query.isPending);
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
			<ErrorState error={query.error} onRetry={() => void query.refetch()} />
		);
	}
	if (waiting || !query.data)
		return <DeliverySkeleton label={t("state.loading")} />;

	const delivery = query.data;
	const action = actionFor(delivery.status);
	// A move can commit on the server and still lose its response. Once polling sees a
	// later step, the old mutation error no longer describes the delivery on screen.
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
	const positionStatus = tracking.isError
		? t("delivery.map.locationUnavailable")
		: courierPosition
			? Date.now() - courierPosition.at.getTime() < 60_000
				? t("order.track.live")
				: t("order.track.updated", {
						time: formatClock(courierPosition.at, intlLocale),
					})
			: t("delivery.map.locationWaiting");

	function runAction(next: DeliveryAction) {
		if (next === "COMPLETE") {
			setCompleteOpen(true);
			return;
		}
		advance.mutate({ deliveryId, action: next });
	}

	return (
		<View style={styles.screenBody}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				refreshControl={refreshControl}
				scrollIndicatorInsets={{ bottom: 0 }}
			>
				<Card style={styles.card}>
					<Text variant="label" tone="muted" tabular>
						{t("order.number", { code: delivery.orderReference })}
					</Text>
					<Text variant="heading" bold>
						{t(STATUS_KEYS[delivery.status])}
					</Text>
				</Card>

				{mapAvailable && pickupPoint && dropoffPoint ? (
					<View style={styles.mapGroup}>
						<MapView
							coords={pickupPoint}
							route={{ pickup: pickupPoint, destination: dropoffPoint }}
							marker={courierPosition}
							showUserLocation={false}
							accessibilityLabel={t("delivery.map.label")}
							style={styles.map}
						/>
						<Text variant="caption" tone="muted">
							{t("delivery.map.courierLocation", { status: positionStatus })}
						</Text>
					</View>
				) : null}

				<StopCard title={t("delivery.pickup")} stop={delivery.pickup} />
				<StopCard title={t("delivery.dropoff")} stop={delivery.dropoff} />

				{actionError ? (
					<ErrorState
						error={actionError}
						onRetry={() => {
							advance.reset();
							return query.refetch();
						}}
					/>
				) : null}

				{action ? (
					<Card style={styles.card}>
						{waitingReady ? (
							<Text variant="body" tone="muted">
								{t("delivery.waitingReady")}
							</Text>
						) : null}
						<Button
							label={t(ACTION_KEYS[action])}
							fullWidth
							loading={advance.isPending}
							disabled={advance.isPending || waitingReady}
							onPress={() => runAction(action)}
						/>
					</Card>
				) : null}

				{delivery.status === "DELIVERED" ? (
					<Card style={styles.card}>
						<Text variant="heading" bold>
							{t("delivery.rateCustomer.title")}
						</Text>
						{rated ? (
							<Text variant="body" tone="muted">
								{t("delivery.rateCustomer.thanks")}
							</Text>
						) : (
							<>
								<Text variant="body" tone="muted">
									{t("delivery.rateCustomer.subtitle")}
								</Text>
								<RatingInput
									value={rating}
									onChange={setRating}
									label={t("delivery.rateCustomer.title")}
									optionLabel={(value) =>
										t("review.stars", { count: value, stars: 5 })
									}
									disabled={rate.isPending}
								/>
								<Field
									label={t("review.comment")}
									value={comment}
									onChangeText={setComment}
									multiline
									maxLength={500}
									editable={!rate.isPending}
								/>
								{rate.error ? (
									<ErrorState
										error={rate.error}
										onRetry={() => {
											if (rating === 0) return;
											rate.mutate({
												deliveryId,
												rating,
												comment: comment.trim() || undefined,
											});
										}}
									/>
								) : null}
								<Button
									label={t("delivery.rateCustomer.submit")}
									fullWidth
									loading={rate.isPending}
									disabled={rating === 0 || rate.isPending}
									onPress={() => {
										if (rating === 0) return;
										rate.mutate({
											deliveryId,
											rating,
											comment: comment.trim() || undefined,
										});
									}}
								/>
							</>
						)}
					</Card>
				) : null}
			</ScrollView>

			<ConfirmSheet
				open={completeOpen}
				onClose={() => setCompleteOpen(false)}
				title={t("delivery.complete.confirm")}
				body={t("delivery.complete.body")}
				confirmLabel={t("delivery.action.complete")}
				onConfirm={() => advance.mutate({ deliveryId, action: "COMPLETE" })}
			/>
		</View>
	);
}

function StopCard({ title, stop }: { title: string; stop: DeliveryStop }) {
	const { t } = useT();
	const { colors } = useTheme();
	const address = [
		stop.line1,
		stop.line2,
		stop.city,
		stop.region,
		stop.postalCode,
	]
		.filter((part): part is string => Boolean(part))
		.join(", ");

	function navigate() {
		const destination =
			stop.lat != null && stop.lng != null
				? `${stop.lat},${stop.lng}`
				: address;
		const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
		void Linking.canOpenURL(url)
			.then((canOpen) => (canOpen ? Linking.openURL(url) : null))
			.catch(() => null);
	}

	return (
		<Card style={styles.card}>
			<Text variant="heading" bold>
				{title}
			</Text>
			<Text variant="body" bold>
				{stop.name}
			</Text>
			<Text variant="body">{address}</Text>
			{stop.instructions ? (
				<Text variant="caption" tone="muted">
					{stop.instructions}
				</Text>
			) : null}
			<Button
				label={t("delivery.navigate")}
				variant="secondary"
				fullWidth
				icon={
					<Ionicons
						name="navigate-outline"
						size={icon.control}
						color={colors.secondaryForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				}
				onPress={navigate}
			/>
		</Card>
	);
}

function actionFor(status: DeliveryStatus): DeliveryAction | null {
	if (status === "ACCEPTED") return "START_TO_PICKUP";
	if (status === "TO_PICKUP") return "ARRIVE_PICKUP";
	if (status === "AT_PICKUP") return "CONFIRM_PICKUP";
	if (status === "PICKED_UP") return "COMPLETE";
	return null;
}

function DeliverySkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();
	const line = (variant: keyof typeof type) => ({
		height: Math.round(type[variant].lineHeight * fontScale),
	});
	return (
		<View style={styles.scrollContent}>
			<Skeleton
				label={label}
				style={[styles.skeletonStatus, line("heading")]}
			/>
			<Skeleton style={[styles.skeletonCard, line("body")]} />
			<Skeleton style={[styles.skeletonCard, line("body")]} />
			<Skeleton style={[styles.skeletonAction, line("body")]} />
		</View>
	);
}

const styles = StyleSheet.create({
	screenBody: { flex: 1 },
	content: { gap: space.lg },
	scrollContent: {
		gap: space.lg,
		paddingHorizontal: space.lg,
		paddingBottom: space.huge,
	},
	card: { gap: space.sm },
	mapGroup: { gap: space.sm },
	map: { height: space.huge * 8 },
	skeletonStatus: { height: space.xl * 2 },
	skeletonCard: { height: space.huge * 3 },
	skeletonAction: { height: space.huge },
});
