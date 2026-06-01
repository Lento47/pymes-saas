import { useEffect } from "react";
import { Footer } from "@/components/marketing/footer";
import {
  MarketingShell,
  SecurityGrid,
  MessageFlow,
  FinalCta,
  ProductPageHero,
} from "@/components/marketing/marketing-site";
import { useI18n } from "@/components/providers/i18n-provider";
import { applySeoMetadata } from "@/lib/seo";

export default function SecurityPage() {
  const { messages } = useI18n();
  const t = messages.site.security;

  useEffect(() => {
    applySeoMetadata({
      canonicalPath: "/security",
      title: "PymesHub | " + t.page.title,
      description: t.page.subtitle,
    });
  }, [t]);

  return (
    <MarketingShell active="security">
      <ProductPageHero badge={t.page.badge} title={t.page.title} subtitle={t.page.subtitle} />
      <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <SecurityGrid />
        </div>
      </section>
      <MessageFlow />
      <FinalCta />
      <Footer />
    </MarketingShell>
  );
}
