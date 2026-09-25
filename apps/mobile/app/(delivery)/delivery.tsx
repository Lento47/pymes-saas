import type { DeliveryDetail, DeliveryOffer } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { type Href, router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { formatAtMostOneDecimal } from "@/lib/format";
import { light, success, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

const BOARD_POLL_MS = 5_000;
const LOCATION_HEARTBEAT_MS = 45_000;
const LOCATION_MOVE_REPORT_MS = 15_000;

export default function DeliveryScreen() {
	const { t } = useT();
	return (
		<Screen
			title={t("delivery.board.title")}
			subtitle={t("delivery.board.subtitle")}
			scroll
			bottomInset
			contentStyle={styles.screen}
		>
			<SignedIn>
				<CourierBoard />
			</SignedIn>
		</Screen>
	);
}

function CourierBoard() {
	const { t } = useT();
	const trpc = useTRPC();
	const profile = useQuery(trpc.couriers.profile.queryOptions());
	const memberships = useQuery(trpc.business.myBusinesses.queryOptions());
	const offers = useQuery(
		trpc.deliveries.offers.queryOptions(undefined, {
			refetchInterval: BOARD_POLL_MS,
		}),
	);
	const deliveries = useQuery(
		trpc.deliveries.mine.queryOptions(undefined, {
			refetchInterval: BOARD_POLL_MS,
		}),
	);

	const error =
		profile.error ?? memberships.error ?? offers.error ?? deliveries.error;
	if (error) {
		return (
			<ErrorState
				error={error}
				onRetry={() => {
					void Promise.all([
						profile.refetch(),
						memberships.refetch(),
						offers.refetch(),
						deliveries.refetch(),
					]);
				}}
			/>
		);
	}

	if (
		profile.isPending ||
		memberships.isPending ||
		offers.isPending ||
		deliveries.isPending
	) {
		return <BoardSkeleton />;
	}

	const courierMembership = memberships.data?.some(
		(membership) => membership.role === "COURIER",
	);
	if (!courierMembership) {
		return (
			<>
				<EmptyState
					icon="bicycle-outline"
					title={t("biz.courier.pending.title")}
					body={t("biz.courier.pending.body")}
					actionLabel={t("biz.courier.invites")}
					onAction={() => router.push("/courier-invites")}
				/>
				<CourierActions />
			</>
		);
	}

	const canReceiveOffers =
		profile.data?.verificationStatus === "VERIFIED" && profile.data.isAvailable;
	const active =
		deliveries.data?.filter((delivery) => delivery.status !== "DELIVERED") ??
		[];
	const history =
		deliveries.data?.filter((delivery) => delivery.status === "DELIVERED") ??
		[];

	return (
		<View style={styles.stack}>
			<Presence enabled={canReceiveOffers} />
			{offers.data && offers.data.length > 0 ? (
				<ScreenSection title={t("delivery.board.offers")}>
					<View style={styles.stack}>
						{offers.data.map((offer) => (
							<OfferCard key={offer.id} offer={offer} />
						))}
					</View>
				</ScreenSection>
			) : null}

			{active.length > 0 ? (
				<ScreenSection title={t("delivery.board.active")}>
					<View style={styles.stack}>
						{active.map((delivery) => (
							<DeliveryCard key={delivery.id} delivery={delivery} />
						))}
					</View>
				</ScreenSection>
			) : null}

			{history.length > 0 ? (
				<ScreenSection title={t("delivery.board.history")}>
					<View style={styles.stack}>
						{history.map((delivery) => (
							<DeliveryCard key={delivery.id} delivery={delivery} />
						))}
					</View>
				</ScreenSection>
			) : null}

			{offers.data?.length === 0 && deliveries.data?.length === 0 ? (
				<EmptyState
					icon="bicycle-outline"
					title={t("delivery.board.empty")}
					body={t("delivery.board.empty.body")}
				/>
			) : null}
			<CourierActions />
		</View>
	);
}

function Presence({ enabled }: { enabled: boolean }) {
	const { t } = useT();
	const trpc = useTRPC();
	const location = useDeviceLocation();
	const report = useMutation(trpc.deliveries.reportPresence.mutationOptions());

	useEffect(() => {
		if (!enabled || location.status !== "granted" || !location.coords) return;

		let active = true;
		let watch: Location.LocationSubscription | undefined;
		let latest = {
			lat: location.coords.lat,
			lng: location.coords.lng,
			accuracyMeters: undefined as number | undefined,
		};
		let lastSent = 0;
		const send = () => {
			if (!active) return;
			lastSent = Date.now();
			report.mutate(latest);
		};

		send();
		const heartbeat = setInterval(send, LOCATION_HEARTBEAT_MS);
		void Location.watchPositionAsync(
			{
				accuracy: Location.Accuracy.Balanced,
				distanceInterval: 20,
			},
			(position) => {
				latest = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
					accuracyMeters: position.coords.accuracy ?? undefined,
				};
				if (Date.now() - lastSent >= LOCATION_MOVE_REPORT_MS) send();
			},
		).then((subscription) => {
			if (active) watch = subscription;
			else subscription.remove();
		});

		return () => {
			active = false;
			clearInterval(heartbeat);
			watch?.remove();
		};
	}, [enabled, location.coords, location.status, report.mutate]);

	if (!enabled || location.status === "granted") return null;
	return (
		<Card>
			<View style={styles.stackSmall}>
				<Text variant="body">{t("delivery.presence.denied")}</Text>
				<Button
					label={t("location.use")}
					variant="secondary"
					onPress={location.request}
				/>
			</View>
		</Card>
	);
}

function OfferCard({ offer }: { offer: DeliveryOffer }) {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const refresh = async () => {
		await cache.invalidateQueries({ queryKey: trpc.deliveries.pathKey() });
	};
	const accept = useMutation(
		trpc.deliveries.acceptOffer.mutationOptions({
			onSuccess: async (delivery) => {
				success();
				await refresh();
				router.push(`/delivery/${delivery.id}` as Href);
			},
			onError: warning,
		}),
	);
	const decline = useMutation(
		trpc.deliveries.declineOffer.mutationOptions({
			onSuccess: async () => {
				light();
				await refresh();
			},
			onError: warning,
		}),
	);
	const busy = accept.isPending || decline.isPending;

	return (
		<Card>
			<View style={styles.stackSmall}>
				<Text variant="heading" bold>
					{offer.businessName}
				</Text>
				<Text variant="label" tone="muted">
					{t("order.number", { code: offer.orderReference })}
				</Text>
				<Text variant="body">{offer.pickup.name}</Text>
				<Text variant="body" tone="muted">
					{offer.dropoffArea}
				</Text>
				{offer.distanceToPickupKm === null ? null : (
					<Text variant="caption" tone="muted">
						{t("delivery.offer.distance", {
							value: formatAtMostOneDecimal(
								offer.distanceToPickupKm,
								intlLocale,
							),
						})}
					</Text>
				)}
				{accept.error ? <ErrorState error={accept.error} /> : null}
				{decline.error ? <ErrorState error={decline.error} /> : null}
				<View style={styles.actions}>
					<Button
						label={t("delivery.offer.accept")}
						loading={accept.isPending}
						disabled={busy}
						onPress={() => accept.mutate({ offerId: offer.id })}
					/>
					<Button
						label={t("delivery.offer.decline")}
						variant="ghost"
						loading={decline.isPending}
						disabled={busy}
						onPress={() => decline.mutate({ offerId: offer.id })}
					/>
				</View>
			</View>
		</Card>
	);
}

function DeliveryCard({ delivery }: { delivery: DeliveryDetail }) {
	const { t } = useT();
	return (
		<Card
			onPress={() => router.push(`/delivery/${delivery.id}` as Href)}
			accessibilityLabel={`${delivery.business.name}, ${t(`delivery.status.${delivery.status}`)}`}
		>
			<View style={styles.stackSmall}>
				<View style={styles.row}>
					<Text variant="heading" bold style={styles.grow}>
						{delivery.business.name}
					</Text>
					<Text variant="caption" tone="muted">
						{t(`delivery.status.${delivery.status}`)}
					</Text>
				</View>
				<Text variant="label" tone="muted">
					{t("order.number", { code: delivery.orderReference })}
				</Text>
			</View>
		</Card>
	);
}

function CourierActions() {
	const { t } = useT();
	return (
		<View style={styles.stackSmall}>
			<Button
				label={t("biz.courier.profile")}
				variant="secondary"
				fullWidth
				onPress={() => router.push("/courier-profile")}
			/>
			<Button
				label={t("biz.courier.invites")}
				variant="ghost"
				fullWidth
				onPress={() => router.push("/courier-invites")}
			/>
		</View>
	);
}

function BoardSkeleton() {
	const { t } = useT();
	return (
		<View style={styles.stack} accessibilityLabel={t("state.loading")}>
			<Skeleton style={styles.skeleton} radiusToken="md" />
			<Skeleton style={styles.skeleton} radiusToken="md" />
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { gap: space.lg },
	stack: { gap: space.md },
	stackSmall: { gap: space.sm },
	actions: { gap: space.sm },
	row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
	grow: { flex: 1 },
	skeleton: { height: space.huge * 3 },
});
