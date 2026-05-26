import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, LockKeyhole, BookOpen, Globe2, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function PlatformPage() {
  const { messages } = useI18n();
  const copy = messages.landing?.menus?.platform || {} as any;

  return (
    <div className="marketing-light-theme relative min-h-screen overflow-hidden">
      {/* Aurora background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 h-[500px] w-[700px] rounded-full blur-[140px]"
          style={{ background: "radial-gradient(ellipse, rgba(167,139,250,0.18) 0%, transparent 70%)" }} />
        <div className="absolute top-0 -left-40 h-[400px] w-[600px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.10) 0%, transparent 70%)" }} />
      </div>

      <main className="relative z-10">
        <nav className="flex items-center justify-between px-4 py-5 md:px-8">
          <Link href="/"><BrandLockup compact /></Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link href="/product" className="font-marketing text-sm font-medium text-gray-600 transition hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 inline mr-1" />Producto
            </Link>
          </div>
        </nav>

        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="landing-eyebrow font-marketing">{copy.eyebrow}</p>
              <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] text-gray-900 sm:text-6xl md:text-[5rem]">{copy.title}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-gray-500 md:text-lg">{copy.description}</p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Roles y Permisos", desc: "OWNER, ADMIN, AGENT, VIEWER con visibilidad filtrada por departamento.", color: "bg-violet-50 text-violet-600" },
                { icon: LockKeyhole, title: "Seguridad Multi-tenant", desc: "Cada workspace está aislado. Datos nunca se cruzan entre clientes.", color: "bg-indigo-50 text-indigo-600" },
                { icon: Globe2, title: "Costa Rica + Internacional", desc: "Facturación electrónica CR, multidivisa, multi-idioma.", color: "bg-amber-50 text-amber-600" },
                { icon: BookOpen, title: "Documentación Completa", desc: "Términos, privacidad, DPA, SLA y políticas públicas accesibles.", color: "bg-violet-50 text-violet-600" },
                { icon: ShieldCheck, title: "Audit Logs", desc: "Registro completo de acciones por usuario, workspace y timestamp.", color: "bg-indigo-50 text-indigo-600" },
                { icon: LockKeyhole, title: "SSO Empresarial", desc: "SAML 2.0 para Azure AD, Okta, PingOne. Sin contraseñas compartidas.", color: "bg-amber-50 text-amber-600" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <article key={title} className="landing-card rounded-[28px] p-7">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl p-2 ${color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-marketing mt-7 text-2xl font-semibold tracking-[-0.03em] text-gray-900">{title}</h3>
                  <p className="mt-4 text-sm leading-7 text-gray-500">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-gray-900 text-center">Documentación relacionada</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/documentation/trust-center-overview", title: "Trust Center", desc: "Controles de seguridad, SLA y gobernanza para procurement." },
                { href: "/documentation/platform-overview", title: "Visión General", desc: "Arquitectura, componentes y modelo de responsabilidad." },
                { href: "/documentation/workspace-launch-guide", title: "Guía de Lanzamiento", desc: "Checklist paso a paso para activar tu workspace." },
                { href: "/documentation", title: "Centro de Docs", desc: "Toda la documentación técnica en un solo lugar." },
              ].map(({ href, title, desc }) => (
                <Link key={href} href={href} className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-violet-200 hover:shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 group-hover:text-violet-700">
                    {title}
                    <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-gray-500">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
