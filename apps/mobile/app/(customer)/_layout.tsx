import { Tabs } from "expo-router";
import { customerBarlessOptions } from "@/components/tab-bar";
import { TabMark, useCapsuleScreenOptions } from "@/components/tab-capsule";
import { useT } from "@/lib/i18n";

/**
 * The customer tree. It is also the fallback: a device that cannot prove another role draws
 * this one, which is why this layout guards nothing — `lib/role.ts` has already chosen it.
 *
 * ## Four tabs, and the bar is the merchant one
 *
 * Home, Search, Orders, Cart. The capsule is `components/tab-capsule.tsx` — the same file the
 * merchant tree mounts, not a second copy: two bars of the same design in one app is two bars
 * that differ by a hairline by the time anyone notices.
 *
 * **Account is the fifth thing a reader can reach and is not on the bar.** `app/account.tsx`
 * sits at the *root*, not in this group, because five trees link to it — the courier's role
 * switch, `(business)`, `(delivery)`, `inbox`, `help`. A `Tabs.Screen` can only name a route
 * in its own directory, so the only way to put it on this bar is to move the file, and moving
 * a hub that five trees point at to buy one icon is the wrong trade. The feed's header avatar
 * already opens it and already carries `t("account.title")` as its accessibility label, so
 * nothing is unreachable: it is one tap from home and it is spoken aloud.
 *
 * Four is also what the capsule is sized for. `CAPSULE_WIDTH` is 320 and the selected disc is
 * 52, so five tabs would give each one 64 with the disc filling all but 12 of it. Four gives
 * 80 per tab, which is the width the merchant bar was measured at.
 *
 * ## The `href: null` screens below
 *
 * Ten routes live in this directory and only four are tabs. The rest are *pushed* from one of
 * the four — a store, a product, a category — and a pushed screen keeps its own way back, so
 * a tab to it would be a second way back rather than a destination. `href: null` mounts them
 * in this navigator (which is what `./tab-bar` reads the second segment out of) while taking
 * them out of the bar.
 */
export default function CustomerLayout() {
	const { t } = useT();

	return (
		<Tabs screenOptions={useCapsuleScreenOptions()}>
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
				name="search"
				options={{
					title: t("nav.search"),
					tabBarAccessibilityLabel: t("nav.search"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="search-outline" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="orders"
				options={{
					title: t("nav.orders"),
					tabBarAccessibilityLabel: t("nav.orders"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="receipt-outline" color={color} />
					),
				}}
			/>
			{/* Cart is a real tab and keeps the capsule. `cart.tsx` draws a title and no
			    `BackButton`, so a barless cart would be a screen with no way off it — which is
			    the test every name on the list below has to pass. */}
			<Tabs.Screen
				name="cart"
				options={{
					title: t("nav.cart"),
					tabBarAccessibilityLabel: t("nav.cart"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="cart-outline" color={color} />
					),
				}}
			/>

			{/* The three screens that own their floor outright. `customerBarlessOptions`
			    hides the capsule and `href: null` takes the screen out of the bar in one call,
			    and the name is typed against `CUSTOMER_BARLESS_ROUTES` — a fourth has to be
			    added to that list first. */}
			<Tabs.Screen
				name="checkout"
				options={customerBarlessOptions("checkout")}
			/>
			<Tabs.Screen
				name="order/[id]"
				options={customerBarlessOptions("order/[id]")}
			/>
			<Tabs.Screen
				name="review/[orderId]"
				options={customerBarlessOptions("review/[orderId]")}
			/>

			{/* Browsed *to*, never tabbed to. The bar stays on these — a reader three products
			    deep wants the way out without hunting for the back arrow — and the screen's own
			    action bar lifts above it (`./action-bar`'s `lift`). */}
			<Tabs.Screen name="categories" options={{ href: null }} />
			<Tabs.Screen name="category/[slug]" options={{ href: null }} />
			<Tabs.Screen name="favorites" options={{ href: null }} />
			<Tabs.Screen name="featured" options={{ href: null }} />
			<Tabs.Screen name="nearby" options={{ href: null }} />
			<Tabs.Screen name="product/[id]" options={{ href: null }} />
			<Tabs.Screen name="store/[slug]" options={{ href: null }} />
		</Tabs>
	);
}
