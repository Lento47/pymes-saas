import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Merchant back controls used to fall back to `/more`, which is not a route.
 * `leaveScreen` then had nowhere to stand and the reader landed on home.
 */

const ROOT = join(import.meta.dir, "..");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		if (entry === "backups" || entry === "node_modules") return [];
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) return walk(full);
		if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) return [];
		return [full];
	});
}

describe("merchant leave fallbacks", () => {
	test("no screen still names /more", () => {
		const hits = walk(ROOT).flatMap((file) => {
			if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return [];
			const source = readFileSync(file, "utf8");
			if (!source.includes('to="/more"') && !source.includes("to={'/more'}")) {
				return [];
			}
			return [file.slice(ROOT.length + 1)];
		});
		expect(hits).toEqual([]);
	});
});
