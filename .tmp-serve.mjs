import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const DIST = "L:/PROJECTS/pymes-saas/pymes-saas/apps/web/dist/public";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg" };
http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (/^\/(api|trpc|socket\.io)/.test(url)) { res.writeHead(404); res.end(); return; }
    let file = path.join(DIST, url);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  })
  .listen(4612, () => console.log("serving on 4612"));
