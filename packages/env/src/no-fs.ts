/**
 * What `@pymeshub/env` is in a client bundle: nothing, and that is the correct
 * answer.
 *
 * The real module reads `.env` through `node:fs` and `node:path`. Neither a phone
 * nor a browser has those — and neither should: a bundle that reaches a device is
 * a file anyone can unzip, so nothing in it may be decided at runtime by looking
 * at the disk. Both build tools do the equivalent job at *build* time instead.
 * Expo substitutes every `process.env.EXPO_PUBLIC_*` reference textually, which is
 * why the variables a mobile build reads have to be named literally in the source
 * rather than looked up in a loop; Next does the same for `NEXT_PUBLIC_*`.
 *
 * This file exists because `@pymeshub/auth`'s root module imports
 * `@pymeshub/env/load` for its side effect, so a client that only wanted
 * `createMarketplaceAuthClient` would otherwise drag `node:fs` into its graph. On
 * Metro that is an error naming a module nobody wrote; under Turbopack it is worse,
 * because the bundle resolves and then fails at chunk-generation time with
 *
 *   the chunking context (unknown) does not support external modules
 *   (request: node:fs)
 *
 * which names neither this package nor the import that reached it. The
 * `react-native` and `browser` export conditions in `package.json` route both
 * imports here instead.
 *
 * `loadRootEnv` is a no-op rather than a throw, deliberately. The callers of the
 * real one are Node processes that want the file loaded before they read
 * `process.env`; in a client there is no file to load and no problem to report.
 * Throwing would turn "this platform has no `.env`" — a fact — into a crash at
 * import time, in the module that every screen's auth client passes through.
 *
 * `parseEnv` is deliberately **not** re-exported. It is pure and would work here,
 * but nothing in a client reads a dotenv string, and a stub that returned `{}`
 * would be a function that looks like it parsed something.
 */

/** No `.env` exists on a phone or in a browser. The bundler has already inlined what a build needs. */
export function loadRootEnv(): void {}
