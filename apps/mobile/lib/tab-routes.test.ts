import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every route file under a Tabs layout must be explicitly declared there.
 *
 * Expo Router auto-registers undeclared files as visible tabs — file-name
 * label, no icon — which is how six managed screens once crowded the
 * merchant bar with `supp…`, `activi…`, `pay…` tabs nobody declared. Stack
 * layouts are exempt: auto-registration is the correct behaviour there.
 */

const APP = join(import.meta.dir, "..", "app");

/** Route files in a group dir: `index.tsx` → `index`, `dir/[id].tsx` → `dir/[id]`. */
function routeFiles(groupDir: string, prefix = ""): string[] {
	return readdirSync(groupDir).flatMap((entry) => {
		if (entry === "_layout.tsx" || !entry.endsWith(".tsx")) {
			if (!entry.includes(".")) {
				const full = join(groupDir, entry);
				if (statSync(full).isDirectory())
					return routeFiles(full, `${prefix}${entry}/`);
			}
			return [];
		}
		return [`${prefix}${entry.slice(0, -".tsx".length)}`];
	});
}

/** `name="…"` on `<Tabs.Screen>` declarations only — `TabMark` glyph names excluded. */
function declaredScreens(layoutSource: string): string[] {
	const names: string[] = [];
	for (const match of layoutSource.matchAll(
		/<Tabs\.Screen\s+name="([^"]+)"/g,
	)) {
		const name = match[1];
		if (name !== undefined) names.push(name);
	}
	return names;
}

function tabsGroups(): { group: string; dir: string; layout: string }[] {
	return readdirSync(APP, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith("("))
		.map((entry) => ({
			group: entry.name,
			dir: join(APP, entry.name),
			layout: join(APP, entry.name, "_layout.tsx"),
		}))
		.filter(({ layout }) => {
			try {
				return readFileSync(layout, "utf-8").includes("<Tabs");
			} catch {
				return false;
			}
		});
}

for (const { group, dir, layout } of tabsGroups()) {
	describe(`${group} tab coverage`, () => {
		const files = routeFiles(dir).sort();
		const declared = declaredScreens(readFileSync(layout, "utf-8")).sort();

		test("every route file is declared in the layout", () => {
			expect(files.filter((file) => !declared.includes(file))).toEqual([]);
		});

		test("every declared screen names a route file", () => {
			expect(declared.filter((name) => !files.includes(name))).toEqual([]);
		});
	});
}
