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
}

export interface AddOn {
  key: string;
  name: string;
  monthlyUSD: number;
  description: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

// Planes para comercios que venden en el marketplace de PymesHub. Los límites
// heredan los nombres del sistema (pedidos/mes, posiciones de catálogo,
// ubicaciones) aunque el panel del comercio los presente con su propia voz.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Emprende',
    monthlyUSD: 15,
    annualUSD: 150,
    description: 'Para vender tus primeros pedidos en línea',
    users: 1,
    features: [
      'Tienda propia con catálogo',
      'Pedidos a domicilio y retiro',
      'Hasta 300 pedidos/mes',
      'Pago en efectivo contra entrega',
      'Soporte por email',
    ],
    limits: {
      invoicesPerMonth: 300,
      automations: 5,
      storageGB: 2,
      locations: 1,
    },
    popular: false,
    cta: 'Registrá tu comercio',
  },
  {
    name: 'Starter',
    monthlyUSD: 25,
    annualUSD: 250,
    description: 'Ordená tu operación de pedidos y entregas',
    users: 1,
    features: [
      'Todo lo de Emprende',
      'Hasta 800 pedidos/mes',
      'Promociones y cupones',
      'Panel de pedidos del día',
      'Zona de entrega configurable',
      '15 automatizaciones',
    ],
    limits: {
      invoicesPerMonth: 800,
      automations: 15,
      storageGB: 5,
      locations: 1,
    },
    popular: false,
    cta: 'Registrá tu comercio',
  },
  {
    name: 'Growth',
    monthlyUSD: 59,
    annualUSD: 590,
    description: 'El plan favorito de los comercios con delivery propio',
    users: 5,
    features: [
      'Todo lo de Starter',
      'Hasta 2.000 pedidos/mes',
      'Equipo con roles (cocina, delivery, caja)',
      'Historial de clientes frecuentes',
      'Reportes de ventas',
      'Soporte prioritario',
      'Migración de catálogo básica',
      '25 automatizaciones',
    ],
    limits: {
      invoicesPerMonth: 2000,
      automations: 25,
      storageGB: 10,
      locations: 1,
    },
    popular: true,
    cta: 'Empezá con Growth',
  },
  {
    name: 'Business',
    monthlyUSD: 119,
    annualUSD: 1190,
    description: 'Varias sucursales, un mismo catálogo ordenado',
    users: 15,
    features: [
      'Todo lo de Growth',
      'Hasta 5.000 pedidos/mes',
      'Múltiples sucursales',
      'Reportes por sucursal',
      'Roles y permisos avanzados',
      'Auditoría de pedidos',
      'Marca personalizada en tu tienda',
      'Soporte telefónico',
      '100 automatizaciones',
    ],
    limits: {
      invoicesPerMonth: 5000,
      automations: 100,
      storageGB: 50,
      locations: 3,
    },
    popular: false,
    cta: 'Subir a Business',
  },
  {
    name: 'Business+',
    monthlyUSD: 0,
    annualUSD: 0,
    description: 'Para cadenas y operaciones de alto volumen',
    users: 999,
    features: [
      'Todo lo de Business',
      'Límites personalizados',
      'Integraciones de pago',
      'Acuerdos de nivel de servicio',
      'Onboarding dedicado',
      'Flujos personalizados',
      'Soporte dedicado',
      'Contrato personalizado',
    ],
    featureStatuses: {
      'Integraciones de pago': 'Parcial',
      'Acuerdos de nivel de servicio': 'Parcial',
      'Onboarding dedicado': 'Próximamente',
      'Flujos personalizados': 'Parcial',
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
  },
];

export const ADD_ONS: AddOn[] = [
  {
    key: 'extra_user',
    name: 'Usuario extra',
    monthlyUSD: 8,
    description: 'Sumá otra persona a tu equipo: cocina, delivery o caja',
  },
  {
    key: 'whatsapp_premium',
    name: 'Avisos por WhatsApp',
    monthlyUSD: 19,
    description: 'Notificá al cliente cada cambio de estado de su pedido por WhatsApp',
  },
  {
    key: 'advanced_inventory',
    name: 'Inventario avanzado',
    monthlyUSD: 29,
    description: 'Control de existencias para que nunca vendas lo que no tenés',
  },
  {
    key: 'ai_assistant',
    name: 'Descripciones y sugerencias IA',
    monthlyUSD: 29,
    description: 'Mejorá las descripciones de tu catálogo y recibí sugerencias de promociones',
  },
  {
    key: 'approvals_signature',
    name: 'Reportes avanzados',
    monthlyUSD: 25,
    description: 'Ventas por horario, producto más vendido y comparativas entre sucursales',
  },
];

export const FAQS: FAQ[] = [
  {
    question: '¿Registrá mi comercio cuesta algo?',
    answer: 'Publicar tu tienda y recibir pedidos tiene el costo del plan que elijas. Existe un plan Emprende pensado para arrancar. Explorar la app como cliente siempre es gratis.',
  },
  {
    question: '¿Puedo pagar en colones?',
    answer: 'Sí. Los comercios en Costa Rica pueden pagar en CRC. El precio en USD está disponible para clientes internacionales.',
  },
  {
    question: '¿Cómo recibo el dinero de mis pedidos?',
    answer: 'Si el cliente paga en efectivo, el dinero queda en tu caja como siempre. Para pagos con tarjeta o transferencia, el cobro se registra por pedido y se liquida según el acuerdo de tu plan.',
  },
  {
    question: '¿Quién hace las entregas?',
    answer: 'Tu negocio mantiene su propia operación de entrega — tu gente, tus rutas. PymesHub organiza el pedido, la zona de cobertura y el estado en vivo para tu cliente.',
  },
  {
    question: '¿Puedo definir mi zona de entrega?',
    answer: 'Sí. Cada comercio define su radio de cobertura y sus horarios de atención. Los clientes fuera de tu zona no pueden pedir entrega a domicilio, pero sí pueden usar retiro en tienda.',
  },
  {
    question: '¿Ofrecen descuentos anuales?',
    answer: 'Sí. Los planes anuales incluyen aproximadamente dos meses gratis comparado con la facturación mensual.',
  },
  {
    question: '¿Puedo tener más de una sucursal?',
    answer: 'Los planes Business y Business+ permiten operar varias sucursales con reportes separados y un catálogo coordinado.',
  },
  {
    question: '¿Qué métodos de pago aceptan por la suscripción?',
    answer: 'Aceptamos tarjetas principales y PayPal. Transferencias bancarias disponibles para planes Business+.',
  },
  {
    question: '¿Hay costos por cada pedido vendido?',
    answer: 'No cobramos comisión por pedido. El plan incluye el uso de la plataforma; los cargos de procesamiento de pagos en línea que apliquen corresponden al proveedor de pagos.',
  },
  {
    question: '¿Están listas las funciones de Business+?',
    answer: 'Funciones como integraciones de pago y flujos personalizados están en desarrollo activo. Algunas están parcialmente disponibles, otras requieren configuración. Contactá a nuestro equipo para conocer la disponibilidad actual.',
  },
];

export const FEATURE_COMPARISON = [
  { feature: 'Usuarios incluidos', emprende: '1', starter: '1', growth: '5', business: '15', businessPlus: 'Personalizado' },
  { feature: 'Pedidos/mes', emprende: '300', starter: '800', growth: '2.000', business: '5.000', businessPlus: 'Personalizado' },
  { feature: 'Automatizaciones', emprende: '5', starter: '15', growth: '25', business: '100', businessPlus: 'Personalizado' },
  { feature: 'Almacenamiento', emprende: '2 GB', starter: '5 GB', growth: '10 GB', business: '50 GB', businessPlus: 'Personalizado' },
  { feature: 'Sucursales', emprende: '1', starter: '1', growth: '1', business: '3', businessPlus: 'Personalizado' },
  { feature: 'Tienda con catálogo', emprende: '✓', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Entrega y retiro', emprende: '✓', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Efectivo contra entrega', emprende: '✓', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Promociones y cupones', emprende: '—', starter: '✓', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Roles de equipo', emprende: '—', starter: '—', growth: '✓', business: '✓', businessPlus: '✓' },
  { feature: 'Varias sucursales', emprende: '—', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Auditoría de pedidos', emprende: '—', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Marca personalizada', emprende: '—', starter: '—', growth: '—', business: '✓', businessPlus: '✓' },
  { feature: 'Soporte', emprende: 'Email', starter: 'Email', growth: 'Prioritario', business: 'Prioritario+', businessPlus: 'Dedicado' },
];
