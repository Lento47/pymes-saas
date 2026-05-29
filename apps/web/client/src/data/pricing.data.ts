export interface PricingTier {
  name: string;
  monthlyUSD: number;
  annualUSD: number;
  description: string;
  users: number;
  features: string[];
  featureStatuses?: Record<string, string>; // Business+ capability status per feature
  limits: {
    invoicesPerMonth: number;
    automations: number;
    storageGB: number;
    locations: number;
  };
  popular: boolean;
  cta: string;
  paddlePriceIdMonthly?: string;
  paddlePriceIdAnnual?: string;
}

export interface AddOn {
  key: string;
  name: string;
  monthlyUSD: number;
  description: string;
  priceKeyMonthly?: string;
  priceKeyAnnual?: string;
  paddlePriceIdMonthly?: string;
  paddlePriceIdAnnual?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Emprende',
    monthlyUSD: 15,
    annualUSD: 150,
    description: 'Para emprendedores que arrancan solos',
    users: 1,
    features: [
      'CRM básico',
      'Bandeja WhatsApp',
      'Hasta 2.000 comprobantes/mes',
      'Pipeline de pedidos',
      'Soporte por email',
    ],
    limits: {
      invoicesPerMonth: 2000,
      automations: 5,
      storageGB: 2,
      locations: 1,
    },
    popular: false,
    cta: 'Prueba gratuita',
  },
  {
    name: 'Starter',
    monthlyUSD: 25,
    annualUSD: 250,
    description: 'Empieza a organizar tus clientes y facturas',
    users: 1,
    features: [
      'Todo lo de Emprende',
      'Facturación avanzada',
      'Hasta 5.000 comprobantes/mes',
      'Dashboard',
      'Pipeline de ventas',
      '15 automatizaciones',
    ],
    limits: {
      invoicesPerMonth: 5000,
      automations: 15,
      storageGB: 5,
      locations: 1,
    },
    popular: false,
    cta: 'Prueba gratuita',
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY,
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL,
  },
  {
    name: 'Growth',
    monthlyUSD: 59,
    annualUSD: 590,
    description: 'El mejor plan para negocios que quieren control',
    users: 5,
    features: [
      'Todo lo de Starter',
      'Pipeline de ventas',
      'Hasta 10.000 comprobantes/mes',
      'Automatizaciones básicas',
      'Dashboard del dueño',
      'Roles de usuario',
      'Soporte prioritario',
      'Migración de datos básica',
      '25 automatizaciones',
    ],
    limits: {
      invoicesPerMonth: 10000,
      automations: 25,
      storageGB: 10,
      locations: 1,
    },
    popular: true,
    cta: 'Empieza con Growth',
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY,
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_GROWTH_ANNUAL,
  },
  {
    name: 'Business',
    monthlyUSD: 119,
    annualUSD: 1190,
    description: 'Control avanzado para equipos en crecimiento',
    users: 15,
    features: [
      'Todo lo de Growth',
      'Hasta 15.000 comprobantes/mes',
      'Múltiples ubicaciones',
      'Dashboards avanzados',
      'Roles y permisos avanzados',
      'Auditoría',
      'Acceso API',
      'Marca personalizada',
      'Proyecciones',
      'Soporte telefónico',
      '100 automatizaciones',
    ],
    limits: {
      invoicesPerMonth: 15000,
      automations: 100,
      storageGB: 50,
      locations: 3,
    },
    popular: false,
    cta: 'Subir a Business',
    paddlePriceIdMonthly: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY,
    paddlePriceIdAnnual: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL,
  },
  {
    name: 'Business+',
    monthlyUSD: 0,
    annualUSD: 0,
    description: 'Para pymes con operaciones avanzadas',
    users: 999,
    features: [
      'Todo lo de Business',
      'Límites personalizados',
      'SSO / SAML',
      'Opciones de SLA',
      'Onboarding dedicado',
      'Flujos personalizados',
      'Seguridad avanzada',
      'Soporte dedicado',
      'Contrato personalizado',
    ],
    featureStatuses: {
      'Límites personalizados': 'Parcial',
      'SSO / SAML': 'Parcial',
      'Opciones de SLA': 'Parcial',
      'Onboarding dedicado': 'Próximamente',
      'Flujos personalizados': 'Parcial',
      'Seguridad avanzada': 'Parcial',
      'Soporte dedicado': 'Próximamente',
      'Contrato personalizado': 'Próximamente',
    },
    limits: {
      invoicesPerMonth: 999999,
      automations: 999999,
      storageGB: 999,
      locations: 999,
    },
    popular: false,
    cta: 'Contactar a ventas',
    paddlePriceIdMonthly: undefined,
    paddlePriceIdAnnual: undefined,
  },
];

export const ADD_ONS: AddOn[] = [
  {
    key: 'extra_user',
    name: 'Usuario extra',
    monthlyUSD: 8,
    description: 'Agrega otro compañero sin cambiar de plan',
    priceKeyMonthly: 'extra_user_monthly',
    priceKeyAnnual: 'extra_user_annual',
  },
  {
    key: 'whatsapp_premium',
    name: 'WhatsApp + Analíticas',
    monthlyUSD: 19,
    description: 'Reportes de conversaciones, tiempos de respuesta, métricas de canal y estadísticas avanzadas de WhatsApp',
  },
  {
    key: 'advanced_inventory',
    name: 'Inventario avanzado',
    monthlyUSD: 29,
    description: 'Gestión completa de inventario y seguimiento',
  },
  {
    key: 'ai_assistant',
    name: 'Asistente IA',
    monthlyUSD: 29,
    description: 'Incluye 500k tokens IA/mes + sugerencias y automatizaciones con inteligencia artificial',
    paddlePriceIdMonthly: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PADDLE_PRICE_AI_ASSISTANT_MONTHLY) || undefined,
    paddlePriceIdAnnual: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PADDLE_PRICE_AI_ASSISTANT_ANNUAL) || undefined,
  },
  {
    key: 'approvals_signature',
    name: 'Aprobaciones y firma digital',
    monthlyUSD: 25,
    description: 'Flujos de aprobación y firma digital integrada',
  },
];

export const FAQS: FAQ[] = [
  {
    question: '¿Hay prueba gratuita?',
    answer: 'Sí. PymesHub ofrece una prueba guiada de 14 días para planes elegibles. Podés explorar todas las funciones con un workspace de prueba.',
  },
  {
    question: '¿Puedo pagar en colones?',
    answer: 'Sí. Los negocios en Costa Rica pueden pagar en CRC. El precio en USD está disponible para clientes internacionales.',
  },
  {
    question: '¿Puedo agregar más usuarios?',
    answer: 'Claro. Podés agregar usuarios extra por ₡4,000 ($8 USD) mensuales por persona.',
  },
  {
    question: '¿Incluye onboarding?',
    answer: 'Starter es autoguiado. Growth puede incluir onboarding básico durante promociones. Los planes Business y Business+ incluyen servicios de onboarding e implementación.',
  },
  {
    question: '¿Pueden migrar mis archivos de Excel?',
    answer: 'Sí. La migración básica puede estar incluida en ofertas de lanzamiento. La migración avanzada con limpieza de datos se cotiza por separado.',
  },
  {
    question: '¿Ofrecen descuentos anuales?',
    answer: 'Sí. Los planes anuales incluyen aproximadamente dos meses gratis comparado con la facturación mensual.',
  },
  {
    question: '¿Soportan necesidades personalizadas?',
    answer: 'Sí. Los planes Business+ permiten flujos, límites, contratos y soporte de implementación a medida.',
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer: 'Aceptamos todas las tarjetas principales (Visa, Mastercard, American Express) vía Paddle. Transferencias bancarias disponibles para planes Business+.',
  },
  {
    question: '¿Hay costos adicionales por WhatsApp o Telegram?',
    answer: 'La bandeja omnicanal está incluida en el plan. PymesHub se conecta con tu propia cuenta de WhatsApp Business (WABA) — los cargos por mensajes de plantilla que aplique Meta los cobra Meta directamente a tu negocio, no PymesHub. PymesHub solo cobra el software. Telegram no tiene cargos por mensaje en uso normal.',
  },
  {
    question: '¿Están listas las funciones enterprise de Business+?',
    answer: 'Funciones como SSO/SAML, flujos personalizados, políticas SLA y onboarding dedicado están en desarrollo activo. Algunas están parcialmente disponibles, otras requieren configuración o están en la hoja de ruta. Contactá a nuestro equipo de ventas para conocer la disponibilidad actual.',
  },
];

export const FEATURE_COMPARISON = [
  { feature: 'Usuarios incluidos', emprende: '1', starter: '1', growth: '5', business: '15', businessPlus: 'Personalizado' },
  { feature: 'Comprobantes/mes', emprende: '2.000', starter: '5.000', growth: '10.000', business: '15.000', businessPlus: 'Personalizado' },
  { feature: 'Automatizaciones', emprende: '5', starter: '15', growth: '25', business: '100', businessPlus: 'Personalizado' },
  { feature: 'Almacenamiento', emprende: '2 GB', starter: '5 GB', growth: '10 GB', business: '50 GB', businessPlus: 'Personalizado' },
  { feature: 'Ubicaciones', emprende: '1', starter: '1', growth: '1', business: '3', businessPlus: 'Personalizado' },
  { feature: 'CRM', emprende: '✓', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Facturación', emprende: 'Básica', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Pipeline de ventas', emprende: 'Básico', starter: '✓ (50 deals)', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Bandeja WhatsApp', emprende: '✓', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Automatizaciones', emprende: '—', starter: 'Básicas', growth: 'Básicas', business: 'Avanzadas', businessPlus: 'Personalizadas' },
  { feature: 'Acceso API', emprende: '—', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Múltiples ubicaciones', emprende: '—', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Auditoría', emprende: '—', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Soporte', emprende: 'Email', starter: 'Email', growth: 'Prioritario', business: 'Prioritario+', businessPlus: 'Dedicado' },
];
