import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Works in both ESM (dev via tsx) and CJS (prod bundle via esbuild --format=cjs).
// In CJS output, esbuild resolves import.meta.url via its own shim; at runtime
// we prefer Node's built-in __dirname if available to avoid the empty
// import.meta warning and ensure correctness.
const moduleDir: string =
  typeof (globalThis as { __dirname?: string }).__dirname === "string"
    ? (globalThis as { __dirname: string }).__dirname
    : path.dirname(fileURLToPath(import.meta.url));

export function serveStatic(app: Express) {
  const distPath = path.resolve(moduleDir, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
