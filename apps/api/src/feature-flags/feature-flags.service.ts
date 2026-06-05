import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

export type WorkspaceProfile = "emprende" | "business" | "enterprise";

export type FeatureFlag =
  | "automations" | "pipeline" | "ai_assistant" | "hacienda"
  | "message_templates" | "invite_codes" | "agent" | "invoice_reminders" | "credit_notes"
  | "calls"
  | "dashboard_basic" | "whatsapp_inbox" | "contacts_basic"
  | "followups_basic" | "templates_basic" | "ai_assist_basic" | "pipeline_sales"
  | "advanced_workflows" | "omnichannel_advanced" | "enterprise_analytics"
  | "developer_tools" | "ai_autonomous_agents" | "complex_billing" | "admin_diagnostics"
  | "invoices" | "documents" | "tasks";

// ─── Profile-based feature defaults ──────────────────────────────────────
const PROFILE_FEATURES: Record<WorkspaceProfile, Record<string, boolean>> = {
  emprende: {
    dashboard_basic: true, whatsapp_inbox: true, contacts_basic: true,
    followups_basic: true, templates_basic: true, ai_assist_basic: true,
    pipeline_sales: true,
    advanced_workflows: false, omnichannel_advanced: false, enterprise_analytics: false,
    developer_tools: false, ai_autonomous_agents: false, complex_billing: false,
    admin_diagnostics: false, invoices: false, documents: false, tasks: false,
    automations: false, pipeline: false, ai_assistant: false, hacienda: false,
    message_templates: false, agent: false, credit_notes: false, calls: false,
  },
  business: {
    dashboard_basic: true, whatsapp_inbox: true, contacts_basic: true,
    followups_basic: true, templates_basic: true, ai_assist_basic: true,
    pipeline_sales: true, advanced_workflows: true, omnichannel_advanced: true,
    enterprise_analytics: true, developer_tools: true, ai_autonomous_agents: true,
    complex_billing: true, admin_diagnostics: true, invoices: true, documents: true,
    tasks: true, automations: true, pipeline: true, ai_assistant: true, hacienda: true,
    message_templates: true, agent: true, credit_notes: true, calls: true,
  },
  enterprise: {
    dashboard_basic: true, whatsapp_inbox: true, contacts_basic: true,
    followups_basic: true, templates_basic: true, ai_assist_basic: true,
    pipeline_sales: true, advanced_workflows: true, omnichannel_advanced: true,
    enterprise_analytics: true, developer_tools: true, ai_autonomous_agents: true,
    complex_billing: true, admin_diagnostics: true, invoices: true, documents: true,
    tasks: true, automations: true, pipeline: true, ai_assistant: true, hacienda: true,
    message_templates: true, agent: true, credit_notes: true, calls: true,
  },
};

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async seedDefaults() {
    const defaults = [
      {
        key: "automations",
        name: "Automations",
        description: "Automated workflows and triggers",
        required_plan: "STARTER" as const,
      },
      {
        key: "pipeline",
        name: "Pipeline CRM",
        description: "Deals and sales pipeline management",
        required_plan: "STARTER" as const,
      },
      {
        key: "ai_assistant",
        name: "AI Assistant",
        description: "AI-powered invoice and document assistant",
        required_plan: "STARTER" as const,
      },
      {
        key: "hacienda",
        name: "Hacienda Submission",
        description: "Submit invoices to Hacienda CR",
        required_plan: "GROWTH" as const,
      },
      {
        key: "message_templates",
        name: "Message Templates",
        description: "WhatsApp/Telegram message templates",
        required_plan: "GROWTH" as const,
      },
      {
        key: "invite_codes",
        name: "Invite Codes",
        description: "Invite team members via codes",
        required_plan: "STARTER" as const,
      },
      {
        key: "agent",
        name: "Support Agent",
        description: "AI support agent with diagnostics",
        required_plan: "GROWTH" as const,
      },
      {
        key: "invoice_reminders",
        name: "Invoice Reminders",
        description: "Automated payment reminders",
        required_plan: "STARTER" as const,
      },
      {
        key: "credit_notes",
        name: "Credit Notes",
        description: "Create and submit credit notes",
        required_plan: "GROWTH" as const,
      },
      {
        key: "calls",
        name: "Voice & Video Calls",
        description: "WebRTC audio/video calling between workspace members",
        required_plan: "STARTER" as const,
      },
    ];
    for (const flag of defaults) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: { ...flag, enabled: true },
        update: {
          name: flag.name,
          description: flag.description,
          required_plan: flag.required_plan,
        },
      });
    }
    this.logger.log("Default feature flags seeded");
  }

  async isEnabled(key: string, workspaceId: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag || !flag.enabled) return false;

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    if (!ws) return false;

    const planOrder = ["FREE", "EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
    const normalizedPlan = ws.plan === "ENTERPRISE" ? "BUSINESS" : ws.plan;
    const flagPlan = flag.required_plan === "ENTERPRISE" ? "BUSINESS" : flag.required_plan;

    return planOrder.indexOf(normalizedPlan) >= planOrder.indexOf(flagPlan);
  }

  async getAll(workspaceId: string): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany({ where: { enabled: true } });
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });

    const planOrder = ["FREE", "EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
    const normalizedPlan = ws?.plan === "ENTERPRISE" ? "BUSINESS" : (ws?.plan ?? "FREE");

    const result: Record<string, boolean> = {};
    for (const flag of flags) {
      const flagPlan = flag.required_plan === "ENTERPRISE" ? "BUSINESS" : flag.required_plan;
      result[flag.key] = planOrder.indexOf(normalizedPlan) >= planOrder.indexOf(flagPlan);
    }
    return result;
  }

  async getPublicFlags(): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany({ where: { enabled: true } });
    const result: Record<string, boolean> = {};
    for (const flag of flags) {
      result[flag.key] = true; // Public view just shows flag existence
    }
    return result;
  }

  async upsertFlag(id: string | undefined, data: Record<string, any>) {
    if (id) {
      return this.prisma.featureFlag.update({
        where: { id },
        data: {
          key: data.key,
          name: data.name,
          description: data.description,
          required_plan: data.required_plan,
          enabled: data.enabled,
        },
      });
    }
    return this.prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        required_plan: data.required_plan ?? "FREE",
        enabled: data.enabled ?? true,
      },
    });
  }

  async deleteFlag(id: string) {
    return this.prisma.featureFlag.delete({ where: { id } });
  }

  // ── Profile-based methods ──────────────────────────────────────────────

  async getProfile(workspaceId: string): Promise<WorkspaceProfile> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ profile: string; plan: string }>>(
      `SELECT profile, plan FROM workspaces WHERE id = $1`,
      workspaceId,
    );
    const plan = rows[0]?.plan ?? "FREE";
    if (plan === "EMPRENDE") return "emprende";

    const profile = rows[0]?.profile as WorkspaceProfile;
    if (profile === "emprende") return "business";
    return PROFILE_FEATURES[profile] ? profile : "business";
  }

  async getProfileFlags(workspaceId: string): Promise<Record<string, boolean>> {
    const profile = await this.getProfile(workspaceId);
    const base = { ...PROFILE_FEATURES[profile] };

    // Apply workspace-level overrides from features_json
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ features_json: Record<string, boolean> | null }>
    >(`SELECT features_json FROM workspaces WHERE id = $1`, workspaceId);

    const overrides = rows[0]?.features_json ?? {};
    for (const [key, val] of Object.entries(overrides)) {
      if (key in base) (base as Record<string, boolean>)[key] = val;
    }
    return base;
  }

  getSidebarItems(profile: WorkspaceProfile) {
    const isEmprende = profile === "emprende";
    return [
      { path: "/", icon: "LayoutDashboard", label: "Inicio", show: true },
      { path: "/inbox", icon: "Inbox", label: "Bandeja", badge: "unread", show: true },
      { path: "/contacts", icon: "Users", label: "Clientes", show: true },
      { path: "/followups", icon: "Clock", label: "Seguimientos", show: isEmprende },
      { path: "/templates", icon: "FileText", label: "Plantillas", show: isEmprende },
      { path: "/ia", icon: "Sparkles", label: "IA", show: isEmprende },
      { path: "/tasks", icon: "CheckSquare", label: "Tareas", badge: "overdue", show: !isEmprende },
      { path: "/documents", icon: "FileText", label: "Archivos", show: !isEmprende },
      { path: "/invoices", icon: "Receipt", label: "Facturas", show: !isEmprende },
      { path: "/pipeline", icon: "KanbanSquare", label: "Pipeline", show: !isEmprende },
      { path: "/automations", icon: "Zap", label: "Automatizaciones", show: !isEmprende },
    ].filter((item) => item.show);
  }
}
