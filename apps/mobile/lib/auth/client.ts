import { createMarketplaceAuthClient } from "@pymeshub/auth/marketplace-client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { env } from "@/lib/env";

/**
 * Whether this platform has an OS keychain for a bearer token to live in.
 *
 * `expo-secure-store` resolves on every platform, and on web it resolves to a shim whose
 * entire content is `export default {}`. `getItemAsync` forwards straight into it —
 * `await ExpoSecureStore.getValueWithKeyAsync(key, options)` — so a read does not fail with
 * a reason a caller could branch on; it throws `TypeError: … is not a function`, a method
 * missing from an empty object. And the read is the *first* thing `@pymeshub/auth`'s
 * transport does, on the line before it builds a request, so a browser handed this store
 * could not read a token, could not write one, and could not sign in.
 *
 * The fix is not to guard the store — it is to not hand it over. `marketplace-client.ts`
 * opens with the contract: *"Web uses an HttpOnly cookie; native uses the OS keychain and a
 * bearer token."* The same `storage` argument that reads a token is the one that decides
 * `credentials: "omit"` versus `"include"` and whether a `set-auth-token` response is
 * persisted. Passing nothing is the browser's configuration, not a fallback for it: there
 * the session arrives as a cookie the page cannot read, which is the entire point of it.
 * The tRPC transport reads the same flag, in `lib/trpc/provider.tsx`.
 *
 * The module answers the availability question itself: `SecureStore.isAvailableAsync()` is
 * written as `!!ExpoSecureStore.getValueWithKeyAsync` and truthfully returns `false` here.
 * It is async, and that is why this does not call it — the store is chosen once, at module
 * load, before any promise could settle. The platform is known synchronously and answers
 * the same question, so this reads the platform. If the two ever disagree,
 * `isAvailableAsync` is the authority and this line is the bug.
 */
export const hasKeychain = Platform.OS !== "web";

export const marketplaceAuth = createMarketplaceAuthClient(
	env.apiUrl,
	hasKeychain
		? {
				getItem: SecureStore.getItemAsync,
				setItem: SecureStore.setItemAsync,
				removeItem: SecureStore.deleteItemAsync,
			}
		: undefined,
);

export const currentSession = marketplaceAuth.currentSession;
export const accessToken = marketplaceAuth.accessToken;
