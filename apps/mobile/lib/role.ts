import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { useSession } from "@/lib/auth/session";
import {
	type AccountProfile,
	ensureDevicePrefsLoaded,
	getAccountProfile,
	getPrefsLoaded,
	setAccountProfile,
	subscribeAccountProfile,
	subscribePrefsLoaded,
} from "@/lib/device-prefs";
import { useTRPC } from "@/lib/trpc/context";

/**
 * Which stack this device should draw, resolved at cold start.
 *
 * `docs/architecture.md` §8 is the spec this implements; the short version is that
 * **entitlement is the server's and preference is the device's**, and this module is the one
 * place that reconciles them. It decides nothing about permission — `apps/api`'s
 * `businessProcedure(capability)` re-reads `membership` rows on every request and is the only
 * thing that does. This is *navigation*: which of three trees to mount.
 *
 * ## The fast path, and why there is a query at all
 *
 * `preference.profile === "customer"` returns before any query is enabled. That is the
 * overwhelming majority of launches and it needs neither the session nor a membership read to
 * draw a home feed — paying for both is the difference between a ~200ms launch and a ~2s one.
 * `users.me` is therefore `enabled: wantsRole && signed-in`, so the customer path sends
 * nothing at all.
 *
 * ## Three answers, never one
 *
 * `memberships === undefined` (the read is in flight) and a failed read are not the same as
 * "the membership is gone", and they must not print the same sentence: *we could not reach the
 * server* offers a retry, *your membership ended* offers the account hub. The third — a
 * courier preference with no profile yet — is not a failure at all: the identification was
 * made at sign-in/sign-up and the profile arrives when they fill it in, so it resolves
 * `delivery` with a `pending` mark and the delivery tree draws its own state.
 * Degrading to the customer stack is right for the two real failures — the sentence is what
 * differs. Signing out is a fourth case
 * and gets **no** notice and **no** correction: a preference is not revoked by a logout, and
 * an owner who signs back in should find their board again.
 *
 * ## A courier is a profile, not a membership
 *
 * The rule this module originally encoded — *a courier is someone with a `COURIER`
 * membership* — was true and then stopped being true. Opening the delivery pool to every
 * verified courier means the common courier belongs to no business at all, so a membership
 * read would demote the majority of them to the customer stack on every cold start. The
 * courier's root is now `users.me`'s `courier` field, and `memberships` is asked only about
 * shop staff. `users.me` is still the single read both clients make at cold start, so this
 * cost nothing at launch.
 *
 * ## The correction is in memory first, and persisted after
 *
 * Nothing here awaits during render — a write during render is a React violation, and the
 * usual repair (an effect that sets state) would paint the wrong stack for a frame before
 * fixing it. So the resolved value is computed purely, the frame draws the customer stack
 * with its notice, and one effect persists `setAccountProfile("customer")` afterwards.
 */

/** Why a device that asked for a role is drawing the customer stack anyway. */
export type RoleDegradation = "unreachable" | "ended" | "pending";

/**
 * The boot state carries the **preference**, not a role, and the difference is the whole
 * point of the two members: a preference is what the device was told to draw, a role is what
 * the server confirmed it may draw. Only the second may decide anything about entitlement, and
 * nothing does — `theme/select.ts` is the one consumer of the first, and all it does with it is
 * pick a palette for the frame before the answer arrives, which is a question about how this
 * device has always drawn itself rather than about what anybody is allowed to see.
 *
 * The window is real and it is the whole cold start: `AsyncStorage` for the preference, the
 * keychain for the session, then `users.me` over the network. Publishing the preference is what
 * lets a merchant's first frame be white instead of the consumer palette's blue.
 *
 * Its cost, stated rather than hidden: the signed-out branch below keeps the preference on
 * purpose, so a device that signed out of a shop still holds `preference === "business"` and
 * that frame is drawn in the merchant palette before being corrected. The keychain read is tens
 * of milliseconds and it sits behind the native splash, which is the only reason this is worth it.
 */
export type ResolvedRole =
	| { state: "boot"; preference: AccountProfile }
	| { state: "ready"; role: AccountProfile; degraded: RoleDegradation | null };

/** Read-and-clear the last degradation, for the screen the resolver lands on. */
let degradation: RoleDegradation | null = null;

/**
 * The one notice about being downgraded, consumed once.
 *
 * A module value rather than a route param so the sentence is not shareable and does not
 * survive a reload: it explains a transition the reader just lived through, and a URL that
 * says "your membership ended" is a URL that says it again tomorrow.
 */
export function takeDegradation(): RoleDegradation | null {
	const value = degradation;
	degradation = null;
	return value;
}

export function useResolvedRole(): ResolvedRole {
	const { status } = useSession();
	const trpc = useTRPC();

	const preference = useSyncExternalStore(
		subscribeAccountProfile,
		getAccountProfile,
		getAccountProfile,
	);
	/**
	 * `loaded` is a **shared** fact, not a per-instance one, and that is the whole point.
	 *
	 * This used to be `useState` per call site with an unmemoised `initDevicePrefs()` in each
	 * one, so the four call sites read AsyncStorage four times and each moved from
	 * `state: "boot"` to `state: "ready"` on its own schedule. That put two copies of this
	 * answer on two different clocks, and they answer a navigation question: `app/index.tsx`
	 * chooses the destination tree from its copy, while `app/_layout.tsx`'s `ThemedStack`
	 * chooses from its copy whether the root Stack has registered that destination yet. A copy
	 * that is ready first dispatches a `REPLACE` the Stack cannot answer, React Navigation
	 * reports it as unhandled and drops it, and the reader is left on a screen whose only
	 * output is a redirect that never fired.
	 *
	 * Subscribing through `useSyncExternalStore` — the same shape as the `preference` line above,
	 * and the reason that one was never a bug — makes all four call sites flip in a single
	 * commit. `lib/device-prefs.ts` carries the reason at the store.
	 */
	const loaded = useSyncExternalStore(
		subscribePrefsLoaded,
		getPrefsLoaded,
		getPrefsLoaded,
	);

	// AsyncStorage is the only async on the fast path, and the session read it starts is the
	// one that fills the cache `getAccountProfile()` reads synchronously from.
	useEffect(() => {
		ensureDevicePrefsLoaded();
	}, []);

	const wantsRole = preference !== "customer";
	const me = useQuery(
		trpc.users.me.queryOptions(undefined, {
			enabled: wantsRole && status === "signed-in",
		}),
	);

	let resolved: ResolvedRole;
	if (!loaded) {
		resolved = { state: "boot", preference };
	} else if (!wantsRole) {
		// The fast path: the common case, with no request behind it at all.
		resolved = { state: "ready", role: "customer", degraded: null };
	} else if (status === "loading") {
		// The session is still coming out of the keychain: answering customer
		// now would redirect before there is anything to check against, and the
		// root redirect fires once — a reader who resolves signed-in a frame
		// later would already be standing in the wrong tree. Boot waits.
		resolved = { state: "boot", preference };
	} else if (status !== "signed-in") {
		// Signed out: nothing to verify against, and nothing to correct. The preference
		// survives, so signing back in finds the board again.
		resolved = { state: "ready", role: "customer", degraded: null };
	} else if (me.isError) {
		resolved = { state: "ready", role: "customer", degraded: "unreachable" };
	} else if (me.data === undefined) {
		resolved = { state: "boot", preference };
	} else if (me.data.courier) {
		// **The courier profile is the root, not a membership.**
		//
		// This branch used to read `memberships.some(m => m.role === "COURIER")`, which was
		// correct while accepting a business invitation was the only way to become a courier.
		// It is the change that made the app usable at all: the delivery pool is now every
		// verified courier on the platform, so the *typical* courier has no membership
		// anywhere, and the old read would have bounced every one of them to the shopping
		// feed at cold start. `users.me` carries the profile's own state instead.
		//
		// A courier profile resolves to the delivery tree whatever the preference says and
		// whatever the profile's state is. A `PENDING` profile is still a courier waiting on
		// the platform to review them, and degrading them to the customer feed would be
		// saying "you are not a courier yet" to someone who becomes one by waiting — the
		// `pending` mark is what tells the tree to draw that wait instead of a board.
		//
		// The preference is not consulted because the profile is the stronger fact: someone
		// who filled in a courier profile and also owns a shop is drawing the merchant
		// stack, and this is the branch that puts them back on the delivery board.
		//
		// **Truthiness, not `!== null`.** The field is typed `MeCourier | null`, and a
		// `!== null` test is also true for `undefined` — which is what a *deployed* server
		// predating the field actually returns, because tRPC validates no output anywhere in
		// this repo (there is not a single `.output()` call). The typed read and the running
		// read therefore disagree, and the typed one crashes the whole app at cold start
		// against an older deploy. A falsy check treats absent, `null` and empty as the
		// same answer, which is what all three mean.
		resolved = {
			state: "ready",
			role: "delivery",
			degraded:
				me.data.courier.verificationStatus === "PENDING" ? "pending" : null,
		};
	} else if (preference === "delivery") {
		// Identified as a courier at sign-in (`auth.role.*`) who has not opened the courier
		// profile yet. Degrading to the customer stack would send a newly identified courier
		// to the shopping feed; the delivery tree draws its own wait state and nothing there
		// 403s, because `users.me` is the session's own read and every delivery procedure
		// is `protectedProcedure`.
		resolved = { state: "ready", role: "delivery", degraded: "pending" };
	} else if (
		me.data.memberships.some((membership) => membership.role !== "COURIER")
	) {
		// A shop they actually belong to. The `role !== "COURIER"` half is the same fact as
		// the branch above, stated as a filter: a membership with the COURIER role is not
		// staff, and a shop board for it would 403 on every call.
		resolved = { state: "ready", role: preference, degraded: null };
	} else {
		// The preference outlived the entitlement: the shop was closed, the membership
		// lapsed, and this person is no longer a courier either. This is the branch nobody
		// writes and everybody hits — an owner unlinked on Tuesday must not open a business
		// stack on Wednesday that 403s on every call.
		resolved = { state: "ready", role: "customer", degraded: "ended" };
	}

	// Persist only a real downgrade, and only once the right thing is already being drawn —
	// see the file docblock. `degradation` is written here too, in the same effect, so the
	// reader is the screen this navigates to rather than a render-phase side effect.
	//
	// Only `ended` is persisted: the memberships read *succeeded* and the row is gone,
	// so the preference names a role nobody holds. `unreachable` is a failed read, and
	// a failed read must not rewrite a stored choice — a flaky network at cold start
	// would demote every owner to the customer hub permanently, and the next launch
	// would have no memory anything else was ever chosen. The notice still fires for
	// both; only the storage write is gated.
	//
	// Narrowed into `degraded` *before* the effect rather than inside it: the guard below
	// narrows `resolved`, but a dependency array is evaluated outside any narrowing, so
	// `[resolved.state, resolved.degraded]` did not type-check. One local is also the clearer
	// dependency — the effect is keyed on the answer, not on the object that carried it.
	const degraded = resolved.state === "ready" ? resolved.degraded : null;
	useEffect(() => {
		if (degraded === null) return;
		degradation = degraded;
		if (degraded === "ended") void setAccountProfile("customer");
	}, [degraded]);

	return resolved;
}
