/**
 * The floating merchant capsule's footprint, and the routes that turn it off.
 *
 * Two bars can sit at the foot of a merchant screen, and a scroll that has to get out
 * from under one of them should not have to re-derive how tall it is. This is the sibling
 * of `./action-bar`'s `useActionBarClearance`.
 *
 * ## Why the navigator's own number cannot be used
 *
 * `useBottomTabBarHeight()` exists and is the obvious answer, and it is wrong here by a
 * different amount on every device. `getTabBarHeight()`
 * (`@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx`) flattens `tabBarStyle` and
 * returns its `height` when there is one — so it answers **70**: the capsule's own box,
 * without the 12 points it floats above the bottom inset and without the home-indicator
 * inset itself. Reserving that leaves the last row under the bar on an iPhone and half
 * under it on a device reporting no inset at all.
 *
 * ## Why nothing is reserved for us
 *
 * `BottomTabViewCustom` puts the tab bar in the same flex column as the screens and
 * applies `tabBarStyle` **last** to the bar's view, so the `position: "absolute"` in
 * `app/(business)/_layout.tsx` takes the bar out of that flow. The screens container is
 * `flex: 1`, so it takes the full window height and the capsule simply overlays the last
 * stretch of every page in the tree. That is by design — a bar that floats is a bar that
 * floats over something — and it makes the reservation the screen's job.
 */
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BUSINESS_TAB_BAR_CLEARANCE } from "@/theme";

/**
 * The routes of the `(business)` tree that own the foot of their own screen.
 *
 * Read by `merchantBarlessOptions` below, by `useTabBarClearance` after it, and checked
 * against the layout by `lib/tab-bar-coverage.test.ts`.
 */
export const MERCHANT_BARLESS_ROUTES = [
	"product-form",
	"promotion-form",
	"shop-hours",
	"shop-settings",
	"merchant-settings",
] as const;

/**
 * The tab bar's style on a screen that must not have one.
 *
 * `display: "none"` is the whole answer, and it is a *style* rather than a flag because
 * `Tabs.Screen` has no `tabBarVisible`. React Navigation applies this last on the bar's
 * own view, so it removes the bar from layout and from paint together, and nothing else
 * in the navigator has to know: `getTabBarHeight()` still answers for a bar that is not
 * drawn, which is harmless because nothing in this app reads it (see the file docblock).
 *
 * The call takes the route name and **does not use it** — the underscore says so, and the
 * name is the whole point of the function. The parameter is typed as a member of
 * `MERCHANT_BARLESS_ROUTES`, so the `Tabs.Screen` entries that ask for a barless screen
 * are a closed set: a sixth screen that needs this has to be added to the list first, and
 * a typo in any of the five is a compile error rather than a bar that quietly keeps
 * floating over a form.
 */
export function merchantBarlessOptions(
	_name: (typeof MERCHANT_BARLESS_ROUTES)[number],
): { href: null; tabBarStyle: { display: "none" } } {
	return { href: null, tabBarStyle: { display: "none" } };
}

/**
 * How much room the foot of a scroll has to leave free on this screen.
 *
 * `0` outside `(business)`: the customer and courier trees draw no bar at all, and
 * `./screen`'s own `space.huge` is the whole of their gutter. Inside it, the capsule's
 * footprint — and `0` again on the routes that hide it, because a bar that is not drawn
 * covers nothing and reserving for it is a screen's worth of dead air under a form.
 *
 * The route group is read with `useSegments()`, the same answer `./index.ts`'s `useTheme`
 * gives for the palette. That is one predicate answering two different questions — which
 * colours, and which chrome — and it is deliberately not folded into a shared helper:
 * `./active-order-bar` asks a third, broader question (it also matches `merchant-order`,
 * a route outside the group) and folding the three would mean a predicate with a
 * parameter nobody can read.
 *
 * `bottomInsetPaid` is `./screen`'s own `bottomInset`, and it exists because the inset is
 * paid in one of two places. A screen whose `SafeAreaView` has the `bottom` edge has
 * already given up the home-indicator inset, so only the capsule's own height is missing
 * from its content. A screen without that edge has not, and the inset is part of what the
 * bar covers. Adding the inset to both is `./action-bar`'s documented 34-point
 * double-payment, and it is invisible on a simulator with a home button.
 */
export function useTabBarClearance({
	bottomInsetPaid = false,
}: {
	bottomInsetPaid?: boolean;
} = {}): number {
	// `readonly string[]` and not the hook's own return type, which is the whole point of
	// the annotation. `useSegments<T extends RoutePath = RoutePath>()` answers
	// `RouteSegments<T>` — a **union of one tuple per route in the app** — so indexing it
	// is a union of indexes, and the one-segment members (`['(customer)']`) have no index
	// `1` to give: reading it is `TS2493, Tuple type '[string]' of length '1' has no
	// element at index '1'`. Every tuple is assignable to `readonly string[]`, so the
	// annotation widens the union in one place, and `noUncheckedIndexedAccess` hands both
	// reads back as `string | undefined` — which is what a runtime array index has always
	// been. `./index.ts` never had to write this down because it reads only index `0`,
	// which exists on every member of the union.
	const segments: readonly string[] = useSegments();
	const insets = useSafeAreaInsets();

	// Hooks first, branch after: the early return below is ordinary control flow, not a
	// conditional hook, but only because both of these are above it.
	if (!drawsTabBar(segments)) return 0;

	return BUSINESS_TAB_BAR_CLEARANCE + (bottomInsetPaid ? 0 : insets.bottom);
}

/**
 * Whether this route draws the capsule.
 *
 * The first segment names the tree and the second the screen inside it. `(business)`'s
 * `href: null` routes are mounted in the same navigator as the four tabs, which is why
 * the check has to reach the second segment at all: a route group adds no URL segment, so
 * every screen in the tree is a tab to the navigator whether or not it is a tab to the
 * reader.
 */
function drawsTabBar(segments: readonly string[]): boolean {
	if (segments[0] !== "(business)") return false;
	const route = segments[1];
	if (route === undefined) return true;
	return !(MERCHANT_BARLESS_ROUTES as readonly string[]).includes(route);
}
