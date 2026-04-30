import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Clock, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getDocumentationByCategory, getDocumentationBySlug } from "@/lib/documentation";
import { LEGAL_CONTENT } from "@/data/legal/legal-content";
import { cn } from "@/lib/utils";

interface LegalDocumentPageProps {
  slug?: string;
}

const LEGAL_SLUGS = [
  "terms-of-service",
  "privacy-policy",
  "data-processing-addendum",
  "acceptable-use-policy",
  "billing-refunds-policy",
  "subprocessors-notice",
  "whatsapp-ai-policy",
  "cookies-policy",
];

export function LegalCenterPage() {
  const { messages, locale } = useI18n();
  const copy = messages.legalCenter;
  const docs = getDocumentationByCategory("legal").filter((e) => e.visibility === "public");

  useEffect(() => {
    document.title = "PymeHub | " + copy.title;
  }, [locale, copy.title]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[4rem] h-72 w-72 rounded-full bg-[#5870ff]/12 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[12rem] h-96 w-96 rounded-full bg-[#dfff4a]/10 blur-[150px]" />
        <div className="marketing-grid absolute inset-x-0 bottom-0 h-[32rem] opacity-40" />
      </div>

      <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
            <BrandLockup compact />

            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/documentation">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.backToDocs}
                </a>
              </Link>
              <Link href="/">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.backToLanding}
                </a>
              </Link>
            </div>
          </nav>

          <section className="mx-auto max-w-4xl pt-16 text-center md:pt-20">
            <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
              {copy.eyebrow}
            </p>
            <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl md:text-[5rem]">
              {copy.title}
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-white/76 md:text-xl">
              {copy.description}
            </p>
          </section>

          {/* Two-column layout: sidebar TOC + content grid */}
          <div className="mx-auto mt-16 grid max-w-7xl gap-12 lg:grid-cols-[240px_1fr]">
            {/* Sticky sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-12">
                <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.2em] text-white/40 mb-4">
                  {copy.sidebarTitle}
                </h3>
                <nav className="space-y-1">
                  {docs.map((doc) => (
                    <Link key={doc.slug} href={`/legal/${doc.slug}`}>
                      <a className="block rounded-lg px-3 py-2 text-sm text-white/52 transition hover:bg-white/[0.04] hover:text-white/85">
                        {doc.title}
                      </a>
                    </Link>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main content area */}
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                {docs.map((doc) => (
                  <Link key={doc.slug} href={`/legal/${doc.slug}`}>
                    <a className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/50 group-hover:text-white/80 group-hover:bg-white/[0.1] transition-colors">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white group-hover:text-white/90">
                            {doc.title}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-white/40">
                            {doc.summary}
                          </p>
                        </div>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>

              <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 text-center">
                <Mail className="mx-auto h-5 w-5 text-white/30" />
                <p className="mt-3 text-sm text-white/50">
                  {copy.contactPrivacy}{" "}
                  <a href="mailto:privacidad@pymeshub.lat" className="text-[#dfff4a]/80 underline underline-offset-4 transition hover:text-[#dfff4a]">
                    privacidad@pymeshub.lat
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export function LegalDocumentPage({ slug }: LegalDocumentPageProps) {
  const { messages, locale } = useI18n();
  const copy = messages.legalCenter;
  const doc = slug ? getDocumentationBySlug(slug) : undefined;
  const legalDocs = getDocumentationByCategory("legal").filter((e) => e.visibility === "public");
  const [location] = useLocation();

  useEffect(() => {
    if (doc) {
      document.title = "PymeHub | " + doc.title;
    } else {
      document.title = "PymeHub | " + copy.notFoundTitle;
    }
  }, [locale, doc, copy.notFoundTitle]);

  if (!doc || doc.visibility !== "public") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10rem] top-[4rem] h-72 w-72 rounded-full bg-[#5870ff]/12 blur-[120px]" />
          <div className="absolute right-[-8rem] top-[12rem] h-96 w-96 rounded-full bg-[#dfff4a]/10 blur-[150px]" />
        </div>
        <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
              <BrandLockup compact />
              <div className="flex items-center gap-2 md:gap-4">
                <LanguageSwitcher variant="marketing" />
                <Link href="/legal">
                  <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                    {copy.backToLegal}
                  </a>
                </Link>
              </div>
            </nav>
            <div className="mx-auto max-w-3xl pt-20 text-center">
              <h1 className="font-marketing text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                {copy.notFoundTitle}
              </h1>
              <p className="mt-4 text-lg leading-7 text-white/60">
                {copy.notFoundDescription}
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const currentIndex = LEGAL_SLUGS.indexOf(slug ?? "");
  const prevDoc = currentIndex > 0 ? LEGAL_SLUGS[currentIndex - 1] : null;
  const nextDoc = currentIndex < LEGAL_SLUGS.length - 1 ? LEGAL_SLUGS[currentIndex + 1] : null;
  const markdown = slug ? LEGAL_CONTENT[slug] : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[4rem] h-72 w-72 rounded-full bg-[#5870ff]/12 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[12rem] h-96 w-96 rounded-full bg-[#dfff4a]/10 blur-[150px]" />
      </div>

      <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
            <BrandLockup compact />
            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher variant="marketing" />
              <Link href="/legal">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.backToLegal}
                </a>
              </Link>
              <Link href="/documentation">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.backToDocs}
                </a>
              </Link>
            </div>
          </nav>

          {/* Two-column layout */}
          <div className="mx-auto mt-12 grid max-w-7xl gap-12 lg:grid-cols-[240px_1fr]">
            {/* Sticky sidebar TOC */}
            <aside className="hidden lg:block">
              <div className="sticky top-12">
                <h3 className="font-marketing text-xs font-semibold uppercase tracking-[0.2em] text-white/40 mb-4">
                  {copy.sidebarTitle}
                </h3>
                <nav className="space-y-1">
                  {legalDocs.map((legalDoc) => {
                    const isActive = legalDoc.slug === slug;
                    return (
                      <Link key={legalDoc.slug} href={`/legal/${legalDoc.slug}`}>
                        <a
                          className={cn(
                            "block rounded-lg px-3 py-2 text-sm transition",
                            isActive
                              ? "bg-white/[0.06] text-[#dfff4a] font-medium"
                              : "text-white/48 hover:bg-white/[0.04] hover:text-white/80",
                          )}
                        >
                          {legalDoc.title}
                        </a>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Main content */}
            <div className="mx-auto w-full max-w-3xl">
              <Link href="/legal">
                <a className="font-marketing inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white">
                  <ArrowLeft className="h-4 w-4" />
                  {copy.backToLegal}
                </a>
              </Link>

              <article className="mt-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))]">
                        <ShieldCheck className="h-5 w-5 text-white/80" />
                      </div>
                      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">
                        {copy.publicBadge}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Markdown content */}
                {markdown ? (
                  <div className="mt-8 rounded-[28px] border border-white/[0.06] bg-white/[0.01] px-6 py-8 md:px-10 md:py-12">
                    <div className="
                      prose prose-sm md:prose-base
                      prose-headings:font-marketing prose-headings:tracking-[-0.02em] prose-headings:text-white
                      prose-h1:text-3xl prose-h1:font-bold prose-h1:mt-0 prose-h1:mb-6
                      prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/[0.06]
                      prose-h3:text-base prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3
                      prose-p:text-white/75 prose-p:leading-7
                      prose-a:text-[#dfff4a]/80 prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-[#dfff4a]
                      prose-strong:text-white/90 prose-strong:font-semibold
                      prose-ul:text-white/70 prose-ol:text-white/70
                      prose-li:my-1
                      prose-code:text-[#dfff4a]/70 prose-code:bg-white/[0.04] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                      prose-pre:bg-white/[0.02] prose-pre:border prose-pre:border-white/[0.06]
                      prose-table:text-white/70 prose-th:text-white/80 prose-th:font-semibold prose-td:border-white/[0.06] prose-th:border-white/[0.06]
                      prose-blockquote:border-l-[#dfff4a]/30 prose-blockquote:text-white/60
                      prose-hr:border-white/[0.06]
                      max-w-none
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {markdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 space-y-8">
                    <section>
                      <h2 className="font-marketing text-xs font-semibold uppercase tracking-[0.22em] text-[#dfff4a]/72">
                        {copy.purpose}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-white/68">{doc.purpose}</p>
                    </section>
                    <section>
                      <h2 className="font-marketing text-xs font-semibold uppercase tracking-[0.22em] text-[#dfff4a]/72">
                        {copy.coverage}
                      </h2>
                      <ul className="mt-3 space-y-3">
                        {doc.highlights.map((item, idx) => (
                          <li
                            key={item}
                            className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 py-3"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dfff4a]/10 text-[10px] font-semibold text-[#dfff4a]/70">
                              {idx + 1}
                            </span>
                            <span className="text-sm leading-6 text-white/74">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                )}

                {/* Previous / Next navigation */}
                <div className="mt-16 flex items-center justify-between border-t border-white/[0.05] pt-8">
                  {prevDoc ? (
                    <Link href={`/legal/${prevDoc}`}>
                      <a className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-white/80">
                        <ArrowLeft className="h-4 w-4" />
                        Anterior
                      </a>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {nextDoc ? (
                    <Link href={`/legal/${nextDoc}`}>
                      <a className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-white/80">
                        Siguiente
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </a>
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>

                <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 text-center">
                  <p className="text-sm text-white/45">
                    {copy.contactPrivacy}{" "}
                    <a href="mailto:privacidad@pymeshub.lat" className="text-[#dfff4a]/75 underline underline-offset-4 transition hover:text-[#dfff4a]">
                      privacidad@pymeshub.lat
                    </a>
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
