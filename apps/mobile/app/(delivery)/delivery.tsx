import Ionicons from "@expo/vector-icons/Ionicons";
import { MOVE_LABELS } from "@pymeshub/i18n";
import type { OrderStatus } from "@pymeshub/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListEnd } from "@/components/list-end";
import { ListRow } from "@/components/list-row";
import { Price } from "@/components/price";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { StatusBadge, statusKey } from "@/components/status-badge";
import { Text } from "@/components/text";
import { toApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import {
	reconcileCourierTracking,
	type StartTrackingResult,
	startCourierTracking,
	stopCourierTracking,
} from "@/lib/courier-tracking";
import { formatStamp } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { useTRPC } from "@/lib/trpc/context";
import { icon, space, TEXT_STACK_GAP, type, useTheme } from "@/theme";

/**
 * The courier's board: the runs assigned to this person, and the move each one is waiting for.
 *
 * ## Why it is a screen of its own rather than a state of `app/business.tsx`
 *
 * The API has answered a courier since the `COURIER` role existed — three procedures and a
 * flag (`docs/api-surface.md`) — and no client has ever drawn it: the app knew couriers only
 * as an email the owner invites (`app/business-delivery.tsx`) and as a name on the customer's
 * tracker (`app/order/[id].tsx`). A courier who signed in saw the customer's four doors, and
 * the shop's board was refused to them by `orders:read`'s own middleware. This is the third
 * profile's view: the device identifies it at sign-in/sign-up (`auth.role.*`) or on
 * `app/account.tsx`'s switch, and this is where that choice leads.
 *
 * ## What the board is made of, and what it deliberately is not
 *
 * The read is `orders.list` with `role: "BUSINESS"` and `assignedToMe`, and **no**
 * `businessId` — which is the whole of the change, and the docblock used to say `orders.queue`
 * in five places after the code stopped doing that. `orders.queue` cannot serve this screen:
 * it is a `businessProcedure`, so it resolves a tenant from the input's `businessId` and
 * refuses a caller with no membership of it, and a courier's runs belong to shops they are not
 * members of. `orders.list` is the `protectedProcedure` that was already cross-cutting, and it
 * branches on `role` to the same query. `assignedToMe` adds exactly one condition,
 * `courierUserId = caller`, and that condition *is* the scope: a courier sees their own runs,
 * from every shop, and no shop's other orders.
 *
 * The move buttons are the order's own `nextStatuses`, which the API computes **for the
 * caller's actor** (`apps/api/src/services/mappers.ts:522` → `actorFor` returns `COURIER`
 * when the caller is the order's carrier, which is the fact rather than a membership —
 * see `services/orders.ts`'s `actorFor` for why the two must move together). So this screen
 * does not filter a table: it draws what the machine says this person may do, which is exactly
 * two moves — `READY → OUT_FOR_DELIVERY` ("start the run") and `OUT_FOR_DELIVERY → COMPLETED`
 * ("delivered"). Anything else is refused by the API with `ValidationError` before this screen
 * could offer it.
 *
 * It is not the shop's board with fewer rows. There is no shop header (`business.settings` is
 * the owner's read, and a courier has no reason to see the shop's phone and status), no stats,
 * and no assignment control: `orders.assign` is `staff:manage`, which `COURIER` deliberately
 * lacks — a courier cannot hand a run to anybody, including back.
 *
 * ## The row opens the order, and that is where the address is
 *
 * `OrderSummary` carries no address and no customer (`packages/shared/src/schemas/order.ts`):
 * reference, status, headline, total, stamp, and the caller's own next moves. The address is
 * on `OrderDetail`, which is `app/order/[id].tsx` — so the card is pressable and the tap is
 * how a courier finds out where the run goes. The board is the list; the detail is the
 * destination.
 *
 * ## The courier's third procedure, and where it is called
 *
 * `orders.reportLocation` — assigned courier, `OUT_FOR_DELIVERY` only, twelve a minute — is
 * called from `CourierSharing` below, which watches the phone's position while a run is on the
 * road and posts it. That is what puts a dot on the buyer's tracker: the position lands on the
 * order row and `orders.track` hands it back to whoever may read the order.
 *
 * It is a reporter, not a tracker. The API holds the latest ping and no history, and a courier
 * the customer cannot see — declined permission, a phone that has not moved, a run still on the
 * counter — is a state the buyer's screen names rather than one this screen hides.
 */

/** How many runs one page of the board holds. The same 20 as the shop's board and the customer's list. */
const PAGE_SIZE = 20;

/**
 * How often the courier's phone is allowed to post a position.
 *
 * Fifteen seconds, which is the API's own number and not this screen's: `orders.reportLocation`
 * is rate-limited to twelve a minute (`apps/api/src/services/orders.ts`), and its own docblock
 * says the limit is sized "for a phone that reports every fifteen seconds". Four a minute
 * against a ceiling of twelve leaves room for a retry, which one a minute would not.
 *
 * The interval is enforced here on the fix rather than by a timer, so a phone that has been
 * still for a minute posts once when it moves rather than four times while parked.
 */
/**
 * How long the board waits before re-reading itself.
 *
 * Five seconds, the shop board's interval and for the same reason: this is a work queue, not a
 * list. A courier reading it is about to ride a run, and dispatch is the thing that changes it.
 */
const BOARD_POLL_MS = 5000;

export default function DeliveryScreen() {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	return (
		<Screen
			title={t("biz.staff.role.COURIER")}
			scroll
			bottomInset
			contentStyle={styles.gap}
			onRefresh={() => {
				void cache.invalidateQueries({
					queryKey: trpc.orders.pathKey(),
				});
				void cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
			}}
		>
			<SignedIn>
				{/*
				    `./Runs` first and `./Dispatch` inside it, which is the order this screen used
				    to draw them and the order it must not.

				    `Dispatch` read `deliveries.offers`, whose server gate is `VERIFIED AND
				    isAvailable` (`services/deliveries.ts:172-186`), and it rendered *above* the
				    states that explain those gates. So a courier who had never opened the profile
				    form, whose review was pending, or who had been refused — and, before this
				    change, anyone who had simply switched themselves unavailable — saw a heading
				    reading "Repartos", a list that could never fill, and an empty sentence
				    promising offers, all above the one line on the screen that would have told
				    them why. `./Runs` owns the profile read that decides it, so it is the only
				    place that can gate honestly.
				*/}
				<Runs />
				{/*
				    No profile door here any more, and the tab bar is the reason it can go.

				    It used to sit under the queue because the courier tree had no tab bar and no
				    hub row, so a screen that never offered the way in was a screen with no way
				    in. `./_layout.tsx` now declares the two-tab capsule the other two roles draw,
				    and the second tab is the account hub - which carries the courier profile row,
				    Ajustes, Ayuda, Seguridad and the Bandeja. A button that duplicated one of
				    six doors was the wrong shape for the role even when it was the only one.
				*/}
			</SignedIn>
		</Screen>
	);
}

/**
 * This courier's runs, across every shop they carry for.
 *
 * **The board no longer asks which shop.** It used to read `business.myBusinesses`, find the
 * one membership with the `COURIER` role, and hand that `businessId` to the queue, because a
 * `businessId` was required and a courier's was not guessable from the session. Both halves of
 * that are gone: the pool that offers deliveries is every verified courier on the platform, so
 * a courier may be carrying runs for four shops and belong to none of them, and `orders.list`
 * takes `assignedToMe` with no `businessId` at all. The only fact the board needs is the
 * caller's own, and `couriers.profile` carries it.
 *
 * Two states are still drawn here rather than in the board, and both are the courier's own
 * facts rather than anyone else's:
 *
 * - **No profile at all.** Identified as a courier at sign-in, has not opened the form yet.
 * - **Awaiting review.** The form is filled and the platform has not answered. This is a
 *   wait with its next step named, not a refusal — and it is a different sentence from the
 *   old "no shop has added you yet", which described an invitation system that no longer
 *   decides who may work.
 */
function Runs() {
	const { t } = useT();
	const trpc = useTRPC();
	const query = trpc.couriers.profile.queryOptions();
	const profile = useQuery(query);
	const waiting = useSkeletonHold(profile.isPending);
	const me = profile.data;

	if (profile.isError)
		return (
			<ErrorState
				error={profile.error}
				onRetry={() => void profile.refetch()}
			/>
		);

	if (waiting) return <RunsSkeleton label={t("state.loading")} />;

	// `couriers.myProfile` answers `null` for someone who has never opened the form, and a
	// row for everyone else. `null` and a row are different facts and get different sentences.
	//
	// **All three states below carry the step.** `./empty-state` has taken an `actionLabel` and
	// an `onAction` since before this tree existed, and these three were the only empty states in
	// the app that named a fix and gave the reader nothing to press. An empty state that says
	// "fill in your profile" and cannot take you there is worse than one that stays quiet: it
	// spends the reader's attention on an instruction they then have to act on alone.
	if (!me)
		return (
			<EmptyState
				icon="bicycle-outline"
				title={t("biz.courier.profileTitle")}
				body={t("biz.courier.profileRequired")}
				actionLabel={t("account.profile.title")}
				onAction={() => router.push("/courier-profile")}
			/>
		);

	if (me.verificationStatus === "PENDING")
		// Filled in, waiting on the platform. The courier is identified and cannot become
		// anyone else by waiting, so this resolves `delivery` in `lib/role.ts` and draws here.
		//
		// The action here is to *look*, not to fix — there is nothing wrong to change. It opens
		// the form because that is where the directory preview and the "what is being reviewed"
		// sentence are, which is the only answer a courier waiting can be given.
		return (
			<EmptyState
				icon="bicycle-outline"
				title={t("biz.courier.reviewPending")}
				body={t("biz.courier.reviewPending.body")}
				actionLabel={t("action.view")}
				onAction={() => router.push("/courier-profile")}
			/>
		);

	if (me.verificationStatus === "REJECTED")
		// Refused, and told so. The one state that does degrade to the customer stack is
		// handled by `lib/role.ts`; reaching here means the profile was rejected between
		// that read and this one, so the courier is told rather than shown an empty board.
		return (
			<EmptyState
				icon="bicycle-outline"
				title={t("biz.courier.rejected")}
				body={t("biz.courier.rejected.next")}
				actionLabel={t("account.profile.title")}
				onAction={() => router.push("/courier-profile")}
			/>
		);

	// Verified, so the board draws. No `businessId`: the runs are the courier's own, from
	// whichever shops they happen to be carrying for.
	//
	// **Availability is not a gate on drawing the board — it is drawn as a fact.** A courier who
	// switched themselves off has no offers, and `offers()` answers `[]` for them, which is the
	// same answer as "nothing near you". `./Dispatch` says which of the two it is, because a
	// courier standing on a street with no work nearby deserves to know that is the whole story.
	return (
		<View style={styles.body}>
			<Board />
			{me.zoneLat == null || me.zoneLng == null || me.zoneRadiusKm == null ? (
				<Card style={styles.howTo}>
					<Text variant="body" bold>
						{t("delivery.board.zone.title")}
					</Text>
					<Text variant="caption" tone="muted">
						{t("delivery.board.zone.body")}
					</Text>
					<Button
						label={t("delivery.board.zone.action")}
						variant="secondary"
						onPress={() => router.push("/courier-profile")}
					/>
				</Card>
			) : null}
			<Dispatch available={me.isAvailable} />
		</View>
	);
}

/**
 * The courier's position, posted to the order while they are riding it.
 *
 * `orders.reportLocation` has existed since the courier role did and nothing called it. This is
 * the caller: while the courier has a run that is `OUT_FOR_DELIVERY`, every fix from
 * `watchPositionAsync` is posted at most once every `REPORT_INTERVAL_MS`, and the buyer's
 * tracker reads it back through `orders.track` (`orderTrackingSchema.courier.lat`).
 *
 * ## Why the watch is mounted here and not in `lib/location.ts`
 *
 * `useDeviceLocation` answers "where is this device" once, for the four screens that sort by
 * distance; `askForLocationOnOpen` asks the permission at open for the same reason. Neither is
 * a subscription. This is: it starts when a run starts, stops when the run ends or the screen
 * goes away, and it is the only place in the app that writes a position anywhere. Putting it
 * in the shared hook would give four browsing screens a reporter they do not want.
 *
 * ## The permission is asked here, and only the courier sees the ask
 *
 * `askForLocationOnOpen` may already have asked — a courier is a person who shops too — but the
 * grant is read fresh, so a courier who declined at open and now wants the customer to see them
 * gets the band and its one action. That action is the same `request()` the customer's band
 * uses, including the platform's own rule that a settled refusal routes to the app's settings
 * rather than to another dialog (`lib/location.ts`).
 *
 * ## What is deliberately not posted
 *
 * Nothing while the run is `READY`. The API refuses it — "La ubicación solo se comparte en
 * camino" — and posting early would tell a customer their food is moving while it is still on
 * the counter. A fix that arrives before the courier taps "Sale a entregar" is dropped, and the
 * first one after it is posted.
 */
function CourierSharing({
	result,
	sharing,
}: {
	result: StartTrackingResult | null;
	sharing: boolean;
}) {
	const { t } = useT();
	if (!result || result === "started") {
		if (!sharing) return null;
		return (
			<Card>
				<View style={styles.sharing}>
					<Text variant="body" bold>
						{t("biz.courier.location.title")}
					</Text>
					<Text variant="caption" tone="muted">
						{t("order.track.live")}
					</Text>
				</View>
			</Card>
		);
	}

	return (
		<Card>
			<View style={styles.sharing}>
				<Text variant="body" bold>
					{t("biz.courier.location.title")}
				</Text>
				<Text variant="caption" tone="muted">
					{t("biz.courier.location.unavailable")}
				</Text>
				<Button
					label={t("biz.courier.location.action")}
					variant="secondary"
					onPress={() => void Linking.openSettings()}
				/>
			</View>
		</Card>
	);
}

/**
 * Dispatch offers and recent history (the `deliveries.*` model).
 *
 * The board above reads `orders.list`; this section reads `deliveries.offers`
 * (PENDING, unexpired) plus `deliveries.mine` for the recent history.
 * Accepting navigates to `/delivery/:id`, which is what finally gives that
 * detail screen an inbound link.
 */
const OFFERS_POLL_MS = 15_000;

function Dispatch({ available }: { available: boolean }) {
	const { t, tp, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
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
	/**
	 * Shop invitations, and the one thing on this screen that is not about work.
	 *
	 * **`myInvites` worked and `/courier-invites` was a finished screen with accept and
	 * decline, and nothing linked either from this tree.** The only route to the screen was
	 * `app/account.tsx:389`, and the courier tree cannot reach `/account` — so a business that
	 * invited a courier reached a courier with no way to find out. That is the whole reason this
	 * query is here, and the reason the row is not a bell: the row is the notification.
	 *
	 * **`no poll interval`, unlike the two reads above it.** An invitation is written once by a
	 * shop and answered once by the courier; polling it every fifteen seconds would spend a round
	 * trip a minute on a fact that changes when a person acts somewhere else. It refetches on
	 * focus, which is when the answer changes.
	 */
	const invites = useQuery(trpc.couriers.myInvites.queryOptions());
	const pendingInvites = (invites.data ?? []).filter(
		(one) => one.status === "PENDING",
	).length;
	// `preferCurrent`: presence is a claim about where the courier is now, and the server
	// timestamps whatever arrives. A cached fix would therefore pass the freshness window
	// while being hours old — see `useDeviceLocation`'s option note. It also re-reads on an
	// interval, so `coords` genuinely updates rather than going stale in place.
	const { coords, status: locationStatus } = useDeviceLocation({
		preferCurrent: true,
	});
	const presence = useMutation(
		trpc.deliveries.reportPresence.mutationOptions({}),
	);

	// Best-effort eligibility ping: dispatch only offers runs to couriers with a fresh
	// presence, and `PRESENCE_FRESH_MS` is two minutes.
	//
	// **This follows the position rather than deduplicating it, and that is the fix.** It
	// used to post once per distinct coordinate and never again, which made the ping an
	// eligibility signal that switched itself off: a courier standing still — the most
	// available person there is — posted once and then fell out of the pool two minutes
	// later, with nothing on screen to say so. `preferCurrent` re-reads on an interval, so
	// `coords` arrives again even when the courier has not moved, and this effect reposts
	// and keeps the window open.
	//
	// Failures stay silent — an offer list that errors over a background ping would blame
	// the wrong thing.
	useEffect(() => {
		if (!coords) return;
		presence.mutate({ lat: coords.lat, lng: coords.lng });
	}, [coords, presence]);

	const accept = useMutation(
		trpc.deliveries.acceptOffer.mutationOptions({
			onSuccess: async (detail) => {
				setBusyId(null);
				await cache.invalidateQueries({
					queryKey: trpc.deliveries.pathKey(),
				});
				await cache.invalidateQueries({
					queryKey: trpc.orders.pathKey(),
				});
				router.push(`/delivery/${detail.id}` as Href);
			},
			onError: () => setBusyId(null),
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
			onError: () => setBusyId(null),
		}),
	);
	const responding = accept.isPending || decline.isPending;
	const failure = accept.error ?? decline.error;

	const pending = offers.data ?? [];
	const activeCount = (mine.data ?? []).filter(
		(delivery) =>
			delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED",
	).length;
	const history = (mine.data ?? []).filter(
		(delivery) => delivery.status === "DELIVERED",
	);

	if (offers.isPending && mine.isPending) return null;
	if (offers.isError) {
		return (
			<ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
		);
	}

	return (
		<View style={styles.body}>
			<Text variant="heading" bold>
				{t("delivery.board.offers")}
			</Text>

			{/*
			    Whether this courier is in the pool at all, said out loud.

			    `candidateFor` (`services/delivery-dispatch.ts:173-190`) needs three things and the
			    screen showed none of them: `VERIFIED`, `isAvailable`, and a `courierPresence` row
			    less than `PRESENCE_FRESH_MS` old — two minutes. Every one of those failing produces
			    exactly the same empty list, so "no offers" was indistinguishable across six causes
			    (not verified, switched off, no fresh position, out of the 15 km radius, already
			    carrying something, genuinely nothing nearby) and the courier had no way to tell
			    which one was happening to them.

			    The availability half is the one the reader can act on and it is now a `Segmented` on
			    their profile that writes the moment it is chosen, so a courier who taps "No
			    disponible" and comes back here to check is told the truth rather than shown an
			    identical screen.
			*/}
			<Text variant="label" tone={available ? "action" : "muted"} bold>
				{available
					? t("delivery.board.receiving.on")
					: t("delivery.board.receiving.off")}
			</Text>

			{/*
			    The invitations row, and it is the only control on this screen that is not about
			    the next delivery.

			    **Drawn whenever a row exists, not only when something is pending.** A courier who
			    has already accepted the one invitation from a shop is owed the answer to "did they
			    get me?" too, and a row that appears only while there is something to do is a row
			    that appears and disappears with no explanation.

			    **The count is a word in `state`, not a badge.** `./list-row.tsx:52-58`: `state` is
			    "a **word** that states a fact about this row", and it joins the row's accessibility
			    label, so a screen reader hears it too. A numeral in a coloured pill would be a
			    second signal that a greyscale screenshot loses and this app does not use.
			*/}
			{invites.data?.length ? (
				<Card>
					<ListRow
						title={t("biz.courier.invites")}
						subtitle={t("biz.courier.invites.help")}
						state={
							pendingInvites > 0
								? tp("biz.courier.invites.pending", pendingInvites)
								: undefined
						}
						leading={
							<Ionicons
								name="mail-outline"
								size={icon.control}
								color={colors.mutedForeground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						}
						divider={false}
						chevron
						onPress={() => router.push("/courier-invites" as Href)}
					/>
				</Card>
			) : null}

			{/*
			    The location dead end, and the only place on this screen that can open one.

			    `reportPresence` needs a fix, a fix needs permission, and permission is asked
			    nowhere in this component — so a courier who declined it posts no presence, falls
			    out of `candidateFor`'s freshness window two minutes later, and watches an empty
			    board forever with a muted caption as the entire explanation. `./CourierSharing`
			    below already draws this recovery for tracking; the same treatment here is the
			    difference between a courier who can fix it and one who cannot.
			*/}
			{locationStatus === "denied" ? (
				<Card>
					<View style={styles.sharing}>
						<Text variant="body" bold>
							{t("delivery.presence.denied")}
						</Text>
						<Text variant="caption" tone="muted">
							{t("delivery.board.presence.body")}
						</Text>
						<Button
							label={t("delivery.board.presence.action")}
							variant="secondary"
							onPress={() => void Linking.openSettings()}
						/>
					</View>
				</Card>
			) : null}

			{pending.length > 0 ? (
				<View style={styles.body}>
					<Text variant="label" tone="muted">
						{t("delivery.board.offers")}
					</Text>
					{pending.map((offer) => {
						const busy = busyId === offer.id;
						return (
							<Card key={offer.id}>
								<View style={styles.order}>
									<View style={styles.orderHead}>
										<Text variant="label" tone="muted" tabular>
											{t("order.number", { code: offer.orderReference })}
										</Text>
										<Text variant="caption" tone="muted">
											{formatStamp(offer.expiresAt, intlLocale)}
										</Text>
									</View>
									<Text variant="body" bold>
										{offer.businessName}
									</Text>
									<Text variant="caption" tone="muted">
										{offer.dropoffArea}
										{offer.distanceToPickupKm != null
											? ` · ${t("delivery.offer.distance", {
													value: offer.distanceToPickupKm.toFixed(1),
												})}`
											: null}
									</Text>
									<View style={styles.orderActions}>
										<Button
											label={t("delivery.offer.accept")}
											loading={busy && accept.isPending}
											disabled={responding}
											onPress={() => {
												setBusyId(offer.id);
												accept.mutate({ offerId: offer.id });
											}}
										/>
										<Button
											label={t("delivery.offer.decline")}
											variant="ghost"
											loading={busy && decline.isPending}
											disabled={responding}
											onPress={() => {
												setBusyId(offer.id);
												decline.mutate({ offerId: offer.id });
											}}
										/>
									</View>
								</View>
							</Card>
						);
					})}
				</View>
			) : null}

			{failure ? (
				<ErrorState
					error={failure}
					onRetry={() => {
						if (busyId && accept.error) accept.mutate({ offerId: busyId });
						else if (busyId && decline.error)
							decline.mutate({ offerId: busyId });
					}}
				/>
			) : null}

			{/*
			    How offers actually reach you, and the conditions are not guesses.

			    `candidateFor` (`services/delivery-dispatch.ts:141-190`) is the whole rulebook, and
			    every clause below is one of its conditions: verified and available, a
			    `courierPresence` row younger than `PRESENCE_FRESH_MS` (two minutes), inside the
			    `OFFER_RADIUS_KM` box (15 km) and again inside the exact circle after the square,
			    with no active run and no pending offer. `OFFER_TTL_MS` is two minutes, which is why
			    an offer is worth answering rather than reading later.

			    **Shown while this courier has never delivered anything, and never again.** The
			    condition is `history.length === 0` — the courier's own record, not a dismissal flag
			    — so it cannot be swiped away and still be true, and it disappears for good the
			    moment the note stops being news. It sits under the empty state rather than above
			    it, because the thing it explains is the empty.

			    **The `.limit(30)` on `mine` cannot hide a delivery here**, and it is worth saying
			    why rather than assuming. That cap would matter for a *count* — which is why
			    `couriers.stats` does a real `COUNT(*)` — but `mine` is ordered `updatedAt desc` and
			    the only statuses beside `DELIVERED` are the four a run is actively in, of which a
			    courier holds at most one. Thirty rows is therefore thirty deliveries, so a courier
			    with any delivery at all has one in the window.
			*/}
			{history.length === 0 ? (
				<Card style={styles.howTo}>
					<Text variant="heading" bold>
						{t("delivery.board.how.title")}
					</Text>
					<Text variant="body" tone="muted">
						{t("delivery.board.how.body")}
					</Text>
					<Text variant="caption" tone="muted">
						{t("delivery.board.how.detail")}
					</Text>
				</Card>
			) : null}

			{/*
			    The empty, in the pair that was written for it and never used.

			    `delivery.board.empty` and its body have been landed in both locales since the
			    offers pipeline shipped and referenced nowhere; this was a bare caption under
			    `delivery.board.empty.body` alone, so the section had a sentence and no heading to
			    hang it on.

			    **Suppressed entirely while the courier is unavailable.** The line above already says
			    why the list is empty in that case, and "new offers will appear here while you are
			    available" printed directly under "you are not receiving offers" is the same
			    contradiction this screen was already making in a different place.
			*/}
			{available && pending.length === 0 && offers.data && activeCount > 0 ? (
				<Text variant="body" tone="muted">
					{t("delivery.board.offers.busy")}
				</Text>
			) : null}
			{available && pending.length === 0 && offers.data && activeCount === 0 ? (
				<EmptyState
					icon="bicycle-outline"
					title={t("delivery.board.empty")}
					body={t("delivery.board.empty.body")}
				/>
			) : null}

			{history.length > 0 ? (
				<Button
					label={t("delivery.board.history")}
					variant="ghost"
					onPress={() => setHistoryOpen((open) => !open)}
				/>
			) : null}
			{historyOpen && history.length > 0 ? (
				<View style={styles.body}>
					<Text variant="label" tone="muted">
						{t("delivery.board.history")}
					</Text>
					{history.slice(0, 3).map((delivery) => (
						<Card key={delivery.id}>
							<View style={styles.order}>
								<Text variant="label" tone="muted" tabular>
									{t("order.number", { code: delivery.orderReference })}
								</Text>
								<View style={styles.orderActions}>
									<Button
										label={t("action.view")}
										variant="secondary"
										onPress={() =>
											router.push(`/delivery/${delivery.id}` as Href)
										}
									/>
								</View>
							</View>
						</Card>
					))}
				</View>
			) : null}
		</View>
	);
}

/**
 * The runs this courier is carrying, and the moves they can make on them.
 *
 * **No `businessId`, and that is the point of the change.** The board used to be handed the
 * one shop the courier belonged to and hand that to the queue. With the delivery pool open a
 * courier's runs come from whichever shops the platform offered them, which is not a set this
 * device can know in advance — and does not need to, because `assignedToMe` with no
 * `businessId` is exactly "the runs carrying my name".
 *
 * **`orders.list`, not `orders.queue`,** and the reason is the middleware rather than taste:
 * `queue` is a `businessProcedure`, which resolves a tenant from the input's `businessId` and
 * refuses a caller with no membership of it. A courier is not a member of the shops carrying
 * their runs, so that door cannot open. `list` is the `protectedProcedure` that was already
 * cross-cutting and branches on `role`, and it reaches the same query.
 */
function Board() {
	const { t, intlLocale } = useT();
	const { session } = useSession();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const mine = useQuery(
		trpc.deliveries.mine.queryOptions(undefined, {
			refetchInterval: OFFERS_POLL_MS,
		}),
	);
	const [trackingResult, setTrackingResult] =
		useState<StartTrackingResult | null>(null);
	const [startIntent, setStartIntent] = useState<{
		orderId: string;
		to: OrderStatus;
		expectedStatus: OrderStatus;
	} | null>(null);
	const query = useInfiniteQuery(
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
	const move = useMutation(
		trpc.orders.advance.mutationOptions({
			onSuccess: async (_result, variables) => {
				// The commit landed. `light` rather than `success`, the same note as the shop's
				// board: a move that worked does not need a celebration.
				light();
				// The procedure's own key root and nothing wider — an advance moves order rows
				// and only order rows, so `orders.*` is every cache it could have made wrong.
				if (variables.to === "OUT_FOR_DELIVERY" && session?.userId) {
					setTrackingResult(
						await startCourierTracking(variables.orderId, session.userId),
					);
				} else if (
					variables.to === "COMPLETED" ||
					variables.to === "CANCELLED"
				) {
					await stopCourierTracking();
				}
				await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
			},
			onError: async (error) => {
				warning();
				// A conflict means another phone moved this run first — dispatch, or the shop —
				// so the card under the thumb is out of date and its buttons are about to be
				// refused too. Re-reading before the sentence draws is what keeps the sentence
				// true; the shop's board does the same thing for the same reason.
				if (toApiFailure(error).code === "CONFLICT")
					await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
			},
		}),
	);
	const waiting = useSkeletonHold(query.isPending);
	const board = query.data;
	const orders = useMemo(
		() => board?.pages.flatMap((page) => page.items) ?? [],
		[board],
	);
	const activeDeliveries = (mine.data ?? []).filter(
		(delivery) =>
			delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED",
	);
	const unmatchedDeliveries = activeDeliveries.filter(
		(delivery) => !orders.some((order) => order.id === delivery.orderId),
	);
	const movingId = move.isPending ? move.variables?.orderId : undefined;
	const movingTo = move.isPending ? move.variables?.to : undefined;
	// What the conflicted run's status is *now*, read from the refreshed board rather than from
	// the tap — the sentence says somebody else moved it, so the word it prints has to be the
	// one the card behind it is showing. `undefined` once the run has left the board, which a
	// move to COMPLETED does by definition (`activeOnly`).
	const conflictStatus = orders.find(
		(order) => order.id === move.variables?.orderId,
	)?.status;
	// The run whose position is worth sharing, and there is at most one: a courier rides one
	// order at a time, and `OUT_FOR_DELIVERY` is the only state the API accepts a position in.
	// A second one on the board — which the machine allows, since nothing stops two being sent
	// out — shares the first, and the band's comment on `CourierSharing` is where that is
	// honest rather than silently wrong.
	const ridingId = orders.find(
		(order) => order.status === "OUT_FOR_DELIVERY",
	)?.id;
	useEffect(() => {
		if (!session?.userId) return;
		void reconcileCourierTracking(ridingId, session.userId);
	}, [ridingId, session?.userId]);

	return (
		<View style={styles.body}>
			{/*
			    The heading this section never had.

			    `./Dispatch` draws "Repartos" over `deliveries.*`, and this board reads a different
			    thing — `orders.list` with `assignedToMe` — with a different vocabulary
			    (`READY → OUT_FOR_DELIVERY → COMPLETED` against `OFFERED → PICKED_UP → DELIVERED`)
			    and a different set of buttons. `services/orders.ts` writes `order.courierUserId`
			    and `deliveryTable.courierUserId` in the same assignment, so one physical run sits
			    in both lists at once. With no heading the second `EmptyState` read as the first
			    one's contradiction; with one, it is the answer to a different question.
			*/}
			<View style={styles.boardHead}>
				<Text variant="heading" bold>
					{t("delivery.board.active")}
				</Text>
				<Text variant="caption" tone="muted">
					{t("delivery.board.active.body")}
				</Text>
			</View>

			<CourierSharing result={trackingResult} sharing={ridingId != null} />
			{mine.isError ? (
				<ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
			) : null}

			{/* Above the rows: the run that failed can be twenty rows down, and a refusal nobody
			    scrolls to was not said. `ErrorState` carries the announcement on both platforms,
			    so there is no announce effect here — `components/error-state.tsx` is the one
			    place that owns it. */}
			{move.error ? (
				<ErrorState
					error={move.error}
					title={t("biz.board.moveFailed")}
					overrides={{
						CONFLICT: conflictStatus
							? {
									key: "biz.board.conflict.body",
									params: { status: t(statusKey(conflictStatus)) },
								}
							: "biz.board.conflict.title",
						FORBIDDEN: "biz.permission.body",
					}}
					onRetry={() => {
						if (move.variables) move.mutate(move.variables);
					}}
				/>
			) : null}

			{query.isError ? (
				<ErrorState error={query.error} onRetry={() => void query.refetch()} />
			) : waiting || mine.isPending || !board ? (
				<RunsSkeleton label={t("state.loading")} />
			) : orders.length === 0 && unmatchedDeliveries.length === 0 ? (
				// **The courier's own pair, not the shop board's.** `biz.board.empty` and its body
				// are the merchant board's, and the comment that used to sit here said so: "true of
				// this board and vaguer than this board deserves; a courier-specific pair is a
				// string request, not a literal." It is now a string request, landed in both
				// locales, and the sentence on this screen belongs to the person reading it.
				<EmptyState
					icon="bicycle-outline"
					title={t("delivery.board.active.empty")}
					body={t("delivery.board.active.emptyBody")}
				/>
			) : (
				<>
					{unmatchedDeliveries.map((delivery) => (
						<Card key={delivery.id}>
							<View style={styles.order}>
								<Text variant="label" tone="muted">
									{t("order.number", { code: delivery.orderReference })}
								</Text>
								<Text variant="body" bold>
									{delivery.business.name}
								</Text>
								<Button
									label={t("action.view")}
									variant="secondary"
									onPress={() =>
										router.push(`/delivery/${delivery.id}` as Href)
									}
								/>
							</View>
						</Card>
					))}
					{orders.map((order, index) => (
						// `reorder`: this board is read with `activeOnly`, so marking a run
						// delivered takes it off and every card under it is the same card at a new
						// index. They close the gap on the layout spring rather than re-entering.
						<AnimateIn key={order.id} index={index} reorder>
							<Card>
								<View style={styles.order}>
									<View style={styles.orderHead}>
										<Text variant="label" tone="muted" tabular>
											{t("order.number", { code: order.reference })}
										</Text>
										<StatusBadge status={order.status} size="dot" />
									</View>

									<Text variant="body" bold>
										{order.headline}
									</Text>

									<View style={styles.orderFoot}>
										<Text variant="caption" tone="muted">
											{formatStamp(order.placedAt, intlLocale)}
										</Text>
										<Price
											amountMinor={order.totalMinor}
											currency={order.currency}
											variant="body"
										/>
									</View>

									{/* One button, and never a choice: a courier's machine has exactly
									    one move out of each state it can be in. Drawn from the row's
									    own `nextStatuses` all the same, so the day the machine grows
									    a second courier move this screen offers it without an edit.
									    The order detail is an explicit button rather than the whole
									    card, so the move controls never sit inside another pressable. */}
									<View style={styles.orderActions}>
										{activeDeliveries.find(
											(delivery) => delivery.orderId === order.id,
										) ? (
											<Button
												label={t("delivery.board.openRun")}
												variant="secondary"
												onPress={() =>
													router.push(
														`/delivery/${activeDeliveries.find((delivery) => delivery.orderId === order.id)?.id}` as Href,
													)
												}
											/>
										) : null}
										{order.nextStatuses.map((to) => (
											<Button
												key={to}
												label={t(MOVE_LABELS[to])}
												loading={movingId === order.id && movingTo === to}
												// The row is mid-write: its own control waits for the
												// answer. Other rows are untouched.
												disabled={movingId === order.id}
												onPress={() => {
													const intent = {
														orderId: order.id,
														to,
														expectedStatus: order.status,
													};
													if (to === "OUT_FOR_DELIVERY") setStartIntent(intent);
													else move.mutate(intent);
												}}
											/>
										))}
										<Button
											label={t("action.view")}
											variant="secondary"
											onPress={() => router.push(`/order/${order.id}` as Href)}
										/>
									</View>
								</View>
							</Card>
						</AnimateIn>
					))}

					<ListEnd
						rows={orders.length}
						hasNextPage={query.hasNextPage}
						loading={query.isFetchingNextPage}
						onPress={() => void query.fetchNextPage()}
					/>
				</>
			)}
			<ConfirmSheet
				open={startIntent !== null}
				onClose={() => setStartIntent(null)}
				title={t("biz.courier.location.title")}
				body={t("biz.courier.location.body")}
				confirmLabel={t(MOVE_LABELS.OUT_FOR_DELIVERY)}
				confirmVariant="primary"
				onConfirm={() => {
					if (startIntent) move.mutate(startIntent);
				}}
			/>
		</View>
	);
}

/**
 * The board in grey: three cards at the height a real one draws.
 *
 * Decorative and unlabelled past the first line, the same as the shop board's skeleton: this
 * block is never alone on the screen, and the announcement is the one `useSkeletonHold`'s
 * label makes.
 */
function RunsSkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();
	const lineHeight = Math.round(type.body.lineHeight * fontScale);
	return (
		<View style={styles.body}>
			<Skeleton label={label} style={styles.skeletonLine} />
			<Card>
				<View style={styles.order}>
					<Skeleton style={[styles.skeletonLine, { height: lineHeight }]} />
					<Skeleton style={[styles.skeletonLine, { height: lineHeight }]} />
					<Skeleton style={[styles.skeletonLine, { height: lineHeight }]} />
				</View>
			</Card>
			<Card>
				<View style={styles.order}>
					<Skeleton style={[styles.skeletonLine, { height: lineHeight }]} />
					<Skeleton style={[styles.skeletonLine, { height: lineHeight }]} />
				</View>
			</Card>
		</View>
	);
}

const styles = StyleSheet.create({
	gap: { gap: space.lg },
	body: { gap: space.lg },
	// The run's own column: reference line, headline, stamp and total, then the move. The
	// same gaps the shop's board uses, because it is the same card with one control taken out.
	order: { gap: space.sm },
	orderHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	orderFoot: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	orderActions: { marginTop: space.xs },
	sharing: { gap: space.sm },
	boardHead: { gap: TEXT_STACK_GAP },
	howTo: { gap: space.sm },
	skeletonLine: { height: space.md },
});
