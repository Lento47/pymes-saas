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
    slug: "terms-and-conditions",
    title: "Términos y Condiciones",
    summary: "Reglas generales de acceso, uso, licenciamiento, pagos, suspensión y responsabilidad.",
    purpose: "Explicar al cliente qué compra, bajo qué reglas usa PymeHub y cuáles son los límites del servicio.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/terms-and-conditions.md",
    highlights: [
      "Identidad del proveedor y naturaleza SaaS del servicio",
      "Roles del cliente, workspace, usuarios y restricciones de uso",
      "Pagos, disponibilidad, OCR, IA, suspensión y terminación",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Política de Privacidad",
    summary: "Cómo PymeHub recopila, usa, conserva y protege datos personales.",
    purpose: "Dar transparencia sobre categorías de datos, finalidades, subprocesadores, derechos y seguridad.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/privacy-policy.md",
    highlights: [
      "Datos de cuenta, workspace, documentos, OCR, IA y soporte",
      "Bases de tratamiento, retención, transferencias y derechos",
      "Relación entre cliente responsable y PymeHub como encargado",
    ],
  },
  {
    slug: "master-service-agreement",
    title: "Master Service Agreement (MSA)",
    summary: "Contrato base B2B para suscripciones, soporte, seguridad, datos y responsabilidad.",
    purpose: "Servir como marco contractual principal para clientes corporativos y órdenes de servicio.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/master-service-agreement.md",
    highlights: [
      "Jerarquía entre MSA, órdenes de servicio, DPA y términos",
      "Obligaciones del proveedor y del cliente",
      "Soporte, confidencialidad, seguridad, terceros y limitación de responsabilidad",
    ],
  },
  {
    slug: "data-processing-addendum",
    title: "Data Processing Addendum (DPA)",
    summary: "Reglas de tratamiento de datos cuando el cliente es responsable y PymeHub es encargado.",
    purpose: "Aterrizar roles, instrucciones, subprocesadores, medidas de seguridad e incidentes de datos.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/data-processing-addendum.md",
    highlights: [
      "Roles de responsable, encargado y subencargado",
      "Instrucciones documentadas y medidas de seguridad",
      "Asistencia al cliente, incidentes, exportación y supresión",
    ],
  },
  {
    slug: "cancellation-refund-policy",
    title: "Cancelación y Reembolsos",
    summary: "Cómo se cancela el servicio, qué pasa con facturación, exportación, cierre y borrado.",
    purpose: "Evitar ambigüedad sobre fecha efectiva de baja, reembolsos y tratamiento de datos al salir.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/cancellation-refund-policy.md",
    highlights: [
      "Fecha de efecto de la cancelación y política de reembolsos",
      "Exportación de datos, periodo de gracia y cierre del workspace",
      "Backups residuales y terminación por incumplimiento o riesgo",
    ],
  },
  {
    slug: "acceptable-use-policy",
    title: "Uso Aceptable",
    summary: "Conductas permitidas y prohibidas al usar PymeHub e integraciones asociadas.",
    purpose: "Restringir usos abusivos, ilegales o inseguros del servicio.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/acceptable-use-policy.md",
    highlights: [
      "Prohibición de spam, fraude, scraping y acceso cruzado entre tenants",
      "Uso indebido de OCR, IA, automatizaciones o APIs",
      "Consecuencias y facultades de suspensión o investigación",
    ],
  },
  {
    slug: "costa-rica-tax-invoicing-guide",
    title: "Guía Fiscal y de Facturación CR",
    summary: "Marco operativo para facturar PymeHub en Costa Rica con trazabilidad comercial y fiscal.",
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
    slug: "security-policy",
    title: "Política de Seguridad",
    summary: "Marco general de seguridad de la información de PymeHub.",
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
    purpose: "Comunicar cómo PymeHub entiende disponibilidad, mantenimiento e incidentes.",
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
    summary: "Qué debe informar PymeHub al usar IA y qué controles mínimos debe sostener.",
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
