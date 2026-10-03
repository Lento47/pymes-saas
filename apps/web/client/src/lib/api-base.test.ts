import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What happens to a `/api/*` call when no SaaS host is configured.
 *
 * This is the whole point of the guard in `lib/api.ts`, and the reason it is at request
 * time rather than module load: `App.tsx` imports `api.ts` and `main.tsx` imports
 * `App.tsx`, so a throw on load would white-screen the app — including the marketplace
 * console, which talks to the Worker and works perfectly well without this variable.
 *
 * Before the guard, an unset base fell back to `""`, which is a *valid* same-origin base.
 * Every call then went to the page's own origin, got a 404 without
 * `Access-Control-Allow-Origin`, and the browser reported a CORS policy failure — an error
 * naming a protocol when the cause was a variable nobody had set. That is the failure this
 * file exists to pin shut.
 *
 * `test-setup.ts` supplies a dummy host precisely so the guard does not fire in the rest of
 * the suite; these tests remove it again, which is why they reset the module registry.
 */

const HOST = "https://saas-api.test";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Import `api.ts` with the given env, returning the module and what its base resolved to. */
async function loadWith(env: { VITE_API_URL?: string; VITE_PYMESHUB_API_URL?: string }) {
  const saved = { ...import.meta.env };
  for (const key of ["VITE_API_URL", "VITE_PYMESHUB_API_URL"] as const) {
    delete (import.meta.env as Record<string, string | undefined>)[key];
  }
  Object.assign(import.meta.env, env);

  try {
    const mod = await import("./api");
    return { mod, configured: mod.isApiBaseConfigured };
  } finally {
    Object.assign(import.meta.env, saved);
  }
}

describe("api base configuration", () => {
  it("reports a configured base", async () => {
    const { configured } = await loadWith({ VITE_API_URL: HOST });
    expect(configured).toBe(true);
  });

  it("treats an empty value as unconfigured, not as a host", async () => {
    // The state `apps/web/.env.production` is actually in: `VITE_API_URL=` present but
    // blank. `??` does not fall through on `""`, so an empty string *is* what the client
    // sees here — and if it counted as configured, every request would go to the page's
    // origin and the CORS misdiagnosis would be back.
    const { configured } = await loadWith({ VITE_API_URL: "" });
    expect(configured).toBe(false);
  });

  it("treats no value at all as unconfigured", async () => {
    const { configured } = await loadWith({});
    expect(configured).toBe(false);
  });

  it("refuses a request rather than sending it to the page origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { mod } = await loadWith({});

    try {
      await expect(
        mod.api.platformSearchUsers("someone@example.com"),
      ).rejects.toThrow(/VITE_API_URL/);

      // The assertion that matters: nothing was fetched. Before the guard this was a real
      // `fetch` against `pymeshub.lat` that failed as a CORS error.
      expect(fetchMock).not.toHaveBeenCalled();

      // And it says so in the console, which is where somebody debugging a CORS error will
      // look first and where this one went unread for so long.
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("No SaaS API base configured"),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("still fetches when a host IS configured", async () => {
    // `request` reads `res.headers.get(...)` for the request id before it looks at the
    // status, so the mock needs a headers object — its absence is a defect in the mock,
    // not in the client.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { mod } = await loadWith({ VITE_API_URL: HOST });

    await mod.api.platformSearchUsers("someone@example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${HOST}/api/platform/users`),
      expect.anything(),
    );
  });
});
