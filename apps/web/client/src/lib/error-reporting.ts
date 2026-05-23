const API_BASE = import.meta.env.VITE_PYMESHUB_API_URL ?? import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ??
  ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__");
const LS_SLUG_KEY = "pymes_slug";
const LS_TOKEN_KEY = "pymes_token";
const LS_USER_KEY = "pymes_user";
const SESSION_KEY = "pymes_error_session";

type ErrorReportPayload = {
  source: string;
  category: string;
  severity?: string;
  title?: string;
  message: string;
  stack?: string;
  route?: string;
  url?: string;
  method?: string;
  status_code?: number;
  user_agent?: string;
  context_json?: Record<string, unknown>;
  occurred_at?: string;
};

function getSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return "unknown-session";
  }
}

function getWorkspaceSlug() {
  try {
    return localStorage.getItem(LS_SLUG_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function getAuthToken() {
  try {
    return localStorage.getItem(LS_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function getUserSnapshot() {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildPayload(payload: ErrorReportPayload) {
  const user = getUserSnapshot();

  return {
    ...payload,
    route: payload.route ?? window.location.pathname,
    url: payload.url ?? window.location.href,
    user_agent: payload.user_agent ?? navigator.userAgent,
    occurred_at: payload.occurred_at ?? new Date().toISOString(),
    workspace_slug: getWorkspaceSlug(),
    client_user_id: user?.id,
    client_user_email: user?.email,
    context_json: {
      session_id: getSessionId(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ...payload.context_json,
    },
  };
}

export async function reportClientError(payload: ErrorReportPayload) {
  const body = JSON.stringify(buildPayload(payload));
  const url = `${API_BASE}/api/error-reports/client`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getAuthToken();
    const workspaceSlug = getWorkspaceSlug();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (workspaceSlug) headers["x-workspace-slug"] = workspaceSlug;

    await fetch(url, {
      method: "POST",
      headers,
      body,
      keepalive: true,
    });
  } catch {
    // Best-effort only; never break UX while reporting an error.
  }
}

export function installGlobalErrorReporting() {
  window.addEventListener("error", (event) => {
    void reportClientError({
      source: "FRONTEND",
      category: "WINDOW_ERROR",
      severity: "ERROR",
      title: event.error?.name ?? "Unhandled browser error",
      message: event.message || "Error no controlado en el navegador.",
      stack: event.error?.stack,
      context_json: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void reportClientError({
      source: "FRONTEND",
      category: "UNHANDLED_PROMISE",
      severity: "ERROR",
      title: "Unhandled promise rejection",
      message:
        typeof reason === "string"
          ? reason
          : reason?.message ?? "Promesa rechazada sin manejo.",
      stack: reason?.stack,
      context_json: {
        reason:
          typeof reason === "object" && reason !== null
            ? JSON.stringify(reason)
            : reason,
      },
    });
  });
}
