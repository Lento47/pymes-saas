import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { adminApi } from "@/lib/admin";

/**
 * Every marketplace-admin endpoint must be reachable from a page in the console.
 *
 * The twin of `platform-admin-coverage.test.ts`, and it exists because that test only
 * covers the *other* admin surface. `lib/admin.ts` grew a method per procedure on the
 * Worker's `adminRouter`, and nothing forced a screen to call them — so a procedure can be
 * built, audited, documented and completely unreachable from the console, which is the
 * exact shape of the bug `apps/api`'s `AgentEscalation` has had since the day it was
 * written: rows nobody reads.
 *
 * Nothing else catches it. A client method is not a type error when unused, a tRPC
 * procedure is not a route until something calls it, and `api.test.ts` asserts the
 * client's own behaviour rather than what the UI does with it. So this reads the two sides
 * and compares them.
 *
 * ## Why `adminApi` and not the router
 *
 * The methods are enumerated from `Object.keys(adminApi)` — the real exported object — and
 * *not* from the `AppRouter` type. `adminApi` is not one method per procedure: `viewer`,
 * `pendingVerifications` and `pendingCouriers` are derived helpers that fan several
 * procedures into one call, and `products` / `promotions` / `courierInvites` / `reviews`
 * exist as procedures with no `adminApi` method yet. Checking `adminApi` asks the question
 * the console actually cares about — *is this client capability used by any page* — and it
 * stays a test that reads two files rather than three.
 *
 * Mirroring the platform test deliberately, including its `Object.keys` discipline: a
 * method list parsed out of `admin.ts` with a regex would be another thing to keep in sync
 * and would go stale the moment that file was reformatted.
 */

const ADMIN_DIR = join(import.meta.dirname, "..", "pages", "admin");

/**
 * Client capabilities with no page yet, each with why.
 *
 * Empty on purpose. The platform test's allowlist carries two entries for a settings page
 * nobody has built; this one does not, and adding to it should mean the same argument the
 * platform test makes — a named exception with a reason attached, visible in review.
 */
const PENDING: Record<string, string> = {};

const adminSources = readdirSync(ADMIN_DIR)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => readFileSync(join(ADMIN_DIR, file), "utf-8"))
  .join("\n");

/**
 * Whether any admin page calls `method` — as a whole identifier, not as a substring.
 *
 * `\b` on both sides, because the substring version is wrong in a way that only shows up
 * when it is unlucky: `viewer` appears inside `pendingVerifications` only by accident, but
 * a method named `products` *is* a substring of `adminProducts` the day somebody adds one,
 * and the test would report the orphan as wired.
 */
function isWired(method: string): boolean {
  return new RegExp(`\\b${method}\\b`).test(adminSources);
}

const adminMethods = Object.keys(adminApi).sort();

describe("marketplace-admin API coverage", () => {
  it("finds the admin methods to check", () => {
    // If `adminApi` were ever emptied or renamed, an empty list would make every other
    // test here vacuously true — the failure mode of a check that compares two sets.
    expect(adminMethods.length).toBeGreaterThan(15);
  });

  it("has no unwired admin capability outside the allowlist", () => {
    const unwired = adminMethods.filter((method) => !isWired(method));

    expect(unwired.filter((method) => !(method in PENDING))).toEqual([]);
  });

  it("has no allowlist entry that is now wired", () => {
    // The other direction: a `PENDING` entry for something that has since been wired is a
    // stale to-do item, and would otherwise sit there looking deliberate.
    const stale = Object.keys(PENDING).filter((method) => isWired(method));

    expect(stale).toEqual([]);
  });

  it("keeps every allowlist entry a real admin method", () => {
    // A typo in an allowlist key would silently permit a real orphan.
    const unknown = Object.keys(PENDING).filter((method) => !adminMethods.includes(method));

    expect(unknown).toEqual([]);
  });
});
