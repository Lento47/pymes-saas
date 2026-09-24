import Ionicons from "@expo/vector-icons/Ionicons";
import {
	isTerminalStatus,
	ORDER_STATUSES,
	type OrderStatus,
} from "@pymeshub/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type Href,
	router,
	useIsFocused,
	useLocalSearchParams,
} from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListEnd } from "@/components/list-end";
import { Pressable } from "@/components/pressable";
import { Price } from "@/components/price";
import { useRefreshControl } from "@/components/pull-refresh";
import { ReorderOutcome } from "@/components/reorder-outcome";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import {
	StatusBadge,
	statusBadgeHeight,
	statusKey,
} from "@/components/status-badge";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useSession } from "@/lib/auth/session";
import { formatClock, formatDay, formatStamp } from "@/lib/format";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { PRESS_SCALE_ROW } from "@/lib/motion";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	type,
	useTheme,
} from "@/theme";

/**
 * The customer's orders.
 *
 * The two segments are filters the **API** applies, not ones this screen applies to a loaded
 * page — which matters the moment somebody has more than twenty orders: filtering a page of
 * twenty on the client shows "no active orders" to a customer whose order is twenty-first.
 *
 * ## The filter says "en curso" and "anteriores", and both are true
 *
 * The segments used to reuse two keys that were not about filtering — `order.track.title`
 * ("Tu pedido") and `nav.orders` ("Pedidos") — which named neither state, and the second of
 * them named the screen the list is already on. They are `order.active` and `order.past` now,
 * the words the web list uses for the same control.
 *
 * The "anteriores" segment asks for exactly the **terminal** statuses —
 * `ORDER_STATUSES.filter(isTerminalStatus)`, the same derivation
 * `apps/web/app/(shop)/orders/page.tsx` uses — rather than turning `activeOnly` off and
 * calling the result "past". Those are two different sets: without `activeOnly` the list
 * returns *every* order, so an unfinished one would sit under a segment that says it is over.
 * The filter is the API's either way, so "en curso" and "anteriores" mean the same two sets
 * on both surfaces.
 *
 * ## The list pages, so the twenty-first order is reachable
 *
 * It reads `orders.list` through `useInfiniteQuery` and ends with `./list-end`, where this
 * screen used to draw its own footer out of `order.loadMore`. This screen used to ask for
 * `limit: 20` through a plain `useQuery` and stop there: the filter was honest about which
 * orders were *active*, and "todos" then showed the newest twenty and silently ended, so a
 * customer hunting an old receipt on the phone could not reach it while the web app, paging
 * the same procedure, could. An end that cannot be scrolled to is not a page size, it is a
 * horizon.
 *
 * The footer is a button rather than `onEndReached`, which is `app/store/[slug]`'s choice
 * and for its reason: a list that appends while the reader is scrolling past the last row is
 * a list that moves under the thumb.
 *
 * ## Freshness belongs to an unfinished order, not to a segment
 *
 * The poll keeps the loaded pages current while something in them can still change, and
 * stops once nothing can. `refetchInterval` on an infinite query re-reads *every* loaded
 * page, so a customer who had scrolled a long history open would otherwise re-read the whole
 * archive twice a minute to watch numbers that are final. The live segment polls exactly as
 * it did before, because everything in it is unfinished by definition.
 *
 * Two conditions, not one, and the second is the one that was missing. The first is the
 * order's own status, above. The second is whether anybody is looking at the list: an order
 * being unfinished is not a reason to re-read sixty of them while the customer is on the
 * storefront, in the cart, or reading a dish. React Query's `focusManager` cannot answer that
 * — it is fed from `AppState` (`lib/trpc/provider.tsx`), so it separates foreground from
 * background and knows nothing about which screen is mounted, and every screen in this app is
 * foreground while the customer walks around inside it. `useIsFocused` is the screen-level
 * half, exported by expo-router, so it costs no new dependency.
 *
 * ## The gate needs a second half, or it is a defect rather than a saving
 *
 * Stopping the interval is not enough on its own, and this is the part that is easy to get
 * wrong. `refetchInterval` stops being scheduled while the screen is away — but react-query
 * arms a fresh `POLL_MS` timer when the screen comes back rather than firing immediately, so
 * a customer who leaves for two minutes and returns sees the rows as they were two minutes
 * ago, and keeps seeing them for up to another ten seconds. Rows that are older the moment
 * they come back into view are worse than rows that were quietly kept fresh, because the
 * screen is now lying about how current it is. So the return itself re-reads: the effect below
 * runs `refetch()` on re-focus, which is the same read the interval would have made, made now.
 *
 * `useRef` and not a bare effect, because the effect also runs on mount — and there, the mount
 * fetch is either already in flight or about to be started by the observer, and
 * `observer.refetch()` defaults `cancelRefetch: true` (`@tanstack/query-core`,
 * `queryObserver.js`), so calling it on mount would *cancel* the fetch the screen needs and
 * start a second one. The first pass through the effect is therefore spent marking the mount
 * and nothing else.
 *
 * Signed out, this is the sign-in screen's business, and the empty state says so instead of
 * rendering an API error. A UNAUTHORIZED here is not a failure the customer caused; it is
 * the ordinary state of somebody who has not signed in yet.
 *
 * ## The filter is a switch, and `./segmented` says so
 *
 * Changing the filter changes what the list is *about*, so the choice is marked with a
 * haptic — and `Segmented` owns that: it fires `selection()` on settle, and only when the
 * value actually changes, so a re-tap of the segment that is already on commits nothing.
 * This screen fires none of its own. It also does not draw the segments: the local pair that
 * used to live here carried the chosen state in the fill alone — a state that exists only as a
 * tint fails the one test `docs/design-mobile.md` sets — and used the full press scale on a
 * full-width control instead of `PRESS_SCALE_ROW`. `Segmented` marks the choice three ways
 * (a fill, a heavier label, `accessibilityState.selected`) and takes the group's radius off
 * the token scale. The rows carry no haptic of their own: the tap that opens a page is
 * answered by the page.
 *
 * ## The count on a row, and the chevron beside it
 *
 * `order.itemCount` and its plural sibling, through `tp` — not `search.results`, which is
 * the same number said about a search page and reads "3 resultados" under an order. A
 * customer comparing two orders is reading this line.
 *
 * The chevron is the same one `./list-row` draws, drawn here for the same reason: a row that
 * opens something should look like it opens something, and a card with no affordance on it
 * reads as the whole of what there is. It is `mutedForeground` and hidden from the
 * accessibility tree — the row's own label already says what it opens — and the row's label
 * is the order number **and its status**, because the status chip inside the row is not
 * announced: the row is one button, and a label on the parent replaces the children's, so a
 * reader who could not see the tint would otherwise not hear the state at all. A comma is
 * punctuation rather than copy, which is why the two are joined here and not through a key.
 *
 * ## The loud row and the quiet one, and a badge sized to match
 *
 * Rule 1 asks a screen for one loud thing, and on this screen that thing is an order that is
 * still happening. The badge is what carries it: an active row takes the `pill` size and a
 * finished row the compact one, so the active segment reads as live and the "anteriores" segment
 * reads as an archive before either has been read word by word. Neither size is quieter in
 * *fact* — `./status-badge` renders the word in both, on purpose — so nothing is lost on the
 * past segment, only the volume.
 *
 * ## The estimate, on the row that has one
 *
 * `orderSummarySchema` carries `estimatedReadyAt`, and it is null for exactly the statuses
 * this screen calls past (`estimatedReadyAtOf` returns null for `COMPLETED`, `CANCELLED` and
 * `REJECTED`), so the line below the headline draws itself on the active segment and nowhere
 * else. That is the same value and the same two sentences `app/order/[id].tsx` draws, at
 * `caption` instead of `body` because a row is a summary and the detail page is the page.
 * It is a **readiness** and never an arrival: `order.track.eta` says "llega", the delivery leg
 * has no estimate at all (`estimatedDeliveryAt` is hardcoded null in
 * `apps/api/src/services/mappers.ts`), and a list row inventing an arrival time from a
 * readiness is the exact sentence `packages/i18n/src/messages/es/tracking.ts` was written to
 * prevent. Nothing here counts down.
 *
 * ## Pedir otra vez, and what it does *not* do
 *
 * A finished order gets the one action that is actually possible on it. `orders.reorder`
 * copies the order's lines into the customer's cart server-side and answers with the lines it
 * could not: `reorderResultSchema` is `{ cart, addedCount, skipped }`, and
 * `addedCount + skipped.length` is always the order's line count. The screen shows the
 * skipped ones by name, in the row where the button was pressed, because a reorder that
 * quietly loses an item produces a cart the customer approves without knowing it is short —
 * which is the defect that procedure returns `skipped` to prevent, and hiding the return
 * value would put the defect back on the client.
 *
 * The button is a sibling of the row's `Pressable` and not nested inside it: a control inside
 * a control is a tap that means two things, and RN resolves that by giving the tap to one of
 * them on each platform. The row still opens the order; the button still reorders it.
 *
 * The refusal is the one thing `reorder` answers rather than returns — the shop is not taking
 * orders — and it arrives as a `BAD_REQUEST` whose `serverMessage` **is** the key
 * (`order.reorder.error.businessUnavailable`, from `REORDER_ERROR_KEYS`). `code` and
 * `domainCode` are both the generic "BAD_REQUEST" for it, so `isReorderErrorKey` is what
 * separates it from a schema refusal, and `./error-state`'s `overrides` is where the sentence
 * goes — both halves are `@/components/reorder-outcome`'s, which this row draws. It is *not* a
 * toast: `./toast`'s own docblock refuses errors, and this one needs a sentence and a place in
 * the layout rather than 3.2 seconds at the bottom of the screen.
 *
 * ## Refresh is a gesture on this screen too
 *
 * The poll above keeps the list current without anybody asking, and the pull is the customer
 * asking anyway — `./pull-refresh`, which is where the control's three rules live: the busy flag
 * belongs to the pull and not to `isRefetching` (a poll flips that one, and a spinner appearing
 * under a thumb that did not move is the control taking credit for a request nobody made), both
 * tints are passed because iOS reads one and Android the other, and a screen with no gesture is
 * handed no control at all rather than a dead one.
 */
/** How many orders one page holds, here and on the web app's list of the same procedure. */
const PAGE_SIZE = 20;

/** How often an order that can still change is re-read. */
const POLL_MS = 10_000;

/** The filter's two values, as `Segmented`'s string values. */
type Segment = "active" | "past";

/**
 * The segment a `?segment=` param names, or `null` when it names nothing this screen has.
 *
 * The narrowing is the point of the function rather than a formality: a query string is
 * whatever was typed into it, so `?segment=` can arrive holding `""`, a word from an older
 * version of this screen, or a value somebody wrote by hand — and `setSegment` takes a `Segment`, not
 * a `string`. A wrong value leaves the reader on the segment they were already on, which is the
 * only answer that cannot be wrong.
 *
 * Both literals are written out here rather than read from an array, because `Segment` is the type
 * and this is the function that has to agree with it: if the two ever disagree, the compiler
 * says so at the `setSegment` above.
 */
function segmentOf(value: string | undefined): Segment | null {
	return value === "active" || value === "past" ? value : null;
}

/**
 * The statuses the "anteriores" segment asks for.
 *
 * Derived rather than listed, so a status added to the domain is in this filter or in the
 * active one by construction — a hand-written list would silently stop covering the states a
 * reader would call finished. The web list derives the same array from the same function.
 */
const TERMINAL_STATUSES: OrderStatus[] =
	ORDER_STATUSES.filter(isTerminalStatus);

/*
 * `order.reorder.added` and `order.reorder.skipped.title` were declared here as `as MessageKey`
 * with a docblock saying neither dictionary had them. Both do — `packages/i18n/src/messages/
 * {es,en}/customer.ts` — so the casts were no-ops, and `app/order/[id].tsx` was carrying a
 * second copy of the same two constants for a duplication that bought nothing. The literals are
 * used at their call sites; the skip *reasons* were never cast, because `REORDER_SKIP_REASONS`
 * uses each key as its own literal on the wire.
 */

export default function OrdersScreen() {
	const trpc = useTRPC();
	const { t, tp, intlLocale } = useT();
	const { colors } = useTheme();
	const { status: sessionStatus } = useSession();
	const [segment, setSegment] = useState<Segment>("active");

	/**
	 * A segment a caller asked for, obeyed once and then forgotten.
	 *
	 * The account hub's "Historial de pedidos" row promises the *past* orders, and this screen's
	 * own `useState` opens on "activos" — so the row had nothing to send the reader to and the
	 * promise was one the app could not keep. The param is how it keeps it: the hub pushes
	 * `/orders?segment=past` and the segment moves.
	 *
	 * **It is cleared as soon as it is applied, and that clearing is the whole design.** One
	 * open of this screen keeps its state for the length of the visit. So a
	 * param left in the route would be a mode rather than an instruction — the reader arrives
	 * on "anteriores" from the hub, then reopens orders expecting the live orders and
	 * gets the same past list, with no visible cause, forever. `router.setParams` with
	 * `undefined` removes it, so a later open lands on whatever segment the reader
	 * last chose *here*.
	 *
	 * The effect depends on `askedSegment` alone. `setSegment` and `router` are both stable — a state
	 * setter never changes identity and `router` is expo-router's imperative singleton — so a
	 * dependency list naming them would only re-run this effect on renders that are not a new
	 * instruction, and each run of it is a `setParams`, which is a navigation.
	 *
	 * Nothing is announced here: no haptic, no toast. The reader did not choose this segment;
	 * they chose a row that said "past orders", and the screen arriving already filtered is the
	 * answer they asked for. `pick` keeps the haptic for the taps that *are* a choice.
	 */
	const { segment: askedSegment } = useLocalSearchParams<{
		segment?: string;
	}>();
	useEffect(() => {
		const asked = segmentOf(askedSegment);
		if (asked === null) return;
		setSegment(asked);
		router.setParams({ segment: undefined });
	}, [askedSegment]);

	const signedIn = sessionStatus === "signed-in";

	// See the docblock at the top of the file: the screen-level half of a gate React Query
	// cannot supply, and the effect below is the other half of the same decision.
	const focused = useIsFocused();

	const orders = useInfiniteQuery(
		trpc.orders.list.infiniteQueryOptions(
			{
				role: "CUSTOMER",
				limit: PAGE_SIZE,
				...(segment === "active"
					? { activeOnly: true }
					: { status: TERMINAL_STATUSES }),
			},
			{
				enabled: signedIn,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
				refetchInterval: (q) =>
					focused &&
					(q.state.data?.pages ?? []).some((page) =>
						page.items.some((order) => !isTerminalStatus(order.status)),
					)
						? POLL_MS
						: false,
			},
		),
	);
	const waiting = useSkeletonHold(orders.isPending);

	/**
	 * The second half of the poll's gate: coming back re-reads rather than waiting out a timer.
	 *
	 * See the docblock at the top of the file. The dependency is `orders.refetch` and not
	 * `orders`, because the observer binds that method once in its constructor
	 * (`query-core`, `queryObserver.js`) while the result object is rebuilt on every render —
	 * depending on the result would re-run this effect on renders that are not a re-focus, and
	 * each run is a request.
	 */
	const refetchOrders = orders.refetch;
	const firstFocus = useRef(true);
	useEffect(() => {
		if (!focused) return;
		if (firstFocus.current) {
			// The mount, not a return: the observer's own first fetch is already doing this.
			firstFocus.current = false;
			return;
		}
		void refetchOrders();
	}, [focused, refetchOrders]);

	// Read once, so the guards below narrow on the data itself: the minimum hold keeps the
	// skeletons up for a moment after the answer lands, and `isPending` alone would be false
	// while `data` was still undefined in that window.
	const pages = orders.data?.pages;
	/**
	 * The loaded pages, flattened once per read.
	 *
	 * `flatMap` builds a new array every call, and this screen re-renders on things that are
	 * not the list: a segment tap, a row's own mutation, a toast, the orders button's unread badge
	 * landing. Memoised on `pages` for the reason `app/business.tsx` states at more length — and
	 * with the same limit: it skips the walk, it does not keep rows from re-rendering, because
	 * the `.map()`/`FlatList` that consumes this array rebuilds its children either way.
	 */
	const items = useMemo(
		() => pages?.flatMap((page) => page.items) ?? [],
		[pages],
	);

	const cache = useQueryClient();
	const { show } = useToast();

	/**
	 * Pedir otra vez, and the three shapes of its answer.
	 *
	 * **The haptic is at the tap, not at the answer**, which is the rule
	 * `app/product/[id].tsx` states for the same commit: landing lines in a cart is the
	 * reader's own change, and a phone that answers on the frame of the press is worth more
	 * than one that answers after a round trip. Its visual twin — which `lib/haptics.ts`
	 * requires of every call — is the report under the button: the skip list or the refusal,
	 * which is the half that says what actually happened.
	 *
	 * **The toast is the clean answer only.** `reorderResultSchema` is
	 * `{ cart, addedCount, skipped }` and `addedCount + skipped.length` is always the order's
	 * line count, so `skipped.length === 0` is precisely "nothing was lost". When something
	 * was, the skip block replaces the toast rather than joining it: two surfaces at once, one
	 * reading "agregado" and one reading "no todo", is a screen contradicting itself about one
	 * write. Nothing is toasted on a refusal either — that needs a sentence and a place in the
	 * layout, and `./toast`'s own docblock refuses errors outright.
	 *
	 * **The cart is invalidated** because the write is *to the cart*: a different screen's
	 * query, and a different screen's badge. Without it the cart keeps the count it had before the
	 * tap, which is the one number a customer would check to see whether the tap worked.
	 *
	 * `onBusinessConflict` is left at its default (`"reject"`): the alternative would replace a
	 * cart built at another shop without a word, and a screen that silently empties somebody's
	 * basket to fill its own is worse than a refusal it then has to explain.
	 */
	const reorder = useMutation(
		trpc.orders.reorder.mutationOptions({
			onSuccess: async (result) => {
				await cache.invalidateQueries({ queryKey: trpc.cart.pathKey() });
				if (result.skipped.length === 0) show(t("order.reorder.added"));
			},
		}),
	);

	/**
	 * The switch, and the type it has to narrow to.
	 *
	 * `Segmented` reports the value it was given back, which is a `string` — the group is a
	 * closed set to the reader and an open one to the component, because the same control
	 * filters search results and picks a theme. So the two values this screen knows are
	 * checked here rather than asserted: an assertion would be a promise about a component
	 * whose options are this screen's own, and the check is one line.
	 */
	function pick(next: string) {
		if (next === "active" || next === "past") setSegment(next);
	}

	// The pull. The busy flag is the control's own and not `orders.isRefetching`, because the
	// poll above flips that one — `./pull-refresh` holds the rule, the two tints with it.
	const refreshControl = useRefreshControl(orders.refetch);

	const filter = (
		<View style={styles.filter}>
			<Segmented
				// The group's name for a screen reader — "Pedidos" — rather than either
				// segment's label, which only names one half of the choice.
				label={t("nav.orders")}
				value={segment}
				onChange={pick}
				options={[
					{ value: "active", label: t("order.active") },
					{ value: "past", label: t("order.past") },
				]}
			/>
		</View>
	);

	if (sessionStatus === "loading") {
		return (
			<Screen padded={false}>
				<View style={styles.back}>
					<BackButton to="/" />
				</View>
				{filter}
				<OrdersSkeleton label={t("state.loading")} segment={segment} />
			</Screen>
		);
	}

	if (!signedIn) {
		return (
			<Screen>
				<View style={styles.back}>
					<BackButton to="/" />
				</View>
				<EmptyState
					icon="receipt-outline"
					title={t("order.empty.title")}
					body={t("order.empty.body")}
					actionLabel={t("action.signIn")}
					onAction={() => router.push("/sign-in" as Href)}
				/>
			</Screen>
		);
	}

	return (
		<Screen padded={false}>
			<View style={styles.back}>
				<BackButton to="/" />
			</View>
			{filter}

			{orders.isError ? (
				<ErrorState
					error={orders.error}
					onRetry={() => void orders.refetch()}
				/>
			) : waiting || !pages ? (
				<OrdersSkeleton label={t("state.loading")} segment={segment} />
			) : (
				<FlatList
					data={items}
					keyExtractor={(order) => order.id}
					contentContainerStyle={styles.list}
					// The bar owns its own bottom inset; paying it again opens a gap.
					scrollIndicatorInsets={{ bottom: 0 }}
					// From `./pull-refresh`, both tints and its own flag — see that file.
					refreshControl={refreshControl}
					// `./list-end` rather than a button that vanishes: the end of the list
					// states that it ended, which is the one thing a disappearing "load
					// more" could not say — an empty footer and a failed next page look
					// identical. Its `rows === 0` guard is what keeps that statement off an
					// empty list: at zero rows the `ListEmptyComponent` below is the whole
					// answer, and "nothing more to show" underneath it would answer a
					// question the customer had not asked twice.
					ListFooterComponent={
						<ListEnd
							rows={items.length}
							hasNextPage={orders.hasNextPage}
							loading={orders.isFetchingNextPage}
							onPress={() => void orders.fetchNextPage()}
							// Gutter and gap cancelled, because this list already pays both:
							// `styles.list` insets every child, and its `gap` is what spaces
							// two of them. The foot's own `paddingBottom` is left alone — that
							// one nothing else pays. Placement is what this prop is for.
							style={styles.listEnd}
						/>
					}
					ListEmptyComponent={
						// The filter's own empty state, not the signed-out one: "Todavía no
						// tienes pedidos" under a segment called "En curso" is false for
						// somebody with thirty finished orders. What it offers is the same
						// thing either way — somewhere to go and order.
						<EmptyState
							icon="receipt-outline"
							title={t(
								segment === "active"
									? "tracking.empty.active.title"
									: "tracking.empty.past.title",
							)}
							body={t(
								segment === "active"
									? "tracking.empty.active.body"
									: "tracking.empty.past.body",
							)}
							actionLabel={t("cart.empty.action")}
							onAction={() => router.replace("/" as Href)}
						/>
					}
					renderItem={({ item, index }) => {
						const terminal = isTerminalStatus(item.status);
						// Non-null for exactly the statuses `terminal` is false for, so the
						// estimate line is the active segment's by construction rather than by a
						// second condition that could disagree with the first.
						const ready = item.estimatedReadyAt;
						// Whether this row is the one that asked. `variables` is the request in
						// flight and `data` is the answer to the last one that landed, so the
						// spinner and the report both belong to a row rather than to the screen:
						// a list-wide "something is loading" on a page of twenty orders is a
						// customer looking at the wrong one.
						const mine = reorder.variables?.orderId === item.id;
						return (
							// The stagger is the list saying "these arrived together"; past the sixth
							// row `AnimateIn` stops spacing them out, which is the right answer for a
							// page of twenty.
							//
							// `reorder` because this screen is filtered on the status the poll above is
							// watching: an order that reaches a terminal one leaves it, and every row
							// below the one that left is the same row at a new index. The cell is keyed
							// by `order.id`, so an order that is genuinely new still mounts its own
							// `AnimateIn` and still enters; only the rows that closed a gap stay put.
							<AnimateIn index={index} reorder>
								<View style={styles.cell}>
									<Pressable
										onPress={() =>
											router.push({
												pathname: "/order/[id]",
												params: { id: item.id },
											})
										}
										// A row's edges are the screen's, so it moves by less than a button
										// does; the primitive still owns the press — the dim, the spring and
										// Android's ripple are one decision, made once.
										scaleTo={PRESS_SCALE_ROW}
										accessibilityRole="button"
										accessibilityLabel={`${t("order.number", { code: item.reference })}, ${t(statusKey(item.status))}`}
										style={[
											styles.row,
											{
												backgroundColor: colors.card,
												borderColor: colors.border,
											},
										]}
									>
										<View style={styles.rowBody}>
											<View style={styles.rowHead}>
												<Text variant="label" tone="muted" tabular>
													{t("order.number", { code: item.reference })}
												</Text>
												<StatusBadge
													status={item.status}
													size={terminal ? "dot" : "pill"}
												/>
											</View>

											{/*
											 * No `numberOfLines`, and there was one. The row's height is
											 * its content's — the column has a `gap` and no fixed measure —
											 * so a one-line cap bought nothing at 100% and cost the whole
											 * headline at 200%: `docs/design-mobile.md` asks for text that
											 * grows, and truncation is the way a list quietly refuses it.
											 * The headline is a summary ("2× Café chorreado y 1 más",
											 * `headlineOf` in `apps/api/src/services/mappers.ts`), so
											 * wrapping at a large scale is a two-line row and not a wall.
											 */}
											<Text variant="body" bold>
												{item.headline}
											</Text>

											{ready ? (
												/*
												 * The readiness, in the sentence its own day calls for —
												 * the same two keys and the same comparison
												 * `app/order/[id].tsx` makes, at `caption` because a row
												 * is a summary. The estimate is the loud segment's second
												 * signal: an active order says *when*, which is the
												 * question a customer opens this screen to answer.
												 */
												<Text variant="caption" tone="muted">
													{t(
														sameDay(ready, item.placedAt)
															? "tracking.estimate.ready.sameDay"
															: "tracking.estimate.ready.otherDay",
														{
															time: formatClock(ready, intlLocale),
															date: formatDay(ready, intlLocale),
														},
													)}
												</Text>
											) : null}

											<View style={styles.rowFoot}>
												<Text variant="caption" tone="muted">
													{formatStamp(item.placedAt, intlLocale)}
												</Text>
												<Price
													amountMinor={item.totalMinor}
													currency={item.currency}
													variant="body"
												/>
											</View>

											<Text variant="caption" tone="muted" tabular>
												{tp("order.itemCount", item.itemCount)}
											</Text>
										</View>

										{/* Decoration: the row's own label names the order and opens it. See
										    the note at the top of this file for why the label carries the status. */}
										<Ionicons
											name="chevron-forward"
											size={icon.control}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									</Pressable>

									{terminal ? (
										/* A sibling of the row rather than a child of it: a control
										   inside a control is one tap meaning two things, and the
										   platform decides which of them wins. `secondary` because a
										   past row is quiet — the loud thing on this screen is the
										   order that is still happening, and a filled button on
										   every finished row would take that away from it. */
										<Button
											label={t("order.reorder")}
											variant="secondary"
											size="sm"
											style={styles.reorder}
											loading={reorder.isPending && mine}
											onPress={() => {
												// At the tap, not at the answer — the rule
												// `app/product/[id].tsx` states for the same kind of
												// write. The answer arrives below the button either way.
												light();
												reorder.mutate({ orderId: item.id });
											}}
										/>
									) : null}

									{/* Grouped by a heading and by proximity rather than by a second
									    surface: this block sits in a cell that already holds the
									    order's own card, and one bordered box inside another reads
									    as part of the card rather than as the answer to the button
									    between them. The block draws its own lines and gap; the cell
									    is what says where it lands. */}
									{terminal && mine ? (
										<ReorderOutcome
											result={reorder.data}
											error={reorder.error}
										/>
									) : null}
								</View>
							</AnimateIn>
						);
					}}
					/**
					 * Seven viewports, where `FlatList` would use twenty-one.
					 *
					 * This list has the same shape as the shared one —
					 * `components/paginated-list.tsx`, which passes the same value for the same
					 * reason, stated there at length: twenty orders a page, each row
					 * content-height, and `windowSize` defaults to twenty-one viewports of
					 * window, which is more content than this list ever holds. So nothing is
					 * recycled and every mounted row keeps its `AnimateIn` shared value and its
					 * press spring live. Seven bounds it to about a screen plus three either
					 * side, which is a window the list actually reaches. The one visible
					 * difference is the one `./animate-in` documents as intended: a row that
					 * leaves the window and comes back enters again.
					 *
					 * `removeClippedSubviews` is deliberately not added with it — RN leaves it
					 * off on Android (`ReactScrollView.java`), and a window this size does not
					 * need it.
					 */
					windowSize={7}
				/>
			)}
		</Screen>
	);
}

/**
 * Two timestamps on the same calendar day, for the estimate's sentence.
 *
 * Local, because the day a customer means is the day their own clock is showing — the same
 * reason `lib/format.ts` formats through `Intl` rather than through UTC arithmetic. Used
 * between two values the API stored (`estimatedReadyAt` and `placedAt`) and never against
 * `Date.now()`: which sentence a customer reads must not depend on when they opened the screen.
 * `app/order/[id].tsx` makes the same comparison with the same name for the same two fields,
 * and the two are separate copies rather than one shared helper because this lane owns both
 * files and neither is a module a third screen may import; a shared `lib/` file would have been
 * a new file outside the five this lane owns.
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
 * The list, while the list is coming.
 *
 * Four rows, drawn out of the row's own pieces at the row's own measure, so the data's arrival
 * moves nothing. Four because that is what fits above the fold on a phone — more blocks than
 * the reader can see is drawing rows that only exist to be scrolled past.
 *
 * It used to be four blocks at a fixed `space.huge * 3 + space.lg` (112) tall, which matched
 * the row it stood in for and then stopped matching it: a row is four lines on the active segment,
 * five once the estimate line is drawn, and one control taller on the past segment — and none of
 * those is a constant, because every one of them is text, and text grows with the reader's
 * font scale. So the skeleton is *composed* instead: the same `styles.row` container, the same
 * `styles.rowBody` column, one block per line at `type[variant].lineHeight * fontScale`. That
 * last number is `components/skeletons.tsx`'s rule and the reason the heights are computed
 * inside the component rather than written into the style sheet — a module cannot read a font
 * scale, and a skeleton frozen at 100% metrics is eight points short of a real row at 200%.
 *
 * It takes the segment because the segment is what the row's *shape* depends on: "anteriores" draws the
 * reorder control and "en curso" draws the estimate line, so a skeleton that drew neither would
 * be standing in for the wrong row for as long as the wait lasts. The badge takes its height
 * from `./status-badge`'s own measure rather than from a number written here, so the two sizes
 * cannot drift apart.
 */
function OrdersSkeleton({
	label,
	segment,
}: {
	label: string;
	segment: Segment;
}) {
	const { fontScale } = useWindowDimensions();

	return (
		<View
			style={styles.skeletonList}
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
		>
			{SKELETON_ROWS.map((row) => (
				<OrderRowSkeleton key={row} segment={segment} fontScale={fontScale} />
			))}
		</View>
	);
}

function OrderRowSkeleton({
	segment,
	fontScale,
}: {
	segment: Segment;
	fontScale: number;
}) {
	const { colors } = useTheme();
	const terminal = segment === "past";
	// A line of real text, at the height the variant it stands in for draws it.
	const line = (variant: keyof typeof type) => ({
		height: Math.round(type[variant].lineHeight * fontScale),
	});

	return (
		<View style={styles.cell}>
			<View
				style={[
					styles.row,
					{ backgroundColor: colors.card, borderColor: colors.border },
				]}
				// The group is the accessible element and it says "Cargando" once; the leaves are
				// decorative, which is why none of them is given a `label`.
				accessible={false}
			>
				<View style={styles.rowBody}>
					<View style={styles.rowHead}>
						<Skeleton style={[styles.skeletonNumber, line("label")]} />
						<Skeleton
							style={{
								width: SKELETON_BADGE_WIDTH,
								height: statusBadgeHeight(terminal ? "dot" : "pill", fontScale),
							}}
							radiusToken="full"
						/>
					</View>
					<Skeleton style={[styles.skeletonHeadline, line("body")]} />
					{terminal ? null : (
						<Skeleton style={[styles.skeletonShort, line("caption")]} />
					)}
					<View style={styles.rowFoot}>
						<Skeleton style={[styles.skeletonShort, line("caption")]} />
						<Skeleton style={[styles.skeletonPrice, line("body")]} />
					</View>
					<Skeleton style={[styles.skeletonShort, line("caption")]} />
				</View>
				{/* The chevron is deliberately not drawn: a grey square where a glyph goes is worse
				    than a row body a few points wider, and nothing moves vertically either way. */}
			</View>
			{terminal ? <Skeleton style={styles.skeletonButton} /> : null}
		</View>
	);
}

/**
 * The blocks the skeleton draws, named rather than counted.
 *
 * Four is what fits above the fold on a phone; more would be drawing rows the reader cannot
 * see. The values are the block's identity for React's key, which is why they are a list of
 * numbers instead of a count passed to `Array.from` — a key that is an array index says
 * "this is the third one", and these blocks are not in an order that can change.
 */
const SKELETON_ROWS = [0, 1, 2, 3] as const;

/**
 * The badge's stand-in width, and it is a stand-in rather than a layout value — the same
 * species as `components/skeletons.tsx`'s 96-point chip. A badge is as wide as its status word
 * plus its own padding, and the word is the one thing a skeleton does not know; a block sized
 * to the average keeps the row's line from looking short without pretending to know which
 * status is coming.
 */
const SKELETON_BADGE_WIDTH = space.huge * 2;

const styles = StyleSheet.create({
	// The way back, drawn here because the stack header stays off: pushed
	// screens each draw their own, and this one is a pushed screen. No top
	// padding — the safe-area inset is the top air, paid by `Screen` on every
	// screen, so a back strip is the gutter and, when it wants one, a step
	// below. Every back strip in the app draws the same way.
	back: { paddingHorizontal: space.lg, paddingBottom: space.sm },
	// The filter's own measure, because the screen is `padded={false}`: its rows run
	// edge-to-edge and a filter cannot.
	filter: {
		paddingHorizontal: space.lg,
		paddingBottom: space.md,
	},
	list: {
		paddingHorizontal: space.lg,
		paddingBottom: space.huge,
		gap: space.md,
	},
	// `./list-end` pays `space.lg` of gutter and `space.md` above itself, and the list above
	// pays both for every child it lays out — so the foot's two are cancelled here and only
	// its bottom is kept.
	listEnd: { marginHorizontal: -space.lg, marginTop: -space.md },
	// The skeleton column keeps the list's own measure — its padding and its
	// gap — and nothing else. It must NOT take `flex: 1`: this screen's body
	// is auto-height, and a flex child of an indefinite parent collapses to
	// its padding while its children paint on anyway, so the four rows land
	// on top of each other. The settled list is a FlatList, which sizes its
	// own scroll content; the skeleton is plain Views, which do not.
	skeletonList: {
		paddingHorizontal: space.lg,
		paddingBottom: space.huge,
		gap: space.md,
	},
	// One row's cell: the card, and whatever the status puts under it. The gap is what keeps a
	// button or a report from reading as part of the card it is answering.
	cell: { gap: space.sm },
	// A quiet control under a finished row: as wide as its word, not as wide as the card. It is
	// still `MIN_TOUCH_TARGET` tall — `./button` owns that floor and nothing here overrides it.
	reorder: { alignSelf: "flex-start" },
	// Stand-in widths for the row's lines. Layout values, not copy: the first line holds the
	// number and the badge, the second the headline, the third a price at the row's right edge.
	skeletonNumber: { width: "30%" },
	skeletonHeadline: { width: "72%" },
	skeletonShort: { width: "44%" },
	skeletonPrice: { width: "26%" },
	// The reorder control's own floor, so the past segment's skeleton is exactly as tall as the past
	// segment's row. `./button`'s smallest size is `MIN_TOUCH_TARGET` tall with a narrower padding.
	skeletonButton: { width: space.huge * 3, height: MIN_TOUCH_TARGET },
	// A surface at `radius.md` — the step `docs/design.md` reserves for cards and rows, and
	// the one `./list-row` uses for the same reason. The chevron sits at the row's right edge,
	// centred, which is the shape a row that opens something has everywhere else in the app.
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		borderRadius: radius.md,
		borderWidth: 1,
		padding: space.lg,
	},
	// The row's lines are one text stack — number and badge, headline, caption, price line —
	// so they sit at the gap a row body carries everywhere else: `TEXT_STACK_GAP`, the gap
	// `./list-row` puts between a title and its subtitle and the cart's and receipt's item
	// bodies pay. The skeleton shares this style, so its waiting rows keep the same stack
	// without a second copy.
	rowBody: { flex: 1, gap: TEXT_STACK_GAP },
	rowHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	rowFoot: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
});
