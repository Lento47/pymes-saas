# `@pymeshub/auth`

Identity, shared between the Worker and the clients.

**Better Auth owns who a person is.** It runs inside `apps/api`
([`src/auth.ts`](../../apps/api/src/auth.ts)), keeps its accounts in the D1 tables
`auth_session`, `auth_account`, `auth_verification` and `auth_rate_limit`, and issues the
session cookie or the bearer token. It owns nothing else.

Products, carts, orders, memberships and payouts — all of it lives in D1 and is reachable
only through `apps/api`. No client has a database connection or a credential for one: a
client that could reach the data directly could fork it, and two halves of a marketplace
that disagree about who ordered what is the failure this design exists to prevent.

```
apps/web  ─┐  cookie (web) or Bearer <session token> (phone)
           ├──────────────────────────────────────────→ apps/api (Worker) ─→ D1
apps/mobile┘                                               │
                                                           ├─ betterAuth().api.getSession()
                                                           └─ membership rows decide access
```

## What is in the package

Two source files, and the split between them is the whole design:

| Entry point | Who imports it | What it is |
| --- | --- | --- |
| `@pymeshub/auth` | `apps/api` | The `AuthenticatedUser` type, plus the `@pymeshub/env/load` side effect |
| `@pymeshub/auth/marketplace-client` | `apps/web`, `apps/mobile` | `createMarketplaceAuthClient` — the four calls a client makes |

The package root exports **types only** for the API, so a client that imports this
package for a type never drags a runtime module into its bundle. The client entry point
has no dependencies at all — it is a `fetch` wrapper — which is why it is a subpath
rather than part of the root.

There is no token verifier here any more, and that is deliberate. Verification used to
live in this package (`verifySupabaseToken`, hand-written against WebCrypto). Better Auth
does it in `apps/api` now, where the session table it checks against also lives; a second
implementation would be a second thing to keep in step with the issuer.

## The client

```ts
import { createMarketplaceAuthClient } from "@pymeshub/auth/marketplace-client";

const auth = createMarketplaceAuthClient(API_URL, SecureStore); // omit storage on web
await auth.signIn(email, password);
const session = await auth.currentSession(); // null when nobody is signed in
await auth.signOut();
```

| Call | Request |
| --- | --- |
| `signIn(email, password)` | `POST /auth/sign-in/email` |
| `signUp(email, password, name)` | `POST /auth/sign-up/email` |
| `signOut()` | `POST /auth/sign-out` |
| `currentSession()` | `GET /auth/get-session` |
| `accessToken()` | No request — reads the token storage |

**The two transports are the reason this module exists.** A browser holds the session in
an HttpOnly cookie it cannot read, so it calls the client with no storage and every
request goes out with `credentials: "include"`. A phone has no cookie jar: it passes a
storage adapter (Expo SecureStore) and the client sends `Authorization: Bearer …` from
it, with `credentials: "omit"`. Both apps going through one function is what stops them
growing two subtly different versions of that rule.

On a phone, a successful response that carries a `set-auth-token` header is written back
to storage — that is how Better Auth's bearer plugin hands over a token it just rotated.
A `401` clears it, because a session revoked on another device must not keep being sent.

**Failures arrive as translation keys, not prose.** `auth.error.rateLimited` for `429`,
`auth.error.invalidCredentials` for `401`, and `auth.error.generic` for anything else, so
the UI can render its own sentence in the customer's language. `403` is deliberately in
the generic bucket — "you may not do this" is the API's authorisation answer, not a
sign-in problem, and retrying the password will not change it.

## A token proves identity, never permission

A session says the caller is real. It does not say the bearer may suspend a business.
Who may read a business's orders is answered by the `membership` table in D1, from the
session's user id, on every request in `apps/api/src/context.ts` — never by a claim in a
token, because a claim is data the bearer is holding.

This replaced `ALLOWED_SIGN_IN`. The old rule was "one list of domains is the entire
authorisation model", which was right for an internal single-tenant CRM and wrong for a
marketplace: anybody may sign up as a customer, and business powers are granted by a row
in `membership`, not by the domain of an email address.

## The side-effect import

`src/index.ts` starts with `import "@pymeshub/env/load";`, which reads the root `.env`
into `process.env`. It is kept there on purpose and it is the last home of that side
effect in this package — the module that used to hold it (`config.ts`) is gone.

Nothing fails loudly if it is deleted. `apps/api` imports this package with `import type`
only, which erases at compile time, so the import does not fire on the Worker's request
path today — the Worker receives its configuration per request as bindings, never from
`process.env`. It fires for whoever imports the package root for value, and it has to run
*before* any module that reads `process.env` at import time: ES imports are hoisted, so a
module cannot load the file for itself.

## Rules worth keeping

- **Never log a token, a header, or a full request body.** They carry sessions.
- **Nothing in this package holds a secret.** There is no service-role key and no signing
  secret to leak into a browser or a phone bundle.
- **Suspension lives in our row, not in the identity provider.** An operator suspending a
  customer for fraud must not have to reach into the auth tables, and a password reset
  must not silently lift it.
