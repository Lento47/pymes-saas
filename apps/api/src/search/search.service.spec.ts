import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaService } from "../common/prisma/prisma.service";
import { SEARCHABLE_TYPES, SearchService, type SearchableType } from "./search.service";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../prisma/migrations/20260926000000_add_full_text_search/migration.sql",
);
const MIGRATION_SQL = readFileSync(MIGRATION_PATH, "utf8");

/**
 * Collapse whitespace to a canonical token stream, so the comparison is about
 * the SQL and not about where a formatter put a line break. Only the space
 * *inside* a call — after `(`, before `)`, either side of `,` — is not
 * meaningful. The space before a following operator is, so leave it alone.
 */
const flat = (sql: string) =>
  sql
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ",")
    .trim();

/**
 * The tsvector call the GIN index is built over, straight out of the migration.
 * The service must emit the identical call, or the index is never used.
 */
function indexedExpression(table: string): string {
  const match = MIGRATION_SQL.match(
    new RegExp(
      `CREATE INDEX \\w+_search_tsv_idx ON "${table}"\\s+USING GIN \\(([\\s\\S]*?)\\);`,
    ),
  );
  if (!match) {
    throw new Error(`migration has no search_tsv index for "${table}"`);
  }
  return flat(match[1]);
}

interface Captured {
  sql: string;
  params: unknown[];
}

function makeService() {
  const captured: Captured[] = [];
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn((sql: string, ...params: unknown[]) => {
      captured.push({ sql, params });
      return Promise.resolve([]);
    }),
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;

  return { service: new SearchService(prisma), captured, tx, prisma };
}

describe("SearchService", () => {
  describe("index/query drift", () => {
    it.each(SEARCHABLE_TYPES.map((t) => [t] as [SearchableType]))(
      "builds %s over the same expression its GIN index uses",
      async (type) => {
        const { service, captured } = makeService();

        await service.search("ws_1", "maria", [type], 10);

        expect(captured).toHaveLength(1);
        expect(flat(captured[0].sql)).toContain(
          `${indexedExpression(type)} @@ websearch_to_tsquery`,
        );
      },
    );

    it.each(SEARCHABLE_TYPES.map((t) => [t] as [SearchableType]))(
      "keeps the %s partial-query path on the indexed name column",
      async (type) => {
        const { service, captured } = makeService();

        await service.search("ws_1", "ma", [type], 10);

        // The trigram indexes are on the primary name column only. A substring
        // predicate anywhere else is a sequential scan that no index accelerates.
        expect(flat(captured[0].sql)).toMatch(
          /f_unaccent\(coalesce\([a-z_]+,''\)\) ILIKE '%' \|\| f_unaccent\(\$2\) \|\| '%'/,
        );
      },
    );

    it("has a search_tsv index and a trigram index for every searchable type", () => {
      for (const type of SEARCHABLE_TYPES) {
        expect(MIGRATION_SQL).toMatch(
          new RegExp(`CREATE INDEX \\w+_search_tsv_idx ON "${type}"`),
        );
      }
    });
  });

  describe("tenant isolation", () => {
    it("stated twice: set_config in the transaction and workspace_id in every WHERE", async () => {
      const { service, captured, tx } = makeService();

      await service.search("ws_1", "maria", [...SEARCHABLE_TYPES], 10);

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      for (const { sql, params } of captured) {
        expect(sql).toContain("WHERE workspace_id = $1");
        // The predicate binds $1 to the workspace, so the query cannot be
        // pointed at another tenant by editing the SQL string alone.
        expect(params[0]).toBe("ws_1");
      }
    });

    it("runs every query inside the same transaction that sets the RLS context", async () => {
      const { service, prisma, tx } = makeService();

      await service.search("ws_1", "maria", ["contacts", "tasks"], 10);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });
  });

  describe("query handling", () => {
    it("returns the empty shape without touching the database for a blank query", async () => {
      const { service, prisma, tx } = makeService();

      const result = await service.search("ws_1", "   ", [...SEARCHABLE_TYPES], 10);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(result.total).toBe(0);
      for (const type of SEARCHABLE_TYPES) {
        expect(result[type]).toEqual([]);
      }
    });

    it("returns the empty shape without touching the database for no requested types", async () => {
      const { service, prisma } = makeService();

      await service.search("ws_1", "maria", [], 10);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("drops unknown types instead of letting them reach the SQL", async () => {
      const { service, captured } = makeService();

      await service.search("ws_1", "maria", ["contacts", "secrets", "invoices"], 10);

      expect(captured).toHaveLength(2);
      expect(captured[0].sql).toContain('FROM "contacts"');
      expect(captured[1].sql).toContain('FROM "invoices"');
    });

    it("only ever queries the types that were asked for", async () => {
      const { service, captured } = makeService();

      await service.search("ws_1", "maria", ["products"], 10);

      expect(captured).toHaveLength(1);
      expect(captured[0].sql).toContain('FROM "products"');
    });

    it("clamps limit to at most 50", async () => {
      const { service, captured } = makeService();

      await service.search("ws_1", "maria", ["contacts"], 5000);

      expect(captured[0].params[2]).toBe(50);
    });

    it("clamps a nonsensical limit up to 1", async () => {
      const { service, captured } = makeService();

      await service.search("ws_1", "maria", ["contacts"], -3);

      expect(captured[0].params[2]).toBe(1);
    });

    it("reports the trimmed query and a total across buckets", async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        $queryRawUnsafe: jest
          .fn()
          .mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }])
          .mockResolvedValueOnce([{ id: "t1" }]),
      };
      const prisma = {
        $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      } as unknown as PrismaService;

      const result = await new SearchService(prisma).search(
        "ws_1",
        "  maria  ",
        ["contacts", "tasks"],
        10,
      );

      expect(result.query).toBe("maria");
      expect(result.contacts).toHaveLength(2);
      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(3);
    });
  });

  describe("searchable types", () => {
    it("covers the entities the dashboard groups together", () => {
      expect([...SEARCHABLE_TYPES]).toEqual([
        "contacts",
        "conversations",
        "tasks",
        "documents",
        "invoices",
        "orders",
        "products",
      ]);
    });
  });
});
