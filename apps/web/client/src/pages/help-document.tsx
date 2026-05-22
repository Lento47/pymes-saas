import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getDocumentationBySlug } from "@/lib/documentation";
import { DOCS_CONTENT } from "@/data/docs/docs-content";
import { LEGAL_CONTENT } from "@/data/legal/legal-content";

interface HelpDocumentPageProps {
  slug: string;
}

export default function HelpDocumentPage({ slug }: HelpDocumentPageProps) {
  const doc = getDocumentationBySlug(slug);
  const markdown = DOCS_CONTENT[slug] ?? LEGAL_CONTENT[slug] ?? "";

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

          {markdown ? (
            <div className="
              prose prose-sm
              prose-headings:font-marketing prose-headings:tracking-[-0.02em] prose-headings:text-foreground
              prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-0 prose-h1:mb-4
              prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
              prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-muted-foreground prose-p:leading-7
              prose-a:text-primary prose-a:underline prose-a:underline-offset-4
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-muted-foreground prose-ol:text-muted-foreground
              prose-li:my-1
              prose-code:text-accent prose-code:bg-[hsl(var(--elevated))] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-pre:bg-[hsl(var(--elevated))] prose-pre:border prose-pre:border-border
              prose-table:text-muted-foreground prose-th:text-foreground prose-th:font-semibold prose-td:border-border prose-th:border-border
              prose-blockquote:border-l-border prose-blockquote:text-muted-foreground
              prose-hr:border-border
              max-w-none
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
