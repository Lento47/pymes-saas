import { BookOpen, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import {
  DOCUMENTATION_CATEGORIES,
  DOCUMENTATION_ENTRIES,
  type DocumentationCategory,
} from "@/lib/documentation";

export default function DocumentationCenterPage() {
  const { messages } = useI18n();
  const copy = messages.documentation;
  const publicDocs = DOCUMENTATION_ENTRIES.filter((entry) => entry.visibility === "public");
  const categories = (Object.keys(DOCUMENTATION_CATEGORIES) as DocumentationCategory[]).filter(
    (category) => publicDocs.some((doc) => doc.category === category)
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">

      <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
        <div className="mx-auto max-w-7xl">
            <nav className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 md:px-7">
            <BrandLockup compact />

            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                {copy.back}
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 md:px-6">
                {copy.openWorkspace}
              </Link>
            </div>
          </nav>

          <section className="mx-auto max-w-4xl pt-16 text-center md:pt-20">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {copy.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-5xl md:text-6xl">
              {copy.title}
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {copy.description}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/legal" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/35">
                <ExternalLink className="h-4 w-4" />
                {copy.openLegal}
              </Link>
            </div>
          </section>

          <div className="mt-16 space-y-14">
            {categories.map((category) => {
              const categoryCopy = DOCUMENTATION_CATEGORIES[category];
              const docs = publicDocs.filter((entry) => entry.category === category);

              return (
                <section key={category}>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                      {categoryCopy.title}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {categoryCopy.description}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {docs.map((doc) => (
                      <Link key={doc.slug} href={`/documentation/${doc.slug}`} className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/35">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              {copy.publicBadge}
                            </span>
                          </div>
                          <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-foreground group-hover:text-foreground">
                            {doc.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {doc.summary}
                          </p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
            {/* Legal y Cumplimiento — bridge section */}
            <section className="mt-20 border-t border-border pt-16">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                    Legal y Cumplimiento
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Documentos legales que rigen el uso de la Plataforma en Costa Rica.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    href: "/legal/terms-of-service",
                    title: "Términos del Servicio",
                    desc: "Reglas de acceso, uso, licencia, pagos y responsabilidad contractual.",
                  },
                  {
                    href: "/legal/privacy-policy",
                    title: "Política de Privacidad",
                    desc: "Cómo protegemos los datos personales procesados en PymesHub.",
                  },
                  {
                    href: "/legal/cookies-policy",
                    title: "Política de Cookies",
                    desc: "Tipos de cookies, finalidad, duración y gestión del consentimiento.",
                  },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/35">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link href="/legal" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/35">
                  <ExternalLink className="h-4 w-4" />
                  Ver todos los documentos legales
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
