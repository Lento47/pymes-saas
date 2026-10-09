import type { Notification } from "@pymeshub/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { PaginatedList } from "@/components/paginated-list";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, TEXT_STACK_GAP, type } from "@/theme";

/**
 * What the shop has told you: the bell, as a list.
 *
 * `notifications.list` is the only read here, and it is the reader's own feed —
 * `users.listNotifications` scopes it to `ctx.user.id` and drops the one kind the API
 * writes for itself, so the screen cannot see the idempotency ledger behind `orders.place`
 * (`INTERNAL_NOTIFICATION_KINDS` in `packages/trpc-api/src/services/users.ts`, which holds a
 * single entry — this file used to say *two* and cite a `reviews.reply` ledger that the
 * constant has not listed for some time). That filter is the service's, not this screen's: a
 * client that had to exclude the internal kinds would be a client that could forget to,
 * which is the whole reason it lives behind the API.
 *
 * ## The title and the body are the API's words, not the dictionary's
 *
 * A notification carries its own `title` and `body` — written when the order moved, when a
 * shop answered a review, or when a business invited this courier to its pool
 * (`packages/trpc-api/src/services/couriers.ts`'s `invite`) — and this screen draws them
 * verbatim. That is the one exception to "nothing in this app hardcodes its own language",
 * and it is the exception `packages/shared/src/schemas/notification.ts` already argues for:
 * the row is a *record of something that happened*, and the sentence about it is part of the
 * record. So `@pymeshub/i18n`'s `inbox.*` names this screen and its empty state and holds
 * **no content keys at all** — there is nothing here a locale could change.
 *
 * ## Pressable only where there is somewhere to go
 *
 * `data` is what a client deep-links on, and `./destinationOf` is the one place that decides
 * whether there is an address. `chevron`, `onPress` and `accessibilityHint` all read its
 * answer rather than each re-deriving it from the ids, so a row cannot end up with a
 * chevron and no handler. The kinds that reach this screen, and where they go:
 *
 * - an offer sends `{ type: "DELIVERY_OFFERED", deliveryId, orderId }` and opens
 *   `/delivery/[id]`, where the run can be accepted and worked
 * - an invitation sends `{ type: "COURIER_INVITED", inviteId, businessId }` and opens
 *   `/courier-invites`, the screen that carries the accept and decline
 * - an order event sends `{ orderId, type }` and opens `/order/[id]`
 * - a reply to a review sends `{ reviewId, businessId }` — **no slug**, and the storefront
 *   route is `/store/[slug]`, so there is no address to build
 *
 * The last kind is therefore not a `Pressable` at all: no `onPress`, no chevron, and no
 * `accessibilityHint` — `ListRow` draws a plain `View` with `accessibilityRole="text"` when
 * it is given neither handler (`list-row.tsx:163`). A row that looks like a door and opens
 * nothing is worse than a row that is plainly a sentence, and inventing a route from a
 * `businessId` would mean a lookup this screen has no reason to make.
 *
 * ## There is no unread dot, and its absence is a finding
 *
 * `notificationSchema` has a `readAt`, this screen could read it, and nothing in this app
 * ever writes it to anything but `null` — `grep readAt apps/api/src` returns four writes
 * and all four are `readAt: null` on insert, including the `onConflictDoUpdate` that
 * deliberately *resets* it so a corrected reply reads as new (`reviews.ts:349`). A mark-read
 * mutation does not exist. So an "unread" badge here would be a mark that no reader could
 * ever clear, on every row, forever: a state the screen claims and the API cannot change.
 * That is the defect this file's sibling argues against in as many words — a control for
 * something the API has not confirmed — one step further along, because a permanent badge
 * is not a control that does nothing, it is a statement that stays false.
 *
 * When `notifications.markRead` lands, the dot, its colour and its label come back together,
 * and the count belongs on the account hub's row rather than here: this screen has the page
 * in hand, and the hub is where a reader looks to find out whether anything is waiting.
 */
export default function Inbox() {
	const trpc = useTRPC();
	const { t } = useT();
	const { status: sessionStatus } = useSession();

	const signedIn = sessionStatus === "signed-in";
	const notices = useInfiniteQuery(
		trpc.notifications.list.infiniteQueryOptions(
			{ limit: PAGE_SIZE },
			{
				getNextPageParam: (last) => last.nextCursor ?? undefined,
				enabled: signedIn,
			},
		),
	);

	const waiting = useSkeletonHold(
		sessionStatus === "loading" || (signedIn && notices.isPending),
	);

	const items = useMemo(
		() => notices.data?.pages.flatMap((page) => page.items) ?? [],
		[notices.data],
	);

	// Nothing is drawn under the skeleton or under a failure. `waiting` holds the skeleton up
	// past the arrival of the answer on purpose, so a row appearing in that window would be
	// the skeleton and the content disagreeing about what is on screen — the rule every
	// paginated screen in this app follows, and the reason `paginated-list` takes `data`
	// rather than a row count.
	const shown = waiting || notices.isError ? [] : items;

	return (
		// `contentStyle` gives the body the height `./paginated-list`'s `flex: 1` grows into.
		<Screen padded={false} bottomInset contentStyle={styles.fill}>
			<PaginatedList
				data={shown}
				keyExtractor={(notice) => notice.id}
				renderItem={(notice, index) => (
					<Notice notification={notice} index={index} />
				)}
				header={
					<View style={styles.header}>
						<View style={styles.pad}>
							<BackButton to="/account" />
						</View>

						<View style={styles.pad}>
							<Text variant="title" bold>
								{t("inbox.title")}
							</Text>
						</View>

						{!signedIn ? (
							<View style={styles.pad}>
								<EmptyState
									icon="person-outline"
									title={t("auth.signIn.title")}
									body={t("auth.signIn.subtitle")}
									actionLabel={t("action.signIn")}
									onAction={() => router.push("/sign-in")}
								/>
							</View>
						) : notices.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={notices.error}
									onRetry={() => void notices.refetch()}
								/>
							</View>
						) : waiting ? (
							<InboxSkeleton loadingLabel={t("state.loading")} />
						) : items.length === 0 ? (
							<View style={styles.pad}>
								<EmptyState
									icon="notifications-outline"
									title={t("inbox.empty.title")}
									body={t("inbox.empty.body")}
								/>
							</View>
						) : null}
					</View>
				}
				hasNextPage={notices.hasNextPage}
				loadingMore={notices.isFetchingNextPage}
				onLoadMore={() => void notices.fetchNextPage()}
				// Only a signed-in reader has a notification query to refresh. The pull's own
				// busy flag lives inside `./paginated-list`, independent of query refetches.
				onRefresh={signedIn ? () => notices.refetch() : undefined}
			/>
		</Screen>
	);
}

/**
 * One notice.
 *
 * The time goes in `ListRow`'s `state` slot rather than in a line of its own, and it is the
 * slot's own definition: "a word stating a fact about this row", drawn beside the title in
 * `caption`. It is also the only place in the row where a *when* can sit without becoming a
 * sentence, which matters here because the row already has one — the body.
 *
 * **`formatRelative` returning `null` means the line is absent, not blank.** That is the
 * function's own contract (`lib/format.ts:248`) and the one fault it names: `state={when}` at
 * `string | null` would be `undefined` at `null` only if the two were the same thing, and they
 * are not — so the coercion is done here, once, rather than left to a reader to notice.
 *
 * The spoken label is composed rather than left to `ListRow`'s default. That default is
 * `title, state` (`list-row.tsx:107`) and it drops the **body**, which is the actual news: a
 * screen reader would hear "Tu pedido salió, hace 5 min" and never the sentence saying what
 * happened. The three parts are joined with a middot, the same separator `app/featured` uses
 * for the same reason.
 */
function Notice({
	notification,
	index,
}: {
	notification: Notification;
	index: number;
}) {
	const { t, intlLocale } = useT();

	const when = formatRelative(notification.createdAt, intlLocale);
	// **One derivation, read by all three of the row's affordances.** `chevron`, `onPress`
	// and `accessibilityHint` each used to re-ask the same question and could disagree — the
	// exact failure a row that looks like a door and opens nothing is. There is one predicate
	// now, and the row is pressable exactly when it is not `null`.
	const where = destinationOf(notification.data);

	const spoken = [notification.title, notification.body, when]
		.filter(
			(part): part is string => typeof part === "string" && part.length > 0,
		)
		.join(" · ");

	return (
		<AnimateIn index={index}>
			<ListRow
				title={notification.title}
				// `body` is `notNull` in the schema and the two ledger kinds that carry an empty
				// one are filtered out before this screen sees them — but a body that is blank
				// is still a line that would draw as a gap, so it is dropped rather than drawn.
				subtitle={notification.body.length > 0 ? notification.body : undefined}
				state={when ?? undefined}
				// The rows are separated by `./paginated-list`'s own gap and share no line.
				divider={false}
				chevron={where !== null}
				accessibilityLabel={spoken}
				onPress={where === null ? undefined : () => router.push(where)}
				accessibilityHint={where === null ? undefined : t("inbox.row.help")}
			/>
		</AnimateIn>
	);
}

/**
 * Where a notification points, or `null` when it points nowhere.
 *
 * **One function rather than three predicates.** `chevron`, `onPress` and
 * `accessibilityHint` each asked whether there was somewhere to go, from their own copy of
 * the ids, and adding a third kind meant editing all three — which is how a row ends up with
 * a chevron and no handler. The row is pressable exactly when this returns an address.
 *
 * **`data` is `Record<string, unknown> | null` on the wire** — the schema keeps it loose on
 * purpose so a client that receives an unknown `kind` still renders the title and body it was
 * given rather than failing to parse — so each field is narrowed rather than trusted. A
 * number, an object or an empty string all mean the same thing here: no address, so the row
 * is a sentence.
 *
 * **The order of the three cases is the order of how much a tap can do.** An offer opens the
 * run itself; an invitation opens the list the invitation is on; an order opens the order.
 *
 * - `{ type: "DELIVERY_OFFERED", deliveryId, orderId }` — the delivery half wins, because it
 *   is the one a courier can act on. `/delivery/[id]` is where the run is accepted and worked.
 * - `{ type: "COURIER_INVITED", inviteId, businessId }` — `/courier-invites`, which is a
 *   screen with the accept and decline controls on it. The row arrived because a business
 *   invited this courier (`services/couriers.ts`'s `invite`), and a row that announces an
 *   invitation and opens nothing is the plainest version of a door that is not one.
 * - `{ orderId, type }` — `/order/[id]`.
 *
 * A reply to a review sends `{ reviewId, businessId }` with **no slug**, and the storefront
 * route is `/store/[slug]`, so there is no address to build and the row is deliberately not a
 * `Pressable`: no `onPress`, no chevron, no `accessibilityHint` — `ListRow` draws a plain
 * `View` when given neither handler (`list-row.tsx:163`). Inventing a route from a
 * `businessId` would mean a lookup this screen has no reason to make.
 */
function destinationOf(data: Record<string, unknown> | null): Href | null {
	const text = (value: unknown): string | null =>
		typeof value === "string" && value.length > 0 ? value : null;

	if (data?.type === "COURIER_INVITED") return "/courier-invites" as Href;

	const deliveryId = text(data?.deliveryId);
	if (deliveryId !== null) {
		return {
			pathname: "/delivery/[id]",
			params: { id: deliveryId },
		} as Href;
	}

	const orderId = text(data?.orderId);
	if (orderId !== null) {
		return { pathname: "/order/[id]", params: { id: orderId } } as Href;
	}

	return null;
}

/**
 * The inbox in grey, at the sizes the real rows will be.
 *
 * Two lines per row because a real row draws two: the title — with the time in the state slot
 * *beside* it, the way `./list-row` draws `state`, not a third stacked line under them — and
 * the body, which wraps, so the grey line is drawn wide. The row keeps `./list-row`'s own
 * `space.md` padding and `MIN_TOUCH_TARGET` floor, which is the *least* the row can be, not
 * its height.
 *
 * The heights are composed with the reader's font scale, because a skeleton frozen at 100%
 * metrics is eight points short of a real row at 200% (`docs/design-mobile.md`, Waiting) —
 * the same composition `app/orders`' skeleton uses.
 *
 * The first row carries the loading label and the rest are decorative, which is the same
 * arithmetic `AccountSkeleton` does and for the same reason: `Skeleton`'s `label` is what a
 * screen reader announces, and six identical announcements are a worse waiting state than one.
 */
function InboxSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();
	// A line of real text, at the height the variant it stands in for draws it.
	const line = (variant: keyof typeof type) => ({
		height: Math.round(type[variant].lineHeight * fontScale),
	});

	return (
		<View style={styles.skeleton}>
			{SKELETON_ROWS.map((key, index) => (
				// The real row's shape: the time beside the title in the state slot. Not every
				// row carries one — `formatRelative` answers `null` when it has no sentence —
				// so the block is drawn on alternating rows rather than all six.
				<View key={key} style={styles.skeletonRow}>
					<View style={styles.skeletonLines}>
						<View style={styles.skeletonTitleRow}>
							<Skeleton
								label={index === 0 ? loadingLabel : undefined}
								style={[styles.skeletonTitle, line("body")]}
							/>
							{index % 2 === 0 ? (
								<Skeleton style={[styles.skeletonState, line("caption")]} />
							) : null}
						</View>
						<Skeleton style={[styles.skeletonBody, line("label")]} />
					</View>
				</View>
			))}
		</View>
	);
}

/** Six rows fill a phone at this height, and the seventh would be under the fold. */
const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"] as const;

/**
 * Twenty, which is `notifications.list`'s own default (`apps/api/src/routers/notifications.ts`).
 * Named here rather than left implicit so the page and the cursor come from one number, which
 * is what every other paginated screen in this app does.
 */
const PAGE_SIZE = 20;

const styles = StyleSheet.create({
	pad: { paddingHorizontal: space.lg },
	// The body's height, which `./paginated-list`'s `flex: 1` needs. See that file.
	fill: { flex: 1 },
	// The back button, the heading and whichever of the error, skeleton or empty block is
	// standing in for the rows are one column, with the gap the scroll would have paid between
	// them. The gutter, the gap down to the first row and the foot are `./paginated-list`'s.
	header: { gap: space.lg },
	skeleton: { paddingHorizontal: space.lg, gap: space.md },
	// One row, at the shape `./list-row` draws: the row's own `space.md` padding and
	// `MIN_TOUCH_TARGET` floor, and a body that is one text stack at `TEXT_STACK_GAP`.
	skeletonRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.md,
	},
	skeletonLines: { flex: 1, gap: TEXT_STACK_GAP },
	// The title and the time share one line, the way `./list-row`'s `titleRow` does.
	skeletonTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	skeletonTitle: { width: "55%" },
	skeletonState: { width: "20%" },
	// The body wraps, so the grey line is drawn wide — the real body is the row's long half.
	skeletonBody: { width: "90%" },
});
