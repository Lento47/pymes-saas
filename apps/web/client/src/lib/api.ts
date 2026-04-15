const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const LS_TOKEN_KEY = "pymes_token";
const LS_SLUG_KEY = "pymes_slug";
const LS_EXPIRY_KEY = "pymes_token_expiry";

// ── In-memory state (hydrated from localStorage on load) ─────────────────────
let _token: string | null = null;
let _workspaceSlug: string | null = null;

function _loadFromStorage() {
  try {
    const expiry = localStorage.getItem(LS_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      // Session expired client-side
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem(LS_SLUG_KEY);
      localStorage.removeItem(LS_EXPIRY_KEY);
      return;
    }
    _token = localStorage.getItem(LS_TOKEN_KEY);
    _workspaceSlug = localStorage.getItem(LS_SLUG_KEY);
  } catch { /* localStorage may be unavailable in some environments */ }
}

// Hydrate on module load
_loadFromStorage();

export function setAuthState(token: string, slug: string, ttlDays = 7) {
  _token = token;
  _workspaceSlug = slug;
  try {
    const expiryMs = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.setItem(LS_SLUG_KEY, slug);
    localStorage.setItem(LS_EXPIRY_KEY, String(expiryMs));
  } catch { /* ignore */ }
}

export function clearAuthState() {
  _token = null;
  _workspaceSlug = null;
  try {
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_SLUG_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
  } catch { /* ignore */ }
}

export function getAuthToken() { return _token; }
export function getWorkspaceSlug() { return _workspaceSlug; }
export function isLoggedIn() { return !!_token; }

/**
 * Extracts a human-readable message from API errors.
 * If the error is a 403 plan-limit rejection, it returns the server message
 * so we can show an upgrade prompt instead of a generic toast.
 */
export function parsePlanError(err: any): { isPlanLimit: boolean; message: string } {
  const raw: string = err?.message ?? "";
  const isPlanLimit = raw.startsWith("403:");
  const message = isPlanLimit ? raw.replace(/^403:\s*/, "").replace(/^\d+\s*/, "").trim() : raw;
  return { isPlanLimit, message };
}



async function request<T>(
  method: string,
  path: string,
  data?: unknown,
  options?: { isFormData?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {};
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  if (_workspaceSlug) headers["x-workspace-slug"] = _workspaceSlug;
  if (!options?.isFormData && data) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options?.isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 401 && !path.includes("/auth/login")) {
      clearAuthState();
      window.location.hash = "#/login";
    }
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
    return r.json() as Promise<{ access_token: string; user: any }>;
  },
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
};

