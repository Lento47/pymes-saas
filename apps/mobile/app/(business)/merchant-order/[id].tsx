import { type MessageKey, MOVE_LABELS } from "@pymeshub/i18n";
import {
	type FulfilmentKind,
	isTerminalStatus,
	type OrderStatus,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { MerchantRejectSheet } from "@/components/merchant-reject-sheet";
import { MoneyLine } from "@/components/money-line";
import { Price } from "@/components/price";
import { useRefreshControl } from "@/components/pull-refresh";
import { Screen } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { statusForeground, statusKey } from "@/components/status-badge";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { toApiFailure } from "@/lib/api-error";
import { formatClock, formatDay } from "@/lib/format";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space, TEXT_STACK_GAP, useTheme } from "@/theme";

/**
 * One order as the operator reads it: what it is, who it is for, what is owed, and the
 * moves that answer it (interface.md §18–§20). The scoped read runs the board's guarded
 * write — `advance` with `expectedStatus`, and a CONFLICT refetches rather than guessing —
 * so a worker who opened a row and a worker scanning the queue move the same order under
 * the same rules.
 *
 * ## Why the status word is `heading` and not the customer screen's `display`
 *
 * `app/(customer)/order/[id].tsx` answers one question — "where is my order" — so the
 * status takes `display` and the page. This screen is a work surface where the row's chip
 * already carried the state and the question is "what do I do next", so the status keeps
 * `heading` beside the total: interface.md §6's two loud things here are the state and the
 * money, and `display` would tip the page into a headline that restates the chip. The ink
 * is `statusForeground`'s — the same status words the board's chip carries, written on the
 * page ground — because `orderChip`'s `fg` is the ink *on* that fill and reads as a smudge
 * on ivory.
 *
 * ## The receipt is the customer's receipt
 *
 * Zero money lines are not drawn (no €0 discount, tax or tip), item lines lead with a
 * tabular quantity the way the customer's do, and the totals block is the same anatomy —
 * one answer to "what does an order receipt show", on both sides of the counter. What
 * differs is the events block: the customer gets `./order-timeline`'s rail, the operator
 * gets the raw log including `NOTE`, because a note is work and a rail is reassurance.
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
	const { t, intlLocale } = useT();
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

	return (
		<>
			<Screen padded={false} bottomInset contentStyle={styles.page}>
				<View style={styles.header}>
					<BackButton to="/business" />
					{detail ? (
						<Text variant="title" bold>
							{t("biz.order.title", { reference: detail.reference })}
						</Text>
					) : null}
				</View>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.content}
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
							style={styles.block}
						>
							<Skeleton style={styles.skeletonHeading} />
							<Skeleton style={styles.skeletonLine} />
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
							<View style={[styles.block, styles.stack]}>
								<Text
									variant="heading"
									bold
									style={{
										color: colors[statusForeground(detail.status)],
									}}
								>
									{t(statusKey(detail.status))}
								</Text>
								<Text variant="label" tone="muted">
									{t("order.placedAt", {
										date: formatDay(detail.placedAt, intlLocale),
										time: formatClock(detail.placedAt, intlLocale),
									})}
								</Text>
								<Text variant="body">
									{t(
										detail.fulfilment === "PICKUP"
											? "order.pickup"
											: "order.delivery",
									)}
									{" · "}
									{t("biz.board.items", { count: detail.itemCount })}
								</Text>
								<Price
									amountMinor={detail.totalMinor}
									currency={detail.currency}
									variant="heading"
								/>
							</View>

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

							<View style={styles.block}>
								<Text variant="heading" bold>
									{t("biz.order.customer")}
								</Text>
								<View style={styles.stack}>
									<Text variant="body">{detail.customer.name}</Text>
									{detail.customer.phone ? (
										<Text variant="label" tone="muted">
											{detail.customer.phone}
										</Text>
									) : null}
								</View>
							</View>

							{detail.deliveryAddress ? (
								<View style={styles.block}>
									<Text variant="heading" bold>
										{t("biz.order.address")}
									</Text>
									<View style={styles.stack}>
										<Text variant="body">{detail.deliveryAddress.line1}</Text>
										{detail.deliveryAddress.line2 ? (
											<Text variant="body">{detail.deliveryAddress.line2}</Text>
										) : null}
										<Text variant="label" tone="muted">
											{detail.deliveryAddress.city}
										</Text>
										{detail.deliveryAddress.instructions ? (
											<Text variant="body">
												{detail.deliveryAddress.instructions}
											</Text>
										) : null}
									</View>
								</View>
							) : null}

							{detail.customerNotes ? (
								<View style={styles.block}>
									<Text variant="heading" bold>
										{t("biz.order.notes")}
									</Text>
									<Text variant="body">{detail.customerNotes}</Text>
								</View>
							) : null}

							<View style={styles.block}>
								<Text variant="heading" bold>
									{t("biz.order.items")}
								</Text>
								{detail.items.map((item) => (
									<View key={item.id} style={styles.item}>
										<Text variant="body" bold tabular style={styles.itemName}>
											{item.quantity} × {item.name}
										</Text>
										<Price
											amountMinor={item.lineTotalMinor}
											currency={detail.currency}
											variant="body"
										/>
										{item.options.map((option) => (
											<Text
												key={option.name}
												variant="caption"
												tone="muted"
												style={styles.itemOption}
											>
												{option.name}
											</Text>
										))}
										{item.notes ? (
											<Text
												variant="caption"
												tone="muted"
												style={styles.itemOption}
											>
												{item.notes}
											</Text>
										) : null}
									</View>
								))}
							</View>

							<View style={styles.block}>
								<Text variant="heading" bold>
									{t("biz.order.total")}
								</Text>
								<MoneyLine
									label={t("cart.subtotal")}
									amountMinor={detail.totals.subtotalMinor}
									currency={detail.currency}
								/>
								{detail.totals.discountMinor > 0 ? (
									<MoneyLine
										label={t("cart.discount")}
										amountMinor={-detail.totals.discountMinor}
										currency={detail.currency}
									/>
								) : null}
								<MoneyLine
									label={t("cart.delivery")}
									amountMinor={detail.totals.deliveryFeeMinor}
									currency={detail.currency}
								/>
								{detail.totals.taxMinor > 0 ? (
									<MoneyLine
										label={t("cart.tax")}
										amountMinor={detail.totals.taxMinor}
										currency={detail.currency}
									/>
								) : null}
								{detail.totals.tipMinor > 0 ? (
									<MoneyLine
										label={t("cart.tip")}
										amountMinor={detail.totals.tipMinor}
										currency={detail.currency}
									/>
								) : null}
								<MoneyLine
									label={t("cart.total")}
									amountMinor={detail.totals.totalMinor}
									currency={detail.currency}
									strong
								/>
							</View>

							<View style={styles.block}>
								<Text variant="heading" bold>
									{t("biz.order.events")}
								</Text>
								{detail.events.map((event) => (
									<View key={event.id} style={styles.event}>
										<Text variant="body">
											{event.status === "NOTE"
												? t("biz.order.noteEvent")
												: t(statusKey(event.status))}
										</Text>
										<Text variant="caption" tone="muted" tabular>
											{formatClock(event.createdAt, intlLocale)}
										</Text>
										{event.note ? (
											<Text variant="caption" tone="muted">
												{event.note}
											</Text>
										) : null}
									</View>
								))}
							</View>
						</>
					)}
				</ScrollView>
				{detail && (next.length > 0 || detail.status === "PENDING") ? (
					<View
						style={[
							styles.actions,
							{ borderTopColor: colors.border, backgroundColor: colors.card },
						]}
					>
						{next.map((status, index) => (
							<Button
								key={status}
								label={t(moveLabelKey(status, detail.fulfilment))}
								variant={index === 0 ? "primary" : "secondary"}
								loading={move.isPending && move.variables?.to === status}
								disabled={move.isPending}
								onPress={() =>
									move.mutate({
										orderId: detail.id,
										to: status,
										expectedStatus: detail.status,
									})
								}
							/>
						))}
						{detail.status === "PENDING" ? (
							<Button
								label={t("biz.board.reject")}
								variant="secondary"
								disabled={move.isPending}
								onPress={() => setRejectOpen(true)}
							/>
						) : null}
					</View>
				) : null}
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

function moveLabelKey(
	status: OrderStatus,
	fulfilment: FulfilmentKind,
): MessageKey {
	if (status === "COMPLETED" && fulfilment === "PICKUP")
		return "biz.board.markPickedUp";
	return MOVE_LABELS[status];
}

const styles = StyleSheet.create({
	page: { flex: 1 },
	header: {
		paddingHorizontal: space.lg,
		paddingBottom: space.sm,
		gap: space.xs,
	},
	scroll: { flex: 1 },
	content: { paddingBottom: space.xl, gap: space.lg },
	block: { paddingHorizontal: space.lg, gap: space.sm },
	/** Lines about one fact stack at the text stack's step, not at a `space` step. */
	stack: { gap: TEXT_STACK_GAP },
	item: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		// Name and price share a line and keep `space.sm` between them; the options and
		// notes that wrap below are lines of the same item and stack at `TEXT_STACK_GAP`.
		rowGap: TEXT_STACK_GAP,
		columnGap: space.sm,
	},
	itemName: { flex: 1, flexShrink: 1 },
	itemOption: { width: "100%" },
	/** Status, clock and note are one event — one statement, one stack. */
	event: { gap: TEXT_STACK_GAP },
	actions: {
		paddingHorizontal: space.lg,
		paddingVertical: space.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: space.sm,
	},
	skeletonHeading: { width: "65%", height: space.xl },
	skeletonLine: { width: "45%", height: space.lg },
	skeletonBlock: { width: "100%", height: space.huge * 2 },
});
