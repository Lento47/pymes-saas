import { useState } from 'react';
import { PRICING_TIERS, ADD_ONS, FAQS, FEATURE_COMPARISON } from '@/data/pricing.data';
import { PricingCard } from '@/components/pricing/PricingCard';
import { FeatureComparison } from '@/components/pricing/FeatureComparison';
import { AddOnsSection } from '@/components/pricing/AddOnsSection';
import { FAQSection } from '@/components/pricing/FAQSection';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/i18n-provider';

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const { messages } = useI18n();
  const copy = messages.pricing;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {copy?.hero?.title || 'Simple plans to organize your business'}
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            {copy?.hero?.subtitle || 'Manage customers, invoices, sales, follow-ups, and automations from one connected workspace.'}
          </p>
        </div>
      </section>

      {/* Billing Toggle */}
      <section className="flex justify-center px-4 py-8">
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 font-medium rounded transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-6 py-2 font-medium rounded transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Annual <span className="text-sm font-normal">(2 months free)</span>
          </button>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {PRICING_TIERS.map((tier) => (
              <PricingCard
                key={tier.name}
                tier={tier}
                billingPeriod={billingPeriod}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {copy?.comparison?.title || 'Full feature comparison'}
          </h2>
          <FeatureComparison features={FEATURE_COMPARISON} />
        </div>
      </section>

      {/* Add-ons */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Optional add-ons
          </h2>
          <AddOnsSection addOns={ADD_ONS} billingPeriod={billingPeriod} />
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Frequently asked questions
          </h2>
          <FAQSection faqs={FAQS} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-blue-600 px-4 py-16 text-center text-white sm:px-6 lg:px-8">
        <h2 className="mb-4 text-3xl font-bold">
          {copy?.cta?.title || 'Ready to get started?'}
        </h2>
        <p className="mb-8 text-lg opacity-90">
          {copy?.cta?.subtitle || 'Join hundreds of businesses using PymeHub'}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button
            className="bg-white text-blue-600 hover:bg-gray-100"
            size="lg"
          >
            {copy?.cta?.primary || 'Start free trial'}
          </Button>
          <Button
            variant="outline"
            className="border-white text-white hover:bg-blue-700"
            size="lg"
          >
            {copy?.cta?.secondary || 'Book a demo'}
          </Button>
        </div>
        {copy?.cta?.note && (
          <p className="mt-4 text-sm opacity-75">
            {copy.cta.note}
          </p>
        )}
      </section>
    </div>
  );
}
