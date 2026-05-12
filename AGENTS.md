# AGENTS.md — PymesHub Monorepo

## Branch-to-deploy mapping (CRITICAL)

| Branch     | Deploys to              | Content                          |
|------------|-------------------------|----------------------------------|
| `main-api` | Railway                 | `apps/api/` only                 |
| `main-web` | Cloudflare Pages        | `apps/web/` only                 |
| `main`     | Nothing (reference)     | Everything                       |

**Never merge `main-api` and `main-web` content into each other.** Backend and frontend are deployed independently. Cross-cutting changes (e.g. shared types) need separate PRs to each branch. Use `git worktree` (see `.codex-worktrees/`).

## Dev commands

```bash
pnpm dev:api          # NestJS on :4000
pnpm dev:web          # Express+Vite on :5000 (proxies /api/* → :4000)
pnpm dev:desktop      # Tauri desktop (cloud edition)
pnpm dev:desktop:cloud  # same as above
```

## Prisma prerequisite

Every build requires `prisma generate` first. CI does this explicitly:

```bash
cd apps/api && pnpm exec prisma generate
```

The `postinstall` script runs it automatically (`|| true` so it doesn't fail CI), but it needs `DATABASE_URL` set.

## Key package names (pnpm workspace)

| Directory          | pnpm name               |
|--------------------|-------------------------|
| `apps/api/`        | `saas-api`              |
| `apps/web/`        | `rest-express`          |
| `apps/desktop/`    | `@pymeshub/desktop`     |
| `packages/shared-types/` | `@pymes-saas/shared-types` |

Use pnpm filter names for commands: `pnpm --filter saas-api test`

## Lint, typecheck, test

```bash
pnpm lint              # API only (eslint --fix)
pnpm typecheck         # runs "check" script in all packages
pnpm test:api          # Jest tests in apps/api
```

- API tests use mocked `PrismaService` — no DB needed locally
- CI runs tests against real PostgreSQL 16
- Web typecheck: `cd apps/web && pnpm run check` (plain `tsc`)

## Environment variables

Required for local dev (`apps/api/.env`):
- `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `REDIS_HOST` / `REDIS_PORT`
- `STORAGE_DRIVER` (minio or s3), MinIO credentials + bucket
- `ENCRYPTION_KEY`
Optional: `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`

## Useful conventions

- `tsconfig.json` in `apps/api` has `strictNullChecks: false` and `noImplicitAny: false` — not strict mode
- `apps/web` is Express serving a Vite-built React SPA with `/api/*` proxied to NestJS
- Cloudflare Pages: assets root is `apps/web/dist/public`
- Shared types in `packages/shared-types` are consumed directly as `.ts` source (no build step)
- `pnpm version`: must be >= 9 (CI uses 10)

## Deployment discipline (CRITICAL)

- **Every fix MUST be pushed to the branch where the issue lives.** If the fix affects both frontend and backend, push to BOTH `main-api` AND `main-web`.
- **Do NOT remove code to fix regressions.** If a change breaks something, fix it in-place. Never delete features to resolve a bug — patch the root cause.
- **Deployment is real.** `main-api` deploys to Railway (production). `main-web` deploys to Cloudflare Pages (production). Both trigger auto-deploys on push.
- **Never use `set -e` in entrypoint.sh.** A failing migration must not prevent the app from starting. Use `|| echo` or `|| true` after migration commands so the container stays alive.
- **Do NOT change Dockerfile.api or CI workflow files unless mandatory.** These configs are proven to work. Only change them when the build/runtime environment actually changes.
- **Always patch vulnerabilities.** Security issues must be fixed immediately and pushed to the relevant branch.
- **Do NOT make cross-branch edits.** `main-api` is `apps/api/` only. `main-web` is `apps/web/` only. Cross-cutting changes (shared types) must be committed to both branches separately.

## Database safety (CRITICAL)

- **ALWAYS create backups** before any schema change, migration, or data modification.
- **NEVER delete anything in the database.** Not rows, not tables, not columns. If something needs removal, explain why and ask for explicit permission.
- **Soft-delete only.** If a feature or data must be deprecated, use `deleted_at` flags, `archived` statuses, or disable flags. Never hard-delete production data.
- **Migrations must be additive.** New columns, new tables, new enum values are safe. Dropping columns, dropping tables, or removing enum values requires permission.

## Railway architecture (CRITICAL)

The Railway project runs 3 independent containers connected via private DNS: `pymes-saasAPI`, `Postgres`, and `Redis`.

**Do NOT hardcode `localhost` for database or Redis URLs.** Use environment variables. On Railway these services are separate containers, never at localhost.
- `DATABASE_URL` — MUST NOT be `localhost`. Railway sets this automatically.
- `REDIS_HOST` — MUST be `redis.railway.internal` or equivalent private DNS name
- `REDIS_PASSWORD` — Redis has `--requirepass`, must be set
- `PORT` — Railway sets this dynamically

## Code quality — file size limits (CRITICAL)

Large files cause agents to miss context, break patterns, and introduce regressions. Keep files small enough to fit in a single read.

**Frontend pages:** max ~400 lines per file.
- Extract inline helper functions to `lib/utils.ts` or dedicated hook files in `hooks/`
- Extract inline config/constants to `data/` (e.g. plan tiers, Hacienda guide, SEO pages)
- Extract page sections to `components/<domain>/*.tsx` (dirs already exist for: `conversation/`, `invoices/`, `settings/`, `marketing/`, `pipeline/`, `automations/`, `tasks/`)
- Extract large forms (invoice form fields, settings tabs) to dedicated components

**API services:** max ~400 lines per file.
- Delegate sub-operations to other services via DI (already the standard pattern — see `invoices.service.ts` delegating to `HaciendaSigningService`, etc.)
- Extract validation/transformation logic to `dto/` or `common/helpers`
- Extract inline queries to repository-pattern helpers in `common/`

**When editing any file over 400 lines:**
1. Read the file first to understand the full scope
2. Ne​ver add new features inline — extract a new component/service instead
3. If a helper function, constant, or type already exists, reuse it — grep first

## Tool limitations (PowerShell environment)

`gh`, `psql`, `rg` not available. Use `pnpm` scripts wherever possible.
- DB operations: `pnpm --filter saas-api db:studio`
- Tests: `pnpm test:api`
- Build: `pnpm build:api` or `pnpm build:web`
