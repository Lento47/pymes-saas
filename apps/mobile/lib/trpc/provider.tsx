import {
	focusManager,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import { type ReactNode, useEffect, useState } from "react";
import { AppState } from "react-native";
import superjson from "superjson";
import { accessToken, hasKeychain } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

import { TRPCProvider } from "./context";

/**
 * The data layer: one tRPC client, one React Query cache, for every screen.
 *
 * The client talks to `apps/api` directly rather than through an Expo API route or a
 * proxy. That is a deliberate trade and it is the whole point of this architecture: the
 * phone and the web app hit the *same* Worker with the *same* token and the same error
 * contract, so "it works on the web" means something about the app. A proxy would be a
 * second data surface with its own bugs and its own idea of what a 404 is — and the first
 * rule of the API is that there is one surface.
 */
export function ApiProvider({ children }: { children: ReactNode }) {
	const { refresh, session } = useSession();

	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// A marketplace is a menu, a cart and an order — all of which change
						// because somebody else changed them. Thirty seconds is short enough
						// that a customer does not order something that sold out while the app
						// sat in the background, and long enough that tapping between a store
						// and back does not refetch the whole menu.
						staleTime: 30_000,
						// A 4xx is an answer, not a blip: retrying a 403 three times turns a
						// permission into a spinner.
						retry: (failureCount, error) => {
							const status = httpStatusOf(error);
							if (status !== null && status >= 400 && status < 500) {
								return false;
							}
							return failureCount < 2;
						},
					},
				},
			}),
	);

	/**
	 * Refetch when the app comes back to the foreground.
	 *
	 * React Query's `refetchOnWindowFocus` has no window to listen to on a phone, so
	 * without this an app left open overnight renders yesterday's order board and
	 * yesterday's prices with no refresh until something is tapped. `AppState` is the
	 * platform's own answer to "is this app in front of somebody", and `focusManager` is
	 * React Query's hook for feeding it.
	 */
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			focusManager.setFocused(state === "active");
		});
		return () => subscription.remove();
	}, []);

	/**
	 * The previous customer's data leaves the cache when the signed-in user changes.
	 *
	 * On a shared device the next person to sign in must not see the last person's cart,
	 * orders or profile, and the cache is where all three are sitting.
	 *
	 * ## `resetQueries`, and not `clear`
	 *
	 * Both empty the cache, so both do that job. They differ in what they leave behind for
	 * the screens that are on the screen *right now*, and the difference is not cosmetic —
	 * `clear()` removes the query objects themselves, and an observer whose query has been
	 * removed from under it is not re-pointed at anything. `QueryObserver` does not handle
	 * the cache's `removed` event, its `#currentQuery` goes on referring to a destroyed
	 * `Query` whose retryer was cancelled, and a re-render will not fetch: `shouldFetchOnMount`
	 * is false for an observer that already has listeners. The result is a query that is
	 * `isPending` with nothing in flight, for good.
	 *
	 * That is the shape of the defect this replaced, and it was only visible on a **cold load
	 * while signed in**. Render one happens before the session has resolved, so the effect's
	 * dependency is still `undefined` and the feed is already fetching; the session resolves a
	 * tick later, `userId` changes, and `clear()` threw away the answer that had just arrived
	 * and cancelled the one still coming. The home screen's `waiting || !data` then held its
	 * skeleton indefinitely while the network log showed `catalog.feed` returning 200 — the
	 * data was fetched and discarded. Anonymous cold loads rendered fine, because `userId`
	 * never changes and `clear()` therefore ran once at mount against an empty cache, before
	 * there was anything to destroy. Signing in and *then* navigating worked for the same
	 * reason in reverse: the home screen mounted after the clear, and a real mount does fetch.
	 *
	 * `resetQueries` keeps the objects, empties their data and refetches what is being watched
	 * (`refetchQueries` with `type: "active"`), so the privacy guarantee holds and the screens
	 * on top of the change recover on their own.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: `session?.userId` is a trigger, not a value the effect reads — emptying the cache when the signed-in user changes is the entire purpose of this effect, and the linter's suggested fix (deleting the dependency) would leave the previous customer's cart, orders and profile in the cache for the next person who signs in on the same device.
	useEffect(() => {
		void queryClient.resetQueries();
	}, [queryClient, session?.userId]);

	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				httpBatchLink({
					url: `${env.apiUrl}/trpc`,
					/**
					 * The same transformer the Worker runs.
					 *
					 * Almost every shape here carries a timestamp — `createdAt`, `placedAt`,
					 * `estimatedReadyAt` — and without this they arrive as strings that each
					 * screen has to know to parse. That knowledge, spread across three clients,
					 * is how a phone ends up rendering an ISO string as a day name.
					 */
					transformer: superjson,
					/**
					 * Read fresh per request, because the SDK refreshes the token in the
					 * background. A token captured once at boot is one that expired while the
					 * customer was reading the menu, and the 401 that follows reads as "the
					 * app logged me out".
					 */
					headers: async () => {
						const token = await accessToken();
						return token ? { authorization: `Bearer ${token}` } : {};
					},
					/**
					 * A 401 means the token we sent is no longer good, and the honest response
					 * is to go and look rather than to keep sending it. One `refresh()` and
					 * the next request carries whatever the session now says — which covers the
					 * case a background refresh raced, without a retry loop that would hammer
					 * an API that is refusing us on purpose.
					 *
					 * The same rule is applied a second time in `lib/api-error.ts`, because a
					 * batch can carry a 401 on one procedure and this wrapper sees only the
					 * response's status, not which call produced it.
					 */
					fetch: async (input, init) => {
						const response = await fetch(input, {
							...init,
							// The same split `@pymeshub/auth` makes for `/auth/*`, and it has to be
							// made here too or the browser is signed in on one transport and
							// anonymous on the other: a phone sends its bearer token and must not
							// carry a cookie, a browser has no token to send and its session *is*
							// the cookie — `omit` there drops the `Cookie` header, and every tRPC
							// call arrives unauthenticated on a page that just signed in
							// successfully. `hasKeychain`, not a fresh `Platform.OS` check, so the
							// two transports cannot drift apart.
							credentials: hasKeychain ? "omit" : "include",
						});
						if (response.status === 401) void refresh();
						return response;
					},
				}),
			],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		</QueryClientProvider>
	);
}

/** tRPC reports status in a few places depending on whether it is a domain error. */
function httpStatusOf(error: unknown): number | null {
	if (typeof error !== "object" || error === null) return null;
	const data = (error as { data?: { httpStatus?: unknown } }).data;
	return typeof data?.httpStatus === "number" ? data.httpStatus : null;
}
