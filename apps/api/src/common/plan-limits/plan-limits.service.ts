import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { I18nService } from "../i18n/i18n.service";

// ─── Structured quota error ──────────────────────────────────────────────────

export class QuotaExceededError extends ForbiddenException {
  constructor(
    public resourceType: string,
    public current: number,
    public limit: number | string,
    public plan: string,
    public upgradeTo: string,
  ) {
    const limitDisplay = limit === Infinity || limit === "custom" ? "ilimitado" : limit;
    const message = `Tu plan ${plan} permite un máximo de ${limitDisplay} ${resourceType}. Upgrade a ${upgradeTo} para agregar más.`;
    const helpActions = [
      { type: "delete" as const, label: `Eliminar ${resourceType} que ya no uses`, resourceType },
      { type: "upgrade" as const, label: `Actualizar a plan ${upgradeTo}`, upgradeTo },
    ];
    super({
      error: "QUOTA_EXCEEDED",
      message,
      resourceType,
      current,
      limit,
      plan,
      upgradeTo,
      helpActions,
    });
  }
}

// ─── Evaluation result ──────────────────────────────────────────────────────

export interface PlanLimitEvaluation {
  allowed: boolean;
  currentUsage: number;
  limit: number | "custom";
  planKey: string;
  reason?: string;
  upgradeTarget?: string;
  message?: string;
}

// ─── Plan limits definition ──────────────────────────────────────────────────

interface PlanLimits {
  users: number | "custom";
  automations: number | "custom";
  contacts: number | "custom";
  documents: number | "custom";
  invoices_per_month: number | "custom";
  storage_bytes: number | "custom";
  locations: number | "custom";
  invite_codes: number | "custom";
  products: number | "custom";
  product_categories: number | "custom";
  diagnostics_per_day: number | "custom";
  media_messages_per_day: number | "custom";
}

export type { PlanLimits };

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE: {
    users: 1,
    automations: 5,
    contacts: 100,
    documents: 50,
    invoices_per_month: 50,
    storage_bytes: 100 * 1024 * 1024,
    locations: 1,
    invite_codes: 3,
    products: 50,
    product_categories: 5,
    diagnostics_per_day: 4,
    media_messages_per_day: 0,
  },
  STARTER: {
    users: 1,
    automations: 15,
    contacts: 500,
    documents: 500,
    invoices_per_month: 100,
    storage_bytes: 5 * 1024 * 1024 * 1024,
    locations: 1,
    invite_codes: 10,
    products: 300,
    product_categories: 20,
    diagnostics_per_day: 10,
    media_messages_per_day: 0,
  },
  GROWTH: {
    users: 5,
    automations: 25,
    contacts: 2_500,
    documents: 500,
    invoices_per_month: 500,
    storage_bytes: 10 * 1024 * 1024 * 1024,
    locations: 1,
    invite_codes: 50,
    products: 1500,
    product_categories: 50,
    diagnostics_per_day: 40,
    media_messages_per_day: 10,
  },
  EMPRENDE: {
    users: 1,
    automations: 3,
    contacts: 500,
    documents: 100,
    invoices_per_month: 25,
    storage_bytes: 500 * 1024 * 1024,
    locations: 1,
    invite_codes: 3,
    products: 50,
    product_categories: 5,
    diagnostics_per_day: 10,
    media_messages_per_day: 10,
  },
  BUSINESS: {
    users: 15,
    automations: 100,
    contacts: 15_000,
    documents: 5_000,
    invoices_per_month: 2_000,
    storage_bytes: 50 * 1024 * 1024 * 1024,
    locations: 3,
    invite_codes: 200,
    products: 10000,
    product_categories: 200,
    diagnostics_per_day: 100,
    media_messages_per_day: 50,
  },
  ENTERPRISE: {
    users: 15,
    automations: 100,
    contacts: 15_000,
    documents: 5_000,
    invoices_per_month: 2_000,
    storage_bytes: 50 * 1024 * 1024 * 1024,
    locations: 3,
    invite_codes: 200,
    products: 10000,
    product_categories: 200,
    diagnostics_per_day: 100,
    media_messages_per_day: 200,
  },
  BUSINESS_PLUS: {
    users: "custom",
    automations: "custom",
    contacts: "custom",
    documents: "custom",
    invoices_per_month: "custom",
    storage_bytes: "custom",
    locations: "custom",
    invite_codes: "custom",
    products: "custom",
    product_categories: "custom",
    diagnostics_per_day: "custom",
    media_messages_per_day: "custom",
  },
};

export const PLAN_ORDER = [
  "FREE",
  "STARTER",
  "GROWTH",
  "EMPRENDE",
  "BUSINESS",
  "ENTERPRISE",
  "BUSINESS_PLUS",
] as const;

const PLAN_NAMES: Record<string, string> = {
  FREE: "Gratis",
  STARTER: "Starter",
  GROWTH: "Growth",
  EMPRENDE: "Emprende",
  BUSINESS: "Business",
  ENTERPRISE: "Business",
  BUSINESS_PLUS: "Business+",
};

// Normalize legacy ENTERPRISE to BUSINESS for upgrades
function normalizePlan(plan: string): string {
  if (plan === "ENTERPRISE") return "BUSINESS";
  return plan;
}

@Injectable()
export class PlanLimitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  // ── Public helpers ────────────────────────────────────────────────────────

  getUpgradePlan(currentPlan: string): string {
    const normalized = normalizePlan(currentPlan);
    const order = [...PLAN_ORDER] as string[];
    const idx = order.indexOf(normalized);
    if (idx < 0) return "BUSINESS_PLUS";
    // Skip legacy ENTERPRISE — upgrade from BUSINESS goes directly to BUSINESS_PLUS
    let nextIdx = Math.min(idx + 1, order.length - 1);
    if (order[nextIdx] === "ENTERPRISE") nextIdx = Math.min(nextIdx + 1, order.length - 1);
    return order[nextIdx];
  }

  getLimits(plan: string): PlanLimits {
    const p = normalizePlan(plan);
    return { ...(PLAN_LIMITS[p] ?? PLAN_LIMITS["FREE"]) };
  }

  /** Async version — reads custom limits from WorkspaceEnterpriseConfig for BUSINESS_PLUS */
  async getEffectiveLimits(workspaceId: string): Promise<PlanLimits> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const normalized = normalizePlan(plan);
    const base = { ...(PLAN_LIMITS[normalized] ?? PLAN_LIMITS["FREE"]) };

    // BUSINESS_PLUS: merge custom limits from enterprise config
    if (normalized === "BUSINESS_PLUS") {
      try {
        const config = await this.prisma.workspaceEnterpriseConfig.findUnique({
          where: { workspace_id: workspaceId },
          select: { custom_limits: true },
        });
        const custom = (config?.custom_limits as Record<string, unknown>) ?? {};

        // Map custom limit keys to PlanLimits fields
        const limitMap: Record<string, keyof PlanLimits> = {
          users: "users",
          contacts: "contacts",
          automations: "automations",
          documents: "documents",
          invoicesPerMonth: "invoices_per_month",
          storageGb: "storage_bytes",
          locations: "locations",
        };

        for (const [key, planKey] of Object.entries(limitMap)) {
          if (key === "storageGb" && typeof custom[key] === "number") {
            base[planKey] = (custom[key] as number) * 1024 * 1024 * 1024; // GB → bytes
          } else if (typeof custom[key] === "number") {
            base[planKey] = custom[key] as number;
          }
        }
      } catch {
        // If enterprise config doesn't exist, fall through to default 'custom' limits
      }
    }

    return base;
  }

  // ── Global plan limit management (admin) ────────────────────────────────

  async getAllPlanLimits(): Promise<Record<string, PlanLimits>> {
    const overrides = await this.prisma.planLimitOverride.findMany();
    const overrideMap = new Map<string, number>();
    for (const o of overrides) {
      overrideMap.set(`${o.plan}:${o.resource}`, o.value);
    }

    const result: Record<string, PlanLimits> = {};
    const plans = Object.keys(PLAN_LIMITS);
    for (const plan of plans) {
      const base = { ...PLAN_LIMITS[plan] };
      for (const key of Object.keys(base) as (keyof PlanLimits)[]) {
        const overrideVal = overrideMap.get(`${plan}:${key}`);
        if (overrideVal !== undefined) {
          (base as Record<keyof PlanLimits, number | "custom">)[key] = overrideVal;
        }
      }
      result[plan] = base;
    }
    return result;
  }

  async setPlanLimitOverride(plan: string, resource: string, value: number): Promise<void> {
    await this.prisma.planLimitOverride.upsert({
      where: { plan_resource: { plan, resource } },
      create: { plan, resource, value },
      update: { value },
    });
  }

  async clearPlanLimitOverride(plan: string, resource: string): Promise<void> {
    try {
      await this.prisma.planLimitOverride.delete({
        where: { plan_resource: { plan, resource } },
      });
    } catch {
      // Ignore if no override exists
    }
  }

  async isPlanAtLeast(workspaceId: string, minimumPlan: string): Promise<boolean> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const normalized = normalizePlan(plan);
    const minNorm = normalizePlan(minimumPlan);
    const order = [...PLAN_ORDER] as string[];
    // Skip ENTERPRISE in comparison — it's a legacy alias for BUSINESS
    const effectiveOrder = order.filter((p) => p !== "ENTERPRISE");
    return effectiveOrder.indexOf(normalized) >= effectiveOrder.indexOf(minNorm);
  }

  async enforcePlanTier(
    workspaceId: string,
    minimumPlan: string,
    featureName: string,
  ): Promise<void> {
    const ok = await this.isPlanAtLeast(workspaceId, minimumPlan);
    if (!ok) {
      const plan = await this.getWorkspacePlan(workspaceId);
      throw new ForbiddenException(
        this.i18n.t("errors.planTierRequired", { feature: featureName, plan: minimumPlan }) ||
          `${featureName} requiere plan ${minimumPlan} o superior. Tu plan actual es ${plan}.`,
      );
    }
  }

  async enforceAiAccess(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true, settings_json: true },
    });

    if (ws.plan === "ENTERPRISE" || ws.plan === "BUSINESS_PLUS") return;

    const settings = (ws.settings_json as Record<string, unknown>) ?? {};
    if (settings.ai_assistant_active) return;

    throw new ForbiddenException(
      "El Asistente IA requiere el add-on de IA activo o plan ENTERPRISE.",
    );
  }

  async enforceWhatsappAnalytics(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true, settings_json: true },
    });
    if (ws.plan === "ENTERPRISE" || ws.plan === "BUSINESS_PLUS") return;
    const settings = (ws.settings_json as Record<string, unknown>) ?? {};
    if (settings.whatsapp_premium_active) return;
    throw new ForbiddenException(
      "WhatsApp + Analíticas requiere el add-on activo o plan ENTERPRISE.",
    );
  }

  async enforceAdvancedInventory(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true, settings_json: true },
    });
    if (ws.plan === "ENTERPRISE" || ws.plan === "BUSINESS_PLUS") return;
    const settings = (ws.settings_json as Record<string, unknown>) ?? {};
    if (settings.advanced_inventory_active) return;
    throw new ForbiddenException(
      "Inventario avanzado requiere el add-on activo o plan ENTERPRISE.",
    );
  }

  async enforceApprovalsSignature(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true, settings_json: true },
    });
    if (ws.plan === "ENTERPRISE" || ws.plan === "BUSINESS_PLUS") return;
    const settings = (ws.settings_json as Record<string, unknown>) ?? {};
    if (settings.approvals_signature_active) return;
    throw new ForbiddenException(
      "Aprobaciones y firma digital requiere el add-on activo o plan ENTERPRISE.",
    );
  }

  // ── evaluatePlanLimit — centralized reusable evaluation ──────────────────

  async evaluatePlanLimit(
    workspaceId: string,
    resourceKey: keyof PlanLimits,
    requestedIncrement: number = 1,
  ): Promise<PlanLimitEvaluation> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits[resourceKey];

    // Custom / unlimited → always allow
    if (limit === "custom" || limit === Infinity) {
      return {
        allowed: true,
        currentUsage: 0,
        limit: "custom",
        planKey: plan,
      };
    }

    const currentUsage = await this.getCurrentUsage(workspaceId, resourceKey);

    const allowed = currentUsage + requestedIncrement <= (limit as number);

    if (allowed) {
      return { allowed: true, currentUsage, limit: limit as number, planKey: plan };
    }

    const upgradeTarget = this.getUpgradePlan(plan);
    return {
      allowed: false,
      currentUsage,
      limit: limit as number,
      planKey: plan,
      reason: `Límite de ${resourceKey} alcanzado`,
      upgradeTarget,
      message: `Has alcanzado el límite de ${resourceKeyToString(resourceKey)} (${currentUsage}/${limit}). Considera actualizar a ${PLAN_NAMES[upgradeTarget] || upgradeTarget}.`,
    };
  }

  // ── Private: resolve workspace plan ─────────────────────────────────────

  private async getWorkspacePlan(workspaceId: string): Promise<string> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    return ws.plan;
  }

  // ── Private: resolve current usage ──────────────────────────────────────

  private async getCurrentUsage(
    workspaceId: string,
    resourceKey: keyof PlanLimits,
  ): Promise<number> {
    switch (resourceKey) {
      case "users":
        return this.prisma.workspaceUser.count({ where: { workspace_id: workspaceId } });
      case "automations":
        return this.prisma.automationRule.count({ where: { workspace_id: workspaceId } });
      case "contacts":
        return this.prisma.contact.count({ where: { workspace_id: workspaceId } });
      case "documents":
        return this.prisma.document.count({ where: { workspace_id: workspaceId } });
      case "invoices_per_month": {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return this.prisma.invoice.count({
          where: { workspace_id: workspaceId, created_at: { gte: monthStart } },
        });
      }
      case "storage_bytes": {
        const agg = await this.prisma.document.aggregate({
          where: { workspace_id: workspaceId },
          _sum: { file_size: true },
        });
        return agg._sum.file_size ?? 0;
      }
      case "locations":
        // Count unique location-like data points (canton/province combos on contacts)
        return 1; // Simplified — real implementation would count locations
      case "media_messages_per_day": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.prisma.message.count({
          where: {
            workspace_id: workspaceId,
            direction: "OUTBOUND",
            created_at: { gte: today },
            message_type: { not: null },
          },
        });
      }
      default:
        return 0;
    }
  }

  // ── Public check methods (used by services) ─────────────────────────────

  async checkUserLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    let limit = limits.users;
    if (limit === "custom" || limit === Infinity) return;

    // Extra user add-on: add +1 per extra user purchased
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json as Record<string, unknown>) ?? {};
    if (settings.extra_user_active) {
      const extraUsers = (settings.extra_user_count as number | undefined) ?? 1;
      limit = (limit as number) + extraUsers;
    }

    const current = await this.prisma.workspaceUser.count({ where: { workspace_id: workspaceId } });
    if (current >= (limit as number)) {
      throw new QuotaExceededError("miembros", current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async checkAutomationLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.automations;
    if (limit === "custom" || limit === Infinity) return;

    const current = await this.prisma.automationRule.count({
      where: { workspace_id: workspaceId },
    });
    if (current >= (limit as number)) {
      throw new QuotaExceededError(
        "automatizaciones",
        current,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  async checkContactLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.contacts;
    if (limit === "custom" || limit === Infinity) return;

    const current = await this.prisma.contact.count({ where: { workspace_id: workspaceId } });
    if (current >= (limit as number)) {
      throw new QuotaExceededError("contactos", current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async checkInvoiceLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.invoices_per_month;
    if (limit === "custom" || limit === Infinity) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const current = await this.prisma.invoice.count({
      where: { workspace_id: workspaceId, created_at: { gte: monthStart } },
    });
    if (current >= (limit as number)) {
      throw new QuotaExceededError(
        "facturas este mes",
        current,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  async checkDocumentLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.documents;
    if (limit === "custom" || limit === Infinity) return;

    const current = await this.prisma.document.count({ where: { workspace_id: workspaceId } });
    if (current >= (limit as number)) {
      throw new QuotaExceededError("documentos", current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async checkInviteCodeLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.invite_codes;
    if (limit === "custom" || limit === Infinity) return;

    const current = await this.prisma.invitationCode.count({
      where: { workspace_id: workspaceId, is_active: true, expires_at: { gt: new Date() } },
    });
    if (current >= (limit as number)) {
      throw new QuotaExceededError(
        "códigos de invitación activos",
        current,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  // ── enforceXxx methods (backward-compat aliases used by controllers) ────

  async enforceMembers(workspaceId: string): Promise<void> {
    await this.checkUserLimit(workspaceId);
  }

  async enforceAutomations(workspaceId: string): Promise<void> {
    await this.checkAutomationLimit(workspaceId);
  }

  async enforceContacts(workspaceId: string): Promise<void> {
    await this.checkContactLimit(workspaceId);
  }

  async enforceDocuments(workspaceId: string, newFileSizeBytes: number): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = this.getLimits(plan);

    if (limits.documents !== Infinity && limits.documents !== "custom") {
      const currentCount = await this.prisma.document.count({
        where: { workspace_id: workspaceId },
      });
      if (currentCount >= (limits.documents as number)) {
        throw new QuotaExceededError(
          "documentos",
          currentCount,
          limits.documents,
          plan,
          this.getUpgradePlan(plan),
        );
      }
    }

    if (limits.storage_bytes !== Infinity && limits.storage_bytes !== "custom") {
      const agg = await this.prisma.document.aggregate({
        where: { workspace_id: workspaceId },
        _sum: { file_size: true },
      });
      const usedBytes = agg._sum.file_size ?? 0;
      if (usedBytes + newFileSizeBytes > (limits.storage_bytes as number)) {
        const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
        const limitMB = ((limits.storage_bytes as number) / 1024 / 1024).toFixed(0);
        throw new QuotaExceededError(
          "almacenamiento",
          parseFloat(usedMB),
          parseFloat(limitMB),
          plan,
          this.getUpgradePlan(plan),
        );
      }
    }
  }

  async enforceProductCount(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.products;
    if (limit === "custom" || limit === Infinity) return;
    const current = await this.prisma.product.count({
      where: { workspace_id: workspaceId, is_active: true },
    });
    if (current >= (limit as number)) {
      throw new QuotaExceededError("productos", current, limit, plan, this.getUpgradePlan(plan));
    }
  }

  async enforceCategoryCount(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.product_categories;
    if (limit === "custom" || limit === Infinity) return;
    const current = await this.prisma.productCategory.count({
      where: { workspace_id: workspaceId },
    });
    if (current >= (limit as number)) {
      throw new QuotaExceededError(
        "categorías de productos",
        current,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }

  async enforceDiagnosticLimit(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = await this.getEffectiveLimits(workspaceId);
    const limit = limits.diagnostics_per_day;
    if (limit === "custom" || limit === Infinity) return;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const current = await this.prisma.supportDiagnosticCase.count({
      where: { workspace_id: workspaceId, created_at: { gte: dayAgo } },
    });
    if (current >= (limit as number)) {
      throw new QuotaExceededError(
        "diagnósticos hoy",
        current,
        limit,
        plan,
        this.getUpgradePlan(plan),
      );
    }
  }
}

function resourceKeyToString(key: keyof PlanLimits): string {
  const map: Record<string, string> = {
    users: "usuarios",
    automations: "automatizaciones",
    contacts: "contactos",
    documents: "documentos",
    invoices_per_month: "facturas por mes",
    storage_bytes: "almacenamiento",
    locations: "ubicaciones",
    media_messages_per_day: "archivos multimedia por día",
  };
  return map[key] || key;
}
