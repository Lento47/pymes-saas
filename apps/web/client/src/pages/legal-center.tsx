import { Link } from "wouter";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDocumentationByCategory, getDocumentationBySlug } from "@/lib/documentation";

interface LegalDocumentPageProps {
  slug?: string;
}

export function LegalCenterPage() {
  const docs = getDocumentationByCategory("legal").filter(e => e.visibility === "public");

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2">
              <ShieldCheck className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Centro legal de PyMesHub</h1>
              <p className="text-sm leading-6 text-[#d3dafb]/76">
                Documentos públicos para revisar condiciones, privacidad, uso aceptable y tratamiento de datos antes de solicitar acceso.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/login">
              <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/12 bg-card px-3 py-2 text-sm text-foreground transition hover:bg-white/[0.06]">
                <ArrowLeft className="h-4 w-4" />
                Volver a login
              </div>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => (
            <Link key={doc.slug} href={`/legal/${doc.slug}`}>
              <div className="group h-full cursor-pointer rounded-xl border border-white/12 bg-[hsl(var(--card))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-all duration-200 hover:border-white/20 hover:bg-[hsl(var(--elevated))]">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-200 transition-colors group-hover:bg-sky-500/16 group-hover:text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{doc.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#d3dafb]/72">{doc.summary}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LegalDocumentPage({ slug }: LegalDocumentPageProps) {
  const doc = slug ? getDocumentationBySlug(slug) : undefined;

  if (!doc || doc.visibility !== "public") {
    return (
      <div className="min-h-screen bg-[hsl(var(--bg))] px-6 py-10 text-foreground">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-2xl font-semibold text-white">Documento no disponible</h1>
          <Link href="/legal">
            <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/12 bg-card px-3 py-2 text-sm text-foreground transition hover:bg-white/[0.06]">
              <ArrowLeft className="h-4 w-4" />
              Volver al centro legal
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Link href="/legal">
            <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/12 bg-card px-3 py-2 text-sm text-foreground transition hover:bg-white/[0.06]">
              <ArrowLeft className="h-4 w-4" />
              Volver al centro legal
            </div>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">{doc.title}</h1>
            <p className="mt-2 text-sm leading-6 text-[#d3dafb]/76">{doc.summary}</p>
          </div>
        </div>

        <Card className="border-white/12 bg-card shadow-[0_22px_70px_rgba(0,0,0,0.26)]">
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                Documento público
              </Badge>
              <Badge variant="outline" className="border-border bg-[hsl(var(--elevated))] text-foreground">
                {doc.audience}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Propósito</p>
              <p className="text-sm leading-6 text-[#d3dafb]/76">{doc.purpose}</p>
            </div>

            {!doc.sections && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Cobertura principal</p>
                <ul className="space-y-2 text-sm text-[#d3dafb]/76">
                {doc.highlights.map((item) => (
                  <li key={item} className="rounded-lg border border-white/10 bg-[hsl(var(--elevated))] px-3 py-2">
                    {item}
                  </li>
                ))}
                </ul>
              </div>
            )}

            {doc.sections && (
              <div className="space-y-8">
                {doc.sections.map((section) => (
                  <section key={section.title} className="space-y-3 border-t border-white/10 pt-6 first:border-t-0 first:pt-0">
                    <h2 className="text-base font-semibold tracking-tight text-white">{section.title}</h2>
                    <div className="space-y-3">
                      {section.body.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-7 text-[#d3dafb]/80">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
