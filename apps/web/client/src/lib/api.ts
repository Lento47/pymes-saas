import { reportClientError } from "@/lib/error-reporting";
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ── Auth state — access token in-memory only, slug + refresh token in sessionStorage ──
let _token: string | null = null;
let _workspaceSlug: string | null = sessionStorage.getItem('ws_slug');
let _refreshToken: string | null = sessionStorage.getItem('ws_rt');

export function setAuthState(token: string, slug: string, refreshToken?: string) {
  _token = token;
  _workspaceSlug = slug;
  try { sessionStorage.setItem('ws_slug', slug); } catch { /* ignore */ }
  if (refreshToken) {
    _refreshToken = refreshToken;
    try { sessionStorage.setItem('ws_rt', refreshToken); } catch { /* ignore */ }
  }
}

export function clearAuthState() {
  _token = null;
  _workspaceSlug = null;
  _refreshToken = null;
  try { sessionStorage.removeItem('ws_slug'); sessionStorage.removeItem('ws_rt'); } catch { /* ignore */ }
}

export function getAuthToken() { return _token; }
export function getRefreshToken() { return _refreshToken; }
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
      if (!_refreshToken) return false;

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: _refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      _token = data.access_token;
      if (data.refresh_token) _refreshToken = data.refresh_token;
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

  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers: buildHeaders(), body });
  } catch (error: any) {
    if (!path.includes("/error-reports/client")) {
      void reportClientError({
        source: "FRONTEND",
        category: "API_NETWORK",
        severity: "ERROR",
        title: "Network request failed",
        message: error?.message ?? `Falló la llamada ${method} ${path}`,
        stack: error?.stack,
        method,
        url: `${API_BASE}${path}`,
        context_json: { path },
      });
    }
    throw error;
  }

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
    if (res.status >= 500 && !path.includes("/error-reports/client")) {
      void reportClientError({
        source: "FRONTEND",
        category: "API_RESPONSE",
        severity: "ERROR",
        title: `API ${res.status}`,
        message: text,
        method,
        status_code: res.status,
        url: `${API_BASE}${path}`,
        context_json: { path },
      });
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
  getInvitePreview: (token: string) =>
    request<any>("POST", "/api/auth/invite-preview", { token }),
  acceptInvite: (data: { token: string; name?: string; password?: string }) =>
    request<any>("POST", "/api/auth/accept-invite", data),
  register: (data: { name: string; email: string; password: string }) =>
    request<any>("POST", "/api/auth/register", data),
  login: async (email: string, password: string, workspaceSlug: string) => {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": workspaceSlug },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const text = await r.text();
      if (r.status >= 500) {
        void reportClientError({
          source: "FRONTEND",
          category: "API_RESPONSE",
          severity: "ERROR",
          title: `API ${r.status}`,
          message: text,
          method: "POST",
          status_code: r.status,
          url: `${API_BASE}/api/auth/login`,
          context_json: { workspace_slug: workspaceSlug },
        });
      }
      throw new Error(`${r.status}: ${text}`);
    }
    return r.json() as Promise<{ access_token: string; refresh_token: string; user: any }>;
  },
  refresh: async (token: string): Promise<{ access_token: string; refresh_token: string }> => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) throw new Error("Session expired");
    return res.json();
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
  getInvoices: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/invoices${qs}`);
  },
  getInvoice: (id: string) => request<any>("GET", `/api/invoices/${id}`),
  createInvoice: (data: any) => request<any>("POST", "/api/invoices", data),
  updateInvoice: (id: string, data: any) => request<any>("PATCH", `/api/invoices/${id}`, data),
  deleteInvoice: (id: string) => request<any>("DELETE", `/api/invoices/${id}`),
  markInvoicePaid: (id: string) => request<any>("POST", `/api/invoices/${id}/paid`),
  registerInvoicePayment: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/payments`, data),
  submitInvoiceToHacienda: (id: string) => request<any>("POST", `/api/invoices/${id}/submit`),
  syncInvoiceHaciendaStatus: (id: string) => request<any>("GET", `/api/invoices/${id}/hacienda-status`),
  createCreditNote: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/credit-note`, data),
  createDebitNote: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/debit-note`, data),
  createReceiverMessage: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/receiver-message`, data),
  detectOverdueInvoices: () => request<any>("GET", "/api/invoices/overdue"),
  generateInvoiceReminder: (id: string) => request<any>("POST", `/api/invoices/${id}/reminder`),
  sendInvoiceReminder: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/reminder/send`, data),
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
  getSubscription: () => request<any>("GET", "/api/workspaces/current/subscription"),
  getBillingPortal: () => request<any>("GET", "/api/billing/portal"),
  getBillingInvoices: () => request<any>("GET", "/api/billing/invoices"),
  getBillingInvoicePdf: (id: string) => request<any>("GET", `/api/billing/invoices/${id}/pdf`),
  syncSubscription: () => request<any>("POST", "/api/billing/sync"),
  updateWorkspace: (data: any) => request<any>("PATCH", "/api/workspaces/current", data),
  testAiConnection: (data: any) => request<any>("POST", "/api/workspaces/current/ai/test", data),
  getApiKeys: () => request<any>("GET", "/api/workspaces/current/api-keys"),
  updateApiKeys: (data: any) => request<any>("PATCH", "/api/workspaces/current", data),
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
  configureEmail: (id: string, data: { api_key?: string; from_email: string; inbound_email?: string; from_name: string }) =>
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
  askAssistant: (question: string) => request<any>("POST", "/api/ai/assistant", { question }),
  validateTaxpayer: (identificacion: string) =>
    request<any>("POST", "/api/hacienda/validate-taxpayer", { identificacion }),
  searchCabys: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/hacienda/cabys${qs}`);
  },
  getExoneration: (authorization: string) => request<any>("GET", `/api/hacienda/exonerations/${authorization}`),
  getExchangeRate: () => request<any>("GET", "/api/hacienda/exchange-rate"),
  // Pipeline
  getPipelineStages: () => request<any>("GET", "/api/pipeline/stages"),
  createPipelineStage: (data: any) => request<any>("POST", "/api/pipeline/stages", data),
  updatePipelineStage: (id: string, data: any) => request<any>("PATCH", `/api/pipeline/stages/${id}`, data),
  deletePipelineStage: (id: string) => request<any>("DELETE", `/api/pipeline/stages/${id}`),
  createDeal: (data: any) => request<any>("POST", "/api/pipeline/deals", data),
  updateDeal: (id: string, data: any) => request<any>("PATCH", `/api/pipeline/deals/${id}`, data),
  moveDeal: (id: string, stageId: string) => request<any>("PATCH", `/api/pipeline/deals/${id}/move`, { stage_id: stageId }),
  winDeal: (id: string) => request<any>("POST", `/api/pipeline/deals/${id}/win`),
  deleteDeal: (id: string) => request<any>("DELETE", `/api/pipeline/deals/${id}`),
  // Auth extras
  getMyWorkspaces: () => request<any>("GET", "/api/auth/my-workspaces"),
  switchWorkspace: (workspace_slug: string) =>
    request<any>("POST", "/api/auth/switch-workspace", { workspace_slug }),
  // Platform admin
  platformListWorkspaces: () => request<any>("GET", "/api/platform/workspaces"),
  platformGetWorkspaceBilling: (slug: string) => request<any>("GET", `/api/platform/workspaces/${slug}/billing`),
  platformUpdateWorkspaceBilling: (slug: string, data: any) =>
    request<any>("PATCH", `/api/platform/workspaces/${slug}/billing`, data),
  platformListMembers: (slug: string) => request<any>("GET", `/api/platform/workspaces/${slug}/members`),
  platformAssignMember: (slug: string, data: { email: string; role?: string }) =>
    request<any>("POST", `/api/platform/workspaces/${slug}/members`, data),
  platformUpdateMemberRole: (slug: string, userId: string, role: string) =>
    request<any>("PATCH", `/api/platform/workspaces/${slug}/members/${userId}/role`, { role }),
  platformRemoveMember: (slug: string, userId: string) =>
    request<any>("DELETE", `/api/platform/workspaces/${slug}/members/${userId}`),
  platformSearchUsers: (email?: string) => {
    const qs = email ? `?email=${encodeURIComponent(email)}` : "";
    return request<any>("GET", `/api/platform/users${qs}`);
  },
};
