import { useCallback, useState } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";

import { useTheme } from "@/theme";

/**
 * The pull-to-refresh control, written once for every scroller in the app.
 *
 * `docs/design-mobile.md`'s Rule 6 gives the gesture to the customer. What this file holds is
 * the three decisions that have to be the same wherever the gesture is offered, and each of
 * them has been got wrong in this app at least once:
 *
 * **Both tints, or one platform gets a bare disc.** `tintColor` is iOS's spinner and `colors`
 * is Android's; a control that passes one of them is coloured on one platform and the platform
 * default on the other. `app/orders.tsx` records the untinted disc, and `./screen`'s
 * `onRefresh` docblock says handing the pair out from one place is the cheapest way to stop the
 * next screen from passing one.
 *
 * **The busy flag belongs to the pull, not to the query.** It is this hook's own state and it is
 * resolved in `finally`. `isFetching`/`isRefetching` is true for reasons a thumb did not cause —
 * a poll's timer, a remount, a focus refetch, a stale window — so a spinner driven by it appears
 * under a hand that never moved and claims credit for a request nobody made. `app/order/[id].tsx`
 * polls and documents the same shape.
 *
 * **Absent, not disabled.** With no `onRefresh` this returns `undefined`, so the scroller is
 * handed no `refreshControl` at all rather than one that is present and never refreshes: a
 * gesture the screen answers by doing nothing is a control that lied about being there. React
 * drops an undefined prop, and that is the honest representation of "this screen has no pull".
 *
 * ## Why a hook that returns an element, which is unusual
 *
 * Because the thing being shared is a *prop value*, not a view. `RefreshControl` is not laid out
 * — it is handed to the scroller through `refreshControl`, and it is not a component this app can
 * render as a child. So a component here would be wrong, and a hook returning `{ refreshing,
 * refresh }` would leave each call site to rebuild the element — which is the eight lines that
 * had been copied into `./screen` and `./paginated-list`, tints and all. Returning the element
 * means the pair, the flag's ownership and the absent-not-disabled rule are one thing that cannot
 * be half-adopted. Call it unconditionally, in the component body, like any other hook: it is
 * called every render whatever its argument is, and it decides what to hand back.
 *
 * A rejection is swallowed rather than rethrown. The read's failure is already on the query —
 * `query.isError` is what draws it — and a bare `void promise.finally(...)` would leave the
 * rejection unhandled.
 */
export function useRefreshControl(
	onRefresh: (() => unknown) | undefined,
): React.ReactElement<RefreshControlProps> | undefined {
	const { colors } = useTheme();
	const [refreshing, setRefreshing] = useState(false);

	const refresh = useCallback(() => {
		setRefreshing(true);
		void Promise.resolve(onRefresh?.())
			.catch(() => {})
			.finally(() => setRefreshing(false));
	}, [onRefresh]);

	if (!onRefresh) return undefined;

	return (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={refresh}
			// Both tints — see the docblock.
			tintColor={colors.primary}
			colors={[colors.primary]}
		/>
	);
}
