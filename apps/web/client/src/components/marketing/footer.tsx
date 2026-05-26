import { Instagram, Linkedin, ShieldCheck, Twitter, Youtube } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  { href: "/inbox", key: "inboxUnified" },
  { href: "/crm", key: "crm" },
  { href: "/tasks", key: "tasks" },
  { href: "/documents", key: "documents" },
  { href: "/billing", key: "billing" },
  { href: "/automations", key: "automations" },
  { href: "/analytics", key: "analytics" },
] as const;

const SOLUTIONS_LINKS = [
  { href: "/solutions/small-teams", key: "smallTeams" },
  { href: "/solutions/retail", key: "retail" },
  { href: "/solutions/services", key: "services" },
  { href: "/solutions/agencies", key: "agencies" },
  { href: "/solutions/ecommerce", key: "ecommerce" },
] as const;

const COMPANY_LINKS = [
  { href: "/about", key: "about" },
  { href: "/customers", key: "clients" },
  { href: "/careers", key: "careers" },
  { href: "/press", key: "press" },
  { href: "mailto:hola@pymeshub.com", key: "contact" },
] as const;

const RESOURCES_LINKS = [
  { href: "/blog", key: "blog" },
  { href: "/customers", key: "successCases" },
  { href: "/documentation", key: "helpCenter" },
  { href: "/community", key: "community" },
  { href: "/changelog", key: "changelog" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/privacy-policy", key: "privacy" },
  { href: "/legal/terms-of-service", key: "terms" },
  { href: "https://status.pymeshub.com", key: "status" },
  { href: "/legal/trust-center-overview", key: "security" },
] as const;

const SOCIAL_LINKS = [
  { href: "https://x.com/pymeshub", Icon: Twitter, label: "X" },
  { href: "https://linkedin.com/company/pymeshub", Icon: Linkedin, label: "LinkedIn" },
  { href: "https://instagram.com/pymeshub", Icon: Instagram, label: "Instagram" },
  { href: "https://youtube.com/@pymeshub", Icon: Youtube, label: "YouTube" },
] as const;

export function Footer({ className }: { className?: string }) {
  const { messages } = useI18n();
  const f = messages.footer;

  return (
    <footer
      className={cn(
        "relative z-10 border-t border-gray-200 bg-gray-50 px-4 pb-8 pt-16 md:px-8 md:pb-12",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          {/* Column 0 — Brand */}
          <div>
            <BrandLockup compact markClassName="h-7 w-7" textClassName="text-sm tracking-[0.18em]" />
            <p className="mt-4 text-sm leading-relaxed text-gray-500" style={{ maxWidth: "28ch" }}>
              {f.tagline}
            </p>
            <div className="mt-5 flex gap-3">
              {SOCIAL_LINKS.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition hover:border-gray-300 hover:text-gray-700"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 1 — Producto */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              {f.colProduct}
            </h3>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-gray-500 transition hover:text-gray-900">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2 — Soluciones */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              {f.colSolutions}
            </h3>
            <ul className="mt-4 space-y-3">
              {SOLUTIONS_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-gray-500 transition hover:text-gray-900">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Empresa */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              {f.colCompany}
            </h3>
            <ul className="mt-4 space-y-3">
              {COMPANY_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-gray-500 transition hover:text-gray-900">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Recursos */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              {f.colResources}
            </h3>
            <ul className="mt-4 space-y-3">
              {RESOURCES_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-gray-500 transition hover:text-gray-900">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-8">
          <p className="text-xs text-gray-400">
            &copy; 2025 PymesHub Inc. &middot; {f.builtIn}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map(({ href, key }) => (
              <a
                key={key}
                href={href}
                className="text-xs text-gray-400 transition hover:text-gray-700"
              >
                {f[key]}
              </a>
            ))}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}
              className="text-xs text-gray-400 transition hover:text-gray-700"
            >
              Preferencias de cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
