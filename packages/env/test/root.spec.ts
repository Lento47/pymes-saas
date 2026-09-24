import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Finding the workspace root is the part of this package that can fail
 * silently. If it stops one directory too early it reads a file that exists
 * but holds a different set of variables, and the symptom appears somewhere
 * else entirely — a missing `AUTH_SECRET` reported by the Worker's own check,
 * three frames from the reason.
 *
 * The first `turbo.json` walking up was exactly that bug: `apps/api` and the old
 * `apps/agent` each have their own, so the API resolved its root to `apps/api`.
 */

/** The same walk as `loadRootEnv`, kept here so the property is testable. */
function findRoot(start: string): string | null {
	let directory = resolve(start);

	for (;;) {
		const manifest = join(directory, "package.json");
		if (existsSync(manifest)) {
			try {
				const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
				if (
					typeof parsed === "object" &&
					parsed !== null &&
					"workspaces" in parsed &&
					parsed.workspaces !== undefined
				) {
					return directory;
				}
			} catch {
				// fall through
			}
		}

		const parent = dirname(directory);
		if (parent === directory) return null;
		directory = parent;
	}
}

const repoRoot = resolve(import.meta.dir, "..", "..", "..");

describe("finding the workspace root", () => {
	it("finds it from the repo root itself", () => {
		expect(findRoot(repoRoot)).toBe(repoRoot);
	});

	it("finds it from a package that has its own turbo.json", () => {
		// The regression. Every app here ships its own turbo.json.
		for (const app of ["apps/api", "apps/web"]) {
			expect(findRoot(join(repoRoot, app))).toBe(repoRoot);
		}
	});

	it("finds it from a nested source directory", () => {
		expect(findRoot(join(repoRoot, "packages", "db", "src"))).toBe(repoRoot);
	});

	it("returns null above the repo rather than walking to /", () => {
		expect(findRoot("/")).toBeNull();
	});

	it("only matches a manifest that declares workspaces", () => {
		// Every package has a package.json; exactly one has `workspaces`.
		const manifest: unknown = JSON.parse(
			readFileSync(join(repoRoot, "apps", "api", "package.json"), "utf8"),
		);
		expect(
			typeof manifest === "object" &&
				manifest !== null &&
				"workspaces" in manifest,
		).toBe(false);
	});
});

describe("the committed .env.example", () => {
	const example = readFileSync(join(repoRoot, ".env.example"), "utf8");

	/** Uncommented lines only — a commented `# KEY=value` documents, it does not set. */
	function assigned(): Array<[string, string]> {
		return example
			.split("\n")
			.map((line) => line.trim())
			.filter(
				(line) =>
					line.length > 0 && !line.startsWith("#") && line.includes("="),
			)
			.map((line) => {
				const at = line.indexOf("=");
				return [
					line.slice(0, at),
					line
						.slice(at + 1)
						.trim()
						.replace(/^"|"$/g, ""),
				] as [string, string];
			});
	}

	it("names every variable an install cannot run without", () => {
		// Identity is Better Auth in the Worker and the data is Cloudflare D1. The four
		// `SUPABASE_*` names stay in this list because they are kept as placeholders in
		// `.env.example`, not because anything reads them; the two Cloudflare ids are
		// the ones whose absence actually stops an install, so an example that does not
		// name them sends a self-hoster to the docs to guess.
		const required = [
			"SUPABASE_URL",
			"SUPABASE_ANON_KEY",
			"SUPABASE_SERVICE_ROLE_KEY",
			"SUPABASE_JWT_SECRET",
			"CLOUDFLARE_ACCOUNT_ID",
			"D1_DATABASE_ID",
		];

		// Asserted against the *assignments*, not against the raw text. `example.includes(
		// "SUPABASE_URL=")` is satisfied by a line that is commented out, which would let
		// the placeholders be disabled while this test stayed green — the one outcome the
		// placeholders exist to prevent. `assigned()` is the same helper the secret test
		// below uses, so both read the file the same way.
		const named = new Set(assigned().map(([key]) => key));
		const missing = required.filter((key) => !named.has(key));
		expect(missing).toEqual([]);
	});

	it("ships no secret of its own", () => {
		// A committed example with a real-looking secret in it is a secret people paste
		// into production. Every value is either empty or says PLACEHOLDER, and this is
		// what makes that a rule rather than a habit.
		const suspicious = assigned()
			.filter(([, value]) => value.length > 0)
			.filter(([, value]) => !/placeholder/i.test(value))
			.filter(([, value]) => !value.startsWith("http://localhost"));

		expect(suspicious.map(([key]) => key)).toEqual([]);
	});

	it("documents every variable turborepo is told to pass through", () => {
		/*
		 * The rule, as `AGENTS.md` states it: *"If you add a variable, add it to `.env.example`
		 * with a note on what it does, and declare it in `turbo.json`'s
		 * `globalPassThroughEnv`."* Two lists, and until now only one of them was checked.
		 *
		 * It is worth checking in this direction because the two failures are opposite and only
		 * one of them is loud. A variable declared and *not* documented is invisible: turbo
		 * passes it, every task sees it, and the only person who cannot find it is a
		 * self-hoster reading the file that exists to tell them. A variable documented and not
		 * declared is the loud one — the task reads `undefined` and ships the wrong value — and
		 * the test below covers that half.
		 *
		 * Matched as a whole name, not as a substring: `API_URL` is inside
		 * `NEXT_PUBLIC_API_URL`, so a bare `includes` would let the name drop out of this file
		 * while this test stayed green — the same trap `assigned()` was written to avoid one
		 * test above. Word boundaries are the right tool because `_` is a word character, so
		 * `\bAPI_URL\b` does *not* match inside `NEXT_PUBLIC_API_URL`.
		 *
		 * A mention is enough, commented or assigned. `AUTH_SECRET`, `API_URL` and
		 * `CORS_ORIGINS` are deliberately commented out — the file explains why in each case —
		 * and requiring an assignment would force a placeholder secret back into it.
		 */
		const undocumented = [...passedThrough()]
			.filter((name) => !new RegExp(`\\b${name}\\b`).test(example))
			.sort();

		expect(undocumented).toEqual([]);
	});

	it("declares every variable it assigns", () => {
		/*
		 * The other direction, and the dangerous one: a name assigned in the root `.env` that
		 * no `turbo.json` declares is a name Turborepo **silently strips** from every task. The
		 * task succeeds having read `undefined`, which is how `API_URL` once reached a deployed
		 * Next.js bundle as the reader's own machine.
		 *
		 * Only the *assigned* names are checked. A commented one sets nothing, so a name like
		 * `MOBILE_URL` — documented here for `playwright.config.ts` and declared for `dev` —
		 * has no obligation in this direction.
		 */
		const declared = declaredEverywhere();
		const undeclared = assigned()
			.map(([key]) => key)
			.filter((key) => !declared.has(key));

		expect(undeclared).toEqual([]);
	});
});

/**
 * The string literals inside the array a key names, read as text.
 *
 * `turbo.json` is JSONC — both comment styles, and the schema URL contains `//` — so parsing
 * it needs a comment stripper, and a stripper is a second parser that can be wrong in a way
 * nothing notices. These are flat lists of uppercase names, so reading the quoted literals
 * between the key and the first `]` gets the same answer with nothing to get wrong.
 */
function declaredNames(source: string, key: string): string[] {
	const at = source.indexOf(`"${key}"`);
	if (at === -1) return [];
	const open = source.indexOf("[", at);
	const close = open === -1 ? -1 : source.indexOf("]", open);
	if (open === -1 || close === -1) return [];
	return [...source.slice(open, close).matchAll(/"([A-Za-z0-9_]+)"/g)].map(
		(match) => match[1] as string,
	);
}

/** Every `turbo.json` in the workspace, the root one included. */
function turboManifests(): string[] {
	const files = [join(repoRoot, "turbo.json")];
	for (const group of ["apps", "packages"]) {
		for (const entry of readdirSync(join(repoRoot, group), {
			withFileTypes: true,
		})) {
			if (!entry.isDirectory()) continue;
			const candidate = join(repoRoot, group, entry.name, "turbo.json");
			if (existsSync(candidate)) files.push(candidate);
		}
	}
	return files;
}

/**
 * The names the two pass-through lists declare, across every manifest.
 *
 * Every manifest and not only the root one: `apps/web/turbo.json` carries its own `env` for
 * the deploy task, and a sweep that read only `turbo.json` would call a name documented
 * because somebody happened to repeat it in the root list.
 */
function passedThrough(): Set<string> {
	const names = new Set<string>();
	for (const file of turboManifests()) {
		const source = readFileSync(file, "utf8");
		for (const key of ["globalPassThroughEnv", "env"]) {
			for (const name of declaredNames(source, key)) names.add(name);
		}
	}
	return names;
}

/** Every name any `turbo.json` declares, `globalEnv` included — a cache key is still a read. */
function declaredEverywhere(): Set<string> {
	const names = passedThrough();
	for (const file of turboManifests()) {
		const source = readFileSync(file, "utf8");
		for (const name of declaredNames(source, "globalEnv")) names.add(name);
	}
	return names;
}
