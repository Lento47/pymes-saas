import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
	account,
	accountConsent,
	createDb,
	rateLimit,
	session,
	user,
	verification,
} from "@pymeshub/db";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { corsOrigins, type Env } from "./env";

/**
 * What the reader asserted when they made the account, and when.
 *
 * Both timestamps are the same instant because the two assertions were made together,
 * by one reader, on one form. Two timestamps a few hundred microseconds apart would
 * present as two separate acts to anyone auditing them later, which is the wrong
 * shape for evidence about a single agreement.
 */
export type SignUpConsent = { termsAcceptedAt: Date; ageConfirmedAt: Date };

/** A refusal: the code the client switches on and the sentence a person reads. */
export type ConsentRefusal = { code: string; message: string };

/**
 * Read the two assertions out of a sign-up body, or say which one is missing.
 *
 * This is a function rather than inline route code because the body has to be read
 * **before** Better Auth sees it, and the reason is a correction worth recording:
 * `databaseHooks.user.create.before` does not receive fields the auth layer does not
 * model. Its first argument is typed `User & Record<string, unknown>`, which reads
 * like "and anything else the body carried" and is not — the body is parsed into
 * Better Auth's own shape first, and the extra keys are gone before the hook runs.
 * Enforcing in the hook would have produced a gate that silently passed everything,
 * which is worse than no gate because it looks like one.
 *
 * So the order is: read the real body, refuse here, and hand the resolved consent to
 * `createAuth` — which is built per request, so carrying it in a closure is safe where
 * a module-level variable would not be.
 *
 * `ageConfirmed` is checked first for the same reason the web form checks it first: it
 * is the assertion a refusal is most often about, and naming the wrong one sends the
 * reader to fix something that was already fine.
 */
export function parseSignUpConsent(body: unknown):
	| { ok: true; consent: SignUpConsent }
	| { ok: false; refusal: ConsentRefusal } {
	const flags =
		typeof body === "object" && body !== null
			? (body as { termsAccepted?: unknown; ageConfirmed?: unknown })
			: {};

	// `!== true` rather than a truthiness test. A client that sends the string "true",
	// or the number 1, has asserted nothing, and coercing it would accept a body the
	// form never produced.
	if (flags.ageConfirmed !== true) {
		return {
			ok: false,
			refusal: {
				code: "AGE_CONFIRMATION_REQUIRED",
				message: "Debés confirmar que tenés 18 años o más para crear una cuenta.",
			},
		};
	}
	if (flags.termsAccepted !== true) {
		return {
			ok: false,
			refusal: {
				code: "TERMS_ACCEPTANCE_REQUIRED",
				message: "Debés aceptar los Términos de Servicio para crear una cuenta.",
			},
		};
	}

	const at = new Date();
	return { ok: true, consent: { termsAcceptedAt: at, ageConfirmedAt: at } };
}

/**
 * The body handed on to Better Auth: the caller's own fields, minus the two flags.
 *
 * They are dropped rather than forwarded because they are not columns on `user` and
 * Better Auth builds its insert from its own field list. Nothing is lost by removing
 * them here — `parseSignUpConsent` has already resolved them into a `SignUpConsent` —
 * and leaving them in would trade a clean insert for an unknown-column write on some
 * future version.
 */
export function withoutConsentFlags(body: unknown): unknown {
	if (typeof body !== "object" || body === null) return body;
	const { termsAccepted, ageConfirmed, ...rest } = body as Record<string, unknown>;
	void termsAccepted;
	void ageConfirmed;
	return rest;
}

/** Created per request: bindings must never be captured across Worker requests. */
export function createAuth(env: Env, consent?: SignUpConsent) {
	if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || !env.AUTH_URL)
		return null;
	return betterAuth({
		appName: "PymesHub",
		baseURL: env.AUTH_URL,
		basePath: "/auth",
		secret: env.AUTH_SECRET,
		database: drizzleAdapter(createDb(env.DB), {
			provider: "sqlite",
			schema: { user, session, account, verification, rateLimit },
			transaction: false,
		}),
		trustedOrigins: corsOrigins(env),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 12,
			maxPasswordLength: 128,
			autoSignIn: true,
		},
		/**
		 * The customer may change their own identifier, from the profile screen.
		 *
		 * Two facts force the shape of this block, both verified against the
		 * installed better-auth 1.7.5 (`api/routes/update-user.mjs`):
		 *
		 * 1. Without `enabled` the endpoint answers 400 `CHANGE_EMAIL_DISABLED`,
		 *    so a profile form offering an email field would be a control for a
		 *    refusal. The field and this flag land together or not at all.
		 * 2. The verified path is dead: it needs `sendVerificationEmail` or
		 *    `sendChangeEmailConfirmation`, and this instance has no outbound
		 *    email service (see the note on `emailAndPassword` above... there is
		 *    no mailer to send with). `updateEmailWithoutVerification` is the
		 *    only live branch, and it applies exactly while the current address
		 *    is unverified — which is every account this instance has ever made.
		 *
		 * What this does *not* give: the endpoint answers 200 when the new
		 * address is already taken (anti-enumeration: it mints a token for the
		 * old address and changes nothing), so the client re-reads `users.me`
		 * after the call and compares rather than trusting the status. And the
		 * endpoint takes no current password, so the profile screen proves
		 * nothing itself — possession of the session *is* the credential here,
		 * which is why signing out everywhere else stays one tap away.
		 */
		user: {
			changeEmail: {
				enabled: true,
				updateEmailWithoutVerification: true,
			},
		},
		// No social providers or outbound email service until explicitly configured.
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: false },
		},
		rateLimit: {
			enabled: true,
			storage: "database",
			window: 60,
			max: 30,
			/**
			 * One limiter, three rules for it, and the session read is not in the credential
			 * class.
			 *
			 * Better Auth keys its counter on `${ip}|${path}` — `createRateLimitKey` in
			 * `@better-auth/core/utils/ip` — so these are separate counters and never a shared
			 * allowance. That is what makes the third rule safe to add: the session read can be
			 * loosened without loosening a credential guess, because a looser read is a
			 * different key, not a bigger bucket.
			 *
			 * `/get-session` is not a credential guess. It carries a signed cookie or a random
			 * opaque token, so there is no secret to try, and it is asked on every page mount,
			 * every tab focus, every app foreground and every 401 from a data call. Under the
			 * 30/min default a customer who came back to the tab often enough had their own
			 * session read refused — and a refusal on the read is what the session providers
			 * used to render as "signed out".
			 *
			 * It is still limited. The route is unauthenticated at the edge and costs a D1 read
			 * per call, so it needs a floor; 300 in a minute is five a second from one address,
			 * which is nobody's reading and far above one app's mounting.
			 */
			customRules: {
				"/sign-in/email": { window: 60, max: 5 },
				"/sign-up/email": { window: 60, max: 5 },
				"/get-session": { window: 60, max: 300 },
			},
		},
		/**
		 * Where the consent record is written, and the last thing that can refuse a
		 * user.
		 *
		 * The web sign-up at `/register` goes through the NestJS app, which enforces
		 * `terms_accepted` and `age_confirmed`. This sign-up is a **different door into
		 * the same product** — the mobile app posts to `/auth/sign-up/email` and lands
		 * here — and before this it recorded nothing at all: no terms, no age
		 * assertion, no consent record, on the one surface that then asks the device
		 * for location and a push token. `app.ts` now refuses the request before it
		 * reaches Better Auth, and this is the second half.
		 *
		 * The two halves are separate on purpose. The refusal lives in the route
		 * because that is the only place the raw body exists; the record lives in the
		 * hook because that is the only place that knows the insert happened and has
		 * the new user's id. A `before` that refused would be redundant with the route
		 * for every real caller while pretending to be a guarantee it cannot make.
		 *
		 * `consent` being absent is therefore not a case to handle: a create that
		 * reaches here without one is a caller that skipped the route, and skipping
		 * without leaving a record is the correct outcome for that — a row whose
		 * timestamps are invented would be worse than no row, because it would assert
		 * an agreement nobody made.
		 */
		databaseHooks: {
			user: {
				create: {
					after: async (created) => {
						if (!consent) return;
						await createDb(env.DB)
							.insert(accountConsent)
							.values({
								userId: created.id,
								termsAcceptedAt: consent.termsAcceptedAt,
								ageConfirmedAt: consent.ageConfirmedAt,
							})
							// `onConflictDoNothing` rather than an update: the row is a
							// record of the first agreement, and a retry of the same sign-up
							// must not rewrite when it was originally given.
							.onConflictDoNothing();
					},
				},
			},
		},
		advanced: {
			cookiePrefix: "pymeshub",
			useSecureCookies: env.AUTH_URL.startsWith("https://"),
			/**
			 * The address the limiter counts, and why it has to be named.
			 *
			 * Cloudflare's edge sets `cf-connecting-ip` itself and overwrites whatever a
			 * client sent, so it is the one value here that cannot be chosen by the caller.
			 *
			 * Better Auth's default is `x-forwarded-for` alone, and `getIPFromHeader` refuses
			 * any header holding more than one address unless trusted proxies are configured.
			 * Cloudflare *appends* the client address to an `X-Forwarded-For` the caller
			 * supplied rather than replacing it, so one caller can make their own header
			 * unresolvable — and an unresolvable address is not "no limit". `getIP` returns
			 * `null`, and it is `resolveRateLimitConfig` that substitutes the single literal
			 * `no-trusted-ip` for it (`createRateLimitKey(ip ?? NO_TRUSTED_IP_KEY, path)`,
			 * better-auth 1.7.5), which puts every caller in the world into one bucket per
			 * path. A customer's failed sign-in then spends a stranger's allowance.
			 *
			 * The distinction is worth keeping straight because the fallback is not `getIP`'s
			 * and its value is not always that literal: `getIP` returns `LOCALHOST_IP` when
			 * `isTest()` or `isDevelopment()` is true, and `null` only in a real deployment
			 * with no resolvable header. So a test that removes a header produces a shared
			 * `127.0.0.1` bucket, not a shared `no-trusted-ip` one.
			 *
			 * `x-forwarded-for` stays second for the two deployments where `cf-connecting-ip`
			 * is absent: `wrangler dev`, and a Worker behind a proxy of one's own that sets
			 * that header itself. Better Auth resolves the headers in order and takes the first
			 * that yields an address, so the second is only ever reached when the first is not
			 * there to be read.
			 */
			ipAddress: {
				ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
			},
		},
		plugins: [bearer()],
	});
}
