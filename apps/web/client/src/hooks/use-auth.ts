import { useState, useCallback, useEffect } from "react";
import { api, setAuthState, clearAuthState, isLoggedIn, getWorkspaceSlug } from "@/lib/api";
import { connectSocket, disconnectSocket, getSocket } from "./use-socket";
import { queryClient } from "@/lib/queryClient";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_platform_admin?: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    timezone?: string;
    locale?: string;
    status?: string;
  };
}

// Estado global en módulo (compartido entre llamadas a useAuth)
// Tokens and user data are stored in memory only (not persisted to localStorage for security)
let _user: AuthUser | null = null;
let _listeners: Array<() => void> = [];
let _hydratePromise: Promise<AuthUser | null> | null = null;

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

// Mantener el usuario en memoria sincronizado cuando otros miembros del workspace
// cambian algo (p. ej. el nombre del workspace). El servidor emite 'workspace:updated'
// al room `workspace:<id>`.
let _wsUpdatedAttached = false;
function attachWorkspaceUpdateListener() {
  const socket = getSocket();
  if (!socket || _wsUpdatedAttached) return;
  _wsUpdatedAttached = true;
  socket.on("workspace:updated", (workspace: any) => {
    queryClient.setQueryData(["/api/workspaces/current"], workspace);
    if (!_user || !workspace?.id || _user.workspace?.id !== workspace.id) return;
    _user = {
      ..._user,
      workspace: {
        ..._user.workspace,
        name: workspace.name ?? _user.workspace.name,
        slug: workspace.slug ?? _user.workspace.slug,
        plan: workspace.plan ?? _user.workspace.plan,
        timezone: workspace.timezone ?? _user.workspace.timezone,
        locale: workspace.locale ?? _user.workspace.locale,
        status: workspace.status ?? _user.workspace.status,
      },
    };
    notifyListeners();
  });
}

// Auto-reconnect WebSocket when the page reloads with an existing session
// (login() only runs on explicit login, not on refresh)
if (isLoggedIn()) {
  connectSocket();
  attachWorkspaceUpdateListener();
}

async function hydrateUser() {
  if (!isLoggedIn()) return null;
  if (_hydratePromise) return _hydratePromise;

  _hydratePromise = (async () => {
    try {
      const me = await api.getMe();
      _user = me;
      notifyListeners();
      return me;
    } catch {
      _user = null;
      notifyListeners();
      return null;
    } finally {
      _hydratePromise = null;
    }
  })();

  return _hydratePromise;
}

export function useAuth() {
  const [, forceUpdate] = useState(0);

  const subscribe = useCallback(() => {
    const fn = () => forceUpdate(n => n + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }, []);

  useEffect(() => subscribe(), [subscribe]);

  useEffect(() => {
    const workspaceSlug = getWorkspaceSlug();
    const hasWorkspaceMismatch =
      !!_user?.workspace?.slug && !!workspaceSlug && _user.workspace.slug !== workspaceSlug;

    if (isLoggedIn() && (!_user || hasWorkspaceMismatch)) {
      void hydrateUser();
    }
  }, []);

  const login = async (email: string, password: string, workspaceSlug: string) => {
    const res = await api.login(email, password, workspaceSlug);
    applyAuthResult(res);
    return res;
  };

  const acceptInvite = async (token: string, name?: string, password?: string) => {
    const res = await api.acceptInvite({ token, name, password });
    applyAuthResult(res);
    return res;
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* best-effort */ }
    disconnectSocket(); // ← WebSocket se corta al hacer logout
    _wsUpdatedAttached = false; // permitir re-attach en el próximo login
    clearAuthState();
    _user = null;
    notifyListeners();
    window.location.hash = "#/login";
  };

  const switchWorkspace = async (workspaceSlug: string) => {
    const res = await api.switchWorkspace(workspaceSlug);
    setAuthState(res.access_token, workspaceSlug, res.refresh_token);
    _user = { ..._user!, role: res.role, workspace: res.workspace };
    notifyListeners();
    // Reload to re-fetch all queries with new workspace context
    window.location.hash = "#/";
    window.location.reload();
  };

  return {
    user: _user,
    isAuthenticated: isLoggedIn(),
    login,
    acceptInvite,
    logout,
    switchWorkspace,
    refreshUser: hydrateUser,
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

function applyAuthResult(res: { access_token: string; refresh_token?: string; user: AuthUser }) {
  setAuthState(res.access_token, res.user.workspace.slug, res.refresh_token);
  _user = res.user;
  connectSocket();
  attachWorkspaceUpdateListener();
  notifyListeners();
}
