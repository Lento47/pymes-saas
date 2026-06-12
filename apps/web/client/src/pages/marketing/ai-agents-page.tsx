import { useEffect } from "react";
import { Footer } from "@/components/marketing/footer";
import {
  MarketingShell,
  AgentConsole,
  AutomationRecipe,
  SectionLabel,
  FinalCta,
  ProductPageHero,
} from "@/components/marketing/marketing-site";
import { ScrambleText } from "@/components/marketing/scramble-text";
import { BLOCK_CHARS } from "@/hooks/use-scramble-text";
import { useI18n } from "@/components/providers/i18n-provider";
import { applySeoMetadata } from "@/lib/seo";

export default function AiAgentsPage() {
  const { messages } = useI18n();
  const t = messages.site.agents;
  const au = messages.site.automation;

  useEffect(() => {
    applySeoMetadata({
      canonicalPath: "/ai-agents",
      title: "PymesHub | " + t.page.title,
      description: t.page.subtitle,
    });
  }, [t]);

  return (
    <MarketingShell active="aiAgents">
      <ProductPageHero
        badge={t.page.badge}
        title={t.page.title}
        titleNode={
          <ScrambleText duration={2200} delay={150} chars={BLOCK_CHARS}>
            {t.page.title}
          </ScrambleText>
        }
        subtitle={t.page.subtitle}
      />
      <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <AgentConsole />
        </div>
      </section>
      <section className="border-t border-slate-200 bg-white px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>{au.eyebrow}</SectionLabel>
            <h2 className="text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">
              <ScrambleText duration={1800} delay={600} chars={BLOCK_CHARS}>
                {au.title}
              </ScrambleText>
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">{au.subtitle}</p>
          </div>
          <AutomationRecipe />
        </div>
      </section>
      <FinalCta />
      <Footer />
    </MarketingShell>
  );
}
