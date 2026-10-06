# Cloudflare Worker release runbook

## Deployment ownership

Cloudflare Workers Builds is the only production deployment owner for `pymeshub-api`. The former GitHub Actions deploy workflow has been removed; CI validates artifacts but never deploys them.

Configure the connected production build from the repository root:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Root directory | `/` (repository root) |
| Install | automatic `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter api build` |
| Deploy command | `pnpm --filter api deploy` |
| Node | `.node-version` (`22.13.1`) |
| pnpm | root `packageManager` (`10.11.1`) |

Runtime variables come from `packages/trpc-api/wrangler.toml`. `AUTH_SECRET`, `SENTRY_DSN`, and the optional `EXPO_ACCESS_TOKEN` are Worker secrets and must not be entered as non-secret build variables. The build token needs only the Worker, D1, KV, R2, Queue, route, and Durable Object permissions required by this configuration.

Set a distinct Sentry project per runtime. The Worker uses `SENTRY_DSN`; the Nest API uses its own `SENTRY_DSN`; the web build uses public `VITE_SENTRY_DSN`; and mobile uses public `EXPO_PUBLIC_SENTRY_DSN`. Release names are emitted by each SDK. The SDK defaults do not opt into PII, and every runtime applies the same scrub policy for tokens, cookies, addresses, precise coordinates, movement fields, and payment references. Configure `SENTRY_ORG`, `SENTRY_PROJECT_MOBILE`, and a scoped `SENTRY_AUTH_TOKEN` only in EAS to upload mobile source maps.

Build `922ef849-88db-43e5-8e6e-c7bd7031eac1` could not be retrieved with the current local OAuth credential: the Builds API returned HTTP 403. Diagnose it with a user-scoped API token granting **Workers CI Read**:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/builds/builds/922ef849-88db-43e5-8e6e-c7bd7031eac1/logs" \
  -H "Authorization: Bearer $CLOUDFLARE_BUILDS_READ_TOKEN"
```

Do not place that token in the repository. Compare the returned build metadata with the settings above before retrying.

## Verify that a release reached production

**A push to `master` does not mean the API deployed.** The web and the API are two
independent Cloudflare Builds projects with two independent build queues, and only the web's
is instant. Every push that touches `packages/shared/src/schemas/**` is a release in which
the two can disagree: if the web finishes first, a client that requires a field the deployed
API does not send is live, and it fails on a schema parse rather than on a request.

Nothing about that failure points at the deploy. `lib/admin.ts` parses every admin read
against its shared schema, so the console can render the raw Zod issue array —

    [{"expected":"array","code":"invalid_type","path":["orderSeries"],
      "message":"Invalid input: expected array, received undefined"}]

— which describes a disagreement between two bundles and says nothing about which one is
behind. `QueryErrorState` now substitutes the panel's own sentence for a serialized payload,
so what reaches the operator is "no se pudieron cargar las métricas" and a retry button; treat
that screen as **"the API Worker is older than the web bundle"** until the lists below say
otherwise, and confirm with:

```bash
cd packages/trpc-api && npx wrangler deployments list --env production
```

Read the newest entry's `Created` against the commit being shipped. If the API's newest
deployment predates a commit that changed a shared schema, the API build did not run or did
not finish — and that is fixed by deploying, not by changing a client.

Check the other side the same way when the web is the one in doubt:

```bash
npx wrangler versions list --name pymeshubsaas
```

Neither list explains *why* a build did not run. That is the Builds log, and it needs the
token above. Do not infer the cause from a version list alone.

## Migration sequence

1. Generate and review migrations: `pnpm --filter @pymeshub/db db:generate`.
2. Run `bash scripts/rehearse-d1-migrations.sh` for a fresh database and an already-recorded database.
3. Export a schema-only production copy and pass it to the same script as its first argument.
4. Apply staging: `pnpm --filter @pymeshub/db db:migrate:staging`.
5. Exercise account deletion, push registration, and courier tracking against staging.
6. Export production and record its Time Travel bookmark.
7. Apply production only during an approved release window: `pnpm --filter @pymeshub/db db:migrate:remote`.

On 27 September 2026, staging contained the same price-book/subscription/listed schema under older generated migration names. The empty legacy `payout` table was removed, the three equivalent migration names were reconciled, and migration `0013_neat_phantom_reporter.sql` applied successfully. `wrangler d1 migrations list` now reports no staging migrations pending.

## Backup and restore

Before every production migration:

```bash
pnpm --filter @pymeshub/db exec wrangler d1 export pymhubdb --remote --env production \
  -c ../trpc-api/wrangler.toml --output "pymhubdb-$(date -u +%Y%m%dT%H%M%SZ).sql" -y
pnpm --filter @pymeshub/db exec wrangler d1 time-travel info pymhubdb \
  --remote --env production -c ../trpc-api/wrangler.toml
```

Restore rehearsals target a newly-created recovery database, never `pymhubdb`. Import the export, run row-count and foreign-key checks, start a staging Worker against that database, and record recovery time. For a live rollback, prefer D1 Time Travel after confirming the exact bookmark; it is destructive and requires incident-lead approval.

R2 currently aborts incomplete multipart uploads after seven days in both media buckets. Product media is user-owned data, so no automatic object-expiration rule should be added until deletion retention and legal-hold prefixes are implemented and tested.

## Monitoring and alerts

Worker logs and traces are enabled in Wrangler. Configure Cloudflare notifications for:

- 5xx rate above 2% for five minutes;
- p95 API latency above 1.5 seconds for ten minutes;
- queue consumer failures or dead-letter messages above zero;
- scheduled handler failures above zero;
- pending push deliveries or outbox rows older than five minutes.

The external uptime workflow checks the web application, API database health, MapLibre style, and a representative style tile every 15 minutes. Route failed workflow notifications to the incident owner; GitHub notification defaults alone are not an on-call system.

Rollback the Worker with `wrangler rollback --env production` to the version recorded before release. Database rollback is a separate decision: only use Time Travel when forward repair is unsafe, because it discards writes after the selected bookmark.
