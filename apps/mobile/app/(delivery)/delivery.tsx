import { MOVE_LABELS } from "@pymeshub/i18n";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import * as Location from "expo-location";
import { type Href, router } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListEnd } from "@/components/list-end";
import { Price } from "@/components/price";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { StatusBadge, statusKey } from "@/components/status-badge";
import { Text } from "@/components/text";
import { toApiFailure } from "@/lib/api-error";
import { formatStamp } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

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
 * The read is `orders.queue` with `assignedToMe` — not a procedure of its own, which is the
 * API's own decision and its own written reason ("same rows, same paging, one fewer name for
 * two clients to agree on"). `assignedToMe` adds exactly one condition,
 * `courierUserId = caller`, AND-ed onto the business scope, so a courier sees their own runs
 * and not the shop's. `businessId` is required by the input and **ignored** by the resolver,
 * which takes it from the caller's membership (`apps/api/src/routers/orders.ts:121`) — it is
 * sent because the contract asks for it, and it decides nothing.
 *
 * The move buttons are the order's own `nextStatuses`, which the API computes **for the
 * caller's actor** (`apps/api/src/services/mappers.ts:522` → `actorFor` returns `COURIER` for
 * a courier member). So this screen does not filter a table: it draws what the machine says
 * this person may do, which is exactly two moves — `READY → OUT_FOR_DELIVERY` ("start the
 * run") and `OUT_FOR_DELIVERY → COMPLETED` ("delivered"). Anything else is refused by the API
 * with `ValidationError` before this screen could offer it.
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
const REPORT_INTERVAL_MS = 15000;

/**
 * How long the board waits before re-reading itself.
 *
 * Five seconds, the shop board's interval and for the same reason: this is a work queue, not a
 * list. A courier reading it is about to ride a run, and dispatch is the thing that changes it.
 */
const BOARD_POLL_MS = 5000;

export default function DeliveryScreen() {
	const { t } = useT();
	return (
		<Screen
			title={t("biz.staff.role.COURIER")}
			scroll
			bottomInset
			contentStyle={styles.gap}
		>
			<SignedIn>
				<Runs />
			</SignedIn>
		</Screen>
	);
}

/**
 * Which shop this courier rides for, and then the runs.
 *
 * `business.myBusinesses` is the read: it answers every membership with its role
 * (`packages/shared/src/schemas/user.ts:147`), which is the one fact this screen needs before
 * it can ask for a queue — `orders.queue` requires a `businessId`, and a courier's is not
 * guessable from the session.
 *
 * A person with no `COURIER` membership reaches this and gets the courier-pending sentence
 * rather than an empty board, because those are two different facts: "you have no runs" would
 * be a lie, and "your role can't open this section" would be the wrong fact — the courier who
 * identified at sign-in/sign-up (`auth.role.*`) is *supposed* to be here, and the membership
 * simply arrives later, when a shop adds them by email. `biz.courier.pending.*` says the fact
 * and the step.
 */
function Runs() {
	const { t } = useT();
	const trpc = useTRPC();
	const query = trpc.business.myBusinesses.queryOptions();
	const memberships = useQuery(query);
	const waiting = useSkeletonHold(memberships.isPending);
	const shops = memberships.data;

	if (memberships.isError)
		return (
			<ErrorState
				error={memberships.error}
				onRetry={() => void memberships.refetch()}
			/>
		);

	if (waiting || !shops) return <RunsSkeleton label={t("state.loading")} />;

	const riding = shops.find((shop) => shop.role === "COURIER");
	if (!riding)
		// Identified but not yet membered: the tree's guard admits a courier preference with no
		// `COURIER` row (`lib/role.ts`'s `pending`), so this is the state a new courier sees
		// first — not a refusal, a wait with its next step named.
		return (
			<EmptyState
				icon="bicycle-outline"
				title={t("biz.courier.pending.title")}
				body={t("biz.courier.pending.body")}
			/>
		);

	return <Board businessId={riding.businessId} />;
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
function CourierSharing({ orderId }: { orderId?: string }) {
	const { t } = useT();
	const trpc = useTRPC();
	const { status, request } = useDeviceLocation();
	const { mutate } = useMutation(trpc.orders.reportLocation.mutationOptions());

	useEffect(() => {
		// Nothing to share, or nobody to share it with: no watch is started, which is what
		// keeps a courier who is off duty from holding a location subscription open.
		if (status !== "granted" || !orderId) return;

		let alive = true;
		let lastSent = 0;
		let watch: Location.LocationSubscription | undefined;

		void (async () => {
			try {
				watch = await Location.watchPositionAsync(
					{
						// `Balanced`, the same accuracy the browsing screens use and for a
						// larger reason: a buyer reading a dot on a map needs to know the
						// courier is four blocks away, and does not need to know which side of
						// the street. `High` costs battery and a cold-GPS wait for a precision
						// nothing on the screen can express.
						accuracy: Location.Accuracy.Balanced,
						// Reported to the OS, not to us: closer than `md` apart is noise on a
						// map, and the OS skips the update entirely rather than waking JS for it.
						distanceInterval: space.md,
					},
					(position) => {
						if (!alive) return;
						const now = Date.now();
						if (now - lastSent < REPORT_INTERVAL_MS) return;
						lastSent = now;
						mutate({
							orderId,
							lat: position.coords.latitude,
							lng: position.coords.longitude,
						});
					},
				);
			} catch {
				// Location services switched off mid-run, or a watch the platform refused.
				// The run is unaffected — the customer sees "last seen" instead of a live dot,
				// which is the same state as a phone that has not moved yet.
			}
		})();

		return () => {
			alive = false;
			watch?.remove();
		};
	}, [status, orderId, mutate]);

	// Granted and riding: the board below says everything, and a band saying "sharing" would be
	// a control for something already happening.
	if (status === "granted") return null;

	// The one case worth a band: a courier whose customer cannot see them.
	if (status !== "denied") return null;

	return (
		<Card>
			<View style={styles.sharing}>
				<Text variant="body" bold>
					{t("location.title")}
				</Text>
				{/* No sentence under it, and that is the honest form rather than an omission: the
				    dictionary's only line about a refused permission is `location.denied`, whose
				    copy is written for a customer and ends "Escribe tu dirección" — wrong advice
				    for a courier, who has no address to type. `docs/design-mobile.md:484-489`
				    makes the rule report-and-stop, so the missing string is reported: *the
				    customer cannot see where you are until you share your location.* */}
				<Button
					label={t("location.use")}
					variant="secondary"
					onPress={request}
				/>
			</View>
		</Card>
	);
}

function Board({ businessId }: { businessId: string }) {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const query = useInfiniteQuery(
		trpc.orders.queue.infiniteQueryOptions(
			{
				businessId,
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
			onSuccess: async () => {
				// The commit landed. `light` rather than `success`, the same note as the shop's
				// board: a move that worked does not need a celebration.
				light();
				// The procedure's own key root and nothing wider — an advance moves order rows
				// and only order rows, so `orders.*` is every cache it could have made wrong.
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

	return (
		<View style={styles.body}>
			<CourierSharing orderId={ridingId} />

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
				/>
			) : null}

			{query.isError ? (
				<ErrorState error={query.error} onRetry={() => void query.refetch()} />
			) : waiting || !board ? (
				<RunsSkeleton label={t("state.loading")} />
			) : orders.length === 0 ? (
				// `biz.board.empty` is the shop board's pair, and it is reused rather than
				// invented: `docs/design-mobile.md` keeps `packages/i18n` a closed union, so a
				// lane that needs a string reports it and stops. The sentence it prints — "Aquí
				// ves los pedidos que siguen en curso" — is true of this board and vaguer than
				// this board deserves; a courier-specific pair is a string request, not a
				// literal.
				<EmptyState
					icon="bicycle-outline"
					title={t("biz.board.empty")}
					body={t("biz.board.empty.body")}
				/>
			) : (
				<>
					{orders.map((order, index) => (
						// `reorder`: this board is read with `activeOnly`, so marking a run
						// delivered takes it off and every card under it is the same card at a new
						// index. They close the gap on the layout spring rather than re-entering.
						<AnimateIn key={order.id} index={index} reorder>
							<Card
								onPress={() => router.push(`/order/${order.id}` as Href)}
								accessibilityLabel={t("order.number", {
									code: order.reference,
								})}
							>
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
									    a second courier move this screen offers it without an edit. */}
									<View style={styles.orderActions}>
										{order.nextStatuses.map((to) => (
											<Button
												key={to}
												label={t(MOVE_LABELS[to])}
												loading={movingId === order.id && movingTo === to}
												// The row is mid-write: its own control waits for the
												// answer. Other rows are untouched.
												disabled={movingId === order.id}
												onPress={() =>
													move.mutate({
														orderId: order.id,
														to,
														expectedStatus: order.status,
													})
												}
											/>
										))}
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
	return (
		<View style={styles.body}>
			<Skeleton label={label} style={styles.skeletonLine} />
			<Card>
				<View style={styles.order}>
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLine} />
				</View>
			</Card>
			<Card>
				<View style={styles.order}>
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLine} />
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
	skeletonLine: { height: space.md },
});
