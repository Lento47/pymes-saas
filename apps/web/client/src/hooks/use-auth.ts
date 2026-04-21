import { useState, useCallback } from "react";
import { api, setAuthState, clearAuthState, isLoggedIn, getWorkspaceSlug } from "@/lib/api";
import { connectSocket, disconnectSocket } from "./use-socket";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_platform_admin?: boolean;
  workspace: { id: string; name: string; slug: string; plan: string };
}

// Estado global en módulo (compartido entre llamadas a useAuth)
let _user: AuthUser | null = null;
let _listeners: Array<() => void> = [];
const LS_USER_KEY = "pymes_user";

try {
  const storedUser = localStorage.getItem(LS_USER_KEY);
  _user = storedUser ? JSON.parse(storedUser) : null;
} catch {
  _user = null;
}

// Auto-reconnect WebSocket when the page reloads with an existing session
// (login() only runs on explicit login, not on refresh)
if (isLoggedIn()) {
  connectSocket();
}

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

export function useAuth() {
  const [, forceUpdate] = useState(0);

  const subscribe = useCallback(() => {
    const fn = () => forceUpdate(n => n + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }, []);

  void subscribe;

  const login = async (email: string, password: string, workspaceSlug: string) => {
    const res = await api.login(email, password, workspaceSlug);
    setAuthState(res.access_token, workspaceSlug, res.refresh_token);
    _user = res.user;
    try { localStorage.setItem(LS_USER_KEY, JSON.stringify(res.user)); } catch { /* ignore */ }
    connectSocket(); // ← WebSocket conecta al hacer login
    notifyListeners();
    return res;
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* best-effort */ }
    disconnectSocket(); // ← WebSocket se corta al hacer logout
    clearAuthState();
    _user = null;
    try { localStorage.removeItem(LS_USER_KEY); } catch { /* ignore */ }
    notifyListeners();
    window.location.hash = "#/login";
  };

  const switchWorkspace = async (workspaceSlug: string) => {
    const res = await api.switchWorkspace(workspaceSlug);
    setAuthState(res.access_token, workspaceSlug, res.refresh_token);
    _user = { ..._user!, role: res.role, workspace: res.workspace };
    try { localStorage.setItem(LS_USER_KEY, JSON.stringify(_user)); } catch { /* ignore */ }
    notifyListeners();
    // Reload to re-fetch all queries with new workspace context
    window.location.hash = "#/";
    window.location.reload();
  };

  return {
    user: _user,
    isAuthenticated: isLoggedIn(),
    login,
    logout,
    switchWorkspace,
  };
}

export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    window.location.hash = "#/login";
  }
  return { isAuthenticated };
}

// ── Session TTL (días que dura la sesión) ──────────────────────────────────
let _sessionTtlDays = 7;

export function getSessionTtlDays(): number {
  return _sessionTtlDays;
}

export function setSessionTtlDays(days: number): void {
  _sessionTtlDays = days;
}
