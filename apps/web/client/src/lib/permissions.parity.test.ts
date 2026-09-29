import { describe, expect, it } from "vitest";

// The API's map, imported across the package boundary rather than restated. This is the
// whole point of the file: a test that re-declares the expected permissions is a third
// copy to keep in sync, and a third copy drifts the same way the second one did.
import {
  Permission as ApiPermission,
  hasPermission as apiHasPermission,
  ROLE_PERMISSIONS as API_ROLE_PERMISSIONS,
} from "../../../../api/src/common/permissions/permissions";

import { Permission, hasPermission } from "@/lib/permissions";

/**
 * The web permission map must be identical to the API's.
 *
 * `client/src/lib/permissions.ts` is a hand-maintained copy of
 * `apps/api/src/common/permissions/permissions.ts`. There is no generated step, no shared
 * package, and no type that ties them together, so the only thing keeping them honest is
 * this test.
 *
 * ## Why it compares behaviour and not structure
 *
 * The obvious test is "the two `Permission` objects have the same keys", plus a
 * hand-written expected array per role. Both are the same mistake in different clothes:
 * they restate the answer, so they have to be updated whenever the answer changes, and
 * the moment someone adds a permission and updates the map but not the test, the test is
 * either a lie (restated exactly, passing) or noise (failing for the wrong reason).
 *
 * This asks the only question a consumer ever asks — *is this role allowed to do this?* —
 * and compares the two `hasPermission` implementations directly, for every role against
 * every permission. Two files can disagree structurally and still be correct; they can
 * agree structurally and still be wrong; only the answers are load-bearing.
 *
 * The role lists are compared as **sorted sets**, so a reordering in either file is not a
 * failure — it cannot be, since `hasPermission` does not care about order — while an
 * addition or a removal on either side is.
 */

const WEB_ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "BILLING", "VIEWER"] as const;

describe("permission map parity with the API", () => {
  it("declares exactly the same permissions as the API", () => {
    const web = new Set<string>(Object.values(Permission));
    const api = new Set<string>(Object.values(ApiPermission));

    // Both directions: a permission only on the API can never be granted to any role
    // here, so the capability is unreachable in the UI. A permission only here is
    // harmless (it over-hides) but means the two files have parted ways.
    expect({
      missingHere: [...api].filter((p) => !web.has(p)),
      extraHere: [...web].filter((p) => !api.has(p)),
    }).toEqual({ missingHere: [], extraHere: [] });
  });

  it("covers exactly the same roles as the API", () => {
    expect(new Set(Object.keys(API_ROLE_PERMISSIONS)).size).toBe(WEB_ROLES.length);

    for (const role of WEB_ROLES) {
      // Both must know the role, and neither may know one the other does not.
      expect(API_ROLE_PERMISSIONS[role]).toBeDefined();
      expect(hasPermission(role, "workspace.read")).toBe(
        apiHasPermission(role, "workspace.read"),
      );
    }
  });

  it.each(WEB_ROLES)("%s answers identically to the API for every permission", (role) => {
    const disagreeing: string[] = [];

    for (const permission of Object.values(ApiPermission)) {
      const here = hasPermission(role, permission);
      const there = apiHasPermission(role, permission);
      if (here !== there) {
        disagreeing.push(`${permission}: web=${here} api=${there}`);
      }
    }

    expect(disagreeing).toEqual([]);
  });

  it("agrees on the platform-admin bypass", () => {
    for (const role of WEB_ROLES) {
      for (const permission of Object.values(ApiPermission)) {
        expect(hasPermission(role, permission, true)).toBe(
          apiHasPermission(role, permission, true),
        );
      }
    }
  });

  it("grants an unknown role nothing on either side", () => {
    for (const permission of Object.values(ApiPermission)) {
      expect(hasPermission("NOT_A_ROLE", permission)).toBe(false);
      expect(apiHasPermission("NOT_A_ROLE", permission)).toBe(false);
    }
  });
});

describe("the call permission", () => {
  /**
   * The specific regression this file was written for.
   *
   * `calls.initiate` was absent from the web constant, therefore from all six role
   * lists, therefore ungranted to everybody — including `OWNER`, whose list is derived
   * from the constant and so silently lost it too. Because `OWNER` is computed, the bug
   * was invisible at the point of derivation: the filter looked correct and produced a
   * list that was quietly short one entry.
   *
   * Named explicitly so a future regression reports as a sentence about calls rather
   * than as a set-difference dump.
   */
  it("is reachable by the roles the API grants it to", () => {
    const rolesWithIt = WEB_ROLES.filter((role) => hasPermission(role, "calls.initiate"));

    expect(rolesWithIt.sort()).toEqual(
      WEB_ROLES.filter((role) => apiHasPermission(role, "calls.initiate")).sort(),
    );
    expect(rolesWithIt).toContain("OWNER");
  });
});
