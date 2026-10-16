// Temporary docs-center registry check. Verifies, from the source of truth:
//  - every entry's repoPath exists on disk
//  - every entry resolves to content (docs-content key, legal-content key, or inline sections)
//  - no duplicate slugs, no duplicate repoPaths pointing at missing files
import fs from "node:fs";
import path from "node:path";

const root = "apps/web/client/src";
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const registry = read("lib/documentation.ts");
const docsContent = read("data/docs/docs-content.ts");
const legalContent = read("data/legal/legal-content.ts");

/** Keys of a `Record<string, string>` style map file: `  key: valueRaw,` */
function contentKeys(src) {
  const keys = new Set();
  const body = src.slice(src.indexOf("{"), src.lastIndexOf("}"));
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*"?([A-Za-z0-9_-]+)"?:\s*\w+Raw,\s*$/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const docsKeys = contentKeys(docsContent);
const legalKeys = contentKeys(legalContent);

// Parse DOCUMENTATION_ENTRIES entry by entry, at the top-level indent of 2 spaces.
const start = registry.indexOf("DOCUMENTATION_ENTRIES");
const block = registry.slice(start, registry.indexOf("export function getDocumentationBySlug"));
const entries = [];
for (const chunk of block.split(/\n {2}\{\n/).slice(1)) {
  const grab = (re) => (chunk.match(re) || [])[1];
  entries.push({
    slug: grab(/slug: "([^"]+)"/),
    category: grab(/category: "([^"]+)"/),
    visibility: grab(/visibility: "([^"]+)"/),
    repoPath: grab(/repoPath: "([^"]+)"/),
    hasSections: /\n {4}sections: \[/.test(chunk),
  });
}

const problems = [];
const seen = new Map();
for (const e of entries) {
  if (!e.slug) problems.push(`entry with no slug near ${JSON.stringify(e)}`);
  if (seen.has(e.slug)) problems.push(`duplicate slug: ${e.slug}`);
  seen.set(e.slug, true);
  if (!e.repoPath) problems.push(`${e.slug}: no repoPath`);
  else if (!fs.existsSync(path.join("apps/web/client/src/data", e.repoPath.replace("apps/web/client/src/data/", ""))))
    problems.push(`${e.slug}: repoPath missing on disk -> ${e.repoPath}`);
  const hasContent = docsKeys.has(e.slug) || legalKeys.has(e.slug) || e.hasSections;
  if (!hasContent) problems.push(`${e.slug}: no content (not in docs-content, legal-content, and has no inline sections)`);
}

const byCategory = {};
for (const e of entries) byCategory[e.category] = (byCategory[e.category] || 0) + 1;

console.log("entries:", entries.length);
console.log("by category:", JSON.stringify(byCategory));
console.log("public:", entries.filter((e) => e.visibility === "public").length);
console.log("docs-content keys:", docsKeys.size, "| legal-content keys:", legalKeys.size);
console.log("problems:", problems.length);
for (const p of problems) console.log("  -", p);
process.exit(problems.length ? 1 : 0);
