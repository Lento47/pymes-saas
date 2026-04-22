import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getDocumentationBySlug } from "@/lib/documentation";

interface HelpDocumentPageProps {
  slug: string;
}

export default function HelpDocumentPage({ slug }: HelpDocumentPageProps) {
  const doc = getDocumentationBySlug(slug);

  if (!doc) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Documento no encontrado" />
        <Link href="/help">
          <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" />
            Volver a ayuda
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={doc.title}
        description={doc.summary}
      >
        <Link href="/help">
          <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </div>
        </Link>
      </PageHeader>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                doc.visibility === "public"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-500/30 bg-slate-500/10 text-slate-300"
              }
            >
              {doc.visibility === "public" ? "Documento público" : "Documento interno"}
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
            <p className="text-sm font-medium text-foreground">Qué cubre este documento</p>
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
              Fuente maestra en el repositorio
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Ruta fuente: <span className="font-mono text-foreground">{doc.repoPath}</span>
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Esta pantalla funciona como punto de acceso dentro del producto. La versión maestra y mantenible del
              contenido vive en el paquete documental del repositorio.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
