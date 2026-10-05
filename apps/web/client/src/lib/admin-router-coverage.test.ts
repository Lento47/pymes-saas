import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every `admin.*` procedure has a way to be called from the console.
 *
 * ## The defect this exists to prevent
 *
 * Five procedures were reachable through the API and called by **nothing**: `products`,
 * `promotions`, `reviews`, `courierInvites` and `unpublishProduct`. All five typechecked, all
 * five were covered by the router, and all five were invisible in the product.
 *
 * Three of them are lists the platform maintains at the cost of a query — products,
 * promotions, reviews — and showed to nobody. The fifth is worse than an orphan: `unpublishProduct`
 * is how `product.unpublish`, an action in `ADMIN_ACTIONS` **and** in
 * `REASON_REQUIRED_ACTIONS`, would ever have been performed. The platform had a written policy
 * about taking a mispriced product off the marketplace, a mandatory reason nobody could
 * supply, and no button.
 *
 * That is the shape this catches. An orphan procedure is invisible in review, invisible in
 * tests, and invisible in types — the only evidence it is unused is a grep nobody runs.
 *
 * ## Why this reads files instead of importing them
 *
 * The router is a tRPC `createRouter({ … })` object and the client is a plain object literal;
 * neither exposes "my keys" in a form worth importing across the package boundary, and importing
 * the router into a web test would pull the whole service graph into jsdom. So both sides are
 * read as text.
 *
 * That is a real limitation and it is stated rather than hidden: a procedure added with an
 * unusual spelling would not be seen here, and the test would pass having proved less than it
 * appears to. Both patterns below are narrow and deliberate — `<name>: adminProcedure` at the
 * router's one-tab indentation, and `trpc.admin.<name>` in the client — so the risk is a rename
 * to a different style, not a silent miss on today's code.
 */

/**
 * The repo root, counted out from this file.
 *
 * Five levels: `src/lib` → `src` → `client` → `web` → `apps` → root. Written as a walk rather
 * than `process.cwd()` because Vitest's root is `apps/web/client` (the Vite config sets it),
 * so a cwd-relative path would resolve under the wrong package entirely.
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..");
const ROUTER_PATH = join(REPO_ROOT, "packages", "trpc-api", "src", "routers", "admin.ts");
const CLIENT_PATH = join(REPO_ROOT, "apps", "web", "client", "src", "lib", "admin.ts");

const routerSource = readFileSync(ROUTER_PATH, "utf-8");
const clientSource = readFileSync(CLIENT_PATH, "utf-8");

/**
 * Every procedure on the admin router, in the router's own tab-indented shape.
 *
 * The pattern deliberately stops at `adminProcedure` rather than anchoring to end-of-line,
 * because the router uses two forms and both are real: `metrics: adminProcedure.query(…)` on
 * one line for a procedure with no input, and a name, newline, `.input(…)` and `.mutation(…)`
 * for one that takes arguments. The first version anchored with `$` and silently found 31 of
 * 35 — and the four it missed were reported as "phantoms", which reads like a client bug and is
 * the opposite. A coverage test that under-matches produces a false alarm; this asserts its own
 * count so that shape cannot drift again.
 */
const procedures = [
  ...new Set(
    [...routerSource.matchAll(/^\t([a-zA-Z][a-zA-Z0-9]*): adminProcedure\b/gm)].map(
      (match) => match[1] as string,
    ),
  ),
].sort();

/** Every procedure the console's client knows how to call. */
const clientCalls = new Set(
  [...clientSource.matchAll(/trpc\.admin\.([a-zA-Z][a-zA-Z0-9]*)/g)].map(
    (match) => match[1] as string,
  ),
);

describe("the admin router and the console", () => {
  it("finds the procedures it is meant to find", () => {
    // A regex that silently matches nothing makes every other assertion in this file
    // vacuously true, which is the worst failure mode a test like this has. So the count is
    // asserted, and it is a floor rather than an exact number so adding a procedure does not
    // break it.
    expect(procedures.length).toBeGreaterThan(34);
    // Two spot checks by name, so a future edit that changes the *shape* being matched fails
    // loudly instead of quietly matching a different set.
    expect(procedures).toContain("metrics");
    expect(procedures).toContain("deleteBusiness");
  });

  it("has a client method for every procedure", () => {
    const orphaned = procedures.filter((name) => !clientCalls.has(name));
    expect(orphaned).toEqual([]);
  });

  it("calls nothing that is not a procedure", () => {
    // The other direction, and it catches the mistake this file exists near: a client method
    // left behind after a procedure was renamed or removed, which fails at runtime as a tRPC
    // error rather than at build time.
    const phantoms = [...clientCalls]
      .filter((name) => !procedures.includes(name))
      .sort();
    expect(phantoms).toEqual([]);
  });
});