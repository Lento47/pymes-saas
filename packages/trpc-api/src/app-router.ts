/**
 * The type the two apps import: `import type { AppRouter } from "api/app-router"`.
 *
 * It is a re-export rather than the definition so that this package's public surface is one
 * file that only ever exports a type — a client that imports it gets no runtime code, and a
 * client that imports it by this path never reaches into `src/routers`.
 */
export type { AppRouter } from "./routers";
