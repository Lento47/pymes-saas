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
    <div className="dark relative min-h-screen overflow-hidden bg-background text-white">
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
            <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-white/85">
              {copy.eyebrow}
            </p>
            <h1 className="font-marketing mt-5 text-5xl font-extrabold leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl md:text-[5.4rem]">
              {copy.title}
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-white/85 md:text-xl">
              {copy.description}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/legal">
                <a className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/12 bg-indigo-900/20 px-6 py-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/[0.07]">
                  <ExternalLink className="h-4 w-4" />
                  {copy.openLegal}
                </a>
              </Link>
            </div>
          </section>

          <div className="mt-16 space-y-14">
            {categories.map((category) => {
              const categoryCopy = DOCUMENTATION_CATEGORIES[category];
              const docs = publicDocs.filter((entry) => entry.category === category);

              return (
                <section key={category}>
                  <div className="mb-6">
                    <h2 className="font-marketing text-lg font-semibold tracking-[-0.02em] text-white">
                      {categoryCopy.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-white/75 max-w-2xl">
                      {categoryCopy.description}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {docs.map((doc) => (
                      <Link key={doc.slug} href={`/documentation/${doc.slug}`}>
                        <a className="group flex flex-col rounded-xl border border-indigo-400/20 bg-indigo-900/10 p-5 transition-all duration-200 hover:border-indigo-400/40 hover:bg-indigo-900/20">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/50 group-hover:text-white/80 group-hover:bg-white/[0.1] transition-colors">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <span className="rounded-full border border-border/[0.8] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/70">
                              {copy.publicBadge}
                            </span>
                          </div>
                          <h3 className="font-marketing mt-4 text-base font-semibold tracking-[-0.01em] text-white group-hover:text-white/90">
                            {doc.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-white/75">
                            {doc.summary}
                          </p>
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
