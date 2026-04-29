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

## Two different Dockerfiles

- **Root `Dockerfile`** — Railway auto-deploy. Uses `pnpm install --recursive`, copies full repo, builds API, runs via `entrypoint.sh` (which does `prisma migrate deploy` then starts)
- **`apps/api/Dockerfile.api`** — ghcr.io push (used by `api-deploy.yml` workflow). Two-stage build, copies only API, runs `prisma generate` in builder stage

## Desktop editions

Two Tauri configs at `apps/desktop/src-tauri/`:
- `tauri.cloud.conf.json` — Cloud edition (connects to remote API, auto-updater enabled). Env: `PYMESHUB_EDITION=cloud PYMESHUB_UPDATER_ACTIVE=true`
- `tauri.enterprise.conf.json` — Enterprise edition (bundles NestJS as sidecar with SQLite). No updater. Builds a `.msi` installer. Requires Rust, `@yao-pkg/pkg` for Node.js bundling, and copies `libquery_engine-windows.dll.node` as Prisma engine

Enterprise desktop must build the API first (NestJS → dist), then generate SQLite schema via `prisma migrate diff`, then package with `pkg`.

## CI triggers

| Workflow                  | Trigger                        |
|---------------------------|--------------------------------|
| `api-ci.yml`              | push/PR to `main`, `develop`   |
| `deploy-railway.yml`      | push/PR to `main-api` (paths: `apps/api/**`, `Dockerfile`, `railway.toml`) |
| `deploy-cloudflare.yml`   | push/PR to `main-web`          |
| `pr-checks.yml`           | any PR (validates desc + build)|
| `desktop-release-cloud.yml` | tag `desktop-cloud-v*.*.*`   |
| `desktop-release-enterprise.yml` | tag `desktop-enterprise-v*.*.*` |

## Health check

- Endpoint: `GET /api/health`
- Railway config: `railway.toml` sets `healthcheckPath = "/api/health"` with 180s timeout
- API Dockerfile (root): passed via Railway platform, not defined inline
- API Dockerfile (`apps/api/Dockerfile.api`): `wget`-based HEALTHCHECK

## Environment variables

Required for local dev (`apps/api/.env`):
- `DATABASE_URL` — PostgreSQL connection
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `REDIS_HOST` / `REDIS_PORT`
- `STORAGE_DRIVER` (minio or s3), MinIO credentials + bucket
- `ENCRYPTION_KEY` — for encrypting stored secrets

Optional: `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`

## Useful conventions

- `tsconfig.json` in `apps/api` has `strictNullChecks: false` and `noImplicitAny: false` — not strict mode
- `apps/web` is Express serving a Vite-built React SPA with `/api/*` proxied to NestJS
- Cloudflare Pages: assets root is `apps/web/dist/public` (configured in `wrangler.toml`)
- Shared types in `packages/shared-types` are consumed directly as `.ts` source (no build step)
- `pnpm version`: must be >= 9 (CI uses 10)

## Deployment discipline (CRITICAL)

- **Every fix MUST be pushed to the branch where the issue lives.** If the fix affects both frontend and backend, push to BOTH `main-api` AND `main-web`.
- **Do NOT remove code to fix regressions.** If a change breaks something, fix it in-place. Never delete features to resolve a bug — patch the root cause.
- **Deployment is real.** `main-api` deploys to Railway (production). `main-web` deploys to Cloudflare Pages (production). Both trigger auto-deploys on push.
- **Always patch vulnerabilities.** Security issues must be fixed immediately and pushed to the relevant branch. Never leave a known vulnerability unpatched.
- **Do NOT make cross-branch edits.** `main-api` is `apps/api/` only. `main-web` is `apps/web/` only. Cross-cutting changes (shared types) must be committed to both branches separately.

## Database safety (CRITICAL)

- **ALWAYS create backups** before any schema change, migration, or data modification.
- **NEVER delete anything in the database.** Not rows, not tables, not columns. If something needs removal, explain why and ask for explicit permission.
- **Soft-delete only.** If a feature or data must be deprecated, use `deleted_at` flags, `archived` statuses, or disable flags. Never hard-delete production data.
- **Migrations must be additive.** New columns, new tables, new enum values are safe. Dropping columns, dropping tables, or removing enum values requires permission.
