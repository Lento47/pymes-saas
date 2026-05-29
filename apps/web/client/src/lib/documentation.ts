export type DocumentationCategory =
  | "legal"
  | "business"
  | "security"
  | "operations"
  | "product-compliance"
  | "architecture";

export type DocumentationVisibility = "public" | "internal";

export interface DocumentationSection {
  title: string;
  body: string[];
}

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
  sections?: DocumentationSection[];
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
    title: "Términos y Condiciones de PymesHub",
    summary: "Condiciones profesionales para el acceso anticipado, uso beta, cuentas, datos, integraciones, pagos futuros, propiedad intelectual y responsabilidad.",
    purpose: "Gobernar la relación contractual entre PymesHub y cada cliente o usuario autorizado durante la etapa beta y el uso posterior de la Plataforma.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/terms-and-conditions.md",
    highlights: [
      "Acceso anticipado gratuito durante beta cerrada",
      "Uso empresarial por usuarios mayores de 18 años",
      "Servicio en desarrollo activo, prestado tal cual y según disponibilidad",
      "Datos del negocio pertenecen al cliente y se procesan para prestar el servicio",
      "Integraciones sujetas a reglas de terceros, incluyendo WhatsApp Business",
      "Planes pagados futuros con aviso previo antes de cualquier cobro",
    ],
    sections: [
      {
        title: "1. Bienvenido a PymesHub",
        body: [
          'Estos Términos y Condiciones ("Términos") regulan el acceso y uso de la plataforma PymesHub ("Servicio"), operada por Otnel S.A. ("PymesHub", "nosotros"). Al registrarte, acceder o utilizar el Servicio, aceptas estos Términos en nombre propio o de la empresa que representas.',
          "PymesHub se encuentra en etapa beta cerrada y acceso anticipado. Esto significa que la Plataforma está en desarrollo activo, que algunas funcionalidades pueden cambiar, estar limitadas, suspenderse temporalmente o presentar errores, y que el objetivo principal de esta etapa es validar el producto con negocios reales antes del lanzamiento público.",
        ],
      },
      {
        title: "2. Elegibilidad y representación",
        body: [
          "Puedes utilizar el Servicio si eres mayor de 18 años, actúas en representación de una empresa, emprendimiento, pyme o actividad empresarial legítima, y no has sido suspendido previamente por incumplimiento de estos Términos.",
          "Si aceptas estos Términos por cuenta de una organización, declaras que tienes autorización suficiente para vincularla. La organización será responsable por el uso que realicen sus usuarios, empleados, contratistas o representantes autorizados dentro del workspace.",
        ],
      },
      {
        title: "3. Cuenta, seguridad y uso autorizado",
        body: [
          "Eres responsable de proporcionar información veraz, mantener tus credenciales protegidas, administrar correctamente los accesos de tu equipo y notificarnos sin demora si detectas uso no autorizado, pérdida de credenciales o actividad sospechosa.",
          "Podemos considerar válidas las acciones realizadas desde una cuenta autenticada, salvo que exista evidencia razonable de compromiso de seguridad. PymesHub podrá suspender accesos cuando sea necesario para proteger la Plataforma, a otros usuarios o los datos tratados en el Servicio.",
        ],
      },
      {
        title: "4. Servicio beta y ausencia de garantías absolutas",
        body: [
          'Durante la etapa beta, el Servicio se proporciona "tal cual" y "según disponibilidad". No garantizamos disponibilidad continua, ausencia total de errores, compatibilidad permanente con todos los sistemas de terceros ni adecuación para un propósito específico no acordado expresamente.',
          "Las métricas, alertas, estimaciones, resúmenes, reportes o proyecciones mostradas en la Plataforma son referenciales. No constituyen asesoría financiera, legal, fiscal ni garantía de resultados comerciales para tu negocio.",
        ],
      },
      {
        title: "5. Datos del cliente, privacidad e integraciones",
        body: [
          "Los datos que ingreses, conectes o proceses en PymesHub, incluyendo mensajes, contactos, facturas, documentos, leads, notas y datos de tus clientes finales, pertenecen a tu negocio o quedan bajo tu control. No vendemos esos datos ni los utilizamos para fines ajenos a prestar, proteger, soportar o mejorar razonablemente el Servicio.",
          "Si conectas PymesHub con WhatsApp, correo electrónico, facturación electrónica u otros servicios de terceros, nos autorizas a acceder y procesar la información necesaria en tu nombre para prestar las funcionalidades habilitadas. También aceptas cumplir las reglas, políticas y restricciones de cada proveedor integrado.",
          "El tratamiento de datos personales se rige por nuestra Política de Privacidad y, cuando corresponda, por un acuerdo de encargado de tratamiento o DPA aplicable.",
        ],
      },
      {
        title: "6. Obligaciones del usuario",
        body: [
          "No puedes utilizar el Servicio para actividades ilegales, fraudulentas, engañosas, abusivas, invasivas de la privacidad, envío de spam, mensajes masivos no solicitados, malware, phishing, infracción de derechos de terceros o manipulación de datos de otros usuarios.",
          "Tampoco puedes intentar vulnerar la seguridad de la Plataforma, evadir límites técnicos o comerciales, realizar scraping no autorizado, someter el Servicio a cargas excesivas sin consentimiento o usar salidas de IA como decisión final en asuntos sensibles sin revisión humana adecuada.",
        ],
      },
      {
        title: "7. Planes, pagos y acceso anticipado",
        body: [
          "Durante la beta cerrada, el acceso anticipado puede ofrecerse de forma gratuita. PymesHub podrá introducir planes de pago, límites comerciales o suscripciones en el futuro, pero notificará con al menos [30] días de anticipación antes de iniciar cualquier cobro aplicable a usuarios beta.",
          "Cuando existan planes pagados, las tarifas, impuestos, ciclos de facturación, renovaciones, cancelaciones, downgrades, reembolsos y comprobantes se regirán por la oferta comercial vigente y por las políticas publicadas en el sitio o comunicadas al cliente.",
        ],
      },
      {
        title: "8. Propiedad intelectual y feedback",
        body: [
          "PymesHub, su software, interfaces, diseño, documentación, marca, arquitectura, flujos, materiales y componentes relacionados son propiedad de Otnel S.A. o de sus licenciantes. Te otorgamos una licencia limitada, no exclusiva, intransferible y revocable para usar el Servicio conforme a estos Términos.",
          "Si compartes sugerencias, comentarios o ideas durante la beta, autorizas a PymesHub a utilizarlos para mejorar el producto sin obligación de compensación, salvo acuerdo escrito distinto.",
        ],
      },
      {
        title: "9. Limitación de responsabilidad",
        body: [
          "En la máxima medida permitida por la ley aplicable, PymesHub no será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo pérdida de ingresos, datos, clientes, oportunidades de negocio, reputación o beneficios esperados.",
          "Nuestra responsabilidad total por cualquier reclamo relacionado con el Servicio se limitará al monto pagado por ti en los [6] meses anteriores al hecho que generó la reclamación o a [USD $100] si no has realizado pagos, salvo dolo, culpa grave o disposición legal imperativa en contrario.",
          "Dado que el Servicio se encuentra en etapa beta, aceptas que pueden existir fallos, interrupciones, cambios funcionales, indisponibilidad temporal o errores de procesamiento propios de un producto en desarrollo.",
        ],
      },
      {
        title: "10. Confidencialidad, cambios y contacto",
        body: [
          "La información no pública compartida entre las partes en el contexto de la beta será tratada como confidencial y no será revelada a terceros salvo autorización, necesidad operativa con proveedores sujetos a confidencialidad u obligación legal.",
          "Podemos actualizar estos Términos para reflejar cambios del producto, de la operación o del marco legal. Los cambios relevantes serán comunicados por correo, aviso en la plataforma o publicación visible. El uso continuado del Servicio después de la notificación implica aceptación de la versión vigente.",
          "Para consultas legales o contractuales, escríbenos a privacidad@pymeshub.lat. La jurisdicción, domicilio legal y entidad operadora quedan pendientes de completar: Costa Rica, pymeshub.lat, Otnel S.A..",
        ],
      },
    ],
  },
  {
    slug: "privacy-policy",
    title: "Política de Privacidad de PymesHub",
    summary: "Cómo PymesHub recopila, usa, conserva, comparte y protege datos personales durante la beta cerrada y el uso de la Plataforma.",
    purpose: "Explicar de forma clara y profesional el tratamiento de datos personales, datos de negocio y datos de clientes finales procesados a través de PymesHub.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/privacy-policy.md",
    highlights: [
      "Identidad del responsable y datos de contacto",
      "Categorías de datos, finalidades y base de legitimación",
      "Destinatarios, proveedores y transferencias internacionales",
      "Derechos del titular y procedimiento de respuesta",
      "Medidas de seguridad, retención y notificación de incidentes",
      "Cookies, cambios en la política y contacto de privacidad",
    ],
    sections: [
      {
        title: "1. Responsable del tratamiento",
        body: [
          "Esta Política de Privacidad explica cómo Otnel S.A. opera PymesHub y trata datos personales en relación con el sitio web, formularios de acceso anticipado, cuentas beta, workspaces, integraciones y funcionalidades de la Plataforma.",
          "El canal de contacto para consultas de privacidad, solicitudes de titulares o reportes de incidentes es privacidad@pymeshub.lat. La dirección física, jurisdicción y entidad legal final se mantienen como campos pendientes: Costa Rica, pymeshub.lat, Otnel S.A..",
        ],
      },
      {
        title: "2. Datos que recopilamos",
        body: [
          "Podemos recopilar datos que nos entregas al registrarte o contactarnos, como nombre, apellido, correo electrónico, teléfono, empresa, cargo, país, mensaje enviado por formulario, WhatsApp o correo, y cualquier dato que decidas compartir durante conversaciones comerciales o de soporte.",
          "Cuando usas PymesHub, podemos procesar datos de cuenta, autenticación, workspace, roles, configuración, mensajes, correos vinculados, contactos, leads, facturas, documentos, adjuntos, notas, tareas, actividad de uso, dirección IP, identificadores técnicos y registros necesarios para seguridad, soporte y diagnóstico.",
          "Si conectas canales de comunicación, correo, WhatsApp, facturación electrónica u otras integraciones, podemos procesar datos de tus clientes finales en tu nombre. En ese caso, tú actúas como responsable de esos datos y PymesHub actúa como encargado o procesador, según el marco legal aplicable.",
        ],
      },
      {
        title: "3. Finalidades del tratamiento",
        body: [
          "Tratamos datos para crear y administrar cuentas, operar workspaces, prestar la bandeja unificada, gestionar contactos, documentos, facturas, automatizaciones, notificaciones, soporte, seguridad, prevención de abuso, diagnóstico de errores y mejora razonable del producto.",
          "Durante la beta cerrada también podemos utilizar información agregada, anonimizada o estadística para entender necesidades reales de las pymes, priorizar funcionalidades, medir estabilidad y mejorar la experiencia. Esa información no debe identificar directamente a tu empresa, usuarios o clientes finales.",
        ],
      },
      {
        title: "4. Base legal y responsabilidad del cliente",
        body: [
          "El tratamiento puede basarse en la ejecución de una relación contractual o precontractual, consentimiento cuando corresponda, cumplimiento de obligaciones legales e interés legítimo en operar, proteger, auditar y mejorar el Servicio.",
          "Cuando subes, conectas o gestionas datos de tus clientes finales, eres responsable de contar con una base legal válida, informar a tus clientes cuando corresponda, respetar sus derechos y cumplir las reglas de los canales integrados, especialmente políticas de WhatsApp Business, correo y facturación electrónica.",
        ],
      },
      {
        title: "5. Proveedores y terceros",
        body: [
          "No vendemos datos personales. Podemos compartir datos con proveedores de infraestructura, hosting, base de datos, almacenamiento, correo transaccional, monitoreo, soporte, analítica, pagos, IA, OCR o integraciones necesarias para prestar el Servicio.",
          "Cuando una integración es habilitada por el cliente, los datos necesarios pueden ser enviados al proveedor correspondiente para ejecutar la funcionalidad solicitada. Cada proveedor puede estar sujeto a sus propios términos, políticas y regiones de tratamiento.",
        ],
      },
      {
        title: "6. Conservación y eliminación",
        body: [
          "Conservamos datos de cuenta mientras la cuenta o workspace esté activo y durante los periodos necesarios para soporte, seguridad, auditoría, facturación, cumplimiento legal, defensa de reclamaciones o continuidad operativa.",
          "Si cancelas tu cuenta o solicitas eliminación, procesaremos la solicitud conforme a las obligaciones legales, contractuales y técnicas aplicables. Las copias de seguridad pueden conservar datos por un periodo adicional limitado antes de su rotación o eliminación técnica.",
        ],
      },
      {
        title: "7. Derechos de privacidad",
        body: [
          "Según la ley aplicable, puedes solicitar acceso, rectificación, actualización, eliminación, oposición, portabilidad, limitación o revocación de consentimiento escribiendo a privacidad@pymeshub.lat. Podremos pedir información razonable para verificar identidad y contexto de la solicitud.",
          "Si recibimos una solicitud relacionada con datos de clientes finales que procesamos por cuenta de un cliente, podremos remitirla al cliente responsable o asistir técnicamente cuando corresponda.",
        ],
      },
      {
        title: "8. Seguridad",
        body: [
          "Aplicamos medidas técnicas y organizativas razonables para proteger los datos, incluyendo cifrado en tránsito, controles de acceso, separación lógica por workspace, registros de actividad, backups, restricciones administrativas y prácticas de respuesta a incidentes.",
          "Ningún sistema es completamente infalible. Si detectamos una brecha de seguridad que pueda afectar datos personales, evaluaremos el alcance, aplicaremos medidas de contención y notificaremos a los afectados o autoridades cuando corresponda por ley o contrato.",
        ],
      },
      {
        title: "9. Cookies y tecnologías similares",
        body: [
          "Podemos utilizar cookies esenciales para autenticación, seguridad y funcionamiento del sitio. Si utilizamos cookies analíticas, de preferencias o marketing no esenciales, se gestionarán mediante mecanismos de consentimiento cuando la ley aplicable lo requiera.",
          "La configuración específica de cookies, proveedores y duración debe completarse antes del lanzamiento público definitivo si se incorporan herramientas no esenciales.",
        ],
      },
      {
        title: "10. Cambios y contacto",
        body: [
          "Podemos actualizar esta Política para reflejar cambios del producto, proveedores, medidas de seguridad, leyes aplicables o forma de operar la beta. La versión vigente será publicada con fecha o identificador de actualización.",
          "Para consultas, solicitudes de privacidad o reportes de seguridad, contáctanos en privacidad@pymeshub.lat. Campos pendientes para completar antes del lanzamiento público: Otnel S.A., Costa Rica, pymeshub.lat.",
        ],
      },
    ],
  },
  {
    slug: "data-processing-addendum",
    title: "Data Processing Addendum (DPA)",
    summary: "Reglas vinculantes cuando el cliente es responsable y PymesHub actúa como encargado del tratamiento.",
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
    summary: "Conductas permitidas y prohibidas al usar PymesHub, sus integraciones y canales.",
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
    slug: "cancellation-refund-policy",
    title: "Cancelación y Reembolsos",
    summary: "Ciclos de cobro, renovación, impuestos, cancelación, downgrade y política de reembolsos.",
    purpose: "Establecer reglas claras y predecibles sobre los aspectos económicos del servicio.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/cancellation-refund-policy.md",
    highlights: [
      "Planes, ciclos de facturación y renovación automática",
      "Impuestos aplicables y emisión de comprobantes electrónicos",
      "Reembolsos y ventana de cancelación",
      "Chargebacks, downgrades y upgrades",
    ],
  },
  {
    slug: "subprocessors-list",
    title: "Aviso de Subencargados",
    summary: "Lista pública de terceros que tratan datos por cuenta de PymesHub, con función, categorías y región.",
    purpose: "Dar transparencia sobre la cadena de tratamiento y permitir al cliente evaluar riesgos.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/security/subprocessors-list.md",
    highlights: [
      "Proveedor, función, categorías de datos y región de tratamiento",
      "Base contractual aplicable con cada subencargado",
      "Procedimiento de actualización y aviso previo al cliente",
      "Derecho de objeción por motivos razonables de privacidad",
    ],
  },
  {
    slug: "whatsapp-ai-policy",
    title: "Política de Canales de Comunicación e IA",
    summary: "Reglas de uso de WhatsApp, Telegram, correo electrónico, Signal (próximamente) y funcionalidades asistidas por inteligencia artificial.",
    purpose: "Proteger a los usuarios finales y asegurar cumplimiento con Meta, Telegram, proveedores de correo, Signal y buenas prácticas de IA.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "docs/legal/whatsapp-ai-policy.md",
    highlights: [
      "Opt-in obligatorio y verificable para mensajes en todos los canales",
      "Respeto de opt-out y ventanas de conversación por canal",
      "Reglas específicas para WhatsApp, Telegram y correo electrónico",
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
      "Cookies estrictamente necesarias para sesión y seguridad",
      "Cookies de analítica (Google Analytics) con consentimiento",
      "Banner de consentimiento granular con preferencias",
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
  {
    slug: "whatsapp-billing-model",
    title: "Modelo de facturación de WhatsApp y Telegram",
    summary: "Cómo se cobran los mensajes de WhatsApp Business y Telegram en PymesHub: quién paga a Meta y qué incluye la suscripción.",
    purpose: "Aclarar a clientes y operadores qué cargos gestiona PymesHub y cuáles corresponden directamente al negocio ante Meta.",
    category: "business",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "docs/business/whatsapp-billing-model.md",
    highlights: [
      "PymesHub opera como capa de software/API — no revende mensajes de WhatsApp",
      "Los cargos por mensajes de plantilla (templates) los cobra Meta directamente a la cuenta WABA del cliente",
      "El cliente debe tener un método de pago activo en su Meta Business Manager para enviar plantillas",
      "Telegram no genera cargos adicionales por mensajes en uso normal de Bot API",
      "PymesHub cobra únicamente el plan SaaS y créditos de IA",
    ],
    sections: [
      {
        title: "WhatsApp Business",
        body: [
          "PymesHub se conecta con la cuenta de WhatsApp Business (WABA) propia del cliente mediante WhatsApp Business Cloud API y Embedded Signup de Meta. PymesHub actúa como capa de software: envía y recibe mensajes, gestiona el inbox y ejecuta automatizaciones en nombre del cliente.",
          "Los cargos por mensajes de plantilla (Utility, Marketing, Authentication) son establecidos y cobrados por Meta directamente a la cuenta WABA del cliente. PymesHub no financia ni re-vende esos cargos. El cliente debe mantener un método de pago activo en su Meta Business Manager para poder enviar plantillas.",
          "Si una plantilla falla por ausencia de método de pago, PymesHub mostrará un mensaje específico indicando que la cuenta de Meta requiere configuración de pago — no un error genérico.",
          "Los mensajes dentro de la ventana de servicio de 24 horas (respuestas a mensajes iniciados por el usuario) generalmente no tienen costo de plantilla, pero esto depende de las políticas actuales de Meta y puede variar.",
        ],
      },
      {
        title: "Telegram",
        body: [
          "Telegram Bot API es gratuita para uso normal. El cliente crea un bot con @BotFather, pega el token en PymesHub, y PymesHub configura el webhook. Telegram no cobra por conversación ni por mensaje en este modelo.",
          "El uso de IA en conversaciones de Telegram consume créditos IA de PymesHub (si el workspace tiene un agente IA activo con channel_scope TELEGRAM o ALL). Los créditos IA están incluidos según el plan o add-on contratado.",
          "Para bots de volumen muy alto (más de 30 mensajes por segundo sostenidos), Telegram tiene un modelo de Paid Broadcasts que requiere condiciones específicas que no aplican al uso operativo normal de una PyME.",
        ],
      },
      {
        title: "Qué incluye la suscripción de PymesHub",
        body: [
          "La suscripción de PymesHub incluye: plan de software (inbox, CRM, facturación, automatizaciones), infraestructura de API, almacenamiento, soporte de la plataforma y créditos de IA según el plan.",
          "No incluye: cargos por mensajes de plantilla de Meta WhatsApp, costos de otros proveedores que el cliente conecte independientemente, ni saldo de campañas.",
        ],
      },
    ],
  },
  {
    slug: "ai-agents",
    title: "Agentes IA — Flowise y soporte por tiers",
    summary: "Cómo funcionan los agentes IA de PymesHub: provisión en Flowise, alcance por canal, tiers de soporte técnico y ciclo de vida.",
    purpose: "Documentar la arquitectura de agentes IA para clientes que quieren entender qué puede hacer cada agente y cómo configurarlos.",
    category: "architecture",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "docs/agents/ai-agents-overview.md",
    highlights: [
      "Cada agente IA es un agentflow en Flowise provisionado automáticamente al crear o activar el agente",
      "Los agentes se limitan por canal: ALL, WHATSAPP, TELEGRAM, EMAIL, WEB o MANUAL",
      "El LLM orquestador selecciona el agente correcto según el contexto de la conversación",
      "Soporte técnico de la plataforma en 4 tiers según el plan del workspace",
      "Tier 4 (Business+) puede crear branches, commits y PRs automáticamente para resolver incidentes",
    ],
    sections: [
      {
        title: "Ciclo de vida de un agente",
        body: [
          "Al crear un agente en PymesHub (Settings > Agentes IA), el sistema provisiona automáticamente un agentflow en Flowise con las instrucciones del sistema definidas por el usuario. El agente inicia en estado DRAFT.",
          "Al activar el agente (botón Play), su estado cambia a ACTIVE. Solo los agentes ACTIVE participan en conversaciones. Pueden desactivarse en cualquier momento (estado INACTIVE) sin borrar el chatflow en Flowise.",
          "Al eliminar un agente, PymesHub borra también el chatflow correspondiente en Flowise para mantener consistencia.",
        ],
      },
      {
        title: "Alcance por canal (channel_scope)",
        body: [
          "Cada agente tiene un channel_scope que determina en qué canales puede responder: ALL (todos), WHATSAPP, TELEGRAM, EMAIL, WEB o MANUAL.",
          "Cuando llega un mensaje, el orquestador consulta los agentes ACTIVE con channel_scope compatible y le presenta la lista al LLM. El LLM decide si delegar al agente o responder directamente.",
          "Si el agente tiene una descripción clara de su propósito, el LLM puede seleccionarlo con mayor precisión.",
        ],
      },
      {
        title: "Soporte técnico por tiers",
        body: [
          "PymesHub incluye un sistema de soporte técnico IA accesible desde Settings > Soporte. Los 5 agentes especializados (WhatsApp, Telegram, Facturación, Agentes IA, Workspace) están respaldados por agentflows en Flowise.",
          "El tier de soporte depende del plan del workspace: Tier 1 (Free) solo confirma recepción. Tier 2 (Starter) lee logs de Railway y extrae errores. Tier 3 (Business) además lee código fuente y detecta regresiones, proponiendo fixes para aprobación manual. Tier 4 (Business+) aplica fixes automáticamente creando un PR en draft.",
          "Todo PR generado por un agente Tier 4 es forzado a draft y lleva las etiquetas ai-generated y needs-human-review. Los agentes nunca hacen merge, nunca force-push, y no pueden tocar archivos sensibles (.env, CI, credenciales).",
        ],
      },
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
