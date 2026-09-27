import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// We must import after the mock is set up
import {
  setAuthState,
  clearAuthState,
  getAuthToken,
  getWorkspaceSlug,
  api,
  isLoggedIn,
  ApiError,
} from "@/lib/api";

describe("api — auth state", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.clearAllMocks();
    clearAuthState(); // also reset in-memory state
  });

  describe("setAuthState", () => {
    it("stores token and slug in memory and localStorage", () => {
      setAuthState("token-abc", "acme", "refresh-xyz");

      expect(getAuthToken()).toBe("token-abc");
      expect(getWorkspaceSlug()).toBe("acme");
      expect(store["pymes_refresh"]).toBeUndefined();
      expect(Object.values(store)).not.toContain("refresh-xyz");
      expect(localStorageMock.setItem).toHaveBeenCalledWith("pymes_token", "token-abc");
      expect(localStorageMock.setItem).toHaveBeenCalledWith("pymes_slug", "acme");
    });

    it("isLoggedIn returns true after setAuthState", () => {
      expect(isLoggedIn()).toBe(false);
      setAuthState("token", "slug");
      expect(isLoggedIn()).toBe(true);
    });
  });

  describe("clearAuthState", () => {
    it("clears all auth data and saves last slug", () => {
      setAuthState("token", "acme", "refresh");
      store["pymes_refresh"] = "legacy-refresh";
      clearAuthState();

      expect(getAuthToken()).toBeNull();
      expect(getWorkspaceSlug()).toBeNull();
      expect(store["pymes_refresh"]).toBeUndefined();
      expect(isLoggedIn()).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith("pymes_last_slug", "acme");
    });
  });

  describe("getAuthToken", () => {
    it("falls back to localStorage when memory is empty", () => {
      store["pymes_token"] = "stored-token";
      expect(getAuthToken()).toBe("stored-token");
    });

    it("returns null when no token anywhere", () => {
      expect(getAuthToken()).toBeNull();
    });
  });

  it("fetches a photo with the restored token and workspace before auth hydration", async () => {
    store["pymes_token"] = "stored-token";
    store["pymes_slug"] = "stored-workspace";
    const image = new Blob(["photo"], { type: "image/webp" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => image });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.getUserAvatar("user-id")).resolves.toBe(image);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/users/user-id/avatar"), expect.objectContaining({
      credentials: "include",
      headers: { Authorization: "Bearer stored-token", "x-workspace-slug": "stored-workspace" },
    }));
  });

  it("preserves API errors instead of rendering an error body as a photo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 404, headers: new Headers(),
      text: async () => JSON.stringify({ message: "Avatar no encontrado." }),
    }));
    await expect(api.getUserAvatar("user-id")).rejects.toMatchObject({ status: 404, message: "Avatar no encontrado." });
  });
});

describe("ApiError", () => {
  it("formats message with case_id suffix", () => {
    const err = new ApiError("Not found", { status: 404, case_id: "cs_live_abc123456789" });
    expect(err.message).toContain("Not found");
    expect(err.message).toContain("#456789");
    expect(err.status).toBe(404);
  });

  it("formats message without suffix when no case_id", () => {
    const err = new ApiError("Bad request", { status: 400 });
    expect(err.message).toBe("Bad request");
    expect(err.status).toBe(400);
  });
});
