import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewOrderBannerProvider } from "@/components/new-order-banner";
import { Pressable } from "@/components/pressable";
import { useT } from "@/lib/i18n";
import { MerchantScopeProvider } from "@/lib/merchant-scope";
import { useResolvedRole } from "@/lib/role";
import {
	BUSINESS_TAB_BAR_HEIGHT,
	icon,
	radius,
	space,
	TAB_BAR_LABEL_SIZE,
	useTheme,
} from "@/theme";

/**
 * The bar's translucency, applied here because the palette holds no alpha colours
 * (`./merchant-pulse` records the same constraint). The surface itself is read from
 * `colors.card` — the merchant palette's own ivory — so the bar follows the palette;
 * the one number that is not a token is the 94%, and it is named beside the line
 * that owns the decision rather than spelled into a literal, where a re-typed hex
 * of the card token would stop following the palette the day the card moved.
 */
const BAR_OPACITY = 0.94;

/** `#FCFAF5` + 0.94 → `rgba(252,250,245,0.94)`. Hex in — every `ThemeColors` value is. */
function withAlpha(hex: string, alpha: number): string {
	const value = hex.replace("#", "");
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * The business tree, and the guard that keeps a stale link out of it.
 *
 * Route groups add no URL segment, so `/business` is reachable whether or not the resolved
 * role is `business` — which means a deep link (or a restored tab from a role the customer
 * has since lost) would render the board for somebody no longer entitled to it, and every
 * call in it would answer 403. Groups do not switch each other off; this layout does.
 *
 * `null` while resolving rather than a spinner: the resolution is a cache hit after the root
 * index has run it once, so the blank frame is one frame — and a second spinner on top of the
 * one the resolver already showed would be a flicker.
 *
 * ## Four tabs — the burger is the fourth
 *
 * The contract draws Home, Orders, Account and a burger menu. The burger is a
 * tab *in* the bar (Amazon's shape), not a sidebar: one nav system, in the
 * thumb zone, with the navigator keeping every tab's state for free. All
 * four are wired here; the hidden screens below are routes in this tree,
 * not extra tabs. Products and Analytics live behind the menu's own rows.
 *
 * The selected marker is the contract's lime dot rather than a tinted icon: the icon
 * and the label stay ink in both states (a colour-blind reader, a greyscale screenshot
 * and VoiceOver's `selected` state all agree), and the dot is the one thing that moves.
 */
export default function BusinessLayout() {
	const { colors } = useTheme();
	const { t } = useT();
	const insets = useSafeAreaInsets();
	const resolved = useResolvedRole();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "business") return <Redirect href="/(customer)" />;

	return (
		<MerchantScopeProvider>
			<NewOrderBannerProvider>
				<Tabs
					screenOptions={{
						headerShown: false,
						// The navigator's own tab button answers a press with a wide
						// circular wash; ours answers with the control's rounded frame,
						// the same feedback every other control in the app gives. Only
						// the press, the a11y and the laid-out style cross over — the
						// web pointer handlers and the link props stay behind. The cast
						// drops the event the navigator's press carries (a web
						// `MouseEvent` in the union that cannot occur on a phone);
						// navigation needs no event, and the primitive's contract stays
						// the `() => void` every other caller holds.
						tabBarButton: ({
							onPress,
							onLongPress,
							accessibilityState,
							accessibilityLabel,
							style,
							children,
						}) => (
							<Pressable
								onPress={onPress as (() => void) | undefined}
								onLongPress={
									(onLongPress ?? undefined) as (() => void) | undefined
								}
								accessibilityState={accessibilityState}
								accessibilityLabel={accessibilityLabel}
								// The navigator types this as a state callback; what it
								// hands down is laid-out style, and the pressed answer is
								// this primitive's own dim and spring.
								style={style as StyleProp<ViewStyle>}
							>
								{children as ReactNode}
							</Pressable>
						),
						tabBarActiveTintColor: colors.foreground,
						tabBarInactiveTintColor: colors.mutedForeground,
						tabBarStyle: {
							backgroundColor: withAlpha(colors.card, BAR_OPACITY),
							borderTopColor: colors.border,
							borderTopWidth: StyleSheet.hairlineWidth,
							height: BUSINESS_TAB_BAR_HEIGHT + insets.bottom,
							paddingBottom: insets.bottom,
						},
						tabBarLabelStyle: { fontSize: TAB_BAR_LABEL_SIZE },
					}}
				>
					<Tabs.Screen
						name="index"
						options={{
							title: t("nav.home"),
							tabBarAccessibilityLabel: t("nav.home"),
							tabBarIcon: ({ focused, color, size }) => (
								<TabMark
									focused={focused}
									name="home-outline"
									color={color}
									size={size}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="business"
						options={{
							title: t("biz.nav.orders"),
							tabBarAccessibilityLabel: t("biz.nav.orders"),
							tabBarIcon: ({ focused, color, size }) => (
								<TabMark
									focused={focused}
									name="receipt-outline"
									color={color}
									size={size}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="account"
						options={{
							title: t("account.title"),
							tabBarAccessibilityLabel: t("account.title"),
							tabBarIcon: ({ focused, color, size }) => (
								<TabMark
									focused={focused}
									name="person-circle-outline"
									color={color}
									size={size}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="menu"
						options={{
							title: t("biz.nav.menu"),
							tabBarAccessibilityLabel: t("biz.nav.menu"),
							tabBarIcon: ({ focused, color, size }) => (
								<TabMark
									focused={focused}
									name="menu-outline"
									color={color}
									size={size}
								/>
							),
						}}
					/>
					{/* A route in this tree, not a destination of it: the form opens from
			    the menu and the rail, and a tab for it would be a door to a screen
			    with no tab state. `href: null` keeps it mounted and out of the bar. */}
					<Tabs.Screen name="product-form" options={{ href: null }} />
					<Tabs.Screen name="products" options={{ href: null }} />
					<Tabs.Screen name="analytics" options={{ href: null }} />
					<Tabs.Screen name="shop-settings" options={{ href: null }} />
					<Tabs.Screen name="merchant-settings" options={{ href: null }} />
					<Tabs.Screen name="shop-hours" options={{ href: null }} />
					<Tabs.Screen name="promotions" options={{ href: null }} />
					<Tabs.Screen name="promotion-form" options={{ href: null }} />
					<Tabs.Screen name="merchant-order/[id]" options={{ href: null }} />
					<Tabs.Screen name="locations" options={{ href: null }} />
					<Tabs.Screen name="payouts" options={{ href: null }} />
					<Tabs.Screen name="team" options={{ href: null }} />
					<Tabs.Screen name="reviews" options={{ href: null }} />
					<Tabs.Screen name="audit-history" options={{ href: null }} />
				</Tabs>
			</NewOrderBannerProvider>
		</MerchantScopeProvider>
	);
}

/**
 * An icon with the selected marker under it, and nothing else that moves.
 *
 * The mark is a 4pt lime dot: the contract's selected signal, drawn outside the
 * glyph so the icon itself never changes colour to say "here". `size` arrives
 * from the navigator (22–24 per the contract); the dot is fixed because it is
 * a marker, not type, and markers do not scale with Dynamic Type — the label
 * beside it already does.
 */
function TabMark({
	focused,
	name,
	color,
	size,
}: {
	focused: boolean;
	name: React.ComponentProps<typeof Ionicons>["name"];
	color: React.ComponentProps<typeof Ionicons>["color"];
	size: number;
}) {
	const { colors } = useTheme();

	return (
		<View style={styles.mark}>
			<Ionicons
				name={name}
				size={size ?? icon.action}
				color={color}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			{focused ? (
				<View
					style={[styles.dot, { backgroundColor: colors.primary }]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	mark: { alignItems: "center", gap: space.xs },
	dot: { width: 4, height: 4, borderRadius: radius.full },
});
