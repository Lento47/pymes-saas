import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check } from 'lucide-react';
import { PRICING_TIERS, ADD_ONS, FAQS } from '@/data/pricing.data';
import { PricingCard } from '@/components/pricing/PricingCard';
import { FAQSection } from '@/components/pricing/FAQSection';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/i18n-provider';
import { BrandLockup } from '@/components/marketing/brand-lockup';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);
  const { messages } = useI18n();
  const copy = messages.pricing || {};

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
                <BrandLockup compact />
              </Link>
              <div className="flex items-center gap-1 sm:gap-4">
                <LanguageSwitcher variant="marketing" />
                <Link href="/login" className="font-marketing hidden sm:block whitespace-nowrap text-sm font-medium text-white/78 transition hover:text-white">
                  Log in
                </Link>
                <Link href="/login" className="glow-button font-marketing inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-2.5 py-2 text-xs font-semibold text-[#071126] transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                  Get Started
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {/* Hero Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-marketing text-5xl font-extrabold leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl">
              {copy.hero?.title || 'Simple, transparent pricing'}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 md:text-xl">
              {copy.hero?.subtitle || 'Choose the plan that fits your business. Scale as you grow.'}
            </p>

            {/* Billing Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={cn(isAnnual ? 'text-white/60' : 'text-white')}>
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={cn(
                  'relative inline-flex h-8 w-14 items-center rounded-full transition-colors',
                  isAnnual
                    ? 'bg-[#dfff4a]'
                    : 'bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-7 w-7 transform rounded-full bg-white transition-transform',
                    isAnnual ? 'translate-x-7' : 'translate-x-0.5'
                  )}
                />
              </button>
              <span className={cn(isAnnual ? 'text-white' : 'text-white/60')}>
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
                  key={tier.name}
                  tier={tier}
                  isAnnual={isAnnual}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="font-marketing text-4xl font-bold tracking-[-0.04em] text-white">
                {copy.comparison?.title || 'Compare All Features'}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/70">
                {copy.comparison?.subtitle || 'See what features are included in each plan'}
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
                        key={tier.name}
                        className="px-6 py-4 text-center text-sm font-semibold text-white"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {[
                    { label: 'Team Members', key: 'users' },
                    { label: 'Contacts', key: 'contacts' },
                    { label: 'Invoices/Month', key: 'invoicesPerMonth' },
                    { label: 'Automations', key: 'automations' },
                    { label: 'Storage', key: 'storageGB' },
                  ].map((row) => (
                    <tr key={row.key} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4 text-sm text-white/80">{row.label}</td>
                      {PRICING_TIERS.map((tier) => {
                        const isBusinessPlus = tier.name === 'Business+';
                        return (
                          <td key={tier.name} className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center">
                              {isBusinessPlus ? (
                                <span className="font-semibold text-white/60 italic">Custom</span>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 text-[#dfff4a]" />
                                  <span className="ml-2 font-semibold text-white">
                                    {row.key === 'users' && tier.users}
                                    {row.key === 'contacts' && tier.limits.contacts.toLocaleString()}
                                    {row.key === 'invoicesPerMonth' && tier.limits.invoicesPerMonth.toLocaleString()}
                                    {row.key === 'automations' && tier.limits.automations}
                                    {row.key === 'storageGB' && `${tier.limits.storageGB} GB`}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2 className="font-marketing text-4xl font-bold tracking-[-0.04em] text-white">
                Frequently Asked Questions
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/70">
                Have a question? We've got answers.
              </p>
            </div>

            <div className="mt-16">
              <FAQSection faqs={FAQS} />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="glass-panel luminous-border mx-auto max-w-3xl rounded-3xl p-8 text-center md:p-12">
            <h2 className="font-marketing text-3xl font-bold tracking-[-0.04em] text-white md:text-4xl">
              {copy.cta?.title || 'Ready to get started?'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              {copy.cta?.subtitle ||
                'Join hundreds of businesses using PymeHub to manage customer operations.'}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => navigate('/login?plan=growth')}
                className="glow-button font-marketing inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#dfff4a] to-[#7ff4d2] px-8 py-3 text-[#051127] font-semibold transition hover:translate-y-[-1px]">
                {copy.cta?.primary || 'Start Free Trial'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/contact-sales')}
                className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/[0.08]">
                {copy.cta?.secondary || 'Schedule a Demo'}
              </button>
            </div>
            {copy.cta?.note && (
              <p className="mt-6 text-sm text-white/50">
                {copy.cta.note}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
