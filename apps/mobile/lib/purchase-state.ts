import { isTerminalStatus, type OrderSummary } from "@pymeshub/shared";

export type PurchaseStage =
	| "browsing"
	| "basket"
	| "inCart"
	| "checkout"
	| "confirmed"
	| "paid"
	| "delivery";

type OrderState = Pick<OrderSummary, "status" | "paymentStatus">;
type CompletionOrderState = Pick<OrderSummary, "id" | "status">;

export function shouldPlayDeliveryCompletion(
	previous: CompletionOrderState | null,
	current: CompletionOrderState,
): boolean {
	return (
		previous?.id === current.id &&
		previous.status === "OUT_FOR_DELIVERY" &&
		current.status === "COMPLETED"
	);
}

export function stageForOrder(order: OrderState): PurchaseStage | null {
	if (isTerminalStatus(order.status)) return null;
	if (order.status === "OUT_FOR_DELIVERY") return "delivery";
	if (order.paymentStatus === "PAID") return "paid";
	return "confirmed";
}

export function shouldBreathe(
	stage: PurchaseStage,
	reduceMotion: boolean,
): boolean {
	return stage === "delivery" && !reduceMotion;
}

/**
 * Whether a route draws a band **of its own accord** — the browsing, basket, cart and checkout
 * ramps that have nothing to do with an order being in transit.
 *
 * **Unchanged, and deliberately so.** This is the original whitelist of paths and it is the
 * list that should not have moved when the delivery band was made to persist. Making
 * `/settings`, `/account`, `/inbox` and the rest carry a band put a lime wash across nine
 * screens that had always drawn a plain background, which is a visual change nobody asked for:
 * the request was that a delivery in progress stay visible, not that every page grow a gradient.
 *
 * Persistence is `followsOrder` below. Two questions, two functions.
 */
export function isPurchaseRoute(pathname: string): boolean {
	return (
		pathname === "/" ||
		pathname === "/search" ||
		pathname === "/cart" ||
		pathname === "/checkout" ||
		pathname === "/categories" ||
		pathname === "/favorites" ||
		pathname === "/featured" ||
		pathname === "/nearby" ||
		[
			"/category/",
			"/category-products/",
			"/product/",
			"/store/",
			"/order/",
		].some((prefix) => pathname.startsWith(prefix))
	);
}

/**
 * Whether an order **in transit** is allowed to repaint this route — the delivery band, which
 * follows the order from the moment it leaves until it is delivered.
 *
 * **A denylist of trees, which is the right shape for this and the wrong shape for the one
 * above.** The rule is "everywhere a signed-in customer can be, and nowhere a different role
 * is", and that is a set of exclusions: a whitelist would need a line added for every new
 * customer route forever, and forgetting one silently drops the band from a screen the reader
 * is on while their parcel is in the van.
 *
 * - `(auth)` — not signed in, so there is no order to be out for. Sign-in is also a
 *   full-screen moment; a band across its top would be decoration on the one screen whose only
 *   job is to get out of the way.
 * - `(business)` — the merchant console. A merchant who is also a customer seeing their own
 *   delivery band above their shop dashboard is noise on someone else's screen.
 * - `(delivery)` — the courier. They are the one carrying it; telling them it is on the way
 *   tells them what they already know.
 * - `admin` and the role-entry routes — role switches and onboarding, where the palette is
 *   deliberately plain.
 *
 * Note what is included that `isPurchaseRoute` leaves out: `/account`, `/settings`,
 * `/profile`, `/inbox`, `/addresses`, `/orders`, `/help` and the rest of the root routes. A
 * customer with a parcel in transit is exactly as much "in the market" on the settings screen as
 * on the feed. `purchase-state.test.ts` pins every excluded tree, because an exclusion nobody
 * tests is one that quietly stops excluding.
 *
 * **Derived from the route tree, not typed from memory.** `pathname` is `usePathname()`, and
 * for an expo-router group that resolves to the route *without* the group segment —
 * `(auth)/sign-in` is `/sign-in` — so `(auth)` cannot be a prefix here and its three routes are
 * listed individually. The list is the file-by-file content of `app/(auth)`,
 * `app/(business)`, `app/(delivery)` and the four role-entry files at the root.
 *
 * Matched with a **boundary check**, not `startsWith`. That is what keeps `/products` from
 * swallowing `/product/[id]`, and `/delivery` from swallowing a hypothetical
 * `/delivery-notes`. Both directions are pinned in the test.
 *
 * **`/account` is deliberately absent.** `app/(business)/account.tsx` exists *and*
 * `app/account.tsx` does too, and they want the same path; the root file is the one five trees
 * link to — the courier's role switch, `(business)`, `(delivery)`, `inbox`, `help` — and
 * `(customer)/_layout.tsx` documents why it lives at the root. Excluding it on the strength of a
 * same-named file in another tree would drop the band from the hub five trees point at.
 */
function followsOrder(pathname: string): boolean {
	return !ROLE_ROUTES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

const ROLE_ROUTES = [
	// `(auth)` - the whole tree.
	"/sign-in",
	"/sign-up",
	"/welcome",
	// `(business)` - the whole tree. `/account` is intentionally not here; see above.
	"/activity",
	"/analytics",
	"/audit-history",
	"/business",
	"/business-hours",
	"/locations",
	"/menu",
	"/merchant-order",
	"/merchant-settings",
	"/payments",
	"/payouts",
	"/product-form",
	"/products",
	"/promotion-form",
	"/promotions",
	"/reviews",
	"/settlements",
	"/shop-hours",
	"/shop-location",
	"/shop-settings",
	"/store-profile",
	"/support",
	"/team",
	// `(delivery)`, plus `courier-invites` — which is a *root* file but a courier capability
	// (`biz.courier.*`, accepting and declining invitations). Filed beside the tree it belongs to
	// rather than with the customer's root routes, and the placement is called out because the
	// file's location is misleading: someone auditing this list by file tree will not find it in
	// `app/(delivery)`.
	"/courier-invites",
	"/courier-profile",
	"/delivery",
	// Role switches, onboarding and admin, at the root.
	"/admin",
	"/business-delivery",
	"/new-business",
] as const;

export function purchaseStage({
	pathname,
	itemCount,
	activeOrders,
	viewedOrder,
}: {
	pathname: string;
	itemCount?: number;
	activeOrders?: readonly OrderState[];
	viewedOrder?: OrderState;
}): PurchaseStage | null {
	if (!followsOrder(pathname)) return null;
	if (pathname.startsWith("/order/"))
		return viewedOrder ? stageForOrder(viewedOrder) : null;

	/**
	 * `/checkout` outranks a live order, and that is deliberate rather than an ordering slip.
	 *
	 * Checkout is a *foreground* task: the reader is buying something right now, and it has its
	 * own colour precisely so they can see which step they are on. Letting a background delivery
	 * repaint the band mid-checkout would replace "you are buying this" with "something else is
	 * on its way" — about a different order, on the one screen where the reader is about to
	 * spend money. `/cart` does *not* get that exemption, because a cart is not a transaction.
	 *
	 * This was briefly reordered so a live order won everywhere, on the reasoning that the band
	 * persists until delivery. `purchase-state.test.ts` caught it, and it was right: persistence
	 * is about the band not *disappearing*, not about it overriding whatever the screen is
	 * already saying.
	 */
	if (pathname === "/checkout") return "checkout";

	const liveOrder = activeOrders?.find(
		(order) => !isTerminalStatus(order.status),
	);
	if (liveOrder) return stageForOrder(liveOrder);

	/**
	 * Nothing in transit, so this route is on its own again.
	 *
	 * **This is the line the whole change turns on.** A route that *follows* an order but does
	 * not draw a band of its own accord — `/settings`, `/account`, `/inbox`, `/orders` — returns
	 * `null` here, so it goes back to the plain background it has always drawn. The delivery band
	 * reached those screens; the browsing ramp never did, and handing it to them is a different
	 * change that nobody asked for.
	 */
	if (!isPurchaseRoute(pathname)) return null;

	if (!activeOrders) return null;
	if (pathname === "/cart") return "inCart";
	if (itemCount === undefined) return null;
	return itemCount > 0 ? "basket" : "browsing";
}
