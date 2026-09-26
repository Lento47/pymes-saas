import { Instagram, Linkedin, ShieldCheck, Twitter, Youtube } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  { href: "/categories", key: "categories" },
  { href: "/search", key: "search" },
  { href: "/orders", key: "orders" },
  { href: "/favorites", key: "favorites" },
  { href: "/cart", key: "cart" },
  { href: "/product", key: "howItWorks" },
  { href: "/pricing", key: "pricing" },
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

// Los documentos legales del marketplace agregados en la fase de storefront
// van primero: son los que rigen pedidos y entregas.
const LEGAL_LINKS = [
  { href: "/legal/privacy-policy", key: "privacy" },
  { href: "/legal/terms-of-service", key: "terms" },
  { href: "https://status.pymeshub.com", key: "status" },
  { href: "/legal/trust-center-overview", key: "security" },
] as const;

// Extra legal/compliance links (hardcoded — no i18n key needed)
const COMPLIANCE_LINKS = [
  { href: "/legal/billing-refunds-policy", label: "Reembolsos" },
  { href: "/legal/cookies-policy",         label: "Política de Cookies" },
  { href: "/legal/data-processing-addendum", label: "Tratamiento de Datos" },
  { href: "/data-request",                 label: "Solicitud de Datos" },
  { href: "/accessibility",                label: "Accesibilidad" },
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
        "relative z-10 border-t border-white/10 bg-[#05091d] px-4 pb-8 pt-16 text-white md:px-8 md:pb-12",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          {/* Column 0 — Brand */}
          <div>
            <BrandLockup compact markClassName="h-7 w-7" textClassName="text-sm tracking-[0.18em]" />
            <p className="mt-4 text-sm leading-relaxed text-slate-400" style={{ maxWidth: "28ch" }}>
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
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-500 transition hover:border-white/25 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 1 — Producto */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {f.colProduct}
            </h3>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-slate-400 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2 — Soluciones */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {f.colSolutions}
            </h3>
            <ul className="mt-4 space-y-3">
              {SOLUTIONS_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-slate-400 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Empresa */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {f.colCompany}
            </h3>
            <ul className="mt-4 space-y-3">
              {COMPANY_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-slate-400 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Recursos */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {f.colResources}
            </h3>
            <ul className="mt-4 space-y-3">
              {RESOURCES_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-slate-400 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} PymesHub Inc. &middot; {f.builtIn} &middot; Costa Rica
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_LINKS.map(({ href, key }) => (
                <a key={key} href={href} className="text-xs text-slate-500 transition hover:text-slate-200">
                  {(f as any)[key]}
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {COMPLIANCE_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="text-xs text-slate-500 transition hover:text-slate-200">
                {label}
              </Link>
            ))}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}
              className="text-xs text-slate-500 transition hover:text-slate-200"
            >
              Preferencias de Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
