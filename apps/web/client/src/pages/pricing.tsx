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
    <div className="dark relative min-h-screen overflow-hidden bg-background text-white">
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
              <div className="flex items-center gap-2 sm:gap-4">
                <LanguageSwitcher variant="marketing" />
                <Link href="/login" className="font-marketing whitespace-nowrap text-sm font-medium text-white/78 transition hover:text-white">
                  Log in
                </Link>
                <Link href="/login" className="glow-button font-marketing inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#efff53_0%,#dfff4a_55%,#7ff4d2_100%)] px-3 py-2 text-xs font-semibold text-[#071126] transition hover:translate-y-[-1px] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
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
              <span className={cn(isAnnual ? 'text-white/85' : 'text-white')}>
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
              <span className={cn(isAnnual ? 'text-white' : 'text-white/85')}>
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
            <div className="grid gap-4 md:gap-8 lg:grid-cols-4">
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

        {/* ROI Messaging Section */}
        <section className="px-4 py-16 md:px-8 md:py-24 bg-gradient-to-b from-indigo-900/10 to-transparent">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="font-marketing text-3xl md:text-4xl font-bold tracking-[-0.04em] text-white">
                Clear ROI at Every Level
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/75">
                Pay only for what you need. Scale up as your business grows and see immediate improvements in customer response times and revenue.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Starter */}
              <div className="bg-indigo-900/20 border border-indigo-400/15 rounded-2xl p-6 transition-all hover:bg-indigo-900/30">
                <div className="text-sm font-semibold text-white/75 mb-3">STARTER PLAN</div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">+</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">Save 5-10 hours/week</p>
                      <p className="text-white/60 text-xs mt-1">Automated message routing & basic responses</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">+</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">Respond 3x faster</p>
                      <p className="text-white/60 text-xs mt-1">Unified inbox for WhatsApp, Email & more</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">+</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">Ideal for teams 1-5</p>
                      <p className="text-white/60 text-xs mt-1">Perfect to start improving customer ops</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Growth */}
              <div className="bg-gradient-to-br from-[#dfff4a]/20 to-indigo-900/20 border border-[#dfff4a]/40 rounded-2xl p-6 ring-1 ring-[#dfff4a]/20 transition-all hover:from-[#dfff4a]/30 hover:to-indigo-900/30 relative">
                <div className="absolute -top-3 left-6 bg-[#dfff4a] text-[#051127] px-3 py-1 rounded-full text-xs font-bold">
                  Most Popular ROI
                </div>
                <div className="text-sm font-semibold text-[#dfff4a] mb-3 mt-2">GROWTH PLAN</div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">→</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">+25-40% faster billing</p>
                      <p className="text-white/60 text-xs mt-1">Automated invoicing & payment tracking</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">→</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">$500-1000/month revenue gain</p>
                      <p className="text-white/60 text-xs mt-1">Recover lost invoices, reduce payment delays</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">→</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">Best for teams 5-50</p>
                      <p className="text-white/60 text-xs mt-1">Scale operations without hiring</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business+ */}
              <div className="bg-indigo-900/20 border border-indigo-400/15 rounded-2xl p-6 transition-all hover:bg-indigo-900/30">
                <div className="text-sm font-semibold text-white/75 mb-3">BUSINESS+ PLAN</div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">↑</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">Custom integrations</p>
                      <p className="text-white/60 text-xs mt-1">Sync with your existing CRM & tools</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">↑</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">Dedicated support & training</p>
                      <p className="text-white/60 text-xs mt-1">Maximize adoption & ROI across team</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#dfff4a] font-bold mt-0.5">↑</span>
                    <div className="text-sm">
                      <p className="text-white font-semibold">For enterprise teams</p>
                      <p className="text-white/60 text-xs mt-1">Unlimited customization & growth</p>
                    </div>
                  </div>
                </div>
              </div>
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

            <div className="mt-16 overflow-x-auto rounded-xl border border-indigo-400/20 bg-indigo-900/10">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-left text-sm font-semibold text-white/80">
                      Feature
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.name}
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-center text-sm font-semibold text-white"
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
                    <tr key={row.key} className="hover:bg-indigo-900/10 transition">
                      <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm text-white/80">{row.label}</td>
                      {PRICING_TIERS.map((tier) => {
                        const isBusinessPlus = tier.name === 'Business+';
                        return (
                          <td key={tier.name} className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-center">
                            <div className="flex items-center justify-center">
                              {isBusinessPlus ? (
                                <span className="font-semibold text-white/85 italic">Custom</span>
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
                className="font-marketing inline-flex items-center gap-2 rounded-full border border-white/20 bg-indigo-900/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-indigo-900/30">
                {copy.cta?.secondary || 'Schedule a Demo'}
              </button>
            </div>
            {copy.cta?.note && (
              <p className="mt-6 text-sm text-white/75">
                {copy.cta.note}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
