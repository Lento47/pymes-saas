import "@testing-library/jest-dom";

/**
 * The SaaS API host, for tests.
 *
 * Set here rather than in each test file because `lib/api.ts` and `lib/error-reporting.ts`
 * both resolve their base from `import.meta.env` **at module load**, so a test that wants to
 * exercise either has to have the variable in place before the import is evaluated — which
 * a `beforeEach` cannot do.
 *
 * It is a dummy value and nothing resolves it: every test that reaches the network stubs
 * `fetch`. What it buys is that the guard which refuses an unconfigured base does not fire
 * in the suite, so the three tests that were failing are testing their own subject again
 * rather than the absence of a build variable.
 */
/**
 * `ImportMetaEnv` declares its members `readonly`, which is right for a build-time constant
 * and wrong for a test that has to stand one up. Rather than widen the global type for
 * every consumer, the cast is local to here and the object it reaches is the same
 * `import.meta.env` both clients read at module load.
 */
const env = import.meta.env as Record<string, string | undefined>;
if (!env.VITE_API_URL) {
  env.VITE_API_URL = "https://saas-api.test";
}
