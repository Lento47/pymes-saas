import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The migration set is the contract between `schema.ts` (and its peers) and the database,
 * and nothing has ever checked it. Four production 500s in one session had the same shape:
 * the Worker read a column the database did not have. `delivery_speed` (migration unapplied),
 * `weekly_minor` (dropped by a migration the code no longer matched), `price_book_id` (its
 * migration's FK failing on an unseeded parent), and `zone_lat` / `zone_lng` / `zone_radius_km`
 * (migration written ninety minutes after the last `migrations apply`). Every one of them is a
 * drift between what `schema.ts` declares and what the `.sql` files actually do, and every one
 * reached a browser as a 500 with a `requestId` and no other clue.
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

/** Table → column names, as declared by drizzle across `packages/db/src`. */
function columnsFromSchema(): Map<string, Set<string>> {
	const src = new URL("./src/", import.meta.url).pathname.replace(/^\//, "");
	const tables = new Map<string, Set<string>>();

	for (const file of readdirSync(src).filter((f) => f.endsWith(".ts"))) {
		const source = readFileSync(join(src, file), "utf8");

		const tablePattern =
			/sqliteTable\(\s*(?:\"([^\"]+)\"|'([^']+)'|([A-Za-z_$][\w$]*))\s*,\s*\{/g;
		for (const match of source.matchAll(tablePattern)) {
			const name = match[1] ?? match[2] ?? match[3];
			if (!name) continue;

			const start = match.index + match[0].length;
			let depth = 1;
			let i = start;
			for (; i < source.length && depth > 0; i++) {
				if (source[i] === "{") depth++;
				else if (source[i] === "}") depth--;
			}
			const body = source.slice(start, i);

			const columns = new Set<string>();
			for (const column of body.matchAll(/\(\s*`"?([a-z_][a-z0-9_]*)`"?/gi)) {
				columns.add(column[1].toLowerCase());
			}
			const key = name.toLowerCase();
			if (!tables.has(key)) tables.set(key, columns);
			else columns.forEach((c) => tables.get(key)!.add(c));
		}
	}

	return tables;
}

/** Table → column names, as the `.sql` files actually create or add them. */
function columnsFromMigrations(): Map<string, Set<string>> {
	const dir = new URL("./migrations/", import.meta.url).pathname.replace(/^\//, "");
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
			/create\s+table\s+(?:if\s+not\s+exists\s+)?`?"?([\w]+)`?"?\s*\(([\s\S]*?)\n?\)\s*;?/gi,
		)) {
			const table = ensure(m[1]);
			for (const column of m[2].matchAll(/^\s*`"?([a-z_][a-z0-9_]*)`?"?\s+\w/gi)) {
				table.add(column[1].toLowerCase());
			}
		}

		for (const m of sql.matchAll(
			/alter\s+table\s+`?"?([\w]+)`?"?\s+add\s+(?:column\s+)?`"?([a-z_][a-z0-9_]*)/gi,
		)) {
			ensure(m[1]).add(m[2].toLowerCase());
		}

		for (const m of sql.matchAll(
			/alter\s+table\s+`?"?([\w]+)`?"?\s+rename\s+(?:column\s+)?`"?([a-z_][a-z0-9_]*)`?"?\s+to\s+`"?([a-z_][a-z0-9_]*)/gi,
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

		const drift: string[] = [];
		for (const [table, columns] of declared) {
			const have = migrated.get(table);
			if (!have) {
				drift.push(`table "${table}" is declared in schema.ts but no migration creates it`);
				continue;
			}
			for (const column of columns) {
				if (!have.has(column)) drift.push(`${table}.${column}`);
			}
		}

		expect(
			drift,
			`schema.ts declares ${drift.length} column(s) that no migration creates. Each one is a\nproduction 500 the moment a query selects it, so add a migration before deploying the code\nthat reads it:\n\n  ${drift.join("\n  ")}\n`,
		).toEqual([]);
	});

	/**
	 * The four collision pairs below are frozen: production records their exact filenames,
	 * so a rename would make wrangler re-run `ALTER TABLE … ADD COLUMN` on an already-applied
	 * column and fail. They are asserted here so a FIFTH collision of any number — new or old —
	 * breaks the build immediately.
	 */
	const frozenNumberPairs = [
		["0010", "0010_magenta_tomorrow_man.sql, 0010_messy_bullseye.sql"],
		["0011", "0011_clean_red_wolf.sql, 0011_subscriptions.sql"],
		["0012", "0012_business_listed.sql, 0012_chemical_lethal_legion.sql"],
		["0020", "0020_crash_report.sql, 0020_small_the_watchers.sql"],
	] as const;

	test("duplicate migration numbers are exactly the documented frozen pairs, nothing else", () => {
		const dir = new URL("./migrations/", import.meta.url).pathname.replace(/^\//, "");
		const byPrefix = new Map<string, string[]>();

		for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
			const prefix = /^(\d+)_/.exec(file)?.[1];
			if (!prefix) continue;
			byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file]);
		}

		const actual: string[] = [];
		for (const [prefix, files] of byPrefix) {
			if (files.length > 1) {
				actual.push(`${prefix}: ${files.sort().join(", ")}`);
			}
		}

		const frozenKeys = new Set(frozenNumberPairs.map(([k]) => k));
		const unfrozen = actual.filter((entry) => !frozenKeys.has(entry.split(": ")[0]));

		expect(
			unfrozen,
			`A new or unexpected duplicate migration number appeared. These collision pairs are\nfrozen because production's d1_migrations records the old filenames — a rename makes\nwrangler re-run statements that already applied and fail on a duplicate column. Extend\nthis luck at your peril:\n\n  ${actual.join("\n  ")}\n`,
		).toEqual([]);
	});

});
