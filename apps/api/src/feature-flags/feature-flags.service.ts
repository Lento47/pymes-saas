import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

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

    const planOrder = ["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
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

    const planOrder = ["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];
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
}
