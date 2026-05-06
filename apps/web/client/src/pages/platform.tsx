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
    <div className="dark relative min-h-screen overflow-hidden bg-background text-white">
      <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(42,60,180,0.08),transparent_36%)]" /><div className="animate-pulse-halo absolute -left-[23rem] top-[-3rem] h-[48rem] w-[48rem] rounded-full border border-[#F59E0B]/12" /></div>
      <main className="relative z-10">
        <nav className="flex items-center justify-between px-4 py-5 md:px-8">
          <Link href="/"><a><BrandLockup compact /></a></Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link href="/product"><a className="font-marketing text-sm font-medium text-white/78 hover:text-white"><ArrowLeft className="h-4 w-4 inline mr-1" />Producto</a></Link>
          </div>
        </nav>
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#F59E0B]/72">{copy.eyebrow}</p>
              <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl md:text-[5rem]">{copy.title}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70 md:text-lg">{copy.description}</p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[{ icon: ShieldCheck, title: "Roles y Permisos", desc: "OWNER, ADMIN, AGENT, VIEWER con visibilidad filtrada por departamento." },
                { icon: LockKeyhole, title: "Seguridad Multi-tenant", desc: "Cada workspace está aislado. Datos nunca se cruzan entre clientes." },
                { icon: Globe2, title: "Costa Rica + Internacional", desc: "Facturación electrónica CR, multidivisa, multi-idioma." },
                { icon: BookOpen, title: "Documentación Completa", desc: "Términos, privacidad, DPA, SLA y políticas públicas accesibles." },
                { icon: ShieldCheck, title: "Audit Logs", desc: "Registro completo de acciones por usuario, workspace y timestamp." },
                { icon: LockKeyhole, title: "SSO Empresarial", desc: "SAML 2.0 para Azure AD, Okta, PingOne. Sin contraseñas compartidas." }].map(({ icon: Icon, title, desc }) => (
                <article key={title} className="glass-panel rounded-[28px] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(245,158,11,0.12))] p-2 text-white/90"><Icon className="h-6 w-6" /></div>
                  <h3 className="font-marketing mt-7 text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#bcc5ee]/72">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-white text-center">Documentación relacionada</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/documentation/trust-center-overview", title: "Trust Center", desc: "Controles de seguridad, SLA y gobernanza para procurement." },
                { href: "/documentation/platform-overview", title: "Visión General", desc: "Arquitectura, componentes y modelo de responsabilidad." },
                { href: "/documentation/workspace-launch-guide", title: "Guía de Lanzamiento", desc: "Checklist paso a paso para activar tu workspace." },
                { href: "/documentation", title: "Centro de Docs", desc: "Toda la documentación técnica en un solo lugar." },
              ].map(({ href, title, desc }) => (
                <Link key={href} href={href}>
                  <a className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white group-hover:text-white/90">
                      {title}
                      <ExternalLink className="h-3.5 w-3.5 text-white/30" />
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-white/40">{desc}</p>
                  </a>
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
