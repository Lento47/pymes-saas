import { Redirect } from "expo-router";

/**
 * The delivery tree's index — the door the group hrefs name.
 *
 * `docs/architecture.md` §8's rule: parentheses add no URL segment, so `(customer)`,
 * `(business)` and `(delivery)` all resolve to `/` and a redirect into a tree has to *name*
 * the group (`href="/(customer)"`, never `href="/"`, which is the resolver itself). Naming
 * the group resolves to that group's own index route — which is why `(customer)` and
 * `(business)` each have one, and why this file exists: without it `/(delivery)` matched no
 * route at all, and Expo Router drew its Unmatched screen at `pymeshub:///` for every
 * courier — at sign-up (`(auth)/sign-in.tsx`'s post-identification replace), at the next
 * cold start (`app/index.tsx`'s resolver), and on every switch to the delivery profile
 * (`app/account.tsx`).
 *
 * The destination is the board itself, `/delivery`: this route is the group's root, not a
 * screen of its own, so it renders no UI and holds no state. `app/account.tsx`'s courier
 * door names `/delivery` directly and never passes through here; the guard that decides
 * whether the board may draw at all is `(delivery)/_layout.tsx`'s, one level up, and it has
 * already answered by the time this redirect runs.
 */
export default function DeliveryIndex() {
	return <Redirect href="/delivery" />;
}
