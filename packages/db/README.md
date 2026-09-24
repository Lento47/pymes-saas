# `@pymeshub/db`

Drizzle schema, migrations and demo data for **Cloudflare D1** — the SQLite
database behind the marketplace. See
[`docs/domain.md`](../../docs/domain.md) for the model and
[`adrs/0001-cloudflare-multi-client-marketplace.md`](../../adrs/0001-cloudflare-multi-client-marketplace.md)
for why the database moved off Postgres.

## Usage

`createDb` takes the binding rather than reading one, because a Worker has no
module-scope `env` — the binding arrives with the request, and a D1 database is
per-request state, not a singleton.

```ts
import { createDb } from "@pymeshub/db";

export default {
	async fetch(request: Request, env: Env) {
		const db = createDb(env.DB);
		const nearby = await db.query.business.findMany({ limit: 10 });
		return Response.json(nearby);
	},
};
```

`@pymeshub/db/schema`, `@pymeshub/db/geo` and `@pymeshub/db/client` are also
exported, so a consumer that only needs the table objects does not pull the
client in with them.

## Migrations

`drizzle-kit generate` writes SQL; `wrangler` applies it. There is deliberately
no `drizzle-kit push` and no `drizzle-kit migrate`: D1 is not a SQLite file a
local tool can open, and the only thing that should be writing to it is
`wrangler d1 migrations apply`, whose plan is a reviewable file in
`migrations/`.

```bash
bun run db:generate        # after editing src/schema.ts — writes migrations/000N_*.sql
bun run db:migrate:local   # apply to the local Miniflare copy
bun run db:migrate:remote  # apply to production D1
```

Both `wrangler` scripts pass `-c ../../apps/api/wrangler.toml` on purpose. The
D1 binding is declared in the API's config, not here, and `wrangler` reads
`wrangler.toml` from the working directory unless told otherwise — so without
`-c` it finds no config, no `pymhubdb` database, and fails with a binding error
that says nothing about the missing file. The remote form also needs
`CLOUDFLARE_API_TOKEN` (or a `wrangler login` session) in the environment.

The production database is `pymhubdb`,
`add40616-4e4e-4851-9f2d-0eca6380ca3b`.

**Review the generated SQL before applying it.** SQLite cannot drop or retype a
column in place, so `drizzle-kit` emits a table rebuild — create, copy, drop,
rename — and a rebuild of `order` is a rebuild of the table with the money in
it.

## Seed

```bash
bun run db:seed         # generate both scripts, then apply both locally
bun run db:seed:remote  # generate both, apply seed.sql alone to production D1
```

`src/seed.ts` writes two files and `wrangler d1 execute --file` applies them. The
files are generated rather than inserted directly for the same reason the
migrations are: nothing outside a Worker can open D1, so "seed the database" has
to mean "produce a script and hand it to wrangler" — and the script is
reviewable.

| File | What | Where it goes |
| ---- | ---- | ------------- |
| `seed.sql` | The marketplace: users, businesses, products, carts, orders | Local **and** remote |
| `seed-credentials.sql` | One sign-in credential per seeded user | **Local only** |

The split is a guard, not tidiness. `seed-credentials.sql` carries a password
hash for every seeded account, and the password behind it —
`pymeshub-demo-2026` — is written in plain text in `src/seed.ts`. `db:seed:remote`
applies `seed.sql` and nothing else, so the one command that can reach a deployed
database is the one command that cannot create an account whose password is in
the source.

**Sign in as anyone.** After `db:seed`, every seeded account — the admin at
`admin@pymeshub.test`, the customers, the business owners — signs in with
`pymeshub-demo-2026`. That is what makes the seed useful for looking at the
product rather than only at the data: the admin sees the admin surface, an owner
sees their own business, and the API re-reads each one's `membership` rows to
decide which. The password is public by design and belongs in a local database
only; there is deliberately no way to apply it with `--remote`.

It is safe to run more than once. Ids are derived from fixed strings, every
insert ends in `ON CONFLICT DO NOTHING`, and the data is generated from a fixed
seed, so a second run changes nothing and two runs produce the same bytes. The
password hash is a literal for that reason — Better Auth's `hashPassword` salts
randomly, so computing it here would break the byte-for-byte guarantee. The seed
says how to regenerate it.

Everything in it is fictional: invented businesses, invented people, all on
`.test` addresses. This repository is MIT-licensed — see
[`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Scripts

| Script                      | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `check-types`               | `tsc --noEmit`                                   |
| `test`                      | `bun test` — the geohash spec                    |
| `db:generate`               | Generate a migration from `src/schema.ts`        |
| `db:migrate:local`          | Apply migrations to the local D1                 |
| `db:migrate:remote`         | Apply migrations to production D1                |
| `db:seed`                   | Generate both scripts and apply both locally     |
| `db:seed:remote`            | Generate both, apply `seed.sql` to production    |

Each is also exposed at the repo root and routed through `turbo run`.

## Notes

- **Timestamps are integer milliseconds**, booleans are integers, and money is an
  integer in the currency's minor unit — never a float. The reasons are in the
  header comment of `src/schema.ts`.
- **Ids are minted by the API**, so no column has a default. An identity the
  database chooses cannot be known before the write.
- **`src/geo.ts`** encodes geohash, which is how "businesses near me" is answered
  without a spatial index. D1 has none, so a search reads the target cell and its
  eight neighbours — a business 50 m away is frequently in the next cell, and a
  query that reads only one cell loses it.
- **JIT package.** `exports` point at TypeScript sources; the consumer compiles
  them. Non-bundler consumers need a TypeScript runtime.
- **Auth is here too.** `src/auth-schema.ts` declares Better Auth's tables —
  `session`, `account`, `verification` and `rateLimit`, whose SQL names are the
  `auth_*` ones. Better Auth owns the password hash, the session and the counters
  behind the sign-in rate limit, and writes them through its Drizzle adapter.
  `user` is the domain half of the same identity, the part the marketplace reads.
