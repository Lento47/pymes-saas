import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, ExternalLink, FolderOpen, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DOCUMENTATION_CATEGORIES,
  DOCUMENTATION_ENTRIES,
} from "@/lib/documentation";

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? DOCUMENTATION_ENTRIES.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.summary.toLowerCase().includes(search.toLowerCase()) ||
          d.purpose.toLowerCase().includes(search.toLowerCase())
      )
    : DOCUMENTATION_ENTRIES;
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Ayuda y documentación"
        description="Centro de ayuda interno con enlaces a la documentación maestra de PymesHub."
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en documentación..."
          className="pl-9 h-10 bg-card border-border"
        />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-sky-500/20 bg-sky-500/10 p-2">
              <BookOpen className="h-4 w-4 text-sky-300" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Dónde se ve esta documentación en el producto
              </p>
              <p className="text-sm text-muted-foreground leading-6">
                Este centro agrupa los documentos maestros del repo y los
                accesos legales que deben estar visibles para clientes,
                soporte, privacidad y cumplimiento. Los documentos con badge
                <span className="mx-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
                  Público
                </span>
                son los que deberían exponerse al cliente o durante procesos de
                aceptación.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/legal">
              <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-[hsl(var(--elevated))] px-3 py-2 text-sm text-foreground hover:bg-white/5">
                <ExternalLink className="h-4 w-4 text-sky-300" />
                Centro legal público
              </div>
            </Link>
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <FolderOpen className="h-4 w-4" />
              Instalador Windows: requisito documentado, no implementado en este repo
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {search.trim() && filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No se encontraron documentos para "{search}"</p>
          </div>
        ) : (
          Object.entries(DOCUMENTATION_CATEGORIES).map(([key, category]) => {
            const docs = filtered.filter((entry) => entry.category === key);
            if (docs.length === 0) return null;

          return (
            <section key={key} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{category.title}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {docs.map((doc) => (
                  <Link key={doc.slug} href={`/help/${doc.slug}`}>
                    <div className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:bg-white/[0.03]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">{doc.summary}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            doc.visibility === "public"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                          }
                        >
                          {doc.visibility === "public" ? "Público" : "Interno"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{doc.audience}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
      </div>
    </div>
  );
}
