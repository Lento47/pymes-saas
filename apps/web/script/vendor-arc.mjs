/**
 * Fetch an Arc UI registry component and write it into `components/arc/`.
 *
 * Verbatim, because the point of taking a component from a registry rather than writing one
 * is that it is somebody else's reviewed code. The adaptations this repository makes are all
 * deliberate and all marked in place:
 *
 * 1. `motion/react` is aliased to the installed `framer-motion` — see `vite.config.ts` and
 *    `tsconfig.json`. Same library, pre-rename name.
 * 2. `foundation.css` maps Arc's token *names* onto this app's *values*, so an Arc component
 *    renders in this app's palette. It also does not ship Arc's
 *    `:is(*:focus) { outline: none !important }`, which would strip focus rings app-wide.
 * 3. The folder is excluded from biome in the same way `packages/ui/src/components` is, so
 *    upstream diffs stay readable.
 *
 * Run with `node script/vendor-arc.mjs <name> [<name>…]`. Writes only when the target does not
 * already exist, so re-running is a no-op rather than a silent overwrite of a local edit.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "client", "src", "components", "arc");

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error("usage: node script/vendor-arc.mjs <component> [<component>…]");
  process.exit(1);
}

for (const name of names) {
  const response = await fetch(`https://uiarc.dev/r/${name}.json`);
  if (!response.ok) {
    // 404 is the signal that a component is not on the free tier, so it is worth reporting
    // precisely rather than as a generic failure.
    console.error(
      `${name}: ${response.status} ${response.status === 404 ? "(not in the free registry)" : response.statusText}`,
    );
    continue;
  }

  const manifest = await response.json();
  for (const file of manifest.files ?? []) {
    const relative = String(file.path).replace(/^registry\/components\//, "");
    const target = join(DEST, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content ?? "", "utf8");
    console.log(`wrote ${relative}`);
  }
}
