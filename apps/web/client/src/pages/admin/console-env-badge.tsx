import { Badge } from "@/components/ui/badge";

/**
 * Which environment this build is pointed at, or `null` when it cannot tell.
 *
 * ## Why the host and not `import.meta.env.MODE`
 *
 * `MODE` is the obvious answer and it is the wrong one. Vite sets it to `production` for
 * **every** production build, and Cloudflare Pages builds a preview deploy exactly the same
 * way — so a badge driven by `MODE` would read "Producción" on a preview deployment whose data
 * is not production's. That is the precise case the badge exists to prevent: an operator
 * suspending a real shop because they believed they were on staging.
 *
 * So the signal is the API host, which genuinely differs per environment.
 */
function detectEnvironment(): { label: string; tone: "destructive" | "outline" } | null {
  // `import.meta.env.DEV` rather than `MODE`: this one is unambiguous by construction.
  if (import.meta.env.DEV) return { label: "Desarrollo", tone: "outline" };

  const configured = import.meta.env.VITE_DEPLOY_ENV;
  if (configured) {
    // An explicit name always wins, including an explicit "production" — somebody set it
    // because they know something this function does not.
    const isProduction = configured.toLowerCase() === "production";
    return { label: configured, tone: isProduction ? "outline" : "destructive" };
  }

  /*
    Substring matching, not equality, and the order matters.

    A Cloudflare preview host looks like
    `https://<branch>-<hash>.pymeshub.workers.dev`, so the marker is rarely the whole hostname.
    "preview" is tested before "production" because a host can contain both — a deployment
    named `preview-production-fix` is still a preview, and reading it as production is the
    exact failure above.
  */
  const host = apiHost();
  if (!host) return null;
  if (/staging|preview|\.dev\b|localhost|test/i.test(host)) {
    return { label: "No producción", tone: "destructive" };
  }
  if (/prod|api\.pymeshub/i.test(host)) return { label: "Producción", tone: "outline" };
  return null;
}

function apiHost(): string | null {
  const raw =
    import.meta.env.VITE_PYMESHUB_API_URL ??
    import.meta.env.VITE_API_URL ??
    import.meta.env.VITE_MARKETPLACE_API_URL;
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    // A relative or malformed value is not something to render a confident label from. The
    // badge stays away rather than guessing.
    return null;
  }
}

/**
 * The badge, when there is something true to say.
 *
 * **Returning `null` is the common case and is deliberate.** A production console that says
 * "Producción" on every page tells an operator nothing they did not already know, and costs a
 * piece of chrome. The badge earns its place in exactly two situations: a developer who has
 * lost track of which build they are looking at, and an operator who has been handed a preview
 * deploy and needs to know before they touch anything.
 */
export function ConsoleEnvBadge() {
  const environment = detectEnvironment();
  if (!environment) return null;

  return (
    <Badge
      variant="outline"
      // Destructive is the loud one, and it is used for "this is not production" — the case
      // where being wrong has consequences. Production gets the quiet outline.
      className={
        environment.tone === "destructive"
          ? "border-destructive/50 text-destructive"
          : "text-muted-foreground"
      }
      title={`API: ${apiHost() ?? "sin host configurado"}`}
    >
      {environment.label}
    </Badge>
  );
}
