/// <reference types="@cloudflare/workers-types" />

import { drizzle } from "drizzle-orm/d1";

import * as relations from "./relations";
import * as tables from "./schema";

/**
 * Tables and relations in one object, because that is what `db.query` reads to
 * resolve `with: { products: true }`. Passed as tables alone, a relational query
 * silently has nothing to relate.
 */
const schema = { ...tables, ...relations };

/**
 * A factory, not a module-scope instance, and that is the whole design of this
 * file.
 *
 * The D1 binding exists per request: a Worker receives it as `env.DB`, and a
 * second isolate, a `wrangler d1 execute`, and a `bun test` have no `env` at all.
 * A module-scope `export const db = drizzle(env.DB)` would therefore be wrong
 * three ways — it would read a binding that is not there, it would pin one
 * isolate's connection for the lifetime of the process, and it would make the
 * module unimportable from anything that is not a running Worker. Callers hold
 * the binding and hand it over: `createDb(c.env.DB)` inside a request, a
 * `better-sqlite3`-shaped test database in a spec.
 */
export function createDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
