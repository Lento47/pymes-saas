import { reportClientError } from "@/lib/error-reporting";
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
export function parsePlanError(err: unknown): { isPlanLimit: boolean; message: string } {
  const raw: string = (err instanceof Error ? err.message : String(err)) ?? "";
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

  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers: buildHeaders(), body });
  } catch (error: unknown) {
    if (!path.includes("/error-reports/client")) {
      const err = error as { message?: string; stack?: string };
      void reportClientError({
        source: "FRONTEND",
        category: "API_NETWORK",
        severity: "ERROR",
        title: "Network request failed",
        message: err?.message ?? `Falló la llamada ${method} ${path}`,
        stack: err?.stack,
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
    request<Record<string, any>>("GET", `/api/auth/invite-preview?token=${encodeURIComponent(token)}`),
  acceptInvite: (data: { token: string; name?: string; password?: string }) =>
    request<Record<string, any>>("POST", "/api/auth/accept-invite", data),
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
    return r.json() as Promise<{ access_token: string; refresh_token: string; user: Record<string, any> }>;
  },
  register: (data: { email: string; name: string; password: string }) =>
    request<{ access_token: string; refresh_token: string; user: Record<string, any>; workspace: Record<string, any> }>(
      "POST", "/api/auth/register", data,
    ),
  logout: () => request<Record<string, any>>("POST", "/api/auth/logout"),
  getMe: () => request<Record<string, any>>("GET", "/api/auth/me"),
  generateSummary: () => request<Record<string, any>>("POST", "/api/summaries/generate"),
  getDailySummaries: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/summaries/daily${qs}`);
  },
  getConversations: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/conversations${qs}`);
  },
  getConversation: (id: string) => request<Record<string, any>>("GET", `/api/conversations/${id}`),
  createConversation: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/conversations", data),
  updateConversation: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/conversations/${id}`, data),
  assignConversation: (id: string, userId: string) => request<Record<string, any>>("POST", `/api/conversations/${id}/assign`, { user_id: userId }),
  resolveConversation: (id: string) => request<Record<string, any>>("POST", `/api/conversations/${id}/resolve`),
  deleteConversation: (id: string) => request<Record<string, any>>("DELETE", `/api/conversations/${id}`),
  getMessages: (conversationId: string) => request<Record<string, any>>("GET", `/api/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, data: Record<string, any>) => request<Record<string, any>>("POST", `/api/conversations/${conversationId}/messages`, data),
  getContacts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/contacts${qs}`);
  },
  getContact: (id: string) => request<Record<string, any>>("GET", `/api/contacts/${id}`),
  createContact: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/contacts", data),
  updateContact: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/contacts/${id}`, data),
  deleteContact: (id: string) => request<Record<string, any>>("DELETE", `/api/contacts/${id}`),
  getTasks: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/tasks${qs}`);
  },
  getInvoices: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/invoices${qs}`);
  },
  getInvoice: (id: string) => request<Record<string, any>>("GET", `/api/invoices/${id}`),
  createInvoice: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/invoices", data),
  updateInvoice: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/invoices/${id}`, data),
  deleteInvoice: (id: string) => request<Record<string, any>>("DELETE", `/api/invoices/${id}`),
  markInvoicePaid: (id: string) => request<Record<string, any>>("POST", `/api/invoices/${id}/paid`),
  registerInvoicePayment: (id: string, data: Record<string, any>) => request<Record<string, any>>("POST", `/api/invoices/${id}/payments`, data),
  submitInvoiceToHacienda: (id: string) => request<Record<string, any>>("POST", `/api/invoices/${id}/submit`),
  syncInvoiceHaciendaStatus: (id: string) => request<Record<string, any>>("GET", `/api/invoices/${id}/hacienda-status`),
  createCreditNote: (id: string, data: Record<string, any>) => request<Record<string, any>>("POST", `/api/invoices/${id}/credit-note`, data),
  createDebitNote: (id: string, data: Record<string, any>) => request<Record<string, any>>("POST", `/api/invoices/${id}/debit-note`, data),
  createReceiverMessage: (id: string, data: Record<string, any>) => request<Record<string, any>>("POST", `/api/invoices/${id}/receiver-message`, data),
  detectOverdueInvoices: () => request<Record<string, any>>("GET", "/api/invoices/overdue"),
  generateInvoiceReminder: (id: string) => request<Record<string, any>>("POST", `/api/invoices/${id}/reminder`),
  sendInvoiceReminder: (id: string, data: Record<string, any>) => request<Record<string, any>>("POST", `/api/invoices/${id}/reminder/send`, data),
  createTask: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/tasks", data),
  updateTask: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/tasks/${id}`, data),
  completeTask: (id: string) => request<Record<string, any>>("POST", `/api/tasks/${id}/complete`),
  deleteTask: (id: string) => request<Record<string, any>>("DELETE", `/api/tasks/${id}`),
  getOverdueTasks: () => request<Record<string, any>>("GET", "/api/tasks/overdue"),
  getDocument: (id: string) => request<Record<string, any>>("GET", `/api/documents/${id}`),
  getDocuments: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/documents${qs}`);
  },
  uploadDocument: (formData: FormData) => request<Record<string, any>>("POST", "/api/documents/upload", formData, { isFormData: true }),
  deleteDocument: (id: string) => request<Record<string, any>>("DELETE", `/api/documents/${id}`),
  getAutomations: () => request<Record<string, any>>("GET", "/api/automations"),
  createAutomation: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/automations", data),
  toggleAutomation: (id: string) => request<Record<string, any>>("POST", `/api/automations/${id}/toggle`),
  updateAutomation: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/automations/${id}`, data),
  deleteAutomation: (id: string) => request<Record<string, any>>("DELETE", `/api/automations/${id}`),
  getWorkspace: () => request<Record<string, any>>("GET", "/api/workspaces/current"),
  updateWorkspace: (data: Record<string, any>) => request<Record<string, any>>("PATCH", "/api/workspaces/current", data),
  testAiConnection: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/workspaces/current/ai/test", data),
  getApiKeys: () => request<Record<string, any>>("GET", "/api/workspaces/current/api-keys"),
  updateApiKeys: (data: Record<string, any>) => request<Record<string, any>>("PATCH", "/api/workspaces/current", data),
  getMembers: () => request<Record<string, any>>("GET", "/api/workspaces/current/members"),
  inviteUser: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/workspaces/current/members/invite", data),
  changeMemberRole: (userId: string, newRole: string) => request<Record<string, any>>("PATCH", `/api/workspaces/current/members/${userId}/role`, { role: newRole }),
  removeMember: (userId: string) => request<Record<string, any>>("DELETE", `/api/workspaces/current/members/${userId}`),
  updateUser: (userId: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/users/${userId}`, data),
  getChannels: () => request<Record<string, any>>("GET", "/api/channels"),
  createChannel: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/channels", data),
  updateChannel: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/channels/${id}`, data),
  deleteChannel: (id: string) => request<Record<string, any>>("DELETE", `/api/channels/${id}`),
  connectChannel: (id: string) => request<Record<string, any>>("POST", `/api/channels/${id}/connect`),
  disconnectChannel: (id: string) => request<Record<string, any>>("POST", `/api/channels/${id}/disconnect`),
  getNotifications: () => request<Record<string, any>>("GET", "/api/notifications"),
  getUnreadCount: () => request<Record<string, any>>("GET", "/api/notifications/unread-count"),
  markRead: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/notifications/mark-read", data),
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/audit${qs}`);
  },
  getWorkspaceStats: () => request<Record<string, any>>("GET", "/api/workspaces/current/stats"),
  getTodayStats: () => request<Record<string, any>>("GET", "/api/workspaces/current/stats/today"),
  exportData: (type: string) => request<Record<string, any>>("GET", `/api/workspaces/current/export?type=${type}`),
  search: (q: string, types?: string) => {
    const params = new URLSearchParams({ q });
    if (types) params.set("types", types);
    return request<Record<string, any>>("GET", `/api/search?${params.toString()}`);
  },
  configureEmail: (id: string, data: { api_key?: string; from_email: string; inbound_email?: string; from_name: string }) =>
    request<Record<string, any>>('POST', `/api/channels/${id}/configure-email`, data),
  configureWhatsApp: (id: string, data: { access_token: string; phone_number_id: string; waba_id: string }) =>
    request<Record<string, any>>('POST', `/api/channels/${id}/configure-whatsapp`, data),
  // Departments
  getDepartments: () => request<Record<string, any>>("GET", "/api/departments"),
  createDepartment: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/departments", data),
  updateDepartment: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/departments/${id}`, data),
  deleteDepartment: (id: string) => request<Record<string, any>>("DELETE", `/api/departments/${id}`),
  getDepartmentMembers: (id: string) => request<Record<string, any>>("GET", `/api/departments/${id}/members`),
  addDepartmentMember: (id: string, data: { user_id: string; is_lead?: boolean }) =>
    request<Record<string, any>>("POST", `/api/departments/${id}/members`, data),
  removeDepartmentMember: (id: string, userId: string) =>
    request<Record<string, any>>("DELETE", `/api/departments/${id}/members/${userId}`),
  getInsights: () => request<Record<string, any>>("GET", "/api/insights"),
  validateTaxpayer: (identificacion: string) =>
    request<Record<string, any>>("POST", "/api/hacienda/validate-taxpayer", { identificacion }),
  searchCabys: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, any>>("GET", `/api/hacienda/cabys${qs}`);
  },
  getExoneration: (authorization: string) => request<Record<string, any>>("GET", `/api/hacienda/exonerations/${authorization}`),
  getExchangeRate: () => request<Record<string, any>>("GET", "/api/hacienda/exchange-rate"),
  // Pipeline
  getPipelineStages: () => request<Record<string, any>>("GET", "/api/pipeline/stages"),
  createPipelineStage: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/pipeline/stages", data),
  updatePipelineStage: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/pipeline/stages/${id}`, data),
  deletePipelineStage: (id: string) => request<Record<string, any>>("DELETE", `/api/pipeline/stages/${id}`),
  createDeal: (data: Record<string, any>) => request<Record<string, any>>("POST", "/api/pipeline/deals", data),
  updateDeal: (id: string, data: Record<string, any>) => request<Record<string, any>>("PATCH", `/api/pipeline/deals/${id}`, data),
  moveDeal: (id: string, stageId: string) => request<Record<string, any>>("PATCH", `/api/pipeline/deals/${id}/move`, { stage_id: stageId }),
  winDeal: (id: string) => request<Record<string, any>>("POST", `/api/pipeline/deals/${id}/win`),
  deleteDeal: (id: string) => request<Record<string, any>>("DELETE", `/api/pipeline/deals/${id}`),
  // Auth extras
  getMyWorkspaces: () => request<Record<string, any>>("GET", "/api/auth/my-workspaces"),
  switchWorkspace: (workspace_slug: string) =>
    request<Record<string, any>>("POST", "/api/auth/switch-workspace", { workspace_slug }),
  // Billing
  getBillingPrices: () => request<Record<string, string | null>>("GET", "/api/billing/prices"),
  createCheckout: (priceId: string) =>
    request<{ transactionId: string; checkoutUrl: string | null }>("POST", "/api/billing/checkout", { priceId }),
  // Platform admin
  platformListWorkspaces: () => request<Record<string, any>>("GET", "/api/platform/workspaces"),
  platformGetWorkspaceBilling: (slug: string) => request<Record<string, any>>("GET", `/api/platform/workspaces/${slug}/billing`),
  platformUpdateWorkspaceBilling: (slug: string, data: Record<string, any>) =>
    request<Record<string, any>>("PATCH", `/api/platform/workspaces/${slug}/billing`, data),
  platformListMembers: (slug: string) => request<Record<string, any>>("GET", `/api/platform/workspaces/${slug}/members`),
  platformAssignMember: (slug: string, data: { email: string; role?: string }) =>
    request<Record<string, any>>("POST", `/api/platform/workspaces/${slug}/members`, data),
  platformUpdateMemberRole: (slug: string, userId: string, role: string) =>
    request<Record<string, any>>("PATCH", `/api/platform/workspaces/${slug}/members/${userId}/role`, { role }),
  platformRemoveMember: (slug: string, userId: string) =>
    request<Record<string, any>>("DELETE", `/api/platform/workspaces/${slug}/members/${userId}`),
  platformSearchUsers: (email?: string) => {
    const qs = email ? `?email=${encodeURIComponent(email)}` : "";
    return request<Record<string, any>>("GET", `/api/platform/users${qs}`);
  },
  platformGetStats: () => request<Record<string, any>>("GET", "/api/platform/stats"),
  // Business profile (onboarding)
  getBusinessProfile: () => request<Record<string, any>>("GET", "/api/workspaces/business-profile"),
  saveBusinessProfile: (data: {
    categories: string[];
    team_size: string;
    channels: string[];
    needs: string[];
  }) => request<Record<string, any>>("POST", "/api/workspaces/business-profile", data),
  // Hacienda certificates
  listCertificates: () => request<Record<string, any>[]>("GET", "/api/hacienda/certificates"),
  uploadCertificate: (form: FormData) => request<Record<string, any>>("POST", "/api/hacienda/certificates", form, { isFormData: true }),
  revokeCertificate: (id: string) => request<Record<string, any>>("DELETE", `/api/hacienda/certificates/${id}`),
};
