/**
 * Where the SaaS (NestJS) API lives.
 *
 * Same variable chain and same failure mode as `lib/api.ts` — an unset value used to fall
 * back to `""`, which is the page's own origin, so every client error report was posted to a
 * host that does not mount `/api/*` and failed as a CORS error. The two files resolve this
 * separately rather than importing a shared constant, because `error-reporting.ts` is
 * installed from `main.tsx` before anything else and must not be able to fail to load.
 *
 * This is the NestJS host, named by `VITE_API_URL`. It is **not** the marketplace Worker,
 * which `lib/marketplace.ts` reaches through `VITE_MARKETPLACE_API_URL` and which mounts
 * `/trpc` rather than `/api/*`.
 */
const CONFIGURED_API_BASE =
  import.meta.env.VITE_PYMESHUB_API_URL ??
  import.meta.env.VITE_API_URL ??
  import.meta.env.API_URL;

const API_BASE =
  typeof CONFIGURED_API_BASE === "string" && CONFIGURED_API_BASE.length > 0
    ? CONFIGURED_API_BASE
    : "";

const LS_SLUG_KEY = "pymes_slug";
const LS_TOKEN_KEY = "pymes_token";
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
    return (
      sessionStorage.getItem(LS_SLUG_KEY) ??
      localStorage.getItem(LS_SLUG_KEY) ??
      undefined
    );
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

function buildPayload(payload: ErrorReportPayload) {
  return scrubTelemetryPayload({
    ...payload,
    route: payload.route ?? window.location.pathname,
    url: payload.url ?? `${window.location.origin}${window.location.pathname}`,
    user_agent: payload.user_agent ?? navigator.userAgent,
    occurred_at: payload.occurred_at ?? new Date().toISOString(),
    workspace_slug: getWorkspaceSlug(),
    context_json: {
      session_id: getSessionId(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ...payload.context_json,
    },
  });
}

export async function reportClientError(payload: ErrorReportPayload) {
  const body = JSON.stringify(buildPayload(payload));

  // Refused rather than sent to the page origin. This is the one call here that has to
  // complain out loud: it is the only record that a real user hit a real bug, and it failed
  // silently in production for as long as `VITE_API_URL` was unset — the reporter was
  // installed, working, and reporting to a host with no `/api/*` on it. A wrong `url` here
  // means a bug report is lost, and nobody would have been told.
  if (API_BASE.length === 0) {
    console.error(
      "[pymes] Client error reports are not being sent: VITE_API_URL is unset, so there " +
        "is no SaaS API host to post to. Set it in apps/web/.env.production. Not the " +
        "marketplace Worker — that one is VITE_MARKETPLACE_API_URL and mounts /trpc.",
    );
    return;
  }
  const url = `${API_BASE}/api/error-reports/client`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
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
          : (reason?.message ?? "Promesa rechazada sin manejo."),
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
import { scrubTelemetryPayload } from "@pymeshub/shared";
