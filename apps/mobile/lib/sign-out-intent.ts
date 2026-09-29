/**
 * "A sign-out was asked for from a tree that needs a session", as a one-shot note.
 *
 * ## Why this exists at all
 *
 * Signing out sets `status` to `"signed-out"` and nothing navigates. What happens next is
 * decided by `lib/role.ts`, whose signed-out branch answers `customer` — and the root
 * `Stack.Protected` guards then unmount whichever tree the reader was standing in, so a
 * merchant who taps "Cerrar sesión" today lands in the **customer storefront**, having been
 * sent to a shop to browse by the act of leaving the shop. That is the behaviour this note
 * exists to correct, and correcting it needs a piece of state that outlives the screen which
 * asked for it.
 *
 * **It cannot live in the screen, and that is arithmetic rather than a preference.**
 * `app/(auth)/sign-in.tsx` owns the same problem for sign-*in* and solves it with a local
 * effect calling `router.replace` — which works there because a sign-in does not change the
 * role. A sign-out does: `status` → `"signed-out"` makes `useResolvedRole()` answer
 * `customer` (`lib/role.ts`), which flips the guard, which unmounts
 * `app/(business)/account.tsx` in the same commit. An effect keyed on `status` inside that
 * screen never runs its body. The note is therefore read above the navigator, in
 * `app/_layout.tsx`.
 *
 * ## Why a module value and not a route param
 *
 * The same argument `lib/role.ts` makes for `takeDegradation()`: this explains a transition
 * the reader just lived through, so it must not be shareable and must not survive a reload.
 * A URL that says "you asked to sign out" is a URL that says it again on the next cold start,
 * where the reader is not signed out at all.
 *
 * ## Why it is safe to leave set
 *
 * A failed sign-out does not clear it, and that is deliberate. Every route to
 * `status === "signed-out"` in this app *is* a sign-out — the session provider sets it in
 * exactly one place, `lib/auth/session.tsx`'s `signOut` — so a note left over from an attempt
 * that failed can only ever be honoured by a later, genuine sign-out. A stale note cannot
 * cause a wrong redirect, and clearing it on failure would *create* one: the failure path is
 * where the reader is most likely to be signed out anyway (see the residual in
 * `app/(business)/account.tsx`'s docblock), and a cleared note is a note that will not fire
 * when the session finally does go.
 *
 * ## No imports
 *
 * For the reason `theme/select.ts` is its own file: nothing in the test suite loads
 * `react-native`, so a module that can be imported with nothing else is a module that can be
 * tested. This file is the state half of that, and `sign-out-intent.test.ts` is the proof.
 */

/**
 * What the reader is being sent to, and the only member today.
 *
 * A union rather than a boolean because "sent to the sign-in form" is a claim about a
 * destination, and a boolean would leave the next destination free to be spelled as whatever
 * the caller felt like — which is how two surfaces end up routing one event to two different
 * places. Adding a second destination is a second member and a second case where it is read.
 */
export type SignOutDestination = "authenticate";

let destination: SignOutDestination | null = null;

/**
 * Record that a sign-out was asked for. Called by the screen, before the call goes out.
 *
 * **Before**, deliberately. The note has to be in place by the time `status` flips, because
 * the flip and the unmount happen in one commit and there is no later moment at which the
 * screen could still write it.
 */
export function requestSignOutNavigation(to: SignOutDestination): void {
	destination = to;
}

/**
 * Read the note and clear it, for the one consumer.
 *
 * Read-and-clear rather than a read, so a second reader finds nothing and cannot navigate
 * twice. This is `takeDegradation`'s shape and for `takeDegradation`'s reason: the reader is
 * the frame that acts on the transition, and only that frame.
 */
export function takeSignOutNavigation(): SignOutDestination | null {
	const value = destination;
	destination = null;
	return value;
}
