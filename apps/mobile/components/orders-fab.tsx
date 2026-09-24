import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router, usePathname, useSegments } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useSession } from "@/lib/auth/session";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { icon, radius, shadow, space, type, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * Orders, as an extended pill floating over home.
 *
 * A bare circle was tried first and read as a pasted-on button: no label, no
 * lift, no reason to trust it. This names itself — the `nav.orders` word the
 * old tab wore — beside the receipt mark, on the primary fill, lifted with
 * `shadow.raised` like the active-order bar it sits over. The count rides at
 * its trailing edge only while there is something to count; an empty pill is
 * still a destination (past orders), so it never disappears.
 */
const BADGE_LIMIT = 20;
const BADGE_POLL_MS = 30_000;

export function OrdersFab() {
	const pathname = usePathname();
	const segments = useSegments();
	const merchant =
		segments.some(
			(segment) => segment === "(business)" || segment === "merchant-order",
		) || pathname.startsWith("/merchant-order/");

	return merchant ? <MerchantOrdersFab /> : <CustomerOrdersFab />;
}

function MerchantOrdersFab() {
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
			{
				enabled: status === "signed-in",
				refetchInterval: BADGE_POLL_MS,
			},
		),
	);

	return (
		<OrdersFabView
			waiting={active.data?.items.length ?? 0}
			more={active.data?.nextCursor != null}
			onPress={() => router.push("/business")}
		/>
	);
}

function CustomerOrdersFab() {
	const trpc = useTRPC();
	const { status } = useSession();

	const active = useQuery(
		trpc.orders.list.queryOptions(
			{ role: "CUSTOMER", activeOnly: true, limit: BADGE_LIMIT },
			{
				enabled: status === "signed-in",
				refetchInterval: BADGE_POLL_MS,
			},
		),
	);

	return (
		<OrdersFabView
			waiting={active.data?.items.length ?? 0}
			more={active.data?.nextCursor != null}
			onPress={() => router.push("/orders")}
		/>
	);
}

function OrdersFabView({
	waiting,
	more,
	onPress,
}: {
	waiting: number;
	more: boolean;
	onPress: () => void;
}) {
	const { t, tp } = useT();
	const { colors } = useTheme();
	const badge: number | string | undefined =
		waiting === 0 ? undefined : more ? `${BADGE_LIMIT}+` : waiting;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={
				badge === undefined
					? t("nav.orders")
					: `${t("nav.orders")}, ${more ? t("nav.orders.badge.more", { count: BADGE_LIMIT }) : tp("nav.orders.badge", waiting)}`
			}
			style={[styles.pill, { backgroundColor: colors.primary }, shadow.raised]}
		>
			<Ionicons
				name="receipt-outline"
				size={icon.control}
				color={colors.primaryForeground}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant="label" bold style={{ color: colors.primaryForeground }}>
				{t("nav.orders")}
			</Text>
			{badge !== undefined ? (
				<View
					style={[styles.badge, { backgroundColor: colors.primaryForeground }]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				>
					<Text
						variant="caption"
						bold
						tabular
						style={{ color: colors.primary }}
					>
						{badge}
					</Text>
				</View>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	// Extended, not circular: the word is what makes it a destination rather
	// than a mark. 56 tall — `space.lg` twice plus the heading's line height,
	// the same derivation `./button`'s `lg` states — and a `minHeight` floor
	// rather than a fixed height, so the pill grows with 200% text instead of
	// clipping it. `full` corner like every pill in the app, and the raised
	// shadow because it floats over content rather than sitting in it.
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		minHeight: space.lg * 2 + type.heading.lineHeight,
		paddingHorizontal: space.lg,
		borderRadius: radius.full,
	},
	// The badge's own mark: 22 is its box, sized here because the box is this
	// one and not a role — the same move `./favorite-button` makes for its
	// heart. `space.xs` of side padding, and both dimensions floors so the
	// caption inside grows with 200% text instead of clipping.
	badge: {
		minWidth: 22,
		minHeight: 22,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: space.xs,
	},
});
