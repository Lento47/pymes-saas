import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportClientError } from "@/lib/error-reporting";

describe("error-reporting", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("posts client reports with auth and workspace headers", async () => {
    localStorage.setItem("pymes_token", "token-1");
    localStorage.setItem("pymes_slug", "acme");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await reportClientError({
      source: "FRONTEND",
      category: "API_RESPONSE",
      message: "boom",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      /**
       * Absolute, against the configured host — and it used to be asserted as the relative
       * `"/api/error-reports/client"`.
       *
       * That assertion passed only because the base was empty, which is the whole bug: with
       * no `VITE_API_URL` set, this reporter posted to the page's own origin, where `/api/*`
       * does not exist. So the test was pinning the failure in place — it would have caught
       * a *change* in the URL and said nothing about whether the URL was reachable.
       */
      "https://saas-api.test/api/error-reports/client",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
          "x-workspace-slug": "acme",
        },
      }),
    );
  });

  it("says so, rather than posting nowhere, when no API host is configured", async () => {
    // The production failure, stated as a test: the reporter was installed, working, and
    // sending every bug report to a host with no `/api/*` on it. Silence is the wrong
    // behaviour for the one call whose whole job is to tell you something is broken.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { VITE_API_URL } = import.meta.env;
    delete import.meta.env.VITE_API_URL;

    try {
      vi.resetModules();
      const { reportClientError } = await import("./error-reporting");
      await reportClientError({ category: "API_RESPONSE", message: "boom" });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("VITE_API_URL is unset"),
      );
    } finally {
      import.meta.env.VITE_API_URL = VITE_API_URL;
      consoleError.mockRestore();
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
