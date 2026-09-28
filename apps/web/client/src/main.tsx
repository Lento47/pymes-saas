import { scrubTelemetryPayload } from "@pymeshub/shared";
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/error-reporting";
import { normalizeInitialLocation } from "@/hooks/use-workspace-location";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION
    ? `pymeshub-web@${import.meta.env.VITE_APP_VERSION}`
    : undefined,
  tracesSampleRate: import.meta.env.PROD ? 0.05 : 0,
  beforeSend: (event) => scrubTelemetryPayload(event),
  beforeBreadcrumb: (breadcrumb) => scrubTelemetryPayload(breadcrumb),
});

if (window.location.pathname === "/" && !window.location.hash) {
  history.replaceState(null, "", "/");
}

normalizeInitialLocation();
installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
