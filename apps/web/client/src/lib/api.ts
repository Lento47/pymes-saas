const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const LS_TOKEN_KEY = "pymes_token";
const LS_SLUG_KEY = "pymes_slug";
const LS_EXPIRY_KEY = "pymes_token_expiry";
const LS_REFRESH_KEY = "pymes_refresh_token";

// ── In-memory state (hydrated from localStorage on load) ─────────────────────
let _token: string | null = null;
let _workspaceSlug: string | null = null;

function _loadFromStorage() {
  try {
    _token = localStorage.getItem(LS_TOKEN_KEY);
    _workspaceSlug = localStorage.getItem(LS_SLUG_KEY);
  } catch { /* localStorage may be unavailable in some environments */ }
}

// Hydrate on module load
_loadFromStorage();

export function setAuthState(token: string, slug: string, refreshToken?: string) {
  _token = token;
  _workspaceSlug = slug;
  try {
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.setItem(LS_SLUG_KEY, slug);
    if (refreshToken) localStorage.setItem(LS_REFRESH_KEY, refreshToken);
  } catch { /* ignore */ }
}

export function clearAuthState() {
  _token = null;
  _workspaceSlug = null;
  try {
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_SLUG_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
    localStorage.removeItem(LS_REFRESH_KEY);
  } catch { /* ignore */ }
}

export function getAuthToken() { return _token; }
export function getWorkspaceSlug() { return _workspaceSlug; }
export function isLoggedIn() { return !!_token; }

/**
 * Extracts a human-readable message from API errors.
 */
export function parsePlanError(err: any): { isPlanLimit: boolean; message: string } {
  const raw: string = err?.message ?? "";
  const isPlanLimit = raw.startsWith("403:");
  const message = isPlanLimit ? raw.replace(/^403:\s*/, "").replace(/^\d+\s*/, "").trim() : raw;
  return { isPlanLimit, message };
}

// Prevent concurrent refresh attempts
let _refreshPromise: Promise<boolean> | null = null;

async function _tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const stored = localStorage.getItem(LS_REFRESH_KEY);
      if (!stored) return false;

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: stored }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      _token = data.access_token;
      try {
        localStorage.setItem(LS_TOKEN_KEY, data.access_token);
        if (data.refresh_token) localStorage.setItem(LS_REFRESH_KEY, data.refresh_token);
      } catch { }
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  data?: unknown,
  options?: { isFormData?: boolean }
): Promise<T> {
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {};
    if (_token) h["Authorization"] = `Bearer ${_token}`;
    if (_workspaceSlug) h["x-workspace-slug"] = _workspaceSlug;
    if (!options?.isFormData && data) h["Content-Type"] = "application/json";
    return h;
  };

  const body = options?.isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined;

  let res = await fetch(`${API_BASE}${path}`, { method, headers: buildHeaders(), body });

  // On 401, attempt token refresh and retry once
  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    const refreshed = await _tryRefresh();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, { method, headers: buildHeaders(), body });
    }
    if (!refreshed || res.status === 401) {
      clearAuthState();
      window.location.hash = "#/login";
      throw new Error("401: Sesión expirada.");
    }
  }

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return {} as T;
}

export const api = {
  login: async (email: string, password: string, workspaceSlug: string) => {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": workspaceSlug },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    return r.json() as Promise<{ access_token: string; refresh_token: string; user: any }>;
  },
  logout: () => request<any>("POST", "/api/auth/logout"),
  getMe: () => request<any>("GET", "/api/auth/me"),
  generateSummary: () => request<any>("POST", "/api/summaries/generate"),
  getDailySummaries: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/summaries/daily${qs}`);
  },
  getConversations: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/conversations${qs}`);
  },
  getConversation: (id: string) => request<any>("GET", `/api/conversations/${id}`),
  createConversation: (data: any) => request<any>("POST", "/api/conversations", data),
  updateConversation: (id: string, data: any) => request<any>("PATCH", `/api/conversations/${id}`, data),
  assignConversation: (id: string, userId: string) => request<any>("POST", `/api/conversations/${id}/assign`, { user_id: userId }),
  resolveConversation: (id: string) => request<any>("POST", `/api/conversations/${id}/resolve`),
  deleteConversation: (id: string) => request<any>("DELETE", `/api/conversations/${id}`),
  getMessages: (conversationId: string) => request<any>("GET", `/api/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, data: any) => request<any>("POST", `/api/conversations/${conversationId}/messages`, data),
  getContacts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/contacts${qs}`);
  },
  getContact: (id: string) => request<any>("GET", `/api/contacts/${id}`),
  createContact: (data: any) => request<any>("POST", "/api/contacts", data),
  updateContact: (id: string, data: any) => request<any>("PATCH", `/api/contacts/${id}`, data),
  deleteContact: (id: string) => request<any>("DELETE", `/api/contacts/${id}`),
  getTasks: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/tasks${qs}`);
  },
  createTask: (data: any) => request<any>("POST", "/api/tasks", data),
  updateTask: (id: string, data: any) => request<any>("PATCH", `/api/tasks/${id}`, data),
  completeTask: (id: string) => request<any>("POST", `/api/tasks/${id}/complete`),
  deleteTask: (id: string) => request<any>("DELETE", `/api/tasks/${id}`),
  getOverdueTasks: () => request<any>("GET", "/api/tasks/overdue"),
  getDocument: (id: string) => request<any>("GET", `/api/documents/${id}`),
  getDocuments: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/documents${qs}`);
  },
  uploadDocument: (formData: FormData) => request<any>("POST", "/api/documents/upload", formData, { isFormData: true }),
  deleteDocument: (id: string) => request<any>("DELETE", `/api/documents/${id}`),
  getAutomations: () => request<any>("GET", "/api/automations"),
  createAutomation: (data: any) => request<any>("POST", "/api/automations", data),
  toggleAutomation: (id: string) => request<any>("POST", `/api/automations/${id}/toggle`),
  updateAutomation: (id: string, data: any) => request<any>("PATCH", `/api/automations/${id}`, data),
  deleteAutomation: (id: string) => request<any>("DELETE", `/api/automations/${id}`),
  getWorkspace: () => request<any>("GET", "/api/workspaces/current"),
  updateWorkspace: (data: any) => request<any>("PATCH", "/api/workspaces/current", data),
  getMembers: () => request<any>("GET", "/api/workspaces/current/members"),
  inviteUser: (data: any) => request<any>("POST", "/api/workspaces/current/members/invite", data),
  changeMemberRole: (userId: string, newRole: string) => request<any>("PATCH", `/api/workspaces/current/members/${userId}/role`, { role: newRole }),
  removeMember: (userId: string) => request<any>("DELETE", `/api/workspaces/current/members/${userId}`),
  updateUser: (userId: string, data: any) => request<any>("PATCH", `/api/users/${userId}`, data),
  getChannels: () => request<any>("GET", "/api/channels"),
  createChannel: (data: any) => request<any>("POST", "/api/channels", data),
  updateChannel: (id: string, data: any) => request<any>("PATCH", `/api/channels/${id}`, data),
  deleteChannel: (id: string) => request<any>("DELETE", `/api/channels/${id}`),
  connectChannel: (id: string) => request<any>("POST", `/api/channels/${id}/connect`),
  disconnectChannel: (id: string) => request<any>("POST", `/api/channels/${id}/disconnect`),
  getNotifications: () => request<any>("GET", "/api/notifications"),
  getUnreadCount: () => request<any>("GET", "/api/notifications/unread-count"),
  markRead: (data: any) => request<any>("POST", "/api/notifications/mark-read", data),
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/audit${qs}`);
  },
  getWorkspaceStats: () => request<any>("GET", "/api/workspaces/current/stats"),
  getTodayStats: () => request<any>("GET", "/api/workspaces/current/stats/today"),
  exportData: (type: string) => request<any>("GET", `/api/workspaces/current/export?type=${type}`),
  search: (q: string, types?: string) => {
    const params = new URLSearchParams({ q });
    if (types) params.set("types", types);
    return request<any>("GET", `/api/search?${params.toString()}`);
  },
  configureEmail: (id: string, data: { api_key: string; from_email: string; from_name: string }) =>
    request<any>('POST', `/api/channels/${id}/configure-email`, data),
  configureWhatsApp: (id: string, data: { access_token: string; phone_number_id: string; waba_id: string }) =>
    request<any>('POST', `/api/channels/${id}/configure-whatsapp`, data),
  // Departments
  getDepartments: () => request<any>("GET", "/api/departments"),
  createDepartment: (data: any) => request<any>("POST", "/api/departments", data),
  updateDepartment: (id: string, data: any) => request<any>("PATCH", `/api/departments/${id}`, data),
  deleteDepartment: (id: string) => request<any>("DELETE", `/api/departments/${id}`),
  getDepartmentMembers: (id: string) => request<any>("GET", `/api/departments/${id}/members`),
  addDepartmentMember: (id: string, data: { user_id: string; is_lead?: boolean }) =>
    request<any>("POST", `/api/departments/${id}/members`, data),
  removeDepartmentMember: (id: string, userId: string) =>
    request<any>("DELETE", `/api/departments/${id}/members/${userId}`),
  getInsights: () => request<any>("GET", "/api/insights"),
};
