/**
 * Fetch an Arc UI registry item and write it into `components/arc/`.
 *
 * Verbatim, because the point of taking a component from a registry rather than writing one
 * is that it is somebody else's reviewed code. The adaptations this repository makes are all
 * deliberate and all marked in place:
 *
 * 1. `motion/react` is aliased to the installed `framer-motion` - see `vite.config.ts` and
 *    `tsconfig.json`. Same library, pre-rename name.
 * 2. `foundation.css` maps Arc's token *names* onto this app's *values*, so an Arc component
 *    renders in this app's palette. It also does not ship Arc's
 *    `:is(*:focus) { outline: none !important }`, which would strip focus rings app-wide.
 *    **That file is an adapter, not a copy, and this script will never overwrite it.**
 * 3. The folder is excluded from biome in the same way `packages/ui/src/components` is, so
 *    upstream diffs stay readable.
 *
 * Run with `node script/vendor-arc.mjs <name> [<name>.]`. Pass `--force` to overwrite files that
 * already exist.
 *
 * ## Why an existing file is never overwritten by default
 *
 * This is not caution about upstream; it is that the vendored files are **not** verbatim any
 * more, and the difference matters. `metric-card.tsx` has an `animate` prop Arc has no
 * equivalent for, `sortable-data-table.tsx` has a render test, and `foundation.css` is a
 * deliberate rewrite rather than a copy. Re-running this script over them would silently
 * discard that work and leave a component whose CSS no longer matches its TSX.
 *
 * An earlier version of this file documented that behaviour and did not implement it — it
 * called `writeFile` unconditionally, so the promise in the docblock and the code disagreed.
 * The only reason it had not destroyed anything is that nothing had ever re-run it.
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/**
 * `components/`, not `components/arc/`.
 *
 * The registry target is `@components/arc/<item>/<file>`, so it already carries the `arc/`
 * segment. Joining that to a destination that ends in `arc` produced `arc/arc/<item>` — a nested
 * copy that still rendered, still typechecked, and was only caught because the token guard
 * scans the tree recursively rather than a fixed list of directories.
 */
const DEST = join(ROOT, "client", "src", "components");

const args = process.argv.slice(2);
const force = args.includes("--force");
const names = args.filter((arg) => !arg.startsWith("--"));

if (names.length === 0) {
  console.error("usage: node script/vendor-arc.mjs [--force] <item> [<item>.]");
  process.exit(1);
}

/**
 * Never vendored, and never overwritten.
 *
 * `arc-foundation` arrives as a `registryDependency` of essentially every item, and installing
 * it would replace `foundation.css` — which is not Arc's file but this app's adapter onto it.
 * See `foundation-tokens.test.ts` for what that adapter has to get right.
 */
const NEVER_VENDOR = new Set(["arc-foundation"]);

/** Strip the registry's `@`-prefixed install target down to a path under `components/`. */
function targetToRelative(target) {
  return String(target)
    .replace(/^@/, "")
    .replace(/^components\//, "");
}

/**
 * Where a file belongs, preferring the manifest's own `target` over its `path`.
 *
 * The target is authoritative because it is what the shadcn CLI honours, and blocks do not
 * always live where their components do. Deriving the destination from `path` happened to work
 * for every component and would have failed the first block.
 */
function destinationFor(file) {
  if (file.target) return targetToRelative(file.target);
  return String(file.path).replace(
    /^registry\/(?:components|blocks)\/[^/]+\//,
    "",
  );
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const seen = new Set();
const needed = new Set();

async function vendor(name) {
  if (seen.has(name) || NEVER_VENDOR.has(name)) return;
  seen.add(name);

  const response = await fetch(`https://uiarc.dev/r/${name}.json`);
  if (!response.ok) {
    // 404 is the signal that an item is not on the free tier, so it is worth reporting
    // precisely rather than as a generic failure.
    console.error(
      `${name}: ${response.status} ${response.status === 404 ? "(not in the free registry)" : response.statusText}`,
    );
    return;
  }

  const manifest = await response.json();
  for (const dependency of manifest.dependencies ?? []) needed.add(dependency);

  // Registry dependencies first, so a block's own components exist before the block imports
  // them. `arc-foundation` is filtered inside `vendor`.
  for (const dependency of manifest.registryDependencies ?? []) {
    const id = String(dependency)
      .split("/")
      .pop()
      ?.replace(/\.json$/, "");
    if (id) await vendor(id);
  }

  for (const file of manifest.files ?? []) {
    const relative = destinationFor(file);
    const target = join(DEST, relative);

    if (!force && (await exists(target))) {
      console.log(`skip    ${relative} (exists; pass --force to overwrite)`);
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content ?? "", "utf8");
    console.log(`write   ${relative}`);
  }
}

for (const name of names) await vendor(name);

/**
 * npm dependencies are reported rather than installed.
 *
 * `pnpm install` in this repository is not something a vendoring script should do behind the
 * operator's back: the lockfile is shared with other work in the tree, and an install triggered
 * by a component fetch is exactly the kind of surprise that leaves a half-updated lockfile. The
 * list is printed so the operator can decide.
 */
if (needed.size > 0) {
  console.log(`\nnpm dependencies required: ${[...needed].sort().join(", ")}`);
  console.log(
    "install them yourself if any are missing — this script does not run an install.",
  );
}
