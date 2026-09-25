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
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { ErrorState } from "@/components/error-state";
import { useRefreshControl } from "@/components/pull-refresh";
import { RatingInput, type RatingValue } from "@/components/rating-input";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { light, success, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, space, useTheme } from "@/theme";

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
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const [completeOpen, setCompleteOpen] = useState(false);
	const [rating, setRating] = useState<RatingValue>(0);
	const query = useQuery(
		trpc.deliveries.byId.queryOptions(
			{ deliveryId },
			{ refetchInterval: POLL_MS },
		),
	);
	const refreshControl = useRefreshControl(() => query.refetch());
	const waiting = useSkeletonHold(query.isPending);
	const advance = useMutation(
		trpc.deliveries.advance.mutationOptions({
			onSuccess: async (_delivery, input) => {
				if (input.action === "COMPLETE") success();
				else light();
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
	const waitingReady =
		action === "CONFIRM_PICKUP" &&
		delivery.orderStatus !== "READY" &&
		delivery.orderStatus !== "OUT_FOR_DELIVERY";
	const rated = delivery.ratings.courierToCustomer ?? rate.data;

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

				<StopCard title={t("delivery.pickup")} stop={delivery.pickup} />
				<StopCard title={t("delivery.dropoff")} stop={delivery.dropoff} />

				{advance.error ? <ErrorState error={advance.error} /> : null}

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
								{rate.error ? <ErrorState error={rate.error} /> : null}
								<Button
									label={t("delivery.rateCustomer.submit")}
									fullWidth
									loading={rate.isPending}
									disabled={rating === 0 || rate.isPending}
									onPress={() => {
										if (rating === 0) return;
										rate.mutate({ deliveryId, rating });
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
		void Linking.openURL(url).catch(() => {});
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
	return (
		<View style={styles.scrollContent}>
			<Skeleton label={label} style={styles.skeletonStatus} />
			<Skeleton style={styles.skeletonCard} />
			<Skeleton style={styles.skeletonCard} />
			<Skeleton style={styles.skeletonAction} />
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
	skeletonStatus: { height: space.xl * 2 },
	skeletonCard: { height: space.huge * 3 },
	skeletonAction: { height: space.huge },
});
