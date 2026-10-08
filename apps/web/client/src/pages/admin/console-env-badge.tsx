import { Badge } from "@/components/arc/badge/badge";
import { Tooltip } from "@/components/arc/tooltip/tooltip";

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
function detectEnvironment(): {
  label: string;
  tone: "destructive" | "outline";
} | null {
  // `import.meta.env.DEV` rather than `MODE`: this one is unambiguous by construction.
  if (import.meta.env.DEV) return { label: "Desarrollo", tone: "outline" };

  const configured = import.meta.env.VITE_DEPLOY_ENV;
  if (configured) {
    // An explicit name always wins, including an explicit "production" — somebody set it
    // because they know something this function does not.
    const isProduction = configured.toLowerCase() === "production";
    return {
      label: configured,
      tone: isProduction ? "outline" : "destructive",
    };
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
  if (/prod|api\.pymeshub/i.test(host))
    return { label: "Producción", tone: "outline" };
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

  /*
    The host is in a tooltip rather than a `title`.

    A `title` is the obvious choice and the wrong one on all three counts that matter here: it
    appears only on hover and only after a delay, it does not appear at all on keyboard focus,
    and screen readers do not reliably announce it. So the one piece of information this badge
    exists to add — *which API am I looking at* — was reachable by mouse only.

    This is the badge's whole case for existing. An operator handed a preview deployment needs to
    know before they touch anything, and a tooltip that opens on focus and is announced gets
    there; a `title` does not.

    Also migrated to Arc's `Badge` and its `tone`, which is what the console's other five status
    badges use. The `destructive` tone is the loud one and carries "this is not production"; the
    quiet `neutral` tone carries production, which is the case where the badge says nothing the
    operator did not already know.
  */
  return (
    <Tooltip content={`API: ${apiHost() ?? "sin host configurado"}`}>
      <Badge tone={environment.tone === "destructive" ? "danger" : "neutral"}>
        {environment.label}
      </Badge>
    </Tooltip>
  );
}
