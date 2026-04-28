import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, LockKeyhole, FileText, Globe2, Server, Key } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function SecurityPage() {
  const { messages } = useI18n();
  const copy = messages.landing?.menus?.security || {} as any;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white">
      <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(42,60,180,0.08),transparent_36%)]" /></div>
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
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">{copy.eyebrow || "Trust & Compliance"}</p>
              <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] sm:text-6xl md:text-[5rem]">{copy.title || "Security is not a feature. It is the foundation."}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#c9d0f5]/70 md:text-lg">{copy.description || "Multi-tenant isolation, audit logs, SSO, encryption, DPA and more."}</p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-2">
              {[{ icon: LockKeyhole, title: "Aislamiento Multi-tenant", desc: "Cada workspace tiene datos aislados a nivel de base de datos. El acceso cruzado es imposible por diseño." },
                { icon: ShieldCheck, title: "Cifrado", desc: "Datos en tránsito con TLS 1.3. Datos en reposo cifrados. Secretos encriptados con AES-256-GCM." },
                { icon: FileText, title: "DPA y Cumplimiento", desc: "Data Processing Addendum compatible con Ley 8968 de Costa Rica. Subencargados documentados públicamente." },
                { icon: Key, title: "SSO Empresarial", desc: "SAML 2.0 Service Provider. Conectá Azure AD, Okta, PingOne o cualquier IdP compatible." },
                { icon: Server, title: "Backups y DR", desc: "Backups diarios con retención por plan. Restauración bajo demanda. Réplicas en standby." },
                { icon: Globe2, title: "Auditoría y Logs", desc: "Cada acción queda registrada: quién, qué, cuándo y desde dónde. API de auditoría disponible." }].map(({ icon: Icon, title, desc }) => (
                <article key={title} className="glass-panel rounded-[28px] p-7 flex gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))] p-2 text-white/90"><Icon className="h-6 w-6" /></div>
                  <div><h3 className="font-marketing text-xl font-semibold tracking-[-0.03em]">{title}</h3><p className="mt-3 text-sm leading-7 text-[#bcc5ee]/72">{desc}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
