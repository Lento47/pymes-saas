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
 * Order is **load-bearing**, not cosmetic, and this comment used to say the opposite.
 *
 * The reasoning it gave was that custom properties resolve lazily, so the adapter does not need
 * the app's tokens to exist first and either order would do. That part is true and irrelevant.
 *
 * What matters is that `index.css` declares `--surface` **itself**, in shadcn's token block, and
 * declares it bare — `--surface: var(--bg-card)`, which is a channel string and not a colour.
 * That is the same defect the adapter exists to prevent, sitting in the app's own stylesheet.
 * Both files therefore set the *same* custom property on `:root`, so specificity cannot break
 * the tie and only source order can. Last writer wins, and this import has to be the last one.
 *
 * Reverse them and every surface, border and muted string in `components/arc` silently resolves
 * to nothing — no build error, no failing assertion, just flat unbordered tables. Confirmed by
 * byte offset in the built bundle: the adapter's `hsl(...)` sits after the bare declaration, and
 * that ordering is the entire margin.
 *
 * `foundation-tokens.test.ts` asserts this ordering, so a tidy-up that reorders these imports
 * fails the suite instead of quietly un-fixing the console.
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
