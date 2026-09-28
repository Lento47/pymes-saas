/**
 * Which tree the reader is standing in, and therefore which palette is honest.
 *
 * ## Why this is its own file, and why it imports nothing
 *
 * The rule is a decision; `./index.ts` is the lookup that acts on it. Splitting them means this
 * half has **no imports at all** — not `./tokens`, not `expo-router`, not `react-native` — so
 * `select.test.ts` runs under `bun test` against the real function with no React Native runtime,
 * no module mock and no preload. `./tokens` is not reachable from here: it pulls `Platform` out of
 * `react-native` for `shadow`'s web branch, and nothing in this repo's test suite loads
 * `react-native` today (`lib/format.ts` imports only `@pymeshub/shared`; `lib/device-prefs.ts` only
 * AsyncStorage). A rule that can only be tested behind a mock is a rule nobody tests.
 *
 * The return is a name, not a palette, for the same reason. Whoever reads it decides what a
 * "business" is worth; this file never imports the thing it is choosing between.
 */

/**
 * The two palettes this app has, and the three trees that draw them.
 *
 * `delivery` is the consumer's palette and is not a third value here: the courier board is the
 * shopping language with an order in it, and `theme/tokens.ts` says so where the palettes are
 * defined. Naming it would invite a third `case` that has to be justified every time the list
 * changes.
 */
export type Tree = "business" | "consumer";

/** What `lib/role.ts` knows at the moment the palette is asked for. */
export type PaletteRole = "customer" | "business" | "delivery" | null;

/**
 * The rule, in the order it is applied. The order is the design; the comments are why.
 *
 * `(auth)` is excluded **first and unconditionally**, and this is the one clause that is not
 * about the merchant. The auth tree is where a role is *chosen*, so it cannot be coloured by a
 * role nobody has claimed yet — and a claim that this is theoretical would have to ignore the
 * signed-out branch of `lib/role.ts`, which keeps the preference across a sign-out on purpose so
 * a returning owner finds their board. A merchant who signs out and lands on the sign-in form
 * would otherwise be handed a white, lime-accented form to type their password into. The
 * argument is that the surface precedes the answer; the consequence is that the regression
 * cannot happen.
 *
 * `(business)` is checked before the role so a **profile switch cannot repaint the tree it is
 * leaving**. `app/account.tsx` persists the new profile and only then calls `router.replace`
 * (`:462-472`), so for the length of that hop the reader is still standing in the old tree with
 * the new role already resolved. Segment first means the tree keeps the colours it was drawn
 * with until it is actually gone. The reverse order would flash the wrong palette on every
 * switch — and the more common direction of that switch, a customer becoming an owner, would
 * repaint `/account` in the merchant palette for a frame before the redirect lands.
 *
 * The role clause is last because it is the only one that reaches past the navigator. It exists
 * for two cases the segment cannot see, and they are the same defect seen twice:
 *
 * 1. **The boot frame.** `expo-router`'s `useSegments()` is `useRouteInfo().segments`, and
 *    `getRouteInfoFromState` returns `defaultRouteInfo` — `segments: []` — for the whole window
 *    before a navigation state exists. A merchant's cold start spends that window on
 *    `app/index.tsx`, which is a root route, so the segment test says "consumer" and the app
 *    paints its ultramarine `#3538f2` spinner on a cream canvas for as long as `users.me` takes
 *    to answer. That is the blue.
 * 2. **The five root routes the merchant tree pushes** — `/profile`, `/settings`, `/help`,
 *    `/inbox`, `/new-business`. They sit at `app/` because all three trees reach them (see the
 *    navigation sweep in `app/account.tsx`, `app/settings.tsx` and
 *    `app/(delivery)/courier-profile.tsx`), so their first segment is never `(business)` and a
 *    merchant who opens one gets a screen of consumer-blue buttons inside their own console.
 *    Moving them into the group would fork four shared screens; colouring them by role does not.
 *
 * Delivery is absent on purpose and needs no clause: its role is `"delivery"`, which is not
 * `"business"`, so it falls through to `consumer` — the palette `theme/tokens.ts` already gives it.
 */
export function selectTree(input: {
	/** `useSegments()` verbatim, groups included. */
	segments: readonly string[];
	/** The confirmed role, or the stored preference while the answer is in flight. */
	role: PaletteRole;
}): Tree {
	const [group] = input.segments;
	if (group === "(auth)") return "consumer";
	if (group === "(business)") return "business";
	return input.role === "business" ? "business" : "consumer";
}
