import { useState, useCallback, useEffect } from "react";
import { api, setAuthState, clearAuthState, isLoggedIn, getWorkspaceSlug, restoreSession } from "@/lib/api";
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

let _user: AuthUser | null = null;
let _listeners: Array<() => void> = [];
let _hydratePromise: Promise<AuthUser | null> | null = null;
let _initialized = false;
let _restoringPromise: Promise<boolean> | null = null;

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

async function maybeRestoreSession(): Promise<boolean> {
  if (_initialized) return isLoggedIn();
  if (_restoringPromise) return _restoringPromise;

  _restoringPromise = (async () => {
    if (!isLoggedIn()) {
      const restored = await restoreSession();
      if (restored) {
        connectSocket();
        attachWorkspaceUpdateListener();
      }
    }
    _initialized = true;
    notifyListeners();
    return isLoggedIn();
  })();

  return _restoringPromise;
}

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
    void maybeRestoreSession().then(() => {
      if (isLoggedIn() && !_user) {
        void hydrateUser();
      }
    });
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
    disconnectSocket();
    _wsUpdatedAttached = false;
    clearAuthState();
    _user = null;
    _initialized = false;
    notifyListeners();
    window.location.hash = "#/login";
  };

  const switchWorkspace = async (workspaceSlug: string) => {
    const res = await api.switchWorkspace(workspaceSlug);
    setAuthState(res.access_token, workspaceSlug, res.refresh_token);
    _user = { ..._user!, role: res.role, workspace: res.workspace };
    notifyListeners();
    window.location.hash = "#/";
    window.location.reload();
  };

  return {
    user: _user,
    isAuthenticated: isLoggedIn(),
    initialized: _initialized,
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
  _initialized = true;
  connectSocket();
  attachWorkspaceUpdateListener();
  notifyListeners();
}
