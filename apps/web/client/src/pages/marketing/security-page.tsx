import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";
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
import { Link } from "wouter";

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
    <MarketingShell>
      <ProductPageHero badge={t.page.badge} title={t.page.title} subtitle={t.page.subtitle} />
      <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <SecurityGrid />
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl justify-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/security/advisories"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-amber-400"
          >
            <ShieldCheck className="h-4 w-4" />
            {t.advisories.page.title}
          </Link>
        </div>
      </section>
      <MessageFlow />
      <FinalCta />
      <Footer />
    </MarketingShell>
  );
}
