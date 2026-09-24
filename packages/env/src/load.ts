import { loadRootEnv } from "./index";

/**
 * Side-effect entry point: `import "@pymeshub/env/load";`.
 *
 * ES module imports are hoisted and evaluated before any statement in the
 * importing file, so a module that reads `process.env` at import time — as
 * `@pymeshub/auth`'s config and `@pymeshub/db`'s client both do — cannot load the file
 * itself from its own top-level code and still be sure it ran first. Importing
 * this module can only run before them.
 */
loadRootEnv();
