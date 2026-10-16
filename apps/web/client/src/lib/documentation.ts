export type DocumentationCategory = "product" | "legal" | "business" | "security" | "operations" | "product-compliance";

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

export const DOCUMENTATION_CATEGORIES: Record<DocumentationCategory, { title: string; description: string }> = {
  product: {
    title: "Producto",
    description:
      "Qué es PymesHub hoy: el marketplace de comercio local y entregas, sus reglas, sus datos, su política de software y sus cambios. Todo en inglés y español.",
  },
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
    description: "Cómo se pide ayuda, qué se atiende y qué continuidad se ofrece.",
  },
  "product-compliance": {
    title: "Cumplimiento de producto",
    description: "Requisitos que el producto debe implementar para sostener lo prometido.",
  },
};

export const DOCUMENTATION_ENTRIES: DocumentationEntry[] = [
  {
    slug: "product-overview",
    title: "PymesHub: descripción general del producto",
    summary:
      "Qué es PymesHub hoy y cómo funciona: el marketplace de comercio local y entregas, quién le paga a quién, los planes, el ciclo de un pedido y quién puede hacer qué. En inglés y español.",
    purpose:
      "Dar a clientes, comercios, repartidores y compradores una referencia pública y verificable del producto actual, sin mezclarlo con la etapa SaaS anterior.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/pymeshub-overview.md",
    highlights: [
      "El cliente paga al negocio por los productos y al repartidor por la entrega; PymesHub cobra una tarifa fija, sin comisión por pedido",
      "Pago contra entrega en efectivo o SINPE Móvil; la tarjeta existe en el modelo pero no está habilitada",
      "Cinco planes (FREE, EMPRENDE, STARTER, GROWTH, BUSINESS) con precios en colones, IVA incluido",
      "El ciclo del pedido, sus estados, formas de entrega y quién puede mover cada paso",
      "Un solo backend: un Cloudflare Worker (Hono + tRPC) sobre D1, con web, iOS/Android y escritorio como clientes",
    ],
  },
  {
    slug: "getting-started",
    title: "Primeros pasos",
    summary:
      "Tres recorridos cortos — comprar, vender y repartir — paso por paso, con lo que el producto realmente pide y en el orden en que lo pide. En inglés y español.",
    purpose:
      "Dar a cada tipo de usuario un punto de entrada único que lleve del registro al primer pedido, al primer producto publicado o al primer viaje.",
    category: "product",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/docs/product/getting-started.md",
    highlights: [
      "Comprar: cuenta, búsqueda, carrito de un solo negocio, retiro o entrega, pago y reseña",
      "Vender: negocio, horarios, entrega y retiro, catálogo, equipo, repartidores y tablero de pedidos",
      "Repartir: perfil, verificación, ofertas de 2 minutos, los cuatro pasos del viaje y el cobro",
      "Qué necesita cada rol antes de empezar y qué hacer si algo no sale como se esperaba",
    ],
  },
  {
    slug: "ordering-and-tracking",
    title: "Pedir, pagar y seguir un pedido",
    summary:
      "El carrito y sus límites, el checkout y por qué puede rechazar un pedido, los tres pagos de un pedido a domicilio, el seguimiento en vivo y hasta dónde puede cancelar el cliente. En inglés y español.",
    purpose:
      "Explicar al comprador las reglas que aplica la plataforma en cada paso de un pedido, con las claves y los estados reales.",
    category: "product",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/docs/product/ordering-and-tracking.md",
    highlights: [
      "Un carrito pertenece a un solo negocio: 20 unidades por línea y 40 líneas como máximo",
      "Los totales los devuelve el servidor y el checkout no acepta precios del cliente",
      "Los diez motivos por los que el checkout puede rechazar un pedido",
      "Un pedido a domicilio son tres pagos, y con efectivo el repartidor cobra el total en la puerta",
      "La propina es del negocio; el cobro del repartidor es el costo de la entrega",
      "Hasta dónde llega el cliente al cancelar, estado por estado",
    ],
  },
  {
    slug: "selling-on-pymeshub",
    title: "Vender en PymesHub",
    summary:
      "Publicar un negocio, horarios y pausas por sucursal, ajustes de entrega, catálogo y promociones, roles e invitaciones del equipo, repartidores, el tablero de pedidos y la facturación. En inglés y español.",
    purpose:
      "Dar al comerciante una referencia verificable de lo que la plataforma aplica del lado del negocio.",
    category: "product",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/docs/product/selling-on-pymeshub.md",
    highlights: [
      "Solo los negocios ACTIVE y CLOSED son visibles; SUSPENDED lo decide la plataforma",
      "La categoría es obligatoria y debe ser una hoja de la taxonomía; la moneda queda fija al crear",
      "Dos radios distintos: el del negocio hacia el comprador y los 15 km de la plataforma hacia el repartidor",
      "La tabla de capacidades por rol y las invitaciones de 14 días, que nunca cubren COURIER",
      "Un repartidor verificado se invita y solo su aceptación crea la membresía",
      "Tarifa fija sin comisión por pedido y sin corridas de liquidación",
    ],
  },
  {
    slug: "delivering-on-pymeshub",
    title: "Repartir en PymesHub",
    summary:
      "Cómo se verifica un repartidor, cómo se le ofrece un viaje, cómo lo ejecuta, cómo comparte ubicación y cómo cobra, incluido el efectivo contra entrega. En inglés y español.",
    purpose:
      "Documentar el trabajo de reparto y su pago con las reglas reales de despacho y tarifa.",
    category: "product",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/docs/product/delivering-on-pymeshub.md",
    highlights: [
      "Ofertas a repartidores verificados a 15 km del retiro, con 2 minutos de vigencia",
      "El orden por ETA al retiro; la afinidad solo rompe una diferencia competitiva y la equidad usa 7 días",
      "La zona de trabajo fijada nunca cuenta como posición del repartidor",
      "Tarifa publicada: ₡850 base + ₡230 por km + ₡45 por minuto estimado",
      "Con efectivo, el repartidor cobra el total en la puerta y liquida la parte del negocio",
      "Calificación en ambas direcciones y estadísticas propias con conteos reales",
    ],
  },
  {
    slug: "how-discovery-and-ranking-work",
    title: "Cómo se encuentra y se ordena un negocio",
    summary:
      "Los filtros y órdenes de la tienda, la taxonomía de dos niveles y la regla `best`: sus tres señales, sus pesos versionados y lo que tiene prohibido leer. En inglés y español.",
    purpose:
      "Explicar de forma pública cómo se decide qué negocio se muestra y en qué orden.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/how-discovery-and-ranking-work.md",
    highlights: [
      "Filtros de búsqueda, categoría, radio, abierto ahora y solo con entrega, y los cinco órdenes",
      "`best-v1` es una media ponderada de distancia (0.4), calificación (0.4) y preparación (0.2)",
      "Faltante no es cero: un negocio sin reseñas entra con el prior de la plataforma (4.3)",
      "El orden orgánico nunca lee dinero: ni comisión, ni tarifa, ni pago",
      "El cliente ve un motivo, nunca el puntaje ni un peso",
      "La señal de preparación está documentada y todavía no se alimenta",
    ],
  },
  {
    slug: "data-and-privacy",
    title: "Datos y privacidad",
    summary:
      "Qué datos guarda PymesHub, dónde viven, quién los ve, cuánto duran y cómo se eliminan, en lenguaje claro. En inglés y español.",
    purpose:
      "Explicar de forma pública y verificable el tratamiento de datos del marketplace actual, sin jerga interna.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/data-and-privacy.md",
    highlights: [
      "Qué se guarda por cada cuenta, dirección, pedido, entrega, pago, reseña y reporte",
      "Dónde vive: base de datos, almacenamiento de archivos, caché, colas y respaldos del proveedor de nube",
      "Cuánto dura: ventanas anunciadas para cotizaciones, ofertas y ubicación en vivo; datos vinculados a la cuenta hasta que se elimina",
      "Qué se conserva sin identidad directa después de eliminar la cuenta y por qué",
      "Qué es público por diseño y qué nunca se devuelve (evidencia de verificación, notas internas)",
      "Controles del usuario: interruptores de avisos, permiso de ubicación, eliminación con 7 días de espera",
    ],
  },
  {
    slug: "supported-and-unsupported",
    title: "Qué está soportado y qué no",
    summary:
      "Plataformas, idiomas y funciones que PymesHub soporta hoy, y las que existen en el modelo pero están apagadas o fuera de alcance. En inglés y español.",
    purpose:
      "Evitar promesas ambiguas: una lista honesta de lo soportado, lo no soportado y lo pendiente.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/supported-and-unsupported.md",
    highlights: [
      "Web, iOS y Android soportados; escritorio en Windows; requisitos de sesión y de conexión",
      "Español como idioma por defecto e inglés disponible en toda la aplicación",
      "Efectivo y SINPE Móvil soportados; tarjeta no habilitada; no se procesan pagos en línea",
      "Funciones apagadas a propósito: descuentos dinámicos, recargos, tracking de preparación",
      "Lo que la plataforma no hace: vender, transportar, emplear repartidores ni retener el pago del cliente",
      "Nada de versiones anteriores: solo la versión actual recibe soporte y correcciones de seguridad",
    ],
  },
  {
    slug: "open-source-credits",
    title: "Créditos de software libre",
    summary:
      "El software libre y de código abierto que hace funcionar PymesHub, con su licencia y su papel, y cómo se citan sus avisos. En inglés y español.",
    purpose:
      "Dar crédito a los proyectos de los que depende el producto y dejar constancia de sus licencias.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/open-source-credits.md",
    highlights: [
      "El marco y las librerías principales de web, móvil, escritorio y backend",
      "Licencia y papel de cada proyecto, agrupados por capa",
      "El software propio de PymesHub se publica bajo licencia MIT",
      "Cómo se mantiene la lista y cómo se reportan avisos de licencia faltantes",
    ],
  },
  {
    slug: "software-policy",
    title: "Política de software",
    summary:
      "Quién es quién (Otnel y PymesHub), qué licencia tiene el software, qué se puede y qué no se puede hacer con la plataforma, la etapa beta y el idioma. En inglés y español.",
    purpose:
      "Reunir en un solo lugar público las reglas de uso del software, sin repetir el detalle de los documentos legales.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/software-policy.md",
    highlights: [
      "Otnel S.A. es la empresa; PymesHub es el producto; cada documento dice cuál de los dos habla",
      "El código propio se publica bajo licencia MIT, con aviso de copyright de Otnel",
      "Uso permitido y prohibido, cuentas y accesos, y conducta esperada",
      "Etapa beta y acceso anticipado: qué se promete y qué no",
      "Idioma de trabajo: español e inglés en la aplicación; documentos legales en los dos idiomas que publique el Centro Legal",
    ],
  },
  {
    slug: "changelog",
    title: "Registro de cambios",
    summary:
      "Los cambios que PymesHub fue publicando, en orden y en lenguaje de usuario, solo con información que ya es pública. En inglés y español.",
    purpose:
      "Dar a clientes y comercios un historial verificable de lo publicado, sin detalles internos ni correcciones sin divulgar.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/changelog.md",
    highlights: [
      "Qué cambió y cuándo, agrupado por fecha",
      "Solo información ya pública: cero detalles internos y cero correcciones sin divulgar",
      "Cómo se numera el producto y qué significa una versión mayor",
      "Dónde se anuncian los cambios y cómo seguir el historial",
    ],
  },
  {
    slug: "security-advisories",
    title: "Reportar problemas de seguridad y avisos",
    summary:
      "Cómo reportar una vulnerabilidad en privado, qué esperar, qué queda dentro y fuera del alcance, y cómo se publican los avisos. En inglés y español.",
    purpose:
      "Dar a quien investiga un canal privado y reglas claras, y publicar los avisos verificados sin exponer a los usuarios.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/security-advisories.md",
    highlights: [
      "Canales privados y qué incluir en el reporte",
      "Plazos objetivo de acuse, triage y corrección por severidad",
      "Alcance: qué probar y qué no, y qué queda fuera por completo",
      "Divulgación coordinada, créditos y puerto seguro",
      "Formato del identificador de avisos y dónde se publican",
    ],
  },
  {
    slug: "plans-and-billing",
    title: "Planes y facturación",
    summary:
      "Qué paga un negocio, los cinco planes con sus precios y periodicidades, qué pasa si se atrasa, qué no le quita nunca un plan y cómo funciona una factura. En inglés y español.",
    purpose:
      "Explicar la mecánica de cobro del marketplace sin comisiones, con precios en colones IVA incluido y reglas públicas de cambio de precio.",
    category: "product",
    visibility: "public",
    audience: "Cliente e interno",
    repoPath: "apps/web/client/src/data/docs/product/plans-and-billing.md",
    highlights: [
      "Tarifa fija por usar la aplicación, sin comisión por pedido ni retención del pago del cliente",
      "Precios en colones con IVA incluido: FREE, EMPRENDE, STARTER, GROWTH y BUSINESS, en mensual o anual",
      "Un año cuesta diez meses y los límites dependen solo del nivel, no de la periodicidad",
      "Qué pasa al atrasarse: 30 días de gracia, luego límites de FREE, y solo a los 90 días deja de listarse",
      "Lo que ningún plan quita: tomar pedidos, horarios, reseñas, ver tu facturación y eliminar la cuenta",
      "Subir un precio es una lista nueva: una suscripción conserva la suya",
    ],
  },
  {
    slug: "faq",
    title: "Preguntas frecuentes",
    summary:
      "Respuestas cortas sobre cuenta, compras, pedidos, entregas, pagos, planes, vender, repartir, privacidad y soporte, con los estados y los límites reales. En inglés y español.",
    purpose:
      "Resolver en un solo lugar las dudas repetidas de clientes, negocios y repartidores, enlazando a la página que trae el detalle.",
    category: "product",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/docs/product/faq.md",
    highlights: [
      "Edad mínima, eliminación de cuenta y qué necesita cada rol para empezar",
      "Por qué un carrito pertenece a un solo negocio y qué pasa si un cupón no aplica",
      "Los ocho estados de un pedido y hasta dónde llega el cliente al cancelar",
      "Efectivo y SINPE Móvil, sin comisión por pedido y sin pago con tarjeta",
      "Ofertas de 2 minutos a 15 km, pago del repartidor y hasta cuándo se comparte ubicación",
      "Qué documentos del Centro Legal son vinculantes y qué páginas son descriptivas",
    ],
  },

  {
    slug: "marketplace-terms",
    title: "Términos del Marketplace",
    summary:
      "Reglas del catálogo público de PymesHub: qué es la plataforma en un pedido, qué obligaciones tienen clientes y negocios, y quién responde por el producto.",
    purpose: "Gobernar la relación entre el cliente, el negocio y PymesHub en cada pedido del marketplace.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/marketplace-terms.md",
    highlights: [
      "PymesHub conecta, no vende ni transporta",
      "Un carrito pertenece a un negocio; los precios los calcula el servidor",
      "Entrega a domicilio o retiro en tienda con código",
      "Cupones, reseñas y conducta prohibida",
      "Datos del pedido tratados solo para cumplirlo",
    ],
  },
  {
    slug: "delivery-and-orders-policy",
    title: "Política de Pedidos y Entregas",
    summary: "El ciclo completo de un pedido — de PENDIENTE a COMPLETADO — y qué esperar de la preparación, la entrega y el retiro en tienda.",
    purpose: "Explicar de forma pública cómo avanza y se entrega un pedido en el marketplace.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/delivery-and-orders-policy.md",
    highlights: [
      "Los ocho estados de un pedido y sus transiciones registradas",
      "Envío, radio, pedido mínimo y tiempo estimado",
      "Retiro en tienda por código",
      "Seguimiento en tiempo real hasta el estado final",
    ],
  },
  {
    slug: "buyer-cancellation-refunds-policy",
    title: "Política de Cancelaciones y Reembolsos para Clientes",
    summary: "Cuándo un cliente puede cancelar sin costo, cuándo aplica un cargo parcial y cómo se devuelve un monto pagado.",
    purpose: "Dar al cliente reglas claras y verificables sobre cancelaciones, reembolsos y reclamos.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/buyer-cancellation-refunds-policy.md",
    highlights: [
      "Cancelación sin costo antes de preparar el pedido",
      "Reembolso al mismo medio de pago o devolución en efectivo",
      "Reclamos de pedidos entregados dentro de 48 horas",
      "Cupones que vuelven a quedar disponibles",
    ],
  },
  {
    slug: "merchant-policy",
    title: "Política para Negocios",
    summary: "Qué necesita un negocio para publicar su catálogo, cómo cumple pedidos y qué roles integran su equipo.",
    purpose: "Fijar las obligaciones del negocio que vende en el marketplace.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/merchant-policy.md",
    highlights: [
      "Estados de la tienda y qué es visible al público",
      "Catálogo, horario, entrega y pedido mínimo",
      "Roles OWNER, MANAGER, STAFF y COURIER",
      "Promociones, reseñas y cumplimiento legal",
    ],
  },
  {
    slug: "terms-of-service",
    title: "Términos y Condiciones de PymesHub",
    summary:
      "Condiciones profesionales para el acceso anticipado, uso beta, cuentas, datos, integraciones, pagos futuros, propiedad intelectual y responsabilidad.",
    purpose: "Gobernar la relación contractual entre PymesHub y cada cliente o usuario autorizado durante la etapa beta y el uso posterior de la Plataforma.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/terms-of-service.md",
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
    purpose:
      "Explicar de forma clara y profesional el tratamiento de datos personales, datos de negocio y datos de clientes finales procesados a través de PymesHub.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/privacy-policy.md",
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
    slug: "location-use",
    title: "Uso de Ubicación en Entregas",
    summary: "Cuándo PymesHub solicita ubicación precisa y en segundo plano, quién puede verla y cuándo deja de recopilarla.",
    purpose: "Explicar de forma clara y previa al permiso cómo funciona el seguimiento de repartidores durante una entrega activa.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/location-use.md",
    highlights: [
      "El seguimiento solo inicia cuando el repartidor comienza una entrega asignada",
      "La ubicación se comparte únicamente con participantes de la entrega",
      "El seguimiento termina al entregar, cancelar, reasignar, cerrar sesión o retirar el permiso",
      "La aplicación explica el uso antes de solicitar el permiso del sistema",
    ],
  },
  {
    slug: "account-deletion",
    title: "Eliminación de Cuenta y Datos",
    summary: "Cómo solicitar, consultar o cancelar la eliminación de una cuenta PymesHub y qué datos se suprimen o anonimizan.",
    purpose: "Dar a cada persona un mecanismo accesible para iniciar y seguir una solicitud de eliminación desde la aplicación.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/account-deletion.md",
    highlights: [
      "Solicitud y estado disponibles dentro de la aplicación",
      "Periodo de siete días para cancelar la solicitud",
      "Eliminación de autenticación, perfil, direcciones y tokens del dispositivo",
      "Anonimización de pedidos y auditorías que deban conservarse",
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
    repoPath: "apps/web/client/src/data/legal/data-processing-addendum.md",
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
    repoPath: "apps/web/client/src/data/legal/acceptable-use-policy.md",
    highlights: [
      "Prohibición de uso ilegal, spam, malware y fraude",
      "Restricciones sobre datos sensibles sin autorización",
      "Reglas específicas de WhatsApp e inteligencia artificial",
      "Consecuencias por incumplimiento",
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
    repoPath: "apps/web/client/src/data/legal/whatsapp-ai-policy.md",
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
    repoPath: "apps/web/client/src/data/legal/cookies-policy.md",
    highlights: [
      "Cookies estrictamente necesarias para sesión y seguridad",
      "Cookies de analítica (Google Analytics) con consentimiento",
      "Banner de consentimiento granular con preferencias",
      "Lista de cookies por categoría, proveedor, finalidad y duración",
    ],
  },
  {
    slug: "copyright-and-infringement",
    title: "Derechos de Autor y Avisos de Infracción",
    summary:
      "A quién escribir para pedir la retirada de material, qué debe incluir el aviso, y qué NO hace esta página.",
    purpose:
      "Dar un camino público y con nombre para que un titular de derechos haga llegar un aviso, dejando claro que Costa Rica no tiene un mecanismo de agente registrado equivalente al de otras jurisdicciones.",
    category: "legal",
    visibility: "public",
    audience: "Cliente",
    repoPath: "apps/web/client/src/data/legal/copyright-and-infringement.md",
    highlights: [
      "Contacto con nombre y correo para recibir avisos de titularidad",
      "Los cinco elementos que un aviso debe traer para no pedir información adicional",
      "La advertencia de que no es un registro ni una exención de responsabilidad",
      "Qué pasa con el material publicado por usuarios frente al de la plataforma",
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
    repoPath: "apps/web/client/src/data/docs/operations/support-policy.md",
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
    repoPath: "apps/web/client/src/data/docs/operations/sla.md",
    highlights: ["Disponibilidad objetivo mensual", "Exclusiones por terceros, fuerza mayor o uso indebido", "Tratamiento prioritario de incidentes críticos"],
  },
  {
    slug: "windows-installer-license-requirements",
    title: "Instalación Windows y Licencia",
    summary: "Requisitos para mostrar licencia, privacidad y aceptación en un instalador Windows futuro.",
    purpose: "Dejar explícito que una distribución Windows debe mostrar la capa legal durante el setup.",
    category: "product-compliance",
    visibility: "internal",
    audience: "Interno",
    repoPath: "apps/web/client/src/data/docs/product-compliance/windows-installer-license-requirements.md",
    highlights: [
      "Mostrar licencia y privacidad antes de finalizar la instalación",
      "Identificar proveedor, soporte y telemetría si existe",
      "Documentar la aceptación cuando el modelo legal lo requiera",
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
