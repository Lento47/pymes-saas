import { reportClientError } from "@/lib/error-reporting";

// Errors thrown from `request()` carry the support-case the backend opened
export class ApiError extends Error {
  readonly status?: number;
  readonly case_id?: string;
  readonly error_code?: string;
  constructor(message: string, opts: { status?: number; case_id?: string; error_code?: string } = {}) {
    const suffix = opts.case_id ? ` · Ticket #${opts.case_id.slice(-6)} abierto` : "";
    super(`${message}${suffix}`);
    this.name = "ApiError";
    this.status = opts.status;
    this.case_id = opts.case_id;
    this.error_code = opts.error_code;
  }
}

const API_BASE = import.meta.env.VITE_PymesHub_API_URL ?? import.meta.env.VITE_API_URL ??
  ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__");

// ── Auth state ──
let _token: string | null = null;
let _workspaceSlug: string | null = null;
let _refreshToken: string | null = null;

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function getStorage(): Storage {
  try { return localStorage; } catch { return sessionStorage; }
}

export function setAuthState(token: string, slug: string, refreshToken?: string) {
  _token = token;
  _workspaceSlug = slug;
  if (refreshToken) _refreshToken = refreshToken;
  updateLastActivity();
  try {
    const s = getStorage();
    s.removeItem('pymes_last_slug');
    s.setItem('pymes_slug', slug);
    s.setItem('pymes_token', token);
    if (refreshToken) s.setItem('pymes_refresh', refreshToken);
  } catch { /* ignore */ }
}

export function clearAuthState() {
  _token = null;
  const slug = _workspaceSlug;
  _workspaceSlug = null;
  _refreshToken = null;
  try {
    const s = getStorage();
    if (slug) s.setItem('pymes_last_slug', slug);
    s.removeItem('pymes_slug');
    s.removeItem('pymes_token');
    s.removeItem('pymes_refresh');
    s.removeItem('pymes_last_activity');
  } catch { /* ignore */ }
}

export function getAuthToken() {
  if (_token) return _token;
  try {
    _token = getStorage().getItem('pymes_token');
    return _token;
  } catch { return null; }
}
export function getWorkspaceSlug() {
  if (_workspaceSlug) return _workspaceSlug;
  try { return getStorage().getItem('pymes_slug') || null; } catch { return null; }
}
export function getRefreshToken() {
  if (_refreshToken) return _refreshToken;
  try { return getStorage().getItem('pymes_refresh') || null; } catch { return null; }
}
export function isLoggedIn() {
  if (_token) return true;
  try { return !!getStorage().getItem('pymes_token'); } catch { return false; }
}

export function parsePlanError(err: any): { isPlanLimit: boolean; message: string } {
  const raw: string = err?.message ?? "";
  const isPlanLimit = raw.startsWith("403:");
  const message = isPlanLimit ? raw.replace(/^403:\s*/, "").replace(/^\d+\s*/, "").trim() : raw;
  return { isPlanLimit, message };
}

let _refreshPromise: Promise<boolean> | null = null;

async function _tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      _token = data.access_token;
      try { getStorage().setItem('pymes_token', data.access_token); } catch { /* ignore */ }
      if (data.refresh_token) {
        _refreshToken = data.refresh_token;
        try { getStorage().setItem('pymes_refresh', data.refresh_token); } catch { /* ignore */ }
      }
      try {
        const { getSocket, connectSocket } = await import('../hooks/use-socket');
        const sock = getSocket();
        if (sock?.connected) {
          sock.auth = { token: data.access_token };
          sock.disconnect().connect();
        } else if (!sock) {
          connectSocket();
        }
      } catch { /* non-critical */ }
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export async function restoreSession(): Promise<boolean> {
  const slug = getWorkspaceSlug();
  if (slug) _workspaceSlug = slug;

  const refreshToken = getRefreshToken();
  if (refreshToken) {
    _refreshToken = refreshToken;
    return _tryRefresh();
  }
  return false;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;

  try {
    updateLastActivity();
    res = await fetch(`${API_BASE}${path}`, { method, headers: buildHeaders(), body, signal: controller.signal });
  } catch (error: any) {
    clearTimeout(timeout);
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
  clearTimeout(timeout);

  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    const refreshed = await _tryRefresh();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, { method, headers: buildHeaders(), body });
    }
    if (!refreshed || res.status === 401) {
      history.pushState(null, "", "/login?expired=true");
      window.dispatchEvent(new PopStateEvent("popstate"));
      clearAuthState();
      throw new Error("401: Sesión expirada.");
    }
  }

  if (!res.ok) {
    const raw = (await res.text()) || res.statusText;
    let message: string = raw;
    let case_id: string | undefined;
    let error_code: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      const msg = parsed.message ?? parsed.error ?? raw;
      message = Array.isArray(msg) ? msg.join(" · ") : String(msg);
      case_id = typeof parsed.case_id === "string" ? parsed.case_id : undefined;
      error_code = typeof parsed.error_code === "string" ? parsed.error_code : undefined;
    } catch { /* not JSON, use raw text */ }
    if (res.status >= 500 && !path.includes("/error-reports/client")) {
      void reportClientError({
        source: "FRONTEND",
        category: "API_RESPONSE",
        severity: "ERROR",
        title: `API ${res.status}`,
        message,
        method,
        status_code: res.status,
        url: `${API_BASE}${path}`,
        context_json: { path, case_id, error_code },
      });
    }
    throw new ApiError(message, { status: res.status, case_id, error_code });
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
  previewInviteCode: (code: string) => request<any>("POST", "/api/auth/invite-code-preview", { code }),
  redeemInviteCode: (data: { code: string; name?: string; password?: string }) =>
    request<any>("POST", "/api/auth/redeem-invite-code", data),
  getInviteCodes: () => request<any>("GET", "/api/workspaces/current/invite-codes"),
  createInviteCode: (data: { role?: string; max_uses?: number; expires_in_days?: number }) =>
    request<any>("POST", "/api/workspaces/current/invite-codes", data),
  revokeInviteCode: (id: string) => request<any>("DELETE", `/api/workspaces/current/invite-codes/${id}`),
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
  approveInvoice: (id: string) => request<any>("POST", `/api/invoices/${id}/approve`),
  rejectInvoice: (id: string, reason: string) => request<any>("POST", `/api/invoices/${id}/reject`, { reason }),
  getPendingApprovals: () => request<any>("GET", "/api/invoices/pending-approvals"),
  registerInvoicePayment: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/payments`, data),
  submitInvoiceToHacienda: (id: string) => request<any>("POST", `/api/invoices/${id}/submit`),
  syncInvoiceHaciendaStatus: (id: string) => request<any>("GET", `/api/invoices/${id}/hacienda-status`),
  createCreditNote: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/credit-note`, data),
  createDebitNote: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/debit-note`, data),
  createReceiverMessage: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/receiver-message`, data),
  detectOverdueInvoices: () => request<any>("GET", "/api/invoices/overdue"),
  generateInvoiceReminder: (id: string) => request<any>("POST", `/api/invoices/${id}/reminder`),
  sendInvoiceReminder: (id: string, data: any) => request<any>("POST", `/api/invoices/${id}/reminder/send`, data),
  validateInvoiceForHacienda: (id: string) => request<any>("POST", `/api/invoices/${id}/hacienda-validate`),
  getInvoiceHaciendaErrorExplain: (id: string) => request<any>("GET", `/api/invoices/${id}/hacienda-error-explain`),
  getInvoiceTemplates: (industry?: string) => {
    const qs = industry ? `?industry=${encodeURIComponent(industry)}` : "";
    return request<any>("GET", `/api/invoices/templates${qs}`);
  },
  getInvoiceXmlPreview: (id: string) => request<any>("GET", `/api/invoices/${id}/xml-preview`),
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
  uploadAttachment: (formData: FormData) => request<{ url: string }>("POST", "/api/documents/upload-attachment", formData, { isFormData: true }),
  deleteDocument: (id: string) => request<any>("DELETE", `/api/documents/${id}`),
  getAutomations: () => request<any>("GET", "/api/automations"),
  createAutomation: (data: any) => request<any>("POST", "/api/automations", data),
  toggleAutomation: (id: string) => request<any>("POST", `/api/automations/${id}/toggle`),
  updateAutomation: (id: string, data: any) => request<any>("PATCH", `/api/automations/${id}`, data),
  deleteAutomation: (id: string) => request<any>("DELETE", `/api/automations/${id}`),
  getWorkspace: () => request<any>("GET", "/api/workspaces/current"),
  updateWorkspace: (data: any) => request<any>("PATCH", "/api/workspaces/current", data),
  testAiConnection: (data: any) => request<any>("POST", "/api/workspaces/current/ai/test", data),
  createCheckout: (priceId: string) => request<any>("POST", "/api/billing/checkout", { priceId }),
  getBillingPrices: () => request<any>("GET", "/api/billing/prices"),
  getAddonPrices: () => request<any>("GET", "/api/billing/addon-prices"),
  createAddonCheckout: (addonKey: string) => request<any>("POST", "/api/billing/checkout-addon", { addonKey }),
  getBillingPortal: () => request<any>("GET", "/api/billing/portal"),
  getBillingInvoices: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
      ) as Record<string, string>
    ).toString() : "";
    return request<any>("GET", `/api/billing/invoices${qs}`);
  },
  getSubscription: () => request<any>("GET", "/api/workspaces/current/subscription"),
  cancelPlan: () => request<any>("POST", "/api/billing/cancel"),
  changePlan: (priceId: string) => request<any>("POST", "/api/billing/change-plan", { priceId }),
  getApiKeys: () => request<any>("GET", "/api/workspaces/current/api-keys"),
  updateApiKeys: (data: any) => request<any>("PATCH", "/api/workspaces/current", data),
  getMembers: () => request<any>("GET", "/api/workspaces/current/members"),
  inviteUser: (data: any) => request<any>("POST", "/api/workspaces/current/members/invite", data),
  changeMemberRole: (userId: string, newRole: string) => request<any>("PATCH", `/api/workspaces/current/members/${userId}/role`, { role: newRole }),
  removeMember: (userId: string) => request<any>("DELETE", `/api/workspaces/current/members/${userId}`),
  updateUser: (userId: string, data: any) => request<any>("PATCH", `/api/users/${userId}`, data),
  updateMe: (data: any) => request<any>("PATCH", "/api/users/me", data),
  changePassword: (data: { current_password: string; new_password: string }) => request<any>("PATCH", "/api/users/me/password", data),
  uploadAvatar: (formData: FormData) => request<any>("POST", "/api/users/me/avatar", formData, { isFormData: true }),
  getChannels: () => request<any>("GET", "/api/channels"),
  getAllChannels: () => request<any>("GET", "/api/channels?include_inactive=true"),
  getWhatsAppConfig: () => request<any>("GET", "/api/channels/whatsapp-config"),
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
  getDashboard: () => request<any>("GET", "/api/workspaces/current/dashboard"),
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
  configureTelegram: (id: string, data: { bot_token: string }) =>
    request<any>('POST', `/api/channels/${id}/configure-telegram`, data),
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
  validateTaxpayer: (identificacion: string) =>
    request<any>("POST", "/api/hacienda/validate-taxpayer", { identificacion }),
  searchCabys: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>("GET", `/api/hacienda/cabys${qs}`);
  },
  getExoneration: (authorization: string) => request<any>("GET", `/api/hacienda/exonerations/${authorization}`),
  getExchangeRate: () => request<any>("GET", "/api/hacienda/exchange-rate"),
  listCertificates: () => request<any[]>("GET", "/api/hacienda/certificates"),
  uploadCertificate: (form: FormData) => request<any>("POST", "/api/hacienda/certificates", form, { isFormData: true }),
  revokeCertificate: (id: string) => request<any>("DELETE", `/api/hacienda/certificates/${id}`),
  // Business profile (onboarding wizard)
  getBusinessProfile: () => request<any>("GET", "/api/workspaces/business-profile"),
  saveBusinessProfile: (data: { categories: string[]; team_size: string; channels: string[]; needs: string[] }) =>
    request<any>("POST", "/api/workspaces/business-profile", data),
  getPipelineStages: () => request<any>("GET", "/api/pipeline/stages"),
  createPipelineStage: (data: any) => request<any>("POST", "/api/pipeline/stages", data),
  updatePipelineStage: (id: string, data: any) => request<any>("PATCH", `/api/pipeline/stages/${id}`, data),
  deletePipelineStage: (id: string) => request<any>("DELETE", `/api/pipeline/stages/${id}`),
  createDeal: (data: any) => request<any>("POST", "/api/pipeline/deals", data),
  updateDeal: (id: string, data: any) => request<any>("PATCH", `/api/pipeline/deals/${id}`, data),
  moveDeal: (id: string, stageId: string) => request<any>("PATCH", `/api/pipeline/deals/${id}/move`, { stage_id: stageId }),
  winDeal: (id: string) => request<any>("POST", `/api/pipeline/deals/${id}/win`),
  deleteDeal: (id: string) => request<any>("DELETE", `/api/pipeline/deals/${id}`),
  refresh: (token: string) => request<any>("POST", "/api/auth/refresh", { refresh_token: token }),
  getMyWorkspaces: () => request<any>("GET", "/api/auth/my-workspaces"),
  switchWorkspace: (workspace_slug: string) =>
    request<any>("POST", "/api/auth/switch-workspace", { workspace_slug }),
  register: (data: { email: string; name: string; password: string }) =>
    request<any>("POST", "/api/auth/register", data),
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
  platformCreateUser: (data: { email: string; name: string; password: string; is_platform_admin?: boolean }) =>
    request<any>("POST", "/api/platform/users", data),
  platformUpdateUserPassword: (userId: string, password: string) =>
    request<any>("PATCH", `/api/platform/users/${userId}/password`, { password }),
  platformResetUserPassword: (userId: string) =>
    request<any>("POST", `/api/platform/users/${userId}/reset-password`),
  platformUpdateUserStatus: (userId: string, status: string) =>
    request<any>("PATCH", `/api/platform/users/${userId}/status`, { status }),
  platformDeleteUser: (userId: string) => request<any>("DELETE", `/api/platform/users/${userId}`),
  platformGetStats: () => request<any>("GET", "/api/platform/stats"),
  platformToggleAdmin: (userId: string) => request<any>("PATCH", `/api/platform/users/${userId}/toggle-admin`),
  platformGetWorkspaceBySlug: (slug: string) => request<any>("GET", `/api/platform/workspaces/${slug}`),
  platformDeleteWorkspace: (slug: string) => request<any>("DELETE", `/api/platform/workspaces/${slug}`),
  platformGetWorkspaceFeatures: (slug: string) => request<any>("GET", `/api/platform/workspaces/${slug}/features`),
  platformUpdateWorkspaceFeatures: (slug: string, data: any) => request<any>("PATCH", `/api/platform/workspaces/${slug}/features`, data),
  platformGetPlanLimits: () => request<any>("GET", "/api/platform/plan-limits"),
  platformUpdatePlanLimits: (overrides: { plan: string; resource: string; value: number }[]) => request<any>("PATCH", "/api/platform/plan-limits", { overrides }),
  getCurrentFeatures: () => request<any>("GET", "/api/workspaces/current/features"),
  askAssistant: (prompt: string) => request<any>("POST", "/api/workspaces/current/ai/assist", { prompt }),
  createAgentStream: (message: string, conversationId?: string) => request<any>("POST", "/api/agent/stream", { message, conversationId }),
  executeAgentTool: (tool: string, args?: any) => request<any>("POST", "/api/agent/tool", { tool, args }),
  escalateToSupport: (summary: string, severity?: string, evidence?: Record<string, any>) =>
    request<any>("POST", "/api/agent/escalate", { summary, severity, evidence }),
  runDiagnostic: (module: string, error_code?: string, trace_id?: string, user_description?: string) =>
    request<any>("POST", "/api/agent/diagnose", { module, error_code, trace_id, user_description }),
  getRoutingRules: () => request<any>("GET", "/api/routing/rules"),
  createRoutingRule: (data: any) => request<any>("POST", "/api/routing/rules", data),
  updateRoutingRule: (id: string, data: any) => request<any>("PATCH", `/api/routing/rules/${id}`, data),
  deleteRoutingRule: (id: string) => request<any>("DELETE", `/api/routing/rules/${id}`),
  ssoExchange: (code: string) =>
    request<{ access_token: string; refresh_token?: string; user: any }>("POST", "/api/auth/sso-exchange", { code }),
  facebookTokenLogin: (accessToken: string) =>
    request<{ code: string; slug: string }>("POST", "/api/auth/facebook/token", { accessToken }),
  telegramTokenLogin: (data: any) =>
    request<{ code: string; slug: string }>("POST", "/api/auth/telegram/token", data),
  checkSamlStatus: (workspaceSlug: string) => request<any>("GET", `/api/auth/saml/status/${workspaceSlug}`),
  getSamlConfig: (workspaceId: string) => request<any>("GET", `/api/auth/saml/config/${workspaceId}`),
  upsertSamlConfig: (workspaceId: string, data: any) => request<any>("PUT", `/api/auth/saml/config/${workspaceId}`, data),
  enableSaml: (workspaceId: string) => request<any>("POST", `/api/auth/saml/config/${workspaceId}/enable`),
  disableSaml: (workspaceId: string) => request<any>("POST", `/api/auth/saml/config/${workspaceId}/disable`),
  getApiTokens: () => request<any>("GET", "/api/workspaces/current/api-tokens"),
  createApiToken: (name: string) => request<any>("POST", "/api/workspaces/current/api-tokens", { name }),
  revokeApiToken: (id: string) => request<any>("DELETE", `/api/workspaces/current/api-tokens/${id}`),
  getEnterpriseConfig: (workspaceId: string) => request<any>("GET", `/api/enterprise/config/${workspaceId}`),
  upsertEnterpriseConfig: (workspaceId: string, data: any) => request<any>("PUT", `/api/enterprise/config/${workspaceId}`, data),
  getEnterpriseCapabilities: () => request<any>("GET", "/api/enterprise/capabilities"),
  submitContactSales: (data: any) => request<any>("POST", "/api/contact-sales", data),
  getOnboardingProject: () => request<any>("GET", "/api/onboarding"),
  getOnboardingStatus: () => request<any>("GET", "/api/onboarding/status"),
  saveOnboardingProject: (data: any) => request<any>("POST", "/api/onboarding", data),
  getDiagnosticCases: () => request<any>("GET", "/api/agent/diagnostic-cases"),
  updateDiagnosticCaseStatus: (id: string, status: string) =>
    request<any>("PATCH", `/api/agent/diagnostic-cases/${id}/status`, { status }),
  createFixCase: (diagnosticCaseId: string) =>
    request<any>("POST", "/api/agent/fix-cases", { diagnostic_case_id: diagnosticCaseId }),
  getCaseComments: (caseId: string) => request<any>("GET", `/api/agent/diagnostic-cases/${caseId}/comments`),
  createCaseComment: (caseId: string, body: string) =>
    request<any>("POST", `/api/agent/diagnostic-cases/${caseId}/comments`, { body }),
  getProducts: (params?: string) => request<any>("GET", `/api/inventory/products${params ? `?${params}` : ''}`) ,
  getProduct: (id: string) => request<any>("GET", `/api/inventory/products/${id}`),
  createProduct: (data: any) => request<any>("POST", "/api/inventory/products", data),
  updateProduct: (id: string, data: any) => request<any>("PATCH", `/api/inventory/products/${id}`, data),
  archiveProduct: (id: string) => request<any>("DELETE", `/api/inventory/products/${id}`),
  adjustStock: (id: string, data: any) => request<any>("POST", `/api/inventory/products/${id}/adjust-stock`, data),
  getLowStock: () => request<any>("GET", "/api/inventory/products/low-stock"),
  getStockMovements: (params?: string) => request<any>("GET", `/api/inventory/movements${params ? `?${params}` : ''}`) ,
  getCategories: () => request<any>("GET", "/api/inventory/categories"),
  createCategory: (data: any) => request<any>("POST", "/api/inventory/categories", data),
  updateCategory: (id: string, data: any) => request<any>("PATCH", `/api/inventory/categories/${id}`, data),
  deleteCategory: (id: string) => request<any>("DELETE", `/api/inventory/categories/${id}`),
  getFeatureFlags: (workspaceId: string) => request<any>("GET", `/api/feature-flags/check/${workspaceId}`),
  getUsage: (workspaceId: string) => request<any>("GET", `/api/usage/${workspaceId}`),
  getMessageTemplates: (workspaceId: string, channel?: string) => {
    const qs = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    return request<any>("GET", `/api/message-templates/${workspaceId}${qs}`);
  },
  getApprovedTemplates: (workspaceId: string, channel?: string) =>
    request<any>("GET", `/api/message-templates/${workspaceId}/approved?channel=${channel ?? 'WHATSAPP'}`),
  getSlaPolicies: () => request<any>("GET", "/api/sla/policies"),
  getSlaAssignment: (workspaceId: string) => request<any>("GET", `/api/sla/assignment/${workspaceId}`),
  assignSlaPolicy: (workspaceId: string, data: any) => request<any>("POST", `/api/sla/assignment/${workspaceId}`, data),
  trackEvent: (event: string, category?: string, value?: number, metadata?: Record<string, string>) =>
    request<any>("POST", "/api/metrics/event", { event, category, value, metadata }),
  listSystemTemplates: (type: string, category?: string) => {
    const qs = new URLSearchParams({ type });
    if (category) qs.set("category", category);
    return request<any>("GET", `/api/templates/system?${qs}`);
  },
};

// ── Session activity tracking ────────────────────────────────────────────

export function updateLastActivity() {
  try {
    getStorage().setItem('pymes_last_activity', String(Date.now()));
  } catch {}
}

export function isSessionTimedOut(): boolean {
  try {
    const ts = getStorage().getItem('pymes_last_activity');
    if (!ts) return true;
    return (Date.now() - parseInt(ts, 10)) > INACTIVITY_TIMEOUT_MS;
  } catch {
    return true;
  }
}

export function getInactivityMs(): number {
  try {
    const ts = getStorage().getItem('pymes_last_activity');
    if (!ts) return INACTIVITY_TIMEOUT_MS;
    return Date.now() - parseInt(ts, 10);
  } catch {
    return INACTIVITY_TIMEOUT_MS;
  }
}

if (typeof window !== 'undefined') {
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const onActivity = () => {
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => { throttleTimer = null; updateLastActivity(); }, 5000);
  };
  events.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
}