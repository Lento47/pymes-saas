import { Redirect, Tabs } from "expo-router";
import { NewOrderBannerProvider } from "@/components/new-order-banner";
import { merchantBarlessOptions } from "@/components/tab-bar";
import { TabMark, useCapsuleScreenOptions } from "@/components/tab-capsule";
import { useT } from "@/lib/i18n";
import { MerchantScopeProvider } from "@/lib/merchant-scope";
import { useResolvedRole } from "@/lib/role";

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
 *
 * ## The bar itself lives in `./tab-capsule`
 *
 * `useCapsuleScreenOptions` and `TabMark` are both imported rather than declared here. The
 * customer tree mounts the same capsule, and the shape of a floating bar — 320 wide, 70 tall,
 * the shadow, the hairline, the 52 disc — is not a merchant decision. `./tab-bar` holds the
 * footprint and the routes that switch it off; this file holds the four tabs and the guard.
 *
 * ## The six screens below that draw no bar at all
 *
 * A `position: "absolute"` bar is out of the navigator's flex flow, so it overlays
 * whatever is under it and the screens have to reserve room for it themselves —
 * `CAPSULE_CLEARANCE`, spent by `./screen` and `./paginated-list` through
 * `./tab-bar`.
 *
 * Six routes are the exception: the forms and settings screens that own the foot of their own
 * screen with an `./action-bar`, which pays the home indicator and holds the screen's one
 * commit. The capsule would draw straight over that bar and cover the button, so those six
 * hide it — `merchantBarlessOptions`, whose name is checked against `./tab-bar`'s list at
 * compile time.
 *
 * `./action-bar` can now lift itself clear of the capsule, and the customer tree relies on it.
 * It is still the wrong answer *here*, and the reason is worth keeping: a lifted bar stacks
 * roughly 200 points of chrome at the bottom of a form and leaves the capsule flush against the
 * home indicator with no air, whereas a form that owns its floor can own all of it. The two
 * trees disagree because a reader browsing a shop wants the way out and a reader filling in a
 * field has already got one.
 */
export default function BusinessLayout() {
	const { t } = useT();
	const resolved = useResolvedRole();
	// **Above the two early returns, not inside the JSX.** The capsule's options read the theme
	// and two device measurements, so they are a hook call; a hook below a `return` runs on the
	// merchant's frame and not on the boot frame, and a component that calls a different number
	// of hooks on two renders of the same instance is the crash `rules-of-hooks` is named after.
	const capsule = useCapsuleScreenOptions();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "business") return <Redirect href="/(customer)" />;

	return (
		<MerchantScopeProvider>
			<NewOrderBannerProvider>
				<Tabs screenOptions={capsule}>
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
					<Tabs.Screen
						name="product-form"
						options={merchantBarlessOptions("product-form")}
					/>
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
					{/* The desk's own two screens, and the reason they take
				    `merchantBarlessOptions` rather than a bare `href: null`: both draw an
				    `ActionBar`, and the capsule is `position: "absolute"` — it would sit over
				    whichever of those two the merchant most needs to press. The option object
				    comes from the same list `lib/tab-bar-coverage.test.ts` reads, so declaring
				    a screen here and listing it there cannot drift. See that file's docblock. */}
					<Tabs.Screen
						name="support/new"
						options={merchantBarlessOptions("support/new")}
					/>
					<Tabs.Screen
						name="support/[ticketId]"
						options={merchantBarlessOptions("support/[ticketId]")}
					/>
					<Tabs.Screen
						name="shop-settings"
						options={merchantBarlessOptions("shop-settings")}
					/>
					<Tabs.Screen
						name="shop-location"
						options={merchantBarlessOptions("shop-location")}
					/>
					<Tabs.Screen
						name="merchant-settings"
						options={merchantBarlessOptions("merchant-settings")}
					/>
					<Tabs.Screen
						name="shop-hours"
						options={merchantBarlessOptions("shop-hours")}
					/>
					<Tabs.Screen name="promotions" options={{ href: null }} />
					<Tabs.Screen
						name="promotion-form"
						options={merchantBarlessOptions("promotion-form")}
					/>
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
