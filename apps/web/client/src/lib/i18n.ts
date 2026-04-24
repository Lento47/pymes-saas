import { enUS, es } from "date-fns/locale";

export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "es";
export const LOCALE_STORAGE_KEY = "pymes_locale";

export const intlLocales: Record<SupportedLocale, string> = {
  en: "en-US",
  es: "es-CR",
};

export const dateFnsLocales = {
  en: enUS,
  es,
};

export function normalizeLocale(input?: string | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;

  const normalized = input.trim().toLowerCase();
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";
  return DEFAULT_LOCALE;
}

export const translations = {
  en: {
    language: {
      label: "Language",
      english: "English",
      spanish: "Spanish",
    },
    sidebar: {
      workspaceFallback: "Workspace",
      nav: {
        dashboard: "Dashboard",
        inbox: "Inbox",
        contacts: "Contacts",
        tasks: "Tasks",
        documents: "Files",
        invoices: "Invoices",
        pipeline: "Pipeline",
        automations: "Automations",
      },
      settings: "Settings",
      help: "Help",
      logout: "Log out",
    },
    landing: {
      nav: {
        platform: "Platform",
        workflows: "Workflows",
        insights: "Insights",
        security: "Security",
        logIn: "Log in",
        getStarted: "Get Started",
      },
      intro: "Introducing smarter customer operations for growing teams",
      title: ["Customer operations", "that keep moving."],
      subtitle: "Clarity that converts.",
      description:
        "PymesHub brings conversations, invoicing, workflows, and pipeline visibility into one operating system so your team can respond faster, follow through, and grow with confidence.",
      primaryCta: "Start Free Today",
      secondaryCta: "Explore the platform",
      note: "No credit card required. Launch your workspace in minutes.",
      overview: {
        inbox: {
          title: "Omnichannel inbox",
          description:
            "Route every conversation through the same workspace so your team knows what happened, who owns it, and what should happen next.",
          signals: [
            { label: "WhatsApp", value: "Always on" },
            { label: "Email", value: "Unified queue" },
            { label: "Invoices", value: "Faster collection" },
            { label: "Pipeline", value: "Shared visibility" },
          ],
          footer: "Avg. first response under 6 minutes",
        },
        performance: {
          title: "Performance overview",
          description: "One view for activity, revenue movement, and team momentum",
          metricLabel: "Total conversations handled",
          timeframe: "Last 7 days",
          chartDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          stats: [
            { label: "Response SLA", value: "94%" },
            { label: "Invoices sent", value: "1.2K" },
            { label: "Pipeline velocity", value: "Fast" },
          ],
        },
        automations: {
          title: "Smart automations",
          description:
            "Trigger reminders, handoffs, and follow-ups based on the live state of your workspace instead of manual checklists.",
          statusLabel: "Optimization status",
          statusValue: "Active",
        },
      },
      trustTitle: "Trusted across customer, finance, and operations workflows",
      trustSignals: ["WhatsApp", "Email", "Documents", "Invoices", "Pipeline", "Automations"],
      platform: {
        eyebrow: "Platform",
        title: "Built for the whole customer journey, not just one slice of it.",
        description:
          "Sales, service, billing, and follow-through all live in one calm workspace. That means fewer blind spots and faster handoffs between teams.",
        cards: [
          {
            title: "Conversations that stay organized",
            description:
              "Bring channels into one workspace so your team always sees context, owner, and next action.",
            bullets: [
              "Centralize WhatsApp, email, and internal notes",
              "Assign conversations without losing accountability",
              "Surface urgent customers before they slip",
            ],
          },
          {
            title: "Billing that keeps momentum",
            description:
              "Send invoices, follow payment status, and keep financial operations aligned with the sales team.",
            bullets: [
              "Issue invoices from the same operational flow",
              "Track approvals, documents, and payment reminders",
              "Support local compliance-heavy processes with clarity",
            ],
          },
          {
            title: "Pipeline visibility your team can use",
            description:
              "See deal movement, stalled opportunities, and activity trends without stitching multiple tools together.",
            bullets: [
              "Watch stage movement in real time",
              "Coordinate follow-ups across sales and ops",
              "Measure throughput with live dashboards",
            ],
          },
        ],
      },
      workflows: {
        eyebrow: "Workflows",
        title: "A workspace that mirrors how your team already works.",
        description:
          "Instead of bouncing between inboxes, spreadsheets, invoicing tools, and follow-up lists, PymesHub keeps the operational thread intact from the first message to final payment.",
        features: [
          {
            title: "Shared handoffs",
            body: "Assign, escalate, or reopen work without losing the original customer context.",
          },
          {
            title: "Smarter follow-ups",
            body: "Surface stalled deals and overdue replies before they become revenue leaks.",
          },
          {
            title: "Live team pulse",
            body: "See what is moving, what is blocked, and which metrics need attention this week.",
          },
          {
            title: "Regional-ready operations",
            body: "Stay ready for compliance-heavy, multi-channel work common across Latin American teams.",
          },
        ],
        flowTitle: "Workspace flow",
        flowHeadline: "From conversation to collection",
        flowLive: "Live",
        flowSteps: [
          ["New inquiry", "WhatsApp assigned to Andrea"],
          ["Qualified lead", "Proposal sent and reminder scheduled"],
          ["Invoice issued", "Payment follow-up set for Friday"],
          ["Won account", "Operations onboarding activated"],
        ],
        metrics: [
          ["Inbox health", "91%", "of customer threads have an owner, next step, and due date."],
          ["Team signal", "4.7x", "more clarity on what is stalled, overdue, or ready to close."],
        ],
      },
      insights: {
        eyebrow: "Insights",
        title: "Know where momentum is building and where it is leaking.",
        description:
          "PymesHub highlights reply speed, invoice progress, and pipeline health in one place so leaders can act before slowdowns show up in revenue.",
        stats: [
          ["14 min", "median first reply"],
          ["82%", "invoice follow-through"],
          ["3.2x", "faster team handoff"],
          ["99.9%", "workspace availability"],
        ],
      },
      security: {
        eyebrow: "Security",
        title: "Operational confidence at every layer.",
        description:
          "Keep workspace access structured, audit activity when needed, and give teams a surface they can rely on day after day.",
        cards: [
          {
            title: "Workspace permissions",
            body: "Separate responsibilities across teams while keeping a single shared source of truth.",
          },
          {
            title: "Traceable activity",
            body: "See how conversations, billing, and operational tasks evolve across the lifecycle.",
          },
          {
            title: "Always-on experience",
            body: "Fast, stable surfaces for the daily work your revenue engine depends on.",
          },
        ],
        ctaEyebrow: "Ready to launch",
        ctaTitle: "Start with the same workspace your team will actually use.",
        ctaDescription:
          "Make the first click feel confident, give your team a single operating rhythm, and move from customer message to paid invoice without patching tools together.",
        ctaPrimary: "Open your workspace",
        ctaSecondary: "Review the platform",
      },
    },
    login: {
      back: "Back to landing",
      welcome: "Welcome back",
      description:
        "Log in to continue managing conversations, invoices, and team workflows from one workspace.",
      workspaceSlug: "Workspace slug",
      workspaceHint: "Use the workspace identifier you were invited to.",
      email: "Email address",
      password: "Password",
      placeholders: {
        workspace: "my-company",
        email: "you@company.com",
        password: "Enter your password",
      },
      forgot: "Need another route?",
      acceptInvite: "Accept an invite",
      legalCenter: "Legal center",
      logIn: "Log in",
      terms: "Terms",
      privacy: "Privacy",
      noWorkspace: "Don't have a workspace yet?",
      explore: "Explore the platform",
      showPassword: "Show password",
      hidePassword: "Hide password",
      unknownError: "Unknown error",
      loginErrorTitle: "Could not sign in",
    },
    settings: {
      pageTitle: "Settings",
      tabs: {
        workspace: "Workspace",
        members: "Members",
        channels: "Channels",
        departments: "Departments",
        integrations: "Integrations",
        ai: "Artificial Intelligence",
        platform: "Platform",
      },
      locale: {
        title: "Workspace language",
        description: "Choose the default language for this workspace. The app can still preview either language instantly.",
        label: "Default language",
        save: "Save language",
        saving: "Saving...",
        saved: "Language updated",
        error: "Could not update the workspace language",
      },
    },
  },
  es: {
    language: {
      label: "Idioma",
      english: "Inglés",
      spanish: "Español",
    },
    sidebar: {
      workspaceFallback: "Workspace",
      nav: {
        dashboard: "Dashboard",
        inbox: "Bandeja",
        contacts: "Contactos",
        tasks: "Tareas",
        documents: "Archivos",
        invoices: "Facturas",
        pipeline: "Pipeline",
        automations: "Automatizaciones",
      },
      settings: "Configuración",
      help: "Ayuda",
      logout: "Cerrar sesión",
    },
    landing: {
      nav: {
        platform: "Plataforma",
        workflows: "Flujos",
        insights: "Insights",
        security: "Seguridad",
        logIn: "Entrar",
        getStarted: "Empezar",
      },
      intro: "Presentando operaciones de cliente más inteligentes para equipos en crecimiento",
      title: ["Operaciones de cliente", "que no se detienen."],
      subtitle: "Claridad que convierte.",
      description:
        "PymesHub reúne conversaciones, facturación, flujos de trabajo y visibilidad del pipeline en un solo sistema operativo para que tu equipo responda más rápido, dé mejor seguimiento y crezca con confianza.",
      primaryCta: "Empieza gratis hoy",
      secondaryCta: "Explora la plataforma",
      note: "No se requiere tarjeta. Lanza tu workspace en minutos.",
      overview: {
        inbox: {
          title: "Bandeja omnicanal",
          description:
            "Dirige cada conversación dentro del mismo workspace para que tu equipo sepa qué pasó, quién la lleva y qué sigue.",
          signals: [
            { label: "WhatsApp", value: "Siempre activo" },
            { label: "Correo", value: "Cola unificada" },
            { label: "Facturas", value: "Cobro más ágil" },
            { label: "Pipeline", value: "Visibilidad compartida" },
          ],
          footer: "Primera respuesta promedio en menos de 6 minutos",
        },
        performance: {
          title: "Resumen de rendimiento",
          description: "Una vista para actividad, movimiento de ingresos y ritmo del equipo",
          metricLabel: "Conversaciones gestionadas",
          timeframe: "Últimos 7 días",
          chartDays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
          stats: [
            { label: "SLA de respuesta", value: "94%" },
            { label: "Facturas enviadas", value: "1.2K" },
            { label: "Velocidad del pipeline", value: "Alta" },
          ],
        },
        automations: {
          title: "Automatizaciones inteligentes",
          description:
            "Activa recordatorios, handoffs y seguimientos basados en el estado real del workspace y no en listas manuales.",
          statusLabel: "Estado de optimización",
          statusValue: "Activo",
        },
      },
      trustTitle: "Usado en flujos de cliente, finanzas y operaciones",
      trustSignals: ["WhatsApp", "Correo", "Documentos", "Facturas", "Pipeline", "Automatizaciones"],
      platform: {
        eyebrow: "Plataforma",
        title: "Hecho para todo el recorrido del cliente, no solo para una parte.",
        description:
          "Ventas, servicio, facturación y seguimiento viven en un solo workspace sereno. Eso significa menos puntos ciegos y handoffs más rápidos entre equipos.",
        cards: [
          {
            title: "Conversaciones que se mantienen ordenadas",
            description:
              "Reúne los canales en un solo workspace para que tu equipo siempre vea contexto, responsable y siguiente paso.",
            bullets: [
              "Centraliza WhatsApp, correo y notas internas",
              "Asigna conversaciones sin perder responsabilidad",
              "Detecta clientes urgentes antes de que se escapen",
            ],
          },
          {
            title: "Facturación que mantiene el ritmo",
            description:
              "Envía facturas, sigue su estado de pago y alinea la operación financiera con el equipo comercial.",
            bullets: [
              "Emite facturas dentro del mismo flujo operativo",
              "Sigue aprobaciones, documentos y recordatorios de cobro",
              "Acompaña procesos locales con más claridad",
            ],
          },
          {
            title: "Visibilidad del pipeline que sí se usa",
            description:
              "Observa el movimiento de oportunidades y las tendencias de actividad sin pegar herramientas entre sí.",
            bullets: [
              "Ve el avance por etapas en tiempo real",
              "Coordina seguimientos entre ventas y operaciones",
              "Mide el ritmo con dashboards vivos",
            ],
          },
        ],
      },
      workflows: {
        eyebrow: "Flujos",
        title: "Un workspace que refleja cómo ya trabaja tu equipo.",
        description:
          "En lugar de saltar entre bandejas, hojas de cálculo, facturación y listas de seguimiento, PymesHub mantiene el hilo operativo intacto desde el primer mensaje hasta el pago final.",
        features: [
          {
            title: "Handoffs compartidos",
            body: "Asigna, escala o reabre trabajo sin perder el contexto original del cliente.",
          },
          {
            title: "Seguimientos más inteligentes",
            body: "Detecta negocios frenados y respuestas vencidas antes de que se conviertan en fugas de ingresos.",
          },
          {
            title: "Pulso vivo del equipo",
            body: "Ve qué avanza, qué está bloqueado y qué métricas necesitan atención esta semana.",
          },
          {
            title: "Operación lista para la región",
            body: "Mantente preparado para operaciones multicanal y más exigentes como las de muchos equipos en Latinoamérica.",
          },
        ],
        flowTitle: "Flujo del workspace",
        flowHeadline: "De la conversación al cobro",
        flowLive: "En vivo",
        flowSteps: [
          ["Nueva consulta", "WhatsApp asignado a Andrea"],
          ["Lead calificado", "Propuesta enviada y recordatorio programado"],
          ["Factura emitida", "Seguimiento de pago programado para viernes"],
          ["Cuenta ganada", "Onboarding operativo activado"],
        ],
        metrics: [
          ["Salud de la bandeja", "91%", "de los hilos ya tienen responsable, próximo paso y fecha."],
          ["Señal del equipo", "4.7x", "más claridad sobre lo detenido, vencido o listo para cerrar."],
        ],
      },
      insights: {
        eyebrow: "Insights",
        title: "Entiende dónde se acelera el ritmo y dónde se está perdiendo.",
        description:
          "PymesHub resalta velocidad de respuesta, avance de facturas y salud del pipeline en un solo lugar para que los líderes actúen antes de que el freno llegue a ingresos.",
        stats: [
          ["14 min", "mediana de primera respuesta"],
          ["82%", "seguimiento de facturas"],
          ["3.2x", "handoff más rápido"],
          ["99.9%", "disponibilidad del workspace"],
        ],
      },
      security: {
        eyebrow: "Seguridad",
        title: "Confianza operativa en cada capa.",
        description:
          "Mantén el acceso al workspace bien estructurado, audita actividad cuando haga falta y dale al equipo una superficie confiable cada día.",
        cards: [
          {
            title: "Permisos del workspace",
            body: "Separa responsabilidades por equipo manteniendo una sola fuente compartida de verdad.",
          },
          {
            title: "Actividad trazable",
            body: "Observa cómo evolucionan conversaciones, facturación y tareas operativas a lo largo del ciclo.",
          },
          {
            title: "Experiencia siempre activa",
            body: "Superficies rápidas y estables para el trabajo diario del que depende tu operación.",
          },
        ],
        ctaEyebrow: "Listo para lanzar",
        ctaTitle: "Empieza con el mismo workspace que tu equipo sí va a usar.",
        ctaDescription:
          "Haz que el primer clic se sienta seguro, dale a tu equipo un solo ritmo operativo y pasa del mensaje del cliente a la factura pagada sin pegar herramientas.",
        ctaPrimary: "Abre tu workspace",
        ctaSecondary: "Revisa la plataforma",
      },
    },
    login: {
      back: "Volver al landing",
      welcome: "Bienvenido de nuevo",
      description:
        "Inicia sesión para seguir gestionando conversaciones, facturas y flujos del equipo desde un solo workspace.",
      workspaceSlug: "Slug del workspace",
      workspaceHint: "Usa el identificador del workspace al que te invitaron.",
      email: "Correo electrónico",
      password: "Contraseña",
      placeholders: {
        workspace: "mi-empresa",
        email: "tu@empresa.com",
        password: "Ingresa tu contraseña",
      },
      forgot: "¿Necesitas otra ruta?",
      acceptInvite: "Aceptar invitación",
      legalCenter: "Centro legal",
      logIn: "Entrar",
      terms: "Términos",
      privacy: "Privacidad",
      noWorkspace: "¿Todavía no tienes un workspace?",
      explore: "Explora la plataforma",
      showPassword: "Mostrar contraseña",
      hidePassword: "Ocultar contraseña",
      unknownError: "Error desconocido",
      loginErrorTitle: "No se pudo iniciar sesión",
    },
    settings: {
      pageTitle: "Configuración",
      tabs: {
        workspace: "Workspace",
        members: "Miembros",
        channels: "Canales",
        departments: "Departamentos",
        integrations: "Integraciones",
        ai: "Inteligencia Artificial",
        platform: "Plataforma",
      },
      locale: {
        title: "Idioma del workspace",
        description: "Elige el idioma predeterminado del workspace. La app aún puede previsualizar cualquiera de los dos al instante.",
        label: "Idioma predeterminado",
        save: "Guardar idioma",
        saving: "Guardando...",
        saved: "Idioma actualizado",
        error: "No se pudo actualizar el idioma del workspace",
      },
    },
  },
} as const;

export type AppTranslations = (typeof translations)[SupportedLocale];
