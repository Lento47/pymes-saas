import { useEffect } from "react";
import { Footer } from "@/components/marketing/footer";
import {
  MarketingShell,
  BillingFlow,
  AutomationRecipe,
  SectionLabel,
  FinalCta,
  ProductPageHero,
} from "@/components/marketing/marketing-site";
import { useI18n } from "@/components/providers/i18n-provider";
import { applySeoMetadata } from "@/lib/seo";

export default function BillingPage() {
  const { messages } = useI18n();
  const t = messages.site.billing;
  const au = messages.site.automation;

  useEffect(() => {
    applySeoMetadata({
      canonicalPath: "/billing-workflows",
      title: "PymesHub | " + t.page.title,
      description: t.page.subtitle,
    });
  }, [t]);

  return (
    <MarketingShell active="billing">
      <ProductPageHero badge={t.page.badge} title={t.page.title} subtitle={t.page.subtitle} />
      <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>{t.eyebrow}</SectionLabel>
            <h2 className="text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">{t.subtitle}</p>
          </div>
          <BillingFlow />
        </div>
      </section>
      <section className="border-t border-slate-200 bg-white px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>{au.eyebrow}</SectionLabel>
            <h2 className="text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">
              {au.title}
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
