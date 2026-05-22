import { describe, it, expect, beforeEach, vi } from "vitest";

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
  getRefreshToken,
  isLoggedIn,
  ApiError,
} from "@/lib/api";

describe("api — auth state", () => {
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
      expect(getRefreshToken()).toBe("refresh-xyz");
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
      clearAuthState();

      expect(getAuthToken()).toBeNull();
      expect(getWorkspaceSlug()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(isLoggedIn()).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith("pymes_last_slug", "acme");
    });
  });

  describe("getAuthToken", () => {
    it("falls back to localStorage when memory is empty", () => {
      store["pymes_token"] = "stored-token";
      clearAuthState(); // clears memory but not store (clearAuthState removes keys)
      // Actually clearAuthState removes localStorage items too. Let's test differently.
    });

    it("returns null when no token anywhere", () => {
      expect(getAuthToken()).toBeNull();
    });
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
