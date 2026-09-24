import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Every command that can reach a Cloudflare account names the environment it means.
 *
 * `apps/api/wrangler.toml` defines more than one environment, so a `wrangler` command that
 * does not say which one it means is ambiguous — and wrangler's answer is a **warning,
 * then the top-level environment**, which is the dangerous half of both. `[env.production]`
 * repeats the top-level `name`, so a bare `wrangler deploy` ships the top-level `[vars]`:
 * `CORS_ORIGINS="http://localhost:3000,…"` and `AUTH_URL="http://localhost:8787"` land on
 * the production Worker, which then refuses every real browser origin and hands out dev
 * cookies. It is also the one failure in this repository with no error attached to it — the
 * deploy succeeds.
 *
 * `docs/environment.md` states the rule, tabulates which task targets which environment, and
 * then says the quiet part out loud: *"nothing in the repository enforces it; a CI job is
 * the place to make that structural."* This is that enforcement, written as a test rather
 * than as a CI step so it also fails on the machine of whoever is about to run the command.
 * A test that only CI runs is a rule a person discovers after pushing.
 *
 * ## Why the home is `packages/env`
 *
 * The same reason `root.spec.ts` lives here: this package already reads the repository's own
 * configuration files — `turbo.json`, `.env.example` — and asserts that they agree with each
 * other, because a variable declared in one list and missing from another fails *silently*.
 * A deploy script that disagrees with `wrangler.toml` is that same class of drift, one file
 * further out.
 */

const repoRoot = resolve(import.meta.dir, "..", "..", "..");

/**
 * Where the workspace globs point, read from the root manifest rather than written out.
 *
 * A hardcoded list of packages would be a second definition of "the workspace" — and the one
 * that goes stale would be the one that silently stops checking a package somebody added.
 * Only the `<dir>/*` shape this repository uses is expanded; anything else would want a glob
 * library for no benefit, and a pattern that quietly matched nothing is caught by the
 * non-vacuity test at the bottom rather than passing as a green sweep over zero files.
 */
function workspaceDirs(): string[] {
	const manifest: unknown = JSON.parse(
		readFileSync(join(repoRoot, "package.json"), "utf8"),
	);
	const patterns =
		typeof manifest === "object" &&
		manifest !== null &&
		"workspaces" in manifest
			? ((manifest as { workspaces?: string[] }).workspaces ?? [])
			: [];

	const dirs: string[] = [];
	for (const pattern of patterns) {
		const star = pattern.indexOf("*");
		if (star === -1) {
			dirs.push(join(repoRoot, pattern));
			continue;
		}
		const parent = join(repoRoot, pattern.slice(0, star));
		for (const entry of readdirSync(parent, { withFileTypes: true })) {
			if (entry.isDirectory()) dirs.push(join(parent, entry.name));
		}
	}
	return dirs;
}

/**
 * Whether a script is a `wrangler` invocation that can touch an account.
 *
 * `--local` is the exemption, and it is a better one than the command's name: `wrangler dev`
 * with no flag runs against the simulated database in `apps/api/.wrangler`, and the
 * environment selects nothing there — which is exactly why `db:migrate:local` and `db:seed`
 * are documented as deliberately passing no `--env`. Keying on `--local` states that reason
 * instead of listing the two scripts it happens to be true of today.
 *
 * `tail` is included although it writes nothing: it is read-only and it still *targets* an
 * environment, so a bare `wrangler tail` watches whichever Worker the top-level name resolves
 * to while its reader believes they are watching staging. `--dry-run` is included for the
 * mirror of that reason — `bun run --filter=api build` exists to resolve the bindings the
 * deploy *would* ship, and a dry run against the wrong environment is a green run that
 * answers a question nobody asked.
 *
 * `apps/web`'s deploy is not checked, and that is not an oversight: it runs through
 * `opennextjs-cloudflare`, not `wrangler`, and `apps/web/wrangler.jsonc` has no environment
 * blocks — one Worker, so there is no environment for it to name.
 */
function reachesCloudflare(script: string): boolean {
	if (!/\bwrangler\b/.test(script)) return false;
	if (script.includes("--local")) return false;
	return /(^|\s)(deploy|tail|d1\s+(migrations\s+apply|execute))(\s|$)/.test(
		script,
	);
}

/** Every script the rule applies to, as `<package> → <script>`, for the non-vacuity check. */
function checked(): string[] {
	const found: string[] = [];
	for (const dir of workspaceDirs()) {
		const manifest: unknown = JSON.parse(
			readFileSync(join(dir, "package.json"), "utf8"),
		);
		if (typeof manifest !== "object" || manifest === null) continue;
		const { name, scripts } = manifest as {
			name?: string;
			scripts?: Record<string, string>;
		};
		for (const [script, command] of Object.entries(scripts ?? {})) {
			if (reachesCloudflare(command)) found.push(`${name} → ${script}`);
		}
	}
	return found;
}

describe("every Cloudflare command names its environment", () => {
	it("finds the workspace packages rather than sweeping nothing", () => {
		// Ten today, across apps/* and packages/*. The floor is below that on purpose — it is
		// here to catch a root manifest whose `workspaces` stopped resolving, not to be
		// updated every time somebody adds a package.
		expect(workspaceDirs().length).toBeGreaterThanOrEqual(8);
	});

	it("is looking at the scripts it thinks it is", () => {
		/*
		 * The sweep below is a regex over strings, and a regex that stopped matching would
		 * make its assertion silently vacuous — green because it examined nothing. These
		 * three pin it from both sides: the pair the rule exists for (one deploy, one
		 * migration), and the local pair it must *not* be flagging.
		 */
		const seen = checked();
		expect(seen).toContain("api → deploy");
		expect(seen).toContain("api → build");
		expect(seen).toContain("@pymeshub/db → db:migrate:remote");
		expect(seen).not.toContain("@pymeshub/db → db:migrate:local");
		expect(seen).not.toContain("@pymeshub/db → db:seed");
	});

	it("names one in every script that reaches an account", () => {
		const violations: string[] = [];
		for (const dir of workspaceDirs()) {
			const manifest: unknown = JSON.parse(
				readFileSync(join(dir, "package.json"), "utf8"),
			);
			if (typeof manifest !== "object" || manifest === null) continue;
			const { name, scripts } = manifest as {
				name?: string;
				scripts?: Record<string, string>;
			};
			for (const [script, command] of Object.entries(scripts ?? {})) {
				if (!reachesCloudflare(command)) continue;
				// `--env production` and `--env staging` both satisfy this. Which one is
				// correct is not something a test can know — it is a decision, recorded in
				// the table in `docs/environment.md`, and the deploy scripts match it.
				if (command.includes("--env")) continue;
				violations.push(`${name} → ${script}: ${command}`);
			}
		}
		expect(violations).toEqual([]);
	});
});
