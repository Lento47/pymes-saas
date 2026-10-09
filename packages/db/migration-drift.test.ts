import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The migration set is the contract between `schema.ts` and the database, and nothing has
 * ever checked it.
 *
 * Four production 500s in one session had the same shape: the Worker read a column the
 * database did not have. `delivery_speed` (migration unapplied), `weekly_minor` (dropped by
 * a migration the code no longer matched), `price_book_id` (its migration's FK failing on an
 * unseeded parent), and `zone_lat` / `zone_lng` / `zone_radius_km` (migration written ninety
 * minutes after the last `migrations apply`). Every one of them is a drift between what
 * `schema.ts` declares and what the `.sql` files actually do, and every one reached a browser
 * as a 500 with a `requestId` and no other clue.
 *
 * So this reads both sides and fails on the difference. It is deliberately a **static** check:
 * it never connects to D1, never runs a migration, and cannot change a database. Everything
 * here is text in the repository, which is why it is safe to run in CI on every push.
 *
 * ## Why duplicate numbers are a failure and not a smell
 *
 * The four applied pairs — `0010_magenta_tomorrow_man` / `0010_messy_bullseye`, `0011_clean_red_wolf`
 * / `0011_subscriptions`, `0012_business_listed` / `0012_chemical_lethal_legion`, and
 * `0020_crash_report` / `0020_small_the_watchers` — all work today purely because drizzle
 * records applied migrations **by filename**, so the ordering falls back to lexicographic and
 * the collisions happen to interleave without harm. That is luck.
 *
 * **The applied filenames are frozen, and this test is why they stay frozen.** Renumbering one
 * would not reorder anything: production's `d1_migrations` records the old name, wrangler would
 * see a new unapplied filename whose statements are already in the database, and
 * `ALTER TABLE … ADD COLUMN` would fail on a duplicate column. That is an outage, so the fix
 * for the existing collisions is a guard on *new* ones and a note, not a rename.
 */

/** Table → column names, as declared by drizzle in `src/schema.ts`. */
function columnsFromSchema(): Map<string, Set<string>> {
	const source = readFileSync(
		new URL("./src/schema.ts", import.meta.url),
		"utf8",
	);
	const tables = new Map<string, Set<string>>();

	// `export const order = sqliteTable(\n  "order",\n  { … },`
	const tablePattern =
		/sqliteTable\(\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*,\s*\{/g;
	for (const match of source.matchAll(tablePattern)) {
		const name = match[1] ?? match[2] ?? match[3];
		if (!name) continue;

		// Walk to the matching close of the column object, tracking brace depth so a
		// `}` inside a nested options object does not end it early.
		const start = match.index + match[0].length;
		let depth = 1;
		let i = start;
		for (; i < source.length && depth > 0; i++) {
			if (source[i] === "{") depth++;
			else if (source[i] === "}") depth--;
		}
		const body = source.slice(start, i);

		// Drizzle's first argument is the SQL column name: `text("delivery_speed")`.
		const columns = new Set<string>();
		for (const column of body.matchAll(
			/^\s*[A-Za-z_$][\w$]*:\s*(?:text|integer|real|blob)\(\s*[`"']([a-z_][a-z0-9_]*)[`"']/gim,
		)) {
			columns.add(column[1].toLowerCase());
		}
		tables.set(name.toLowerCase(), columns);
	}

	return tables;
}

/** Table → column names, as the `.sql` files actually create or add them. */
function columnsFromMigrations(): Map<string, Set<string>> {
	const dir = new URL("./migrations/", import.meta.url).pathname.replace(
		/^\//,
		"",
	);
	const tables = new Map<string, Set<string>>();
	const ensure = (table: string) => {
		const key = table.toLowerCase();
		if (!tables.has(key)) tables.set(key, new Set());
		return tables.get(key) as Set<string>;
	};

	for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
		const sql = readFileSync(join(dir, file), "utf8")
			// Strip `--` comments so a commented-out ALTER cannot claim a column exists.
			.replace(/--[^\n]*/g, "");

		for (const m of sql.matchAll(
			/create\s+table\s+(?:if\s+not\s+exists\s+)?[`"']?([\w]+)[`"']?\s*\(([\s\S]*?)\n\)/gi,
		)) {
			const table = ensure(m[1]);
			for (const column of m[2].matchAll(
				/^\s*[`"']([a-z_][a-z0-9_]*)[`"']\s+\w/gim,
			)) {
				table.add(column[1].toLowerCase());
			}
		}

		for (const m of sql.matchAll(
			/alter\s+table\s+[`"']?([\w]+)[`"']?\s+add\s+(?:column\s+)?[`"']?([a-z_][a-z0-9_]*)/gi,
		)) {
			ensure(m[1]).add(m[2].toLowerCase());
		}

		for (const m of sql.matchAll(
			/alter\s+table\s+[`"']?([\w]+)[`"']?\s+rename\s+(?:column\s+)?[`"']?([a-z_][a-z0-9_]*)[`"']?\s+to\s+[`"']?([a-z_][a-z0-9_]*)/gi,
		)) {
			const table = ensure(m[1]);
			table.delete(m[2].toLowerCase());
			table.add(m[3].toLowerCase());
		}
	}

	return tables;
}

describe("the migration set matches the schema", () => {
	test("every column schema.ts declares is created by some migration", () => {
		const declared = columnsFromSchema();
		const migrated = columnsFromMigrations();

		// Named tables the schema owns. A table built from another (`sqliteTable` called on an
		// existing one, or a CTE) would show up without a migration of its own and is not drift.
		const drift: string[] = [];
		for (const [table, columns] of declared) {
			const have = migrated.get(table);
			if (!have) {
				drift.push(
					`table "${table}" is declared in schema.ts but no migration creates it`,
				);
				continue;
			}
			for (const column of columns) {
				if (!have.has(column)) drift.push(`${table}.${column}`);
			}
		}

		expect(
			drift,
			`schema.ts declares ${drift.length} column(s) that no migration creates. Each one is a
production 500 the moment a query selects it, so add a migration before deploying the code
that reads it:\n\n  ${drift.join("\n  ")}\n`,
		).toEqual([]);
	});

	test("no two migrations share a number", () => {
		const dir = new URL("./migrations/", import.meta.url).pathname.replace(
			/^\//,
			"",
		);
		const byPrefix = new Map<string, string[]>();

		for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
			const prefix = /^(\d+)_/.exec(file)?.[1];
			if (!prefix) continue;
			byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file]);
		}

		const collisions = [...byPrefix.entries()]
			.filter(([, files]) => files.length > 1)
			.map(([prefix, files]) => `${prefix}: ${files.sort().join(", ")}`);

		// The four already applied are listed so this test states them rather than hiding
		// them, and so a FIFTH collision is visibly new.
		expect(
			collisions,
			`Duplicate migration numbers. drizzle records applied migrations by filename, so these
only work because lexicographic order happens to interleave them — do not extend that luck, and
do not renumber the existing ones: production records those filenames, so a rename makes
wrangler re-run statements that already applied.\n\n  ${collisions.join("\n  ")}\n`,
		).toEqual([
			"0010: 0010_magenta_tomorrow_man.sql, 0010_messy_bullseye.sql",
			"0011: 0011_clean_red_wolf.sql, 0011_subscriptions.sql",
			"0012: 0012_business_listed.sql, 0012_chemical_lethal_legion.sql",
			"0020: 0020_crash_report.sql, 0020_small_the_watchers.sql",
		]);
	});
});
