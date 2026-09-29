export type MarketplaceSession = {
	userId: string;
	email: string | null;
	accessToken: string;
	expiresAt: number | null;
};
export type TokenStorage = {
	getItem: (key: string) => Promise<string | null>;
	setItem: (key: string, value: string) => Promise<void>;
	removeItem: (key: string) => Promise<void>;
};
const TOKEN_KEY = "pymeshub.session";

/** Web uses an HttpOnly cookie; native uses the OS keychain and a bearer token. */
export function createMarketplaceAuthClient(
	baseUrl: string,
	storage?: TokenStorage,
) {
	async function request(path: string, body?: unknown) {
		const token = storage ? await storage.getItem(TOKEN_KEY) : null;
		const endpoint = path.startsWith("/") ? path : `/auth/${path}`;
		const response = await fetch(`${baseUrl}${endpoint}`, {
			method: body === undefined ? "GET" : "POST",
			credentials: storage ? "omit" : "include",
			headers: {
				...(body === undefined ? {} : { "content-type": "application/json" }),
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!response.ok) {
			if (response.status === 401 && storage)
				await storage.removeItem(TOKEN_KEY);
			// The Worker's own error code, when it sent one, is carried on the thrown
			// error rather than thrown away. A 400 that means "ask for the terms" and a
			// 400 that means "that body is malformed" are the same status and two
			// completely different things for a caller to do about, and collapsing both
			// into `generic` is what made the Supabase exchange need a second round trip
			// to find out. `authErrorKey` still only maps the three keys below, so nothing
			// new reaches a screen by accident.
			let code: string | undefined;
			try {
				const parsed: unknown = await response.clone().json();
				if (typeof parsed === "object" && parsed !== null) {
					const error = (parsed as { error?: unknown }).error;
					if (typeof error === "string") code = error;
				}
			} catch {
				// A non-JSON error body is not a code; the status still is.
			}
			const failure = new Error(
				response.status === 429
					? "auth.error.rateLimited"
					: response.status === 401
						? "auth.error.invalidCredentials"
						: "auth.error.generic",
			) as Error & { code?: string };
			if (code) failure.code = code;
			throw failure;
		}
		const next = response.headers.get("set-auth-token");
		if (next && storage) await storage.setItem(TOKEN_KEY, next);
		return response;
	}
	return {
		async signIn(email: string, password: string) {
			await request("sign-in/email", { email, password });
		},
		/**
		 * The two assertions, sent because the Worker refuses a sign-up without them.
		 *
		 * `packages/trpc-api/src/auth.ts` gates `create.before` on `termsAccepted` and
		 * `ageConfirmed` being exactly `true`, and throws a 400 naming whichever is
		 * missing. Both flags are required parameters rather than optional ones so a
		 * caller cannot forget: a screen that omits them gets a rejection at runtime,
		 * and a signature that omits them gets a compile error instead.
		 *
		 * They travel in the sign-up body and are stripped by the hook before the
		 * `user` insert — they are not columns on that table. What persists is the
		 * `account_consent` row the hook's `after` writes.
		 */
		async signUp(
			email: string,
			password: string,
			name: string,
			assertions: { termsAccepted: boolean; ageConfirmed: boolean },
		) {
			await request("sign-up/email", { email, password, name, ...assertions });
		},
		/**
		 * Exchange a Supabase access token for the marketplace's own session.
		 *
		 * This is deliberately a second endpoint rather than a flag on `request`: the
		 * bearer that arrives here belongs to Supabase, while every request after the
		 * exchange belongs to Better Auth. The response is persisted by the same
		 * `set-auth-token` path as an ordinary sign-in, so the rest of the app never
		 * needs to know which provider opened the door.
		 */
		/**
		 * Exchange a Supabase access token for a marketplace session.
		 *
		 * The bearer that arrives here belongs to Supabase, while every request after the
		 * exchange belongs to Better Auth. The response is persisted by the same
		 * `set-auth-token` path as an ordinary sign-in, so the rest of the app never
		 * needs to know which provider opened the door.
		 *
		 * **Two steps, because the marketplace does not auto-answer this.** The Worker
		 * creates the D1 user on first exchange, and `account_consent` declares
		 * `termsAcceptedAt` / `ageConfirmedAt` as NOT NULL — "a row exists because they
		 * were". So an identity the marketplace has never seen is refused with
		 * `consent_required` until the two assertions are supplied, and one it has seen
		 * exchanges straight away. Calling this without `consent` is therefore the
		 * normal first call for a returning reader, and the caller only has to collect
		 * the assertions when the answer says they are needed.
		 */
		async exchangeSupabaseSession(
			accessToken: string,
			consent?: { termsAccepted: boolean; ageConfirmed: boolean },
		): Promise<"ok" | "consent_required"> {
			try {
				await request("/auth-supabase/exchange", {
					accessToken,
					...(consent ?? {}),
				});
				return "ok";
			} catch (error) {
				const code = (error as { code?: unknown }).code;
				if (code === "consent_required") return "consent_required";
				throw error;
			}
		},
		async signOut() {
			await request("sign-out", {});
			if (storage) await storage.removeItem(TOKEN_KEY);
		},
		/**
		 * Set a new password, proving the current one.
		 *
		 * Better Auth's `/change-password` (verified against better-auth 1.7.5's
		 * `update-user.mjs`: `POST`, `{ currentPassword, newPassword }`). A wrong
		 * current password arrives as a 400, which the transport above folds into
		 * `auth.error.generic` — the screen states its own field rules before the
		 * round trip instead, the same split `session.tsx`'s `authErrorKey` makes.
		 */
		async changePassword(currentPassword: string, newPassword: string) {
			await request("change-password", { currentPassword, newPassword });
		},
		/**
		 * Drop every session but this one.
		 *
		 * Better Auth's `/revoke-other-sessions` (`session.mjs`, same version). The
		 * bearer token rides along exactly as it does for every other call, so the
		 * server knows which session is "this one".
		 */
		async revokeOtherSessions() {
			await request("revoke-other-sessions", {});
		},
		/**
		 * Ask for a new identifier. The caller re-reads `users.me` afterwards.
		 *
		 * Verified against better-auth 1.7.5 (`update-user.mjs`): the endpoint
		 * answers 200 when the address is already taken and changes nothing
		 * (anti-enumeration), so a status of `true` is not proof the email
		 * moved — the screen compares the re-read row against what it sent and
		 * reports `auth.error.emailInUse` when they differ.
		 */
		async changeEmail(newEmail: string) {
			await request("change-email", { newEmail });
		},
		async accessToken() {
			return storage ? storage.getItem(TOKEN_KEY) : null;
		},
		async currentSession(): Promise<MarketplaceSession | null> {
			const response = await request("get-session");
			const data = (await response.json()) as {
				user: { id: string; email: string };
				session: { expiresAt: string };
			} | null;
			if (!data) {
				if (storage) await storage.removeItem(TOKEN_KEY);
				return null;
			}
			return {
				userId: data.user.id,
				email: data.user.email,
				accessToken: storage ? ((await storage.getItem(TOKEN_KEY)) ?? "") : "",
				expiresAt: new Date(data.session.expiresAt).getTime() / 1000,
			};
		},
	};
}
