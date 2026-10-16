// Temporary: summarise a dumped DOM — headings and visible text in order.
import fs from "node:fs";

const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");
s = s.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const m = s.match(/<body[^>]*>([\s\S]*)<\/body>/);
const body = m ? m[1] : s;

const dec = (t) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");

console.log("=== HEADINGS ===");
for (const [tag, txt] of body.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)) {
  const t = dec(txt.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  if (t) console.log(`  ${tag}: ${t.slice(0, 90)}`);
}

console.log("\n=== VISIBLE TEXT IN ORDER ===");
const walker = body.replace(/<(section|div|header|footer|main|nav|li|button|h[1-6])[^>]*>/g, "\n$&");
const lines = dec(walker.replace(/<[^>]+>/g, "\n"))
  .split("\n")
  .map((l) => l.replace(/\s+/g, " ").trim())
  .filter(Boolean);
lines.forEach((l) => console.log("  " + l.slice(0, 95)));
console.log(`\n... ${lines.length} text nodes`);
