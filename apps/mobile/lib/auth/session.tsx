"use client";
import type { MarketplaceSession } from "@pymeshub/auth/marketplace-client";
import type { MessageKey } from "@pymeshub/i18n";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AppState } from "react-native";
import { marketplaceAuth } from "@/lib/auth/client";
/**
 * Who is signed in, for the whole app.
 *
 * The session is an identity and nothing else. Which business this person may open is
 * not decided here and cannot be: `apps/api` re-reads their `membership` rows in D1 on
 * every request, and a screen that hid a control on this context's word would be hiding
 * a button the API still refuses. The one thing this provider owns is the credential, and
 * it does not hold it: on a phone it is a bearer token in SecureStore, in a browser it is
 * an HttpOnly cookie the page cannot read. `@pymeshub/auth` attaches whichever one this
 * platform uses — `lib/auth/client.ts` chooses — and neither is ever in a file a bundle
 * ships.
 */
export type SessionStatus = "loading" | "signed-in" | "signed-out";
/**
 * A failure carries a **message key**, not a sentence.
 *
 * The keys live in `@pymeshub/i18n` and the screen renders them through `useT()`.
 * `@pymeshub/auth`'s transport has already reduced the response to one of three keys, so
 * nothing here ever shows text written for a network tab.
 */
export type SignInResult = { ok: true } | { ok: false; messageKey: string };
type SessionValue = {
	session: MarketplaceSession | null;
	status: SessionStatus;
	/**
	 * Every attempt at the read has been spent and the question is still open.
	 *
	 * Not a fourth status: `status` stays `"loading"`, because "we do not know yet" is
	 * still the honest answer and this does not change what is true — only what the screen
	 * can offer while it waits. It is here because a read that never answers used to leave
	 * `./signed-in` spinning with nothing to tap, and a spinner with no exit is a wall.
	 * The customer is not signed out and must not be told they are; they are offered
	 * `refresh`, which is the same read again.
	 */
	unanswered: boolean;
	signIn: (email: string, password: string) => Promise<SignInResult>;
	signUp: (
		email: string,
		password: string,
		name: string,
	) => Promise<SignInResult>;
	signOut: () => Promise<void>;
	/** Re-read the session. Called when the app comes back to the foreground. */
	refresh: () => Promise<void>;
};
const SessionContext = createContext<SessionValue | null>(null);
/**
 * The one message `@pymeshub/auth`'s transport throws for a refused credential.
 *
 * `request()` in `packages/auth/src/marketplace-client.ts` reduces every non-2xx response to
 * one of three keys, and this is the branch it takes for a 401 — the only one that means the
 * API has looked at the credential and said no. It is spelled out here rather than imported
 * because the transport exports no constant for it; `authErrorKey` below compares the same
 * literal, and if the transport ever renames one, both of these are the places that follow.
 */
const REFUSED_MESSAGE = "auth.error.invalidCredentials";
/**
 * Waits before a second and third attempt at the same read, in milliseconds.
 *
 * A read that failed for a reason the API did not state is a question that has not been
 * answered yet, and the usual reason is a moment of bad connectivity that is over in
 * seconds. Waiting costs the customer a spinner they were already looking at; not waiting
 * costs them their session, and there is no undo for that.
 */
const RETRY_DELAYS_MS = [1_000, 3_000];
/** One wait. `setTimeout` is the timer React Native runs, and this is only used here. */
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
export function SessionProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<MarketplaceSession | null>(null);
	const [status, setStatus] = useState<SessionStatus>("loading");
	const [unanswered, setUnanswered] = useState(false);
	/**
	 * Whether any read has ever come back with an answer, either one.
	 *
	 * A ref rather than state because nothing renders it — it exists so that a *later* read
	 * failing does not raise the stall card. Once a session has been learned, the app knows
	 * the answer and a failed re-read is a stale answer, not an open question; `status` is
	 * `"signed-in"` and the screens behind it are showing real content. Marking that as
	 * `unanswered` would put a retry card in front of a customer whose app works.
	 *
	 * A refusal counts as an answer — it is the API saying "this credential is not valid",
	 * which resolves the question to signed-out. Only a run of the loop that ends without
	 * either outcome leaves the question open.
	 */
	const answered = useRef(false);
	/**
	 * Which read is the current one, as a number that retires the reads before it.
	 *
	 * `read` runs a loop with two waits inside it (`RETRY_DELAYS_MS`), and it is called from
	 * four places: on mount, on every return to the foreground, by the retry control, and
	 * after a sign-in. Nothing retired the loop a previous call had left sleeping, so a phone
	 * taken out of a pocket three times had three loops alive at once — three `setTimeout`s
	 * held open, each of them about to spend a request on a question the newest loop was
	 * already asking, and the slowest of them free to write its older answer over the newer
	 * one when it finally came back.
	 *
	 * A counter rather than a per-call `cancelled` flag, because the loops overlap rather than
	 * nest: what retires a loop is not "the provider went away" but "a newer read owns this
	 * state now", and only the newest may write it. The unmount effect below bumps the same
	 * number, which is the other half of the same case — see the note there.
	 */
	const generation = useRef(0);
	const read = useCallback(async () => {
		const mine = ++generation.current;
		// Back to waiting while this attempt runs, so the retry the customer just tapped
		// shows them the spinner again rather than leaving the card up as if it were inert.
		setUnanswered(false);
		for (const delay of [0, ...RETRY_DELAYS_MS]) {
			if (delay > 0) {
				await sleep(delay);
				// Checked after the wait and not only before it: the wait is the whole of what
				// this loop holds, and the state it was reading may have been re-asked by a
				// newer call several times over while it slept.
				if (mine !== generation.current) return;
			}
			try {
				const next = await marketplaceAuth.currentSession();
				// The read itself is a round trip, so the same question is asked on the way
				// back: a newer call that started and finished while this one was in flight has
				// already written the answer, and this one is older than it.
				if (mine !== generation.current) return;
				answered.current = true;
				setSession(next);
				setStatus(next ? "signed-in" : "signed-out");
				return;
			} catch (error) {
				// Only a refusal is a fact about identity, and it is the one failure that
				// already acted on it: the transport drops the stored token before it throws
				// this key, so there is genuinely no session left to keep. Everything else a
				// read can fail with — a rate limit, a 500, a phone with no connection — is an
				// unanswered question, and the answer to an unanswered question is the answer
				// we already had. Rendering that as "signed out" would sign out a customer
				// whose token is in the keychain and whose session row is in D1 untouched.
				if (error instanceof Error && error.message === REFUSED_MESSAGE) {
					answered.current = true;
					setSession(null);
					setStatus("signed-out");
					return;
				}
				// Not a refusal, so nothing is decided here: the next turn of the loop asks
				// again, and if the last turn fails too the last known session and status stay
				// exactly as they were. That means `status` is still "loading" if a read has
				// never once been answered — the honest shape of "we do not know yet", and the
				// screens behind sign-in show the waiting shape rather than a sign-in prompt for
				// somebody who has not been signed out. The foreground handler below is what
				// turns that waiting back into an answer.
				//
				// What this does *not* do is fall back to signed-out once the retries are
				// spent. That fallback is the bug: it is the same claim about identity, made
				// later and with a delay in front of it.
			}
		}
		// Every attempt spent and nothing learned. Nothing is decided — `status` stays
		// "loading" — but the wait is now the customer's to end rather than one they can only
		// sit in, which is what `unanswered` is for. `./signed-in` renders the retry.
		if (mine !== generation.current) return;
		if (!answered.current) setUnanswered(true);
	}, []);
	useEffect(() => {
		void read();
	}, [read]);
	/**
	 * The provider going away is the other reason a sleeping loop should stop.
	 *
	 * The same number as above, and it retires every read at once — which is what unmounting
	 * means. Without it the waits keep their timers and their requests, and they resolve into
	 * `setState` calls on a provider that no longer exists. React ignores those rather than
	 * warning, so the cost is the traffic and the held timers and not a visible defect, which
	 * is exactly why nothing here noticed it.
	 */
	useEffect(
		() => () => {
			generation.current++;
		},
		[],
	);
	/**
	 * Re-read on the way back to the foreground.
	 *
	 * A phone that spent the night in a pocket is the case: the token may have expired
	 * while the process was suspended, and `AppState` is the cheapest moment to notice,
	 * because it is exactly when a stale token would be spent on the request the customer
	 * is about to make.
	 */
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") void read();
		});
		return () => sub.remove();
	}, [read]);
	const signIn = useCallback(
		async (email: string, password: string): Promise<SignInResult> => {
			try {
				await marketplaceAuth.signIn(email, password);
				// `read` keeps its own failures to itself, so it no longer throws and cannot
				// reach this `catch`: what is reported here is now always the sign-in call,
				// which is the thing the customer just did and the only thing they can act on.
				await read();
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					messageKey: authErrorKey(error instanceof Error ? error.message : ""),
				};
			}
		},
		[read],
	);
	const signUp = useCallback(
		async (
			email: string,
			password: string,
			name: string,
		): Promise<SignInResult> => {
			try {
				await marketplaceAuth.signUp(email, password, name);
				await read();
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					messageKey: authErrorKey(error instanceof Error ? error.message : ""),
				};
			}
		},
		[read],
	);
	const signOut = useCallback(async () => {
		// The API deletes the session row; this only follows it and drops the local token.
		await marketplaceAuth.signOut();
		setSession(null);
		setStatus("signed-out");
	}, []);
	const value = useMemo(
		() => ({
			session,
			status,
			unanswered,
			signIn,
			signUp,
			signOut,
			refresh: read,
		}),
		[session, status, unanswered, signIn, signUp, signOut, read],
	);
	return <SessionContext value={value}>{children}</SessionContext>;
}
export function useSession() {
	const value = use(SessionContext);
	if (!value) throw new Error("SessionProvider missing");
	return value;
}
/**
 * The keys the transport can actually hand back, and nothing else.
 *
 * `@pymeshub/auth`'s `request()` throws one of exactly three strings —
 * `auth.error.invalidCredentials` for a 401, `auth.error.rateLimited` for a 429, and
 * `auth.error.generic` for everything else. A 400 from Better Auth for a password under
 * its 12-character minimum is in that last group, so it arrives here as the generic key
 * and this function cannot name the reason; listing `auth.error.weakPassword` would be a
 * branch no response can reach. The rule is stated before the customer types instead: the
 * sign-in form's own check and `auth.password.minimum` beside the field.
 */
export function authErrorKey(message: string): MessageKey {
	return (
		[
			"auth.error.invalidCredentials",
			"auth.error.rateLimited",
		] as readonly string[]
	).includes(message)
		? (message as MessageKey)
		: "auth.error.generic";
}
