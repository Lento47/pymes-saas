import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * The entity kinds `GET /api/search` will look in. Order here is the order the
 * dashboard groups them in — people first, work second, paperwork third.
 */
export const SEARCHABLE_TYPES = [
  "contacts",
  "conversations",
  "tasks",
  "documents",
  "invoices",
  "orders",
  "products",
] as const;

export type SearchableType = (typeof SEARCHABLE_TYPES)[number];

/**
 * One table's search shape. The `tsv` and `nameColumn` expressions must match
 * `apps/api/prisma/migrations/20260926000000_add_full_text_search/migration.sql`
 * exactly — the GIN index is defined over the same function call, so a drift
 * here turns a two-millisecond index lookup into a sequential scan without
 * changing a single row of results.
 */
interface TypeSpec {
  table: string;
  /** Projected columns, already snake_cased to match the rest of the API. */
  select: string;
  /** Indexed tsvector expression. */
  tsv: string;
  /** The column a partial query falls back to matching as a substring. */
  nameColumn: string;
  /** Recency column the ORDER BY falls back to when ranks tie. */
  recency: string;
}

const SPECS: Record<SearchableType, TypeSpec> = {
  contacts: {
    table: "contacts",
    select: `id, type, full_name, company_name, email, phone,
             identification_type, identification_number, last_interaction_at,
             created_at, updated_at`,
    tsv: `contacts_search_tsv(full_name, company_name, email, phone,
          identification_number, external_ref)`,
    nameColumn: "full_name",
    recency: "updated_at",
  },
  conversations: {
    table: "conversations",
    select: `id, subject, category, status, priority, contact_id, assigned_user_id,
             last_message_at, created_at, updated_at`,
    tsv: "conversations_search_tsv(subject, category)",
    nameColumn: "subject",
    recency: "coalesce(last_message_at, updated_at)",
  },
  tasks: {
    table: "tasks",
    select: `id, title, status, priority, due_at, contact_id, assigned_user_id,
             completed_at, created_at, updated_at`,
    tsv: "tasks_search_tsv(title, description)",
    nameColumn: "title",
    recency: "updated_at",
  },
  documents: {
    table: "documents",
    select: `id, file_name, mime_type, status, contact_id, conversation_id,
             file_size, created_at, updated_at`,
    tsv: "documents_search_tsv(file_name, summary_text, ocr_text)",
    nameColumn: "file_name",
    recency: "updated_at",
  },
  invoices: {
    table: "invoices",
    select: `id, number, status, hacienda_status, amount, currency, due_date,
             contact_id, conversation_id, issue_date, created_at, updated_at`,
    tsv: "invoices_search_tsv(number, clave, consecutivo, description)",
    nameColumn: "number",
    recency: "updated_at",
  },
  orders: {
    table: "orders",
    select: `id, title, status, amount, currency, contact_id, conversation_id,
             assigned_user_id, received_at, completed_at, created_at, updated_at`,
    tsv: "orders_search_tsv(title, description)",
    nameColumn: "title",
    recency: "coalesce(received_at, updated_at)",
  },
  products: {
    table: "products",
    select: `id, name, sku, type, is_active, current_stock, min_stock,
             track_inventory, unit_price, category_id, created_at, updated_at`,
    tsv: "products_search_tsv(name, sku, description)",
    nameColumn: "name",
    recency: "updated_at",
  },
};

/** One row per entity kind. Column names match the table, snake_cased. */
type SearchRows = Record<SearchableType, unknown[]>;

export interface SearchResult extends SearchRows {
  query: string;
  total: number;
}

const MAX_LIMIT = 50;

/**
 * Full-text search across the CRM entities a workspace owns.
 *
 * ## Two matches, not one
 *
 * A tsquery is exact about tokens: `websearch_to_tsquery('spanish', 'cafe')`
 * produces the stem `cafe`, which does match `café` only because the query and
 * the index both fold accents first — and it does **not** match `cafetería`'s
 * stem for a user who typed `cafet`. A single-token tsquery also misses
 * anything shorter than a word: typing `ma` should find `María`, and a
 * tsvector cannot do that.
 *
 * So each table runs an OR of two predicates:
 *
 *   1. `tsv @@ websearch_to_tsquery(...)` — stemming, stopwords, the real match.
 *   2. `nameColumn ILIKE '%…%'` on the accent-folded name — what a person
 *      expects from a search box while they are still typing.
 *
 * (2) is what the `gin_trgm_ops` indexes in the migration accelerate. Without
 * them it is a sequential scan per table per keystroke.
 *
 * ## Tenant isolation is stated twice on purpose
 *
 * `PrismaService.setWorkspaceContext` uses `set_config(..., is_local => true)`,
 * which Postgres scopes to the **transaction**. Outside an explicit
 * transaction every statement is its own transaction, so the setting is gone
 * before the query it was meant to guard runs. The RLS policy would then see an
 * empty `app.workspace_id` and hide every row — correct, but useless.
 *
 * Two defences, both needed:
 *
 *   - All seven queries run inside one interactive `$transaction`, with
 *     `set_config` as the first statement in it, so RLS is genuinely active.
 *   - Every query also carries `WHERE workspace_id = $1`, which is correct even
 *     if RLS is off (a superuser, a migration, a broken policy). Belt and
 *     braces; dropping either one is a tenant leak or a silent empty result.
 *
 * ## Blank queries are not searches
 *
 * `websearch_to_tsquery` of an empty or all-stopword string yields an empty
 * tsquery, which matches nothing, and `ILIKE '%%'` matches everything. Neither
 * is an answer, so a query that trims to nothing returns the empty shape
 * without touching the database.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    workspaceId: string,
    q: string,
    types: string[],
    limit: number,
  ): Promise<SearchResult> {
    const requested = types.filter((t): t is SearchableType =>
      (SEARCHABLE_TYPES as readonly string[]).includes(t),
    );

    const trimmed = (q ?? "").trim();
    if (!trimmed || requested.length === 0) {
      return this.emptyResult(trimmed);
    }

    const take = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 10),
    );

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return Promise.all(
        requested.map((type) =>
          tx.$queryRawUnsafe<unknown[]>(
            this.buildSql(type),
            workspaceId,
            trimmed,
            take,
          ),
        ),
      );
    });

    const result = this.emptyResult(trimmed);
    requested.forEach((type, index) => {
      result[type] = rows[index] ?? [];
    });
    result.total = requested.reduce((sum, type) => sum + result[type].length, 0);

    return result;
  }

  private buildSql(type: SearchableType): string {
    const spec = SPECS[type];
    return `
      SELECT ${spec.select}
      FROM "${spec.table}"
      WHERE workspace_id = $1
        AND (
          ${spec.tsv} @@ websearch_to_tsquery('spanish', f_unaccent($2))
          OR f_unaccent(coalesce(${spec.nameColumn}, '')) ILIKE '%' || f_unaccent($2) || '%'
        )
      ORDER BY
        ts_rank(${spec.tsv}, websearch_to_tsquery('spanish', f_unaccent($2))) DESC,
        ${spec.recency} DESC
      LIMIT $3
    `;
  }

  private emptyResult(query: string): SearchResult {
    const buckets = Object.fromEntries(
      SEARCHABLE_TYPES.map((type) => [type, []]),
    ) as SearchRows;
    return { ...buckets, query, total: 0 };
  }
}
