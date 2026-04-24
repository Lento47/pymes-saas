export type WorkspacePlan = 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';

export interface PricingTier {
  name: string;
  plan: WorkspacePlan;
  monthlyUSD: number;
  monthlyCRC: number;
  yearlyUSD?: number;
  yearlyCRC?: number;
  description: string;
  features: string[];
  limits: {
    users: number;
    contacts: number;
    invoicesPerMonth: number;
    automations: number;
    storageGB: number;
  };
  popular?: boolean;
  cta: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    plan: 'STARTER',
    monthlyUSD: 25,
    monthlyCRC: 12900,
    yearlyUSD: 250,
    yearlyCRC: 129000,
    description: 'Start organizing your customers and invoices',
    features: [
      'Basic CRM for customer management',
      '100 invoices per month',
      '5 automation rules',
      '1 team member',
      '500 contacts maximum',
      '1 GB storage',
      'Email support',
      'Basic reporting',
    ],
    limits: {
      users: 1,
      contacts: 500,
      invoicesPerMonth: 100,
      automations: 5,
      storageGB: 1,
    },
    cta: 'Start with Starter',
  },
  {
    name: 'Growth',
    plan: 'GROWTH',
    monthlyUSD: 59,
    monthlyCRC: 29900,
    yearlyUSD: 590,
    yearlyCRC: 299000,
    description: 'The best plan for businesses that want control',
    features: [
      'Advanced CRM and customer profiles',
      '500 invoices per month',
      '25 automation rules',
      '5 team members',
      '2,500 contacts maximum',
      '10 GB storage',
      'Priority email & chat support',
      'Advanced reporting & analytics',
      'API access',
      'Custom email templates',
    ],
    limits: {
      users: 5,
      contacts: 2500,
      invoicesPerMonth: 500,
      automations: 25,
      storageGB: 10,
    },
    popular: true,
    cta: 'Start with Growth',
  },
  {
    name: 'Business',
    plan: 'BUSINESS',
    monthlyUSD: 119,
    monthlyCRC: 59900,
    yearlyUSD: 1190,
    yearlyCRC: 599000,
    description: 'Advanced control for growing teams',
    features: [
      'Enterprise CRM with custom fields',
      '2,000 invoices per month',
      '100 automation rules',
      '15 team members',
      '15,000 contacts maximum',
      '50 GB storage',
      '24/7 phone & email support',
      'Custom reporting & dashboards',
      'Advanced API with webhooks',
      'White-label invoicing',
      'Multi-currency support',
      'Advanced permission controls',
    ],
    limits: {
      users: 15,
      contacts: 15000,
      invoicesPerMonth: 2000,
      automations: 100,
      storageGB: 50,
    },
    cta: 'Start with Business',
  },
  {
    name: 'Enterprise',
    plan: 'ENTERPRISE',
    monthlyUSD: 0, // Custom pricing
    monthlyCRC: 0,
    description: 'Custom operations platform',
    features: [
      'Custom CRM configuration',
      'Unlimited invoices',
      'Unlimited automations',
      'Unlimited team members',
      'Unlimited contacts',
      'Unlimited storage',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'Advanced security features',
      'Custom reports & analytics',
      'On-premise deployment option',
    ],
    limits: {
      users: 999,
      contacts: 999999,
      invoicesPerMonth: 999999,
      automations: 999,
      storageGB: 999,
    },
    cta: 'Contact Sales',
  },
];

export const FEATURE_COMPARISON = [
  {
    category: 'Team',
    items: [
      { name: 'Team Members', key: 'users' },
      { name: 'Permission Controls', key: 'perms' },
    ],
  },
  {
    category: 'Contacts & CRM',
    items: [
      { name: 'Contact Limit', key: 'contacts' },
      { name: 'Custom Fields', key: 'customFields' },
      { name: 'Contact Segments', key: 'segments' },
    ],
  },
  {
    category: 'Invoicing',
    items: [
      { name: 'Invoices per Month', key: 'invoicesPerMonth' },
      { name: 'Custom Templates', key: 'customTemplates' },
      { name: 'Multi-Currency', key: 'multiCurrency' },
    ],
  },
  {
    category: 'Automations',
    items: [
      { name: 'Automation Rules', key: 'automations' },
      { name: 'API Access', key: 'api' },
      { name: 'Webhooks', key: 'webhooks' },
    ],
  },
  {
    category: 'Support',
    items: [
      { name: 'Email Support', key: 'emailSupport' },
      { name: 'Priority Support', key: 'prioritySupport' },
      { name: 'Phone Support', key: 'phoneSupport' },
    ],
  },
];

export const FAQS = [
  {
    question: 'Can I change my plan anytime?',
    answer:
      'Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
  },
  {
    question: 'What happens if I exceed my limits?',
    answer:
      'When you approach your limits, we'll notify you. You can upgrade your plan to increase your limits immediately.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes, all plans include a 14-day free trial. No credit card required to get started.',
  },
  {
    question: 'Do you offer annual discounts?',
    answer:
      'Absolutely! Pay annually and save 15% compared to monthly billing on all plans.',
  },
  {
    question: 'Can I export my data?',
    answer:
      'You can export your data anytime. We support CSV, Excel, and JSON formats for easy migration.',
  },
  {
    question: 'Is there a setup fee?',
    answer:
      'No setup fees! You only pay the monthly or annual subscription amount. Start using PymeHub immediately after signup.',
  },
];
