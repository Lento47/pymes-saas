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
      "/api/error-reports/client",
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
});
