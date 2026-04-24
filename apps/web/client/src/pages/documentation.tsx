import { BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
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
              <Link href="/">
                <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                  {copy.back}
                </a>
              </Link>
              <Link href="/login">
                <a className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-4 py-3 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px] md:px-6">
                  {copy.openWorkspace}
                </a>
              </Link>
            </div>
          </nav>

          <section className="mx-auto max-w-4xl pt-16 text-center md:pt-20">
            <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
              {copy.eyebrow}
            </p>
            <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl md:text-[5.4rem]">
              {copy.title}
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-[#c9d0f5]/76 md:text-xl">
              {copy.description}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/legal">
                <a className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]">
                  <ExternalLink className="h-4 w-4" />
                  {copy.openLegal}
                </a>
              </Link>
            </div>
          </section>

          <div className="mt-16 space-y-10">
            {categories.map((category) => {
              const categoryCopy = DOCUMENTATION_CATEGORIES[category];
              const docs = publicDocs.filter((entry) => entry.category === category);

              return (
                <section key={category} className="space-y-4">
                  <div className="space-y-2">
                    <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em] text-white">
                      {categoryCopy.title}
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-[#bcc5ee]/68">
                      {categoryCopy.description}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {docs.map((doc) => (
                      <Link key={doc.slug} href={`/documentation/${doc.slug}`}>
                        <a className="glass-panel flex h-full flex-col rounded-[28px] p-6 transition hover:-translate-y-[2px] hover:border-white/16">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(108,126,255,0.28),rgba(232,255,89,0.12))] text-white/90">
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <span className="rounded-full border border-[#dfff4a]/28 bg-[#dfff4a]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#dfff4a]">
                              {copy.publicBadge}
                            </span>
                          </div>

                          <h3 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
                            {doc.title}
                          </h3>
                          <p className="mt-3 text-sm leading-7 text-[#bcc5ee]/70">
                            {doc.summary}
                          </p>

                          <div className="mt-auto pt-6 text-xs uppercase tracking-[0.2em] text-white/38">
                            {doc.repoPath}
                          </div>
                        </a>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
