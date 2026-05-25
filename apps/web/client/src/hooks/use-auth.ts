import { useState, useCallback, useEffect } from "react";
import { api, setAuthState, clearAuthState, isLoggedIn, getWorkspaceSlug, getRefreshToken, isSessionTimedOut } from "@/lib/api";

function resetAuthAndTheme() {
  history.pushState(null, "", "/login?expired=true");
  window.dispatchEvent(new PopStateEvent("popstate"));
  clearAuthState();
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('light');
    try { localStorage.removeItem('PymesHub-theme'); } catch { /* ignore */ }
  }
}
import { connectSocket, disconnectSocket, getSocket } from "./use-socket";
import { queryClient } from "@/lib/queryClient";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
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
    logo_url?: string;
  };
}

// Estado global en módulo (compartido entre llamadas a useAuth)
let _user: AuthUser | null = null;
let _listeners: Array<() => void> = [];
let _hydratePromise: Promise<AuthUser | null> | null = null;
let _isRestoring = false;
let _restorePromise: Promise<void> | null = null;
let _logoutInProgress = false;
let _inactivityInterval: ReturnType<typeof setInterval> | null = null;

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

// Mantener el usuario en memoria sincronizado cuando otros miembros del workspace
// cambian algo (p. ej. el nombre del workspace). El servidor emite 'workspace:updated'
// al room `workspace:<id>`.
type WorkspaceUpdatePayload = {
  id?: string;
  name?: string;
  slug?: string;
  plan?: string;
  timezone?: string;
  locale?: string;
  status?: string;
  logo_url?: string;
};

let _wsUpdatedAttached = false;
function attachWorkspaceUpdateListener() {
  const socket = getSocket();
  if (!socket || _wsUpdatedAttached) return;
  _wsUpdatedAttached = true;
  socket.on("workspace:updated", (workspace: WorkspaceUpdatePayload) => {
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
        logo_url: workspace.logo_url ?? _user.workspace.logo_url,
      },
    };
    notifyListeners();
  });
}

// On page load, if we have a stored refresh token, restore the session silently
const _storedRefreshToken = getRefreshToken();
if (_storedRefreshToken && !isLoggedIn()) {
  // Check inactivity timeout — if user was inactive >10min, don't restore
  if (isSessionTimedOut()) {
    resetAuthAndTheme();
    _isRestoring = false;
  } else {
    _isRestoring = true;
    _restorePromise = (async () => {
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 8000));
        const r = await (Promise.race([api.refresh(_storedRefreshToken), timeout]) as unknown as ReturnType<typeof api.refresh>);
        setAuthState(r.access_token, getWorkspaceSlug()!, r.refresh_token);

        if (r.user) {
          _user = r.user;
          setAuthState(r.access_token, r.user.workspace.slug, r.refresh_token);
        } else {
          const me = await Promise.race([api.getMe(), timeout]) as unknown as AuthUser;
          _user = me;
          setAuthState(r.access_token, me.workspace.slug, r.refresh_token);
        }
        connectSocket();
        attachWorkspaceUpdateListener();
      } catch {
        resetAuthAndTheme();
        _user = null;
      } finally {
        _isRestoring = false;
        notifyListeners();
      }
    })();
  }
} else if (isLoggedIn()) {
  connectSocket();
  attachWorkspaceUpdateListener();
}

function _clearInactivityMonitor() {
  if (_inactivityInterval) {
    clearInterval(_inactivityInterval);
    _inactivityInterval = null;
  }
}

function _ensureInactivityMonitor() {
  if (_inactivityInterval) return;
  _inactivityInterval = setInterval(() => {
    if (isLoggedIn() && isSessionTimedOut()) {
      disconnectSocket();
      _wsUpdatedAttached = false;
      resetAuthAndTheme();
      _user = null;
      notifyListeners();
      _clearInactivityMonitor();
    }
  }, 30000);
}

async function hydrateUser() {
  if (!isLoggedIn()) return null;
  if (_hydratePromise) return _hydratePromise;

  _hydratePromise = (async () => {
    try {
      const me = await api.getMe() as AuthUser;
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

  // Auto-logout after 10 minutes of inactivity (module-level singleton interval)
  useEffect(() => {
    if (isLoggedIn()) {
      _ensureInactivityMonitor();
    }
    return () => { /* keep interval alive — shared across all components */ };
  }, []);

  const login = async (email: string, password: string, workspaceSlug?: string) => {
    const res = await api.login(email, password, workspaceSlug || "");
    applyAuthResult(res as unknown as { access_token: string; refresh_token?: string; user: AuthUser });
    return res;
  };

  const register = async (data: { name: string; email: string; password: string; terms_accepted: boolean; invite_token?: string }) => {
    const res = await api.register(data);
    applyAuthResult(res as unknown as { access_token: string; refresh_token?: string; user: AuthUser });
    return res;
  };

  const acceptInvite = async (token: string, name?: string, password?: string) => {
    const res = await api.acceptInvite({ token, name, password });
    applyAuthResult(res as unknown as { access_token: string; refresh_token?: string; user: AuthUser });
    return res;
  };

  // Redeems a short-lived SSO exchange code (from a SAML or Google
  // OAuth callback) for real access + refresh tokens. The login page
  // calls this on mount when it detects ?code=... in the URL.
  const loginWithSsoCode = async (code: string) => {
    const res = await api.ssoExchange(code);
    applyAuthResult(res as unknown as { access_token: string; refresh_token?: string; user: AuthUser });
    return res;
  };

  const logout = async () => {
    if (_logoutInProgress) return;
    _logoutInProgress = true;
    try {
      await api.logout();
    } catch { /* best-effort */ }
    _clearInactivityMonitor();
    disconnectSocket();
    _wsUpdatedAttached = false;
    queryClient.clear();
    resetAuthAndTheme();
    _user = null;
    notifyListeners();
    history.pushState(null, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
    _logoutInProgress = false;
  };

  const switchWorkspace = async (workspaceSlug: string) => {
    const res = await api.switchWorkspace(workspaceSlug);
    setAuthState(res.access_token, workspaceSlug, res.refresh_token);
    _user = { ..._user!, role: res.role, workspace: res.workspace };
    notifyListeners();
    // Reload to re-fetch all queries with new workspace context
    history.replaceState(null, "", "/");
    window.location.reload();
  };

  const initialized = !_isRestoring && (!isLoggedIn() || !!_user);

  return {
    user: _user,
    isAuthenticated: isLoggedIn(),
    isRestoring: _isRestoring,
    initialized,
    workspaceSlug: getWorkspaceSlug(),
    login,
    register,
    acceptInvite,
    loginWithSsoCode,
    logout,
    switchWorkspace,
    refreshUser: hydrateUser,
  };
}

export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    history.replaceState(null, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
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
  queryClient.clear();
  setAuthState(res.access_token, res.user.workspace.slug, res.refresh_token);
  _user = res.user;
  connectSocket();
  attachWorkspaceUpdateListener();
  notifyListeners();
}
