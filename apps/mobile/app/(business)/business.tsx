import Ionicons from "@expo/vector-icons/Ionicons";
import { type MessageKey, MOVE_LABELS } from "@pymeshub/i18n";
import type {
	FulfilmentKind,
	MembershipSummary,
	MerchantLocation,
	OrderStatus,
	OrderSummary,
} from "@pymeshub/shared";
import { formatMoney } from "@pymeshub/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Image } from "@/components/image";
import { ListEnd } from "@/components/list-end";
import { MerchantLocationPicker } from "@/components/merchant-location-picker";
import {
	MerchantOrderRow,
	type MerchantRowAction,
	ROW_MIN_HEIGHT,
} from "@/components/merchant-order-row";
import { MerchantRejectSheet } from "@/components/merchant-reject-sheet";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { statusKey } from "@/components/status-badge";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { toApiFailure } from "@/lib/api-error";
import { light, selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { PRESS_SCALE_ROW } from "@/lib/motion";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * The board: the orders tab of the console, and the one surface in the tree that moves
 * orders.
 *
 * The home (`./index.tsx`) is the day at a glance — the pulse, the first three rows, the
 * rail — and its docblock states the division this file is the other half of: **the writes
 * stay on the board**. Its preview rows carry no actions and its "view all" is the door
 * here; this screen owns the actions, and it also owns shop switching, because a second
 * switcher on the home would be a second truth about which shop is on screen.
 *
 * ## The stages
 *
 * The read is one paginated queue, but the operator's question changes with the hour, so
 * the queue is drawn as the state machine's stages (`STAGES` below): the orders that need
 * an answer, the ones being made, the ones waiting to leave. Each stage is a §16 section —
 * a 44-point rail, the stage's name in bold uppercase `mutedForeground`, its count beside
 * it — and a stage with nothing in it draws nothing at all, because an empty section is a
 * header for a fact that is not there. The stages are drawn in the dictionary's own order
 * and the API's states are bucketed, never re-labelled: an `OUT_FOR_DELIVERY` order is in
 * the ready stage because it is past the counter, not because the screen renamed it.
 *
 * interface.md draws the board's columns for a wide pane and says nothing about a phone;
 * architecture.md §42's hierarchy says the same thing a phone needs: the queue reads top
 * to bottom, attention first. Stacked stages are that queue — the new orders are at the
 * top of the screen and the ready ones below them, which is the board's order read
 * vertically instead of across, and the same `./merchant-order-row` a home preview row
 * shows carries the moves here.
 *
 * ## What this screen preserves
 *
 * The read and write path the board has always owned: the paginated read with its
 * five-second poll, the advance mutation with `expectedStatus` as the optimistic-concurrency
 * guard, the scoped invalidation to `trpc.orders.pathKey()` (an advance moves order rows
 * and only order rows), the conflict path that re-reads *before* it announces, the two
 * haptics that belong to the write and to nothing else, both `ErrorState` overrides
 * (`CONFLICT` with the refreshed status filled in, `FORBIDDEN` with the sentence an
 * operator can act on), the skeleton holds that keep every waiting shape in position,
 * `AnimateIn`'s staggered entrance, and `ListEnd` as the paginated tail.
 *
 * The wait line under each row counts what the clock keeps: the poll brings the data
 * and the minute ticker (`MINUTE_TICK_MS` below) re-draws the lines, so a poll whose
 * payload came back unchanged — which is what a poll usually is, and which notifies a
 * react-query component nothing, since the properties this screen watches have not moved —
 * still moves the minutes. And the decline reason the customer is told has its surface
 * here — the state machine has
 * always allowed a business to reject, and `orders.advance` has always taken the `reason`
 * the customer receives; the question lives in the sheet below.
 */
export default function Business() {
	return (
		<SignedIn>
			<Board />
		</SignedIn>
	);
}

/**
 * How many orders one page of the board holds.
 *
 * The same 20 the customer's list reads against this same procedure
 * (`app/(customer)/orders.tsx`), and deliberately not the web board's 50
 * (`apps/web/components/business/order-board.tsx`): `orders.list` takes `limit` 1–50 and
 * answers with `nextCursor`, so both are legal and the difference is a layout decision — a
 * desktop shows three times the rows before it scrolls, and this is a page a thumb scrolls.
 */
const PAGE_SIZE = 20;

/**
 * How long the board waits before re-reading itself.
 *
 * Five seconds because this is a work queue and not a list: another phone in the same
 * kitchen moving an order is the ordinary case, and the operator is standing in front of the
 * card that is about to be refused. The customer's own list polls at half that (`POLL_MS`)
 * and only while something in it is unfinished, which is the same judgement from the other
 * side of the counter.
 *
 * ## Why the poll has no focus gate, when the customer's list has one
 *
 * Because on this screen the gate's cost is paid for nothing it buys. The customer's list
 * gates with `useIsFocused` because a `Tabs` screen stays mounted for the session and
 * mounted-and-not-on-top is its ordinary state; this screen is in exactly that tree, so the
 * honest description of its poll is "it runs while the menu or the delivery tab is on top".
 * What a gate would save is real — `refetchInterval` on an **infinite** query re-reads every
 * page that has been loaded, so a board paged through three times is three requests every
 * five seconds — and it was left ungated on purpose in a rebuild that preserves the reads:
 * the gate would be a behaviour change, and the poll's own mitigation is unchanged. Every
 * write invalidates on success and on conflict, so the card under the operator's thumb is
 * correct at the moment they tap it rather than at the next tick, and the fresh rows the
 * poll feeds the queue are the reason those minutes are worth keeping at all.
 */
const BOARD_POLL_MS = 5000;

/**
 * The minute an order stops being "waiting" and starts being "waiting too long".
 *
 * The web board's queue draws the same line at the same 15 minutes
 * (`apps/web/components/business/order-card.tsx`), and the two boards are the same surface
 * in a browser and in an app — one threshold or two answers waiting to disagree. The words
 * on either side of it are the dictionary's (`biz.board.waitingFor`,
 * `biz.board.waitingTooLong`), not this file's.
 */
const LONG_WAIT_MINUTES = 15;

/**
 * How often the board's own clock advances.
 *
 * One minute, because the wait lines are printed in whole minutes: anything faster
 * re-renders the queue to change nothing visible, anything slower lets an order sit past
 * the "late" rail without the rail moving. This is the half the poll does not buy — a poll
 * whose payload is unchanged does not notify a component that is not watching it fetch, so
 * `BOARD_POLL_MS` keeps the data fresh and this keeps the lines fresh.
 */
const MINUTE_TICK_MS = 60_000;

/**
 * The open/closed dot in the identity band, at the size §64 draws it.
 *
 * 8 points, and its own constant rather than `STATUS_DOT_SIZE` because that 7 is
 * `./business-card` and `./hours-table`'s — the storefront's dot, beside a status word the
 * owner's screen does not draw. Same shape, different surface, different number, each named
 * where it is used rather than borrowed across a boundary neither file owns.
 */
const OPEN_DOT_SIZE = 8;

/**
 * The logo's box in the identity band, at the size §64 draws it.
 *
 * A number of its own rather than a `media` step because `theme/tokens.ts`'s media boxes are
 * list and card furniture, and this is a wordmark-sized square beside a title — the mock's
 * own measure, named where it is used.
 */
const IDENTITY_LOGO_SIZE = 44;

/**
 * The board's stages, and the states of the machine each one holds.
 *
 * Three sections, in the order the operator reads the shift: the orders that need an
 * answer, the ones being made, the ones waiting to leave. The names are the dictionary's
 * (`biz.board.column.*`), and the buckets are the state machine's, never the screen's —
 * an `OUT_FOR_DELIVERY` order sits in the ready stage because it is past the counter and
 * on its way to a handover, which is where the operator looks for it, and `COMPLETED` and
 * its siblings are not on this screen at all (`activeOnly`). The dictionary also keeps
 * `biz.board.column.done` for the web board's fourth column; a phone's `activeOnly` read
 * has nothing to put under it.
 */
const STAGES: ReadonlyArray<{
	key: MessageKey;
	statuses: readonly OrderStatus[];
}> = [
	{ key: "biz.board.column.new", statuses: ["PENDING"] },
	{ key: "biz.board.column.preparing", statuses: ["ACCEPTED", "PREPARING"] },
	{
		key: "biz.board.column.ready",
		statuses: ["READY", "OUT_FOR_DELIVERY"],
	},
	{
		key: "biz.board.column.done",
		statuses: ["COMPLETED", "CANCELLED", "REJECTED"],
	},
];

type BoardFilter = "active" | "new" | "preparing" | "ready" | "done";

const BOARD_FILTERS = [
	{ id: "active", label: "order.active" },
	{ id: "new", label: "biz.board.column.new" },
	{ id: "preparing", label: "biz.board.column.preparing" },
	{ id: "ready", label: "biz.board.column.ready" },
	{ id: "done", label: "biz.board.column.done" },
] as const satisfies ReadonlyArray<{
	id: BoardFilter;
	label: MessageKey;
}>;

const BOARD_FILTER_QUERY = {
	active: { activeOnly: true },
	new: { activeOnly: true, status: ["PENDING"] as const },
	preparing: {
		activeOnly: true,
		status: ["ACCEPTED", "PREPARING"] as const,
	},
	ready: {
		activeOnly: true,
		status: ["READY", "OUT_FOR_DELIVERY"] as const,
	},
	done: {
		activeOnly: false,
		status: ["COMPLETED", "CANCELLED", "REJECTED"] as const,
	},
} satisfies Record<
	BoardFilter,
	{ activeOnly: boolean; status?: readonly OrderStatus[] }
>;

/**
 * The board: the reads it owns, the write that moves its rows, and the stages they draw.
 *
 * The reads are hoisted here rather than left inside a per-shop component, because the
 * pull-to-refresh has to be able to re-ask all of them at once — the same shape
 * `app/(business)/index.tsx` refreshes with its `Promise.all` — and because the bands are
 * one composition, not a stack of self-contained panels.
 */
function Board() {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();
	const toast = useToast();
	const scope = useMerchantScope();

	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopsWaiting = useSkeletonHold(shops.isPending);
	const shopsData = shops.data;
	/**
	 * The shops the board can be about: the non-courier memberships, the same rule
	 * `app/(business)/index.tsx` reads the home's shop by. The membership read also
	 * carries courier entries — an owner who delivers for someone else has one — and a
	 * courier org has no orders to move: the board's reads answer it with 403s, and its
	 * chip would be a door to a room that does not exist. The default is the first shop,
	 * and a courier entry never wins the default by arriving first.
	 */
	const shopList = useMemo(
		() => (shopsData ?? []).filter((one) => one.role !== "COURIER"),
		[shopsData],
	);
	const active =
		shopList.find((shop) => shop.businessId === scope.businessId) ??
		shopList[0] ??
		undefined;
	const businessId = active?.businessId;
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId: businessId ?? "" },
			{ enabled: !!businessId, refetchInterval: BOARD_POLL_MS },
		),
	);
	const selectedLocation =
		locations.data?.find((location) => location.id === scope.locationId) ??
		locations.data?.find((location) => location.isDefault) ??
		locations.data?.[0];
	const locationId = selectedLocation?.id;

	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId: businessId ?? "" },
			{ enabled: !!businessId },
		),
	);
	const [filter, setFilter] = useState<BoardFilter>("active");
	const filterQuery = BOARD_FILTER_QUERY[filter];

	const board = useInfiniteQuery(
		trpc.orders.list.infiniteQueryOptions(
			{
				businessId: businessId ?? "",
				locationId,
				role: "BUSINESS",
				activeOnly: filterQuery.activeOnly,
				...("status" in filterQuery ? { status: [...filterQuery.status] } : {}),
				limit: PAGE_SIZE,
			},
			{
				enabled: !!businessId && !!locationId,
				refetchInterval: BOARD_POLL_MS,
				// The API answers `nextCursor: null` for "nothing after this page" and
				// react-query wants `undefined` — the one translation between the two. Read the
				// same way on the customer's list, against the same procedure.
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);

	const move = useMutation(
		trpc.orders.advance.mutationOptions({
			onSuccess: async (_data, variables) => {
				// The commit landed: the order is in its next state and the customer has been
				// told. `light` rather than `success`: `success` is the order-placed haptic, the
				// peak of the one order the customer is holding, and a board move is a mid-shift
				// commit the operator makes dozens of a shift — the same weight as the other
				// in-shift commits, and never a second fanfare for the receipt already given.
				light();
				// A successful move is a state change the ear can verify: the row's own word for
				// the state it just entered, said the way the arrival is said — through `./toast`,
				// which owns the platform split. The failure path is already announced by
				// `ErrorState`'s own live region; silence on success is the one asymmetry the
				// reader cannot reconcile ("did my tap land?"). The status is the one this tap
				// asked for, and `expectedStatus` made the API refuse the tap if the row had
				// moved first — so the word is the truth about the row, not a guess.
				toast.show(
					t("biz.board.movedTo", { status: t(statusKey(variables.to)) }),
				);
				// The procedure's own key root, and nothing wider. An advance moves order rows
				// and only order rows, so `orders.*` is every cache it could have made wrong —
				// the board below, the order's detail screen if it is in the stack, and the
				// customer's list on a phone signed in as both. Keyless, this call was
				// `invalidateQueries()` with no argument, which marks the **whole** client stale
				// and refetches every mounted query: the shop's settings, the tab badge, the
				// customer's own orders, the cart, the admin metrics. On a board that moves
				// orders all day that is a fan-out of requests per tap, for data the tap cannot
				// have changed. `app/order/[id]` and `app/checkout` already scope the same
				// call to the same key (`lib/trpc/context.ts` says why).
				await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
			},
			onError: async (error) => {
				// Refused, and the board did not move. Without this the only sign is a
				// sentence somewhere above the row, on a phone being held at arm's length.
				warning();
				// A conflict is the one refusal whose *cause* is on this screen: another phone
				// moved the order first, so the card in front of the operator is out of date and
				// every button on it is about to be refused as well. Re-reading before the
				// sentence is drawn is what keeps the sentence true — without it the card keeps
				// its old status and its live buttons for up to the five-second poll, and the
				// next tap is refused by the same conflict it is still explaining. The web
				// board does exactly this, in exactly this case, and says why:
				// `apps/web/components/business/use-order-actions.ts` refetches before it
				// announces, "because the announcement says the board is up to date, so it has
				// to already be true when it renders". Same read as the poll, now rather than
				// in five seconds; no extra request, and nothing new is fetched.
				if (toApiFailure(error).code === "CONFLICT")
					await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
			},
		}),
	);

	/**
	 * The board's orders, flattened once per read of the board — the same idiom as the
	 * customer-facing rails that flatten a paginated read: `flatMap` over `pages` on the
	 * identity react-query keeps, so it recomputes when the board is re-read and not once
	 * in between. It buys the walk and only the walk; it is not a defence against
	 * re-rendering the rows, which this render's `.map()` rebuilds every pass regardless.
	 */
	const orders = useMemo(
		() => board.data?.pages.flatMap((page) => page.items) ?? [],
		[board.data],
	);

	/**
	 * The arrival, said once: a poll that lands a new order tells the operator.
	 *
	 * The web board announces the same arrival
	 * (`apps/web/components/business/order-board.tsx` toasts `biz.board.newOrder` with this
	 * same body key), and the phone says it through `./toast`, which owns the platform split
	 * (Android's live region, iOS the explicit announce) — the screen hands it the sentence
	 * and announces nothing itself. The set of ids already counted is the guard: seeded by
	 * the first read of each shop, because a shop switch replaces the whole queue and every
	 * row on it would otherwise read as an arrival, and unchanged by a poll that landed
	 * nothing, which re-runs this effect over the same ids and says nothing.
	 */
	const arrivals = useRef<Set<string> | null>(null);
	const arrivalsScope = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (board.isPending) return;
		const seen = arrivals.current;
		const currentScope = `${businessId}:${locationId}:${filter}`;
		if (seen === null || arrivalsScope.current !== currentScope) {
			arrivalsScope.current = currentScope;
			arrivals.current = new Set(orders.map((order) => order.id));
			return;
		}
		const announceArrival = filter === "active" || filter === "new";
		const arrived = announceArrival
			? orders.find(
					(order) => !seen.has(order.id) && order.status === "PENDING",
				)
			: undefined;
		arrivals.current = new Set(orders.map((order) => order.id));
		if (!arrived) return;
		toast.show(
			t("biz.board.newOrder.body", {
				code: arrived.reference,
				total: formatMoney(arrived.totalMinor, arrived.currency, {
					locale: intlLocale,
				}),
			}),
		);
	}, [
		orders,
		board.isPending,
		businessId,
		locationId,
		filter,
		t,
		intlLocale,
		toast,
	]);

	/**
	 * The queue, bucketed into the stages it draws.
	 *
	 * One pass over the flattened queue per read of it — the same identity the flat list
	 * recomputes on — and then each bucket sorted oldest-first: within a stage, the order
	 * that has been waiting the longest is the one the operator answers first, and the
	 * API's own order is the placement order, which reads backwards on a queue. No stage
	 * is invented: a state the buckets do not name simply has no section on this screen.
	 */
	const staged = useMemo(
		() =>
			STAGES.map((stage) => ({
				key: stage.key,
				orders: orders
					.filter((order) => stage.statuses.includes(order.status))
					.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime()),
			})),
		[orders],
	);
	const movingId = move.isPending ? move.variables?.orderId : undefined;
	const boardWaiting = useSkeletonHold(locations.isPending || board.isPending);

	/**
	 * What the conflicted order's status is *now*, in words, for the refusal's sentence.
	 *
	 * Read from the refreshed board and not from the tap: the sentence says another phone
	 * moved this order first, so the word it prints has to be the one the refreshed card
	 * behind it is showing — and the invalidate that runs before this renders is what
	 * makes that true rather than a sentence about a card the operator can no longer
	 * see. `undefined` when the order has left the board, which a move to COMPLETED does
	 * by definition (`activeOnly`).
	 */
	const conflictStatus = orders.find(
		(order) => order.id === move.variables?.orderId,
	)?.status;

	/**
	 * The shop the reject sheet is open for, and nothing else — the sheet's own reason
	 * state lives inside it and resets when the order leaves.
	 */
	const [rejecting, setRejecting] = useState<OrderSummary | null>(null);

	/**
	 * The clock the wait lines and the "late" rail are read against: a state, ticked by
	 * the minute. The poll keeps the *data* fresh, but a poll whose payload is unchanged
	 * notifies nothing — react-query only tells a component about the properties it reads,
	 * and this one reads `isPending`/`data`/`isError`, never `isFetching` — so a ticker of
	 * the screen's own is what moves the minutes between real changes. One minute because
	 * that is the granularity the lines print at, and one timer for the screen rather than
	 * one per row because every row reads the same "now".
	 */
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const tick = setInterval(() => setNow(Date.now()), MINUTE_TICK_MS);
		return () => clearInterval(tick);
	}, []);

	const actionsFor = (order: OrderSummary): MerchantRowAction[] => {
		// CANCELLED and REJECTED are moves the machine allows a business to make and this
		// board does not offer as buttons: one is a call-off that belongs beside the
		// customer's phone number, the other needs a reason the customer is told. The
		// rejection keeps its row — as the quiet word that opens the reason sheet, where
		// the reason is chosen and the customer is told — but it is no longer a bare
		// button pretending no question exists.
		const moves = order.nextStatuses.filter(
			(to) => to !== "CANCELLED" && to !== "REJECTED",
		);
		const actions: MerchantRowAction[] = moves.map((to, index) => ({
			label: t(moveLabelKey(to, order.fulfilment)),
			onPress: () =>
				move.mutate({ orderId: order.id, to, expectedStatus: order.status }),
			// The row is mid-write: its own controls wait for the answer. Other rows are
			// untouched. The primitive dims a pending control instead of spinning it, which
			// is why the old per-button `loading`/`movingTo` pair is gone — the row goes
			// inert, and the dim is what says "working".
			pending: movingId === order.id,
			kind: index === 0 ? "primary" : "secondary",
		}));
		// A PENDING order is the one state whose refusal is a sentence the customer is
		// told, so its second move is the quiet word that opens the reason sheet.
		if (order.status === "PENDING") {
			actions.push({
				label: t("biz.board.reject"),
				onPress: () => setRejecting(order),
				pending: movingId === order.id,
				kind: "quiet",
			});
		}
		return actions;
	};

	const refresh = async () => {
		// The jobs are typed as promises of their own results rather than inferred from
		// the first one: inferred, the array is the membership read's promise and the
		// settings push after it is a type error for no reason worth a line.
		const jobs: Array<Promise<unknown>> = [shops.refetch()];
		if (businessId)
			jobs.push(settings.refetch(), locations.refetch(), board.refetch());
		await Promise.all(jobs);
	};

	return (
		<>
			<Screen
				padded={false}
				scroll
				bottomInset
				onRefresh={() => void refresh()}
			>
				{shops.isError ? (
					<ErrorState
						error={shops.error}
						onRetry={() => void shops.refetch()}
					/>
				) : shopsWaiting || !shopsData ? (
					<BoardSkeleton label={t("state.loading")} />
				) : shopList.length === 0 ? (
					<EmptyState
						icon="storefront-outline"
						title={t("biz.onboarding.title")}
						body={t("biz.onboarding.notLive")}
						actionLabel={t("biz.onboarding.create")}
						onAction={() => router.push("/new-business")}
					/>
				) : !active ? // Unreachable after the guard above, and rendered rather than asserted:
				// `shopsData[0]` is `undefined` to `tsc` under `noUncheckedIndexedAccess`,
				// and reading `businessId` off it is not worth a cast.
				null : (
					<>
						{/* 1 — Identity. The name is the settings read's while that read is
						    live and the membership's while it is on the way, so the arrival of
						    the settings moves the name only when the name itself changed. */}
						<View style={styles.identity}>
							<View style={styles.identityRow}>
								<Image
									uri={settings.data?.logoUrl ?? active.logoUrl}
									style={styles.logo}
									radiusToken="full"
								/>
								<View style={styles.identityText}>
									<Text variant="title" bold numberOfLines={1}>
										{settings.data?.name ?? active.businessName}
									</Text>
									{selectedLocation ? (
										<StatusLine location={selectedLocation} />
									) : null}
									{settings.data?.status === "SUSPENDED" ? (
										// The paragraph the dot cannot carry: a suspended shop's
										// owner reads "Cerrado ahora" and cannot tell why nobody
										// is ordering, and the dictionary has the sentence that
										// explains it to the person it happened to.
										<Text variant="caption" tone="muted">
											{t("biz.settings.suspended")}
										</Text>
									) : null}
								</View>
							</View>
							<ShopChips
								shops={shopList}
								activeId={active.businessId}
								onPick={scope.selectBusiness}
							/>
							{selectedLocation ? (
								<MerchantLocationPicker
									locations={locations.data ?? []}
									selectedId={locationId}
									onPick={(nextLocationId) =>
										scope.selectLocation(active.businessId, nextLocationId)
									}
								/>
							) : locations.isPending ? (
								<Skeleton style={styles.skeletonStatus} />
							) : null}
							<BoardFilters value={filter} onChange={setFilter} />
						</View>

						{/* The settings read's own failure, between the identity and the rows
						    it feeds: the header above still names the shop from the membership,
						    and the queue below is a different read that may well have landed. */}
						{settings.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={settings.error}
									onRetry={() => void settings.refetch()}
								/>
							</View>
						) : null}

						{/* The refusal, above the rows: the row that failed can be fifty rows
						    down, and a refusal nobody scrolls to is a refusal that was not
						    said. `CONFLICT` here means one thing only — another phone moved
						    this order first (`expectedStatus`) — so the screen says that
						    instead of the generic "something went wrong", which would blame the
						    API for a colleague's tap.

						    The heading is the write's own sentence rather than
						    `state.error.title`: nothing was being loaded, and the operator has
						    just pressed a button, so the one thing they need told is that the
						    tap did not take effect. `biz.board.moveFailed` says exactly that
						    and leaves the *why* to the sentence under it, which is the API's.

						    The conflict sentence is the one override that carries a parameter.
						    Its copy is "Ya está en {status}…", the status comes from the
						    refreshed board (`conflictStatus` above), and `lib/api-error.ts`
						    threads both into `t()`. When the order is no longer on the board —
						    it moved to COMPLETED, which `activeOnly` filters out — there is no
						    status to name, so the override is the title, which is a sentence
						    about the same fact with nothing to fill in.

						    `FORBIDDEN` is the other code with a sentence of its own, and it is
						    here because a move refused for want of a capability is not a
						    mistake of ours: the operator has to ask somebody. The web board
						    answers the same refusal with the same two keys
						    (`apps/web/components/business/use-order-actions.ts`). Its body is a
						    sentence with no parameters, so unlike the conflict's it needs none.

						    The dismiss control is beside the block rather than inside it,
						    because `ErrorState` is one element to a screen reader and a control
						    nested in it is a control nobody can reach — the same reason
						    `app/addresses.tsx` puts delete beside its row. It calls
						    `move.reset()` and nothing else: resetting on the refetch would erase
						    the sentence the moment the board caught up, and the sentence stays
						    true after that (it happened), so the reader is the one who decides
						    when they have read it. */}
						{move.error ? (
							<View style={styles.pad}>
								<View style={styles.banner}>
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
										style={styles.bannerBody}
									/>
									{/* The `hitSlop` is `hitSlopFor`'s own answer for a control
									    that is already `MIN_TOUCH_TARGET` across — which is what
									    `./pressable`'s base style lays this out at — so it adds
									    no margin for a tap to land outside the row and steal a
									    press from the block beside it. */}
									<Pressable
										onPress={() => move.reset()}
										accessibilityRole="button"
										accessibilityLabel={t("action.close")}
										hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
										style={styles.bannerClose}
									>
										<Ionicons
											name="close"
											size={icon.control}
											color={colors.mutedForeground}
											// Decoration: the pressable around it carries the word.
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									</Pressable>
								</View>
							</View>
						) : null}

						{/* The orders themselves, full-bleed: the hairlines run the screen's
						    width and the row's own ink is inset by the air the row pays
						    (`./merchant-order-row`), so the queue reads as one ruled surface
						    and not as a column of padded cards. */}
						{locations.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={locations.error}
									onRetry={() => void locations.refetch()}
								/>
							</View>
						) : board.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={board.error}
									onRetry={() => void board.refetch()}
								/>
							</View>
						) : boardWaiting || !board.data ? (
							<OrdersSkeleton label={t("state.loading")} />
						) : orders.length === 0 ? (
							// The empty queue's band, quiet on `background`: no card, no icon, no
							// action, because there is nothing to act on — a queue with nothing
							// in it is a *good* state, and §64's answer to a good state is
							// quieter type, not a framed block. The words are the pair the web
							// board draws this same state with (`biz.board.empty`), not this
							// screen's own second answer to the same fact.
							<View style={styles.quietBand}>
								<Text variant="heading" bold>
									{t("biz.board.empty")}
								</Text>
								<Text variant="label" tone="muted">
									{t("biz.board.empty.body")}
								</Text>
							</View>
						) : (
							<>
								{staged.map((stage) => {
									// An empty stage draws nothing at all — a header for a stage
									// with nothing in it is a section for a fact that is not
									// there, and the stages above and below it say what is.
									if (stage.orders.length === 0) return null;
									return (
										<View key={stage.key}>
											{/* §16's section, with the stage's count beside its name:
											    the count is the queue's own length — a fact the read
											    returned, not a sum invented for emphasis. */}
											<SectionHeader
												title={t("biz.board.section", {
													title: t(stage.key),
													count: stage.orders.length,
												})}
											/>
											{stage.orders.map((order, index) => {
												// The wait line and the rail are read against the one
												// clock the render pass captured (`now`, above) — never
												// a timer per row: the ticker advances the clock and the
												// poll brings the data, so the minutes are at most one
												// minute stale.
												const minutes = Math.max(
													0,
													Math.floor((now - order.placedAt.getTime()) / 60_000),
												);
												const waitLabel =
													minutes >= LONG_WAIT_MINUTES
														? t("biz.board.waitingTooLong", { minutes })
														: t("biz.board.waitingFor", { minutes });
												const readinessMinutes =
													order.estimatedReadyAt === null
														? null
														: Math.floor(
																(now - order.estimatedReadyAt.getTime()) /
																	60_000,
															);
												const critical =
													order.status !== "COMPLETED" &&
													order.status !== "CANCELLED" &&
													order.status !== "REJECTED" &&
													((order.status === "PENDING" &&
														minutes >= LONG_WAIT_MINUTES) ||
														(readinessMinutes !== null &&
															readinessMinutes >= LONG_WAIT_MINUTES));
												const urgent = critical
													? "critical"
													: order.status === "PENDING"
														? "new"
														: readinessMinutes !== null && readinessMinutes >= 0
															? "late"
															: null;
												return (
													// `reorder` because this board is the thing that
													// changes: it is read with `activeOnly` and re-read
													// every five seconds, and a move takes an order off
													// it — "Marcar entregado" reaches COMPLETED, which is
													// no longer active, so that row leaves and the rows
													// still in its stage close the gap on the layout
													// spring instead of re-entering. The key is the
													// order's own id, so an order that is genuinely new
													// still mounts its own `AnimateIn` and still enters.
													<AnimateIn key={order.id} index={index} reorder>
														<MerchantOrderRow
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
															statusLabel={
																order.status === "PENDING"
																	? t("biz.board.newOrder")
																	: t(statusKey(order.status))
															}
															totalLabel={formatMoney(
																order.totalMinor,
																order.currency,
																{
																	locale: intlLocale,
																},
															)}
															waitLabel={waitLabel}
															urgent={urgent}
															helpLabel={t("action.view")}
															actions={actionsFor(order)}
															last={index === stage.orders.length - 1}
														/>
													</AnimateIn>
												);
											})}
										</View>
									);
								})}

								{/* The board's tail. This read is paginated like the customer's
								    list is — `orders.list` answers `nextCursor` and 20 rows at a
								    time — so an owner whose fifty-first active order is the one
								    that needs moving has to be able to reach it, and the poll that
								    keeps the top of the board fresh says nothing about the rows
								    past the fold.

								    A plain row after the rows and not an `ActionBar`: the bar is
								    pinned to the floor of a screen whose subject is the shop, and
								    it holds the action the screen is *for* — a permanent "load
								    more" there would be a button for a condition that stops being
								    true after one tap. `./list-end` is what six lists already end
								    through, and a footer choosing its own weight is how "Ver más"
								    and "Cargar más" start drifting apart again. */}
								<ListEnd
									rows={orders.length}
									hasNextPage={board.hasNextPage}
									loading={board.isFetchingNextPage}
									onPress={() => void board.fetchNextPage()}
								/>
							</>
						)}
					</>
				)}
			</Screen>

			{/* Mounted as a sibling of the scroll, which is what `./sheet` needs — it has
			    no portal, and inside a scroll view its absolute fill would resolve against
			    the wrong parent (`app/addresses.tsx` documents the same arrangement). It
			    stays mounted closed so its exit plays, and the order it is open for is the
			    whole of its state. */}
			<MerchantRejectSheet
				open={rejecting !== null}
				busy={move.isPending}
				onClose={() => setRejecting(null)}
				onReason={(reason) => {
					if (!rejecting) return;
					move.mutate({
						orderId: rejecting.id,
						to: "REJECTED",
						expectedStatus: rejecting.status,
						// Free text the customer is sent: the translated phrase a reason row
						// names, or the words the operator typed. The dictionary's own
						// sentence says so — `biz.board.reject.help`.
						reason,
					});
					setRejecting(null);
				}}
			/>
		</>
	);
}

/** The selected branch's city and live status, joined as one accessible sentence. */
function StatusLine({
	location,
}: {
	location: MerchantLocation;
}): React.ReactElement {
	const { t } = useT();
	const { colors } = useTheme();
	const status = t(`biz.locations.status.${location.status}`);
	const spoken = [location.name, location.city, status]
		.filter(Boolean)
		.join(", ");

	return (
		<View
			style={styles.statusLine}
			accessible
			accessibilityRole="text"
			accessibilityLabel={spoken}
		>
			{location.city ? (
				<Text variant="caption" tone="muted">
					{location.city}
				</Text>
			) : null}
			<View style={styles.openState}>
				<View
					style={[
						styles.openDot,
						{
							backgroundColor:
								location.status === "open"
									? colors.success
									: colors.mutedForeground,
						},
					]}
				/>
				<Text variant="caption" tone="muted">
					{status}
				</Text>
			</View>
		</View>
	);
}

/**
 * The shops, as a row of chips under the identity.
 *
 * A chip rather than a menu because there are rarely more than three and the choice
 * changes what the whole screen below is about — which is also why it fires `selection()`,
 * the haptic for a tab settling on a value, and only when the tap actually changes the
 * value: re-tapping the shop already on screen commits nothing and is not answered. The
 * selected chip's lime is §6's one filled control *of this band*, and the claim stops at
 * the band: the board's rows carry their own lime — `./merchant-order-row` fills the
 * forward move, because a move is the moment's action and a chip is only a selection — so
 * the screen's lime is spent where the work is, once per row and once per band. Within the
 * band the fill is also why no checkmark is drawn: on the storefront chips the checkmark
 * was the second marker because the fill was `card`; here the fill **is** the marker, the
 * same argument `./merchant-command-rail` makes for its one filled action, and the chip
 * announces `selected` regardless.
 */
function ShopChips({
	shops,
	activeId,
	onPick,
}: {
	shops: MembershipSummary[];
	activeId: string;
	onPick: (businessId: string) => void;
}) {
	const { colors } = useTheme();
	return (
		<View style={styles.chips} accessibilityRole="tablist">
			{shops.map((shop, index) => {
				const chosen = shop.businessId === activeId;
				return (
					// `reorder` because the shops are the account's rather than this phone's: a
					// membership can be added or withdrawn while the board is open, and the chips
					// after the one that changed are the same chips at new indices. The key is
					// the `businessId`, so a shop that really is new still mounts its own
					// `AnimateIn` and still enters.
					<AnimateIn key={shop.businessId} index={index} reorder>
						<Pressable
							onPress={() => {
								if (chosen) return;
								selection();
								onPick(shop.businessId);
							}}
							accessibilityRole="tab"
							accessibilityState={{ selected: chosen }}
							// A row's edges are the screen's, so it moves by less than a button
							// does; the primitive still owns the press — the dim, the spring and
							// Android's ripple are one decision, made once.
							scaleTo={PRESS_SCALE_ROW}
							style={[
								styles.chip,
								{
									backgroundColor: chosen ? colors.primary : colors.muted,
								},
							]}
						>
							<Text variant="label" bold tone={chosen ? "inverse" : "muted"}>
								{shop.businessName}
							</Text>
						</Pressable>
					</AnimateIn>
				);
			})}
		</View>
	);
}

function BoardFilters({
	value,
	onChange,
}: {
	value: BoardFilter;
	onChange: (filter: BoardFilter) => void;
}): React.ReactElement {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<View style={styles.chips} accessibilityRole="tablist">
			{BOARD_FILTERS.map((filter) => {
				const chosen = filter.id === value;
				return (
					<Pressable
						key={filter.id}
						onPress={() => {
							if (chosen) return;
							selection();
							onChange(filter.id);
						}}
						accessibilityRole="tab"
						accessibilityState={{ selected: chosen }}
						scaleTo={PRESS_SCALE_ROW}
						style={[
							styles.chip,
							{
								backgroundColor: chosen ? colors.muted : colors.background,
								borderWidth: 1,
								borderColor: colors.border,
							},
						]}
					>
						<Text variant="label" bold tone={chosen ? "default" : "muted"}>
							{t(filter.label)}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

/**
 * The section header, per interface.md §16: a 44-point rail with the bands' own air, the
 * section's name at 13 points bold and uppercase in `mutedForeground`, and no trailing
 * action. It is written here rather than taken from `./section-header` because §16's stage
 * rail is a quieter band than what that primitive draws — a 17-point title and a
 * right-hand "view all" slot this screen has nothing to put in. The shared primitive is
 * still the console's answer where a section is titled rather than a rail: the home and
 * analytics tabs of this same tree take it, so the fork is this screen's alone.
 */
function SectionHeader({ title }: { title: string }): React.ReactElement {
	const { colors } = useTheme();

	return (
		<View style={styles.section}>
			<Text
				variant="label"
				bold
				style={[styles.sectionTitle, { color: colors.mutedForeground }]}
			>
				{title}
			</Text>
		</View>
	);
}

/**
 * The word on a move button.
 *
 * The dictionary's rule for `biz.board.*` is that a move button is a **verb naming what
 * will happen** ("Marcar listo"), never a synonym for the status it moves the order to.
 * This screen used to draw the status noun, which asked the reader to translate
 * "En preparación" into "start preparing" while holding a customer's order.
 *
 * The table this reads is `MOVE_LABELS`, and it is not here: it lives in `@pymeshub/i18n`,
 * for the reason `weekdayName` does — the shop's board is the same surface in a browser and
 * in an app, so it is one table or it is two answers waiting to disagree.
 *
 * What stays on this screen is the half that is not a word: `COMPLETED` is "retirado" on a
 * pickup and "entregado" on a delivery, so the fulfilment picks between two keys before the
 * table is read.
 */
function moveLabelKey(to: OrderStatus, fulfilment: FulfilmentKind): MessageKey {
	// The one status whose verb depends on the fulfilment: a pickup is collected at the
	// counter, a delivery is handed over at a door.
	if (to === "COMPLETED")
		return fulfilment === "PICKUP"
			? "biz.board.markPickedUp"
			: "biz.board.markDelivered";
	return MOVE_LABELS[to];
}
/**
 * The board, before any read has answered: the identity's own lines, a section rail, and
 * two queue rows.
 *
 * One announcement for the whole block rather than one per band — a screen reader told
 * "Cargando…" four times is being told nothing four times — and the shape is the loaded
 * screen's shape, so the data's arrival moves nothing. The line heights are
 * `./skeletons`' `line()` at the reader's `fontScale`, the same source every skeleton in
 * the app measures its text with.
 */
function BoardSkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
			<View style={styles.identity}>
				<View style={styles.identityRow}>
					<Skeleton style={styles.logo} radiusToken="full" />
					<View style={styles.identityText}>
						<Skeleton style={[styles.skeletonName, line("title", fontScale)]} />
						<Skeleton
							style={[styles.skeletonStatus, line("caption", fontScale)]}
						/>
					</View>
				</View>
				<View style={styles.chips}>
					{SKELETON_CHIPS.map((chip) => (
						<Skeleton
							key={chip}
							// A chip's height at its own padding, floor included: the chips are
							// laid out normally, so at 200% text the real row grows and these
							// grow with it.
							style={[
								styles.skeletonChip,
								{
									height: Math.max(
										MIN_TOUCH_TARGET,
										space.md * 2 + line("label", fontScale).height,
									),
								},
							]}
						/>
					))}
				</View>
			</View>
			<View style={styles.section}>
				<Skeleton style={[styles.skeletonSection, line("label", fontScale)]} />
			</View>
			{SKELETON_ORDERS.map((row) => (
				<Skeleton
					key={row}
					// One dense queue row, at the row's own floor, scaled with the text.
					style={{ minHeight: ROW_MIN_HEIGHT * fontScale }}
				/>
			))}
		</View>
	);
}

/**
 * The queue's rows, while the list is coming: two rows, at the row's own floor, full-bleed
 * like the rows they stand in for. The identity band above it has already drawn its own
 * lines, so this skeleton speaks for itself rather than for the screen — it is the shape a
 * shop switch lands in, where everything else is already loaded and only the rows are
 * coming.
 */
function OrdersSkeleton({ label }: { label: string }): React.ReactElement {
	const { fontScale } = useWindowDimensions();

	return (
		<View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
			{SKELETON_ORDERS.map((row) => (
				<Skeleton
					key={row}
					// One dense queue row, at the row's own floor, scaled with the text.
					style={{ minHeight: ROW_MIN_HEIGHT * fontScale }}
				/>
			))}
		</View>
	);
}

/**
 * The blocks the skeletons draw, named rather than counted.
 *
 * The values are each block's identity for React's key, which is why they are a list
 * instead of a count handed to `Array.from` — a key that is an array index says "this is
 * the third one", and these blocks are not in an order that can change.
 */
const SKELETON_CHIPS = [0, 1, 2] as const;
const SKELETON_ORDERS = [0, 1] as const;

const styles = StyleSheet.create({
	/**
	 * The bands' shared gutter, and it is the tree's own `space.lg` — the same step
	 * `app/(business)/products.tsx`'s `pad` and `./screen`'s default pay — so the
	 * board's bands sit in the rhythm the other owner screens keep. Only the
	 * screen-local bands pay it.
	 */
	pad: { paddingHorizontal: space.lg },
	/** The identity band: the bands' air on every side but the rows' side. */
	identity: {
		paddingHorizontal: space.lg,
		paddingTop: space.xl,
		paddingBottom: space.lg,
		gap: space.md,
	},
	identityRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
	},
	/** The logo's box, at the identity's own size and its full-corner radius. */
	logo: {
		width: IDENTITY_LOGO_SIZE,
		height: IDENTITY_LOGO_SIZE,
	},
	// The name and the status line beneath it are one text stack — the title and the
	// line scanned as part of the same thing — so the gap inside it is
	// `TEXT_STACK_GAP`, not a `space` step (`theme/tokens.ts`).
	identityText: {
		flex: 1,
		gap: TEXT_STACK_GAP,
	},
	/** One width for every skeleton chip, and the height is set at the call site. */
	skeletonName: { width: "55%" },
	skeletonStatus: { width: "40%" },
	/** The chip row, and one chip: the floor and the word's own padding, grown normally. */
	chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	chip: {
		// A floor, not a height: at 200% the label wraps and the chip grows with it.
		minHeight: MIN_TOUCH_TARGET,
		paddingHorizontal: space.md,
		paddingVertical: space.xs,
		justifyContent: "center",
		borderRadius: radius.sm,
	},
	skeletonChip: { width: space.huge * 3, borderRadius: radius.sm },
	/** The section rail: §16's 44 as a floor, so a wrapped name grows it. */
	section: {
		minHeight: MIN_TOUCH_TARGET,
		paddingHorizontal: space.lg,
		alignItems: "center",
		justifyContent: "center",
	},
	sectionTitle: { textTransform: "uppercase" },
	skeletonSection: { width: "40%" },
	// The empty queue's band: the bands' air, and the vertical step a quiet band keeps.
	// The heading and the sentence under it are one text stack, so the gap inside it is
	// `TEXT_STACK_GAP` rather than a `space` step.
	quietBand: {
		paddingHorizontal: space.lg,
		paddingVertical: space.huge,
		gap: TEXT_STACK_GAP,
	},
	// The refusal and its dismiss control, as one row. `alignItems: "flex-start"` because
	// `ErrorState` is a centred column of text and a control centred against it would sit
	// halfway down a sentence that may wrap to four lines at 200% — a close button beside the
	// first line is the one a thumb reaches.
	banner: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
	// The block takes the row minus the control. It pays its own gutter and measure; this only
	// says how much of the row is its share — the same split `./screen` makes for
	// `contentStyle`, and the reason `ErrorState` grew a `style` prop for placement.
	bannerBody: { flex: 1 },
	// `./pressable`'s base already lays every pressable out at `MIN_TOUCH_TARGET` in both
	// directions, so this is the whole control: no explicit size, which would be a second
	// opinion about the floor the primitive owns.
	bannerClose: { alignItems: "center", justifyContent: "center" },
	/** The open/closed dot: a mark, so a size and not a spacing step. */
	openDot: {
		width: OPEN_DOT_SIZE,
		height: OPEN_DOT_SIZE,
		borderRadius: radius.full,
	},
	/** The status line: one wrapping row of small words, growing at 200% rather than clipping. */
	statusLine: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: space.xs,
	},
	openState: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
});
