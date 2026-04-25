export interface PricingTier {
  name: string;
  monthlyUSD: number;
  monthlyCRC: number;
  annualUSD: number;
  annualCRC: number;
  description: string;
  users: number;
  features: string[];
  limits: {
    contacts: number;
    invoicesPerMonth: number;
    automations: number;
    storageGB: number;
    locations: number;
  };
  popular: boolean;
  cta: string;
  /** Paddle sandbox/production price IDs — replace with IDs from your Paddle dashboard */
  paddlePriceIdMonthly?: string;
  paddlePriceIdAnnual?: string;
}

export interface AddOn {
  name: string;
  monthlyUSD: number;
  monthlyCRC: number;
  description: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    monthlyUSD: 25,
    monthlyCRC: 12900,
    annualUSD: 250, // 2 months free
    annualCRC: 129000,
    description: 'Start organizing your customers and invoices',
    users: 1,
    features: [
      'Basic CRM',
      'Basic invoicing',
      'Dashboard',
      'Email support',
      '500 contacts',
      '100 invoices/month',
    ],
    limits: {
      contacts: 500,
      invoicesPerMonth: 100,
      automations: 5,
      storageGB: 5,
      locations: 1,
    },
    popular: false,
    cta: 'Start free trial',
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY,
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL,
  },
  {
    name: 'Growth',
    monthlyUSD: 59,
    monthlyCRC: 29900,
    annualUSD: 590, // 2 months free
    annualCRC: 299000,
    description: 'The best plan for businesses that want control',
    users: 5,
    features: [
      'All Starter features',
      'Sales pipeline',
      'WhatsApp inbox',
      'Basic automations',
      'Owner dashboard',
      'User roles',
      'Priority support',
      'Basic data migration',
      '2,500 contacts',
      '500 invoices/month',
      '25 automations',
    ],
    limits: {
      contacts: 2500,
      invoicesPerMonth: 500,
      automations: 25,
      storageGB: 10,
      locations: 1,
    },
    popular: true,
    cta: 'Start with Growth',
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY,
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_GROWTH_ANNUAL,
  },
  {
    name: 'Business',
    monthlyUSD: 119,
    monthlyCRC: 59900,
    annualUSD: 1190, // 2 months free
    annualCRC: 599000,
    description: 'Advanced control for growing teams',
    users: 15,
    features: [
      'All Growth features',
      'Multi-location support',
      'Advanced dashboards',
      'Advanced roles & permissions',
      'Audit logs',
      'API access',
      'Custom branding',
      'Forecasting',
      'Phone support',
      '15,000 contacts',
      '2,000 invoices/month',
      '100 automations',
    ],
    limits: {
      contacts: 15000,
      invoicesPerMonth: 2000,
      automations: 100,
      storageGB: 50,
      locations: 3,
    },
    popular: false,
    cta: 'Upgrade to Business',
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_BUSINESS_MONTHLY,
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_BUSINESS_ANNUAL,
  },
  {
    name: 'Business+',
    monthlyUSD: 0, // Custom pricing
    monthlyCRC: 0,
    annualUSD: 0,
    annualCRC: 0,
    description: 'Para pymes con operaciones avanzadas',
    users: 999,
    features: [
      'All Business features',
      'Custom limits',
      'SSO / SAML',
      'SLA guarantees',
      'Dedicated onboarding',
      'Custom workflows',
      'Advanced security',
      'Dedicated support',
      'Custom contract',
    ],
    limits: {
      contacts: 999999,
      invoicesPerMonth: 999999,
      automations: 999999,
      storageGB: 999,
      locations: 999,
    },
    popular: false,
    cta: 'Contact sales',
  },
];

export const ADD_ONS: AddOn[] = [
  {
    name: 'Extra user',
    monthlyUSD: 8,
    monthlyCRC: 4000,
    description: 'Add one additional user to your workspace',
  },
  {
    name: 'WhatsApp Premium',
    monthlyUSD: 19,
    monthlyCRC: 9900,
    description: 'Advanced WhatsApp features and analytics',
  },
  {
    name: 'Advanced Inventory',
    monthlyUSD: 29,
    monthlyCRC: 14900,
    description: 'Full inventory management and tracking',
  },
  {
    name: 'AI Assistant',
    monthlyUSD: 39,
    monthlyCRC: 19900,
    description: 'AI-powered suggestions and automations',
  },
  {
    name: 'Approvals & Digital Signature',
    monthlyUSD: 25,
    monthlyCRC: 12900,
    description: 'Approval workflows and digital signature flow',
  },
];

export const FAQS: FAQ[] = [
  {
    question: 'Is there a free trial?',
    answer:
      'Yes. PymeHub offers a guided 14-day trial for eligible plans. You can explore all features with a test workspace.',
  },
  {
    question: 'Can I pay in colones?',
    answer:
      'Yes. Businesses in Costa Rica can pay in CRC. USD pricing is available for international customers.',
  },
  {
    question: 'Can I add more users?',
    answer:
      'Absolutely. Extra users can be added monthly as an add-on for ₡4,000 ($8 USD) per user.',
  },
  {
    question: 'Is onboarding included?',
    answer:
      'Starter is self-serve. Growth may include basic onboarding during launch promotions. Business and Business+ plans include paid onboarding and implementation services.',
  },
  {
    question: 'Can you migrate my Excel files?',
    answer:
      'Yes. Basic migration may be included in launch offers. Advanced migration with data cleaning is quoted separately.',
  },
  {
    question: 'Do you offer annual discounts?',
    answer:
      'Yes. Annual plans include approximately two months free compared to monthly billing.',
  },
  {
    question: 'Do you support custom needs?',
    answer:
      'Yes. Business+ plans support custom workflows, limits, contracts, and dedicated implementation support.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Bank transfers available for Business+ plans.',
  },
];

export const FEATURE_COMPARISON = [
  { feature: 'Users included', starter: '1', growth: '5', business: '15', businessPlus: 'Custom' },
  { feature: 'Contacts', starter: '500', growth: '2,500', business: '15,000', businessPlus: 'Custom' },
  { feature: 'Invoices/month', starter: '100', growth: '500', business: '2,000', businessPlus: 'Custom' },
  { feature: 'Automations', starter: '5', growth: '25', business: '100', businessPlus: 'Custom' },
  { feature: 'Storage', starter: '5 GB', growth: '10 GB', business: '50 GB', businessPlus: 'Custom' },
  { feature: 'Locations', starter: '1', growth: '1', business: '3', businessPlus: 'Custom' },
  { feature: 'CRM', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Invoicing', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Sales Pipeline', starter: '—', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'WhatsApp Inbox', starter: '—', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Automations', starter: 'Basic', growth: 'Basic', business: 'Advanced', businessPlus: 'Custom' },
  { feature: 'API Access', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Multi-location', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Audit logs', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Support', starter: 'Email', growth: 'Priority', business: 'Priority+', businessPlus: 'Dedicated' },
];
