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

  if (!doc || doc.visibility !== "public") {
    return (
      <>
        <div className="relative min-h-screen overflow-hidden bg-[#05091d] px-4 py-6 text-white md:px-8">
          <div className="mx-auto max-w-5xl">
          <nav className="flex items-center justify-between rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-4 md:px-7">
            <BrandLockup compact />
            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/documentation">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.notFoundBack}
                </a>
              </Link>
            </div>
          </nav>

          <div className="mx-auto max-w-3xl pt-20 text-center">
            <h1 className="font-marketing text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
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
  <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-[-10rem] top-[4rem] h-72 w-72 rounded-full bg-[#5870ff]/12 blur-[120px]" />
      <div className="absolute right-[-8rem] top-[12rem] h-96 w-96 rounded-full bg-[#F59E0B]/10 blur-[150px]" />
    </div>

    <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-4 md:px-7">
            <BrandLockup compact />

            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/documentation">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.notFoundBack}
                </a>
              </Link>
            </div>
          </nav>

          <div className="mx-auto max-w-4xl pt-16 md:pt-20">
            <Link href="/documentation">
              <a className="font-marketing inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                {copy.notFoundBack}
              </a>
            </Link>

            <div className="rounded-[34px] border border-white/[0.08] bg-white/[0.04] px-7 py-8 md:px-10 md:py-10">
              <div className="flex items-start justify-between gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))] text-white/90">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-[#F59E0B]/28 bg-[#F59E0B]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#F59E0B]">
                  {copy.publicBadge}
                </span>
              </div>

              {markdown ? (
                <div className="mt-8
                  prose prose-sm md:prose-base
                  prose-headings:font-marketing prose-headings:tracking-[-0.02em] prose-headings:text-white
                  prose-h1:text-3xl prose-h1:font-bold prose-h1:mt-0 prose-h1:mb-6
                  prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/[0.06]
                  prose-h3:text-base prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-white/75 prose-p:leading-7
                  prose-a:text-[#F59E0B]/80 prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-[#F59E0B]
                  prose-strong:text-white/90 prose-strong:font-semibold
                  prose-ul:text-white/70 prose-ol:text-white/70
                  prose-li:my-1
                  prose-code:text-[#F59E0B]/70 prose-code:bg-white/[0.04] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                  prose-pre:bg-white/[0.02] prose-pre:border prose-pre:border-white/[0.06]
                  prose-table:text-white/70 prose-th:text-white/80 prose-th:font-semibold prose-td:border-white/[0.06] prose-th:border-white/[0.06]
                  prose-blockquote:border-l-[#F59E0B]/30 prose-blockquote:text-white/65
                  prose-hr:border-white/[0.06]
                  max-w-none
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
