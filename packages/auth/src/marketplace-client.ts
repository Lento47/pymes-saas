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
		const response = await fetch(`${baseUrl}/auth/${path}`, {
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
			throw new Error(
				response.status === 429
					? "auth.error.rateLimited"
					: response.status === 401
						? "auth.error.invalidCredentials"
						: "auth.error.generic",
			);
		}
		const next = response.headers.get("set-auth-token");
		if (next && storage) await storage.setItem(TOKEN_KEY, next);
		return response;
	}
	return {
		async signIn(email: string, password: string) {
			await request("sign-in/email", { email, password });
		},
		async signUp(email: string, password: string, name: string) {
			await request("sign-up/email", { email, password, name });
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
