import { createContext, useContext, useState } from "react";

type Language = "en" | "es";

interface Messages {
  landing?: Record<string, any>;
  pricing?: Record<string, any>;
  nav?: Record<string, string>;
  [key: string]: any;
}

const EN_MESSAGES: Messages = {
  nav: {
    platform: "Platform",
    workflows: "Workflows",
    insights: "Insights",
    security: "Security",
    documentation: "Documentation",
    logIn: "Log In",
    getStarted: "Get Started",
  },
  landing: {
    intro: "🚀 Now in Public Beta",
    title: ["Smart CRM for", "growing businesses"],
    subtitle: "Focus on growth, we handle operations",
    description:
      "Manage customers, invoices, and automations in one place. Built for teams that want to scale without the chaos.",
    primaryCta: "Start Free Trial",
    secondaryCta: "Learn More",
    note: "No credit card required",
    nav: {
      platform: "Platform",
      workflows: "Workflows",
      insights: "Insights",
      security: "Security",
      documentation: "Docs",
      logIn: "Log In",
      getStarted: "Get Started",
    },
    menus: {
      platform: {
        eyebrow: "Core Features",
        title: "Enterprise-grade platform",
        description: "Everything you need to manage customer operations at scale",
        featuredTitle: "Workspace Control",
        featuredDescription: "Full control over your workspace with role-based permissions",
        featuredLabel: "Featured",
        links: [
          {
            title: "Security",
            description: "Enterprise-grade security features",
          },
          {
            title: "Trust Center",
            description: "View our security certifications",
          },
          {
            title: "Documentation",
            description: "Learn how to use PymeHub",
          },
        ],
      },
      workflows: {
        eyebrow: "Automation",
        title: "Automate your workflows",
        description: "Set up intelligent automations to save time",
        featuredTitle: "Smart Automations",
        featuredDescription: "Reduce manual work with AI-powered workflows",
        featuredLabel: "Popular",
        links: [
          {
            title: "Workflow Builder",
            description: "Drag-and-drop automation",
          },
          {
            title: "Getting Started",
            description: "Launch your first workflow",
          },
          {
            title: "Support",
            description: "Get help with automations",
          },
        ],
      },
      insights: {
        eyebrow: "Analytics",
        title: "Insights on your business",
        description: "Track metrics that matter to your growth",
        featuredTitle: "Business Analytics",
        featuredDescription: "Real-time dashboards and reports",
        featuredLabel: "New",
        links: [
          {
            title: "Reports",
            description: "View detailed analytics",
          },
          {
            title: "SLA",
            description: "Service level guarantees",
          },
          {
            title: "Support",
            description: "Help with analytics",
          },
        ],
      },
      security: {
        eyebrow: "Trust & Safety",
        title: "Enterprise security",
        description: "Your data is protected with industry-leading security",
        featuredTitle: "Data Security",
        featuredDescription: "End-to-end encryption and compliance",
        featuredLabel: "Certified",
        links: [
          {
            title: "Encryption",
            description: "How we protect your data",
          },
          {
            title: "Legal",
            description: "Privacy and terms",
          },
          {
            title: "Trust Center",
            description: "Security certifications",
          },
        ],
      },
    },
    platform: {
      eyebrow: "Powerful Features",
      title: "Everything you need",
      description: "Built for businesses that want to scale without complexity",
      cards: [
        {
          title: "Customer Management",
          description: "Organize and manage all your customer relationships in one place",
          bullets: [
            "360° customer view",
            "Custom fields and tags",
            "Contact segmentation",
            "Activity timeline",
          ],
        },
        {
          title: "Smart Workflows",
          description: "Automate repetitive tasks and focus on growth",
          bullets: [
            "No-code workflow builder",
            "Conditional logic",
            "Team notifications",
            "Integration-ready",
          ],
        },
        {
          title: "Insights Dashboard",
          description: "Track what matters with real-time analytics",
          bullets: [
            "Custom dashboards",
            "Revenue tracking",
            "Performance metrics",
            "Export reports",
          ],
        },
      ],
    },
    workflows: {
      eyebrow: "Automation",
      title: "Automate your business",
      description:
        "Set up powerful workflows to save time and reduce manual work. No coding required.",
      features: [
        {
          title: "Drag & Drop Builder",
          body: "Create complex workflows with our intuitive interface",
        },
        {
          title: "Smart Triggers",
          body: "Automate on customer actions, time, or conditions",
        },
        {
          title: "Multi-step Flows",
          body: "Execute complex sequences automatically",
        },
        {
          title: "Team Notifications",
          body: "Keep everyone informed automatically",
        },
      ],
      flowTitle: "Example Workflow",
      flowHeadline: "New Lead Nurturing",
      flowLive: "Live",
      flowSteps: [
        [
          "New contact added",
          "When a contact is created in your system",
        ],
        [
          "Send welcome email",
          "Automatically send personalized introduction",
        ],
        [
          "Schedule follow-up",
          "Set reminder for sales team",
        ],
        [
          "Create task",
          "Task added to team inbox",
        ],
      ],
      metrics: [
        ["Time Saved", "15 hours/month", "Per team member"],
        ["Automation Rate", "60%+", "Of manual tasks"],
        ["Lead Response", "< 2 minutes", "Average time"],
      ],
    },
    insights: {
      eyebrow: "Analytics",
      title: "See your business grow",
      description:
        "Track the metrics that matter with real-time dashboards and insights",
      stats: [
        ["2.4M+", "Requests processed"],
        ["99.9%", "Platform uptime"],
        ["60%+", "Manual work saved"],
      ],
    },
    security: {
      eyebrow: "Trust & Security",
      title: "Enterprise-grade security",
      description:
        "Your data is our responsibility. We follow industry-leading security practices.",
      cards: [
        {
          title: "Data Encryption",
          description: "All data encrypted in transit and at rest",
        },
        {
          title: "Compliance",
          description: "GDPR, SOC 2, ISO 27001 compliant",
        },
        {
          title: "Regular Audits",
          description: "Third-party security assessments",
        },
      ],
    },
    overview: {
      inbox: {
        title: "Smart Inbox",
        description: "Manage all customer communication in one place",
        signals: [
          { label: "Messages Today", value: "245" },
          { label: "Average Response", value: "2min" },
          { label: "Team Messages", value: "18" },
          { label: "Customer Messages", value: "227" },
        ],
        footer: "Integrated with email, chat, and more",
      },
      performance: {
        title: "Performance",
        description: "Real-time insights into your system",
        metricLabel: "Requests Today",
        timeframe: "Last 24 hours",
        chartDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        stats: [
          { label: "Avg Response", value: "45ms" },
          { label: "Uptime", value: "99.99%" },
          { label: "Peak Traffic", value: "2.4M/hr" },
        ],
      },
      automations: {
        title: "Smart Automations",
        description: "Reduce manual work with intelligent workflows",
        statusLabel: "Automations Running",
        statusValue: "145",
      },
    },
    trustTitle: "Trusted by businesses everywhere",
    trustSignals: [
      "🔒 Enterprise Security",
      "⚡ 99.9% Uptime",
      "📈 Used by 500+ teams",
      "🚀 API-first platform",
    ],
  },
  pricing: {
    hero: {
      title: "Simple, transparent pricing",
      subtitle: "Choose the perfect plan for your business",
    },
    nav: {
      logIn: "Log In",
      getStarted: "Get Started",
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
};

const ES_MESSAGES: Messages = {
  nav: {
    platform: "Plataforma",
    workflows: "Automatizaciones",
    insights: "Analítica",
    security: "Seguridad",
    documentation: "Documentación",
    logIn: "Iniciar Sesión",
    getStarted: "Empezar",
  },
  landing: {
    intro: "🚀 Ahora en Beta Pública",
    title: ["CRM inteligente para", "negocios en crecimiento"],
    subtitle: "Enfócate en crecer, nosotros manejamos las operaciones",
    description:
      "Gestiona clientes, facturas y automatizaciones en un solo lugar. Construido para equipos que quieren escalar sin caos.",
    primaryCta: "Comienza Gratis",
    secondaryCta: "Saber Más",
    note: "Sin tarjeta de crédito requerida",
    nav: {
      platform: "Plataforma",
      workflows: "Automatizaciones",
      insights: "Analítica",
      security: "Seguridad",
      documentation: "Docs",
      logIn: "Iniciar Sesión",
      getStarted: "Empezar",
    },
    menus: {
      platform: {
        eyebrow: "Características Principales",
        title: "Plataforma de nivel empresarial",
        description: "Todo lo que necesitas para gestionar operaciones de clientes a escala",
        featuredTitle: "Control de Espacio de Trabajo",
        featuredDescription:
          "Control total de tu espacio de trabajo con permisos basados en roles",
        featuredLabel: "Destacado",
        links: [
          {
            title: "Seguridad",
            description: "Características de seguridad de nivel empresarial",
          },
          {
            title: "Centro de Confianza",
            description: "Ver nuestras certificaciones de seguridad",
          },
          {
            title: "Documentación",
            description: "Aprende a usar PymeHub",
          },
        ],
      },
      workflows: {
        eyebrow: "Automatización",
        title: "Automatiza tus flujos de trabajo",
        description: "Configura automatizaciones inteligentes para ahorrar tiempo",
        featuredTitle: "Automatizaciones Inteligentes",
        featuredDescription: "Reduce el trabajo manual con flujos de trabajo impulsados por IA",
        featuredLabel: "Popular",
        links: [
          {
            title: "Constructor de Flujos",
            description: "Automatización de arrastrar y soltar",
          },
          {
            title: "Cómo Empezar",
            description: "Lanza tu primer flujo de trabajo",
          },
          {
            title: "Soporte",
            description: "Obtén ayuda con automatizaciones",
          },
        ],
      },
      insights: {
        eyebrow: "Analítica",
        title: "Información sobre tu negocio",
        description: "Monitorea métricas que importan para tu crecimiento",
        featuredTitle: "Analítica Empresarial",
        featuredDescription: "Dashboards e informes en tiempo real",
        featuredLabel: "Nuevo",
        links: [
          {
            title: "Reportes",
            description: "Ver análisis detallados",
          },
          {
            title: "SLA",
            description: "Garantías de nivel de servicio",
          },
          {
            title: "Soporte",
            description: "Ayuda con analítica",
          },
        ],
      },
      security: {
        eyebrow: "Confianza y Seguridad",
        title: "Seguridad empresarial",
        description:
          "Tus datos están protegidos con seguridad líder en la industria",
        featuredTitle: "Seguridad de Datos",
        featuredDescription: "Encriptación de extremo a extremo y cumplimiento",
        featuredLabel: "Certificado",
        links: [
          {
            title: "Encriptación",
            description: "Cómo protegemos tus datos",
          },
          {
            title: "Legal",
            description: "Privacidad y términos",
          },
          {
            title: "Centro de Confianza",
            description: "Certificaciones de seguridad",
          },
        ],
      },
    },
    platform: {
      eyebrow: "Características Poderosas",
      title: "Todo lo que necesitas",
      description: "Construido para negocios que quieren escalar sin complejidad",
      cards: [
        {
          title: "Gestión de Clientes",
          description: "Organiza y gestiona todas tus relaciones con clientes en un solo lugar",
          bullets: [
            "Vista 360° del cliente",
            "Campos personalizados y etiquetas",
            "Segmentación de contactos",
            "Cronología de actividades",
          ],
        },
        {
          title: "Flujos Inteligentes",
          description: "Automatiza tareas repetitivas y enfócate en crecer",
          bullets: [
            "Constructor sin código",
            "Lógica condicional",
            "Notificaciones del equipo",
            "Lista para integraciones",
          ],
        },
        {
          title: "Tablero de Información",
          description: "Monitorea lo importante con análisis en tiempo real",
          bullets: [
            "Tableros personalizados",
            "Seguimiento de ingresos",
            "Métricas de rendimiento",
            "Exportar reportes",
          ],
        },
      ],
    },
    workflows: {
      eyebrow: "Automatización",
      title: "Automatiza tu negocio",
      description:
        "Configura flujos de trabajo poderosos para ahorrar tiempo y reducir trabajo manual. Sin código requerido.",
      features: [
        {
          title: "Constructor de Arrastrar y Soltar",
          body: "Crea flujos de trabajo complejos con nuestra interfaz intuitiva",
        },
        {
          title: "Desencadenantes Inteligentes",
          body: "Automatiza en acciones, tiempo o condiciones del cliente",
        },
        {
          title: "Flujos de Múltiples Pasos",
          body: "Ejecuta secuencias complejas automáticamente",
        },
        {
          title: "Notificaciones del Equipo",
          body: "Mantén a todos informados automáticamente",
        },
      ],
      flowTitle: "Flujo de Trabajo Ejemplo",
      flowHeadline: "Nurturing de Nuevos Clientes Potenciales",
      flowLive: "En Vivo",
      flowSteps: [
        [
          "Nuevo contacto añadido",
          "Cuando se crea un contacto en tu sistema",
        ],
        [
          "Enviar correo de bienvenida",
          "Envía automáticamente una introducción personalizada",
        ],
        [
          "Programar seguimiento",
          "Recordatorio establecido para el equipo de ventas",
        ],
        [
          "Crear tarea",
          "Tarea añadida a la bandeja de entrada del equipo",
        ],
      ],
      metrics: [
        ["Tiempo Ahorrado", "15 horas/mes", "Por miembro del equipo"],
        ["Tasa de Automatización", "60%+", "De tareas manuales"],
        ["Respuesta de Clientes", "< 2 minutos", "Tiempo promedio"],
      ],
    },
    insights: {
      eyebrow: "Analítica",
      title: "Ve tu negocio crecer",
      description:
        "Monitorea métricas importantes con dashboards en tiempo real e información",
      stats: [
        ["2.4M+", "Solicitudes procesadas"],
        ["99.9%", "Tiempo activo de plataforma"],
        ["60%+", "Trabajo manual ahorrado"],
      ],
    },
    security: {
      eyebrow: "Confianza y Seguridad",
      title: "Seguridad de nivel empresarial",
      description:
        "Tus datos son nuestra responsabilidad. Seguimos prácticas de seguridad líderes en la industria.",
      cards: [
        {
          title: "Encriptación de Datos",
          description: "Todos los datos encriptados en tránsito y en reposo",
        },
        {
          title: "Cumplimiento",
          description: "GDPR, SOC 2, ISO 27001 conformes",
        },
        {
          title: "Auditorías Regulares",
          description: "Evaluaciones de seguridad de terceros",
        },
      ],
    },
    overview: {
      inbox: {
        title: "Bandeja de Entrada Inteligente",
        description: "Gestiona toda la comunicación con clientes en un solo lugar",
        signals: [
          { label: "Mensajes Hoy", value: "245" },
          { label: "Respuesta Promedio", value: "2min" },
          { label: "Mensajes del Equipo", value: "18" },
          { label: "Mensajes del Cliente", value: "227" },
        ],
        footer: "Integrado con correo electrónico, chat y más",
      },
      performance: {
        title: "Rendimiento",
        description: "Información en tiempo real sobre tu sistema",
        metricLabel: "Solicitudes Hoy",
        timeframe: "Últimas 24 horas",
        chartDays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sab"],
        stats: [
          { label: "Respuesta Prom.", value: "45ms" },
          { label: "Tiempo Activo", value: "99.99%" },
          { label: "Tráfico Pico", value: "2.4M/hr" },
        ],
      },
      automations: {
        title: "Automatizaciones Inteligentes",
        description: "Reduce trabajo manual con flujos de trabajo inteligentes",
        statusLabel: "Automatizaciones en Ejecución",
        statusValue: "145",
      },
    },
    trustTitle: "Confiado por negocios en todas partes",
    trustSignals: [
      "🔒 Seguridad Empresarial",
      "⚡ 99.9% de Disponibilidad",
      "📈 Usado por 500+ equipos",
      "🚀 Plataforma API-first",
    ],
  },
  pricing: {
    hero: {
      title: "Precios simples y transparentes",
      subtitle: "Elige el plan perfecto para tu negocio",
    },
    nav: {
      logIn: "Iniciar Sesión",
      getStarted: "Empezar",
    },
    comparison: {
      title: "Compara Todas las Características",
      subtitle: "Ve qué características incluye cada plan",
    },
    cta: {
      title: "¿Listo para empezar?",
      subtitle: "Únete a cientos de negocios usando PymeHub",
      primary: "Comenzar Prueba Gratuita",
      secondary: "Programar Demostración",
      note: "Sin tarjeta de crédito requerida. Prueba gratis por 14 días.",
    },
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  messages: Messages;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const messages = language === "es" ? ES_MESSAGES : EN_MESSAGES;

  return (
    <I18nContext.Provider value={{ language, setLanguage, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
