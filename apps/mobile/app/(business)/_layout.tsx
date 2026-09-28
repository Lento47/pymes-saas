import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import type { ReactNode } from "react";
import {
	Platform,
	type StyleProp,
	StyleSheet,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewOrderBannerProvider } from "@/components/new-order-banner";
import { Pressable } from "@/components/pressable";
import { useT } from "@/lib/i18n";
import { MerchantScopeProvider } from "@/lib/merchant-scope";
import { useResolvedRole } from "@/lib/role";
import {
	BUSINESS_TAB_BAR_HEIGHT,
	BUSINESS_TAB_BAR_LIFT,
	icon,
	radius,
	space,
	TAB_BAR_LABEL_SIZE,
	useTheme,
} from "@/theme";

/**
 * The bar's translucency, applied here because the palette holds no alpha colours
 * (`./merchant-pulse` records the same constraint). The surface itself is read from
 * `colors.card` — the merchant palette's own white — so the bar follows the palette;
 * the one number that is not a token is the 94%, and it is named beside the line
 * that owns the decision rather than spelled into a literal, where a re-typed hex
 * of the card token would stop following the palette the day the card moved.
 *
 * No native blur: `expo-blur` is not in this stack, so the capsule is an opaque
 * white at 94% with the specified shadow rather than glass. Deliberate fallback,
 * not a gap — blur would be decoration on a bar whose edge the shadow already draws.
 */
const BAR_OPACITY = 0.94;

/** 320 on a 390 viewport: the capsule's specified width. */
const CAPSULE_WIDTH = 320;

/**
 * The capsule's lift shadow, `0 10 30 rgba(0,0,0,.10)`, expressed the way each
 * platform wants it — the same split `theme/tokens.ts` draws for `shadow`,
 * stated here because no shared step carries this exact diffusion.
 */
const CAPSULE_SHADOW =
	Platform.OS === "web"
		? { boxShadow: "0px 10px 30px rgba(0,0,0,0.10)" }
		: {
				shadowColor: "#000000",
				shadowOpacity: 0.1,
				shadowRadius: 30,
				shadowOffset: { width: 0, height: 10 },
				elevation: 8,
			};

/** The selected disc, 52 square: 9 points of breathing room inside the 70 bar. */
const TAB_DISC = 52;

/**
 * The selected disc's own lift, `0 3 14 rgba(0,0,0,.08)` — the floating-action
 * step, so the disc reads as raised off the capsule rather than painted on it.
 */
const DISC_SHADOW =
	Platform.OS === "web"
		? { boxShadow: "0px 3px 14px rgba(0,0,0,0.08)" }
		: {
				shadowColor: "#000000",
				shadowOpacity: 0.08,
				shadowRadius: 14,
				shadowOffset: { width: 0, height: 3 },
				elevation: 3,
			};

/** `#FFFFFF` + 0.94 → `rgba(255,255,255,0.94)`. Hex in — every `ThemeColors` value is. */
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
	const { width: windowWidth } = useWindowDimensions();
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
						// The floating capsule: 320 wide and centred, 70 tall, 12 above
						// the home-indicator inset. 70 + 12 is the 82 the docked bar
						// occupied, so screens that reserved room for it keep the same
						// clearance — the bar floats, the layout does not move.
						tabBarStyle: [
							{
								position: "absolute",
								// Centred by measured side margins: the free width split
								// equally, recomputed on rotation. No auto margins, no
								// percentage offsets — both proved unreliable against
								// this navigator's bar container.
								left: 0,
								right: 0,
								marginHorizontal: Math.max(
									0,
									(windowWidth - CAPSULE_WIDTH) / 2,
								),
								height: BUSINESS_TAB_BAR_HEIGHT,
								bottom: insets.bottom + BUSINESS_TAB_BAR_LIFT,
								borderRadius: radius.full,
								backgroundColor: withAlpha(colors.card, BAR_OPACITY),
								borderTopWidth: 0,
							},
							CAPSULE_SHADOW,
						],
						tabBarItemStyle: { paddingVertical: 0 },
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
					{/* Every route file in this group must be declared here: Tabs
					    auto-registers undeclared files as visible tabs (file-name
					    label, no icon), which is how six managed screens once
					    crowded the bar. */}
					<Tabs.Screen name="activity" options={{ href: null }} />
					<Tabs.Screen name="payments" options={{ href: null }} />
					<Tabs.Screen name="settlements" options={{ href: null }} />
					<Tabs.Screen name="store-profile" options={{ href: null }} />
					<Tabs.Screen name="business-hours" options={{ href: null }} />
					<Tabs.Screen name="support" options={{ href: null }} />
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
		<View
			style={[
				styles.mark,
				focused && { backgroundColor: colors.card },
				focused && DISC_SHADOW,
			]}
		>
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
	// Fixed 52 square in both states, so selection never reflows the bar: the
	// disc is always there, and only its fill, lift and dot arrive on focus.
	mark: {
		width: TAB_DISC,
		height: TAB_DISC,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
	},
	dot: { width: 4, height: 4, borderRadius: radius.full },
});
