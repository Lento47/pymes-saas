#!/usr/bin/env node
/**
 * Run one of this package's devDependency binaries, found by resolution instead of by PATH.
 *
 * ## Why this exists
 *
 * Every script in this package's `package.json` failed. Not one — all of them:
 *
 *     $ pnpm test
 *     'vitest' is not recognized as an internal or external command
 *     $ pnpm check
 *     'tsc' is not recognized as an internal or external command
 *
 * `dev`, `build`, `lint`, `format`, `test` and `test:watch` were all dead, and the reason is
 * the `.npmrc` at the repository root:
 *
 *     node-linker = hoisted
 *
 * Hoisted linking puts every dependency in the **root** `node_modules`, flat, and leaves each
 * workspace package holding only a handful of entries. Here that means
 * `apps/web/node_modules` has 3 bin shims and 8 package directories, while `vitest`, `react`
 * and `express` all resolve fine from the root — which is why the production build and the
 * test suite both worked when invoked by absolute path, and why nobody noticed that the
 * documented commands did not.
 *
 * The linker is not the bug, and this does not undo it. That setting is deliberate and
 * documented at length: Windows path-length ceilings break react-native-worklets' native
 * CMake build under the `.pnpm` store layout, and the note in `.npmrc` says so. Switching
 * back would move a working mobile build to fix a broken web one.
 *
 * `pnpm run` builds its PATH from **this package's** `node_modules/.bin`, and `pnpm exec` does
 * not consult the workspace root's either — both verified here, not assumed. So the fix is to
 * stop asking either of them where the binary is.
 *
 * ## What this does
 *
 * Resolves `<name>/package.json` through Node's own algorithm — which already walks up to the
 * root and succeeds, as `require.resolve("vitest/package.json")` shows — reads that package's
 * `bin` field, and runs the entry with `process.execPath`. Node runs it, so nothing needs to
 * be executable, nothing needs a shell, and the `.cmd` shims Windows generates are bypassed
 * rather than fought.
 *
 * Layout-agnostic as a result: it works under `hoisted`, under the isolated `.pnpm` layout,
 * and under an npm install. If the linker is ever changed, these scripts keep working.
 *
 * ## Usage
 *
 *     node script/run-bin.mjs vitest run
 *     node script/run-bin.mjs tsx script/build.ts
 *     node script/run-bin.mjs --env NODE_ENV=production some-bin --flag
 *
 * `--env NAME=VALUE` (repeatable) sets a variable on the child only. It exists because
 * `cross-env` was being used solely to work around Windows not accepting `NODE_ENV=x cmd` in a
 * package script, and this does the same thing in one line without the dependency.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);

/**
 * Command name → package name, for bins whose name is not their package's.
 *
 * A `bin` entry is allowed to be called anything, and Node's resolver only answers questions
 * about packages — so `tsc` cannot be resolved, because the package is `typescript`. npm and
 * pnpm both paper over this with an install-time lookup table; this is that table, minus the
 * install step.
 *
 * It is one line rather than a generated file because it is one line. If a second one appears,
 * the honest fix is a generated table written by the install step rather than growing this by
 * hand — noted here so the next person does not read the smallness as a reason to make it big.
 */
const BIN_TO_PACKAGE = { tsc: "typescript" };

/** `--env` pairs, which apply to the child and never to this process. */
const env = {};
const rest = [];
for (let index = 0; index < argv.length; index += 1) {
	const arg = argv[index];
	if (arg !== "--env") {
		rest.push(arg);
		continue;
	}
	const pair = argv[index + 1];
	if (pair === undefined) fail("--env needs a NAME=VALUE pair after it");
	const separator = pair.indexOf("=");
	if (separator < 1) fail(`--env got "${pair}", which is not NAME=VALUE`);
	env[pair.slice(0, separator)] = pair.slice(separator + 1);
	index += 1;
}

const [name, ...args] = rest;
if (!name) fail("no binary named. Usage: node script/run-bin.mjs <bin> [args…]");

/**
 * `node` is not a package, so there is nothing to resolve.
 *
 * `pnpm start` runs this file with Node already, which means the runtime that should execute
 * the target is the one we are standing in — no resolution, no shim, just pass the script
 * through. It is spelled out rather than left to fail, because the failure mode without this
 * branch is a confusing "could not resolve \"node\"" for the one command that can never fail
 * to find Node.
 */
const isNodeItself = name === "node";

/**
 * The JS file a package's `bin` field points at.
 *
 * `bin` is either a string (named after the package, so `{"vitest": "./x.js"}` and
 * `"./x.js"` are both legal) or a map of names to paths. Both shapes are handled, and the
 * string form uses the **package** name rather than the name typed on the command line,
 * because they are allowed to differ and the field is what the author actually declared.
 */
function entryFor(packageJsonPath) {
	const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	const bin = manifest.bin;

	if (typeof bin === "string") return path.resolve(path.dirname(packageJsonPath), bin);
	if (bin && typeof bin === "object") {
		const preferred = bin[name] ?? Object.values(bin)[0];
		if (typeof preferred === "string")
			return path.resolve(path.dirname(packageJsonPath), preferred);
	}
	return null;
}

let entry = null;
if (!isNodeItself) {
	const packageName = BIN_TO_PACKAGE[name] ?? name;
	try {
		entry = entryFor(require.resolve(`${packageName}/package.json`));
	} catch {
		// The underlying `MODULE_NOT_FOUND` message is deliberately dropped. It carries a
		// "Require stack" that points at this file and says nothing actionable, and the
		// likelier truth when a bin will not resolve here is that it *is* installed — at the
		// workspace root, which is exactly the situation this script exists for. So the
		// message names the package it looked for and what to do about it.
		fail(
			`could not resolve "${name}" — looked for the package "${packageName}". It should ` +
				`be a devDependency of this package. If the bin and its package have different ` +
				`names, it needs an entry in BIN_TO_PACKAGE.`,
		);
	}

	if (!entry) fail(`"${name}" resolved, but its package.json declares no runnable "bin".`);
}

const result = spawnSync(process.execPath, [...(entry ? [entry] : []), ...args], {
	stdio: "inherit",
	env: { ...process.env, ...env },
});

if (result.error) fail(`${name} could not be started: ${result.error.message}`);

/**
 * Propagate the child's exit code, and its signal, as our own.
 *
 * Without this a failing `tsc` exits **0** and a build looks green. `build` and `check` both
 * gate deploys, so an exit code that always says success is worse than the missing binary was.
 */
if (result.signal) process.kill(process.pid, result.signal);
process.exit(result.status ?? 1);

function fail(message) {
	process.stderr.write(`run-bin: ${message}\n`);
	process.exit(1);
}