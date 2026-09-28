import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every `--sc-*` token a block references must exist in the scope.
 *
 * A missing custom property does not throw. `var(--sc-navy)` with no definition
 * resolves to nothing, so the declaration that used it silently falls back to the
 * browser default — which for `background` or `color` means transparent, or black, or
 * whatever was inherited. The block renders, the tests pass, and the mistake is only
 * visible to a person looking at the page.
 *
 * That is precisely how the first version of this scope shipped: it referenced
 * `--sc-white-alpha-40`, which the rewrite had removed, and nothing caught it.
 */

const CSS = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");

/** Every `--sc-*` name declared inside the `.showcase` scope. */
function declaredTokens(): Set<string> {
  const start = CSS.indexOf(".showcase {");
  expect(start, "the .showcase scope exists in index.css").toBeGreaterThan(-1);

  const end = CSS.indexOf("\n}", start);
  const scope = CSS.slice(start, end);

  const names = new Set<string>();
  for (const match of scope.matchAll(/(--sc-[a-z0-9-]+)\s*:/g)) names.add(match[1]);
  return names;
}

function blockFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return blockFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

describe("the .showcase scope", () => {
  it("is declared in index.css", () => {
    expect(declaredTokens().size).toBeGreaterThan(0);
  });

  it("defines every token the storefront blocks reference", () => {
    const declared = declaredTokens();
    const missing: string[] = [];

    for (const file of blockFiles(join(process.cwd(), "client/src/components/storefront"))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/var\((--sc-[a-z0-9-]+)\)/g)) {
        if (!declared.has(match[1])) missing.push(`${match[1]} (${file.split(/[\\/]/).pop()})`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("keeps its palette on the brand's values", () => {
    // The scope exists to present the existing brand, so the two anchors it is built
    // on have to stay put: the navy marketing canvas and the amber accent. A drift
    // here is the difference between PymesHub and a template.
    const scope = CSS.slice(CSS.indexOf(".showcase {"), CSS.indexOf("\n}", CSS.indexOf(".showcase {")));

    expect(scope).toContain("--sc-navy:         #05091d");
    expect(scope).toContain("--sc-amber:        #f59e0b");
  });

  it("sets no display serif, because the brand has never used one", () => {
    // Instrument Serif was introduced by the first version of this scope and read as a
    // template. PymesHub is Manrope at every level; a hero serif was never the brand.
    const scope = CSS.slice(CSS.indexOf(".showcase {"), CSS.indexOf("\n}", CSS.indexOf(".showcase {")));

    expect(scope).not.toContain("Instrument Serif");
    expect(scope).toContain("--sc-font-sans: 'Manrope'");
  });
});
