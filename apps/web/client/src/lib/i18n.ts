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
      groups: {
        work: "Work",
        operations: "Operations",
        assistants: "Assistants",
      },
      nav: {
        dashboard: "Dashboard",
        inbox: "Inbox",
        contacts: "Contacts",
        tasks: "Tasks",
        documents: "Files",
        invoices: "Invoices",
        pipeline: "Pipeline",
        automations: "Automations",
        agent: "Agent",
        notifications: "Notifications",
        chat: "AI Chat",
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
        documentation: "Documentation",
        pricing: "Pricing",
        logIn: "Log in",
        getStarted: "Get Started",
      },
      menus: {
        platform: {
          eyebrow: "Enterprise platform",
          title: "Govern the workspace like a modern operations org.",
          description:
            "Permissions, auditability, documentation, and rollout readiness for teams that need structure without slowing down.",
          featuredLabel: "Enterprise readiness",
          featuredTitle: "See how the platform fits together",
          featuredDescription:
            "Understand how customer operations, finance, documentation, and governance connect before rollout.",
          featuredCta: "Open platform section",
          links: [
            {
              title: "Permissions and controls",
              description:
                "Separate leadership, ops, finance, and support visibility with clear workspace roles.",
            },
            {
              title: "Trust center",
              description:
                "Review public security, SLA, and customer-facing governance material.",
            },
            {
              title: "Documentation",
              description:
                "Access platform overviews, launch guides, and operating policies in one place.",
            },
          ],
        },
        workflows: {
          eyebrow: "Operational flows",
          title: "Move handoffs forward without losing context.",
          description:
            "Guide teams from inbound message to invoice, onboarding, and support with one shared thread.",
          featuredLabel: "Launch guide",
          featuredTitle: "Document the motion before the scale-up",
          featuredDescription:
            "Support policy, onboarding steps, and workflow guidance stay close to the product.",
          featuredCta: "Jump to workflows",
          links: [
            {
              title: "Shared execution",
              description:
                "Coordinate sales, service, finance, and operations without broken handoffs.",
            },
            {
              title: "Launch documentation",
              description:
                "Use onboarding and rollout guidance to bring new teams live with less friction.",
            },
            {
              title: "Service operations",
              description:
                "Keep support expectations, ownership, and response paths visible to everyone.",
            },
          ],
        },
        insights: {
          eyebrow: "Operational intelligence",
          title: "Give leaders visibility before issues become revenue drag.",
          description:
            "Pair performance signals with service commitments, documentation, and weekly decision-making cues.",
          featuredLabel: "Documentation",
          featuredTitle: "Review the SLA and service expectations",
          featuredDescription:
            "Public operating commitments are available before teams even sign in.",
          featuredCta: "Open insights section",
          links: [
            {
              title: "Revenue visibility",
              description:
                "Track throughput, reply speed, and invoice follow-through in one operating view.",
            },
            {
              title: "SLA base",
              description:
                "Share uptime expectations and incident treatment with buyers and stakeholders.",
            },
            {
              title: "Support policy",
              description:
                "Document priorities, channels, and escalation rules before launch.",
            },
          ],
        },
        security: {
          eyebrow: "Trust and governance",
          title: "Surface the controls enterprise buyers expect.",
          description:
            "Access control, audit logging, incident readiness, and public legal documentation stay within reach.",
          featuredLabel: "Trust center",
          featuredTitle: "Open the customer trust center",
          featuredDescription:
            "Bring legal, support, privacy, and continuity references together for procurement and IT.",
          featuredCta: "Open security section",
          links: [
            {
              title: "Audit and access",
              description:
                "Show how roles, traceability, and governed activity fit into daily operations.",
            },
            {
              title: "Legal center",
              description:
                "Keep privacy, terms, DPA, and contractual references one click away.",
            },
            {
              title: "Trust documentation",
              description:
                "Expose support, SLA, and security overviews without hiding them behind login.",
            },
          ],
        },
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
        title: "Enterprise control for fast-moving revenue teams.",
        description:
          "Customer operations, approvals, documentation, and billing orchestration run in one governed workspace built for multi-team execution.",
        cards: [
          {
            title: "Enterprise workspace control",
            description:
              "Structure access across leadership, operations, finance, and frontline teams without losing a shared operating view.",
            bullets: [
              "Role-aware permissions for owners, admins, agents, and viewers",
              "Approval paths and accountable handoffs across the workspace",
              "Audit-ready visibility on changes across workflows and billing",
            ],
          },
          {
            title: "Revenue operations spine",
            description:
              "Connect conversations, invoices, follow-ups, and pipeline stages in one operational thread.",
            bullets: [
              "Move from inbound inquiry to payment without tool sprawl",
              "Keep documents, reminders, and collections attached to the same account",
              "Coordinate sales, service, and finance from one system of record",
            ],
          },
          {
            title: "Trust and continuity",
            description:
              "Bring enterprise expectations into day-to-day operations with clearer controls and documentation.",
            bullets: [
              "Support policy, SLA, and trust documentation within reach",
              "Data isolation, access control, and incident-readiness references",
              "Roll out across teams with repeatable onboarding and support motions",
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
        billing: "Billing",
        routing: "Routing",
        apiTokens: "API Tokens",
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
    dashboard: {
      high: "High",
      medium: "Medium",
      low: "Low",
      active: "Active",
      empty: "Empty",
      bannerFallbackTitle: "Good morning, team",
      bannerFallbackSubtitle: "Here's your workspace at a glance.",
      newMessageFrom: "New message from",
      unknownContact: "Unknown contact",
      noSubject: "(no subject)",
      invoiceOverdue: "Invoice Overdue",
      client: "Client",
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
      subtitle: "Here's what's happening in your workspace today.",
      search: "Search...",
      revenue: "Revenue",
      vsLastMonth: "vs last month",
      invoices: "Invoices",
      pending: "Pending",
      tasks: "Tasks",
      urgent: "Urgent",
      pipeline: "Pipeline",
      revenueThisMonth: "Revenue this month",
      outstanding: "Outstanding",
      pipelineValue: "Pipeline value",
      potentialRevenue: "Potential revenue",
      newMessages: "New messages",
      today: "today",
      noMessagesToday: "No new messages today",
      tasksToday: "Tasks today",
      allCaughtUp: "All caught up!",
      revenueOverview: "Revenue Overview",
      viewAllTasks: "View all tasks",
      viewAll: "View all",
      noTasks: "No pending tasks",
      noMessages: "No messages",
      pipelineOverview: "Pipeline Overview",
      viewPipeline: "View pipeline",
      deals: "Deals",
      totalPipelineValue: "Total pipeline value",
      recentActivity: "Recent Activity",
      noRecentActivity: "No recent activity",
      aiInsights: "AI Insights",
      insightNoAlerts: "No alerts",
      insightNoAlertsDesc: "Everything looks good across your workspace",
      insightAlertsInvoices: "Overdue invoices",
      insightAlertsDesc: "invoices require immediate attention",
      insightFollowUp: "Follow-up recommended",
      insightFollowUpDesc: "conversations may need a follow-up message",
      openCopilot: "Open copilot",
      quickActions: "Quick Actions",
      newInvoice: "New invoice",
      addContact: "Add contact",
      newOpportunity: "New opportunity",
      sendMessage: "Send message",
      uploadDocument: "Upload document",
      automation: "Automation",
    },
    invoices: {
      title: "Invoices",
      add: "New Invoice",
      number: "Number",
      amount: "Amount",
      status: "Status",
      dueDate: "Due date",
      client: "Client",
      noInvoices: "No invoices yet",
      paid: "Paid",
      pending: "Pending",
      overdue: "Overdue",
    },
    contacts: {
      title: "Contacts",
      noContacts: "No contacts found",
      search: "Search contacts...",
      add: "Add Contact",
      name: "Name",
      email: "Email",
      phone: "Phone",
      company: "Company",
    },
    pipeline: {
      title: "Pipeline",
      addStage: "Add Stage",
      addDeal: "Add Deal",
      value: "Value",
      priority: "Priority",
      stage: "Stage",
      noDeals: "No deals yet",
    },
    tasks: {
      title: "Tasks",
      search: "Search tasks...",
      add: "Add Task",
      name: "Title",
      status: "Status",
      priority: "Priority",
      dueDate: "Due date",
      noTasks: "No tasks yet",
      overdue: "Overdue",
      today: "Today",
      all: "All",
    },
    register: {
      failed: "Registration failed",
      lengthRule: "At least 8 characters",
      uppercaseRule: "One uppercase letter",
      lowercaseRule: "One lowercase letter",
      numberRule: "One number",
      fullName: "Full name",
      emailAddress: "Email address",
      password: "Password",
      creating: "Creating...",
      createAccount: "Create account",
    },
    automations: {
      pageTitle: "Automations",
      pageDescription: "Build manual rules, advanced flows, and a foundation for AI-assisted automation.",
      newButton: "New automation",
      editButton: "Edit",
      deleteButton: "Delete",
      planLimit: "Plan limit reached",
      conditions: "Conditions",
      trigger: "Trigger",
      action: "Action",
      noConditions: "No conditions",
      empty: { title: "No automations", description: "Create rules to execute useful actions when real events happen." },
      wizard: { info: "Basic Info", trigger: "Trigger", conditions: "Conditions", action: "Action", preview: "Preview" },
    },
    pricing: {
      hero: {
        title: "Simple, transparent pricing",
        subtitle: "Choose the perfect plan for your business",
      },
      comparison: {
        title: "Compare All Features",
        subtitle: "See what features are included in each plan",
      },
      cta: {
        title: "Ready to get started?",
        subtitle: "Join hundreds of businesses using PymeHub",
        primary: "Start Free Trial",
        secondary: "Schedule a Demo",
        note: "No credit card required. Try free for 14 days.",
      },
    },
    documentation: {
      eyebrow: "Documentation center",
      title: "Public references for rollout, trust, and procurement.",
      description:
        "Review platform overviews, security posture, support expectations, and customer-facing legal documents before your team signs in.",
      back: "Back to landing",
      openWorkspace: "Log in",
      openLegal: "Legal center",
      publicBadge: "Public",
      purpose: "Purpose",
      coverage: "What this document covers",
      source: "Source in repository",
      sourceBody:
        "This screen exposes the public summary. The maintained source lives in the repository documentation package.",
      notFoundTitle: "Document not available",
      notFoundBack: "Back to documentation",
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
      groups: {
        work: "Trabajo",
        operations: "Operaciones",
        assistants: "Asistentes",
      },
      nav: {
        dashboard: "Dashboard",
        inbox: "Bandeja",
        contacts: "Contactos",
        tasks: "Tareas",
        documents: "Archivos",
        invoices: "Facturas",
        pipeline: "Pipeline",
        automations: "Automatizaciones",
        agent: "Agente",
        notifications: "Notificaciones",
        chat: "Chat IA",
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
        documentation: "Documentación",
        pricing: "Precios",
        logIn: "Entrar",
        getStarted: "Empezar",
      },
      menus: {
        platform: {
          eyebrow: "Plataforma enterprise",
          title: "Gobierna el workspace como una operación moderna.",
          description:
            "Permisos, trazabilidad, documentación y preparación de rollout para equipos que necesitan estructura sin frenar la ejecución.",
          featuredLabel: "Preparación enterprise",
          featuredTitle: "Entiende cómo encaja toda la plataforma",
          featuredDescription:
            "Visualiza cómo se conectan customer ops, finanzas, documentación y gobernanza antes de lanzar.",
          featuredCta: "Abrir sección de plataforma",
          links: [
            {
              title: "Permisos y controles",
              description:
                "Separa visibilidad para liderazgo, operaciones, finanzas y soporte con roles claros.",
            },
            {
              title: "Trust center",
              description:
                "Revisa material público de seguridad, SLA y gobernanza orientado al cliente.",
            },
            {
              title: "Documentación",
              description:
                "Accede a vistas generales de plataforma, guías de lanzamiento y políticas operativas.",
            },
          ],
        },
        workflows: {
          eyebrow: "Flujos operativos",
          title: "Mueve handoffs sin perder el contexto.",
          description:
            "Guía al equipo desde el mensaje inicial hasta la factura, onboarding y soporte con un solo hilo compartido.",
          featuredLabel: "Guía de lanzamiento",
          featuredTitle: "Documenta el movimiento antes de escalar",
          featuredDescription:
            "La política de soporte, los pasos de onboarding y la guía operativa quedan cerca del producto.",
          featuredCta: "Ir a flujos",
          links: [
            {
              title: "Ejecución compartida",
              description:
                "Coordina ventas, servicio, finanzas y operaciones sin handoffs rotos.",
            },
            {
              title: "Documentación de lanzamiento",
              description:
                "Usa guías de onboarding y rollout para activar equipos con menos fricción.",
            },
            {
              title: "Operación de soporte",
              description:
                "Mantén visibles las expectativas, prioridades y rutas de escalamiento.",
            },
          ],
        },
        insights: {
          eyebrow: "Inteligencia operativa",
          title: "Dale visibilidad al liderazgo antes de que el problema pegue en ingresos.",
          description:
            "Combina señales de rendimiento con compromisos de servicio, documentación y contexto semanal para decidir mejor.",
          featuredLabel: "Documentación",
          featuredTitle: "Revisa el SLA y las expectativas de servicio",
          featuredDescription:
            "Los compromisos operativos públicos están disponibles incluso antes de iniciar sesión.",
          featuredCta: "Abrir sección de insights",
          links: [
            {
              title: "Visibilidad de ingresos",
              description:
                "Sigue throughput, velocidad de respuesta y cobro en una sola vista operativa.",
            },
            {
              title: "SLA base",
              description:
                "Comparte expectativas de disponibilidad y tratamiento de incidentes con stakeholders.",
            },
            {
              title: "Política de soporte",
              description:
                "Documenta prioridades, canales y reglas de escalamiento antes del lanzamiento.",
            },
          ],
        },
        security: {
          eyebrow: "Confianza y gobernanza",
          title: "Muestra los controles que espera un comprador enterprise.",
          description:
            "Control de acceso, logging, preparación ante incidentes y documentación legal pública siempre a mano.",
          featuredLabel: "Trust center",
          featuredTitle: "Abre el centro de confianza para clientes",
          featuredDescription:
            "Agrupa referencias legales, de soporte, privacidad y continuidad para procurement e IT.",
          featuredCta: "Abrir sección de seguridad",
          links: [
            {
              title: "Auditoría y acceso",
              description:
                "Explica cómo encajan roles, trazabilidad y actividad gobernada en la operación diaria.",
            },
            {
              title: "Centro legal",
              description:
                "Mantén términos, privacidad, DPA y referencias contractuales a un clic.",
            },
            {
              title: "Documentación de confianza",
              description:
                "Expón soporte, SLA y resúmenes de seguridad sin esconderlos detrás del login.",
            },
          ],
        },
      },
      intro: "Confían en nosotros 500+ pymes de Latam. ¿Cuál es tu excusa?",
      title: ["Tu equipo está", "perdiendo dinero."],
      subtitle: "WhatsApp, correos, facturas y pipeline en un lugar. Ahora mismo.",
      description:
        "Las pymes pierden $2,000 USD/mes por caos operacional. PyMesHub unifica WhatsApp, email, facturas y pipeline en una bandeja inteligente. Tu equipo responde 3x más rápido. Cobras más. Gastas menos. Todo en minutos, sin IT.",
      primaryCta: "Prueba gratis (no tarjeta)",
      secondaryCta: "Ver demo en vivo",
      note: "⚡ Setup en 5 minutos. Cancelar cuando quieras. Acceso completo al día 1.",
      overview: {
        inbox: {
          title: "Una bandeja para todo",
          description:
            "WhatsApp, email, facturas y mensajes — todo en un lugar. Tu equipo ve el contexto completo. Nadie se pierde clientes otra vez.",
          signals: [
            { label: "WhatsApp", value: "Responden en 2m" },
            { label: "Correo", value: "Cero pendientes" },
            { label: "Facturas", value: "+40% cobro" },
            { label: "Pipeline", value: "Cierre visible" },
          ],
          footer: "Pymes que usan esto cobran $3k más/mes en promedio",
        },
        performance: {
          title: "Ve lo que importa",
          description: "Dashboard en tiempo real. Cuánto cobras, cuánto demoras en responder, dónde se estancan los clientes.",
          metricLabel: "Conversaciones gestionadas",
          timeframe: "Últimos 7 días",
          chartDays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
          stats: [
            { label: "Tiempo respuesta", value: "2.3 min" },
            { label: "Cierre de ventas", value: "+35%" },
            { label: "Retención", value: "98%" },
          ],
        },
        automations: {
          title: "Menos trabajo manual",
          description:
            "Envía recordatorios automáticos, reasigna leads que envejecen, cobra facturas pendientes. Sin tocar nada.",
          statusLabel: "Automaciones activas",
          statusValue: "Activo 24/7",
        },
      },
      trustTitle: "Todo en el mismo lugar",
      trustSignals: ["WhatsApp", "Correo", "Documentos", "Facturas", "Pipeline", "Automatizaciones"],
      platform: {
        eyebrow: "Para pymes que crecen",
        title: "Sin IT. Sin complicación. Sin fuga de dinero.",
        description:
          "Bandeja inteligente + facturación + pipeline + análisis en vivo. Todo en una plataforma. Sin integrar 5 herramientas. Sin capacitación. Sin soporte IT.",
        cards: [
          {
            title: "Control enterprise del workspace",
            description:
              "Estructura el acceso entre liderazgo, operaciones, finanzas y frontline sin perder una vista operativa compartida.",
            bullets: [
              "Permisos por rol para owners, admins, agents y viewers",
              "Rutas de aprobación y handoffs con responsables claros",
              "Visibilidad lista para auditoría sobre cambios y operación",
            ],
          },
          {
            title: "Columna vertebral de revenue ops",
            description:
              "Conecta conversaciones, facturas, seguimientos y etapas del pipeline dentro del mismo hilo operativo.",
            bullets: [
              "Pasa del mensaje entrante al pago sin sprawl de herramientas",
              "Mantén documentos, recordatorios y cobro ligados a la misma cuenta",
              "Coordina ventas, servicio y finanzas desde un solo sistema de registro",
            ],
          },
          {
            title: "Confianza y continuidad",
            description:
              "Aterriza expectativas enterprise en la operación diaria con controles más claros y documentación visible.",
            bullets: [
              "Política de soporte, SLA y trust docs siempre al alcance",
              "Referencias sobre aislamiento de datos, acceso e incidentes",
              "Rollouts repetibles con onboarding y soporte mejor documentados",
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
      welcome: "Listo para cobrar más rápido",
      description:
        "Accede a tu bandeja unificada, facturas, pipeline y reportes. Todo en un lugar.",
      workspaceSlug: "Tu workspace",
      workspaceHint: "El nombre de tu empresa o workspace",
      email: "Correo",
      password: "Contraseña",
      placeholders: {
        workspace: "mi-empresa",
        email: "tu@empresa.com",
        password: "••••••••",
      },
      forgot: "¿Olvidaste tu contraseña?",
      acceptInvite: "Aceptar invitación",
      legalCenter: "Centro legal",
      logIn: "Entrar a mi workspace",
      terms: "Términos",
      privacy: "Privacidad",
      noWorkspace: "¿Primera vez? Crea tu workspace gratis.",
      explore: "Empezar ahora",
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
        billing: "Facturación",
        routing: "Enrutamiento",
        apiTokens: "API Tokens",
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
    dashboard: {
      high: "Alta",
      medium: "Media",
      low: "Baja",
      active: "Activo",
      empty: "Vacío",
      morning: "Buenos días",
      afternoon: "Buenas tardes",
      evening: "Buenas noches",
      subtitle: "Aquí está lo más importante de tu negocio hoy.",
      search: "Buscar en PymesHub...",
      revenue: "Ingresos",
      invoices: "Facturas",
      tasks: "Tareas",
      pipeline: "Pipeline",
      revenueThisMonth: "Ingresos este mes",
      outstanding: "Por cobrar",
      pipelineValue: "Valor del pipeline",
      newMessages: "Nuevos mensajes",
      tasksToday: "Tareas hoy",
      revenueOverview: "Resumen de ingresos",
      pipelineOverview: "Resumen del pipeline",
      viewPipeline: "Ver pipeline",
      totalPipelineValue: "Valor total del pipeline",
      aiInsights: "Insights de IA",
      newOpportunity: "Nueva oportunidad",
      quickActions: "Acciones rápidas",
      newInvoice: "Nueva factura",
      newContact: "Nuevo contacto",
      newTask: "Nueva tarea",
      uploadDocument: "Subir documento",
      sendMessage: "Enviar mensaje",
      viewReports: "Ver reportes",
      unknownContact: "Usuario",
      vsLastMonth: "vs mes anterior",
      pending: "Pendientes",
      urgent: "Urgentes",
      potentialRevenue: "Ingreso potencial",
      invoicesPending: "facturas pendientes",
      today: "hoy",
      noMessagesToday: "Sin mensajes hoy",
      allCaughtUp: "Todo al día",
      viewAllTasks: "Ver tareas",
      viewAll: "Ver todo",
      noTasks: "Sin tareas aún",
      noMessages: "Sin mensajes aún",
      noSubject: "Sin asunto",
      recentActivity: "Actividad reciente",
      noRecentActivity: "Sin actividad reciente",
      newMessageFrom: "Nuevo mensaje de",
      invoiceOverdue: "Factura vencida",
      client: "Cliente",
      openCopilot: "Abrir Copilot",
      automation: "Automatización",
      bannerFallbackTitle: "Todo en orden hoy",
      bannerFallbackSubtitle: "Tu negocio va por buen camino. ¡Sigue así! ✨",
      insightNoAlerts: "Sin alertas urgentes",
      insightNoAlertsDesc: "¡Excelente! Todo está bajo control.",
      insightAlertsInvoices: "facturas vencidas",
      insightAlertsDesc: "Monto total pendiente de revisión.",
      insightFollowUp: "Mejor momento para seguimiento",
      insightFollowUpDesc: "Basado en patrones de interacción.",
      addContact: "Agregar contacto",
      deals: "negocios",
      noValue: "Sin valor registrado",
    },
    contacts: {
      title: "Contactos",
      noContacts: "No se encontraron contactos",
      search: "Buscar contactos...",
      add: "Agregar Contacto",
      name: "Nombre",
      email: "Email",
      phone: "Teléfono",
      company: "Empresa",
    },
    invoices: {
      title: "Facturas",
      add: "Nueva Factura",
      number: "Número",
      amount: "Monto",
      status: "Estado",
      dueDate: "Vencimiento",
      client: "Cliente",
      noInvoices: "Sin facturas aún",
      paid: "Pagada",
      pending: "Pendiente",
      overdue: "Vencida",
    },
    pipeline: {
      title: "Pipeline",
      addStage: "Agregar Etapa",
      addDeal: "Agregar Negocio",
      value: "Valor",
      priority: "Prioridad",
      stage: "Etapa",
      noDeals: "Sin negocios aún",
    },
    tasks: {
      title: "Tareas",
      search: "Buscar tareas...",
      add: "Agregar Tarea",
      name: "Título",
      status: "Estado",
      priority: "Prioridad",
      dueDate: "Fecha límite",
      noTasks: "Sin tareas aún",
      overdue: "Vencidas",
      today: "Hoy",
      all: "Todas",
    },
    register: {
      failed: "Error al registrarse",
      lengthRule: "Al menos 8 caracteres",
      uppercaseRule: "Una letra mayúscula",
      lowercaseRule: "Una letra minúscula",
      numberRule: "Un número",
      fullName: "Nombre completo",
      emailAddress: "Correo electrónico",
      password: "Contraseña",
      creating: "Creando...",
      createAccount: "Crear cuenta",
    },
    automations: {
      pageTitle: "Automatizaciones",
      pageDescription: "Crea reglas manuales, flujos avanzados y una base para automatización asistida por IA.",
      newButton: "Nueva automatización",
      editButton: "Editar",
      deleteButton: "Eliminar",
      planLimit: "Límite del plan alcanzado",
      conditions: "Condiciones",
      trigger: "Trigger",
      action: "Acción",
      noConditions: "Sin condiciones",
      empty: { title: "Sin automatizaciones", description: "Crea reglas para ejecutar acciones útiles cuando pasen eventos reales." },
      wizard: { info: "Info básica", trigger: "Trigger", conditions: "Condiciones", action: "Acción", preview: "Vista previa" },
    },
    pricing: {
      hero: {
        title: "Planes que crecen contigo",
        subtitle: "Paga solo por lo que usas. Cancela cuando quieras.",
      },
      comparison: {
        title: "Qué incluye cada plan",
        subtitle: "Todos los planes traen bandeja unificada, facturas y automaciones.",
      },
      cta: {
        title: "¿Necesitas más?",
        subtitle: "El 70% de nuestros clientes termina en Growth o Business. Hablemos.",
        primary: "Prueba 14 días (gratis)",
        secondary: "Agendar demo",
        note: "✓ No tarjeta. ✓ Acceso completo. ✓ Cancelar en cualquier momento. Sin sorpresas.",
      },
    },
    documentation: {
      eyebrow: "Cómo empezar",
      title: "Guías, API y referencia de seguridad.",
      description:
        "Implementa en 5 minutos. Integra WhatsApp, email, facturas. Usa automaciones. Todo documentado.",
      back: "Volver al landing",
      openWorkspace: "Entrar",
      openLegal: "Centro legal",
      publicBadge: "Público",
      purpose: "Propósito",
      coverage: "Qué cubre este documento",
      source: "Fuente en el repositorio",
      sourceBody:
        "Esta pantalla muestra el resumen público. La fuente mantenible vive dentro del paquete documental del repositorio.",
      notFoundTitle: "Documento no disponible",
      notFoundBack: "Volver a documentación",
    },
  },
} as const;

export type AppTranslations = (typeof translations)[SupportedLocale];
