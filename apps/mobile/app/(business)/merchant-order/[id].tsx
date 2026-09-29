import Ionicons from "@expo/vector-icons/Ionicons";
import { type MessageKey, MOVE_LABELS } from "@pymeshub/i18n";
import {
	type FulfilmentKind,
	formatMoney,
	isTerminalStatus,
	type OrderStatus,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { MerchantModule } from "@/components/merchant-module";
import { MerchantOrderHero } from "@/components/merchant-order-hero";
import { MerchantRejectSheet } from "@/components/merchant-reject-sheet";
import {
	type OrderNoteEvent,
	OrderTimeline,
} from "@/components/order-timeline";
import { Pressable } from "@/components/pressable";
import { useRefreshControl } from "@/components/pull-refresh";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { statusKey } from "@/components/status-badge";
import { useTabBarClearance } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { toApiFailure } from "@/lib/api-error";
import { formatClock, formatDayMonth, formatRelative } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { PRESS_SCALE, PRESS_SCALE_DIALOG } from "@/lib/motion";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	merchantType,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * One order as the operator reads it: what it is, who it is for, what is owed, and the
 * moves that answer it (interface.md §18–§20). The scoped read runs the board's guarded
 * write — `advance` with `expectedStatus`, and a CONFLICT refetches rather than guessing —
 * so a worker who opened a row and a worker scanning the queue move the same order under
 * the same rules.
 *
 * ## The shape of the page, and why it is modules and not cards
 *
 * A white canvas carrying a small number of large soft surfaces, in the order the design
 * fixes and the order an operator actually reads: **the status, then who it is for, then
 * what is owed, then what happened, then what to do.** Everything below the hero is a
 * `./merchant-module` — `colors.muted`, a 22-to-30 point corner, **no shadow** — because a
 * warm fill on white is already a surface and a lift under it would be a second edge. That
 * is the opposite of `./card.tsx`, which is shadow and hairline, and it is the same decision
 * `./merchant-pulse` already made on its dark band.
 *
 * **One module for the items and one for the totals, never a module each.** An order of eight
 * drawn as eight surfaces reads as eight things to manage; drawn as eight rows it reads as
 * one order with eight lines, which is what it is.
 *
 * ## The status is a hero, and the amount is the loudest thing on it
 *
 * `./merchant-order-hero` is the only dark surface on the screen besides the pulse band, and
 * it carries the state, the money and the freshness in one block. The amount is
 * `merchantType.metric` (34) — the console's own headline step, the same one the dashboard
 * prints today's revenue in — so the largest number on a merchant screen is the size the
 * merchant system already reserves for the largest number.
 *
 * The status *word* is on a lime chip rather than in the page's ink, which is a change from
 * the previous layout where it was a `heading` in `statusForeground`'s colour. The design's
 * rule is that the state and the money are the two loud things; on a dark hero that means the
 * chip and the amount, and the per-status ink has no surface to sit on any more.
 *
 * ## The action moved into the scroll, and that is the clearance fix
 *
 * It used to be a pinned bar above the foot. This screen is also the one place the
 * `(business)` capsule was never reserved for — it brings its own `ScrollView` rather than
 * using `./screen`'s, so `useTabBarClearance` had nothing to read and the two overlays
 * competed for the same ninety points. The action now scrolls with the work, which is also
 * the honest arrangement: the answer to "what now" depends on how far down the operator has
 * read, and a pinned bar claims to know before they have. `CTA_ALLOWANCE` plus
 * `tabClearance` is the foot, and it is derived rather than typed.
 *
 * **A second status and the decline are words, not pills.** `nextStatuses` is two long on an
 * early order and the design's mock shows the one-action case. The first answer is the lime
 * fill; the rest sit under it at body weight, because neither is the answer to "what now" and
 * a screen with two filled controls has none. `./merchant-reject-sheet` is untouched — the
 * decline still asks for a reason, which is a second question and its own.
 *
 * ## The receipt is the customer's receipt
 *
 * Zero money lines are not drawn (no ₡0 discount, tax or tip), item lines lead with a
 * tabular quantity the way the customer's do, and the totals block is the same anatomy —
 * one answer to "what does an order receipt show", on both sides of the counter. What
 * differs is the activity block: the customer gets `./order-timeline`'s rail as reassurance,
 * the operator gets the same rail with `NOTE` events interleaved into it, because a note is
 * work. `./order-timeline`'s merchant variant is what holds both.
 *
 * ## The title waits for its number
 *
 * `biz.order.title` interpolates the reference, so drawing it before the query lands prints
 * "Order #". The title is therefore gated on `detail`, and the chrome is a bare
 * `BackButton` while loading — the same chrome as the customer screen's — so the number
 * arrives with the data it names rather than as a blank to fill in.
 */
export default function MerchantOrderDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { t, tp, intlLocale } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const [rejectOpen, setRejectOpen] = useState(false);
	const order = useQuery(
		trpc.orders.byId.queryOptions(
			{ id: id ?? "" },
			{
				enabled: !!id,
				refetchInterval: (query) =>
					query.state.data && isTerminalStatus(query.state.data.status)
						? false
						: 5_000,
			},
		),
	);
	const waiting = useSkeletonHold(!!id && order.isPending);
	const refreshControl = useRefreshControl(() => order.refetch());
	const move = useMutation(
		trpc.orders.advance.mutationOptions({
			onSuccess: async (_result, variables) => {
				light();
				toast.show(
					t("biz.board.movedTo", { status: t(statusKey(variables.to)) }),
				);
				await Promise.all([
					cache.invalidateQueries({ queryKey: trpc.orders.pathKey() }),
					cache.invalidateQueries({ queryKey: trpc.business.home.pathKey() }),
				]);
			},
			onError: async (error) => {
				warning();
				if (toApiFailure(error).code === "CONFLICT") await order.refetch();
			},
		}),
	);

	const detail = order.data;
	const next =
		detail?.nextStatuses.filter(
			(status) => status !== "CANCELLED" && status !== "REJECTED",
		) ?? [];

	/**
	 * The one forward move, named once.
	 *
	 * `noUncheckedIndexedAccess` makes `next[0]` a `OrderStatus | undefined` and the JSX
	 * below reads it four times — in the press, in the label, in the a11y label and in the
	 * text. Binding it here means the four are about one fact and the narrowing is a single
	 * `? :` rather than four `!` assertions, which is what this repo's biome config
	 * (`noNonNullAssertion`) asks for anyway.
	 */
	const advance = next[0];

	/**
	 * The three hand-offs, and the two rules that decide whether they exist.
	 *
	 * `tel:` wants digits and an optional leading `+`; the API stores a number written for a
	 * human. `app/(customer)/order/[id]` already draws this line and this file is the second
	 * reader of the same rule — `canOpenURL` is asked before `openURL` because the second
	 * **rejects** on a device with no dialer, and a rejection inside a press handler is a tap
	 * that looks like it did nothing. The `.catch` covers the query itself rejecting.
	 *
	 * `customer.phone` is nullable on the payload, so `dialable` is empty for an order placed
	 * without one and both telephone actions are not drawn at all. A button that opens nothing
	 * is worse than no button, and the operator can see the absence and act on it.
	 *
	 * No haptic: `lib/haptics.ts`'s vocabulary is for a change *this app* made, and handing a
	 * merchant to the OS dialer is not one.
	 */
	const dialable = detail?.customer.phone
		? detail.customer.phone.replace(/[^\d+]/g, "")
		: "";
	const handOff = useCallback(
		(scheme: "tel" | "sms", body?: string) => {
			const url =
				scheme === "tel"
					? `tel:${dialable}`
					: `sms:${dialable}${body === undefined ? "" : `?body=${body}`}`;
			return Linking.canOpenURL(url)
				.then((canOpen) => (canOpen ? Linking.openURL(url) : null))
				.catch(() => null);
		},
		[dialable],
	);

	/**
	 * The map, and why it is a web URL rather than a scheme.
	 *
	 * `app/(customer)/order/[id]` opens directions with the same `google.com/maps/dir` URL and
	 * the same guard, so a shop and a courier are sent to the same place for the same address.
	 * The address is the **two lines and the city** rather than the first line alone: a
	 * one-line destination in Limón is a street somewhere in the country.
	 */
	const openMap = useCallback(() => {
		const address = detail?.deliveryAddress;
		if (!address) return;
		const destination = [address.line1, address.line2, address.city]
			.filter((line): line is string => Boolean(line))
			.join(", ");
		const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
		return Linking.canOpenURL(url)
			.then((canOpen) => (canOpen ? Linking.openURL(url) : null))
			.catch(() => null);
	}, [detail?.deliveryAddress]);

	/**
	 * When each step was reached, and the notes, both read off the one event log the screen
	 * already holds. The **first** event to reach a status is the one that counts and `NOTE`
	 * is not a step — the same two rules `app/(customer)/order/[id]` applies, for the same
	 * reason, and the same function on both sides of the counter.
	 */
	const reachedAt: Partial<Record<OrderStatus, Date>> = {};
	const notes: OrderNoteEvent[] = [];
	for (const event of detail?.events ?? []) {
		if (event.status === "NOTE") {
			notes.push({
				id: event.id,
				note: event.note,
				createdAt: event.createdAt,
			});
			continue;
		}
		if (reachedAt[event.status]) continue;
		reachedAt[event.status] = event.createdAt;
	}

	/**
	 * "Updated" on the hero, from the **newest** event in the log.
	 *
	 * `orderSummarySchema` has no `updatedAt`, so there is nothing to read and a freshness
	 * claim would have to be invented. The newest event *is* the order's last real change —
	 * a note or a move, whichever happened last — so the copy names it and the number is a
	 * fact. `formatRelative` rather than a clock, because this line says how long ago the
	 * screen stopped being true, and a clock does not say that.
	 */
	const updatedAt = detail?.events.at(-1)?.createdAt ?? null;

	// 82 of it is the floating capsule, and it is the first time this screen has paid it:
	// it brings its own `ScrollView` rather than using `./screen`'s, so nothing read the
	// clearance until now. The rest is the CTA and the air under it, which is why it is
	// derived rather than typed — the capsule is a token and the allowance is this file's.
	//
	// **No `bottomInsetPaid`, and the omission is load-bearing.** That flag says "this
	// screen already spent the home-indicator inset, do not add it again", and it is `true`
	// only when `./screen` was given `bottomInset` — which this screen deliberately is *not*
	// given, because its `ScrollView` sits outside the padded body rather than inside it, so
	// a `bottom` edge on the `SafeAreaView` would inset the whole frame and leave the
	// modules floating a phone's-width above the floor. Passing `true` here with
	// `bottomInset` absent would silently drop 34 points on a notched iPhone, and the two
	// live on different lines of this file — so this is the comment that keeps them together.
	const tabClearance = useTabBarClearance();

	return (
		<>
			<Screen padded={false} contentStyle={styles.page}>
				<View style={styles.header}>
					<BackButton to="/business" surface />
					{detail ? (
						<View style={styles.headerText}>
							<Text variant="title" bold style={merchantType.prompt}>
								{t("biz.order.title", { reference: detail.reference })}
							</Text>
							<Text variant="label" tone="muted">
								{`${formatDayMonth(detail.placedAt, intlLocale)} · ${formatClock(detail.placedAt, intlLocale)}`}
							</Text>
						</View>
					) : null}
				</View>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={[
						styles.content,
						{ paddingBottom: space.huge + CTA_ALLOWANCE + tabClearance },
					]}
					refreshControl={refreshControl}
				>
					{order.error ? (
						<ErrorState
							error={order.error}
							onRetry={() => void order.refetch()}
						/>
					) : waiting ? (
						<View
							accessible
							accessibilityRole="progressbar"
							accessibilityLabel={t("state.loading")}
							style={styles.skeletonBlock}
						>
							<Skeleton style={styles.skeletonHero} />
							<Skeleton style={styles.skeletonBlock} />
							<Skeleton style={styles.skeletonBlock} />
						</View>
					) : !detail ? (
						<EmptyState
							title={t("order.notFound")}
							body={t("order.notFound.body")}
						/>
					) : (
						<>
							<MerchantOrderHero
								status={detail.status}
								amountLabel={formatMoney(detail.totalMinor, detail.currency, {
									locale: intlLocale,
								})}
								supporting={`${t(detail.fulfilment === "PICKUP" ? "order.pickup" : "order.delivery")} · ${tp("biz.board.items", detail.itemCount)}`}
								updatedLabel={
									updatedAt ? formatRelative(updatedAt, intlLocale) : null
								}
								fulfilmentIcon={
									detail.fulfilment === "PICKUP"
										? "bag-handle-outline"
										: "car-outline"
								}
							/>

							{move.error ? (
								<ErrorState
									error={move.error}
									title={t("biz.board.moveFailed")}
									overrides={{
										CONFLICT: detail
											? {
													key: "biz.board.conflict.body",
													params: {
														status: t(statusKey(detail.status)),
													},
												}
											: "biz.board.conflict.title",
										FORBIDDEN: "biz.permission.body",
									}}
								/>
							) : null}

							{/* Customer and address are one module rather than two blocks, and
							    the hairline between them is the only rule on this screen: the
							    spec asks for it there and nowhere else, and a rule that runs
							    down a column of modules is a grid rather than a set of
							    surfaces. */}
							<MerchantModule radius={radius.lg}>
								<ModuleRow
									icon="person-outline"
									label={t("biz.order.customer")}
									value={detail.customer.name}
								/>
								{detail.deliveryAddress ? (
									<>
										<View
											style={[
												styles.hairline,
												{ backgroundColor: colors.border },
											]}
										/>
										<ModuleRow
											icon="location-outline"
											label={t("biz.order.address")}
											// Two lines and a city, not one string: the design's
											// own value column wraps them and a joined string would
											// read as one address on one line.
											value={[
												detail.deliveryAddress.line1,
												detail.deliveryAddress.line2,
											]
												.filter((line): line is string => Boolean(line))
												.join("\n")}
											footnote={detail.deliveryAddress.city}
											extra={
												detail.deliveryAddress.instructions
													? detail.deliveryAddress.instructions
													: null
											}
										/>
									</>
								) : null}

								{/* The three doors, and each one is drawn only when the data it
								    acts on is there — a two-up row rather than three, because a
								    pickup order with no address has two and a delivery order has
								    three, and `flex: 1` makes either fill the module. */}
								{dialable || detail.deliveryAddress ? (
									<View style={styles.hands}>
										{dialable ? (
											<HandOff
												icon="call-outline"
												label={t("biz.order.call")}
												onPress={() => void handOff("tel")}
											/>
										) : null}
										{dialable ? (
											<HandOff
												icon="chatbubble-ellipses-outline"
												label={t("biz.order.message")}
												onPress={() => void handOff("sms")}
											/>
										) : null}
										{detail.deliveryAddress ? (
											<HandOff
												icon="map-outline"
												label={t("biz.order.openMap")}
												onPress={() => void openMap()}
											/>
										) : null}
									</View>
								) : null}
							</MerchantModule>

							{detail.customerNotes ? (
								<MerchantModule>
									<ModuleHeading>{t("biz.order.notes")}</ModuleHeading>
									<Text variant="body">{detail.customerNotes}</Text>
								</MerchantModule>
							) : null}

							{/* Items are rows inside one module, never a module each: the
							    design is explicit about that, and it is also what makes an
							    order of eight read as eight things rather than as eight
							    surfaces. */}
							<MerchantModule>
								<ModuleHeading>{t("biz.order.items")}</ModuleHeading>
								<View style={styles.rows}>
									{detail.items.map((item, index) => (
										<View
											key={item.id}
											style={[
												styles.row,
												index > 0
													? [
															styles.rowDivided,
															{ borderTopColor: colors.border },
														]
													: null,
											]}
										>
											<View style={styles.rowBody}>
												<Text variant="body" bold tabular>
													{item.quantity} × {item.name}
												</Text>
												{item.options.map((option) => (
													<Text
														key={option.name}
														variant="caption"
														tone="muted"
													>
														{option.name}
													</Text>
												))}
												{item.notes ? (
													<Text variant="caption" tone="muted">
														{item.notes}
													</Text>
												) : null}
											</View>
											{/* `price` tone, and not `foreground`: the design makes
											    the money the green one and the row's own ink, and a
											    green number under a green hero is the same green spent
											    twice. */}
											<Text variant="body" tone="price" bold tabular>
												{formatMoney(item.lineTotalMinor, detail.currency, {
													locale: intlLocale,
												})}
											</Text>
										</View>
									))}
								</View>
							</MerchantModule>

							<MerchantModule>
								<ModuleHeading>{t("biz.order.total")}</ModuleHeading>
								<TotalRow
									label={t("cart.subtotal")}
									amount={formatMoney(
										detail.totals.subtotalMinor,
										detail.currency,
										{
											locale: intlLocale,
										},
									)}
								/>
								{detail.totals.discountMinor > 0 ? (
									<TotalRow
										label={t("cart.discount")}
										amount={formatMoney(
											-detail.totals.discountMinor,
											detail.currency,
											{ locale: intlLocale },
										)}
									/>
								) : null}
								<TotalRow
									label={t("cart.delivery")}
									amount={formatMoney(
										detail.totals.deliveryFeeMinor,
										detail.currency,
										{
											locale: intlLocale,
										},
									)}
								/>
								{detail.totals.taxMinor > 0 ? (
									<TotalRow
										label={t("cart.tax")}
										amount={formatMoney(
											detail.totals.taxMinor,
											detail.currency,
											{
												locale: intlLocale,
											},
										)}
									/>
								) : null}
								{detail.totals.tipMinor > 0 ? (
									<TotalRow
										label={t("cart.tip")}
										amount={formatMoney(
											detail.totals.tipMinor,
											detail.currency,
											{
												locale: intlLocale,
											},
										)}
									/>
								) : null}
								{/* The rule, and then the row that is the point of the block. */}
								<View
									style={[styles.hairline, { backgroundColor: colors.border }]}
								/>
								<View style={styles.totalRow}>
									<Text variant="body" bold>
										{t("cart.total")}
									</Text>
									<Text variant="body" tone="price" bold tabular>
										{formatMoney(detail.totals.totalMinor, detail.currency, {
											locale: intlLocale,
										})}
									</Text>
								</View>
							</MerchantModule>

							{/* The rail, not a list of cards: `./order-timeline`'s merchant
							    variant, which is the same `customerTimeline` this app's tracker
							    and the web both draw. */}
							<MerchantModule radius={radius.lg}>
								<ModuleHeading>{t("biz.order.events")}</ModuleHeading>
								<OrderTimeline
									status={detail.status}
									fulfilment={detail.fulfilment}
									reachedAt={reachedAt}
									variant="merchant"
									notes={notes}
								/>
							</MerchantModule>

							{/*
							 * The action, in the scroll and not pinned to the foot.

							 * It used to be a pinned bar above the capsule, which is two
							 * overlays competing for the same 90 points — and this screen is
							 * the one place the capsule's clearance was never reserved, so
							 * the two overlapped. A primary action that scrolls with the work
							 * is also the honest one: the answer to "what now" depends on how
							 * far down the operator has read.
							 *
							 * **The lime fill and the black ink**, and the reason they are
							 * built here rather than from `./button` is the same as the
							 * sign-out sheet's: `Button`'s `primary` is `colors.primary`,
							 * which under `(business)` *is* lime, and its `shape` vocabulary
							 * has no 16. What it is not is red — declining is not a
							 * destructive act, and the one loud colour on this screen is
							 * lime.
							 */}
							{advance || detail.status === "PENDING" ? (
								<View style={styles.actions}>
									{advance ? (
										<Pressable
											onPress={() =>
												move.mutate({
													orderId: detail.id,
													to: advance,
													expectedStatus: detail.status,
												})
											}
											disabled={move.isPending}
											disabledOpacity={1}
											scaleTo={PRESS_SCALE_DIALOG}
											ripple={false}
											accessibilityRole="button"
											accessibilityLabel={t(
												moveLabelKey(advance, detail.fulfilment),
											)}
											accessibilityState={{
												busy: move.isPending,
												disabled: move.isPending,
											}}
											style={[
												styles.primaryAction,
												{
													backgroundColor: move.isPending
														? colors.muted
														: colors.primary,
												},
											]}
										>
											<Text
												style={[
													styles.primaryActionLabel,
													{
														color: move.isPending
															? colors.mutedForeground
															: colors.primaryForeground,
													},
												]}
												numberOfLines={1}
											>
												{t(moveLabelKey(advance, detail.fulfilment))}
											</Text>
										</Pressable>
									) : null}

									{/* Everything else is a word, not a pill. A second status
									    and a decline are both real and neither is the
									    answer to "what now", so they sit under the
									    lime fill at body weight and are reached by
									    reading down to them. `Reject` keeps its
									    own sheet — the decision and the
									    reason are two questions and the
									    reason is the one the sheet asks. */}
									<View style={styles.secondaryActions}>
										{next.slice(1).map((status) => (
											<Pressable
												key={status}
												onPress={() =>
													move.mutate({
														orderId: detail.id,
														to: status,
														expectedStatus: detail.status,
													})
												}
												disabled={move.isPending}
												scaleTo={PRESS_SCALE}
												accessibilityRole="button"
												accessibilityLabel={t(
													moveLabelKey(status, detail.fulfilment),
												)}
												accessibilityState={{ disabled: move.isPending }}
												style={styles.secondaryAction}
											>
												<Text variant="body" bold>
													{t(moveLabelKey(status, detail.fulfilment))}
												</Text>
											</Pressable>
										))}
										{detail.status === "PENDING" ? (
											<Pressable
												onPress={() => setRejectOpen(true)}
												disabled={move.isPending}
												scaleTo={PRESS_SCALE}
												accessibilityRole="button"
												accessibilityLabel={t("biz.board.reject")}
												accessibilityState={{ disabled: move.isPending }}
												style={styles.secondaryAction}
											>
												<Text variant="body" bold>
													{t("biz.board.reject")}
												</Text>
											</Pressable>
										) : null}
									</View>
								</View>
							) : null}
						</>
					)}
				</ScrollView>
			</Screen>
			<MerchantRejectSheet
				open={rejectOpen}
				busy={move.isPending}
				onClose={() => setRejectOpen(false)}
				onReason={(reason) => {
					setRejectOpen(false);
					if (detail?.status !== "PENDING") return;
					move.mutate({
						orderId: detail.id,
						to: "REJECTED",
						expectedStatus: detail.status,
						reason,
					});
				}}
			/>
		</>
	);
}

/**
 * A section's title inside a module, at the merchant system's own size.
 *
 * `merchantType.section` (20) rather than the shared `heading` (17): the design calls these
 * the second-largest thing on each block and this is the step the console already uses for a
 * section title, so using it here is what makes this screen and `./merchant-pulse` read as
 * one system.
 */
function ModuleHeading({ children }: { children: React.ReactNode }) {
	const { colors } = useTheme();
	return (
		<Text style={[merchantType.section, { color: colors.foreground }]}>
			{children}
		</Text>
	);
}

/**
 * An icon well and a label-over-value pair — the shape the customer and address rows share.
 *
 * The well is `rgba(0,0,0,.04)` and stays a literal for the reason the handle on
 * `./sign-out-sheet` would: the merchant palette holds no alpha colours, and a neutral wash of
 * black is not a colour that belongs to any token — it is the *absence* of one. The value is
 * `caption` and the label `label`, so the pair reads as a caption with a name under it
 * rather than as two competing lines, and the label is the quieter of the two by design.
 */
function ModuleRow({
	icon: glyph,
	label,
	value,
	footnote,
	extra,
}: {
	icon: React.ComponentProps<typeof Ionicons>["name"];
	label: string;
	value: string;
	/** A second line under the value — the city under the address. */
	footnote?: string | null;
	/** A third: delivery instructions, which are a note rather than a place. */
	extra?: string | null;
}) {
	const { colors } = useTheme();
	return (
		<View style={styles.moduleRow}>
			<View style={styles.well}>
				<Ionicons
					name={glyph}
					size={icon.action}
					color={colors.foreground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
			<View style={styles.moduleRowBody}>
				<Text variant="label" tone="muted">
					{label}
				</Text>
				<Text variant="body" bold>
					{value}
				</Text>
				{footnote ? (
					<Text variant="body" tone="muted">
						{footnote}
					</Text>
				) : null}
				{extra ? (
					<Text variant="caption" tone="muted">
						{extra}
					</Text>
				) : null}
			</View>
		</View>
	);
}

/**
 * One of the three doors under the customer block.
 *
 * **Outlined, not filled** — a 1pt `colors.border` on a `#F6F5F1` module is the design's
 * `rgba(17,17,17,.10)` to within a hair, and the module is already a surface so a filled
 * door would be a surface inside a surface. `PRESS_SCALE` rather than
 * `PRESS_SCALE_DIALOG`: this is a row, and a row that moves reads as the screen shifting.
 */
function HandOff({
	icon: glyph,
	label,
	onPress,
}: {
	icon: React.ComponentProps<typeof Ionicons>["name"];
	label: string;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={[styles.handOff, { borderColor: colors.border }]}
		>
			<Ionicons
				name={glyph}
				size={icon.action}
				color={colors.foreground}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant="label" bold numberOfLines={1}>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * A label and an amount on one line, for the totals module.
 *
 * The label is `muted` and the amount is the default ink, which is the split `./money-line`
 * already draws — the merchant system says a total is a label and a figure, not two figures.
 * Both are `tabular` because the column is read downwards and digits that shift under a
 * fixed label make a column impossible to scan.
 */
function TotalRow({ label, amount }: { label: string; amount: string }) {
	return (
		<View style={styles.totalRow}>
			<Text variant="body" tone="muted">
				{label}
			</Text>
			<Text variant="body" tabular>
				{amount}
			</Text>
		</View>
	);
}

function moveLabelKey(
	status: OrderStatus,
	fulfilment: FulfilmentKind,
): MessageKey {
	if (status === "COMPLETED" && fulfilment === "PICKUP")
		return "biz.board.markPickedUp";
	return MOVE_LABELS[status];
}

/**
 * The room the scroll reserves under the last module, beyond the page's own gutter.
 *
 * **The CTA plus the air under it**, and it is named here rather than typed into the
 * `contentContainerStyle` because the scroll's real foot is three numbers added together —
 * `space.huge`, this, and `tabClearance` — and one of the three is a token that will move if
 * the capsule is retuned. Typing "180" at the call site would be a number that looks like the
 * spec's 170-190 and is silently wrong the moment the other two change.
 *
 * 56 is the CTA's own height and 32 the gap between it and the module above, which is the
 * same `space.huge` the page's gutter uses: the CTA belongs to the content above it, not to
 * the capsule below it.
 */
const CTA_ALLOWANCE = 56 + space.huge;

const styles = StyleSheet.create({
	page: { flex: 1 },
	// The header is a row now rather than a column: a circular back control beside the
	// reference and its clock, which is the shape the design specifies and the one the
	// consumer screens already use. `alignItems: "center"` because the disc is 44 and the
	// text stack is two lines, and a top-aligned pair reads as a heading with a badge beside
	// it rather than as one thing.
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		paddingHorizontal: space.lg,
		paddingTop: space.md,
		paddingBottom: space.lg,
	},
	headerText: { flex: 1, gap: 2 },
	scroll: { flex: 1 },
	// 16 between two modules, and `paddingHorizontal: space.lg` is the page's 16pt inset —
	// the same number for two different jobs, which is why `gap` carries the rhythm and the
	// padding carries the margin. The design's "major vertical gap 16-20" is this gap.
	content: { paddingHorizontal: space.lg, gap: space.lg },
	/**
	 * The one hairline on the screen, and it is a `View` rather than a `borderTopWidth` on
	 * a row because the two places that need it are a *row* and a *module's* last child and
	 * neither of them is the same box. A shared hairline is also what stops the two from
	 * drifting to different weights, which is the failure `theme/tokens.ts` names when it
	 * says every ratio was measured rather than eyeballed.
	 */
	hairline: { height: StyleSheet.hairlineWidth },
	// Customer and address: a 48-point well and a label-over-value stack. The well is the
	// size the design specifies rather than `MIN_TOUCH_TARGET` because it is a *frame* for
	// a glyph rather than a target — nothing is pressed on it.
	moduleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
	well: {
		width: 48,
		height: 48,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		// `rgba(0,0,0,.04)` is the design's value and stays a literal: it is the *absence*
		// of a colour rather than a colour, and the merchant palette holds no alpha tokens
		// (`theme/merchant.ts` says so) so there is nothing here to name.
		backgroundColor: "rgba(0,0,0,0.04)",
	},
	moduleRowBody: { flex: 1, gap: 2 },
	// The three doors. `flex: 1` on each rather than a fixed width, so a pickup order with
	// two and a delivery order with three both fill the module — a third of a fixed width
	// would leave a gap in the two-up case.
	hands: { flexDirection: "row", gap: space.sm, marginTop: space.md },
	handOff: {
		flex: 1,
		minHeight: 50,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		borderRadius: 12,
		borderWidth: 1,
	},
	rows: { marginTop: space.sm },
	// An item: name and amount share a line, the options and notes stack under the name at
	// the text stack's step rather than at a `space` step, because they are lines of one
	// item and not blocks of the page.
	row: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.md,
		paddingVertical: 10,
	},
	rowDivided: { borderTopWidth: StyleSheet.hairlineWidth },
	rowBody: { flex: 1, gap: TEXT_STACK_GAP },
	// The totals' lines: 15-point type at the text stack's gap. `tabular` is on the amounts
	// at the call site, because a column of money is read down and the digits must not move.
	totalRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		paddingVertical: 5,
	},
	// The action block, and it carries no `paddingHorizontal` because the scroll already
	// insets the page — the CTA is a module-width control, not a screen-width one.
	actions: { gap: space.xs, marginTop: space.xs },
	primaryAction: {
		height: 56,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	// 16 at 700, and `color` is the caller's because it follows the surface: `primary` has
	// `primaryForeground` ink and `muted` has `mutedForeground`, and a busy button that kept
	// its resting ink on the muted fill is the 2.10:1 defect `./button`'s docblock records.
	primaryActionLabel: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
	// The answers that are not the answer. A row rather than a stack, so a second status and
	// a decline sit beside each other rather than claiming two lines of their own.
	secondaryActions: {
		flexDirection: "row",
		gap: space.xl,
		justifyContent: "center",
	},
	secondaryAction: { minHeight: 36, justifyContent: "center" },
	// The wait, at the loaded screen's own shape: a dark hero and two modules, so the first
	// paint is the screen's silhouette rather than four grey bars that resolve into something
	// with a different outline.
	skeletonHero: { width: "100%", height: 200, borderRadius: radius.xl },
	skeletonBlock: { width: "100%", height: space.huge * 3 },
});
