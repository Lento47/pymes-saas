export interface PricingTier {
  name: string;
  monthlyUSD: number;
  annualUSD: number;
  description: string;
  users: number;
  features: string[];
  featureStatuses?: Record<string, string>; // Business+ capability status per feature
  limits: {
    contacts: number;
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
    name: 'Starter',
    monthlyUSD: 25,
    annualUSD: 250,
    description: 'Empieza a organizar tus clientes y facturas',
    users: 1,
    features: [
      'CRM básico',
      'Facturación básica',
      'Dashboard',
      'Soporte por email',
      '500 contactos',
      'Pipeline de ventas',
      '100 facturas/mes',
    ],
    limits: {
      contacts: 500,
      invoicesPerMonth: 100,
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
      'Bandeja WhatsApp',
      'Automatizaciones básicas',
      'Dashboard del dueño',
      'Roles de usuario',
      'Soporte prioritario',
      'Migración de datos básica',
      '2,500 contactos',
      '500 facturas/mes',
      '25 automatizaciones',
    ],
    limits: {
      contacts: 2500,
      invoicesPerMonth: 500,
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
      'Múltiples ubicaciones',
      'Dashboards avanzados',
      'Roles y permisos avanzados',
      'Auditoría',
      'Acceso API',
      'Marca personalizada',
      'Proyecciones',
      'Soporte telefónico',
      '15,000 contactos',
      '2,000 facturas/mes',
      '100 automatizaciones',
    ],
    limits: {
      contacts: 15000,
      invoicesPerMonth: 2000,
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
      contacts: 999999,
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
    description: 'Sugerencias y automatizaciones con inteligencia artificial',
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
    answer: 'Sí. PymeHub ofrece una prueba guiada de 14 días para planes elegibles. Podés explorar todas las funciones con un workspace de prueba.',
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
    question: '¿Hay costos adicionales por WhatsApp?',
    answer: 'La bandeja de WhatsApp está incluida para gestionar conversaciones, asignar clientes y dar seguimiento. Los costos oficiales de mensajería de Meta WhatsApp Business Platform pueden aplicar según el uso, categoría del mensaje, país del destinatario y configuración del proveedor. Estos son independientes de tu suscripción de PymeHub.',
  },
  {
    question: '¿Están listas las funciones enterprise de Business+?',
    answer: 'Funciones como SSO/SAML, flujos personalizados, políticas SLA y onboarding dedicado están en desarrollo activo. Algunas están parcialmente disponibles, otras requieren configuración o están en la hoja de ruta. Contactá a nuestro equipo de ventas para conocer la disponibilidad actual.',
  },
];

export const FEATURE_COMPARISON = [
  { feature: 'Usuarios incluidos', starter: '1', growth: '5', business: '15', businessPlus: 'Personalizado' },
  { feature: 'Contactos', starter: '500', growth: '2,500', business: '15,000', businessPlus: 'Personalizado' },
  { feature: 'Facturas/mes', starter: '100', growth: '500', business: '2,000', businessPlus: 'Personalizado' },
  { feature: 'Automatizaciones', starter: '15', growth: '25', business: '100', businessPlus: 'Personalizado' },
  { feature: 'Almacenamiento', starter: '5 GB', growth: '10 GB', business: '50 GB', businessPlus: 'Personalizado' },
  { feature: 'Ubicaciones', starter: '1', growth: '1', business: '3', businessPlus: 'Personalizado' },
  { feature: 'CRM', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Facturación', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Pipeline de ventas', starter: '✓ (50 deals)', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Bandeja WhatsApp', starter: '—', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Automatizaciones', starter: 'Básicas', growth: 'Básicas', business: 'Avanzadas', businessPlus: 'Personalizadas' },
  { feature: 'Acceso API', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Múltiples ubicaciones', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Auditoría', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Soporte', starter: 'Email', growth: 'Prioritario', business: 'Prioritario+', businessPlus: 'Dedicado' },
];
