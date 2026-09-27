import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/marketing/footer";
import { ScrambleText } from "@/components/marketing/scramble-text";
import { BLOCK_CHARS } from "@/hooks/use-scramble-text";
import {
  AgentConsole,
  AutomationRecipe,
  Badge,
  BillingFlow,
  FaqSection,
  FinalCta,
  MarketingHeader,
  MessageFlow,
  PlatformPillars,
  ProductMockup,
  SecurityGrid,
  SectionLabel,
  useMarketingPage,
} from "@/components/marketing/marketing-site";
import { useI18n } from "@/components/providers/i18n-provider";
import { applySeoMetadata, buildSoftwareSchema } from "@/lib/seo";

export function PymesHubPlatformLanding() {
  const { messages } = useI18n();
  const t = messages.site;

  useMarketingPage();

  useEffect(() => {
    const description = t.hero.subtitle;
    applySeoMetadata({
      canonicalPath: "/",
      description,
      title: "PymesHub | " + t.hero.title,
      jsonLd: buildSoftwareSchema("/", "PymesHub", description),
    });
  }, [t]);

  return (
    <div className="marketplace-theme min-h-dvh overflow-hidden bg-[#05091d] text-white">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-36 lg:px-8">
          <div className="absolute inset-x-0 top-0 -z-10 h-[700px] bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.10),transparent_58%)]" />
          <div className="mx-auto max-w-7xl text-center">
            <div className="mb-7 flex justify-center">
              <Badge tone="primary">{t.hero.badge}</Badge>
            </div>
            <h1 className="mx-auto max-w-5xl text-balance text-5xl font-semibold tracking-[-0.07em] text-white sm:text-7xl lg:text-[88px] lg:leading-[0.92]">
              {t.hero.title}
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-balance text-lg leading-8 text-slate-400 sm:text-xl">
              {t.hero.subtitle}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/categories"
                className="group inline-flex h-12 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-[#05091d] hover:bg-amber-400"
              >
                {t.cta.startFree} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t.cta.viewDemo}
              </Link>
            </div>
          </div>
          <div className="mx-auto mt-14 max-w-7xl">
            <ProductMockup />
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-y border-white/10 bg-white/[0.02] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="text-sm font-medium text-slate-400">{t.trust.text}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge>{t.trust.chips.isolation}</Badge>
              <Badge>{t.trust.chips.guardrails}</Badge>
              <Badge>{t.trust.chips.audit}</Badge>
              <Badge>{t.trust.chips.review}</Badge>
            </div>
          </div>
        </section>

        {/* Platform */}
        <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <SectionLabel>{t.platform.eyebrow}</SectionLabel>
              <h2 className="text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                {t.platform.title}
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-400">{t.platform.subtitle}</p>
            </div>
            <div className="mt-12">
              <PlatformPillars />
            </div>
          </div>
        </section>

        {/* Message to action */}
        <MessageFlow />

        {/* AI Agents */}
        <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <SectionLabel>{t.agents.eyebrow}</SectionLabel>
              <h2 className="text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                {/* Scramble #3: "prepares" — strong verb that reinforces
                      the controlled-AI value prop without overwhelming. */}
                  {t.agents.title.split(/(prepares)/i).map((part, i) =>
                    /prepares/i.test(part) ? (
                      <ScrambleText key={i} duration={900} delay={2400} chars={BLOCK_CHARS}>
                        {part}
                      </ScrambleText>
                    ) : (
                      <span key={i}>{part}</span>
                    ),
                  )}
                </h2>
              </div>
              <p className="text-lg leading-8 text-slate-400">
                {/* Scramble #2: "classify" — first AI action verb, reinforces
                    the intelligent-processing value prop in the agents section. */}
                {t.agents.subtitle.split(/(classify)/i).map((part, i) =>
                  /classify/i.test(part) ? (
                    <ScrambleText key={i} duration={900} delay={1800} chars={BLOCK_CHARS}>
                      {part}
                    </ScrambleText>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
            </div>
            <AgentConsole />
          </div>
        </section>

        {/* Billing */}
        <section className="border-y border-white/10 bg-white/[0.02] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionLabel>{t.billing.eyebrow}</SectionLabel>
              <h2 className="text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                {t.billing.title}
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-400">{t.billing.subtitle}</p>
            </div>
            <BillingFlow />
          </div>
        </section>

        {/* Automation */}
        <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionLabel>{t.automation.eyebrow}</SectionLabel>
              <h2 className="text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                {t.automation.title}
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-400">{t.automation.subtitle}</p>
            </div>
            <AutomationRecipe />
          </div>
        </section>

        {/* Security */}
        <section className="bg-white/[0.02] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-3xl">
              <SectionLabel>{t.security.eyebrow}</SectionLabel>
              <h2 className="text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                {t.security.title}
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-400">{t.security.subtitle}</p>
            </div>
            <SecurityGrid />
          </div>
        </section>

        {/* FAQ */}
        <FaqSection />

        {/* Final CTA */}
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
