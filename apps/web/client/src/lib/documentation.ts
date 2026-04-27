export type DocumentationCategory =
  | "legal"
  | "business"
  | "security"
  | "operations"
  | "product-compliance"
  | "architecture";

export type DocumentationVisibility = "public" | "internal";

export interface DocumentationEntry {
  slug: string;
  title: string;
  summary: string;
  purpose: string;
  category: DocumentationCategory;
  visibility: DocumentationVisibility;
  audience: "Cliente" | "Interno" | "Cliente e interno";
  repoPath: string;
  highlights: string[];
}

export const DOCUMENTATION_CATEGORIES: Record<
  DocumentationCategory,
  { title: string; description: string }
> = {
  legal: {
    title: "Legal y contratos",
    description: "Documentos que el cliente puede leer, aceptar o firmar.",
  },
  business: {
    title: "Negocio y fiscal",
    description: "Criterios societarios, facturación y operación comercial en Costa Rica.",
  },
  security: {
    title: "Seguridad",
    description: "Políticas internas de acceso, incidentes, backups, vendors y riesgos.",
  },
  operations: {
    title: "Operación y soporte",
    description: "SOPs ligeros para soporte, onboarding, offboarding, SLA y cambios.",
  },
  "product-compliance": {
    title: "Cumplimiento de producto",
    description: "Requisitos que el producto debe implementar para sostener lo prometido.",
  },
  architecture: {
    title: "Arquitectura y terceros",
    description: "Mapa de datos, límites del sistema y dependencias críticas.",
  },
};

export const DOCUMENTATION_ENTRIES: DocumentationEntry[] = [
  {
    slug: "platform-overview",
    title: "Platform Overview",
    summary: "Resumen público de cómo PymesHub organiza customer ops, facturación, documentación y gobernanza para equipos multiárea.",
    purpose: "Explicar a prospectos, clientes y procurement cómo se conecta la plataforma antes de una implementación.",
    category: "architecture",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "docs/architecture/platform-overview.md",
    highlights: [
      "Customer operations, revenue workflows y documentación en un solo sistema",
      "Gobernanza por roles, handoffs y visibilidad operativa compartida",
      "Preparación para rollout, soporte y revisión de stakeholders enterprise",
    ],
  },
  {
    slug: "terms-of-service",
    title: "Términos de Servicio",
    summary: "Reglas de acceso, uso, licencia, pagos, suspensión, responsabilidad y ley aplicable.",
    purpose: "Gobernar la relación contractual entre PymeHub y cada cliente respecto del uso de la Plataforma.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/terms-of-service.md",
    highlights: [
      "Aceptación electrónica con evidencia de versión, fecha y cuenta",
      "Roles de responsable y encargado según uso de la Plataforma",
      "Restricciones de uso, suspensión y terminación",
      "Facturación, impuestos, renovación automática y downgrade",
      "Limitación de responsabilidad con carve-outs razonables",
      "Ley aplicable y foro en Costa Rica",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Política de Privacidad",
    summary: "Cómo PymeHub recopila, usa, conserva, comparte y protege datos personales.",
    purpose: "Cumplir con la Ley N.º 8968 y dar transparencia sobre el tratamiento de datos personales en Costa Rica.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/privacy-policy.md",
    highlights: [
      "Identidad del responsable y datos de contacto",
      "Categorías de datos, finalidades y base de legitimación",
      "Destinatarios, proveedores y transferencias internacionales",
      "Derechos del titular y procedimiento de 5 días hábiles",
      "Medidas de seguridad, retención y notificación de incidentes",
      "Menores, cambios en la política y contacto de privacidad",
    ],
  },
  {
    slug: "data-processing-addendum",
    title: "Data Processing Addendum (DPA)",
    summary: "Reglas vinculantes cuando el cliente es responsable y PymeHub actúa como encargado del tratamiento.",
    purpose: "Cumplir con la Ley N.º 8968 y su Reglamento para documentar instrucciones, subencargados, seguridad y responsabilidades.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/data-processing-addendum.md",
    highlights: [
      "Objeto, duración y categorías de datos tratados por cuenta del cliente",
      "Instrucciones documentadas y confidencialidad del personal",
      "Subencargados autorizados con mecanismo de objeción",
      "Medidas de seguridad técnicas, administrativas y físicas",
      "Notificación de incidentes y asistencia en derechos del titular",
      "Retorno o supresión de datos al terminar la relación",
    ],
  },
  {
    slug: "acceptable-use-policy",
    title: "Política de Uso Aceptable (AUP)",
    summary: "Conductas permitidas y prohibidas al usar PymeHub, sus integraciones y canales.",
    purpose: "Proteger la integridad del servicio y los derechos de otros clientes y terceros.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/acceptable-use-policy.md",
    highlights: [
      "Prohibición de uso ilegal, spam, malware y fraude",
      "Restricciones sobre datos sensibles sin autorización",
      "Reglas específicas de WhatsApp e inteligencia artificial",
      "Consecuencias por incumplimiento",
    ],
  },
  {
    slug: "billing-refunds-policy",
    title: "Facturación y Reembolsos",
    summary: "Ciclos de cobro, renovación, impuestos, cancelación, downgrade y política de reembolsos.",
    purpose: "Establecer reglas claras y predecibles sobre los aspectos económicos del servicio.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/billing-refunds-policy.md",
    highlights: [
      "Planes, ciclos de facturación y renovación automática",
      "Impuestos aplicables y emisión de comprobantes electrónicos",
      "Reembolsos y ventana de cancelación",
      "Chargebacks, downgrades y upgrades",
    ],
  },
  {
    slug: "subprocessors-notice",
    title: "Aviso de Subencargados",
    summary: "Lista pública de terceros que tratan datos por cuenta de PymeHub, con función, categorías y región.",
    purpose: "Dar transparencia sobre la cadena de tratamiento y permitir al cliente evaluar riesgos.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/subprocessors-notice.md",
    highlights: [
      "Proveedor, función, categorías de datos y región de tratamiento",
      "Base contractual aplicable con cada subencargado",
      "Procedimiento de actualización y aviso previo al cliente",
      "Derecho de objeción por motivos razonables de privacidad",
    ],
  },
  {
    slug: "whatsapp-ai-policy",
    title: "Política de WhatsApp e IA",
    summary: "Reglas de uso de canales WhatsApp y funcionalidades asistidas por inteligencia artificial.",
    purpose: "Proteger a los usuarios finales y asegurar cumplimiento con Meta, la legislación costarricense y buenas prácticas.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/whatsapp-ai-policy.md",
    highlights: [
      "Opt-in obligatorio y verificable para mensajes de WhatsApp",
      "Respeto de opt-out y ventana de 24 horas para mensajes libres",
      "Prohibición de datos sensibles en prompts de IA",
      "Revisión humana obligatoria para decisiones de alto impacto",
      "Responsabilidad del cliente sobre la validación de outputs de IA",
    ],
  },
  {
    slug: "cookies-policy",
    title: "Política de Cookies",
    summary: "Tipos de cookies utilizadas, finalidad, duración y mecanismos de gestión del consentimiento.",
    purpose: "Cumplir con el deber de informar y obtener consentimiento para cookies no esenciales.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/cookies-policy.md",
    highlights: [
      "Cookies estrictamente necesarias para el funcionamiento",
      "Cookies de analítica, preferencias y marketing",
      "Banner de consentimiento granular y retiro en cualquier momento",
      "Lista de cookies por categoría, proveedor, finalidad y duración",
    ],
  },
  {
    slug: "costa-rica-tax-invoicing-guide",
    title: "Guía Fiscal y de Facturación CR",
    summary: "Marco operativo para facturar PymesHub en Costa Rica con trazabilidad comercial y fiscal.",
    purpose: "Alinear producto, pricing, comprobantes, ajustes y coordinación con contador.",
    category: "business",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/business/costa-rica-tax-invoicing-guide.md",
    highlights: [
      "Inscripción fiscal, actividad económica y facturación electrónica",
      "Suscripciones, upgrades, downgrades y notas de crédito",
      "Evidencia mínima para conciliar cliente, plan, pago y comprobante",
    ],
  },
  {
    slug: "pricing-billing-policy",
    title: "Pricing y Billing",
    summary: "Reglas operativas para planes, cobro, descuentos, mora, suspensión y reactivación.",
    purpose: "Mantener una única lógica entre ventas, facturación, soporte y producto.",
    category: "business",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/business/pricing-billing-policy.md",
    highlights: [
      "Ciclos de cobro y límites por plan",
      "Upgrades, downgrades, prorrateos y descuentos",
      "Mora, suspensión y reactivación del servicio",
    ],
  },
  {
    slug: "trust-center-overview",
    title: "Trust Center Overview",
    summary: "Resumen público de controles de acceso, continuidad operativa, documentación legal y postura general de seguridad.",
    purpose: "Acelerar revisiones de IT, seguridad y compras sin depender de explicaciones ad hoc en cada proceso.",
    category: "security",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/security/trust-center-overview.md",
    highlights: [
      "Acceso estructurado, trazabilidad operativa y referencias de soporte",
      "SLA, privacidad, DPA y material legal público al alcance",
      "Puente entre evaluación comercial, seguridad y procurement",
    ],
  },
  {
    slug: "security-policy",
    title: "Política de Seguridad",
    summary: "Marco general de seguridad de la información de PymesHub.",
    purpose: "Definir controles preventivos, detectivos y correctivos sobre servicio, datos y operación.",
    category: "security",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/security/security-policy.md",
    highlights: [
      "Principios de menor privilegio y segregación multi-tenant",
      "Controles sobre ambientes, secretos, logging y vendors",
      "Excepciones, evidencias y revisión periódica",
    ],
  },
  {
    slug: "incident-response-policy",
    title: "Respuesta a Incidentes",
    summary: "Procedimiento para detectar, clasificar, contener, investigar y comunicar incidentes.",
    purpose: "Permitir una respuesta consistente ante eventos de seguridad o disponibilidad.",
    category: "security",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/security/incident-response-policy.md",
    highlights: [
      "Severidades SEV-1 a SEV-4 y tiempos objetivo",
      "Contención, preservación de evidencia e investigación",
      "Comunicación a clientes y expediente mínimo del incidente",
    ],
  },
  {
    slug: "access-control-policy",
    title: "Control de Acceso",
    summary: "Reglas de alta, baja, cambio y revisión de accesos al producto y a la infraestructura.",
    purpose: "Asegurar menor privilegio, trazabilidad y revocación oportuna.",
    category: "security",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/security/access-control-policy.md",
    highlights: [
      "Roles OWNER, ADMIN, AGENT y VIEWER",
      "Accesos internos, temporales y de soporte",
      "Revisiones periódicas y revocación inmediata al cerrar acceso",
    ],
  },
  {
    slug: "data-retention-and-deletion-policy",
    title: "Retención y Eliminación",
    summary: "Criterios de retención, anonimización y borrado por categoría de datos.",
    purpose: "Evitar retención indefinida no justificada y ordenar servicio activo, baja y backups.",
    category: "security",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/security/data-retention-and-deletion-policy.md",
    highlights: [
      "Usuarios, conversaciones, documentos, OCR, logs e IA",
      "Borrado físico, supresión lógica y anonimización",
      "Diferencia entre datos activos y copias residuales",
    ],
  },
  {
    slug: "workspace-launch-guide",
    title: "Workspace Launch Guide",
    summary: "Guía pública para arrancar un workspace con roles, canales, documentación y seguimiento inicial.",
    purpose: "Dar a equipos nuevos una referencia clara para activar el workspace con menos fricción y más orden.",
    category: "operations",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "docs/operations/workspace-launch-guide.md",
    highlights: [
      "Checklist de preparación antes del go-live",
      "Roles, canales y handoffs mínimos para operar con claridad",
      "Referencias rápidas a soporte, SLA y documentos de confianza",
    ],
  },
  {
    slug: "support-policy",
    title: "Política de Soporte",
    summary: "Canales, prioridades, escalamiento y cierre de solicitudes de soporte.",
    purpose: "Dar al cliente y al equipo una regla clara sobre cómo se atienden casos operativos.",
    category: "operations",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "docs/operations/support-policy.md",
    highlights: [
      "Canales autorizados y horario de atención",
      "Prioridades P1 a P4 y tiempos orientativos",
      "Registro mínimo, escalamiento y exclusiones del soporte base",
    ],
  },
  {
    slug: "sla",
    title: "SLA Base",
    summary: "Objetivo de disponibilidad y criterio operativo para incidentes severos.",
    purpose: "Comunicar cómo PymesHub entiende disponibilidad, mantenimiento e incidentes.",
    category: "operations",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "docs/operations/sla.md",
    highlights: [
      "Disponibilidad objetivo mensual",
      "Exclusiones por terceros, fuerza mayor o uso indebido",
      "Tratamiento prioritario de incidentes críticos",
    ],
  },
  {
    slug: "onboarding-process",
    title: "Onboarding de Clientes",
    summary: "Proceso de alta de workspace, aceptación documental y configuración inicial.",
    purpose: "Estandarizar la activación inicial del cliente y sus evidencias mínimas.",
    category: "operations",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/operations/onboarding-process.md",
    highlights: [
      "Entradas mínimas para arrancar onboarding",
      "Alta del workspace, roles, canales y aceptación documental",
      "Criterios de cierre del proceso y evidencia",
    ],
  },
  {
    slug: "offboarding-process",
    title: "Offboarding de Clientes",
    summary: "Procedimiento de salida del cliente con exportación, cierre, retención y evidencia.",
    purpose: "Gestionar bajas sin perder control de datos, saldos o riesgos.",
    category: "operations",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/operations/offboarding-process.md",
    highlights: [
      "Cancelación, verificación y revisión de saldos",
      "Exportación, periodo de gracia y cierre técnico",
      "Decisión de borrado o retención residual",
    ],
  },
  {
    slug: "legal-acceptance-requirements",
    title: "Aceptación Legal en Producto",
    summary: "Especificación de cómo el producto debe registrar aceptación de documentos legales.",
    purpose: "Convertir la aceptación documental en evidencia técnica verificable.",
    category: "product-compliance",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/product-compliance/legal-acceptance-requirements.md",
    highlights: [
      "Registro documental versionado",
      "Evento de aceptación con usuario, workspace y versión",
      "Re-aceptación al cambiar documentos materiales",
    ],
  },
  {
    slug: "audit-logging-requirements",
    title: "Audit Logging",
    summary: "Eventos y campos mínimos que el producto debe auditar.",
    purpose: "Asegurar trazabilidad de acciones críticas para soporte, seguridad y cumplimiento.",
    category: "product-compliance",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/product-compliance/audit-logging-requirements.md",
    highlights: [
      "Login, cambios de rol, documentos, exportación y automatizaciones",
      "Actor, workspace, objeto, resultado y timestamp",
      "Reglas para no filtrar secretos ni payload sensible innecesario",
    ],
  },
  {
    slug: "ai-usage-and-disclosure",
    title: "Uso de IA y Disclosure",
    summary: "Qué debe informar PymesHub al usar IA y qué controles mínimos debe sostener.",
    purpose: "Reducir sobreuso de datos y confusión sobre outputs automatizados.",
    category: "product-compliance",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/product-compliance/ai-usage-and-disclosure.md",
    highlights: [
      "Minimización de contexto enviado a modelos",
      "Disclosures claros en UI y documentación",
      "Separación entre output automatizado y decisión humana final",
    ],
  },
  {
    slug: "multi-tenant-data-isolation-notes",
    title: "Aislamiento Multi-tenant",
    summary: "Requisitos de scoping, autorización y pruebas para evitar acceso cruzado entre workspaces.",
    purpose: "Convertir el aislamiento multi-tenant en criterio verificable de producto.",
    category: "product-compliance",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/product-compliance/multi-tenant-data-isolation-notes.md",
    highlights: [
      "Filtro obligatorio por workspace y control por rol",
      "Zonas de riesgo como workers, storage y reportes",
      "Pruebas negativas de acceso cruzado",
    ],
  },
  {
    slug: "windows-installer-license-requirements",
    title: "Instalación Windows y Licencia",
    summary: "Requisitos para mostrar licencia, privacidad y aceptación en un instalador Windows futuro.",
    purpose: "Dejar explícito que una distribución Windows debe mostrar la capa legal durante el setup.",
    category: "product-compliance",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/product-compliance/windows-installer-license-requirements.md",
    highlights: [
      "Mostrar licencia y privacidad antes de finalizar la instalación",
      "Identificar proveedor, soporte y telemetría si existe",
      "Documentar la aceptación cuando el modelo legal lo requiera",
    ],
  },
  {
    slug: "data-flow-diagram",
    title: "Flujo de Datos",
    summary: "Mapa narrativo y visual de entradas, procesamiento, almacenamiento y salida de datos.",
    purpose: "Apoyar revisión de cumplimiento, arquitectura y terceros.",
    category: "architecture",
    visibility: "internal",
    audience: "Interno",
    repoPath: "docs/architecture/data-flow-diagram.md",
    highlights: [
      "Entradas desde frontend y canales externos",
      "API, base de datos, storage, OCR, IA y monitoreo",
      "Puntos de salida, backups y notas de cumplimiento",
    ],
  },
];

export function getDocumentationBySlug(slug: string) {
  return DOCUMENTATION_ENTRIES.find((entry) => entry.slug === slug);
}

export function getDocumentationByCategory(category: DocumentationCategory) {
  return DOCUMENTATION_ENTRIES.filter((entry) => entry.category === category);
}

export function getPublicDocumentation() {
  return DOCUMENTATION_ENTRIES.filter((entry) => entry.visibility === "public");
}
