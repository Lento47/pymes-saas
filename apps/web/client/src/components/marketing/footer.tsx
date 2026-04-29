import { BookOpen, ExternalLink, FileText, Globe, Mail, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  { href: "/documentation/workspace-launch-guide", key: "quickStart" },
  { href: "/documentation/sla", key: "apiRef" },
  { href: "/documentation/trust-center-overview", key: "security" },
] as const;

const RESOURCES_LINKS = [
  { href: "/documentation/support-policy", key: "support" },
  { href: "/documentation/platform-overview", key: "platform" },
  { href: "/legal", key: "legalHub" },
] as const;

const COMPANY_LINKS = [
  { href: "/product", key: "about" },
  { href: "mailto:soporte@pymeshub.lat", key: "contact" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/terms-of-service", key: "terms" },
  { href: "/legal/privacy-policy", key: "privacy" },
  { href: "/legal/cookies-policy", key: "cookies" },
] as const;

export function Footer({ className }: { className?: string }) {
  const { messages } = useI18n();
  const f = messages.footer;

  return (
    <footer
      className={cn(
        "relative z-10 border-t border-white/[0.06] px-4 pb-8 pt-16 md:px-8 md:pb-12",
        className,
      )}
      style={{ background: "linear-gradient(180deg, rgba(5,9,29,0.4) 0%, rgba(5,9,29,0.96) 40%, #05091d 100%)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 — Producto */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              {f.colProduct}
            </h3>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-white/80 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2 — Recursos */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              {f.colDev}
            </h3>
            <ul className="mt-4 space-y-3">
              {RESOURCES_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-white/80 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Empresa */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              {f.colCompany}
            </h3>
            <ul className="mt-4 space-y-3">
              {COMPANY_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-white/80 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              {f.colLegal}
            </h3>
            <ul className="mt-4 space-y-3">
              {LEGAL_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <Link href={href}>
                    <a className="text-sm text-white/80 transition hover:text-white">
                      {f[key]}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-white/[0.05] pt-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLockup compact markClassName="h-6 w-6" textClassName="text-xs tracking-[0.18em]" />
          </div>

          <div className="flex items-center gap-2 text-xs text-white/60">
            <Mail className="h-3.5 w-3.5" />
            <span>soporte@pymeshub.lat</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/45">
            <ShieldCheck className="h-3.5 w-3.5 text-white/40" />
            <span>{f.compliance}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          &copy; 2026 PymeHub. {f.rights}.
        </p>
      </div>
    </footer>
  );
}
