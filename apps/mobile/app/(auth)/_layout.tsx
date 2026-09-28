import { Stack } from "expo-router";

/**
 * The auth tree: what this app is, and the two ways into it.
 *
 * `initialRouteName="welcome"` is the base of this stack, and it is stated here rather than
 * left to the router's guess because the group's other children are not something to leave
 * to sort order — the two forms (`sign-in`, `sign-up`) are halves of one screen, and a
 * reader who enters the group without a target in mind should meet the screen that asks
 * which one they are, not a form.
 *
 * ## Why there is no `index.tsx` here, when three other groups have one
 *
 * `(customer)`, `(business)` and `(delivery)` each have an `index.tsx` that redirects, and
 * this group deliberately does not. The reason is a property of what a group index *is*: a
 * group's index is that group's `initialRouteName`, so it is the screen the stack is built
 * **on** — it stays mounted underneath everything pushed above it. In the other three
 * groups the redirect's target *is* the group's own screen (`(delivery)/index.tsx` points at
 * `/delivery`, which is the only other route in that tree), so the hop is invisible there.
 * This group is the one shape where the two differ: its index would have to point at
 * `/welcome` while its real screens are `/sign-in` and `/sign-up`, which leaves a redirect
 * under a stack that readers push two different screens onto.
 *
 * That is a risk being designed out, not a bug that was caught — the copy of this pattern
 * was removed before the behaviour was confirmed on a device, and the layout below is the
 * version that cannot have the failure by construction: a base route chosen once, which
 * anything pushed later replaces on top of rather than fights. `/welcome` is a real route
 * either way, so a shared `pymeshub://welcome` link resolves without a group index.
 *
 * The callers decide the rest — `app/account.tsx`, `app/(customer)/favorites.tsx` and
 * `app/(customer)/orders.tsx` all push the exact form they mean, because a reader who
 * arrived from "your orders" wants the form, not the question of which form.
 *
 * `headerShown: false` is unchanged and is the group's own convention: the two forms
 * compose their own title strip (`app/(auth)/sign-in.tsx`'s docblock says why a `Screen`
 * title cannot carry it) and `welcome` draws its mark instead, so a header would be a
 * second bar saying less than the screen does.
 */
export default function AuthLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }} initialRouteName="welcome" />
	);
}
