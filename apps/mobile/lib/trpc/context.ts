import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "api/app-router";

/**
 * The tRPC/React Query binding, shared by every screen in this app.
 *
 * `createTRPCContext`, from `@trpc/tanstack-react-query`, rather than the older
 * `createTRPCReact`: this one builds its proxy over React Query's own `queryOptions` and
 * `mutationOptions`, so a screen hands what those return straight to `useQuery` and gets
 * React Query's behaviour — the interval, the retry, the cache — instead of a second
 * implementation of it running beside the first. One cache, so "the order moved"
 * invalidates the same keys the screen is already reading, which is what
 * `trpc.orders.pathKey()` in `app/order/[id]` is for.
 *
 * This claimed that cache held three things tRPC does not own — "the live order socket, the
 * device location, the storefront prefetch" — and none of the three is in it, or anywhere
 * else in this app. There is no socket on the phone either: `app/order/[id]` polls
 * `orders.byId`, and `components/order-timeline` already says so where a reader would go
 * looking for a connection. The device location is `useState` in `lib/location.ts`,
 * deliberately outside the cache, because a denied permission, location services switched
 * off and a fix that timed out all collapse to `null` and a null has nothing to invalidate.
 * There is no prefetch. The one cache is still why the choice was made; it simply never held
 * those three.
 *
 * The router type is imported as a **type only**. `api/app-router` re-exports it from a
 * file that exports nothing else, so this import adds no runtime code to the phone
 * bundle — the Worker is not shipped to the customer, and on a phone that is not a
 * nicety: the bundle is a download.
 */
export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();
