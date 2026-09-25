import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import {
	isTerminalStatus,
	type OrderStatus,
	type PaymentMethod,
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
import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Image } from "@/components/image";
import { MapView } from "@/components/map";
import { MoneyLine } from "@/components/money-line";
import { OrderTimeline } from "@/components/order-timeline";
import { Price } from "@/components/price";
import { useRefreshControl } from "@/components/pull-refresh";
import { RatingInput, type RatingValue } from "@/components/rating-input";
import { ReorderOutcome } from "@/components/reorder-outcome";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { statusForeground, statusKey } from "@/components/status-badge";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { toApiFailure } from "@/lib/api-error";
import { formatClock, formatDay } from "@/lib/format";
import { light, success, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	space,
	TEXT_STACK_GAP,
	type,
	useTheme,
} from "@/theme";

/**
 * One order, and what has happened to it.
 *
 * The receipt and the tracker on one screen, which is the point: a customer who opens
 * "Pedido 4821" is either asking "where is it" or "what did I agree to", and a screen that
 * answered one of those by making them go and find the other would be two taps for one
 * question. The timeline is above the items because the live half is what changes.
 *
 * **The money is shown in full.** Subtotal, delivery, discount, tax, tip and total — every
 * line the order stored, and the same lines, in the same order, that the checkout showed
 * before the customer agreed to it. `docs/design-mobile.md` puts hiding a fee behind a tap
 * in its out-list; an order's own detail page is the last place that could still be true.
 *
 * **Cancelling is not hidden and not dressed up.** The control is pinned to the floor of the
 * screen for as long as the order can still be acted on, it says what it does, and the
 * confirm that follows names the action again rather than arguing with it. When the API says
 * it is too late the button is still there and still says "Cancelar pedido" — dimmed, with
 * the *reason* beside it, because the business has started preparing it. A control that
 * vanished would leave the customer to guess whether they had missed it; the sentence is the
 * same fact the API's state machine is enforcing. An order the customer could place in three
 * taps must not be one they cannot stop without a phone call.
 *
 * ## The status is the headline, and the estimate is a readiness
 *
 * The largest thing on the screen is the status word, drawn in that status's own ink above
 * the rail it names. That is the question the screen exists to answer, and the answer used to
 * be a small pill beside the order number — the same size as the order's reference, and
 * smaller than the business's name.
 *
 * Under it, when the API has one, is the estimate: `order.estimatedReadyAt`, computed
 * server-side from the business's stored `prepTimeMinutes` and anchored at the moment the
 * order was accepted. It is a **readiness**, and the sentence says so — the delivery-leg
 * estimate is deliberately null in `apps/api/src/services/mappers.ts`, because the honest
 * inputs to one are a courier position and a routing service, and a position on its own is a
 * distance rather than a time — which is why this screen draws the position (below) and still
 * says nothing about when the doorbell rings.
 * `order.track.eta` ("Llega alrededor de las {time}") is therefore *not* the key for this
 * line: it promises an arrival that this field does not know. So the line reads "Listo
 * alrededor de las 2:30 p. m." with the honesty caption under it, and nothing here is
 * compared against the clock on the device — a countdown is the one thing
 * `docs/design-mobile.md` rules out by name, and a device clock in a sentence about
 * somebody else's kitchen is how a customer is told their food is late when it is not.
 *
 * ## Why the screen does not use `Screen`'s `scroll`
 *
 * `Screen scroll` puts **every** child inside its `ScrollView`, which is right for a page and
 * wrong for a page with a bar pinned over it: the bar would scroll away with the receipt, and
 * the one control this screen must not make the customer hunt for would be at the end of a
 * long scroll — which is exactly where it was before this pass. So the screen is
 * `padded={false}` with its own `ScrollView`, and the bar is its sibling in a column. The bar
 * pays its own bottom inset (`./action-bar`), so `bottomInset` is deliberately **not** passed
 * here: paying it in both places is a 34-point gap above the bar on a phone with a home
 * indicator.
 *
 * ## This screen polls, so it is a screen that changes under the reader
 *
 * `orders.byId` is re-read every five seconds until the order reaches a terminal status, and
 * what that re-read changes is above all the *height* of the timeline: a step that becomes
 * `current` gains a freshness caption and a step that becomes `done` loses one, so the rail
 * is a few lines taller or shorter than it was a moment ago, and every block below it is a
 * few points further down or up. That movement is what `./animate-in`'s `reorder` is for —
 * it is the layout spring `docs/design-mobile.md` asks for, instead of a manual height
 * calculation, and the alternative is the receipt below the rail jumping while somebody is
 * reading it.
 *
 * The head (the order number), the business name, the placed-at line and the status headline
 * enter once and are never keyed by anything: none of them can change, so none of them
 * re-enters on a poll — a fade every five seconds would be the screen blinking at the
 * customer who is watching it. The headline's *text* changes when the status does, which the
 * re-render handles; it is the entrance that is once-only, and a status that changed is
 * already the timeline's news to tell. The `./order-timeline` rows carry their own entrance, so the timeline is not
 * wrapped in a second one. And the back button is outside the scroll entirely: it is the one
 * control that has to be there on the first frame and in the same place on every frame after
 * it, and the content under it changes height on every poll.
 *
 * ## Pedir otra vez, and the lines that do not come back
 *
 * A terminal order gets a bar too, and it is the other bar: cancelling is for an order that can
 * still be acted on, and an order that is over has exactly one thing left to offer. The reason
 * this paragraph is longer than the button is that `orders.reorder` can answer with less than
 * it was asked for. `reorderResultSchema` in `@pymeshub/shared` is
 * `{ cart, addedCount, skipped }`, where `addedCount + skipped.length` is always the order's own
 * line count — so a screen that drew only a "done" toast would present a cart that silently
 * arrived one product short. That is the defect the return shape exists to prevent, and a
 * client that reads `addedCount` and stops reproduces it one layer up.
 *
 * A refusal is a different shape from a partial answer. With the input's default
 * `onBusinessConflict: "reject"` the call fails with `BAD_REQUEST`, and the key it wants read is
 * the one in `serverMessage`: `code` and `domainCode` are both the generic `BAD_REQUEST`, so
 * `isReorderErrorKey` is the only discriminator the shared package exports and `ErrorState`'s
 * `overrides` is the only surface that carries it. `./toast` is not one — its own docblock
 * forbids an error there, and it takes one already-translated string and nothing else.
 *
 * The report is a sibling of the scroll and sits directly above the bar that produced it, which
 * it can because `./action-bar` is a plain flex child: its `bar` and `floating` styles carry
 * padding, a radius and a shadow, and no `position`. So the answer is pinned under the button
 * that asked the question, rather than at the end of a receipt the customer may not be reading.
 * The same block appears in `app/orders.tsx`, where it belongs to the row that was
 * tapped. It is one component rather than two: `@/components/reorder-outcome`, which both
 * screens import, and whose docblock records what the two copies were and what was not a
 * difference between them.
 *
 * ## The shop's telephone number, which the order may not have
 *
 * `orderDetailSchema.business.phone` is `string | null`, and this is the affordance drawn only
 * when it is a string: a `tel:` link to nothing is worse than no link, and a missing capability
 * removes the capability rather than throwing. An invented chat button would be the other half
 * of that mistake — there is no chat in this API and no socket anywhere in the client, so the
 * honest support control is the one the order already carries the data for. `Linking.canOpenURL`
 * is asked before `openURL` because a tablet, and every simulator, has no dialer and `openURL`
 * rejects: a rejection inside a press handler is a red box in development and a dead tap in
 * production. What is handed to `tel:` is digits with an optional leading `+`, not the string
 * the shop typed — the API stores the number as it was entered, spaces and all.
 *
 * ## The pickup code is not part of the receipt
 *
 * It is drawn between the rail and "Lo que pediste" whenever the order carries one, which is the
 * order the customer it belongs to reads the screen in: what is happening, then the code they
 * will be asked for, then what they bought. It used to be in the tail, between the payment line
 * and the courier — the third fact under the money, behind the totals, for the one thing a
 * pickup customer has to show somebody. It is rendered on the server's schedule rather than on
 * `fulfilment`, so it is drawn when the API sends it and not when this file guesses it should.
 *
 * ## Refresh is a gesture on this screen too
 *
 * `orders.byId` polls every five seconds while the order is live, and that is not a pull: a
 * poll flips `isRefetching`, which is `isFetching && !isPending`, so the control is driven by a
 * local flag resolved in `finally` instead. `./pull-refresh` is where that rule lives now, with
 * the both-tints rule and the absent-not-disabled one beside it, and this screen is a caller of
 * that control rather than one of its copies.
 */
/*
 * Four keys used to be declared here as `as MessageKey`, `app/orders.tsx` declared two
 * of the same four, and both docblocks said the dictionaries did not have them yet. They do —
 * `order.reorder.added`, `order.reorder.help`, `order.reorder.skipped.title` and
 * `order.pickupCode.help` are in `packages/i18n/src/messages/{es,en}/customer.ts` — so the casts
 * were no-ops and the two-screen duplication was carrying nothing. The literals are used at
 * their call sites instead, which is what every other string on this screen does and what makes
 * a dictionary edit break here at compile time rather than at the key it forgot to fix.
 */

export default function Order() {
	return (
		<Screen padded={false} contentStyle={styles.page}>
			<SignedIn>
				<OrderDetail />
			</SignedIn>
		</Screen>
	);
}

function OrderDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();
	const { t, intlLocale } = useT();
	const query = useQuery(
		trpc.orders.byId.queryOptions(
			{ id },
			{
				refetchInterval: (q) =>
					q.state.data && isTerminalStatus(q.state.data.status) ? false : 5000,
			},
		),
	);
	const cancel = useMutation(
		trpc.orders.cancel.mutationOptions({
			onSuccess: async () => {
				await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
			},
		}),
	);
	/**
	 * The courier's position, while there is one to read.
	 *
	 * `orders.byId` does not carry it — the order's own row is not where a moving position
	 * belongs — so this is the one place this screen reads `orders.track`, and it reads it only
	 * for the window where the answer exists: a `DELIVERY` that is `READY` (a courier may have
	 * started sharing the moment they picked it up) or `OUT_FOR_DELIVERY`. Every other state
	 * disables the query, so a pickup, a finished order and an order still being prepared make
	 * no request at all.
	 *
	 * The interval matches the courier's reporter rather than the screen's own five seconds:
	 * `orders.reportLocation` is posted at most once every fifteen seconds
	 * (`app/delivery.tsx`), so a poll any faster than this reads the same ping again. The
	 * freshness line below is what tells the customer whether that ping is live or old — the
	 * API says so itself in `orderTrackingOf`'s comment: "readers treat a `updatedAt` older than
	 * a minute as last seen, never as live".
	 */
	const onTheRoad =
		query.data?.fulfilment === "DELIVERY" &&
		(query.data.status === "READY" || query.data.status === "OUT_FOR_DELIVERY");
	const track = useQuery(
		trpc.orders.track.queryOptions(
			{ id },
			{ enabled: onTheRoad, refetchInterval: TRACK_POLL_MS },
		),
	);
	const waiting = useSkeletonHold(query.isPending);
	const [cancelOpen, setCancelOpen] = useState(false);

	// The pull. The busy flag is the control's own and not `query.isRefetching`: this screen
	// polls every five seconds while the order is live, so that one flips on its own — see
	// `./pull-refresh` for the rule, the two tints and the absent-not-disabled one.
	const refreshControl = useRefreshControl(query.refetch);
	const { show } = useToast();
	const reorder = useMutation(
		trpc.orders.reorder.mutationOptions({
			onSuccess: async (result) => {
				// The cart is the thing this write changed, so it is the thing that must not be
				// stale: the badge on the tab reads from this key, and a customer who reorders and
				// then opens the cart has to find what the toast just promised them.
				await cache.invalidateQueries({ queryKey: trpc.cart.pathKey() });
				// A toast only for the clean answer. The partial one has lines to read and gets a
				// block below; saying "agregado al carrito" over a cart that lost a product is the
				// lie `reorderResultSchema` was shaped to prevent.
				if (result.skipped.length === 0) show(t("order.reorder.added"));
			},
		}),
	);

	// Shared with the pinned button below — `lib/leave`, handed the orders list rather than
	// the feed: an order opened from a notification has nothing behind it.

	if (query.isError)
		// An order we do not have is a dead link, or somebody else's order — and the API
		// answers those two the same way on purpose, because a 404 that told them apart would
		// say whether an id exists. So this branch states what is true and stops: no request
		// id to quote and no Retry asking again for something that will not appear. The web
		// app draws the same distinction by mapping `NOT_FOUND` to this same sentence.
		return (
			<View style={styles.padded}>
				{toApiFailure(query.error).code === "NOT_FOUND" ? (
					<EmptyState
						icon="receipt-outline"
						title={t("order.notFound")}
						body={t("order.notFound.body")}
						actionLabel={t("action.back")}
						onAction={() => leaveScreen("/orders")}
					/>
				) : (
					<ErrorState
						error={query.error}
						onRetry={() => void query.refetch()}
					/>
				)}
			</View>
		);

	// Guarded on the data, not on `isPending`: the skeleton's minimum hold keeps this screen
	// on placeholders for a moment after the answer has landed, and the flag alone would let
	// the render below read an undefined order inside that window.
	const order = query.data;
	if (waiting || !order) return <OrderSkeleton label={t("state.loading")} />;

	const paymentKey = PAYMENT_KEYS[order.paymentMethod];

	/**
	 * The courier's latest ping, and whether it is still live.
	 *
	 * A ping needs all three fields to be worth drawing: a coordinate with no timestamp cannot
	 * say whether it is a minute old or an hour old, and the API's own reader rule
	 * (`orderTrackingOf`) is that an age past a minute is "last seen" rather than "live". A row
	 * that has never been pinged has no `updatedAt` either, so the guards collapse into one.
	 *
	 * `Date.now()` in a render is normally a smell here, and it is the honest read in this one:
	 * the screen re-renders on every poll, so freshness is recomputed exactly as often as a new
	 * answer arrives, and the alternative — a timer that flips the word on its own — would be a
	 * second clock for a fact the poll already carries.
	 */
	const courierPing = track.data?.courier;
	const ping =
		courierPing?.lat != null &&
		courierPing.lng != null &&
		courierPing.updatedAt != null
			? {
					lat: courierPing.lat,
					lng: courierPing.lng,
					at: courierPing.updatedAt,
				}
			: null;
	const fresh = ping ? Date.now() - ping.at.getTime() < FRESH_MS : false;

	/**
	 * When each step was reached, for the rail's per-step times.
	 *
	 * `orders.byId` already carries the order's append-only event log, ordered by `createdAt`
	 * ascending, so this is a read of what the response holds rather than a second query
	 * against `orders.track` polling beside it — the same argument the freshness line below
	 * makes. The **first** event that reached a status is the one that counts (`orderTrackingOf`
	 * in `apps/api/src/services/mappers.ts` stamps each step the same way), and `NOTE` is not a
	 * step: it is a comment somebody left on the order, and a note would otherwise claim the
	 * time of a status that was reached later.
	 */
	const reachedAt: Partial<Record<OrderStatus, Date>> = {};
	for (const event of order.events) {
		if (event.status === "NOTE") continue;
		if (reachedAt[event.status]) continue;
		reachedAt[event.status] = event.createdAt;
	}

	/**
	 * The estimate, in the sentence its own day calls for.
	 *
	 * Same day as the order was placed is the ordinary case and the one where the date is
	 * noise. The comparison is between two *stored* values and never against `Date.now()`, so
	 * the sentence the customer reads does not depend on when they opened the screen.
	 */
	const estimate = order.estimatedReadyAt;
	const estimateKey: MessageKey = sameDay(estimate, order.placedAt)
		? "tracking.estimate.ready.sameDay"
		: "tracking.estimate.ready.otherDay";

	/**
	 * Which bar this order gets, and the comment that used to stand here.
	 *
	 * It said a terminal order had no action left because "there is no reorder endpoint and no
	 * review route in this app yet". Half of that is now false: `orders.reorder` exists, takes
	 * `{ orderId, onBusinessConflict }` and answers with the lines it could not bring back, so a
	 * finished order is not a dead end and the spacer that used to stand where its bar would have
	 * been is gone with it. The review half is still true — `orderDetailSchema.review` and
	 * `reviews.list` are both read surfaces and this app has no screen that writes one, so nothing
	 * here offers to. A control that exists only to look like one is still the thing to avoid; the
	 * difference is that it is no longer the whole story on this screen.
	 *
	 * Which orders can still be cancelled is not decided here and never was: the button reads
	 * `canCancel` and the sentence beside it reads `order.cancel.tooLate`, both straight off the
	 * server's state machine — `nextStatuses` and `canCancel` are the API's answer, not a rule
	 * restated in a client.
	 */
	const actionable = !isTerminalStatus(order.status);

	/**
	 * The shop's number, as a URL scheme can carry it.
	 *
	 * `tel:` wants digits and an optional leading `+`; the API stores whichever string the shop
	 * entered, which is a number written for a human — spaces, dashes and parentheses included.
	 * Everything that is not one of those two things goes. A number with no digits in it leaves
	 * this empty, and the drawing site links only when it is not.
	 */
	const phone = order.business.phone;
	const dialable = phone ? phone.replace(/[^\d+]/g, "") : "";

	/**
	 * The dial, and the two ways it can fail to happen.
	 *
	 * `canOpenURL` is asked before `openURL` because the second one **rejects**: a tablet has no
	 * dialer and no simulator has one, and a rejection inside a press handler is an unhandled
	 * promise rejection in development and a tap that looks like it did nothing in production. The
	 * `.catch` covers the query itself rejecting, which a scheme no installed app handles can do.
	 * Both failures end the way a missing phone number does — nothing opens, and nothing throws —
	 * which is the rule a missing capability is supposed to follow.
	 *
	 * No haptic, because `lib/haptics.ts`'s vocabulary is for a change this app made: an add to a
	 * cart, a choice settling, a refusal. This hands the customer to the OS dialer, which is not a
	 * write and has its own feedback a moment later.
	 *
	 * The URL is built from `dialable` and not from `phone`, and the caller only draws the button
	 * when `dialable` is not empty — so this function is never reached with a scheme and no digits.
	 */
	function call() {
		const url = `tel:${dialable}`;
		return Linking.canOpenURL(url)
			.then((canOpen) => (canOpen ? Linking.openURL(url) : null))
			.catch(() => null);
	}

	/**
	 * The question is `./confirm-sheet`'s, and its cancel says "Volver" because that is what the
	 * other answer does — it goes back to the order, not to a form. The bar's own destructive
	 * fill stays: it is the screen's one loud thing and the reason the panel is not the only
	 * warning. The haptic is fired by the tap that does the thing.
	 */
	function confirmCancel() {
		warning();
		cancel.mutate({ orderId: id });
	}

	return (
		<View style={styles.page}>
			<View style={styles.chrome}>
				<BackButton to="/orders" />
			</View>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				// From `./pull-refresh`, both tints and its own flag — see that file.
				refreshControl={refreshControl}
			>
				<AnimateIn index={0}>
					<Text variant="title" bold>
						{t("order.number", { code: order.reference })}
					</Text>
				</AnimateIn>
				<AnimateIn index={1}>
					<Text variant="heading">{order.business.name}</Text>
				</AnimateIn>
				<AnimateIn index={2}>
					<Text variant="caption" tone="muted">
						{t("order.placedAt", {
							date: formatDay(order.placedAt, intlLocale),
							time: formatClock(order.placedAt, intlLocale),
						})}
					</Text>
				</AnimateIn>

				{/* The status, and the estimate under it: the two lines this screen exists for,
				    directly above the rail that draws the same status as steps. The word is the
				    signal and the tint is the second one — `statusForeground` is the ink of the
				    token pair the badge uses, so the two never drift apart. */}
				<AnimateIn index={3}>
					<View style={styles.headline}>
						<Text
							variant="display"
							bold
							style={{ color: colors[statusForeground(order.status)] }}
						>
							{t(statusKey(order.status))}
						</Text>
						{estimate ? (
							<Text variant="body">
								{t(estimateKey, {
									time: formatClock(estimate, intlLocale),
									date: formatDay(estimate, intlLocale),
								})}
							</Text>
						) : null}
						{estimate ? (
							<Text variant="caption" tone="muted">
								{t("tracking.estimate.help")}
							</Text>
						) : null}
					</View>
				</AnimateIn>

				<OrderTimeline
					status={order.status}
					fulfilment={order.fulfilment}
					reachedAt={reachedAt}
				/>

				{order.fulfilment === "DELIVERY" ? (
					<CustomerDeliveryRating orderId={order.id} />
				) : null}

				{/* The code, in the place the customer it belongs to reads the screen in: what is
				    happening, then what they will be asked for, then what they bought. It is drawn
				    when the API sends one rather than when this file reasons that a `PICKUP` order
				    should have one — `pickupCode` is nullable in `orderDetailSchema` and a screen
				    that filled the gap with a guess would print a code the shop cannot check.

				    `index={4}` is the slot the page's stagger had left — the head is 0-3, the item
				    cards open at 5, and the rail's rows carry their own entrance — and it is also
				    the items heading's index, so on a pickup order the two enter together at one
				    step rather than the code appearing a step late. `reorder` because this block
				    sits under a rail that grows and shrinks on every poll — the same argument the
				    item cards and the tail make. */}
				{order.pickupCode ? (
					<AnimateIn index={4} reorder>
						<Card>
							{/* Three lines about one thing — where to show the code — so they stack at the
							    body gap rather than the step `group` pays between separate blocks. */}
							<View style={styles.stack}>
								<Text variant="body" tone="muted">
									{t("order.pickup")}
								</Text>
								{/* A code the customer reads out loud, so it is set at `title` — the size
								    the order number is set in, and the largest type on the card it sits
								    in — in `tabular` digits, with the sentence that says where to show
								    it. It is not `display`: that is the status word's size, and the one
								    loud thing on this screen has to stay the answer to "where is it". */}
								<Text variant="title" bold tabular>
									{order.pickupCode}
								</Text>
								<Text variant="caption" tone="muted">
									{t("order.pickupCode.help")}
								</Text>
							</View>
						</Card>
					</AnimateIn>
				) : null}

				<AnimateIn index={4}>
					<Text variant="heading" bold>
						{t("order.items")}
					</Text>
				</AnimateIn>
				{order.items.map((item, index) => (
					// `reorder` on a list that cannot change, because it is not *this* list that
					// moves: the rail above it grows and shrinks as the order advances, and these
					// cards have to close that distance on the layout spring instead of jumping.
					// The entrance is a mount one either way — an order's items are read once and
					// never re-enter while the customer is watching the tracker.
					<AnimateIn key={item.id} index={index + 5} reorder>
						<Card>
							<View style={styles.itemRow}>
								{/* The picture the line was bought with - `orderItemSchema.imageUrl`, the
								    snapshot taken at checkout and not the product's today. Drawn exactly
								    the way `./product-row` draws a menu row's thumbnail: a fixed `media.row`
								    box in the row's layout, `./image`'s `image-outline` stand-in when the
								    product had no picture, and both a11y hiders - the line's own words name
								    the product, so the box is decoration. */}
								<Image
									uri={item.imageUrl}
									style={[styles.itemThumb, { borderColor: colors.border }]}
									accessibilityElementsHidden
									importantForAccessibility="no"
								>
									{item.imageUrl ? null : (
										<Ionicons
											name="image-outline"
											size={icon.action}
											color={colors.mutedForeground}
										/>
									)}
								</Image>
								<View style={styles.itemBody}>
									<View style={styles.itemHead}>
										<Text variant="body" bold tabular style={styles.itemName}>
											{item.quantity} × {item.name}
										</Text>
										<Price
											amountMinor={item.lineTotalMinor}
											currency={order.currency}
											variant="body"
										/>
									</View>
									{item.options.length ? (
										<Text variant="caption" tone="muted">
											{item.options.map((option) => option.name).join(", ")}
										</Text>
									) : null}
									{item.notes ? (
										<Text variant="caption" tone="muted">
											{item.notes}
										</Text>
									) : null}
								</View>
							</View>
						</Card>
					</AnimateIn>
				))}

				{/* The tail is one block for the reason the cart's is: everything here sits under
				    the rail and moves when the rail does, so it is one movement rather than seven.
				    Its index is the item count plus the same offset the cards use — the total enters
				    with the last line it is the total *of*, never behind it, which is
				    `docs/design-mobile.md`'s rule about the total and not a stagger preference. */}
				<AnimateIn index={order.items.length + 5} reorder>
					<View style={styles.tail}>
						<View style={styles.totals}>
							<MoneyLine
								label={t("cart.subtotal")}
								amountMinor={order.totals.subtotalMinor}
								currency={order.currency}
							/>
							<MoneyLine
								label={t("cart.delivery")}
								amountMinor={order.totals.deliveryFeeMinor}
								currency={order.currency}
							/>
							{order.totals.discountMinor > 0 ? (
								<MoneyLine
									label={t("cart.discount")}
									// Negative, like `./summary-card` and every web receipt: the API stores
									// the magnitude and `formatMoney` prints the minus. See that file for
									// why the sign is the caller's to choose.
									amountMinor={-order.totals.discountMinor}
									currency={order.currency}
								/>
							) : null}
							{order.totals.taxMinor > 0 ? (
								<MoneyLine
									label={t("cart.tax")}
									amountMinor={order.totals.taxMinor}
									currency={order.currency}
								/>
							) : null}
							{order.totals.tipMinor > 0 ? (
								<MoneyLine
									label={t("cart.tip")}
									amountMinor={order.totals.tipMinor}
									currency={order.currency}
								/>
							) : null}
							<MoneyLine
								label={t("cart.total")}
								amountMinor={order.totals.totalMinor}
								currency={order.currency}
								strong
							/>
						</View>

						<View style={styles.line}>
							<Text variant="body" tone="muted">
								{t("checkout.payment")}
							</Text>
							<Text variant="body" bold>
								{t(paymentKey)}
							</Text>
						</View>

						{order.deliveryAddress ? (
							// A label, the street and the instruction are lines about one thing, so they
							// stack at the body gap rather than the step separate blocks pay.
							<View style={styles.stack}>
								<Text variant="body" tone="muted">
									{t("order.deliveryTo")}
								</Text>
								<Text variant="body" bold>
									{order.deliveryAddress.line1}, {order.deliveryAddress.city}
								</Text>
								{order.deliveryAddress.instructions ? (
									<Text variant="caption" tone="muted">
										{order.deliveryAddress.instructions}
									</Text>
								) : null}
							</View>
						) : null}

						{order.courier?.name ? (
							<Text variant="body">
								{t("order.track.courier", { name: order.courier.name })}
							</Text>
						) : null}

						{/* Where the courier is, which is the one thing this screen could not
						    answer before: the API has carried the position since
						    `orders.reportLocation` existed and no client drew it.

						    Drawn only when a ping has landed. A courier who has not shared one —
						    declined permission, a phone that has not moved, a run still on the
						    counter — gets no block at all rather than a placeholder: an empty map
						    frame would be a promise that something is coming, and this screen does
						    not know that it is.

						    The map centres on the courier rather than on the buyer, because the
						    buyer already knows where they are. `./map` drops the pin; the SDK's own
						    location dot is the buyer's, and both on one map is the point. Without a
						    basemap configured the map renders nothing and the freshness line below
						    is what remains — which is the honest half: a position and when it was
						    taken, no picture. */}
						{ping ? (
							<View style={styles.group}>
								<MapView coords={ping} marker={ping} />
								<Text variant="caption" tone="muted">
									{fresh
										? t("order.track.live")
										: t("order.track.updated", {
												time: formatClock(ping.at, intlLocale),
											})}
								</Text>
							</View>
						) : null}

						{order.cancellationReason ? (
							<Text variant="body" tone="destructive">
								{order.cancellationReason}
							</Text>
						) : null}

						{/* The one support affordance this app can honestly offer: the shop's own
						    number, which the order already carries. See the file's docblock for why
						    there is no chat button and why `canOpenURL` is asked first. Drawn only
						    when there is something to dial, so the heading never appears over an
						    empty slot — `dialable` is the digits, and a number that leaves none is
						    not linked at all. */}
						{dialable ? (
							<View style={styles.group}>
								<Text variant="body" tone="muted">
									{t("order.help")}
								</Text>
								<Button
									label={t("order.callBusiness")}
									variant="secondary"
									// `sm`: a control beside a line of text rather than the screen's
									// decision, and `./button` keeps it `MIN_TOUCH_TARGET` tall
									// regardless — the horizontal padding is what shrinks.
									size="sm"
									icon={
										<Ionicons
											name="call-outline"
											size={icon.control}
											color={colors.secondaryForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									}
									style={styles.help}
									onPress={() => void call()}
								/>
							</View>
						) : null}
					</View>
				</AnimateIn>
			</ScrollView>

			{/* The answer to the reorder, if it had one to give, in the one place it cannot be
			    missed: directly above the bar that asked. It is outside the scroll on purpose —
			    the customer tapped a pinned button and may be anywhere in a long receipt, so a
			    report inside the receipt is a report at the end of a document they are not
			    reading. The condition is on the answer rather than on the status alone, so the
			    wrapper is not an empty block holding open a gap the bar does not need. */}
			{!actionable && (reorder.data || reorder.error) ? (
				<View style={styles.reportBlock}>
					<ReorderOutcome result={reorder.data} error={reorder.error} />
				</View>
			) : null}

			{/* A refused cancel, in the same place and for the same reason as the report above:
			    the customer tapped a pinned button and may be anywhere in a long receipt, so a
			    refusal drawn inside that receipt is one they may never read — which is exactly
			    the rule this same file states for the reorder below. It used to sit in the tail,
			    under the money and the shop's phone number.

			    It carries a retry because the write it reports is repeatable, and the control
			    that repeats it is the bar's own: this is the same `mutate` the button calls, so
			    the retry cannot attempt anything the customer could not have tapped again
			    themselves. `ErrorState`'s retry button is drawn only when `onRetry` is given
			    (`components/error-state.tsx:163`), which is why this branch passed none before.
			    No wrapper carries a live region and this screen announces nothing here:
			    `ErrorState` owns that half for both platforms (`:133-141`), and the announce in
			    `@/components/reorder-outcome` excludes the failure branch for the same reason. */}
			{cancel.error ? (
				<View style={styles.reportBlock}>
					<ErrorState
						error={cancel.error}
						onRetry={() => cancel.mutate({ orderId: id })}
					/>
				</View>
			) : null}

			{actionable ? (
				<ActionBar
					// The only bar in the app drawn in a colour that is not the happy path, and it
					// is the reason `./action-bar` has a `variant` at all. Cancelling is the one
					// action here that *removes* something, and it was rendering in the same
					// filled fill as "Pagar" and "Hacer pedido" — the design system's own
					// language for "this is what you came to do", spent on the thing a customer
					// does when something has gone wrong. Nothing new was invented for it:
					// `destructive` is `./button`'s existing fourth variant.
					variant="destructive"
					primary={{
						label: t("order.cancel"),
						onPress: () => setCancelOpen(true),
						loading: cancel.isPending,
						// Cannot be used yet, rather than not offered: the button is dimmed and
						// still says what it does, and the sentence beside it says why.
						disabled: !order.canCancel,
						accessibilityHint: order.canCancel
							? undefined
							: t("order.cancel.tooLate"),
					}}
					// A total on the left, which is what `./action-bar` is shaped for and what the
					// cart puts there. It carries its **label**: a bare figure beside "Cancelar
					// pedido" reads as the price of cancelling, and the same line the receipt below
					// draws is the one that says what the number is.
					summary={
						order.canCancel ? (
							<MoneyLine
								label={t("cart.total")}
								amountMinor={order.totals.totalMinor}
								currency={order.currency}
							/>
						) : (
							<Text variant="caption" tone="muted">
								{t("order.cancel.tooLate")}
							</Text>
						)
					}
				/>
			) : (
				// The other bar. Every branch of this screen has one now, which is why the empty
				// block that used to pay the bottom inset is gone: an order that is over is not an
				// order without a next step. The default `variant` is deliberate — this is the
				// action a customer came back to take, and filling it is this design system's word
				// for that; a destructive fill is what the *other* bar is for.
				//
				// The summary says where the items go, because the label alone does not: "Pedir
				// otra vez" reads as placing the order again, and what this does is build a cart.
				// A customer who expects a second order and finds a cart has been misled by a
				// button, and that sentence is cheaper than the surprise.
				<ActionBar
					primary={{
						label: t("order.reorder"),
						onPress: () => {
							// A change the reader made on purpose: `lib/haptics.ts` puts adding to a
							// cart under `light`, and this is that act with a stored order as its
							// input. The visual twin is the button's own press state, which
							// `./pressable` supplies on both platforms.
							light();
							reorder.mutate({ orderId: id });
						},
						loading: reorder.isPending,
					}}
					summary={
						<Text variant="caption" tone="muted">
							{t("order.reorder.help")}
						</Text>
					}
				/>
			)}
			{/* Last in the page and a sibling of the scroll: `./sheet` has no portal, so inside the
			    scroll it would leave with the content. */}
			<ConfirmSheet
				open={cancelOpen}
				onClose={() => setCancelOpen(false)}
				title={t("order.cancel.confirm")}
				confirmLabel={t("order.cancel")}
				cancelLabel={t("action.back")}
				onConfirm={confirmCancel}
			/>
		</View>
	);
}

function CustomerDeliveryRating({ orderId }: { orderId: string }) {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const [rating, setRating] = useState<RatingValue>(0);
	const [comment, setComment] = useState("");
	const delivery = useQuery(
		trpc.deliveries.byOrder.queryOptions(
			{ orderId },
			{
				refetchInterval: (query) =>
					query.state.data?.status === "DELIVERED" ? false : 5_000,
			},
		),
	);
	const rate = useMutation(
		trpc.deliveries.rate.mutationOptions({
			onSuccess: async () => {
				success();
				await cache.invalidateQueries({ queryKey: trpc.deliveries.pathKey() });
			},
			onError: warning,
		}),
	);

	if (delivery.isError) return <ErrorState error={delivery.error} />;
	if (delivery.data?.status !== "DELIVERED") return null;

	const detail = delivery.data;
	const rated = detail.ratings.customerToCourier ?? rate.data;
	return (
		<AnimateIn index={4} reorder>
			<Card>
				<View style={styles.stack}>
					<Text variant="heading" bold>
						{t("delivery.rateCourier.title")}
					</Text>
					{rated ? (
						<Text variant="body" tone="muted">
							{t("delivery.rateCourier.thanks")}
						</Text>
					) : (
						<>
							<Text variant="body" tone="muted">
								{t("delivery.rateCourier.subtitle")}
							</Text>
							<RatingInput
								value={rating}
								onChange={setRating}
								label={t("review.rating")}
								optionLabel={(value) =>
									t("review.stars", { count: value, stars: 5 })
								}
								disabled={rate.isPending}
							/>
							<Field
								label={t("review.comment")}
								placeholder={t("review.comment.placeholder")}
								value={comment}
								onChangeText={setComment}
								multiline
								maxLength={500}
								editable={!rate.isPending}
							/>
							{rate.error ? <ErrorState error={rate.error} /> : null}
							<Button
								label={t("delivery.rateCourier.submit")}
								fullWidth
								loading={rate.isPending}
								disabled={rating === 0 || rate.isPending}
								onPress={() => {
									if (rating === 0) return;
									rate.mutate({
										deliveryId: detail.id,
										rating,
										comment: comment.trim() || undefined,
									});
								}}
							/>
						</>
					)}
				</View>
			</Card>
		</AnimateIn>
	);
}

/**
 * Which words the payment methods the API can store are read as.
 *
 * **Total, and not `Partial`.** It was `Partial<Record<PaymentMethod, MessageKey>>` with the
 * two methods the app offers in it, and `CARD` — which is in `PAYMENT_METHODS` and refused by
 * the API while no business has a card terminal — had no key. A partial map's index signature
 * is `MessageKey | undefined`, so the missing key type-checked and an order paid by card drew
 * its receipt **with no payment line at all**: a fee-shaped hole, which
 * `docs/design-mobile.md` puts in its out-list. A total `Record` makes the next method a
 * compile error here rather than a silently shorter receipt, and the sentence it demanded is
 * `checkout.payment.card` in `packages/i18n/src/messages/{es,en}/tracking.ts`.
 */
/**
 * How old a position may be and still be called live.
 *
 * A minute, and it is the API's number rather than this screen's: `orderTrackingOf` writes the
 * rule into its own comment ("readers treat a `updatedAt` older than a minute as 'last seen',
 * never as live"). The courier's phone posts every fifteen seconds, so a minute is four missed
 * posts — long enough that a tunnel or a backgrounded app does not make the word flicker, short
 * enough that a customer is not told a courier parked four streets away is on their street.
 */
const FRESH_MS = 60_000;

/**
 * How often the position is re-read while a delivery is on the road.
 *
 * The courier's own reporting interval (`app/delivery.tsx`): the API holds the latest ping and
 * no history, so a faster poll reads the same row again.
 */
const TRACK_POLL_MS = 15_000;

const PAYMENT_KEYS: Record<PaymentMethod, MessageKey> = {
	CASH: "checkout.payment.cash",
	SINPE_MOVIL: "checkout.payment.sinpe",
	CARD: "checkout.payment.card",
};

/**
 * Two timestamps on the same calendar day.
 *
 * Local, because the day a customer means is the day their own clock is showing — the same
 * reason `lib/format.ts` formats through `Intl` rather than through UTC arithmetic. Used
 * between two values the API stored (`estimatedReadyAt` and `placedAt`) and never against
 * `Date.now()`: which sentence a customer reads must not depend on when they opened the
 * screen. Returns `false` for a missing estimate, which is the case where no sentence is
 * drawn at all.
 */
function sameDay(value: Date | null, other: Date): boolean {
	if (!value) return false;
	return (
		value.getFullYear() === other.getFullYear() &&
		value.getMonth() === other.getMonth() &&
		value.getDate() === other.getDate()
	);
}

/**
 * The rail's rows in the skeleton, named rather than counted.
 *
 * Five, because a customer timeline tops out at six steps: enough rows to read as a rail
 * without guessing at this order's own length, and few enough that a two-step pickup order
 * does not look like it is about to be a lot of work. The values are the rows' identity
 * for React's key, which is why they are a list instead of a count handed to `Array.from`.
 */
const SKELETON_STEPS = [0, 1, 2, 3, 4] as const;

/**
 * The order, before it arrives.
 *
 * The timeline's rail and a couple of item blocks, because that is the page below — the
 * skeleton is the layout standing in for itself, not a generic grey placeholder. It is not a
 * spinner, and it does not draw the pinned bar: a bar is the screen's one decision and a
 * placeholder for one would be a button-sized grey block.
 *
 * It draws the two lines under the title as well, which is the repair this pass owed it: the
 * status word became the screen's headline and a business-name line was already above it, so the
 * page below the title grew by a heading and a `display` line and every block under them slid
 * down by that much the moment the data landed. Those two heights are the ones a reader notices,
 * because they are the tallest and the nearest the top.
 *
 * What it deliberately does *not* draw is the conditional half: the pickup card (only an order
 * with a `pickupCode` has one) and the reorder report (only an order that was just reordered).
 * A skeleton that guessed at either would be wrong for every order that has neither, and a
 * placeholder that disappears is a jump too.
 *
 * The heights are composed with the reader's font scale, because a skeleton frozen at 100%
 * metrics is eight points short of a real row at 200% (`docs/design-mobile.md`, Waiting) —
 * the same composition `app/orders`' skeleton uses. The item card's height is the card's own
 * anatomy, its `media.row` thumbnail inside `./card`'s `space.lg` padding, rather than a
 * number that drifts from the card it stands in for; and the rail rows are the real rail's
 * shape, a marker beside the step's word (`./order-timeline`), stacked with the same no-gap
 * column the real rail keeps.
 */
function OrderSkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();
	// A line of real text, at the height the variant it stands in for draws it.
	const line = (variant: keyof typeof type) => ({
		height: Math.round(type[variant].lineHeight * fontScale),
	});

	return (
		<View
			style={styles.padded}
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
		>
			<Skeleton style={[styles.skeletonTitle, line("title")]} />
			<Skeleton style={[styles.skeletonBusiness, line("heading")]} />
			<Skeleton style={[styles.skeletonHeadline, line("display")]} />
			{/* The rail's column, with no gap of its own — the real rail is five rows with none
			    between them, and a skeleton a column taller is the jump it exists to prevent. */}
			<View accessible={false}>
				{SKELETON_STEPS.map((step) => (
					<View key={step} style={styles.skeletonStep} accessible={false}>
						<Skeleton style={styles.skeletonMarker} radiusToken="full" />
						<Skeleton style={[styles.skeletonStepLabel, line("body")]} />
					</View>
				))}
			</View>
			<Skeleton style={styles.skeletonCard} radiusToken="md" />
			<Skeleton style={styles.skeletonCard} radiusToken="md" />
			<Skeleton style={[styles.skeletonLine, line("body")]} />
			<Skeleton style={[styles.skeletonTotal, line("heading")]} />
		</View>
	);
}

const styles = StyleSheet.create({
	// The column the screen is: the pinned back control, the scroll, and the bar — so the
	// scroll takes whatever height the other two do not, and neither of them moves.
	page: { flex: 1 },
	// Outside the scroll on purpose: the back control has to be in the same place on the frame
	// the screen opens and on every frame after it, and the rail below changes height every
	// time a step is reached. No top padding — the safe-area inset is the top air, paid by
	// `Screen` on every screen (`padded={false}` still pays it), so a back strip is the gutter
	// and, when it wants one, a step below. Every back strip in the app draws the same way.
	chrome: {
		paddingHorizontal: space.lg,
		paddingBottom: space.sm,
	},
	scroll: { flex: 1 },
	// The measure `Screen`'s `padded` would have applied, and `space.huge` under the last line
	// so the receipt does not end flush against the bar.
	content: {
		paddingHorizontal: space.lg,
		paddingBottom: space.huge,
		gap: space.lg,
	},
	// The error and skeleton branches are not inside the scroll, so they pay the same measure
	// here rather than through the screen.
	padded: {
		flex: 1,
		paddingHorizontal: space.lg,
		paddingTop: space.md,
		gap: space.lg,
	},
	// The status word, the estimate and the sentence about the estimate are one stack, so they
	// are stacked at `TEXT_STACK_GAP` like any other stack of lines about one thing.
	headline: { gap: TEXT_STACK_GAP },
	// A stack of lines about one thing inside a card — the pickup code's three lines, the
	// delivery address's — at the body gap. `group` keeps `space.xs` for the pairs that are
	// two blocks, not one statement: a map and its caption, a line and the control under it.
	stack: { gap: TEXT_STACK_GAP },
	group: { gap: space.xs },
	line: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
	},
	itemHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
	},
	// A long product name wraps rather than pushing the line's total off the card.
	itemName: { flex: 1 },
	// One receipt line: the snapshot's picture beside the line's own words - the same
	// arrangement `./product-row` draws a menu row in. The box is `media.row` square, the
	// thumbnail measure a row already uses, and not a size of its own.
	itemRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	itemThumb: {
		width: media.row,
		height: media.row,
		borderWidth: 1,
	},
	itemBody: { flex: 1, gap: TEXT_STACK_GAP },
	/**
	 * A block pinned above the bar: the reorder report, and the refused cancel.
	 *
	 * The horizontal measure is the scroll's own (`space.lg`), because the block is not inside the
	 * scroll: without it the report would be the one thing on the screen touching both edges. The
	 * bottom gap is the bar's own top padding in reverse — `./action-bar` opens with `space.md`, so
	 * `space.sm` here keeps the report and the button under it from reading as one control. The
	 * two blocks are never both drawn: the report belongs to a terminal order and the cancel
	 * failure to one that can still be acted on.
	 */
	reportBlock: { paddingHorizontal: space.lg, paddingBottom: space.sm },
	// A secondary control under a line of text: as wide as its word, not as wide as the receipt.
	// Still `MIN_TOUCH_TARGET` tall — `./button` owns that floor and nothing here overrides it.
	help: { alignSelf: "flex-start" },
	totals: { gap: space.sm },
	// The tail's internal rhythm is the body's own `space.lg`, because it was seven children
	// of the body and it is now one block: the gaps inside it are the gaps that were there.
	tail: { gap: space.lg },
	// The three lines above the rail, at the widths the real words come to. The heights are
	// not written here: the skeleton composes them with the reader's font scale, the way
	// `app/orders`' skeleton does.
	skeletonTitle: { width: "60%" },
	// The business name and the status headline, in the type sizes the page draws them in — the
	// skeleton's own docblock says why these two are the ones worth standing in for.
	skeletonBusiness: { width: "40%" },
	skeletonHeadline: { width: "55%" },
	// One rail row, the shape `./order-timeline` draws: a marker beside the step's word, the
	// row at least a control tall because a real rail row is.
	skeletonStep: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
	},
	// The marker's box — `space.lg + space.xs`, the diameter `./order-timeline` builds its
	// markers in, restated here because that constant is not exported. The `marginTop` is the
	// marker's own offset on its row.
	skeletonMarker: {
		width: space.lg + space.xs,
		height: space.lg + space.xs,
		marginTop: space.xs,
	},
	// The step's word: a body line, not the full width a flex child would run to.
	skeletonStepLabel: { width: "35%" },
	// The item card's height is the card's anatomy: the `media.row` thumbnail inside
	// `./card`'s `space.lg` padding on both sides.
	skeletonCard: { height: media.row + space.lg * 2 },
	skeletonLine: { width: "70%" },
	skeletonTotal: { width: "45%" },
});
