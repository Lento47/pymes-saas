import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` only. There is deliberately no `push` and no `migrate`
 * script here: the database is Cloudflare D1, which is not a SQLite file a local
 * tool can open, and the only thing that may write to it is
 * `wrangler d1 migrations apply` — locally against the Miniflare copy, remotely
 * against `pymhubdb`. A generated migration is a reviewable artefact; a push is
 * not.
 */
export default defineConfig({
	dialect: "sqlite",
	schema: ["./src/schema.ts", "./src/auth-schema.ts"],
	out: "./migrations",
});
