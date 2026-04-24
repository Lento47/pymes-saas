import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingCard } from "@/components/pricing/pricing-card";
import { FAQ } from "@/components/pricing/faq";
import { PRICING_TIERS, FAQS } from "@/data/pricing.data";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const { isAuthenticated } = useAuth();
  const { messages } = useI18n();
  const copy = messages.pricing || {};

  const handleUpgrade = (plan: string) => {
    if (!isAuthenticated) {
      window.location.href = "/login?redirect=/billing";
    } else {
      window.location.href = "/settings/billing";
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,29,0.04)_0%,rgba(5,9,29,0.06)_22%,rgba(5,9,29,0.18)_44%,rgba(5,9,29,0.42)_64%,#05091d_86%)]" />
        <div className="animate-drift-x absolute left-[-10rem] top-[8rem] h-80 w-80 rounded-full bg-[#5771ff]/16 blur-[110px]" />
        <div className="animate-pulse-halo absolute bottom-[-6rem] right-[-5rem] h-96 w-96 rounded-full bg-[#d5ff63]/12 blur-[130px]" />
      </div>

      <main className="relative z-10">
        {/* Navigation */}
        <section className="px-4 pb-8 pt-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <nav className="glass-panel luminous-border flex items-center justify-between rounded-full px-5 py-4 md:px-7">
              <Link href="/">
                <a>
                  <BrandLockup compact />
                </a>
              </Link>
              <div className="flex items-center gap-4">
                <LanguageSwitcher variant="marketing" />
                <Link href="/login">
                  <a className="font-marketing text-sm font-medium text-white/78 transition hover:text-white">
                    {copy.nav?.logIn || "Log In"}
                  </a>
                </Link>
                <Link href="/login">
                  <a className="glow-button font-marketing inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-3 py-2 text-xs font-semibold text-[#071126] transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                    {copy.nav?.getStarted || "Get Started"}
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </a>
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {/* Hero Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-marketing text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl">
              {copy.hero?.title || "Simple, Transparent Pricing"}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 md:text-xl">
              {copy.hero?.subtitle ||
                "Choose the plan that fits your business. Scale as you grow."}
            </p>

            {/* Billing Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={cn(isAnnual ? "text-white/60" : "text-white")}>
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={cn(
                  "relative inline-flex h-8 w-14 items-center rounded-full transition-colors",
                  isAnnual
                    ? "bg-[#dfff4a]"
                    : "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 transform rounded-full bg-white transition-transform",
                    isAnnual ? "translate-x-7" : "translate-x-0.5"
                  )}
                />
              </button>
              <span className={cn(isAnnual ? "text-white" : "text-white/60")}>
                Annual
              </span>
              {isAnnual && (
                <span className="ml-2 inline-block rounded-full bg-[#dfff4a]/20 px-3 py-1 text-xs font-semibold text-[#dfff4a]">
                  Save 15%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-4">
              {PRICING_TIERS.map((tier) => (
                <PricingCard
                  key={tier.plan}
                  tier={tier}
                  isAnnual={isAnnual}
                  onUpgrade={handleUpgrade}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Features Comparison */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="font-marketing text-4xl font-bold tracking-[-0.04em] text-white">
                {copy.comparison?.title || "Compare All Features"}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/70">
                {copy.comparison?.subtitle ||
                  "See what features are included in each plan"}
              </p>
            </div>

            <div className="mt-16 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                      Feature
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.plan}
                        className="px-6 py-4 text-center text-sm font-semibold text-white"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {[
                    { label: "Team Members", key: "users" },
                    { label: "Contacts", key: "contacts" },
                    { label: "Invoices/Month", key: "invoicesPerMonth" },
                    { label: "Automations", key: "automations" },
                    { label: "Storage", key: "storageGB" },
                  ].map((row) => (
                    <tr key={row.key} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4 text-sm text-white/80">{row.label}</td>
                      {PRICING_TIERS.map((tier) => (
                        <td key={tier.plan} className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            {row.key === "users" && (
                              <span className="font-semibold text-white">
                                {tier.limits.users}
                              </span>
                            )}
                            {row.key === "contacts" && (
                              <span className="font-semibold text-white">
                                {tier.limits.contacts.toLocaleString()}
                              </span>
                            )}
                            {row.key === "invoicesPerMonth" && (
                              <span className="font-semibold text-white">
                                {tier.limits.invoicesPerMonth.toLocaleString()}
                              </span>
                            )}
                            {row.key === "automations" && (
                              <span className="font-semibold text-white">
                                {tier.limits.automations}
                              </span>
                            )}
                            {row.key === "storageGB" && (
                              <span className="font-semibold text-white">
                                {tier.limits.storageGB} GB
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h2 className="font-marketing text-4xl font-bold tracking-[-0.04em] text-white">
                Frequently Asked Questions
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/70">
                Have a question? We've got answers.
              </p>
            </div>

            <div className="mt-16">
              <FAQ items={FAQS} />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="glass-panel luminous-border mx-auto max-w-3xl rounded-3xl p-8 text-center md:p-12">
            <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-white md:text-4xl">
              {copy.cta?.title || "Ready to get started?"}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              {copy.cta?.subtitle ||
                "Join hundreds of businesses using PymeHub to manage customer operations."}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                onClick={() => handleUpgrade("GROWTH")}
                className="bg-gradient-to-r from-[#dfff4a] to-[#7ff4d2] text-[#051127] font-semibold px-8 py-3"
              >
                {copy.cta?.primary || "Start Free Trial"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 px-8 py-3"
              >
                {copy.cta?.secondary || "Schedule a Demo"}
              </Button>
            </div>
            <p className="mt-6 text-sm text-white/50">
              {copy.cta?.note || "No credit card required. Try free for 14 days."}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
