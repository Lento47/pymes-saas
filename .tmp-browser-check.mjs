// Temporary: serve the built client and browser-check every public docs-center page.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = "L:/PROJECTS/pymes-saas/pymes-saas";
const DIST = path.join(ROOT, "apps/web/dist/public");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 4611;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(DIST, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

const readSrc = (p) => fs.readFileSync(path.join(ROOT, "apps/web/client/src", p), "utf8");
const registry = readSrc("lib/documentation.ts");
const block = registry.slice(registry.indexOf("DOCUMENTATION_ENTRIES"), registry.indexOf("export function getDocumentationBySlug"));

const entries = [];
for (const chunk of block.split(/\n {2}\{\n/).slice(1)) {
  const grab = (re) => (chunk.match(re) || [])[1];
  entries.push({
    slug: grab(/slug: "([^"]+)"/),
    title: grab(/title: "([^"]+)"/),
    category: grab(/category: "([^"]+)"/),
    visibility: grab(/visibility: "([^"]+)"/),
    repoPath: grab(/repoPath: "([^"]+)"/),
  });
}
const publicEntries = entries.filter((e) => e.visibility === "public");

/** First markdown heading text, used as the probe that real content rendered. */
function probeFor(repoPath) {
  const abs = path.join(ROOT, repoPath);
  if (!fs.existsSync(abs)) return null;
  for (const line of fs.readFileSync(abs, "utf8").split("\n")) {
    const m = line.match(/^#{1,2} (.+)$/);
    if (m) return m[1].replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  }
  return null;
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
const norm = (s) => decode(s).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ");

function dom(url) {
  return execFileSync(
    CHROME,
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--disable-extensions", "--user-data-dir=L:/PROJECTS/pymes-saas/pymes-saas/.tmp-chrome-profile", "--virtual-time-budget=4000", "--dump-dom", url],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
  );
}

function tryDom(route) {
  try {
    return dom(`http://127.0.0.1:${PORT}${route}`);
  } catch (err) {
    fail(route, `chrome failed: ${String(err?.message ?? err).slice(0, 120)}`);
    console.log("ERROR");
    return null;
  }
}

await new Promise((r) => server.listen(PORT, r));
const results = [];
const fail = (route, why) => results.push({ route, ok: false, why });

// 1. The center itself.
{
  process.stdout.write("checking /documentation ... ");
  const html = tryDom("/documentation");
  if (!html) { server.close(); console.error("the center itself did not render:", results.at(-1)?.why); process.exit(1); }
  const text = norm(html);
  if (/Document not available|Documento no disponible/.test(decode(html))) fail("/documentation", "rendered the not-found copy");
  const cards = (html.match(/href="\/documentation\/[a-z0-9-]+"/g) || []).length;
  const titlesMissing = publicEntries.filter((e) => e.title && !text.includes(norm(e.title))).map((e) => e.slug);
  if (cards !== publicEntries.length)
    fail("/documentation", `${cards} doc links rendered, expected ${publicEntries.length}`);
  else if (titlesMissing.length)
    fail("/documentation", `titles not rendered: ${titlesMissing.join(", ")}`);
  else { results.push({ route: "/documentation", ok: true, why: `${cards} doc links, all titles rendered` }); console.log("ok"); }
}

// 2. Every public doc page.
for (const e of publicEntries) {
  const route = `/documentation/${e.slug}`;
  process.stdout.write(`checking ${route} ... `);
  const html = tryDom(route);
  if (!html) continue;
  const text = norm(html);
  if (/Document not available|Documento no disponible/.test(decode(html))) {
    fail(route, "not-found branch rendered");
    continue;
  }
  const probe = probeFor(e.repoPath);
  const headings = (html.match(/<h[1-3][ >]/g) || []).length;
  const problems = [];
  if (!probe) problems.push("no probe heading found in source file");
  else if (!text.includes(norm(probe))) problems.push(`probe heading not in DOM: "${probe}"`);
  if (headings < 3) problems.push(`only ${headings} headings rendered`);
  if (problems.length) { fail(route, problems.join("; ")); console.log("FAIL"); }
  else { results.push({ route, ok: true, why: `${headings} headings, tables ${(html.match(/<table/g) || []).length}` }); console.log("ok"); }
}

// 3. Legal routes reached from the bridge section.
for (const e of entries.filter((x) => x.category === "legal")) {
  const route = `/legal/${e.slug}`;
  process.stdout.write(`checking ${route} ... `);
  const html = tryDom(route);
  if (!html) continue;
  if (/Document not available|Documento no disponible/.test(decode(html))) { fail(route, "not-found branch rendered"); console.log("FAIL"); }
  else { results.push({ route, ok: true, why: `${(html.match(/<h[1-3][ >]/g) || []).length} headings` }); console.log("ok"); }
}

server.close();
const failures = results.filter((r) => !r.ok);
for (const r of results) if (!r.ok) console.log("FAIL", r.route, "-", r.why);
console.log(`\n${results.length - failures.length} PASS / ${failures.length} FAIL of ${results.length} routes checked`);
process.exit(failures.length ? 1 : 0);
