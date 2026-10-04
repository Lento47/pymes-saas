import { scrubTelemetryPayload } from "@pymeshub/shared";
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
/**
 * Arc's token adapter, after `index.css` on purpose.
 *
 * It maps Arc's token *names* onto this app's *values* — `--surface` to `--bg-card`,
 * `--text-muted` to `--fg-2`, and so on — so the Arc components in `components/arc` render in
 * this app's palette instead of importing a second one. See the file's header for the two
 * things it deliberately does not do: it does not take ownership of `:root`, and it does not
 * remove focus outlines.
 *
 * Order matters only in that the app's own tokens must already exist for the adapter to have
 * something to point at; both blocks are `:root` custom properties, so either order would
 * resolve, and this one is last so the intent is readable.
 */
import "@/components/arc/foundation.css";
import { normalizeInitialLocation } from "@/hooks/use-workspace-location";
import { installGlobalErrorReporting } from "@/lib/error-reporting";

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
