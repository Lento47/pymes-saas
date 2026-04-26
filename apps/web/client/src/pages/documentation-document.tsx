import { ArrowLeft, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getDocumentationBySlug } from "@/lib/documentation";

interface DocumentationDocumentPageProps {
  slug: string;
}

export default function DocumentationDocumentPage({
  slug,
}: DocumentationDocumentPageProps) {
  const { messages } = useI18n();
  const copy = messages.documentation;
  const doc = getDocumentationBySlug(slug);

  if (!doc || doc.visibility !== "public") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#05091d] px-4 py-6 text-white md:px-8">
        <div className="mx-auto max-w-5xl">
          <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
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
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[4rem] h-72 w-72 rounded-full bg-[#5870ff]/12 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[12rem] h-96 w-96 rounded-full bg-[#dfff4a]/10 blur-[150px]" />
      </div>

      <div className="relative z-10 px-4 pb-16 pt-6 md:px-8 md:pb-24">
        <div className="mx-auto max-w-5xl">
          <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
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

            <div className="glass-panel mt-8 rounded-[34px] px-7 py-8 md:px-10 md:py-10">
              <div className="flex items-start justify-between gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))] text-white/90">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-[#dfff4a]/28 bg-[#dfff4a]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#dfff4a]">
                  {copy.publicBadge}
                </span>
              </div>

              <h1 className="font-marketing mt-8 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                {doc.title}
              </h1>
              <p className="mt-4 text-base leading-8 text-[#c9d0f5]/72">
                {doc.summary}
              </p>

              <div className="mt-10 space-y-8">
                <section className="space-y-3">
                  <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-[#dfff4a]/72">
                    {copy.purpose}
                  </p>
                  <p className="text-sm leading-7 text-[#bcc5ee]/72">{doc.purpose}</p>
                </section>

                <section className="space-y-3">
                  <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-[#dfff4a]/72">
                    {copy.coverage}
                  </p>
                  <ul className="space-y-3">
                    {doc.highlights.map((item) => (
                      <li
                        key={item}
                        className="glass-panel-soft rounded-[22px] px-4 py-4 text-sm leading-7 text-[#bcc5ee]/74"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
