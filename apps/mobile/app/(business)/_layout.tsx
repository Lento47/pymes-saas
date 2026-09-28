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
	radius,
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
 * The capsule's lift shadow, `0 4 12 rgba(0,0,0,.07)`, expressed the way each
 * platform wants it — the same split `theme/tokens.ts` draws for `shadow`,
 * stated here because no shared step carries this exact diffusion.
 *
 * Small and light on purpose: the edge itself is the hairline in
 * `tabBarStyle`, so the shadow only lifts. A 30-blur mass read as grey dirt
 * on the white page, and Android's elevation renders with no blur at all.
 */
const CAPSULE_SHADOW =
	Platform.OS === "web"
		? { boxShadow: "0px 4px 12px rgba(0,0,0,0.07)" }
		: {
				shadowColor: "#000000",
				shadowOpacity: 0.07,
				shadowRadius: 12,
				shadowOffset: { width: 0, height: 4 },
				elevation: 2,
			};

/** The selected disc, 52 square: 9 points of breathing room inside the 70 bar. */
const TAB_DISC = 52;

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
								// this primitive's own dim and spring. Centred, because
								// the primitive floors the box and aligns nothing — an
								// uncentred disc pins to the top of the 70pt button and
								// the icons read high with dead air beneath them.
								style={[
									{ alignItems: "center", justifyContent: "center" },
									style as StyleProp<ViewStyle>,
								]}
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
								left: 0,
								right: 0,
								marginHorizontal: Math.max(
									0,
									(windowWidth - CAPSULE_WIDTH) / 2,
								),
								height: BUSINESS_TAB_BAR_HEIGHT,
								// Inset outside the bar, never inside it: paddingBottom
								// here is the exact bug — dead air under the icons.
								paddingVertical: 0,
								alignItems: "center",
								justifyContent: "center",
								bottom: insets.bottom + BUSINESS_TAB_BAR_LIFT,
								borderRadius: radius.full,
								backgroundColor: withAlpha(colors.card, BAR_OPACITY),
								// Hairline, not shadow mass: the crisp edge, drawn in the
								// palette's own hairline so it survives theme and platform.
								borderWidth: StyleSheet.hairlineWidth,
								borderColor: colors.border,
							},
							CAPSULE_SHADOW,
						],
						// Each tab takes the capsule's full height and centres its
						// own content: no label slot, no inherited paddingBottom,
						// no safe-area inset inside the bar — the inset lives
						// outside, in `bottom` above. Selected and unselected share
						// the one centerline; the dot is absolute and moves nothing.
						tabBarItemStyle: {
							flex: 1,
							height: "100%",
							alignItems: "center",
							justifyContent: "center",
							paddingVertical: 0,
						},
						// Icon-only bar: the words live in each tab's
						// `tabBarAccessibilityLabel`, so nothing spoken is lost
						// when nothing printed remains.
						tabBarShowLabel: false,
					}}
				>
					<Tabs.Screen
						name="index"
						options={{
							title: t("nav.home"),
							tabBarAccessibilityLabel: t("nav.home"),
							tabBarIcon: ({ focused, color }) => (
								<TabMark focused={focused} name="home-outline" color={color} />
							),
						}}
					/>
					<Tabs.Screen
						name="business"
						options={{
							title: t("biz.nav.orders"),
							tabBarAccessibilityLabel: t("biz.nav.orders"),
							tabBarIcon: ({ focused, color }) => (
								<TabMark
									focused={focused}
									name="receipt-outline"
									color={color}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="account"
						options={{
							title: t("account.title"),
							tabBarAccessibilityLabel: t("account.title"),
							tabBarIcon: ({ focused, color }) => (
								<TabMark
									focused={focused}
									name="person-circle-outline"
									color={color}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="menu"
						options={{
							title: t("biz.nav.menu"),
							tabBarAccessibilityLabel: t("biz.nav.menu"),
							tabBarIcon: ({ focused, color }) => (
								<TabMark focused={focused} name="menu-outline" color={color} />
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
 * glyph so the icon itself never changes colour to say "here". The glyph is an
 * explicit 24 — the navigator hands 22–24 and the contract never pinned one, so
 * four tabs drew four near-sizes; the dot is fixed because it is
 * a marker, not type, and markers do not scale with Dynamic Type — the label
 * beside it already does.
 */
function TabMark({
	focused,
	name,
	color,
}: {
	focused: boolean;
	name: React.ComponentProps<typeof Ionicons>["name"];
	color: React.ComponentProps<typeof Ionicons>["color"];
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.mark,
				// Hairline edge, no shadow: white on near-white separates with a
				// crisp line, and a second shadow inside the bar's own read as dirt.
				focused && {
					backgroundColor: colors.card,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: colors.border,
				},
			]}
		>
			<Ionicons
				name={name}
				// Explicit 24: the navigator hands 22–24 and the contract never
				// pinned one, so four tabs drew four near-sizes.
				size={24}
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
	// The glyph is centred alone — the dot is pinned, not stacked, so landing
	// on a tab never shifts the icon.
	mark: {
		position: "relative",
		width: TAB_DISC,
		height: TAB_DISC,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	dot: {
		position: "absolute",
		bottom: 10,
		alignSelf: "center",
		width: 4,
		height: 4,
		borderRadius: radius.full,
	},
});
