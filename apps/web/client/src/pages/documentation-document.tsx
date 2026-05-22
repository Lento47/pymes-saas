import { useEffect } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getDocumentationBySlug } from "@/lib/documentation";
import { DOCS_CONTENT } from "@/data/docs/docs-content";

/**
 * GitHub-style heading slug. Lowercases, strips diacritics, replaces
 * spaces with dashes, drops anything non-alphanumeric. So
 * "5.1 WhatsApp" → "51-whatsapp"; "5.2 Correo electrónico" → "52-correo-electronico".
 */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, " ") // non-alphanumeric → space (so em-dash, period collapse)
    .trim()
    .replace(/\s+/g, "-");
}

function extractText(node: Record<string, any>): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node?.props?.children) return extractText(node.props.children);
  return "";
}

interface DocumentationDocumentPageProps {
  slug: string;
}

export default function DocumentationDocumentPage({
  slug,
}: DocumentationDocumentPageProps) {
  const { messages } = useI18n();
  const copy = messages.documentation;
  const doc = getDocumentationBySlug(slug);
  const markdown = DOCS_CONTENT[slug] ?? "";

  // After the markdown finishes rendering, jump to the hash target
  // (e.g. /documentation/workspace-launch-guide#51-whatsapp). The browser
  // can't do this on its own because the heading IDs only exist once
  // ReactMarkdown has rendered the content.
  useEffect(() => {
    if (!markdown) return;
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const t = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [slug, markdown]);

  if (!doc || doc.visibility !== "public") {
    return (
      <>
        <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6 text-foreground md:px-8">
          <div className="mx-auto max-w-5xl">
          <nav className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 md:px-7">
            <BrandLockup compact />
            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/documentation" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                {copy.notFoundBack}
              </Link>
            </div>
          </nav>

          <div className="mx-auto max-w-3xl pt-20 text-center">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-5xl">
              {copy.notFoundTitle}
            </h1>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

return (
  <div className="relative min-h-screen overflow-hidden bg-background text-foreground">

    <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 md:px-7">
            <BrandLockup compact />

            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/documentation" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                {copy.notFoundBack}
              </Link>
            </div>
          </nav>

          <div className="mx-auto max-w-4xl pt-16 md:pt-20">
            <Link href="/documentation" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {copy.notFoundBack}
            </Link>

            <div className="rounded-lg border border-border bg-card px-7 py-8 md:px-10 md:py-10">
              <div className="flex items-start justify-between gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="rounded-md border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {copy.publicBadge}
                </span>
              </div>

              {markdown ? (
                <div className="mt-8
                  prose prose-sm md:prose-base
                  prose-headings:tracking-[-0.02em] prose-headings:text-foreground
                  prose-h1:text-3xl prose-h1:font-bold prose-h1:mt-0 prose-h1:mb-6
                  prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
                  prose-h3:text-base prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-muted-foreground prose-p:leading-7
                  prose-a:text-primary prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-primary/80
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-ul:text-muted-foreground prose-ol:text-muted-foreground
                  prose-li:my-1
                  prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                  prose-pre:bg-background prose-pre:border prose-pre:border-border
                  prose-table:text-muted-foreground prose-th:text-foreground prose-th:font-semibold prose-td:border-border prose-th:border-border
                  prose-blockquote:border-l-border prose-blockquote:text-muted-foreground
                  prose-hr:border-white/[0.06]
                  max-w-none
                ">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h2: ({ children, ...props }: Record<string, any>) => (
                        <h2 id={slugifyHeading(extractText(children))} {...props}>{children}</h2>
                      ),
                      h3: ({ children, ...props }: Record<string, any>) => (
                        <h3 id={slugifyHeading(extractText(children))} {...props}>{children}</h3>
                      ),
                    }}
                  >
                    {markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="mt-10 space-y-8">
                  <section className="space-y-3">
                    <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-[#F59E0B]/72">
                      {copy.purpose}
                    </p>
                    <p className="text-sm leading-7 text-[#bcc5ee]/72">{doc.purpose}</p>
                  </section>

                  <section className="space-y-3">
                    <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-[#F59E0B]/72">
                      {copy.coverage}
                    </p>
                    <ul className="space-y-3">
                      {doc.highlights.map((item) => (
                        <li
                          key={item}
                          className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/70"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
