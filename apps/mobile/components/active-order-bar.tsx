import type { OrderSummary } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { router, usePathname, useSegments } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useSession } from "@/lib/auth/session";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { radius, shadow, space, TEXT_STACK_GAP, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { StatusBadge } from "./status-badge";
import { Text } from "./text";

/**
 * The order that is still happening, floating over home.
 *
 * Rendered by home in the floating cluster under the orders circle: the
 * reason a person opens this app is visible before they scroll. It reads the
 * same cheap count read the circle does (`orders.list`, `activeOnly`, one
 * page) and polls on the same 30s clock — a second cadence would be a second
 * truth about how fresh "live" is.
 *
 * One order only: the list is newest-first, so the head is the one that most
 * recently moved. Nothing when there is nothing — a bar about no order is a
 * control that leads to an empty list, which the circle already opens.
 */
const BADGE_LIMIT = 20;
const BADGE_POLL_MS = 30_000;

export function ActiveOrderBar() {
	const pathname = usePathname();
	const segments = useSegments();
	const merchant =
		segments.some(
			(segment) => segment === "(business)" || segment === "merchant-order",
		) || pathname.startsWith("/merchant-order/");

	return merchant ? <MerchantActiveOrderBar /> : <CustomerActiveOrderBar />;
}

function MerchantActiveOrderBar() {
	const trpc = useTRPC();
	const { status } = useSession();
	const scope = useMerchantScope();

	const active = useQuery(
		trpc.orders.list.queryOptions(
			{
				role: "BUSINESS",
				activeOnly: true,
				limit: BADGE_LIMIT,
				businessId: scope.businessId,
				locationId: scope.locationId,
			},
			{ enabled: status === "signed-in", refetchInterval: BADGE_POLL_MS },
		),
	);

	const order = active.data?.items[0];
	if (!order) return null;

	return (
		<ActiveOrderBarView
			order={order}
			onPress={() =>
				router.push({
					pathname: "/merchant-order/[id]",
					params: { id: order.id },
				})
			}
		/>
	);
}

function CustomerActiveOrderBar() {
	const trpc = useTRPC();
	const { status } = useSession();

	const active = useQuery(
		trpc.orders.list.queryOptions(
			{ role: "CUSTOMER", activeOnly: true, limit: BADGE_LIMIT },
			{ enabled: status === "signed-in", refetchInterval: BADGE_POLL_MS },
		),
	);

	const order = active.data?.items[0];
	if (!order) return null;

	return (
		<ActiveOrderBarView
			order={order}
			onPress={() =>
				router.push({ pathname: "/order/[id]", params: { id: order.id } })
			}
		/>
	);
}

function ActiveOrderBarView({
	order,
	onPress,
}: {
	order: OrderSummary;
	onPress: () => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${t("home.activeOrder")}, ${t("order.number", { code: order.reference })}`}
			style={[
				styles.bar,
				{
					backgroundColor: colors.card,
					borderColor: colors.border,
				},
				shadow.raised,
			]}
		>
			<View style={styles.body}>
				<Text variant="label" tone="muted">
					{t("home.activeOrder")}
				</Text>
				{/*
				 * No `numberOfLines`, and there was one. The bar has no fixed height — its
				 * content sets it — so a one-line cap bought nothing at 100% and cost the
				 * headline at 200%: the headline is a summary ("2× Café chorreado y 1 más",
				 * `headlineOf` in `apps/api/src/services/mappers.ts`), so wrapping at a large
				 * scale is a two-line bar and not a wall. `app/orders.tsx` removed the same cap
				 * from the same string for the same reason, and `app/business.tsx` never had it.
				 */}
				<Text variant="body" bold>
					{order.headline}
				</Text>
			</View>
			<StatusBadge status={order.status} size="pill" />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	// Static: home stacks it in the floating cluster under the orders circle.
	// It used to hang off the tab bar's own height; with no bar it is one
	// more card in a column that floats as a whole.
	bar: {
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		borderWidth: 1,
		// `md`: the scale's step for surfaces — this is a card-shaped bar, the same corner
		// `./card` and `./toast` take. `lg` belongs to sheets and heroes, and this is neither.
		borderRadius: radius.md,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
	},
	body: { flex: 1, gap: TEXT_STACK_GAP },
});
