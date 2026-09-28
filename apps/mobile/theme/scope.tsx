import { createContext, type ReactNode, use } from "react";

import { useResolvedRole } from "@/lib/role";

import type { PaletteRole } from "./select";

/**
 * The role, published once so the palette can be chosen before a route can be named.
 *
 * ## Why a context instead of calling `useResolvedRole()` inside `useTheme()`
 *
 * Because `useResolvedRole()` runs a query. It is `useQuery(trpc.users.me)` plus a keychain read
 * and an AsyncStorage read, and `useTheme()` is called by roughly sixty components — every
 * button, card, row, sheet, skeleton and text run in the app. Calling it there would attach a
 * `users.me` observer to each of them, so a single membership change would re-render the entire
 * tree out of a colour lookup. The role is one fact with one owner, and this is that owner: it is
 * resolved a single time here, and everything below reads the answer as a context value.
 *
 * ## Why the value is a primitive, and why `undefined` is the mount test
 *
 * `AccountProfile`, never an object. An object identity would change on every render of this
 * provider and re-render every subscriber with it — sixty components, on a value that almost
 * never changes. `lib/role.ts:162` makes the same narrowing for `degraded` and gives the reason:
 * a value carried inside a fresh object is a value that changes when nothing did. The cost of
 * getting that wrong is invisible in a diff and enormous in a profile, which is the worst place
 * to find it.
 *
 * The same reasoning makes `undefined` the right "no provider above me" marker rather than
 * `null`. `lib/role.ts`'s boot state carries `preference`, and `AccountProfile` has three members
 * and no null one, so this provider can never publish `undefined` — which means a single context
 * carries both the answer and the proof that it was given, with no second context and no sentinel
 * to keep in step.
 *
 * ## Where it mounts, and why that spot
 *
 * `app/_layout.tsx`, between `ApiProvider` and `PushNotificationsProvider`. It has to be **below**
 * `ApiProvider` because `lib/role.ts` needs both `useSession()` and `useTRPC()`, and `ApiProvider`
 * is what supplies `QueryClientProvider` and `TRPCProvider`. It has to be **above**
 * `SafeAreaProvider`, `RollbackProvider`, `ToastProvider`, `ThemedStack` and `WelcomeAnimation`,
 * because those — and every screen beneath them — are the only things in the app that read
 * `useTheme()`, and a colour lookup that could throw for want of a provider is one that will.
 */
const ThemeScopeContext = createContext<PaletteRole | undefined>(undefined);

export function ThemeScopeProvider({ children }: { children: ReactNode }) {
	const resolved = useResolvedRole();
	// While the answer is in flight the stored preference is the best answer there is, and it is
	// the only one that makes a merchant's first frame white rather than the consumer palette's
	// blue. Once the server has spoken, the confirmed role replaces it — including when that
	// answer is "customer", which is what a signed-out device resolves to, and which is why
	// signing out cannot leave a merchant palette behind on the sign-in form.
	const role = resolved.state === "ready" ? resolved.role : resolved.preference;

	return <ThemeScopeContext value={role}>{children}</ThemeScopeContext>;
}

/**
 * The role to select a palette with.
 *
 * Throws outside the provider rather than falling back to `"customer"`, which is the same call
 * `useThemeMode()` makes in `./mode.tsx` and for the same reason. A silent fallback would resolve
 * to the consumer palette, so a provider mounted in the wrong place would ship a merchant console
 * in blue with nothing in the log to say why. A thrown error at the first render is found in a
 * minute.
 */
export function useThemeScope(): PaletteRole {
	const role = use(ThemeScopeContext);
	if (role === undefined) {
		throw new Error(
			"useThemeScope() fuera de <ThemeScopeProvider>. Lo monta el layout raíz.",
		);
	}
	return role;
}
