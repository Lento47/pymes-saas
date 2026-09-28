import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useSession } from "@/lib/auth/session";
import {
	type AccountProfile,
	getAccountProfile,
	initDevicePrefs,
	setAccountProfile,
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
 * courier preference whose memberships carry no `COURIER` row — is not a failure at all:
 * the identification was made at sign-in/sign-up and the membership arrives later, so it
 * resolves `delivery` with a `pending` mark and the delivery tree draws its own state.
 * Degrading to the customer stack is right for the two real failures — the sentence is what
 * differs. Signing out is a fourth case
 * and gets **no** notice and **no** correction: a preference is not revoked by a logout, and
 * an owner who signs back in should find their board again.
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

export type ResolvedRole =
	| { state: "boot" }
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

	const [preference, setPreference] = useState<AccountProfile>("customer");
	const [loaded, setLoaded] = useState(false);

	// AsyncStorage is the only async on the fast path, and `initDevicePrefs` is the same call
	// `app/_layout.tsx` makes at start-up — idempotent, and it is what fills the cache
	// `getAccountProfile()` reads synchronously from.
	useEffect(() => {
		void initDevicePrefs().then(() => {
			setPreference(getAccountProfile());
			setLoaded(true);
		});
	}, []);

	const wantsRole = preference !== "customer";
	const me = useQuery(
		trpc.users.me.queryOptions(undefined, {
			enabled: wantsRole && status === "signed-in",
		}),
	);

	let resolved: ResolvedRole;
	if (!loaded) {
		resolved = { state: "boot" };
	} else if (!wantsRole) {
		// The fast path: the common case, with no request behind it at all.
		resolved = { state: "ready", role: "customer", degraded: null };
	} else if (status === "loading") {
		// The session is still coming out of the keychain: answering customer
		// now would redirect before there is anything to check against, and the
		// root redirect fires once — a reader who resolves signed-in a frame
		// later would already be standing in the wrong tree. Boot waits.
		resolved = { state: "boot" };
	} else if (status !== "signed-in") {
		// Signed out: nothing to verify against, and nothing to correct. The preference
		// survives, so signing back in finds the board again.
		resolved = { state: "ready", role: "customer", degraded: null };
	} else if (me.isError) {
		resolved = { state: "ready", role: "customer", degraded: "unreachable" };
	} else if (me.data === undefined) {
		resolved = { state: "boot" };
	} else if (
		me.data.memberships.some((membership) =>
			membership.role !== "COURIER"
				? preference === "business"
				: preference === "delivery",
		)
	) {
		resolved = { state: "ready", role: preference, degraded: null };
	} else if (preference === "delivery") {
		// The courier in waiting: the identification was made at sign-in/sign-up
		// (`auth.role.*`), and the membership that makes the board work arrives later,
		// after the courier creates a profile and accepts a business invitation. Degrading
		// this device to the customer stack would send a newly identified courier to the
		// shopping feed; the delivery tree instead draws its own pending state
		// (`biz.courier.pending.*`), and nothing there 403s — `myBusinesses` is the
		// session's own read, and the board mounts only once a `COURIER` row answers.
		resolved = { state: "ready", role: "delivery", degraded: "pending" };
	} else {
		// The preference outlived the entitlement: the shop was closed, the courier was
		// deactivated, the membership lapsed. This is the branch nobody writes and everybody
		// hits — a courier unlinked on Tuesday must not open a delivery stack on Wednesday
		// that 403s on every call.
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
