import { type Href, router } from "expo-router";

/**
 * Back, or somewhere the reader can stand when there is nothing behind them.
 *
 * `app/category/[slug]`, `app/featured`, `app/nearby`, `app/product/[id]`, `app/store/[slug]`
 * and `app/order/[id]` all draw their own back control — the stack header is off on those
 * screens, so the button is theirs to draw — and all six were calling the same two lines by
 * hand. Six copies of a fallback are six places for "back" to start sending somebody somewhere
 * different, and the sixth copy is where that had already begun: see the fallback below.
 *
 * `canGoBack()` is the whole reason this is not just `router.back()`. A shared link, a push
 * notification, or a cold start on a deep link opens these screens with an **empty stack**, and
 * `back()` with nothing behind it does nothing at all — the reader keeps the screen they were
 * trying to leave, with a button that does not work and no other way out. So the fallback runs
 * instead.
 *
 * The fallback is an argument and not a default, because the six screens do not agree on it and
 * the disagreement is real. Five name the feed (`/`) — somebody who followed a dead product
 * link wants to be back in the marketplace, not in a list they never opened. `app/order/[id]`
 * names the orders list (`/orders`), because an order opened from a notification belongs beside
 * the customer's other orders. A default here would quietly send one of them to the wrong
 * screen, which is the failure this file exists to make impossible.
 *
 * A plain function rather than a `useBack` hook: `router` is expo-router's imperative singleton
 * and needs no component around it, and a module-level function already has the stable identity
 * that `onPress` and `onAction` want — a hook would add a `useCallback` to buy back an identity
 * this has for nothing.
 */
export function leaveScreen(fallback: Href): void {
	if (router.canGoBack()) router.back();
	else router.replace(fallback);
}
