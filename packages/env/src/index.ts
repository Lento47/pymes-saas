import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * One `.env`, at the root of the repo.
 *
 * Every process here — the API, the Next.js app, the agent, the Prisma CLI —
 * needs an overlapping subset of the same handful of values, and the secret and
 * the database URL have to be *identical* across them or the session cookie one
 * writes will not verify in the next. Five files that must agree is five files
 * that can disagree, and the failure is a silent redirect loop rather than an
 * error.
 *
 * So there is one file and it is read from the workspace root, whichever
 * directory the process happens to start in.
 *
 * **The real environment always wins.** A value already present in
 * `process.env` is never overwritten, so a platform's own configuration —
 * Vercel, Docker, systemd, CI — takes precedence and the file is purely a
 * local-development convenience. Nothing here is required: with no `.env` at
 * all this is a no-op, and the individual consumers report what they are
 * missing.
 */

/** Loaded in order, so `.env.local` overrides `.env`. Neither is required. */
const FILES = [".env", ".env.local"] as const;

let loaded = false;

/**
 * Walks up from `start` looking for the workspace root.
 *
 * The marker is a `package.json` that declares `workspaces` — the one thing
 * only the root has. Neither of the obvious alternatives works: every package
 * has a `package.json`, and several have their own `turbo.json`, so both stop
 * at whichever app the process started in and quietly read the wrong file (or
 * no file, which is worse — the failure is a missing variable reported three
 * frames away from the reason).
 */
function findWorkspaceRoot(start: string): string | null {
	let directory = resolve(start);

	for (;;) {
		if (isWorkspaceRoot(directory)) return directory;

		const parent = dirname(directory);
		if (parent === directory) return null;
		directory = parent;
	}
}

function isWorkspaceRoot(directory: string): boolean {
	const manifest = join(directory, "package.json");
	if (!existsSync(manifest)) return false;

	try {
		const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
		return (
			typeof parsed === "object" &&
			parsed !== null &&
			"workspaces" in parsed &&
			parsed.workspaces !== undefined
		);
	} catch {
		// A malformed package.json is somebody else's problem to report.
		return false;
	}
}

/**
 * A deliberately small `.env` parser.
 *
 * Handles what these files actually contain — `KEY=value`, optional quotes,
 * `#` comments, blank lines, an optional `export` prefix — and nothing else.
 * A dependency would be a supply-chain surface for thirty lines of string
 * handling that runs before anything else in the process.
 */
export function parseEnv(source: string): Record<string, string> {
	const values: Record<string, string> = {};

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
			line,
		);
		if (!match) continue;

		const key = match[1];
		let value = (match[2] ?? "").trim();
		if (!key) continue;

		const quote = value[0];
		if (
			(quote === '"' || quote === "'") &&
			value.endsWith(quote) &&
			value.length > 1
		) {
			value = value.slice(1, -1);
			// Escapes are only meaningful inside double quotes, matching every
			// other dotenv implementation — a Windows path in single quotes should
			// survive intact.
			if (quote === '"') {
				value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
			}
		} else {
			// An unquoted value runs to the first ` #`, so `PORT=3001 # the api`
			// is a port and not a sentence.
			const comment = value.indexOf(" #");
			if (comment !== -1) value = value.slice(0, comment).trim();
		}

		values[key] = value;
	}

	return values;
}

/**
 * Reads the workspace-root `.env` files into `process.env`.
 *
 * Idempotent and safe to call from anywhere; the first call does the work.
 */
export function loadRootEnv(): void {
	if (loaded) return;
	loaded = true;

	const root = findWorkspaceRoot(process.cwd());
	if (!root) return;

	// Merged across files first, so `.env.local` beats `.env`. Applying each
	// file straight to `process.env` would let `.env` win instead: it is read
	// first, and the "never overwrite" rule below cannot tell a value set by an
	// earlier file from one set by the platform.
	const merged: Record<string, string> = {};

	for (const file of FILES) {
		const path = join(root, file);
		if (!existsSync(path)) continue;

		try {
			Object.assign(merged, parseEnv(readFileSync(path, "utf8")));
		} catch {
			// An unreadable .env is not worth crashing a process over — the
			// consumer that needs a missing value will say so by name.
		}
	}

	for (const [key, value] of Object.entries(merged)) {
		if (process.env[key] === undefined) process.env[key] = value;
	}
}
