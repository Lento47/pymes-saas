import { useEffect } from "react";
import { Footer } from "@/components/marketing/footer";
import {
  MarketingShell,
  PlatformPillars,
  MessageFlow,
  FinalCta,
  ProductPageHero,
} from "@/components/marketing/marketing-site";
import { useI18n } from "@/components/providers/i18n-provider";
import { applySeoMetadata } from "@/lib/seo";

export default function PlatformPage() {
  const { messages } = useI18n();
  const t = messages.site.platform;

  useEffect(() => {
    applySeoMetadata({
      canonicalPath: "/platform",
      title: "PymesHub | " + t.page.title,
      description: t.page.subtitle,
    });
  }, [t]);

  return (
    <MarketingShell active="platform">
      <ProductPageHero badge={t.page.badge} title={t.page.title} subtitle={t.page.subtitle} />
      <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <PlatformPillars />
        </div>
      </section>
      <MessageFlow />
      <FinalCta />
      <Footer />
    </MarketingShell>
  );
}
