import { useState, useCallback, useEffect } from "react";
import { api, setAuthState, clearAuthState, isLoggedIn, getWorkspaceSlug } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspace: { id: string; name: string; slug: string; plan: string };
}

// ── Global module-level state (shared across all useAuth calls) ───────────────
let _user: AuthUser | null = null;
let _listeners: Array<() => void> = [];
let _bootstrapped = false;

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

// ── Read the admin-configured session TTL from localStorage ──────────────────
export function getSessionTtlDays(): number {
  try {
    const v = localStorage.getItem("pymes_session_ttl_days");
    return v ? parseInt(v, 10) : 7;
  } catch {
    return 7;
  }
}

export function setSessionTtlDays(days: number) {
  try {
    localStorage.setItem("pymes_session_ttl_days", String(days));
  } catch { /* ignore */ }
}

export function useAuth() {
  const [, forceUpdate] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(!_bootstrapped);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  }, []);

  // On first mount: if we have a token from localStorage but no _user, re-fetch /me
  useEffect(() => {
    if (_bootstrapped) return;
    _bootstrapped = true;

    if (isLoggedIn() && !_user) {
      setIsBootstrapping(true);
      api.getMe()
        .then((me) => {
          _user = me;
          notifyListeners();
        })
        .catch(() => {
          // Token invalid or expired — clear it
          clearAuthState();
          notifyListeners();
        })
        .finally(() => setIsBootstrapping(false));
    } else {
      setIsBootstrapping(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string, workspaceSlug: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password, workspaceSlug);
      const ttl = getSessionTtlDays();
      setAuthState(res.access_token, workspaceSlug, ttl);
      _user = res.user;
      notifyListeners();
      return res;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthState();
    _user = null;
    notifyListeners();
    window.location.hash = "#/login";
  }, []);

  return {
    user: _user,
    isAuthenticated: isLoggedIn(),
    login,
    logout,
    isLoading,
    isBootstrapping,
  };
}

/** Hook that redirects to /login if no valid session is present */
export function useRequireAuth() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  if (!isBootstrapping && !isAuthenticated) {
    window.location.hash = "#/login";
  }
  return { isAuthenticated, isBootstrapping };
}
