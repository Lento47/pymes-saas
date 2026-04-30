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
      searchPlaceholder: "Search...",
      lightMode: "Light mode",
      darkMode: "Dark mode",
      mobileNav: {
        home: "Home",
        inbox: "Inbox",
        contacts: "Contacts",
        invoices: "Invoices",
        more: "More",
      },
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
          cards: [
            { title: "Danger", desc: "Critical alerts that require immediate action.", example: "42% of tasks overdue" },
            { title: "Alert", desc: "Situations that need attention soon.", example: "7 conversations without an assigned agent" },
            { title: "Positive", desc: "Metrics that improved compared to previous period.", example: "22% more tasks completed" },
            { title: "Info", desc: "Contextual data for planning.", example: "Message volume up 28%" },
            { title: "AI + Humans", desc: "AI suggests, you decide. Human review on key decisions.", example: "Staffing recommendation" },
            { title: "Trends", desc: "Month-over-month comparison to see real evolution.", example: "Revenue, contacts, conversations" },
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
          cards: [
            { title: "Multi-tenant Isolation", desc: "Each workspace has data isolated at the database level. Cross-access is impossible by design." },
            { title: "Encryption", desc: "Data in transit via TLS 1.3. Data at rest encrypted. Secrets encrypted with AES-256-GCM." },
            { title: "DPA & Compliance", desc: "Data Processing Addendum compatible with Costa Rica's Law 8968. Subcontractors publicly documented." },
            { title: "Enterprise SSO", desc: "SAML 2.0 Service Provider. Connect Azure AD, Okta, PingOne, or any compatible IdP." },
            { title: "Backups & DR", desc: "Daily backups with plan-based retention. On-demand restoration. Standby replicas." },
            { title: "Audit & Logs", desc: "Every action is recorded: who, what, when, and from where. Audit API available." },
          ],
        },
      },
      intro: "Closed beta for the first 50 businesses",
      title: ["Your team loses money in WhatsApp, email, and PDFs.", "We are building the fix."],
      subtitle: "PymesHub is in closed beta.",
      description:
        "Be one of the first 50 businesses to try it free and help shape it around your real operation.",
      primaryCta: "I want early access",
      secondaryCta: "Explore the platform",
      note: "No commitment. No card. Just your email so we can notify you when it is ready.",
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
      trustTitle: "We are not here to sell smoke. We are here to build with you.",
      trustDescription:
        "PymesHub is in closed beta. We do not have 500 customers yet, but we do have a team focused on saving Latin American SMBs hours and dollars.",
      trustOffer: "Join now and get lifetime free access to the plan you choose when we launch.",
      trustFootnote: "We only ask for 15 minutes to understand your real operation.",
      trustSignals: ["Closed beta", "First 50 businesses", "Free early access", "Built with operators"],
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
      workspacePickerTitle: "Choose a workspace",
      workspacePickerDescription: "Your account has access to more than one workspace. Pick where you want to continue.",
      cancel: "Cancel",
      createAccount: "Create account",
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
      backToLogin: "Back to login",
      description: "Create your workspace and start centralizing conversations, invoices, and pipeline work.",
      planDescription: "Create your workspace for the {plan} plan.",
      failed: "Registration failed",
      lengthRule: "At least 8 characters",
      uppercaseRule: "One uppercase letter",
      lowercaseRule: "One lowercase letter",
      numberRule: "One number",
      specialRule: "One special character",
      fullName: "Full name",
      emailAddress: "Email address",
      password: "Password",
      passwordPlaceholder: "Create a secure password",
      passwordHint: "Use at least 8 characters with uppercase, lowercase, number, and symbol.",
      creating: "Creating...",
      createAccount: "Create account",
      workspaceCreated: "Workspace created",
      workspaceCreatedDescription: "Your workspace is ready. Keep these details for your team.",
      workspace: "Workspace",
      slug: "Slug",
      loginUrl: "Login URL",
      copyWorkspace: "Copy workspace details",
      continueToWorkspace: "Continue to workspace",
      workspaceCopied: "Workspace details copied",
      copyFailed: "Could not copy automatically",
      workspaceMissing: "Workspace information was not returned by the server.",
      genericError: "Something went wrong. Please try again.",
      terms: "Terms",
      privacy: "Privacy",
      alreadyHaveAccount: "Already have an account?",
      logIn: "Log in",
      showPassword: "Show password",
      hidePassword: "Hide password",
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
      addOns: {
        title: "Add more capacity when you need it",
        subtitle: "Keep the base plan simple and add paid seats as your team grows.",
        available: "Available for paid plans",
        note: "Extra seats are available for paid plans",
        seatBadge: "Seat",
        month: "month",
        items: {
          extra_user: {
            name: "Extra user",
            description: "Add another teammate without changing plans.",
            note: "Per additional user, billed monthly.",
          },
        },
      },
      cta: {
        title: "We have not launched yet. You can get in before everyone else.",
        subtitle: "Leave your email and receive closed-beta access before the public launch.",
        primary: "I want early access",
        secondary: "Schedule a Demo",
        note: "No card. No commitment. We will notify you when the beta is ready.",
      },
      roi: {
        title: "Clear ROI at every level",
        subtitle: "Pay only for what you need. Scale as your business grows and see immediate improvements in response times and revenue.",
        starter: {
          label: "STARTER PLAN",
          items: [
            { title: "Save 5-10 hours/week", desc: "Automatic message routing and basic replies" },
            { title: "Respond 3x faster", desc: "Unified inbox for WhatsApp, Email and more" },
            { title: "Ideal for 1-5 person teams", desc: "Perfect to start improving your operation" },
          ],
        },
        growth: {
          label: "GROWTH PLAN",
          badge: "Most popular ROI",
          items: [
            { title: "+25-40% faster invoicing", desc: "Automated invoicing and payment tracking" },
            { title: "$500-1000/month in recovered revenue", desc: "Recover lost invoices, reduce payment delays" },
            { title: "Best for 5-50 person teams", desc: "Scale operations without hiring more" },
          ],
        },
        businessPlus: {
          label: "BUSINESS+ PLAN",
          items: [
            { title: "Custom integrations", desc: "Sync with your CRM and existing tools" },
            { title: "Dedicated support & training", desc: "Maximize adoption and ROI across the team" },
            { title: "For enterprise teams", desc: "Unlimited customization and growth" },
          ],
        },
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
    footer: {
      colProduct: "Product",
      quickStart: "Quick Start Guide",
      apiRef: "API & SLA Reference",
      security: "Security",
      colDev: "Resources",
      support: "Support Policy",
      platform: "Platform Overview",
      legalHub: "Legal Hub",
      colCompany: "Company",
      about: "About Us",
      blog: "Blog",
      contact: "Contact",
      colLegal: "Legal",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      cookies: "Cookie Policy",
      compliance: "Complies with modern privacy standards.",
      rights: "All rights reserved.",
    },
    legalCenter: {
      eyebrow: "Legal Center",
      title: "PymeHub Legal Documentation",
      description: "Customer-facing legal documents governing the use of the Platform, aligned with Costa Rican legislation and international best practices.",
      backToDocs: "Back to Documentation",
      backToLanding: "Back to landing",
      lastUpdated: "Last updated",
      notFoundTitle: "Document not available",
      notFoundDescription: "This legal document is not yet available or may have been moved.",
      backToLegal: "Back to Legal Center",
      sidebarTitle: "Legal Documents",
      publicBadge: "Public Document",
      purpose: "Purpose",
      coverage: "What this document covers",
      contactPrivacy: "For privacy inquiries, contact",
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
      searchPlaceholder: "Buscar...",
      lightMode: "Modo claro",
      darkMode: "Modo oscuro",
      mobileNav: {
        home: "Inicio",
        inbox: "Bandeja",
        contacts: "Contactos",
        invoices: "Facturas",
        more: "Más",
      },
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
          cards: [
            { title: "Peligro", desc: "Alertas críticas que requieren acción inmediata.", example: "42% de tareas vencidas" },
            { title: "Alerta", desc: "Situaciones que necesitan atención pronto.", example: "7 conversaciones sin agente asignado" },
            { title: "Positivo", desc: "Métricas que mejoraron respecto al período anterior.", example: "22% más tareas completadas" },
            { title: "Info", desc: "Datos contextuales para planificar.", example: "Volumen de mensajes subió 28%" },
            { title: "IA + Humanos", desc: "La IA sugiere, vos decidís. Revisión humana en decisiones clave.", example: "Recomendación de staffing" },
            { title: "Tendencias", desc: "Comparación mes a mes para ver evolución real.", example: "Ingresos, contactos, conversaciones" },
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
          cards: [
            { title: "Aislamiento Multi-tenant", desc: "Cada workspace tiene datos aislados a nivel de base de datos. El acceso cruzado es imposible por diseño." },
            { title: "Cifrado", desc: "Datos en tránsito con TLS 1.3. Datos en reposo cifrados. Secretos encriptados con AES-256-GCM." },
            { title: "DPA y Cumplimiento", desc: "Data Processing Addendum compatible con Ley 8968 de Costa Rica. Subencargados documentados públicamente." },
            { title: "SSO Empresarial", desc: "SAML 2.0 Service Provider. Conectá Azure AD, Okta, PingOne o cualquier IdP compatible." },
            { title: "Backups y DR", desc: "Backups diarios con retención por plan. Restauración bajo demanda. Réplicas en standby." },
            { title: "Auditoría y Logs", desc: "Cada acción queda registrada: quién, qué, cuándo y desde dónde. API de auditoría disponible." },
          ],
        },
      },
      intro: "Beta cerrada para los primeros 50 negocios",
      title: ["Tu equipo pierde dinero en WhatsApp, correos y PDFs.", "Estamos construyendo la solución."],
      subtitle: "PyMesHub está en beta cerrada.",
      description:
        "Sé de los primeros 50 en probarla gratis y ayúdanos a moldearla para tu negocio.",
      primaryCta: "Quiero acceso anticipado",
      secondaryCta: "Explorar la plataforma",
      note: "Sin compromiso. Sin tarjeta. Solo tu correo para avisarte cuando esté lista.",
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
      trustTitle: "No venimos a venderte humo. Venimos a construir contigo.",
      trustDescription:
        "PyMesHub está en beta cerrada. No tenemos 500 clientes todavía, pero tenemos un equipo obsesionado con ahorrarle horas y dólares a las pymes latinas.",
      trustOffer: "Si te sumas ahora, ayudas a definir el producto y accedes con condiciones preferentes cuando lancemos.",
      trustFootnote: "Solo pedimos 15 minutos de tu tiempo para entender tu operación real.",
      trustSignals: ["Beta cerrada", "Primeros 50 negocios", "Acceso anticipado gratis", "Construido con operadores"],
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
      workspacePickerTitle: "Elige un workspace",
      workspacePickerDescription: "Tu cuenta tiene acceso a más de un workspace. Elige dónde quieres continuar.",
      cancel: "Cancelar",
      createAccount: "Crear cuenta",
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
      back: "Volver al landing",
      backToLogin: "Volver al login",
      welcome: "Crea tu workspace gratis",
      description: "En 2 minutos tienes bandeja unificada, facturas y pipeline listos. Sin tarjeta de crédito.",
      failed: "Error al registrarse",
      lengthRule: "Al menos 8 caracteres",
      uppercaseRule: "Una letra mayúscula",
      lowercaseRule: "Una letra minúscula",
      numberRule: "Un número",
      specialRule: "Un carácter especial",
      fullName: "Tu nombre",
      emailAddress: "Correo",
      password: "Contraseña",
      passwordPlaceholder: "Crea una contraseña segura",
      passwordHint: "Usa al menos 8 caracteres con mayúscula, minúscula, número y símbolo.",
      creating: "Creando tu workspace...",
      createAccount: "Crear workspace gratis",
      workspaceName: "Nombre del workspace",
      workspaceHint: "ej: Mi Empresa",
      planDescription: "Crea tu workspace para el plan {plan}.",
      workspaceCreated: "Workspace creado",
      workspaceCreatedDescription: "Tu workspace está listo. Guarda estos datos para tu equipo.",
      workspace: "Workspace",
      slug: "Slug",
      loginUrl: "URL de acceso",
      copyWorkspace: "Copiar datos del workspace",
      continueToWorkspace: "Continuar al workspace",
      workspaceCopied: "Datos del workspace copiados",
      copyFailed: "No se pudo copiar automáticamente",
      workspaceMissing: "El servidor no devolvió la información del workspace.",
      genericError: "Algo salió mal. Inténtalo de nuevo.",
      terms: "Términos",
      privacy: "Privacidad",
      alreadyHave: "¿Ya tienes cuenta?",
      alreadyHaveAccount: "¿Ya tienes cuenta?",
      logIn: "Entrar aquí",
      showPassword: "Mostrar contraseña",
      hidePassword: "Ocultar contraseña",
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
      addOns: {
        title: "Suma capacidad cuando la necesites",
        subtitle: "Mantén tu plan base simple y agrega usuarios pagados conforme crece tu equipo.",
        available: "Disponible para planes pagados",
        note: "Usuarios extra disponibles para planes pagados",
        seatBadge: "Usuario",
        month: "mes",
        items: {
          extra_user: {
            name: "Usuario extra",
            description: "Agrega otro compañero sin cambiar de plan.",
            note: "Por usuario adicional, facturado mensualmente.",
          },
        },
      },
      cta: {
        title: "No lanzamos todavía. Pero puedes entrar antes que nadie.",
        subtitle: "Deja tu correo y recibe acceso a la beta cerrada antes del lanzamiento público.",
        primary: "Quiero mi acceso anticipado",
        secondary: "Agendar demo",
        note: "Sin tarjeta. Sin compromiso. Te avisamos cuando la beta esté lista.",
      },
      roi: {
        title: "ROI claro en cada nivel",
        subtitle: "Pagá solo por lo que necesitás. Escalá conforme crece tu negocio y ve mejoras inmediatas en tiempos de respuesta e ingresos.",
        starter: {
          label: "PLAN STARTER",
          items: [
            { title: "Ahorrá 5-10 horas/semana", desc: "Enrutamiento automático de mensajes y respuestas básicas" },
            { title: "Respondé 3x más rápido", desc: "Bandeja unificada para WhatsApp, Email y más" },
            { title: "Ideal para equipos de 1-5", desc: "Perfecto para empezar a mejorar la operación" },
          ],
        },
        growth: {
          label: "PLAN GROWTH",
          badge: "ROI más popular",
          items: [
            { title: "+25-40% facturación más rápida", desc: "Facturación automatizada y seguimiento de pagos" },
            { title: "$500-1000/mes en ingresos recuperados", desc: "Recuperá facturas perdidas, reducí demoras de pago" },
            { title: "Mejor para equipos de 5-50", desc: "Escalá operaciones sin contratar más" },
          ],
        },
        businessPlus: {
          label: "PLAN BUSINESS+",
          items: [
            { title: "Integraciones personalizadas", desc: "Sincronizá con tu CRM y herramientas existentes" },
            { title: "Soporte y capacitación dedicados", desc: "Maximizá adopción y ROI en todo el equipo" },
            { title: "Para equipos enterprise", desc: "Personalización y crecimiento sin límites" },
          ],
        },
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
    footer: {
      colProduct: "Producto",
      quickStart: "Guía de inicio rápido",
      apiRef: "Referencia API y SLA",
      security: "Seguridad",
      colDev: "Recursos",
      support: "Política de Soporte",
      platform: "Visión General",
      legalHub: "Centro Legal",
      colCompany: "Empresa",
      about: "Sobre Nosotros",
      blog: "Blog",
      contact: "Contacto",
      colLegal: "Legal",
      terms: "Términos del Servicio",
      privacy: "Política de Privacidad",
      cookies: "Política de Cookies",
      compliance: "Cumplimos con estándares modernos de privacidad.",
      rights: "Todos los derechos reservados.",
    },
    legalCenter: {
      eyebrow: "Centro Legal",
      title: "Documentación legal de PymeHub",
      description: "Documentos legales orientados al cliente que rigen el uso de la Plataforma, alineados con la legislación costarricense y mejores prácticas internacionales.",
      backToDocs: "Volver a Documentación",
      backToLanding: "Volver al landing",
      lastUpdated: "Última actualización",
      notFoundTitle: "Documento no disponible",
      notFoundDescription: "Este documento legal aún no está disponible o puede haber sido movido.",
      backToLegal: "Volver al Centro Legal",
      sidebarTitle: "Documentos legales",
      publicBadge: "Documento público",
      purpose: "Propósito",
      coverage: "Qué cubre este documento",
      contactPrivacy: "Para consultas de privacidad, escribe a",
    },
  },
} as const;

export type AppTranslations = (typeof translations)[SupportedLocale];
