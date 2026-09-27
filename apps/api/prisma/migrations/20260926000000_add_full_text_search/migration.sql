-- ============================================================
-- Migration: 20260926000000_add_full_text_search
-- Purpose: Give the unified search endpoint a real full-text
--          index instead of the per-column `contains` (LIKE)
--          scan it runs today.
--
-- What this adds
--   1. `pg_trgm` and `unaccent` (contrib).
--   2. `f_unaccent(text)` — an IMMUTABLE wrapper around the
--      two-argument `unaccent(regdictionary, text)`.
--   3. One immutable `*_search_tsv(...)` function per table,
--      used as BOTH the expression-index definition and the
--      query-side tsvector, so index and query cannot drift.
--   4. A GIN index on that tsvector per table.
--   5. A `gin_trgm_ops` GIN index on each table's primary name
--      column, for typo tolerance.
--
-- Why an expression index and not a `search_tsv` column
--   Prisma's `schema.prisma` is the source of truth for the
--   app's types and for `prisma migrate diff`. A stored
--   tsvector column would appear in every future `db pull` as
--   drift to reconcile. An expression index is invisible to
--   Prisma and needs no schema change.
--
-- Why `f_unaccent` and not bare `unaccent`
--   `unaccent(text)` is STABLE, not IMMUTABLE — it resolves the
--   default dictionary at call time. Postgres refuses to use a
--   STABLE function in an expression index. The two-argument
--   form `unaccent('unaccent', text)` is IMMUTABLE because the
--   dictionary is pinned by the call, so a one-line IMMUTABLE
--   wrapper around it is what the index needs and what the
--   query reuses.
--
-- Why `to_tsvector('spanish', …)` and not `'simple'`
--   The product's operators write Spanish. `'spanish'` stems
--   ("facturas" → "factura") and drops Spanish stopwords.
--   `'simple'` would treat every inflection as a distinct
--   token and make "factura" miss "facturas".
--
-- Tenant isolation is NOT relaxed here. Every index is an
-- expression over one table's own columns; RLS still governs
-- which rows a query can see, and the service re-states
-- `workspace_id = $1` in the WHERE clause regardless.
-- ============================================================

-- ─── extensions ──────────────────────────────────────────────
-- Contrib modules. Both ship with every supported Postgres.
-- `CREATE EXTENSION` needs a role that may create extensions;
-- migrations run as the platform owner, which can.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── f_unaccent ──────────────────────────────────────────────
-- IMMUTABLE so an expression built from it can be indexed.
-- PARALLEL SAFE so the planner may build the index and run
-- queries with parallel workers.
CREATE OR REPLACE FUNCTION f_unaccent(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent', coalesce(p_text, ''))
$$;

COMMENT ON FUNCTION f_unaccent(text) IS
  'IMMUTABLE accent-fold wrapper around unaccent(regdictionary, text). Used in indexed expressions; see migration 20260926000000.';

-- ─── per-table tsvector builders ─────────────────────────────
-- Weight A = the name a human looks for. B = a secondary
-- label. C = identifiers and long text, which should not
-- outrank a name hit.

CREATE OR REPLACE FUNCTION contacts_search_tsv(
  p_full_name text,
  p_company_name text,
  p_email text,
  p_phone text,
  p_identification_number text,
  p_external_ref text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_full_name, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_company_name, ''))), 'B')
      || setweight(to_tsvector('spanish', f_unaccent(
           coalesce(p_email, '') || ' ' ||
           coalesce(p_phone, '') || ' ' ||
           coalesce(p_identification_number, '') || ' ' ||
           coalesce(p_external_ref, '')
         )), 'C')
$$;

CREATE OR REPLACE FUNCTION conversations_search_tsv(
  p_subject text,
  p_category text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_subject, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_category, ''))), 'B')
$$;

CREATE OR REPLACE FUNCTION tasks_search_tsv(
  p_title text,
  p_description text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_title, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_description, ''))), 'B')
$$;

CREATE OR REPLACE FUNCTION documents_search_tsv(
  p_file_name text,
  p_summary_text text,
  p_ocr_text text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_file_name, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_summary_text, ''))), 'B')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_ocr_text, ''))), 'C')
$$;

CREATE OR REPLACE FUNCTION invoices_search_tsv(
  p_number text,
  p_clave text,
  p_consecutivo text,
  p_description text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_number, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(
           coalesce(p_clave, '') || ' ' || coalesce(p_consecutivo, '')
         )), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_description, ''))), 'B')
$$;

CREATE OR REPLACE FUNCTION orders_search_tsv(
  p_title text,
  p_description text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_title, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_description, ''))), 'B')
$$;

CREATE OR REPLACE FUNCTION products_search_tsv(
  p_name text,
  p_sku text,
  p_description text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('spanish', f_unaccent(coalesce(p_name, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_sku, ''))), 'A')
      || setweight(to_tsvector('spanish', f_unaccent(coalesce(p_description, ''))), 'B')
$$;

-- ─── tsvector GIN indexes ────────────────────────────────────
-- One per table, over the same expression the service calls.
-- These are plain CREATE INDEX and not CONCURRENTLY: Prisma
-- runs each migration inside a transaction, and CONCURRENTLY
-- cannot run in one. The tables are workspace-scoped CRM data,
-- so the build is short.

CREATE INDEX contacts_search_tsv_idx ON "contacts"
  USING GIN (contacts_search_tsv(
    full_name, company_name, email, phone, identification_number, external_ref
  ));

CREATE INDEX conversations_search_tsv_idx ON "conversations"
  USING GIN (conversations_search_tsv(subject, category));

CREATE INDEX tasks_search_tsv_idx ON "tasks"
  USING GIN (tasks_search_tsv(title, description));

CREATE INDEX documents_search_tsv_idx ON "documents"
  USING GIN (documents_search_tsv(file_name, summary_text, ocr_text));

CREATE INDEX invoices_search_tsv_idx ON "invoices"
  USING GIN (invoices_search_tsv(number, clave, consecutivo, description));

CREATE INDEX orders_search_tsv_idx ON "orders"
  USING GIN (orders_search_tsv(title, description));

CREATE INDEX products_search_tsv_idx ON "products"
  USING GIN (products_search_tsv(name, sku, description));

-- ─── trigram indexes, for the typo a tsvector cannot see ─────
-- `websearch_to_tsquery` turns "contable" into the token
-- "contabl" and misses "contabilidad" only if stemming fails;
-- it turns "contavle" into "contavl" and misses outright. A
-- trigram index answers that one. `%` uses `pg_trgm`'s
-- `similarity_threshold` (0.3 by default), so it is a fuzzy
-- second chance and never the primary path.
--
-- The expression is `f_unaccent(col)` so the fold is inside the
-- indexed expression and the query side reuses the same call.

CREATE INDEX contacts_full_name_trgm_idx ON "contacts"
  USING GIN (f_unaccent(coalesce(full_name, '')) gin_trgm_ops);

CREATE INDEX conversations_subject_trgm_idx ON "conversations"
  USING GIN (f_unaccent(coalesce(subject, '')) gin_trgm_ops);

CREATE INDEX tasks_title_trgm_idx ON "tasks"
  USING GIN (f_unaccent(coalesce(title, '')) gin_trgm_ops);

CREATE INDEX documents_file_name_trgm_idx ON "documents"
  USING GIN (f_unaccent(coalesce(file_name, '')) gin_trgm_ops);

CREATE INDEX invoices_number_trgm_idx ON "invoices"
  USING GIN (f_unaccent(coalesce(number, '')) gin_trgm_ops);

CREATE INDEX orders_title_trgm_idx ON "orders"
  USING GIN (f_unaccent(coalesce(title, '')) gin_trgm_ops);

CREATE INDEX products_name_trgm_idx ON "products"
  USING GIN (f_unaccent(coalesce(name, '')) gin_trgm_ops);
