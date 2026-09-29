import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { api } from "@/lib/api";

/**
 * Every platform-admin endpoint must be reachable from a page in the console.
 *
 * `lib/api.ts` grew a `platform*` method for each of the 30 routes on
 * `PlatformController`, and nothing forced a screen to call them. Fourteen of them sat
 * unwired for the console's whole life: the entire user lifecycle, all four workspace
 * member operations, both workspace billing calls, and the platform profile write. The
 * backend was finished the whole time; the operator simply had no way to reach it.
 *
 * Nothing else catches that. A client method is not a type error when unused, a route is
 * not a route until something links it, and `api.test.ts` asserts the client's own
 * behaviour rather than what the UI does with it. So this reads the two sides and
 * compares them.
 *
 * ## Why the method list is imported, not parsed
 *
 * The list of `platform*` methods comes from `Object.keys(api)` — the real exported
 * object. Only the *usage* check reads files, because the only way to ask "does any page
 * call this" is to look for the name. A method list parsed out of `api.ts` with a regex
 * would be a fourth thing to keep in sync, and it would quietly go stale the moment the
 * client file was reformatted.
 *
 * ## The allowlist is a to-do list, not an escape hatch
 *
 * `PENDING` names the endpoints that are known-unwired, each with the phase that owns
 * it. Two rules stop it rotting:
 * 1. an entry that *is* wired fails the test, so the list cannot outlive its purpose;
 * 2. adding to it is a deliberate act with a reason attached, visible in review.
 *
 * An allowlist is still better than a red test, because a red test gets disabled and a
 * named exception gets discussed.
 */

const ADMIN_DIR = join(import.meta.dirname, "..", "pages", "admin");

/**
 * Platform-admin endpoints with no page yet.
 *
 * `platformGetAiConfig` / `platformUpdateAiConfig` read and write the
 * `PlatformSettings` singleton (`GET`/`PATCH /platform/ai-config`). That surface is the
 * platform **Settings** page, which is Phase 4 — it belongs with maintenance mode and
 * support email, neither of which has a backing capability yet, so building the AI
 * config editor now would put a settings page on screen with one section of three.
 */
const PENDING: Record<string, string> = {
  platformGetAiConfig: "phase 4 — platform settings",
  platformUpdateAiConfig: "phase 4 — platform settings",
};

const adminSources = readdirSync(ADMIN_DIR)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => readFileSync(join(ADMIN_DIR, file), "utf-8"))
  .join("\n");

/**
 * Whether `adminSources` calls `method` — as a whole identifier, not as a substring.
 *
 * The substring version of this check (`adminSources.includes(method)`) is wrong, and was
 * caught by trying to make it fail: renaming a call to `platformDeleteUserTEMP` still
 * *contains* `platformDeleteUser`, so the test reported the endpoint as wired when it was
 * not. `\b` on both sides makes `platformDeleteUser` not match inside
 * `platformDeleteUserTEMP`, and equally not match inside `myplatformDeleteUser`.
 *
 * No `platform*` method is currently a substring of another, so the loose version would
 * have passed by luck — which is worse than failing, because it looks like coverage.
 */
function isWired(method: string): boolean {
  return new RegExp(`\\b${method}\\b`).test(adminSources);
}

const platformMethods = Object.keys(api)
  .filter((key) => key.startsWith("platform"))
  .sort();

describe("platform-admin API coverage", () => {
  it("finds the platform methods to check", () => {
    // If the prefix ever changes, an empty list would make every other test here
    // vacuously true — which is the failure mode of a check that compares two sets.
    expect(platformMethods.length).toBeGreaterThan(20);
  });

  it("has no unwired platform endpoint outside the allowlist", () => {
    const unwired = platformMethods.filter((method) => !isWired(method));

    expect(unwired.filter((method) => !(method in PENDING))).toEqual([]);
  });

  it("has no allowlist entry that is now wired", () => {
    // The other direction: a `PENDING` entry for something that has since been wired is
    // a stale to-do item, and would otherwise sit there looking deliberate.
    const stale = Object.keys(PENDING).filter((method) => isWired(method));

    expect(stale).toEqual([]);
  });

  it("keeps every allowlist entry a real platform method", () => {
    // A typo in an allowlist key would silently permit a real orphan.
    const unknown = Object.keys(PENDING).filter((method) => !platformMethods.includes(method));

    expect(unknown).toEqual([]);
  });
});
