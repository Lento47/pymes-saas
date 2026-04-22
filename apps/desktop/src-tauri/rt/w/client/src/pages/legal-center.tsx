import { Link } from "wouter";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicDocumentation, getDocumentationBySlug } from "@/lib/documentation";

interface LegalDocumentPageProps {
  slug?: string;
}

export function LegalCenterPage() {
  const docs = getPublicDocumentation();

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2">
              <ShieldCheck className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Centro legal de PymeHub</h1>
              <p className="text-sm text-muted-foreground">
                Acceso rápido a los documentos externos y operativos que deben estar visibles para clientes.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/login">
              <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-foreground hover:bg-white/5">
                <ArrowLeft className="h-4 w-4" />
                Volver a login
              </div>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => (
            <Link key={doc.slug} href={`/legal/${doc.slug}`}>
              <div className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.summary}</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    Público
                  </Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{doc.repoPath}</div>
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
      <div className="min-h-screen bg-[hsl(var(--bg))] px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-2xl font-semibold text-white">Documento no disponible</h1>
          <Link href="/legal">
            <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" />
              Volver al centro legal
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <Link href="/legal">
            <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" />
              Volver al centro legal
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{doc.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{doc.summary}</p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-5">
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
              <p className="text-sm leading-6 text-muted-foreground">{doc.purpose}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Cobertura principal</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {doc.highlights.map((item) => (
                  <li key={item} className="rounded-lg border border-border bg-[hsl(var(--elevated))] px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ExternalLink className="h-4 w-4 text-sky-300" />
                Fuente maestra
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Ruta fuente en el paquete documental:{" "}
                <span className="font-mono text-foreground">{doc.repoPath}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
