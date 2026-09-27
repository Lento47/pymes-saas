# R2 media, and the `upload.data` column that never existed

Two facts belong together, and this file is where the second one is written down
because the first one makes the second invisible.

## What is true now

The bytes behind a `/files/:id` live in the `MEDIA` R2 bucket. The `upload` table is
an index: what an object is, who put it there, how big it is, and what to serve it
as. There is no `data` column.

| | |
| --- | --- |
| Bucket (production) | `pymeshub-media` |
| Bucket (staging) | `pymeshub-media-staging` |
| Binding | `MEDIA`, declared in all three scopes of `packages/trpc-api/wrangler.toml` |
| Object key | the serve path, `/files/:id` — the same string a caller's `imageUrl` holds |
| Read | `/files/:id`, through the Worker; the buckets are private |
| Cost | $0.015/GB-month, **no egress charge** |

`r2_buckets` is not an inheritable field in wrangler 4, which is why the binding
appears three times rather than once. Read the ids and bucket names side by side
before editing any of them: a wrong bucket in `[env.staging]` is a staging deploy
that writes into production media.

## Why the bytes cannot live in D1

D1 caps a database at **10 GB**, and Cloudflare documents that limit as one that
cannot be raised. The same page caps a single row at 2,000,000 bytes.

A marketplace of this shape stores a picture per product, a logo and cover per shop,
and a profile picture per courier — all of them read by customers who may not be
signed in, so none of them is compressible into a thumbnail-and-crop pipeline. At the
2 MiB ceiling that is roughly **5,000 images for the entire platform, ever**,
competing with orders, sessions, carts, the audit log and Better Auth's own tables in
the same 10 GB. At a realistic 500 KB per phone photo it is nearer 20,000 images,
which is on the order of a hundred and seventy shops with a sixty-product catalogue.

The failure mode is not a slower month. It is `Exceeded maximum DB size`, with no
path through it short of sharding into many databases or moving the bytes out.

R2 has no row ceiling, no per-database ceiling, and charges nothing for egress —
which is the part that matters for a storefront, where every image read is an egress
event that AWS S3 would bill at $0.09/GB.

## The bug this migration removed

`migrations/0010_upload_bytes.sql` contained:

```sql
ALTER TABLE `upload` ADD `data` blob;
```

**It was never in `meta/_journal.json`, so it was never applied to any real
database.** `wrangler d1 migrations apply` walks the journal, not the directory, so
production and staging never ran it. `upload.data` existed in `schema.ts` and
nowhere else.

What that meant in production:

- `uploads.create` inserts a `data` value → `no such column: data`
- `uploads.read` selects `mimeType, data` → `no such column: data`

In other words **the upload path was broken in production** and had been since the
column was added to the schema. Not slow, not degraded — failing.

Two things hid it:

1. **The test harness applied it anyway.** `test/harness.ts` reads migrations from
   the *directory* (`readdirSync(...).filter(endsWith(".sql")).sort()`), not from the
   journal, precisely so a spec cannot run against a frozen schema. That made the
   column present in every test and absent in production — green, and about something
   else, which is the exact failure the harness docstring warns about.
2. **Nothing tested uploads at all.** There was no `uploads.test.ts`. The first one
   is `packages/trpc-api/test/uploads.test.ts` and its central assertion is that
   `upload` has no byte column, read from `pragma table_info(upload)` so a
   regression names the column instead of surfacing as an opaque SQL error.

## Why removing the column needed no migration

Because the column never existed in any real database, dropping it is a no-op — so
`bun run db:generate` reports `No schema changes, nothing to migrate`, and the
migration history is left alone.

That required one non-obvious edit. Drizzle's `migrations/meta/0010_snapshot.json`
still described `upload.data`, so `generate` kept emitting
`ALTER TABLE upload DROP COLUMN data` — a migration that would have **failed on
production** with `no such column: data`, because production never had it. The
phantom entry was removed from the snapshot by hand. Hand-editing a snapshot is
normally wrong; here the snapshot was the thing that was wrong, because it recorded a
migration that was not in the journal. The `outbox_event.data` column in the same
snapshot is real and was left alone.

`bun run db:generate` is the check. It must print `No schema changes`.

## Before deploying

**The deploy token needs R2 scope** — `Workers R2 Storage: Edit`. The binding was
absent before this change because the token had no R2 permission, not because the
design wanted D1. A token without the scope fails the deploy rather than degrading
silently, but it is worth confirming first:

```powershell
cd packages/trpc-api
bun run build    # wrangler deploy --dry-run --env production
```

The dry run lists the resolved bindings and must include:

```
env.MEDIA (pymeshub-media)   R2 Bucket
```

## Not fixed here

`packages/db/package.json` points its migration and seed scripts at
`-c ../../apps/api/wrangler.toml`, which **does not exist** — the Worker's config is
`packages/trpc-api/wrangler.toml`. All six `db:migrate:*` and `db:seed*` scripts are
broken. It is a separate defect from this one and is left alone, but it means no new
migration can be applied until it is fixed.
